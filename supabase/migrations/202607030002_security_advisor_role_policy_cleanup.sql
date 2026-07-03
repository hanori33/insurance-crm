begin;

-- Security Advisor: remove email-hardcoded admin policies and always-true role reads.
-- Keep role approval and team management working through existing admin helpers.
drop policy if exists "admin can manage all requests" on public.role_requests;
drop policy if exists "role_requests_admin_manage_all" on public.role_requests;

create policy "role_requests_admin_manage_all"
  on public.role_requests
  for all
  to authenticated
  using (public.current_profile_is_admin())
  with check (public.current_profile_is_admin());

drop policy if exists "users can read all roles" on public.user_roles;
drop policy if exists "superadmin can manage roles" on public.user_roles;
drop policy if exists "user_roles_select_self_branch_or_admin" on public.user_roles;
drop policy if exists "user_roles_admin_manage_all" on public.user_roles;

create policy "user_roles_select_self_branch_or_admin"
  on public.user_roles
  for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.current_profile_is_admin()
    or exists (
      select 1
      from public.profiles p
      where p.user_id = user_roles.user_id
        and p.branch_id is not null
        and p.branch_id = public.current_profile_branch_id()
    )
  );

create policy "user_roles_admin_manage_all"
  on public.user_roles
  for all
  to authenticated
  using (public.current_profile_is_admin())
  with check (public.current_profile_is_admin());

-- Security Advisor: Function Search Path Mutable for existing trigger helpers.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.profiles (
    user_id,
    name,
    role,
    status
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    'staff',
    'active'
  );

  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;

commit;
