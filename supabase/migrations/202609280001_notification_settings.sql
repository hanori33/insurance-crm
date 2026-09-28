create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  car_expiry_enabled boolean not null default true,
  car_expiry_days integer not null default 30,
  updated_at timestamptz not null default now(),
  constraint notification_settings_car_expiry_days_check
    check (car_expiry_days in (7, 14, 30))
);

alter table public.notification_settings enable row level security;

drop policy if exists "Users can read own notification settings"
  on public.notification_settings;
create policy "Users can read own notification settings"
  on public.notification_settings
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notification settings"
  on public.notification_settings;
create policy "Users can insert own notification settings"
  on public.notification_settings
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notification settings"
  on public.notification_settings;
create policy "Users can update own notification settings"
  on public.notification_settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
