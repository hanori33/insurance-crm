-- Run this script in the Supabase SQL editor before deploying the fax API.
-- Required server secret: SUPABASE_SERVICE_ROLE_KEY (never expose it to React).

create extension if not exists pgcrypto;

create table if not exists public.fax_credit_transactions (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  total_pages integer not null check (total_pages > 0),
  status text not null check (status in ('reserved', 'sent', 'refunded')),
  provider_receipt_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fax_credit_transactions_user_created_idx
  on public.fax_credit_transactions (user_id, created_at desc);

alter table public.fax_credit_transactions enable row level security;

drop policy if exists "Users can read own fax credit transactions"
  on public.fax_credit_transactions;

create policy "Users can read own fax credit transactions"
  on public.fax_credit_transactions
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.reserve_fax_credit(
  p_user_id uuid,
  p_request_id text,
  p_total_pages integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.fax_credit_transactions%rowtype;
  v_remaining integer;
begin
  if p_user_id is null or p_request_id is null or length(p_request_id) < 8 then
    raise exception 'invalid fax reservation request';
  end if;

  if p_total_pages is null or p_total_pages <= 0 then
    raise exception 'total pages must be positive';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_request_id, 0));

  select *
    into v_transaction
    from public.fax_credit_transactions
   where request_id = p_request_id
   for update;

  if found then
    if v_transaction.user_id <> p_user_id or v_transaction.total_pages <> p_total_pages then
      raise exception 'fax request id conflict';
    end if;

    select coalesce(fax_credit, 0)
      into v_remaining
      from public.profiles
     where user_id = p_user_id;

    return jsonb_build_object(
      'success', v_transaction.status in ('reserved', 'sent'),
      'is_new', false,
      'status', v_transaction.status,
      'remaining_credit', coalesce(v_remaining, 0),
      'provider_receipt_id', v_transaction.provider_receipt_id
    );
  end if;

  update public.profiles
     set fax_credit = coalesce(fax_credit, 0) - p_total_pages
   where user_id = p_user_id
     and coalesce(fax_credit, 0) >= p_total_pages
  returning fax_credit into v_remaining;

  if not found then
    select coalesce(fax_credit, 0)
      into v_remaining
      from public.profiles
     where user_id = p_user_id;

    return jsonb_build_object(
      'success', false,
      'is_new', false,
      'status', 'insufficient_credit',
      'remaining_credit', coalesce(v_remaining, 0)
    );
  end if;

  insert into public.fax_credit_transactions (
    request_id,
    user_id,
    total_pages,
    status
  ) values (
    p_request_id,
    p_user_id,
    p_total_pages,
    'reserved'
  );

  return jsonb_build_object(
    'success', true,
    'is_new', true,
    'status', 'reserved',
    'remaining_credit', v_remaining
  );
end;
$$;

create or replace function public.complete_fax_credit(
  p_user_id uuid,
  p_request_id text,
  p_provider_receipt_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.fax_credit_transactions%rowtype;
  v_remaining integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_request_id, 0));

  select *
    into v_transaction
    from public.fax_credit_transactions
   where request_id = p_request_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'fax reservation not found';
  end if;

  if v_transaction.status = 'refunded' then
    raise exception 'fax reservation was already refunded';
  end if;

  if v_transaction.status = 'reserved' then
    update public.fax_credit_transactions
       set status = 'sent',
           provider_receipt_id = p_provider_receipt_id,
           updated_at = now()
     where id = v_transaction.id;
  end if;

  select coalesce(fax_credit, 0)
    into v_remaining
    from public.profiles
   where user_id = p_user_id;

  return jsonb_build_object(
    'success', true,
    'status', 'sent',
    'remaining_credit', coalesce(v_remaining, 0),
    'provider_receipt_id', coalesce(v_transaction.provider_receipt_id, p_provider_receipt_id)
  );
end;
$$;

create or replace function public.refund_fax_credit(
  p_user_id uuid,
  p_request_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_transaction public.fax_credit_transactions%rowtype;
  v_remaining integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_request_id, 0));

  select *
    into v_transaction
    from public.fax_credit_transactions
   where request_id = p_request_id
     and user_id = p_user_id
   for update;

  if not found then
    raise exception 'fax reservation not found';
  end if;

  if v_transaction.status = 'reserved' then
    update public.profiles
       set fax_credit = coalesce(fax_credit, 0) + v_transaction.total_pages
     where user_id = p_user_id
    returning fax_credit into v_remaining;

    update public.fax_credit_transactions
       set status = 'refunded', updated_at = now()
     where id = v_transaction.id;
  else
    select coalesce(fax_credit, 0)
      into v_remaining
      from public.profiles
     where user_id = p_user_id;
  end if;

  return jsonb_build_object(
    'success', true,
    'status', case when v_transaction.status = 'sent' then 'sent' else 'refunded' end,
    'remaining_credit', coalesce(v_remaining, 0)
  );
end;
$$;

revoke all on function public.reserve_fax_credit(uuid, text, integer) from public, anon, authenticated;
revoke all on function public.complete_fax_credit(uuid, text, text) from public, anon, authenticated;
revoke all on function public.refund_fax_credit(uuid, text) from public, anon, authenticated;

grant execute on function public.reserve_fax_credit(uuid, text, integer) to service_role;
grant execute on function public.complete_fax_credit(uuid, text, text) to service_role;
grant execute on function public.refund_fax_credit(uuid, text) to service_role;

