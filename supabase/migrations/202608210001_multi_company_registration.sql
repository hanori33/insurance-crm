begin;

create or replace function public.current_profile_is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role = 'superadmin'
    )
    or exists (
      select 1
      from public.profiles
      where user_id = auth.uid()
        and role = 'superadmin'
    );
$$;

revoke all on function public.current_profile_is_superadmin() from public, anon, authenticated;
grant execute on function public.current_profile_is_superadmin() to authenticated;

create table if not exists public.organization_registration_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  requester_user_id uuid not null references auth.users(id) on delete cascade,
  requested_name text not null,
  normalized_name text not null,
  business_registration_number text,
  representative_name text,
  contact_email text,
  status text not null default 'pending',
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  rejection_reason text,
  constraint organization_registration_requests_name_not_blank
    check (length(trim(requested_name)) > 0),
  constraint organization_registration_requests_status_allowed
    check (status in ('pending', 'approved', 'rejected'))
);

alter table public.role_requests
  add column if not exists company_org_unit_id uuid references public.organization_units(id) on delete set null,
  add column if not exists requested_org_unit_id uuid references public.organization_units(id) on delete set null;

create index if not exists role_requests_company_org_unit_id_idx
  on public.role_requests(company_org_unit_id);

create index if not exists role_requests_requested_org_unit_id_idx
  on public.role_requests(requested_org_unit_id);

create index if not exists organization_registration_requests_requester_idx
  on public.organization_registration_requests(requester_user_id);

create index if not exists organization_registration_requests_status_idx
  on public.organization_registration_requests(status, created_at);

create unique index if not exists organization_registration_requests_pending_normalized_idx
  on public.organization_registration_requests(normalized_name)
  where status = 'pending';

do $$
begin
  if not exists (
    select 1
    from public.organization_units
    where parent_id is null
      and is_active = true
    group by normalized_name
    having count(*) > 1
  ) then
    execute
      'create unique index if not exists organization_units_active_root_normalized_unique_idx
         on public.organization_units(normalized_name)
         where parent_id is null and is_active = true';
  end if;
end;
$$;

create or replace function public.user_can_manage_org_unit(p_user_id uuid, p_org_unit_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(public.current_profile_is_superadmin(), false)
    or exists (
      select 1
      from public.organization_memberships manager_membership
      join public.organization_units target_unit
        on target_unit.id = p_org_unit_id
      where manager_membership.user_id = p_user_id
        and manager_membership.status = 'active'
        and manager_membership.role in ('owner', 'org_admin', 'manager', 'team_leader')
        and manager_membership.org_unit_id = any(target_unit.path)
    );
$$;

create or replace function public.search_company_roots(p_query text default '')
returns table (
  id uuid,
  name text,
  display_type text,
  normalized_name text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select ou.id,
         ou.name,
         ou.display_type,
         ou.normalized_name,
         ou.created_at
  from public.organization_units ou
  where ou.parent_id is null
    and ou.is_active = true
    and (
      public.normalize_organization_unit_name(coalesce(p_query, '')) = ''
      or ou.normalized_name like '%' || public.normalize_organization_unit_name(p_query) || '%'
      or ou.name ilike '%' || trim(coalesce(p_query, '')) || '%'
    )
  order by
    case when ou.normalized_name = public.normalize_organization_unit_name(p_query) then 0 else 1 end,
    ou.name
  limit 20;
$$;

grant execute on function public.search_company_roots(text) to authenticated;

create or replace function public.list_company_organization_units(
  p_root_org_unit_id uuid,
  p_query text default ''
)
returns table (
  id uuid,
  parent_id uuid,
  name text,
  display_type text,
  depth integer,
  path_names text[],
  is_active boolean
)
language sql
security definer
stable
set search_path = public
as $$
  with root as (
    select *
    from public.organization_units
    where id = p_root_org_unit_id
      and parent_id is null
      and is_active = true
  ),
  visible_units as (
    select ou.*
    from public.organization_units ou
    join root on root.id = any(ou.path)
    where ou.is_active = true
      and (
        public.normalize_organization_unit_name(coalesce(p_query, '')) = ''
        or ou.normalized_name like '%' || public.normalize_organization_unit_name(p_query) || '%'
        or ou.name ilike '%' || trim(coalesce(p_query, '')) || '%'
      )
  )
  select visible_units.id,
         visible_units.parent_id,
         visible_units.name,
         visible_units.display_type,
         visible_units.depth,
         coalesce(array_agg(path_unit.name order by path_order.ordinality), '{}'::text[]) as path_names,
         visible_units.is_active
  from visible_units
  left join lateral unnest(visible_units.path) with ordinality as path_order(path_id, ordinality)
    on true
  left join public.organization_units path_unit
    on path_unit.id = path_order.path_id
  group by visible_units.id,
           visible_units.parent_id,
           visible_units.name,
           visible_units.display_type,
           visible_units.depth,
           visible_units.is_active
  order by visible_units.depth, visible_units.name
  limit 100;
$$;

grant execute on function public.list_company_organization_units(uuid, text) to authenticated;

create or replace function public.request_organization_registration(
  p_requested_name text,
  p_business_registration_number text default null,
  p_representative_name text default null,
  p_contact_email text default null
)
returns public.organization_registration_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text;
  normalized text;
  created_request public.organization_registration_requests;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  clean_name := trim(coalesce(p_requested_name, ''));
  normalized := public.normalize_organization_unit_name(clean_name);

  if normalized = '' then
    raise exception 'ORGANIZATION_NAME_REQUIRED';
  end if;

  if exists (
    select 1
    from public.organization_units
    where parent_id is null
      and is_active = true
      and normalized_name = normalized
  ) then
    raise exception 'ORGANIZATION_ALREADY_EXISTS';
  end if;

  insert into public.organization_registration_requests (
    requester_user_id,
    requested_name,
    normalized_name,
    business_registration_number,
    representative_name,
    contact_email
  )
  values (
    auth.uid(),
    clean_name,
    normalized,
    nullif(trim(coalesce(p_business_registration_number, '')), ''),
    nullif(trim(coalesce(p_representative_name, '')), ''),
    nullif(trim(coalesce(p_contact_email, '')), '')
  )
  on conflict (normalized_name) where status = 'pending'
  do update set
    requested_name = excluded.requested_name,
    business_registration_number = excluded.business_registration_number,
    representative_name = excluded.representative_name,
    contact_email = excluded.contact_email
  returning * into created_request;

  return created_request;
end;
$$;

grant execute on function public.request_organization_registration(text, text, text, text) to authenticated;

create or replace function public.list_my_organization_registration_requests()
returns setof public.organization_registration_requests
language sql
security definer
stable
set search_path = public
as $$
  select *
  from public.organization_registration_requests
  where requester_user_id = auth.uid()
  order by created_at desc;
$$;

grant execute on function public.list_my_organization_registration_requests() to authenticated;

create or replace function public.list_organization_registration_requests(p_status text default 'pending')
returns table (
  id uuid,
  requester_user_id uuid,
  requester_email text,
  requester_name text,
  requested_name text,
  normalized_name text,
  business_registration_number text,
  representative_name text,
  contact_email text,
  status text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz,
  rejection_reason text
)
language sql
security definer
stable
set search_path = public
as $$
  select r.id,
         r.requester_user_id,
         u.email as requester_email,
         p.name as requester_name,
         r.requested_name,
         r.normalized_name,
         r.business_registration_number,
         r.representative_name,
         r.contact_email,
         r.status,
         r.reviewed_by,
         r.reviewed_at,
         r.created_at,
         r.rejection_reason
  from public.organization_registration_requests r
  left join auth.users u on u.id = r.requester_user_id
  left join public.profiles p on p.user_id = r.requester_user_id
  where coalesce(public.current_profile_is_superadmin(), false)
    and (p_status is null or r.status = p_status)
  order by r.created_at desc;
$$;

grant execute on function public.list_organization_registration_requests(text) to authenticated;

create or replace function public.approve_organization_registration_request(p_request_id uuid)
returns table (
  request_id uuid,
  org_unit_id uuid,
  org_unit_name text,
  requester_user_id uuid,
  membership_role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.organization_registration_requests;
  created_root public.organization_units;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not coalesce(public.current_profile_is_superadmin(), false) then
    raise exception 'SUPERADMIN_REQUIRED';
  end if;

  select *
    into req
  from public.organization_registration_requests
  where id = p_request_id
  for update;

  if req.id is null then
    raise exception 'ORGANIZATION_REQUEST_NOT_FOUND';
  end if;

  if req.status <> 'pending' then
    raise exception 'ORGANIZATION_REQUEST_ALREADY_REVIEWED';
  end if;

  if exists (
    select 1
    from public.organization_units
    where parent_id is null
      and is_active = true
      and normalized_name = req.normalized_name
  ) then
    raise exception 'ORGANIZATION_ALREADY_EXISTS';
  end if;

  insert into public.organization_units (
    parent_id,
    name,
    display_type,
    created_by,
    normalized_name
  )
  values (
    null,
    req.requested_name,
    '회사/GA',
    auth.uid(),
    req.normalized_name
  )
  returning * into created_root;

  insert into public.organization_memberships (user_id, org_unit_id, role, status)
  values (req.requester_user_id, created_root.id, 'org_admin', 'active')
  on conflict on constraint organization_memberships_user_org_unique
  do update set
    role = 'org_admin',
    status = 'active',
    updated_at = now();

  insert into public.user_roles (
    user_id,
    role,
    organization,
    branch,
    office,
    team,
    display_name
  )
  select req.requester_user_id,
         'org_admin',
         created_root.name,
         null,
         null,
         null,
         coalesce(p.name, u.email, '')
  from auth.users u
  left join public.profiles p on p.user_id = u.id
  where u.id = req.requester_user_id
  on conflict (user_id)
  do update set
    role = excluded.role,
    organization = excluded.organization,
    branch = excluded.branch,
    office = excluded.office,
    team = excluded.team,
    display_name = excluded.display_name;

  update public.organization_registration_requests
     set status = 'approved',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejection_reason = null
   where id = req.id;

  return query
  select req.id, created_root.id, created_root.name, req.requester_user_id, 'org_admin'::text;
end;
$$;

grant execute on function public.approve_organization_registration_request(uuid) to authenticated;

create or replace function public.reject_organization_registration_request(
  p_request_id uuid,
  p_rejection_reason text default null
)
returns public.organization_registration_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_request public.organization_registration_requests;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not coalesce(public.current_profile_is_superadmin(), false) then
    raise exception 'SUPERADMIN_REQUIRED';
  end if;

  update public.organization_registration_requests
     set status = 'rejected',
         reviewed_by = auth.uid(),
         reviewed_at = now(),
         rejection_reason = nullif(trim(coalesce(p_rejection_reason, '')), '')
   where id = p_request_id
     and status = 'pending'
   returning * into updated_request;

  if updated_request.id is null then
    raise exception 'ORGANIZATION_REQUEST_NOT_FOUND';
  end if;

  return updated_request;
end;
$$;

grant execute on function public.reject_organization_registration_request(uuid, text) to authenticated;

create or replace function public.create_organization_unit(
  p_parent_id uuid,
  p_name text,
  p_display_type text default null
)
returns public.organization_units
language plpgsql
security definer
set search_path = public
as $$
declare
  created_unit public.organization_units;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'ORG_UNIT_NAME_REQUIRED';
  end if;

  if p_parent_id is null then
    if not coalesce(public.current_profile_is_superadmin(), false) then
      raise exception 'SUPERADMIN_REQUIRED_FOR_ROOT_ORG';
    end if;
  elsif not public.current_user_can_manage_org_unit(p_parent_id) then
    raise exception 'ORG_UNIT_MANAGE_REQUIRED';
  end if;

  insert into public.organization_units (
    parent_id,
    name,
    display_type,
    created_by,
    normalized_name
  )
  values (
    p_parent_id,
    trim(p_name),
    nullif(trim(coalesce(p_display_type, '')), ''),
    auth.uid(),
    public.normalize_organization_unit_name(p_name)
  )
  returning * into created_unit;

  return created_unit;
end;
$$;

grant execute on function public.create_organization_unit(uuid, text, text) to authenticated;

create or replace function public.approve_role_request(p_request_id uuid)
returns table (
  request_id uuid,
  user_id uuid,
  org_unit_id uuid,
  branch_id uuid,
  membership_role text,
  request_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.role_requests;
  root_unit public.organization_units;
  selected_unit public.organization_units;
  target_org_unit_id uuid;
  target_branch_id uuid;
  current_parent_id uuid;
  normalized_root text;
  legacy record;
  profile_display_name text;
  clean_role text;
  mapped_membership_role text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not coalesce(public.current_profile_is_admin(), false) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  select *
    into req
  from public.role_requests
  where id = p_request_id
  for update;

  if req.id is null then
    raise exception 'ROLE_REQUEST_NOT_FOUND';
  end if;

  clean_role := lower(trim(coalesce(req.requested_role, 'team_member')));
  mapped_membership_role := public.role_to_membership_role(clean_role);

  if req.company_org_unit_id is not null then
    select *
      into root_unit
    from public.organization_units
    where id = req.company_org_unit_id
      and parent_id is null
      and is_active = true;
  end if;

  if root_unit.id is null then
    select *
      into root_unit
    from public.organization_units
    where parent_id is null
      and is_active = true
      and normalized_name in (
        public.normalize_organization_unit_name(req.company_name),
        public.normalize_organization_unit_name(req.organization)
      )
    order by created_at asc
    limit 1;
  end if;

  if root_unit.id is null then
    raise exception 'COMPANY_ROOT_REQUIRED';
  end if;

  normalized_root := root_unit.normalized_name;

  if req.requested_org_unit_id is not null then
    select *
      into selected_unit
    from public.organization_units
    where id = req.requested_org_unit_id
      and is_active = true
      and root_unit.id = any(path);

    if selected_unit.id is null then
      raise exception 'TARGET_ORG_UNIT_NOT_FOUND';
    end if;

    target_org_unit_id := selected_unit.id;
  else
    current_parent_id := root_unit.id;
    target_org_unit_id := root_unit.id;

    if nullif(trim(coalesce(req.organization, '')), '') is not null
       and public.normalize_organization_unit_name(req.organization) <> normalized_root then
      target_org_unit_id := public.internal_get_or_create_org_unit(
        current_parent_id,
        req.organization,
        '조직',
        auth.uid()
      );
      current_parent_id := target_org_unit_id;
    end if;

    if nullif(trim(coalesce(req.branch, '')), '') is not null
       and not (
         public.normalize_organization_unit_name(req.branch) = any(
           array_remove(array[
             public.normalize_organization_unit_name(req.organization),
             normalized_root
           ], '')
         )
       ) then
      target_org_unit_id := public.internal_get_or_create_org_unit(
        current_parent_id,
        req.branch,
        '상위 조직',
        auth.uid()
      );
      current_parent_id := target_org_unit_id;
    end if;

    if nullif(trim(coalesce(req.office, '')), '') is not null
       and not (
         public.normalize_organization_unit_name(req.office) = any(
           array_remove(array[
             public.normalize_organization_unit_name(req.branch),
             public.normalize_organization_unit_name(req.organization),
             normalized_root
           ], '')
         )
       ) then
      target_org_unit_id := public.internal_get_or_create_org_unit(
        current_parent_id,
        req.office,
        '지점',
        auth.uid()
      );
      current_parent_id := target_org_unit_id;
    end if;

    if clean_role in ('team_leader', 'team_member', 'member', 'agent', 'staff')
       and nullif(trim(coalesce(req.team, '')), '') is not null
       and not (
         public.normalize_organization_unit_name(req.team) = any(
           array_remove(array[
             public.normalize_organization_unit_name(req.office),
             public.normalize_organization_unit_name(req.branch),
             public.normalize_organization_unit_name(req.organization),
             normalized_root
           ], '')
         )
       ) then
      target_org_unit_id := public.internal_get_or_create_org_unit(
        current_parent_id,
        req.team,
        '팀',
        auth.uid()
      );
    end if;
  end if;

  target_branch_id := public.ensure_legacy_branch_for_org_unit(
    target_org_unit_id,
    root_unit.name,
    req.user_id
  );

  select *
    into legacy
  from public.organization_unit_legacy_fields(target_org_unit_id);

  profile_display_name := coalesce(nullif(trim(req.user_name), ''), req.user_email, '');

  insert into public.organization_memberships (user_id, org_unit_id, role, status)
  values (req.user_id, target_org_unit_id, mapped_membership_role, 'active')
  on conflict on constraint organization_memberships_user_org_unique
  do update set
    role = excluded.role,
    status = 'active',
    updated_at = now();

  insert into public.user_roles (
    user_id,
    role,
    organization,
    branch,
    office,
    team,
    display_name
  )
  values (
    req.user_id,
    clean_role,
    coalesce(legacy.organization, root_unit.name),
    legacy.branch,
    legacy.office,
    legacy.team,
    profile_display_name
  )
  on conflict (user_id)
  do update set
    role = excluded.role,
    organization = excluded.organization,
    branch = excluded.branch,
    office = excluded.office,
    team = excluded.team,
    display_name = excluded.display_name;

  insert into public.profiles (
    user_id,
    name,
    role,
    role_name,
    parent_user_id,
    branch_id,
    status
  )
  values (
    req.user_id,
    profile_display_name,
    public.role_to_profile_role(clean_role),
    public.role_to_korean_label(clean_role),
    null,
    target_branch_id,
    '상담중'
  )
  on conflict (user_id)
  do update set
    name = coalesce(nullif(public.profiles.name, ''), excluded.name),
    role = case
      when public.profiles.role in ('admin', 'superadmin') then public.profiles.role
      else excluded.role
    end,
    role_name = excluded.role_name,
    parent_user_id = excluded.parent_user_id,
    branch_id = excluded.branch_id,
    status = coalesce(public.profiles.status, excluded.status),
    updated_at = now();

  update public.role_requests
     set status = 'approved',
         processed_at = now()
   where id = req.id;

  return query
  select req.id, req.user_id, target_org_unit_id, target_branch_id, mapped_membership_role, 'approved'::text;
end;
$$;

grant execute on function public.approve_role_request(uuid) to authenticated;

drop policy if exists "organization_units_admin_insert" on public.organization_units;
drop policy if exists "organization_units_scoped_insert" on public.organization_units;
create policy "organization_units_scoped_insert"
  on public.organization_units
  for insert
  to authenticated
  with check (
    (
      parent_id is null
      and coalesce(public.current_profile_is_superadmin(), false)
    )
    or (
      parent_id is not null
      and public.current_user_can_manage_org_unit(parent_id)
    )
  );

drop policy if exists "organization_memberships_admin_manage" on public.organization_memberships;
drop policy if exists "organization_memberships_scoped_manage" on public.organization_memberships;
create policy "organization_memberships_scoped_manage"
  on public.organization_memberships
  for all
  to authenticated
  using (
    coalesce(public.current_profile_is_superadmin(), false)
    or public.current_user_can_manage_org_unit(org_unit_id)
  )
  with check (
    coalesce(public.current_profile_is_superadmin(), false)
    or public.current_user_can_manage_org_unit(org_unit_id)
  );

alter table public.organization_registration_requests enable row level security;

drop policy if exists "organization_registration_requests_select_scope" on public.organization_registration_requests;
create policy "organization_registration_requests_select_scope"
  on public.organization_registration_requests
  for select
  to authenticated
  using (
    requester_user_id = auth.uid()
    or coalesce(public.current_profile_is_superadmin(), false)
  );

drop policy if exists "organization_registration_requests_insert_self" on public.organization_registration_requests;
create policy "organization_registration_requests_insert_self"
  on public.organization_registration_requests
  for insert
  to authenticated
  with check (requester_user_id = auth.uid());

drop policy if exists "organization_registration_requests_superadmin_update" on public.organization_registration_requests;
create policy "organization_registration_requests_superadmin_update"
  on public.organization_registration_requests
  for update
  to authenticated
  using (coalesce(public.current_profile_is_superadmin(), false))
  with check (coalesce(public.current_profile_is_superadmin(), false));

drop policy if exists "organization_registration_requests_superadmin_delete" on public.organization_registration_requests;
create policy "organization_registration_requests_superadmin_delete"
  on public.organization_registration_requests
  for delete
  to authenticated
  using (coalesce(public.current_profile_is_superadmin(), false));

commit;
