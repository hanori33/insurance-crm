-- Support invite-code management UI.
-- This migration only adds compatibility metadata/functions and backfills new org tables
-- from existing branches/profiles without changing legacy tables.

alter table public.organization_units
  add column if not exists legacy_branch_id uuid references public.branches(id) on delete set null;

create unique index if not exists organization_units_legacy_branch_id_unique_idx
  on public.organization_units(legacy_branch_id)
  where legacy_branch_id is not null;

create index if not exists organization_units_legacy_branch_id_idx
  on public.organization_units(legacy_branch_id);

with legacy_roots as (
  select distinct
         coalesce(nullif(trim(division), ''), '기존 조직') as name,
         (array_agg(owner_id) filter (where owner_id is not null))[1] as created_by
  from public.branches
  group by coalesce(nullif(trim(division), ''), '기존 조직')
)
insert into public.organization_units (parent_id, name, display_type, created_by)
select null::uuid, legacy_roots.name, '기존 조직', legacy_roots.created_by
from legacy_roots
where not exists (
  select 1
  from public.organization_units ou
  where ou.parent_id is null
    and ou.name = legacy_roots.name
    and coalesce(ou.display_type, '') = '기존 조직'
);

insert into public.organization_units (
  parent_id,
  name,
  display_type,
  created_by,
  legacy_branch_id
)
select root.id,
       coalesce(nullif(trim(branches.name), ''), '기존 지점'),
       '기존 지점',
       branches.owner_id,
       branches.id
from public.branches
join public.organization_units root
  on root.parent_id is null
 and root.name = coalesce(nullif(trim(branches.division), ''), '기존 조직')
 and coalesce(root.display_type, '') = '기존 조직'
where not exists (
  select 1
  from public.organization_units existing
  where existing.legacy_branch_id = branches.id
);

insert into public.organization_memberships (
  user_id,
  org_unit_id,
  role,
  status
)
select profiles.user_id,
       ou.id,
       case
         when profiles.role in ('admin', 'superadmin') then 'org_admin'
         when profiles.role = 'manager' then 'manager'
         when user_roles.role in (
           'division_head',
           'branch_head',
           'deputy_branch_head',
           'office_head',
           'deputy_office_head'
         ) then 'manager'
         when user_roles.role = 'team_leader' then 'team_leader'
         else 'team_member'
       end,
       'active'
from public.profiles
join public.organization_units ou
  on ou.legacy_branch_id = profiles.branch_id
left join public.user_roles
  on user_roles.user_id = profiles.user_id
where profiles.user_id is not null
  and profiles.branch_id is not null
on conflict (user_id, org_unit_id) do nothing;

create or replace function public.list_managed_organization_units()
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
  with visible_units as (
    select ou.*
    from public.organization_units ou
    where ou.is_active = true
      and public.current_user_can_manage_org_unit(ou.id)
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
  order by visible_units.depth, visible_units.name;
$$;

create or replace function public.list_invite_codes(p_org_unit_id uuid default null)
returns table (
  id uuid,
  org_unit_id uuid,
  org_unit_name text,
  org_path_names text[],
  target_role text,
  created_at timestamptz,
  expires_at timestamptz,
  max_uses integer,
  used_count integer,
  active boolean,
  status text
)
language sql
security definer
stable
set search_path = public
as $$
  with scoped_invites as (
    select invite_codes.*
    from public.invite_codes
    where (p_org_unit_id is null or invite_codes.org_unit_id = p_org_unit_id)
      and public.current_user_can_manage_org_unit(invite_codes.org_unit_id)
  )
  select scoped_invites.id,
         scoped_invites.org_unit_id,
         ou.name as org_unit_name,
         coalesce(array_agg(path_unit.name order by path_order.ordinality), '{}'::text[]) as org_path_names,
         scoped_invites.target_role,
         scoped_invites.created_at,
         scoped_invites.expires_at,
         scoped_invites.max_uses,
         scoped_invites.used_count,
         scoped_invites.active,
         case
           when scoped_invites.active = false then 'inactive'
           when scoped_invites.expires_at is not null and scoped_invites.expires_at < now() then 'expired'
           when scoped_invites.max_uses is not null and scoped_invites.used_count >= scoped_invites.max_uses then 'completed'
           else 'active'
         end as status
  from scoped_invites
  join public.organization_units ou
    on ou.id = scoped_invites.org_unit_id
  left join lateral unnest(ou.path) with ordinality as path_order(path_id, ordinality)
    on true
  left join public.organization_units path_unit
    on path_unit.id = path_order.path_id
  group by scoped_invites.id,
           scoped_invites.org_unit_id,
           ou.name,
           scoped_invites.target_role,
           scoped_invites.created_at,
           scoped_invites.expires_at,
           scoped_invites.max_uses,
           scoped_invites.used_count,
           scoped_invites.active
  order by scoped_invites.created_at desc;
$$;

create or replace function public.deactivate_invite_code(p_invite_id uuid)
returns table (
  id uuid,
  active boolean,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_row public.invite_codes;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
    into invite_row
  from public.invite_codes
  where invite_codes.id = p_invite_id
  for update;

  if invite_row.id is null then
    raise exception 'INVITE_CODE_NOT_FOUND';
  end if;

  if not public.current_user_can_manage_org_unit(invite_row.org_unit_id) then
    raise exception 'ORG_UNIT_MANAGE_REQUIRED';
  end if;

  update public.invite_codes
     set active = false,
         updated_at = now()
   where invite_codes.id = invite_row.id
   returning invite_codes.id, invite_codes.active
      into id, active;

  status := 'inactive';
  return next;
end;
$$;

grant execute on function public.list_managed_organization_units() to authenticated;
grant execute on function public.list_invite_codes(uuid) to authenticated;
grant execute on function public.deactivate_invite_code(uuid) to authenticated;
