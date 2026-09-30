-- Review and apply separately before deploying the tracking API.
begin;
drop policy if exists fax_history_insert_own on public.fax_history;
drop policy if exists fax_history_update_own on public.fax_history;
drop policy if exists fax_history_delete_own on public.fax_history;
revoke insert, update on public.fax_history from public, anon, authenticated;
-- Restrictive policies also guard against other permissive policies.
create policy fax_history_no_client_insert on public.fax_history
  as restrictive for insert to anon, authenticated with check (false);
create policy fax_history_no_client_update on public.fax_history
  as restrictive for update to anon, authenticated using (false) with check (false);
create policy fax_history_delete_legacy_own on public.fax_history
  for delete to authenticated using (user_id = auth.uid() and request_id is null);
create policy fax_history_protect_tracked_delete on public.fax_history
  as restrictive for delete to anon, authenticated
  using (user_id = auth.uid() and request_id is null);
grant select, insert, update, delete on public.fax_history to service_role;
-- SELECT ownership policy and all credit RPCs remain unchanged.
commit;
