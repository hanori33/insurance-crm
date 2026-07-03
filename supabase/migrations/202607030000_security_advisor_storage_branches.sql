begin;

-- Security Advisor: RLS Disabled in Public / public.branches
-- branches is used by role approval and TeamPage branch display.
alter table public.branches enable row level security;

drop policy if exists "branches_select_same_branch_or_admin" on public.branches;
drop policy if exists "branches_insert_admin" on public.branches;
drop policy if exists "branches_update_admin" on public.branches;
drop policy if exists "branches_delete_admin" on public.branches;

create policy "branches_select_same_branch_or_admin"
  on public.branches
  for select
  to authenticated
  using (
    public.current_profile_is_admin()
    or id = public.current_profile_branch_id()
  );

create policy "branches_insert_admin"
  on public.branches
  for insert
  to authenticated
  with check (public.current_profile_is_admin());

create policy "branches_update_admin"
  on public.branches
  for update
  to authenticated
  using (public.current_profile_is_admin())
  with check (public.current_profile_is_admin());

create policy "branches_delete_admin"
  on public.branches
  for delete
  to authenticated
  using (public.current_profile_is_admin());

-- policy_files metadata had an always-true authenticated policy.
-- Keep the current customer detail flow working while restricting metadata to
-- files that belong to the current user's customers.
alter table public.policy_files enable row level security;

drop policy if exists "Allow all policy files" on public.policy_files;
drop policy if exists "policy_files_select_own_customer" on public.policy_files;
drop policy if exists "policy_files_insert_own_customer" on public.policy_files;
drop policy if exists "policy_files_update_own_customer" on public.policy_files;
drop policy if exists "policy_files_delete_own_customer" on public.policy_files;

create policy "policy_files_select_own_customer"
  on public.policy_files
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = policy_files.customer_id
        and c.user_id = auth.uid()
    )
  );

create policy "policy_files_insert_own_customer"
  on public.policy_files
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.customers c
      where c.id = policy_files.customer_id
        and c.user_id = auth.uid()
    )
  );

create policy "policy_files_update_own_customer"
  on public.policy_files
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = policy_files.customer_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.customers c
      where c.id = policy_files.customer_id
        and c.user_id = auth.uid()
    )
  );

create policy "policy_files_delete_own_customer"
  on public.policy_files
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = policy_files.customer_id
        and c.user_id = auth.uid()
    )
  );

-- Storage: policy-files
-- Current object paths are {customer_id}/{timestamp.ext}.
drop policy if exists "Allow authenticated read policy files" on storage.objects;
drop policy if exists "Allow authenticated upload policy files" on storage.objects;
drop policy if exists "Allow authenticated delete policy files" on storage.objects;
drop policy if exists "policy_files_select_own_customer_folder" on storage.objects;
drop policy if exists "policy_files_insert_own_customer_folder" on storage.objects;
drop policy if exists "policy_files_update_own_customer_folder" on storage.objects;
drop policy if exists "policy_files_delete_own_customer_folder" on storage.objects;

create policy "policy_files_select_own_customer_folder"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'policy-files'
    and exists (
      select 1
      from public.customers c
      where c.id::text = (storage.foldername(storage.objects.name))[1]
        and c.user_id = auth.uid()
    )
  );

create policy "policy_files_insert_own_customer_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'policy-files'
    and exists (
      select 1
      from public.customers c
      where c.id::text = (storage.foldername(storage.objects.name))[1]
        and c.user_id = auth.uid()
    )
  );

create policy "policy_files_update_own_customer_folder"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'policy-files'
    and exists (
      select 1
      from public.customers c
      where c.id::text = (storage.foldername(storage.objects.name))[1]
        and c.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'policy-files'
    and exists (
      select 1
      from public.customers c
      where c.id::text = (storage.foldername(storage.objects.name))[1]
        and c.user_id = auth.uid()
    )
  );

create policy "policy_files_delete_own_customer_folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'policy-files'
    and exists (
      select 1
      from public.customers c
      where c.id::text = (storage.foldername(storage.objects.name))[1]
        and c.user_id = auth.uid()
    )
  );

-- Storage: fax-files
-- Pre-create safe policies for future direct client use. The delete-account
-- Edge Function uses the service role and is not blocked by these policies.
drop policy if exists "fax_files_select_own_folder" on storage.objects;
drop policy if exists "fax_files_insert_own_folder" on storage.objects;
drop policy if exists "fax_files_update_own_folder" on storage.objects;
drop policy if exists "fax_files_delete_own_folder" on storage.objects;

create policy "fax_files_select_own_folder"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'fax-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "fax_files_insert_own_folder"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'fax-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "fax_files_update_own_folder"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'fax-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'fax-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "fax_files_delete_own_folder"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'fax-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage: profiles
-- Keep the bucket public for direct avatar URLs, but remove public listing via
-- storage.objects and restrict writes to avatars/{auth.uid()}.*.
drop policy if exists "Public can view avatars" on storage.objects;
drop policy if exists "Users can upload avatar" on storage.objects;
drop policy if exists "Users can update avatar" on storage.objects;
drop policy if exists "Users can delete own profile image" on storage.objects;
drop policy if exists "profiles_avatar_insert_own_file" on storage.objects;
drop policy if exists "profiles_avatar_update_own_file" on storage.objects;
drop policy if exists "profiles_avatar_delete_own_file" on storage.objects;

create policy "profiles_avatar_insert_own_file"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'profiles'
    and (storage.foldername(name))[1] = 'avatars'
    and (
      storage.filename(name) = auth.uid()::text
      or storage.filename(name) like auth.uid()::text || '.%'
    )
  );

create policy "profiles_avatar_update_own_file"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'profiles'
    and (storage.foldername(name))[1] = 'avatars'
    and (
      storage.filename(name) = auth.uid()::text
      or storage.filename(name) like auth.uid()::text || '.%'
    )
  )
  with check (
    bucket_id = 'profiles'
    and (storage.foldername(name))[1] = 'avatars'
    and (
      storage.filename(name) = auth.uid()::text
      or storage.filename(name) like auth.uid()::text || '.%'
    )
  );

create policy "profiles_avatar_delete_own_file"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'profiles'
    and (storage.foldername(name))[1] = 'avatars'
    and (
      storage.filename(name) = auth.uid()::text
      or storage.filename(name) like auth.uid()::text || '.%'
    )
  );

commit;
