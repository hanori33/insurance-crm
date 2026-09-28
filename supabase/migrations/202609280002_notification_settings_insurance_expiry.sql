alter table public.notification_settings
  add column if not exists insurance_expiry_enabled boolean not null default true,
  add column if not exists insurance_expiry_days integer not null default 30,
  add column if not exists insurance_expiry_initialized boolean not null default false;

alter table public.notification_settings
  drop constraint if exists notification_settings_insurance_expiry_days_check;

alter table public.notification_settings
  add constraint notification_settings_insurance_expiry_days_check
  check (insurance_expiry_days in (7, 14, 30));
