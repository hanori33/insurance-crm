begin;

-- Move organization writes toward organization_units/organization_memberships
-- while keeping branches/profiles/user_roles as a compatibility layer.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.normalize_organization_unit_name(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select lower(regexp_replace(trim(coalesce(p_value, '')), '\s+', '', 'g'));
$$;

alter table public.organization_units
  add column if not exists normalized_name text;

update public.organization_units
   set normalized_name = public.normalize_organization_unit_name(name)
 where normalized_name is null
    or normalized_name <> public.normalize_organization_unit_name(name);

create or replace function public.set_organization_unit_normalized_name()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.normalized_name := public.normalize_organization_unit_name(new.name);
  return new;
end;
$$;

drop trigger if exists set_organization_unit_normalized_name_before_write on public.organization_units;
create trigger set_organization_unit_normalized_name_before_write
  before insert or update of name on public.organization_units
  for each row execute function public.set_organization_unit_normalized_name();

create index if not exists organization_units_parent_normalized_name_idx
  on public.organization_units(parent_id, normalized_name);

create index if not exists organization_units_root_normalized_name_idx
  on public.organization_units(normalized_name)
  where parent_id is null;

create or replace function public.role_to_membership_role(p_role text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case lower(trim(coalesce(p_role, 'team_member')))
    when 'team_member' then 'team_member'
    when 'member' then 'team_member'
    when 'agent' then 'team_member'
    when 'staff' then 'team_member'
    when 'team_leader' then 'team_leader'
    else 'manager'
  end;
$$;

create or replace function public.role_to_profile_role(p_role text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case lower(trim(coalesce(p_role, 'team_member')))
    when 'team_member' then 'staff'
    when 'member' then 'staff'
    when 'agent' then 'staff'
    when 'staff' then 'staff'
    else 'manager'
  end;
$$;

create or replace function public.role_to_korean_label(p_role text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select case lower(trim(coalesce(p_role, 'team_member')))
    when 'division_head' then '사업단장'
    when 'branch_head' then '본부장'
    when 'deputy_branch_head' then '부본부장'
    when 'office_head' then '지점장'
    when 'deputy_office_head' then '부지점장'
    when 'team_leader' then '팀장'
    when 'team_member' then '팀원'
    when 'member' then '팀원'
    when 'agent' then '팀원'
    when 'staff' then '팀원'
    else trim(coalesce(p_role, '팀원'))
  end;
$$;

create or replace function public.internal_get_or_create_org_unit(
  p_parent_id uuid,
  p_name text,
  p_display_type text default null,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text;
  clean_type text;
  normalized text;
  found_id uuid;
begin
  clean_name := trim(coalesce(p_name, ''));
  clean_type := nullif(trim(coalesce(p_display_type, '')), '');
  normalized := public.normalize_organization_unit_name(clean_name);

  if normalized = '' then
    raise exception 'ORG_UNIT_NAME_REQUIRED';
  end if;

  select id
    into found_id
  from public.organization_units
  where parent_id is not distinct from p_parent_id
    and normalized_name = normalized
    and is_active = true
  order by created_at asc
  limit 1;

  if found_id is not null then
    return found_id;
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
    clean_name,
    clean_type,
    p_created_by,
    normalized
  )
  returning id into found_id;

  return found_id;
end;
$$;

revoke all on function public.internal_get_or_create_org_unit(uuid, text, text, uuid)
  from public, anon, authenticated;

create or replace function public.ensure_legacy_branch_for_org_unit(
  p_org_unit_id uuid,
  p_division_name text default null,
  p_owner_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  unit_row public.organization_units;
  legacy record;
  clean_name text;
  clean_division text;
  found_branch_id uuid;
begin
  select *
    into unit_row
  from public.organization_units
  where id = p_org_unit_id;

  if unit_row.id is null then
    raise exception 'ORG_UNIT_NOT_FOUND';
  end if;

  if unit_row.legacy_branch_id is not null then
    return unit_row.legacy_branch_id;
  end if;

  select *
    into legacy
  from public.organization_unit_legacy_fields(p_org_unit_id);

  clean_name := coalesce(nullif(trim(legacy.office), ''), nullif(trim(legacy.team), ''), unit_row.name);
  clean_division := coalesce(
    nullif(trim(p_division_name), ''),
    nullif(trim(legacy.organization), ''),
    '기존 조직'
  );

  select id
    into found_branch_id
  from public.branches
  where public.normalize_organization_unit_name(name) = public.normalize_organization_unit_name(clean_name)
    and public.normalize_organization_unit_name(division) = public.normalize_organization_unit_name(clean_division)
  order by created_at asc nulls last
  limit 1;

  if found_branch_id is null then
    insert into public.branches (name, division, owner_id)
    values (clean_name, clean_division, p_owner_id)
    returning id into found_branch_id;
  end if;

  update public.organization_units
     set legacy_branch_id = found_branch_id
   where id = p_org_unit_id
     and legacy_branch_id is null;

  return found_branch_id;
end;
$$;

revoke all on function public.ensure_legacy_branch_for_org_unit(uuid, text, uuid)
  from public, anon, authenticated;

create or replace function public.organization_unit_legacy_fields(p_org_unit_id uuid)
returns table (
  organization text,
  branch text,
  office text,
  team text
)
language sql
security definer
stable
set search_path = public
as $$
  with ordered_units as (
    select unit.id,
           unit.name,
           unit.display_type,
           path_order.ordinality
    from public.organization_units target
    cross join lateral unnest(target.path) with ordinality as path_order(id, ordinality)
    join public.organization_units unit on unit.id = path_order.id
    where target.id = p_org_unit_id
    order by path_order.ordinality
  ),
  names as (
    select array_agg(name order by ordinality) as path_names,
           array_agg(coalesce(display_type, '') order by ordinality) as path_types
    from ordered_units
  )
  select
    path_names[1] as organization,
    case
      when array_length(path_names, 1) >= 3 then path_names[2]
      when array_length(path_names, 1) = 2 then null
      else null
    end as branch,
    coalesce(
      (
        select ou.name
        from ordered_units ou
        where public.normalize_organization_unit_name(coalesce(ou.display_type, '')) like '%지점%'
           or public.normalize_organization_unit_name(coalesce(ou.display_type, '')) like '%지사%'
           or public.normalize_organization_unit_name(coalesce(ou.display_type, '')) like '%센터%'
        order by ou.ordinality desc
        limit 1
      ),
      case
        when array_length(path_names, 1) >= 2 then path_names[array_length(path_names, 1)]
        else null
      end
    ) as office,
    (
      select ou.name
      from ordered_units ou
      where public.normalize_organization_unit_name(coalesce(ou.display_type, '')) like '%팀%'
         or right(public.normalize_organization_unit_name(ou.name), 1) = '팀'
      order by ou.ordinality desc
      limit 1
    ) as team
  from names;
$$;

create or replace function public.resolve_role_request_org_unit(
  p_company_name text,
  p_organization text,
  p_branch text,
  p_office text,
  p_team text,
  p_requested_role text,
  p_created_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_company text := nullif(trim(coalesce(p_company_name, '')), '');
  clean_org text := nullif(trim(coalesce(p_organization, '')), '');
  clean_branch text := nullif(trim(coalesce(p_branch, '')), '');
  clean_office text := nullif(trim(coalesce(p_office, '')), '');
  clean_team text := nullif(trim(coalesce(p_team, '')), '');
  normalized_company text;
  current_parent uuid := null;
  current_unit uuid := null;
  requested_role text := lower(trim(coalesce(p_requested_role, 'team_member')));
begin
  if clean_company is null and clean_org is null and clean_branch is null and clean_office is null and clean_team is null then
    raise exception 'ORG_UNIT_NAME_REQUIRED';
  end if;

  normalized_company := public.normalize_organization_unit_name(clean_company);

  if clean_company is not null then
    current_unit := public.internal_get_or_create_org_unit(null, clean_company, '회사/GA', p_created_by);
    current_parent := current_unit;
  end if;

  if clean_org is not null and (
    current_parent is null
    or public.normalize_organization_unit_name(clean_org) <> normalized_company
  ) then
    current_unit := public.internal_get_or_create_org_unit(current_parent, clean_org, '조직', p_created_by);
    current_parent := current_unit;
  elsif current_parent is null and clean_org is not null then
    current_unit := public.internal_get_or_create_org_unit(null, clean_org, '조직', p_created_by);
    current_parent := current_unit;
  end if;

  if clean_branch is not null and not (
    public.normalize_organization_unit_name(clean_branch) = any(
      array_remove(array[
        public.normalize_organization_unit_name(clean_org),
        public.normalize_organization_unit_name(clean_company)
      ], '')
    )
  ) then
    current_unit := public.internal_get_or_create_org_unit(current_parent, clean_branch, '본부/상위조직', p_created_by);
    current_parent := current_unit;
  end if;

  if clean_office is not null and not (
    public.normalize_organization_unit_name(clean_office) = any(
      array_remove(array[
        public.normalize_organization_unit_name(clean_branch),
        public.normalize_organization_unit_name(clean_org),
        public.normalize_organization_unit_name(clean_company)
      ], '')
    )
  ) then
    current_unit := public.internal_get_or_create_org_unit(current_parent, clean_office, '지점', p_created_by);
    current_parent := current_unit;
  end if;

  if requested_role in ('team_leader', 'team_member', 'member', 'agent', 'staff')
     and clean_team is not null
     and not (
       public.normalize_organization_unit_name(clean_team) = any(
         array_remove(array[
           public.normalize_organization_unit_name(clean_office),
           public.normalize_organization_unit_name(clean_branch),
           public.normalize_organization_unit_name(clean_org),
           public.normalize_organization_unit_name(clean_company)
         ], '')
       )
     ) then
    current_unit := public.internal_get_or_create_org_unit(current_parent, clean_team, '팀', p_created_by);
  end if;

  if current_unit is null then
    raise exception 'ORG_UNIT_NAME_REQUIRED';
  end if;

  return current_unit;
end;
$$;

revoke all on function public.resolve_role_request_org_unit(text, text, text, text, text, text, uuid)
  from public, anon, authenticated;

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
  target_org_unit_id uuid;
  target_branch_id uuid;
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

  target_org_unit_id := public.resolve_role_request_org_unit(
    req.company_name,
    req.organization,
    req.branch,
    req.office,
    req.team,
    clean_role,
    auth.uid()
  );

  target_branch_id := public.ensure_legacy_branch_for_org_unit(
    target_org_unit_id,
    coalesce(nullif(trim(req.organization), ''), nullif(trim(req.company_name), '')),
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
    coalesce(legacy.organization, req.organization, req.company_name),
    coalesce(legacy.branch, req.branch),
    coalesce(legacy.office, req.office, req.branch),
    case
      when clean_role in ('team_leader', 'team_member', 'member', 'agent', 'staff') then coalesce(legacy.team, req.team)
      else coalesce(legacy.team, req.team)
    end,
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

create or replace function public.accept_invite_code(p_code text)
returns table (
  membership_id uuid,
  org_unit_id uuid,
  org_unit_name text,
  role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_code text;
  invite_row public.invite_codes;
  upserted_membership_id uuid;
  legacy_record record;
  profile_display_name text;
  already_active boolean;
  legacy_branch_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  normalized_code := upper(trim(coalesce(p_code, '')));

  if length(normalized_code) = 0 then
    raise exception 'INVITE_CODE_REQUIRED';
  end if;

  select *
    into invite_row
  from public.invite_codes
  where code_hash = encode(extensions.digest(normalized_code, 'sha256'), 'hex')
    and active = true
  for update;

  if invite_row.id is null then
    raise exception 'INVITE_CODE_NOT_FOUND';
  end if;

  if invite_row.expires_at is not null and invite_row.expires_at < now() then
    raise exception 'INVITE_CODE_EXPIRED';
  end if;

  if invite_row.max_uses is not null and invite_row.used_count >= invite_row.max_uses then
    raise exception 'INVITE_CODE_MAX_USES_REACHED';
  end if;

  if not exists (
    select 1
    from public.organization_units ou
    where ou.id = invite_row.org_unit_id
      and ou.is_active = true
  ) then
    raise exception 'ORG_UNIT_INACTIVE';
  end if;

  select exists (
    select 1
    from public.organization_memberships membership
    where membership.user_id = auth.uid()
      and membership.org_unit_id = invite_row.org_unit_id
      and membership.status = 'active'
  ) into already_active;

  insert into public.organization_memberships (user_id, org_unit_id, role, status)
  values (auth.uid(), invite_row.org_unit_id, invite_row.target_role, 'active')
  on conflict on constraint organization_memberships_user_org_unique
  do update set
    role = excluded.role,
    status = 'active',
    updated_at = now()
  returning id into upserted_membership_id;

  if not already_active then
    update public.invite_codes
       set used_count = used_count + 1,
           updated_at = now()
     where id = invite_row.id;
  end if;

  select *
    into legacy_record
  from public.organization_unit_legacy_fields(invite_row.org_unit_id);

  legacy_branch_id := public.ensure_legacy_branch_for_org_unit(
    invite_row.org_unit_id,
    legacy_record.organization,
    auth.uid()
  );

  select coalesce(
      nullif(raw_user_meta_data ->> 'display_name', ''),
      nullif(raw_user_meta_data ->> 'name', ''),
      email
    )
    into profile_display_name
  from auth.users
  where id = auth.uid();

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
    auth.uid(),
    invite_row.target_role,
    legacy_record.organization,
    legacy_record.branch,
    legacy_record.office,
    legacy_record.team,
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
    branch_id,
    status
  )
  values (
    auth.uid(),
    profile_display_name,
    'staff',
    case
      when invite_row.target_role in ('team_member', 'member', 'agent', 'staff') then '팀원'
      else invite_row.target_role
    end,
    legacy_branch_id,
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
    branch_id = excluded.branch_id,
    updated_at = now();

  return query
  select
    upserted_membership_id,
    ou.id,
    ou.name,
    invite_row.target_role
  from public.organization_units ou
  where ou.id = invite_row.org_unit_id;
end;
$$;

grant execute on function public.accept_invite_code(text) to authenticated;

-- Known data correction: 김단비 is intended to manage an independent branch.
do $$
declare
  canonical_root_id uuid;
  duplicate_root_id uuid;
  kim_user_id uuid := '854766fc-5d7a-40e9-b007-aa5415ba8cf7'::uuid;
  kim_branch_id uuid;
  kim_org_unit_id uuid;
  royal_branch_unit_id uuid;
  child record;
begin
  select id
    into canonical_root_id
  from public.organization_units
  where parent_id is null
    and public.normalize_organization_unit_name(name) = public.normalize_organization_unit_name('인카다이렉트 로얄사업단')
  order by case when name = '인카다이렉트 로얄사업단' then 0 else 1 end, created_at asc
  limit 1;

  if canonical_root_id is not null then
    select id
      into duplicate_root_id
    from public.organization_units
    where parent_id is null
      and id <> canonical_root_id
      and public.normalize_organization_unit_name(name) = public.normalize_organization_unit_name('인카다이렉트로얄사업단')
    order by created_at asc
    limit 1;

    if not exists (
      select 1
      from public.branches
      where public.normalize_organization_unit_name(name) = public.normalize_organization_unit_name('김단비 지점')
        and public.normalize_organization_unit_name(division) = public.normalize_organization_unit_name('인카다이렉트 로얄사업단')
    ) then
      insert into public.branches (name, division, owner_id)
      values ('김단비 지점', '인카다이렉트 로얄사업단', kim_user_id)
      returning id into kim_branch_id;
    else
      select id
        into kim_branch_id
      from public.branches
      where public.normalize_organization_unit_name(name) = public.normalize_organization_unit_name('김단비 지점')
        and public.normalize_organization_unit_name(division) = public.normalize_organization_unit_name('인카다이렉트 로얄사업단')
      order by created_at asc nulls last
      limit 1;
    end if;

    kim_org_unit_id := public.internal_get_or_create_org_unit(
      canonical_root_id,
      '김단비 지점',
      '지점',
      kim_user_id
    );

    update public.organization_units
       set legacy_branch_id = kim_branch_id,
           is_active = true
     where id = kim_org_unit_id;

    insert into public.organization_memberships (user_id, org_unit_id, role, status)
    values (kim_user_id, kim_org_unit_id, 'manager', 'active')
    on conflict on constraint organization_memberships_user_org_unique
    do update set
      role = 'manager',
      status = 'active',
      updated_at = now();

    select id
      into royal_branch_unit_id
    from public.organization_units
    where public.normalize_organization_unit_name(name) = public.normalize_organization_unit_name('로얄지점')
    order by created_at asc
    limit 1;

    if royal_branch_unit_id is not null and royal_branch_unit_id <> kim_org_unit_id then
      update public.organization_memberships
         set status = 'inactive',
             updated_at = now()
       where user_id = kim_user_id
         and org_unit_id = royal_branch_unit_id;
    end if;

    update public.profiles
       set branch_id = kim_branch_id,
           role = case when role in ('admin', 'superadmin') then role else 'manager' end,
           role_name = '지점장',
           parent_user_id = null,
           updated_at = now()
     where user_id = kim_user_id;

    update public.user_roles
       set role = 'office_head',
           organization = '인카다이렉트 로얄사업단',
           branch = null,
           office = '김단비 지점',
           team = null,
           display_name = coalesce(nullif(display_name, ''), '김단비')
     where user_id = kim_user_id;

    if duplicate_root_id is not null then
      for child in
        select *
        from public.organization_units ou_child
        where ou_child.parent_id = duplicate_root_id
          and not exists (
            select 1
            from public.organization_units sibling
            where sibling.parent_id = canonical_root_id
              and sibling.normalized_name = ou_child.normalized_name
              and sibling.id <> ou_child.id
          )
      loop
        update public.organization_units
           set parent_id = canonical_root_id
         where id = child.id;
      end loop;

      perform public.rebuild_organization_unit_paths(canonical_root_id);
      perform public.rebuild_organization_unit_paths(duplicate_root_id);

      update public.organization_units
         set display_type = coalesce(display_type, '중복 후보')
       where id = duplicate_root_id
         and exists (
           select 1
           from public.organization_units child_after
           where child_after.parent_id = duplicate_root_id
         );

      update public.organization_units
         set is_active = false,
             display_type = '중복 루트 정리됨'
       where id = duplicate_root_id
         and not exists (
           select 1
           from public.organization_units child_after
           where child_after.parent_id = duplicate_root_id
         )
         and not exists (
           select 1
           from public.organization_memberships om
           where om.org_unit_id = duplicate_root_id
             and om.status = 'active'
         )
         and not exists (
           select 1
           from public.invite_codes ic
           where ic.org_unit_id = duplicate_root_id
             and ic.active = true
         );
    end if;
  end if;
end;
$$;

comment on column public.organization_units.normalized_name is
  'Whitespace-insensitive lowercase name used to prevent accidental duplicate organization units within the same parent.';

commit;
