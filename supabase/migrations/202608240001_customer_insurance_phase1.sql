begin;

create table if not exists public.insurance_company_options (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  sort_order integer not null default 1000,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint insurance_company_options_name_not_blank check (length(trim(name)) > 0),
  constraint insurance_company_options_normalized_unique unique (normalized_name)
);

create table if not exists public.standard_coverage_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null,
  name text not null,
  group_name text,
  aggregation_mode text not null default 'review_required',
  description text,
  sort_order integer not null default 1000,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint standard_coverage_categories_code_unique unique (code),
  constraint standard_coverage_categories_code_not_blank check (length(trim(code)) > 0),
  constraint standard_coverage_categories_name_not_blank check (length(trim(name)) > 0),
  constraint standard_coverage_categories_aggregation_mode_allowed
    check (aggregation_mode in ('sum', 'separate', 'review_required'))
);

create table if not exists public.customer_insurance_contracts (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  insurance_company text not null default '',
  product_name text not null default '',
  joined_at date,
  monthly_premium numeric,
  payment_period text not null default '',
  coverage_period text not null default '',
  renewal_type text not null default '확인필요',
  contract_status text not null default '유지중',
  contractor text not null default '',
  insured text not null default '',
  policy_number text,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_insurance_contracts_company_or_product_required
    check (length(trim(insurance_company)) > 0 or length(trim(product_name)) > 0),
  constraint customer_insurance_contracts_monthly_premium_nonnegative
    check (monthly_premium is null or monthly_premium >= 0)
);

create table if not exists public.customer_insurance_coverages (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  contract_id uuid not null references public.customer_insurance_contracts(id) on delete cascade,
  standard_coverage_id uuid references public.standard_coverage_categories(id) on delete set null,
  original_name text not null default '',
  coverage_amount numeric,
  coverage_period text not null default '',
  payment_period text not null default '',
  is_renewable boolean,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_insurance_coverages_name_or_standard_required
    check (standard_coverage_id is not null or length(trim(original_name)) > 0),
  constraint customer_insurance_coverages_amount_nonnegative
    check (coverage_amount is null or coverage_amount >= 0)
);

create index if not exists insurance_company_options_active_sort_idx
  on public.insurance_company_options(is_active, sort_order, name);

create index if not exists standard_coverage_categories_active_sort_idx
  on public.standard_coverage_categories(is_active, sort_order, name);

create index if not exists customer_insurance_contracts_customer_idx
  on public.customer_insurance_contracts(customer_id, created_at desc);

create index if not exists customer_insurance_contracts_user_idx
  on public.customer_insurance_contracts(user_id, created_at desc);

create index if not exists customer_insurance_coverages_contract_idx
  on public.customer_insurance_coverages(contract_id, created_at asc);

create index if not exists customer_insurance_coverages_customer_standard_idx
  on public.customer_insurance_coverages(customer_id, standard_coverage_id);

drop trigger if exists touch_insurance_company_options_updated_at on public.insurance_company_options;
create trigger touch_insurance_company_options_updated_at
  before update on public.insurance_company_options
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_standard_coverage_categories_updated_at on public.standard_coverage_categories;
create trigger touch_standard_coverage_categories_updated_at
  before update on public.standard_coverage_categories
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_customer_insurance_contracts_updated_at on public.customer_insurance_contracts;
create trigger touch_customer_insurance_contracts_updated_at
  before update on public.customer_insurance_contracts
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_customer_insurance_coverages_updated_at on public.customer_insurance_coverages;
create trigger touch_customer_insurance_coverages_updated_at
  before update on public.customer_insurance_coverages
  for each row execute function public.touch_updated_at();

insert into public.standard_coverage_categories (code, name, group_name, aggregation_mode, description, sort_order)
values
  ('cancer_diagnosis_general', '일반암 진단비', '3대진단', 'sum', '보장범위가 같은 일반암 진단비는 Phase 1에서 단순 합산합니다.', 10),
  ('minor_cancer_diagnosis', '유사암 진단비', '3대진단', 'sum', '유사암/소액암 등 세부 지급조건은 필요 시 메모로 확인합니다.', 20),
  ('cerebrovascular_diagnosis', '뇌혈관질환 진단비', '3대진단', 'sum', '뇌혈관질환 진단비. 뇌출혈과는 별도 분류합니다.', 30),
  ('cerebral_hemorrhage_diagnosis', '뇌출혈 진단비', '3대진단', 'separate', '뇌혈관질환보다 범위가 좁을 수 있어 별도 표시합니다.', 40),
  ('ischemic_heart_diagnosis', '허혈성심장질환 진단비', '3대진단', 'sum', '허혈성심장질환 진단비. 급성심근경색과는 별도 분류합니다.', 50),
  ('acute_myocardial_infarction_diagnosis', '급성심근경색 진단비', '3대진단', 'separate', '허혈성심장질환보다 범위가 좁을 수 있어 별도 표시합니다.', 60),
  ('disease_surgery', '질병수술비', '수술/입원', 'review_required', '수술 종류와 지급조건 차이가 커서 확인 필요로 표시합니다.', 70),
  ('injury_surgery', '상해수술비', '수술/입원', 'review_required', '수술 종류와 지급조건 차이가 커서 확인 필요로 표시합니다.', 80),
  ('disease_disability', '질병후유장해', '후유장해', 'review_required', '장해율/지급조건 확인이 필요합니다.', 90),
  ('injury_disability', '상해후유장해', '후유장해', 'review_required', '장해율/지급조건 확인이 필요합니다.', 100),
  ('hospital_daily', '입원일당', '수술/입원', 'review_required', '일당 지급일수와 면책기간 확인이 필요합니다.', 110),
  ('caregiver_daily', '간병인사용일당', '간병', 'review_required', '간병인 사용 조건 확인이 필요합니다.', 120),
  ('integrated_nursing_daily', '간호간병통합서비스', '간병', 'review_required', '간호간병통합서비스 지급조건 확인이 필요합니다.', 130),
  ('long_term_care_hospital_caregiver', '요양병원 관련 간병', '간병', 'review_required', '요양병원 보장 범위 확인이 필요합니다.', 140),
  ('fracture_diagnosis', '골절진단비', '상해', 'sum', '동일한 골절진단비는 Phase 1에서 단순 합산합니다.', 150),
  ('burn_diagnosis', '화상진단비', '상해', 'sum', '동일한 화상진단비는 Phase 1에서 단순 합산합니다.', 160),
  ('driver_major', '운전자 주요담보', '운전자', 'review_required', '담보별 보장내용 차이가 커서 확인 필요로 표시합니다.', 170),
  ('uncategorized', '기타/미분류', '기타', 'review_required', '표준담보를 선택하기 어려운 담보입니다.', 999)
on conflict (code) do update set
  name = excluded.name,
  group_name = excluded.group_name,
  aggregation_mode = excluded.aggregation_mode,
  description = excluded.description,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into public.insurance_company_options (name, normalized_name, sort_order)
values
  ('삼성생명', public.normalize_organization_unit_name('삼성생명'), 10),
  ('한화생명', public.normalize_organization_unit_name('한화생명'), 20),
  ('교보생명', public.normalize_organization_unit_name('교보생명'), 30),
  ('신한라이프', public.normalize_organization_unit_name('신한라이프'), 40),
  ('미래에셋생명', public.normalize_organization_unit_name('미래에셋생명'), 50),
  ('DB생명', public.normalize_organization_unit_name('DB생명'), 60),
  ('메트라이프생명', public.normalize_organization_unit_name('메트라이프생명'), 70),
  ('AIA생명', public.normalize_organization_unit_name('AIA생명'), 80),
  ('라이나생명', public.normalize_organization_unit_name('라이나생명'), 90),
  ('삼성화재', public.normalize_organization_unit_name('삼성화재'), 110),
  ('DB손해보험', public.normalize_organization_unit_name('DB손해보험'), 120),
  ('현대해상', public.normalize_organization_unit_name('현대해상'), 130),
  ('KB손해보험', public.normalize_organization_unit_name('KB손해보험'), 140),
  ('메리츠화재', public.normalize_organization_unit_name('메리츠화재'), 150),
  ('한화손해보험', public.normalize_organization_unit_name('한화손해보험'), 160),
  ('롯데손해보험', public.normalize_organization_unit_name('롯데손해보험'), 170),
  ('흥국화재', public.normalize_organization_unit_name('흥국화재'), 180),
  ('농협손해보험', public.normalize_organization_unit_name('농협손해보험'), 190),
  ('기타', public.normalize_organization_unit_name('기타'), 999)
on conflict (normalized_name) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

alter table public.insurance_company_options enable row level security;
alter table public.standard_coverage_categories enable row level security;
alter table public.customer_insurance_contracts enable row level security;
alter table public.customer_insurance_coverages enable row level security;

drop policy if exists "insurance_company_options_select_active" on public.insurance_company_options;
create policy "insurance_company_options_select_active"
  on public.insurance_company_options
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "insurance_company_options_superadmin_manage" on public.insurance_company_options;
create policy "insurance_company_options_superadmin_manage"
  on public.insurance_company_options
  for all
  to authenticated
  using (coalesce(public.current_profile_is_superadmin(), false))
  with check (coalesce(public.current_profile_is_superadmin(), false));

drop policy if exists "standard_coverage_categories_select_active" on public.standard_coverage_categories;
create policy "standard_coverage_categories_select_active"
  on public.standard_coverage_categories
  for select
  to authenticated
  using (is_active = true);

drop policy if exists "standard_coverage_categories_superadmin_manage" on public.standard_coverage_categories;
create policy "standard_coverage_categories_superadmin_manage"
  on public.standard_coverage_categories
  for all
  to authenticated
  using (coalesce(public.current_profile_is_superadmin(), false))
  with check (coalesce(public.current_profile_is_superadmin(), false));

drop policy if exists "customer_insurance_contracts_select_own_customer" on public.customer_insurance_contracts;
create policy "customer_insurance_contracts_select_own_customer"
  on public.customer_insurance_contracts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = customer_insurance_contracts.customer_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "customer_insurance_contracts_insert_own_customer" on public.customer_insurance_contracts;
create policy "customer_insurance_contracts_insert_own_customer"
  on public.customer_insurance_contracts
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.customers c
      where c.id = customer_insurance_contracts.customer_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "customer_insurance_contracts_update_own_customer" on public.customer_insurance_contracts;
create policy "customer_insurance_contracts_update_own_customer"
  on public.customer_insurance_contracts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = customer_insurance_contracts.customer_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.customers c
      where c.id = customer_insurance_contracts.customer_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "customer_insurance_contracts_delete_own_customer" on public.customer_insurance_contracts;
create policy "customer_insurance_contracts_delete_own_customer"
  on public.customer_insurance_contracts
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = customer_insurance_contracts.customer_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "customer_insurance_coverages_select_own_customer" on public.customer_insurance_coverages;
create policy "customer_insurance_coverages_select_own_customer"
  on public.customer_insurance_coverages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = customer_insurance_coverages.customer_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "customer_insurance_coverages_insert_own_customer" on public.customer_insurance_coverages;
create policy "customer_insurance_coverages_insert_own_customer"
  on public.customer_insurance_coverages
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.customers c
      where c.id = customer_insurance_coverages.customer_id
        and c.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.customer_insurance_contracts contract
      where contract.id = customer_insurance_coverages.contract_id
        and contract.customer_id = customer_insurance_coverages.customer_id
        and contract.user_id = auth.uid()
    )
  );

drop policy if exists "customer_insurance_coverages_update_own_customer" on public.customer_insurance_coverages;
create policy "customer_insurance_coverages_update_own_customer"
  on public.customer_insurance_coverages
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = customer_insurance_coverages.customer_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.customers c
      where c.id = customer_insurance_coverages.customer_id
        and c.user_id = auth.uid()
    )
    and exists (
      select 1
      from public.customer_insurance_contracts contract
      where contract.id = customer_insurance_coverages.contract_id
        and contract.customer_id = customer_insurance_coverages.customer_id
        and contract.user_id = auth.uid()
    )
  );

drop policy if exists "customer_insurance_coverages_delete_own_customer" on public.customer_insurance_coverages;
create policy "customer_insurance_coverages_delete_own_customer"
  on public.customer_insurance_coverages
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.customers c
      where c.id = customer_insurance_coverages.customer_id
        and c.user_id = auth.uid()
    )
  );

comment on table public.customer_insurance_contracts is
  'Phase 1 current insurance contracts entered by an agent for a customer. Does not alter legacy policies/customers.policies.';
comment on table public.customer_insurance_coverages is
  'Phase 1 structured coverages for customer current insurance contracts.';
comment on table public.standard_coverage_categories is
  'Minimal standard coverage master for grouping and safe current coverage aggregation.';
comment on column public.standard_coverage_categories.aggregation_mode is
  'sum: simple total; separate: show separately; review_required: do not rely on total without condition review.';

commit;
