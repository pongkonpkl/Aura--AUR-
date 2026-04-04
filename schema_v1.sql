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
declare
  v_last_ping timestamptz;
begin
  -- Anti-Sybil Rate Limiting: Prevent rapid pings (less than 45 seconds gap)
  select last_ping_at into v_last_ping from public.daily_uptime_logs where address = p_address and date_key = p_day;
  if v_last_ping is not null and now() - v_last_ping < interval '45 seconds' then
    return; -- Silent drop, user is pinging too fast
  end if;

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

-- 12) Referral System
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_address text not null,
  referred_address text not null unique, -- each address can only be referred once
  bonus_minutes integer not null default 60,
  created_at timestamptz not null default now()
);

create index if not exists idx_referrals_referrer on public.referrals(referrer_address);

-- 13) Anti-Sybil: Anomaly Detection View
-- Flags addresses with suspiciously high uptime (>1200 min/day = 20 hrs)
create or replace view public.suspicious_miners as
  select address, date_key, uptime_minutes
  from public.daily_uptime_logs
  where uptime_minutes > 1200;

-- 14) Anti-Sybil: Hard cap uptime at 1440 minutes per day
-- Add a check constraint to prevent impossible values
alter table public.daily_uptime_logs
  drop constraint if exists max_daily_uptime;

alter table public.daily_uptime_logs
  add constraint max_daily_uptime check (uptime_minutes <= 1440);

-- ================================================================
-- AURA L3 AI CONSTITUTION — GOVERNANCE SCHEMA
-- Karma = floor(total_uptime_minutes / 60) ← 1 hr online = 1 Karma
-- Mock Ledger on Supabase until Blockchain deployment
-- ================================================================

-- 15) Citizens
create table if not exists public.citizens (
  address text primary key,
  karma_score integer not null default 1,
  registered_at timestamptz not null default now()
);

-- 16) Proposals
create table if not exists public.proposals (
  id bigserial primary key,
  proposer_address text not null references public.citizens(address),
  title text not null,
  body text not null,
  deadline timestamptz not null,
  yes_votes integer not null default 0,
  no_votes integer not null default 0,
  abstain_votes integer not null default 0,
  status text not null default 'OPEN' check (status in ('OPEN','APPROVED','EXECUTED','REJECTED')),
  policy_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_proposals_status on public.proposals(status);

-- 17) Votes
create table if not exists public.votes (
  id bigserial primary key,
  proposal_id bigint not null references public.proposals(id),
  voter_address text not null references public.citizens(address),
  choice text not null check (choice in ('YES','NO','ABSTAIN')),
  weight integer not null default 1,
  voted_at timestamptz not null default now(),
  unique(proposal_id, voter_address) -- ห้ามโหวตซ้ำ
);

-- 18) RPC: Register Citizen + Sync Karma from Uptime
create or replace function public.register_citizen(p_address text) returns void as $$
declare
  v_karma integer;
begin
  -- คำนวณ karma จากชั่วโมงออนไลน์รวมทุกวัน (1 ชม. = 1 Karma)
  select coalesce(floor(sum(uptime_minutes) / 60), 1)::integer
    into v_karma
    from public.daily_uptime_logs
    where address = p_address;

  insert into public.citizens(address, karma_score)
    values (p_address, greatest(v_karma, 1))
    on conflict (address) do update
      set karma_score = greatest(v_karma, 1);
end;
$$ language plpgsql;

-- 19) RPC: Cast Vote (atomic — prevents double vote)
create or replace function public.cast_vote(
  p_proposal_id bigint,
  p_voter text,
  p_choice text
) returns void as $$
declare
  v_weight integer;
  v_deadline timestamptz;
  v_status text;
begin
  -- ตรวจสอบ Proposal
  select deadline, status into v_deadline, v_status from public.proposals where id = p_proposal_id;
  if v_deadline is null then raise exception 'Proposal not found'; end if;
  if v_status != 'OPEN' then raise exception 'Voting is closed'; end if;
  if now() > v_deadline then raise exception 'Deadline passed'; end if;

  -- ดึง Karma Weight
  select karma_score into v_weight from public.citizens where address = p_voter;
  if v_weight is null then raise exception 'Not a citizen'; end if;

  -- บันทึก Vote
  insert into public.votes(proposal_id, voter_address, choice, weight)
    values (p_proposal_id, p_voter, p_choice, v_weight);

  -- อัปเดตยอดโหวตใน Proposal
  if p_choice = 'YES' then
    update public.proposals set yes_votes = yes_votes + v_weight where id = p_proposal_id;
  elsif p_choice = 'NO' then
    update public.proposals set no_votes = no_votes + v_weight where id = p_proposal_id;
  else
    update public.proposals set abstain_votes = abstain_votes + v_weight where id = p_proposal_id;
  end if;
end;
$$ language plpgsql;

commit;
