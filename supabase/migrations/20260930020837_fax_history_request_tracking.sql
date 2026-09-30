-- Local-only design migration. Apply only after reviewing existing fax_history rows.
-- Historical rows remain nullable and are never assigned synthetic request IDs.
alter table public.fax_history
  add column if not exists request_id text,
  add column if not exists sent_at timestamptz,
  add column if not exists error_message text;

create unique index if not exists fax_history_request_id_uidx
  on public.fax_history (request_id)
  where request_id is not null;

create index if not exists fax_history_user_created_idx
  on public.fax_history (user_id, created_at desc);

-- Read-only production audit (2026-09-30): no existing status CHECK.
-- Do not drop existing constraints. Unexpected name conflicts must fail closed.
-- NOT VALID preserves historical rows; new/updated rows must satisfy the CHECK.
alter table public.fax_history
  add constraint fax_history_status_check
  check (status is null or status in ('processing', 'sent', 'failed', 'unknown', 'legacy', '발송완료', '대기'))
  not valid;
