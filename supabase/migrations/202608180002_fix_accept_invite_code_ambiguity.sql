-- Fix PL/pgSQL variable/column ambiguity in accept_invite_code().

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
