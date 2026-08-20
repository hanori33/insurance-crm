begin;

-- Finish the safe part of the known duplicate root cleanup.
-- No rows are deleted. References are moved to the canonical organization unit,
-- then the duplicate nodes are marked inactive when no active references remain.

do $$
declare
  canonical_root_id uuid;
  duplicate_root_id uuid;
  canonical_unit_id uuid;
  duplicate_unit_id uuid;
  canonical_branch_id uuid;
  duplicate_branch_id uuid;
begin
  select id
    into canonical_root_id
  from public.organization_units
  where parent_id is null
    and name = '인카다이렉트 로얄사업단'
  order by created_at asc
  limit 1;

  select id
    into duplicate_root_id
  from public.organization_units
  where parent_id is null
    and id <> canonical_root_id
    and public.normalize_organization_unit_name(name) = public.normalize_organization_unit_name('인카다이렉트로얄사업단')
  order by created_at asc
  limit 1;

  if canonical_root_id is null or duplicate_root_id is null then
    return;
  end if;

  select id, legacy_branch_id
    into canonical_unit_id, canonical_branch_id
  from public.organization_units
  where parent_id = canonical_root_id
    and public.normalize_organization_unit_name(name) = public.normalize_organization_unit_name('배세영지점')
  order by case when name = '배세영지점' then 0 else 1 end, created_at asc
  limit 1;

  select id, legacy_branch_id
    into duplicate_unit_id, duplicate_branch_id
  from public.organization_units
  where parent_id = duplicate_root_id
    and public.normalize_organization_unit_name(name) = public.normalize_organization_unit_name('배세영지점')
  order by created_at asc
  limit 1;

  if canonical_unit_id is null or duplicate_unit_id is null or canonical_unit_id = duplicate_unit_id then
    return;
  end if;

  insert into public.organization_memberships (user_id, org_unit_id, role, status)
  select om.user_id, canonical_unit_id, om.role, om.status
  from public.organization_memberships om
  where om.org_unit_id = duplicate_unit_id
    and om.status = 'active'
  on conflict on constraint organization_memberships_user_org_unique
  do update set
    role = excluded.role,
    status = excluded.status,
    updated_at = now();

  update public.organization_memberships
     set status = 'inactive',
         updated_at = now()
   where org_unit_id = duplicate_unit_id
     and status = 'active';

  update public.invite_codes
     set org_unit_id = canonical_unit_id,
         updated_at = now()
   where org_unit_id = duplicate_unit_id;

  if canonical_branch_id is not null and duplicate_branch_id is not null then
    update public.profiles
       set branch_id = canonical_branch_id,
           updated_at = now()
     where branch_id = duplicate_branch_id;
  end if;

  update public.user_roles
     set organization = '인카다이렉트 로얄사업단',
         branch = nullif(branch, '로얄사업단'),
         office = coalesce(
           (select name from public.organization_units where id = canonical_unit_id),
           office
         )
   where user_id in (
     select user_id
     from public.organization_memberships
     where org_unit_id = canonical_unit_id
       and status = 'active'
   )
     and public.normalize_organization_unit_name(organization) = public.normalize_organization_unit_name('인카다이렉트로얄사업단');

  update public.organization_units
     set is_active = false,
         display_type = '중복 지점 정리됨'
   where id = duplicate_unit_id
     and not exists (
       select 1
       from public.organization_memberships om
       where om.org_unit_id = duplicate_unit_id
         and om.status = 'active'
     )
     and not exists (
       select 1
       from public.invite_codes ic
       where ic.org_unit_id = duplicate_unit_id
         and ic.active = true
     );

  update public.organization_units
     set is_active = false,
         display_type = '중복 루트 정리됨'
   where id = duplicate_root_id
     and not exists (
       select 1
       from public.organization_units child
       where child.parent_id = duplicate_root_id
         and child.is_active = true
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

  perform public.rebuild_organization_unit_paths(canonical_root_id);
  perform public.rebuild_organization_unit_paths(duplicate_root_id);
end;
$$;

commit;
