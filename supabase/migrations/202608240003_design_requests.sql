begin;

create table if not exists public.design_managers (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  insurance_company text not null default '',
  name text not null,
  phone text,
  specialty text,
  memo text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint design_managers_name_not_blank check (length(trim(name)) > 0),
  constraint design_managers_company_not_blank check (length(trim(insurance_company)) > 0)
);

create table if not exists public.design_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  manager_id uuid references public.design_managers(id) on delete set null,
  manager_company_snapshot text not null default '',
  manager_name_snapshot text not null default '',
  manager_phone_snapshot text,
  manager_specialty_snapshot text,
  request_message text not null default '',
  included_sections jsonb not null default '{}'::jsonb,
  status text not null default 'draft',
  sent_at timestamptz,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint design_requests_status_allowed
    check (status in ('draft', 'sent', 'received', 'reviewed', 'canceled')),
  constraint design_requests_message_not_blank check (length(trim(request_message)) > 0)
);

create index if not exists design_managers_user_active_idx
  on public.design_managers(user_id, is_active, insurance_company, name);

create index if not exists design_requests_customer_created_idx
  on public.design_requests(customer_id, created_at desc);

create index if not exists design_requests_user_status_idx
  on public.design_requests(user_id, status, created_at desc);

drop trigger if exists touch_design_managers_updated_at on public.design_managers;
create trigger touch_design_managers_updated_at
  before update on public.design_managers
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_design_requests_updated_at on public.design_requests;
create trigger touch_design_requests_updated_at
  before update on public.design_requests
  for each row execute function public.touch_updated_at();

alter table public.design_managers enable row level security;
alter table public.design_requests enable row level security;

drop policy if exists "design_managers_select_own" on public.design_managers;
create policy "design_managers_select_own"
  on public.design_managers
  for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "design_managers_insert_own" on public.design_managers;
create policy "design_managers_insert_own"
  on public.design_managers
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "design_managers_update_own" on public.design_managers;
create policy "design_managers_update_own"
  on public.design_managers
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "design_managers_delete_own" on public.design_managers;
create policy "design_managers_delete_own"
  on public.design_managers
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "design_requests_select_own_customer" on public.design_requests;
create policy "design_requests_select_own_customer"
  on public.design_requests
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.customers c
      where c.id = design_requests.customer_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "design_requests_insert_own_customer" on public.design_requests;
create policy "design_requests_insert_own_customer"
  on public.design_requests
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.customers c
      where c.id = design_requests.customer_id
        and c.user_id = auth.uid()
    )
    and (
      manager_id is null
      or exists (
        select 1
        from public.design_managers m
        where m.id = design_requests.manager_id
          and m.user_id = auth.uid()
      )
    )
  );

drop policy if exists "design_requests_update_own_customer" on public.design_requests;
create policy "design_requests_update_own_customer"
  on public.design_requests
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.customers c
      where c.id = design_requests.customer_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.customers c
      where c.id = design_requests.customer_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "design_requests_delete_own_customer" on public.design_requests;
create policy "design_requests_delete_own_customer"
  on public.design_requests
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1
      from public.customers c
      where c.id = design_requests.customer_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.design_managers is
  'User-owned insurance company design managers. Prefer deactivation over deletion to protect request history.';
comment on table public.design_requests is
  'Customer-linked design request history with manager snapshots preserved at request creation time.';
comment on column public.design_requests.manager_company_snapshot is
  'Insurance company value copied from the selected manager at request creation time.';
comment on column public.design_requests.manager_name_snapshot is
  'Manager name copied from the selected manager at request creation time.';
comment on column public.design_requests.manager_phone_snapshot is
  'Manager phone copied from the selected manager at request creation time.';
comment on column public.design_requests.manager_specialty_snapshot is
  'Manager specialty copied from the selected manager at request creation time.';

commit;
