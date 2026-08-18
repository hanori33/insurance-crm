-- Invite-code based organization tree.
-- Additive only: keeps existing profiles/user_roles/branches compatibility tables intact.

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.organization_units (
  id uuid primary key default extensions.gen_random_uuid(),
  parent_id uuid references public.organization_units(id) on delete restrict,
  name text not null,
  display_type text,
  path uuid[] not null default '{}'::uuid[],
  depth integer not null default 0,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_units_name_not_blank check (length(trim(name)) > 0),
  constraint organization_units_not_self_parent check (parent_id is null or parent_id <> id)
);

create index if not exists organization_units_parent_id_idx
  on public.organization_units(parent_id);

create index if not exists organization_units_path_gin_idx
  on public.organization_units using gin(path);

create table if not exists public.organization_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_unit_id uuid not null references public.organization_units(id) on delete restrict,
  role text not null default 'team_member',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_memberships_role_not_blank check (length(trim(role)) > 0),
  constraint organization_memberships_status_allowed check (status in ('active', 'pending', 'inactive')),
  constraint organization_memberships_user_org_unique unique (user_id, org_unit_id)
);

create index if not exists organization_memberships_user_id_idx
  on public.organization_memberships(user_id);

create index if not exists organization_memberships_org_unit_id_idx
  on public.organization_memberships(org_unit_id);

create table if not exists public.invite_codes (
  id uuid primary key default extensions.gen_random_uuid(),
  code_hash text not null unique,
  org_unit_id uuid not null references public.organization_units(id) on delete restrict,
  target_role text not null default 'team_member',
  created_by uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz,
  max_uses integer,
  used_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invite_codes_target_role_not_blank check (length(trim(target_role)) > 0),
  constraint invite_codes_max_uses_positive check (max_uses is null or max_uses > 0),
  constraint invite_codes_used_count_nonnegative check (used_count >= 0)
);

create index if not exists invite_codes_org_unit_id_idx
  on public.invite_codes(org_unit_id);

create index if not exists invite_codes_created_by_idx
  on public.invite_codes(created_by);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_organization_units_updated_at on public.organization_units;
create trigger touch_organization_units_updated_at
  before update on public.organization_units
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_organization_memberships_updated_at on public.organization_memberships;
create trigger touch_organization_memberships_updated_at
  before update on public.organization_memberships
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_invite_codes_updated_at on public.invite_codes;
create trigger touch_invite_codes_updated_at
  before update on public.invite_codes
  for each row execute function public.touch_updated_at();

create or replace function public.set_organization_unit_path()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  parent_path uuid[];
  parent_depth integer;
begin
  if new.id is null then
    new.id := extensions.gen_random_uuid();
  end if;

  if new.parent_id is null then
    new.path := array[new.id];
    new.depth := 0;
    return new;
  end if;

  select ou.path, ou.depth
    into parent_path, parent_depth
  from public.organization_units ou
  where ou.id = new.parent_id;

  if parent_path is null then
    raise exception 'PARENT_ORG_UNIT_NOT_FOUND';
  end if;

  if new.id = any(parent_path) then
    raise exception 'ORG_UNIT_CYCLE_NOT_ALLOWED';
  end if;

  new.path := parent_path || new.id;
  new.depth := parent_depth + 1;
  return new;
end;
$$;

drop trigger if exists set_organization_unit_path_before_write on public.organization_units;
create trigger set_organization_unit_path_before_write
  before insert or update of parent_id on public.organization_units
  for each row execute function public.set_organization_unit_path();

create or replace function public.rebuild_organization_unit_paths(p_root_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  with recursive tree as (
    select id, parent_id, path, depth
    from public.organization_units
    where id = p_root_id

    union all

    select child.id,
           child.parent_id,
           tree.path || child.id,
           tree.depth + 1
    from public.organization_units child
    join tree on child.parent_id = tree.id
    where not child.id = any(tree.path)
  )
  update public.organization_units ou
     set path = tree.path,
         depth = tree.depth,
         updated_at = now()
    from tree
   where ou.id = tree.id
     and (ou.path is distinct from tree.path or ou.depth is distinct from tree.depth);
$$;

create or replace function public.rebuild_organization_unit_descendant_paths()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  perform public.rebuild_organization_unit_paths(new.id);
  return new;
end;
$$;

drop trigger if exists rebuild_organization_unit_descendant_paths_after_move on public.organization_units;
create trigger rebuild_organization_unit_descendant_paths_after_move
  after update of parent_id on public.organization_units
  for each row execute function public.rebuild_organization_unit_descendant_paths();

create or replace function public.user_can_manage_org_unit(p_user_id uuid, p_org_unit_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    coalesce(public.current_profile_is_admin(), false)
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

create or replace function public.current_user_can_manage_org_unit(p_org_unit_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.user_can_manage_org_unit(auth.uid(), p_org_unit_id);
$$;

create or replace function public.user_can_view_org_unit(p_user_id uuid, p_org_unit_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    public.user_can_manage_org_unit(p_user_id, p_org_unit_id)
    or exists (
      select 1
      from public.organization_memberships membership
      join public.organization_units visible_unit
        on visible_unit.id = p_org_unit_id
      join public.organization_units member_unit
        on member_unit.id = membership.org_unit_id
      where membership.user_id = p_user_id
        and membership.status = 'active'
        and (
          p_org_unit_id = any(member_unit.path)
          or membership.org_unit_id = any(visible_unit.path)
        )
    );
$$;

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
    select unit.id, unit.name, unit.depth, ordinality
    from public.organization_units target
    cross join lateral unnest(target.path) with ordinality as path_unit(id, ordinality)
    join public.organization_units unit on unit.id = path_unit.id
    where target.id = p_org_unit_id
    order by path_unit.ordinality
  ),
  names as (
    select array_agg(name order by ordinality) as path_names
    from ordered_units
  )
  select
    path_names[1],
    case when array_length(path_names, 1) >= 2 then path_names[2] else null end,
    case
      when array_length(path_names, 1) >= 3 then path_names[array_length(path_names, 1) - 1]
      when array_length(path_names, 1) >= 2 then path_names[2]
      else null
    end,
    path_names[array_length(path_names, 1)]
  from names;
$$;

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
    if not coalesce(public.current_profile_is_admin(), false) then
      raise exception 'ADMIN_REQUIRED_FOR_ROOT_ORG';
    end if;
  elsif not public.current_user_can_manage_org_unit(p_parent_id) then
    raise exception 'ORG_UNIT_MANAGE_REQUIRED';
  end if;

  insert into public.organization_units (parent_id, name, display_type, created_by)
  values (p_parent_id, trim(p_name), nullif(trim(coalesce(p_display_type, '')), ''), auth.uid())
  returning * into created_unit;

  return created_unit;
end;
$$;

create or replace function public.update_organization_unit(
  p_org_unit_id uuid,
  p_name text default null,
  p_display_type text default null,
  p_is_active boolean default null
)
returns public.organization_units
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_unit public.organization_units;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.current_user_can_manage_org_unit(p_org_unit_id) then
    raise exception 'ORG_UNIT_MANAGE_REQUIRED';
  end if;

  update public.organization_units
     set name = case
           when p_name is null then name
           when length(trim(p_name)) = 0 then name
           else trim(p_name)
         end,
         display_type = case
           when p_display_type is null then display_type
           else nullif(trim(p_display_type), '')
         end,
         is_active = coalesce(p_is_active, is_active)
   where id = p_org_unit_id
   returning * into updated_unit;

  if updated_unit.id is null then
    raise exception 'ORG_UNIT_NOT_FOUND';
  end if;

  return updated_unit;
end;
$$;

create or replace function public.move_organization_unit(
  p_org_unit_id uuid,
  p_new_parent_id uuid
)
returns public.organization_units
language plpgsql
security definer
set search_path = public
as $$
declare
  moved_unit public.organization_units;
  new_parent_path uuid[];
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_org_unit_id = p_new_parent_id then
    raise exception 'ORG_UNIT_CYCLE_NOT_ALLOWED';
  end if;

  if not public.current_user_can_manage_org_unit(p_org_unit_id) then
    raise exception 'ORG_UNIT_MANAGE_REQUIRED';
  end if;

  if p_new_parent_id is not null then
    if not public.current_user_can_manage_org_unit(p_new_parent_id) then
      raise exception 'TARGET_ORG_UNIT_MANAGE_REQUIRED';
    end if;

    select path into new_parent_path
    from public.organization_units
    where id = p_new_parent_id;

    if new_parent_path is null then
      raise exception 'PARENT_ORG_UNIT_NOT_FOUND';
    end if;

    if p_org_unit_id = any(new_parent_path) then
      raise exception 'ORG_UNIT_CYCLE_NOT_ALLOWED';
    end if;
  end if;

  update public.organization_units
     set parent_id = p_new_parent_id
   where id = p_org_unit_id
   returning * into moved_unit;

  if moved_unit.id is null then
    raise exception 'ORG_UNIT_NOT_FOUND';
  end if;

  perform public.rebuild_organization_unit_paths(p_org_unit_id);

  select * into moved_unit
  from public.organization_units
  where id = p_org_unit_id;

  return moved_unit;
end;
$$;

create or replace function public.create_invite_code(
  p_org_unit_id uuid,
  p_target_role text default 'team_member',
  p_expires_at timestamptz default (now() + interval '14 days'),
  p_max_uses integer default null
)
returns table (
  invite_id uuid,
  code text,
  org_unit_id uuid,
  target_role text,
  expires_at timestamptz,
  max_uses integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_code text;
  normalized_role text;
  new_invite_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.current_user_can_manage_org_unit(p_org_unit_id) then
    raise exception 'ORG_UNIT_MANAGE_REQUIRED';
  end if;

  normalized_role := lower(trim(coalesce(p_target_role, 'team_member')));

  if normalized_role not in ('team_member', 'member', 'agent', 'staff') then
    raise exception 'MANAGER_ROLE_REQUIRES_APPROVAL';
  end if;

  if p_max_uses is not null and p_max_uses <= 0 then
    raise exception 'MAX_USES_MUST_BE_POSITIVE';
  end if;

  raw_code := upper(
    substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4) || '-' ||
    substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4) || '-' ||
    substr(encode(extensions.gen_random_bytes(4), 'hex'), 1, 4)
  );

  insert into public.invite_codes (
    code_hash,
    org_unit_id,
    target_role,
    created_by,
    expires_at,
    max_uses
  )
  values (
    encode(extensions.digest(raw_code, 'sha256'), 'hex'),
    p_org_unit_id,
    normalized_role,
    auth.uid(),
    p_expires_at,
    p_max_uses
  )
  returning id into new_invite_id;

  return query
  select new_invite_id, raw_code, p_org_unit_id, normalized_role, p_expires_at, p_max_uses;
end;
$$;

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
  on conflict (user_id, org_unit_id)
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

  select * into legacy_record
  from public.organization_unit_legacy_fields(invite_row.org_unit_id);

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
    '상담중'
  )
  on conflict (user_id)
  do update set
    name = coalesce(public.profiles.name, excluded.name),
    role = case
      when public.profiles.role in ('admin', 'superadmin') then public.profiles.role
      else excluded.role
    end,
    role_name = excluded.role_name,
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

alter table public.organization_units enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.invite_codes enable row level security;

drop policy if exists "organization_units_select_visible_scope" on public.organization_units;
create policy "organization_units_select_visible_scope"
  on public.organization_units
  for select
  to authenticated
  using (public.user_can_view_org_unit(auth.uid(), id));

drop policy if exists "organization_units_admin_insert" on public.organization_units;
create policy "organization_units_admin_insert"
  on public.organization_units
  for insert
  to authenticated
  with check (coalesce(public.current_profile_is_admin(), false));

drop policy if exists "organization_units_manager_update" on public.organization_units;
create policy "organization_units_manager_update"
  on public.organization_units
  for update
  to authenticated
  using (public.current_user_can_manage_org_unit(id))
  with check (public.current_user_can_manage_org_unit(id));

drop policy if exists "organization_memberships_select_self_or_manager" on public.organization_memberships;
create policy "organization_memberships_select_self_or_manager"
  on public.organization_memberships
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.current_user_can_manage_org_unit(org_unit_id)
  );

drop policy if exists "organization_memberships_admin_manage" on public.organization_memberships;
create policy "organization_memberships_admin_manage"
  on public.organization_memberships
  for all
  to authenticated
  using (coalesce(public.current_profile_is_admin(), false))
  with check (coalesce(public.current_profile_is_admin(), false));

drop policy if exists "invite_codes_select_creator_or_manager" on public.invite_codes;
create policy "invite_codes_select_creator_or_manager"
  on public.invite_codes
  for select
  to authenticated
  using (
    created_by = auth.uid()
    or public.current_user_can_manage_org_unit(org_unit_id)
  );

drop policy if exists "invite_codes_manager_update" on public.invite_codes;
create policy "invite_codes_manager_update"
  on public.invite_codes
  for update
  to authenticated
  using (public.current_user_can_manage_org_unit(org_unit_id))
  with check (public.current_user_can_manage_org_unit(org_unit_id));

comment on table public.organization_units is
  'Flexible parent-child organization tree. Names/types are display metadata only.';
comment on table public.organization_memberships is
  'User memberships tied to organization_unit IDs rather than fixed hierarchy names.';
comment on table public.invite_codes is
  'Invite codes store SHA-256 hashes only. Raw invite code is returned once by create_invite_code.';
