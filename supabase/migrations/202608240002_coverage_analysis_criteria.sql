begin;

create table if not exists public.coverage_analysis_criteria_sets (
  id uuid primary key default extensions.gen_random_uuid(),
  scope_type text not null default 'user',
  user_id uuid references auth.users(id) on delete cascade,
  org_unit_id uuid references public.organization_units(id) on delete cascade,
  name text not null default '내 분석기준',
  is_default boolean not null default true,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coverage_analysis_criteria_sets_scope_allowed
    check (scope_type in ('user', 'org_unit')),
  constraint coverage_analysis_criteria_sets_scope_target_required
    check (
      (scope_type = 'user' and user_id is not null and org_unit_id is null)
      or
      (scope_type = 'org_unit' and org_unit_id is not null)
    ),
  constraint coverage_analysis_criteria_sets_name_not_blank
    check (length(trim(name)) > 0)
);

create table if not exists public.coverage_analysis_criteria_items (
  id uuid primary key default extensions.gen_random_uuid(),
  criteria_set_id uuid not null references public.coverage_analysis_criteria_sets(id) on delete cascade,
  standard_coverage_id uuid not null references public.standard_coverage_categories(id) on delete restrict,
  target_amount numeric,
  is_enabled boolean not null default true,
  display_order integer not null default 1000,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coverage_analysis_criteria_items_amount_nonnegative
    check (target_amount is null or target_amount >= 0),
  constraint coverage_analysis_criteria_items_unique
    unique (criteria_set_id, standard_coverage_id)
);

create unique index if not exists coverage_analysis_criteria_sets_user_default_unique_idx
  on public.coverage_analysis_criteria_sets(user_id)
  where scope_type = 'user' and is_default = true;

create index if not exists coverage_analysis_criteria_sets_user_idx
  on public.coverage_analysis_criteria_sets(user_id, is_default);

create index if not exists coverage_analysis_criteria_sets_org_unit_idx
  on public.coverage_analysis_criteria_sets(org_unit_id, is_default);

create index if not exists coverage_analysis_criteria_items_set_order_idx
  on public.coverage_analysis_criteria_items(criteria_set_id, display_order);

drop trigger if exists touch_coverage_analysis_criteria_sets_updated_at on public.coverage_analysis_criteria_sets;
create trigger touch_coverage_analysis_criteria_sets_updated_at
  before update on public.coverage_analysis_criteria_sets
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_coverage_analysis_criteria_items_updated_at on public.coverage_analysis_criteria_items;
create trigger touch_coverage_analysis_criteria_items_updated_at
  before update on public.coverage_analysis_criteria_items
  for each row execute function public.touch_updated_at();

alter table public.coverage_analysis_criteria_sets enable row level security;
alter table public.coverage_analysis_criteria_items enable row level security;

drop policy if exists "coverage_analysis_criteria_sets_select_own_user" on public.coverage_analysis_criteria_sets;
create policy "coverage_analysis_criteria_sets_select_own_user"
  on public.coverage_analysis_criteria_sets
  for select
  to authenticated
  using (scope_type = 'user' and user_id = auth.uid());

drop policy if exists "coverage_analysis_criteria_sets_insert_own_user" on public.coverage_analysis_criteria_sets;
create policy "coverage_analysis_criteria_sets_insert_own_user"
  on public.coverage_analysis_criteria_sets
  for insert
  to authenticated
  with check (
    scope_type = 'user'
    and user_id = auth.uid()
    and created_by = auth.uid()
    and org_unit_id is null
  );

drop policy if exists "coverage_analysis_criteria_sets_update_own_user" on public.coverage_analysis_criteria_sets;
create policy "coverage_analysis_criteria_sets_update_own_user"
  on public.coverage_analysis_criteria_sets
  for update
  to authenticated
  using (scope_type = 'user' and user_id = auth.uid())
  with check (
    scope_type = 'user'
    and user_id = auth.uid()
    and created_by = auth.uid()
    and org_unit_id is null
  );

drop policy if exists "coverage_analysis_criteria_sets_delete_own_user" on public.coverage_analysis_criteria_sets;
create policy "coverage_analysis_criteria_sets_delete_own_user"
  on public.coverage_analysis_criteria_sets
  for delete
  to authenticated
  using (scope_type = 'user' and user_id = auth.uid());

drop policy if exists "coverage_analysis_criteria_items_select_own_user_set" on public.coverage_analysis_criteria_items;
create policy "coverage_analysis_criteria_items_select_own_user_set"
  on public.coverage_analysis_criteria_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.coverage_analysis_criteria_sets criteria_set
      where criteria_set.id = coverage_analysis_criteria_items.criteria_set_id
        and criteria_set.scope_type = 'user'
        and criteria_set.user_id = auth.uid()
    )
  );

drop policy if exists "coverage_analysis_criteria_items_insert_own_user_set" on public.coverage_analysis_criteria_items;
create policy "coverage_analysis_criteria_items_insert_own_user_set"
  on public.coverage_analysis_criteria_items
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.coverage_analysis_criteria_sets criteria_set
      where criteria_set.id = coverage_analysis_criteria_items.criteria_set_id
        and criteria_set.scope_type = 'user'
        and criteria_set.user_id = auth.uid()
    )
  );

drop policy if exists "coverage_analysis_criteria_items_update_own_user_set" on public.coverage_analysis_criteria_items;
create policy "coverage_analysis_criteria_items_update_own_user_set"
  on public.coverage_analysis_criteria_items
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.coverage_analysis_criteria_sets criteria_set
      where criteria_set.id = coverage_analysis_criteria_items.criteria_set_id
        and criteria_set.scope_type = 'user'
        and criteria_set.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.coverage_analysis_criteria_sets criteria_set
      where criteria_set.id = coverage_analysis_criteria_items.criteria_set_id
        and criteria_set.scope_type = 'user'
        and criteria_set.user_id = auth.uid()
    )
  );

drop policy if exists "coverage_analysis_criteria_items_delete_own_user_set" on public.coverage_analysis_criteria_items;
create policy "coverage_analysis_criteria_items_delete_own_user_set"
  on public.coverage_analysis_criteria_items
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.coverage_analysis_criteria_sets criteria_set
      where criteria_set.id = coverage_analysis_criteria_items.criteria_set_id
        and criteria_set.scope_type = 'user'
        and criteria_set.user_id = auth.uid()
    )
  );

comment on table public.coverage_analysis_criteria_sets is
  'User-owned coverage analysis criteria sets. Phase 2 uses user scope only; org_unit scope is reserved for future shared criteria.';
comment on table public.coverage_analysis_criteria_items is
  'Target amounts and display settings per standard coverage category for coverage analysis.';
comment on column public.coverage_analysis_criteria_items.target_amount is
  'User-entered target amount in KRW. It is not a BOPLAN recommended amount.';

commit;
