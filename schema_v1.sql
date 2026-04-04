-- ========================================================
-- Aura Blockchain Ledger v1 (PostgreSQL / Supabase)
-- Strictly followed AURA_WALLET_LEDGER_V1_FULL.md
-- ========================================================

begin;

-- 1) เคลียร์ของเก่า (เพื่อให้โครงสร้างตรงตาม V1 Spec 100%)
drop table if exists public.minting_history cascade;
drop table if exists public.ledger_events cascade;
drop table if exists public.aura_vault cascade;
drop table if exists public.aura_accounts cascade;

-- 2) Accounts Table
create table public.aura_accounts (
  address text primary key,
  public_key text unique not null,
  created_at timestamptz not null default now()
);

-- 3) Vault Table (State Cache)
create table public.aura_vault (
  address text primary key references public.aura_accounts(address) on delete restrict,
  balance_atom numeric(78,0) not null default 0,
  nonce bigint not null default 0,
  last_event_hash text not null default '0000000000000000000000000000000000000000000000000000000000000000',
  updated_at timestamptz not null default now()
);

create index if not exists aura_vault_nonce_idx on public.aura_vault (nonce);

-- 4) Ledger Events (Append-only)
create table public.ledger_events (
  id bigserial primary key,
  event_type text not null check (event_type in ('transfer','mint')),
  from_address text null,
  to_address text not null,
  amount_atom numeric(78,0) not null check (amount_atom > 0),
  from_nonce bigint null,
  prev_event_hash text null,
  event_hash text unique not null,
  payload jsonb not null,
  signature text null,
  public_key text null,
  created_at timestamptz not null default now()
);

create index if not exists ledger_events_from_idx on public.ledger_events (from_address, id desc);
create index if not exists ledger_events_to_idx on public.ledger_events (to_address, id desc);

-- 5) Minting History
create table public.minting_history (
  mint_day date primary key,
  event_hash text unique not null,
  created_at timestamptz not null default now()
);

-- 6) Helper: ensure_vault_row
create or replace function public.ensure_vault_row(p_address text)
returns void
language plpgsql
as $$
begin
  insert into public.aura_accounts(address, public_key)
  values (p_address, 'RESERVED')
  on conflict (address) do nothing;

  insert into public.aura_vault(address, balance_atom, nonce, last_event_hash)
  values (p_address, 0, 0, '0000000000000000000000000000000000000000000000000000000000000000')
  on conflict (address) do nothing;
end;
$$;

-- 7) Settlement: Transfer Logic
create or replace function public.apply_ledger_event_transfer(
  p_event_hash text,
  p_payload jsonb,
  p_signature text,
  p_public_key text,
  p_from_address text,
  p_to_address text,
  p_amount_atom numeric(78,0),
  p_nonce bigint,
  p_prev_event_hash text
)
returns table (
  event_id bigint,
  new_from_balance numeric(78,0),
  new_from_nonce bigint,
  new_from_last_event_hash text,
  new_to_balance numeric(78,0)
)
language plpgsql
as $$
declare
  v_from_balance numeric(78,0);
  v_from_nonce bigint;
  v_from_last text;
begin
  perform public.ensure_vault_row(p_from_address);
  perform public.ensure_vault_row(p_to_address);

  select balance_atom, nonce, last_event_hash
    into v_from_balance, v_from_nonce, v_from_last
  from public.aura_vault
  where address = p_from_address
  for update;

  if v_from_nonce <> p_nonce then
    raise exception 'NONCE_MISMATCH expected=% got=%', v_from_nonce, p_nonce;
  end if;

  if v_from_last <> p_prev_event_hash then
    raise exception 'PREV_HASH_MISMATCH expected=% got=%', v_from_last, p_prev_event_hash;
  end if;

  if v_from_balance < p_amount_atom then
    raise exception 'INSUFFICIENT_FUNDS balance=% amount=%', v_from_balance, p_amount_atom;
  end if;

  insert into public.ledger_events(
    event_type, from_address, to_address, amount_atom, from_nonce, prev_event_hash,
    event_hash, payload, signature, public_key
  ) values (
    'transfer', p_from_address, p_to_address, p_amount_atom, p_nonce, p_prev_event_hash,
    p_event_hash, p_payload, p_signature, p_public_key
  )
  returning id into event_id;

  update public.aura_vault
  set balance_atom = balance_atom - p_amount_atom,
      nonce = nonce + 1,
      last_event_hash = p_event_hash,
      updated_at = now()
  where address = p_from_address;

  update public.aura_vault
  set balance_atom = balance_atom + p_amount_atom,
      updated_at = now()
  where address = p_to_address;

  return query
  select v.balance_atom, v.nonce, v.last_event_hash, r.balance_atom as to_bal
  from public.aura_vault v, public.aura_vault r
  where v.address = p_from_address and r.address = p_to_address;
end;
$$;

-- 8) Settlement: Mint Logic
create or replace function public.apply_ledger_event_mint(
  p_event_hash text,
  p_payload jsonb,
  p_to_address text,
  p_amount_atom numeric(78,0),
  p_mint_day date
)
returns table(event_id bigint, new_to_balance numeric(78,0))
language plpgsql
as $$
begin
  perform public.ensure_vault_row(p_to_address);

  insert into public.minting_history(mint_day, event_hash)
  values (p_mint_day, p_event_hash);

  insert into public.ledger_events(
    event_type, from_address, to_address, amount_atom, from_nonce, prev_event_hash,
    event_hash, payload, signature, public_key
  ) values (
    'mint', null, p_to_address, p_amount_atom, null, null,
    p_event_hash, p_payload, null, null
  )
  returning id into event_id;

  update public.aura_vault
  set balance_atom = balance_atom + p_amount_atom,
      updated_at = now()
  where address = p_to_address;

  return query
  select id, balance_atom from public.aura_vault where address = p_to_address limit 1;
end;
$$;

-- 9) Daily Uptime Tracking (Heartbeats)
create table public.daily_uptime_logs (
  date_key date not null default current_date,
  address text not null references public.aura_accounts(address) on delete cascade,
  uptime_minutes int not null default 0,
  last_ping_at timestamptz not null default now(),
  primary key (date_key, address)
);

create index if not exists daily_uptime_date_idx on public.daily_uptime_logs (date_key);

-- 10) Distribution History (Eternity Pool Tracker)
create table public.daily_distribution_history (
  distribution_date date primary key default current_date,
  total_recipients int not null,
  total_shares int not null,
  transaction_hash text not null,
  distributed_at timestamptz not null default now()
);

-- 11) RPC Function for Heartbeat Increment
create or replace function public.heartbeat_increment(p_address text, p_day date, p_minutes integer) returns void as $$
begin
  loop
    -- try update
    update public.daily_uptime_logs set uptime_minutes = uptime_minutes + p_minutes, last_ping_at = now()
      where address = p_address and date_key = p_day;
    if found then
      return;
    end if;
    -- else insert, if conflicts loop tries update
    begin
      insert into public.daily_uptime_logs(address, date_key, uptime_minutes, last_ping_at)
      values (p_address, p_day, p_minutes, now());
      return;
    exception when unique_violation then
      -- do nothing, loop to update
    end;
  end loop;
end;
$$ language plpgsql;

commit;
