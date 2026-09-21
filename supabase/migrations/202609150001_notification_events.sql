create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  event_type text not null,
  event_key text not null,
  event_date date not null,
  status text not null default 'pending',
  payload jsonb not null default '{}'::jsonb,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);

create unique index if not exists notification_events_event_key_idx
  on public.notification_events (event_key);

create index if not exists notification_events_user_type_date_idx
  on public.notification_events (user_id, event_type, event_date);

alter table public.notification_events enable row level security;

create policy "Users can read own notification events"
  on public.notification_events
  for select
  using (auth.uid() = user_id);
