begin;

-- =========================================================
-- 1) APPEND-ONLY LEDGER (audit trail)
-- =========================================================
create table if not exists public.aura_ledger (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  event_type text not null, -- 'MINT' | 'DISTRIBUTE' | 'BURN'
  from_address text,
  to_address text,
  amount_atom numeric(78,0) not null check (amount_atom >= 0),
  meta jsonb not null default '{}'::jsonb
);

revoke update, delete on public.aura_ledger from public;
revoke update, delete on public.aura_ledger from anon, authenticated;

create index if not exists aura_ledger_created_at_idx on public.aura_ledger (created_at desc);
create index if not exists aura_ledger_to_idx on public.aura_ledger (to_address);
create index if not exists aura_ledger_from_idx on public.aura_ledger (from_address);

-- =========================================================
-- 2) PoP: ONLINE SESSIONS + HEARTBEAT
-- =========================================================
create table if not exists public.online_sessions (
  address text primary key,
  total_minutes_today int not null default 0 check (total_minutes_today >= 0),
  last_ping timestamptz not null default now()
);

create or replace function public.send_heartbeat(p_address text)
returns void language plpgsql security definer set search_path = public as $$
declare v_now timestamptz := now();
begin
  if p_address is null or length(trim(p_address)) = 0 then raise exception 'p_address is required'; end if;
  insert into public.online_sessions(address, total_minutes_today, last_ping)
  values (p_address, 1, v_now)
  on conflict (address) do update set
    total_minutes_today = case 
      when (v_now - public.online_sessions.last_ping) >= interval '45 seconds' 
      then least(public.online_sessions.total_minutes_today + 1, 1440)
      else public.online_sessions.total_minutes_today 
    end,
    last_ping = v_now;
end;$$;

-- =========================================================
-- 3) AI GUARDIAN: HARD-CODED (Updated with your keys)
-- =========================================================
create or replace function public.get_ai_guardian_address() returns text language sql immutable as $$
  select 'HKikDWUm4uM8Fi1ji3P6PuZJTH8rXGiBuKnaRshfhdsW';
$$;

create or replace function public.get_ai_guardian_public_key() returns text language sql immutable as $$
  select '031e1484bfcef69929dc97bfa1cb5a4703fc382340acaaff3d9d51a9de473ec73c';
$$;

-- =========================================================
-- 4) DAILY MINT LOCK
-- =========================================================
create table if not exists public.mint_daily_lock (
  mint_day date primary key,
  minted_at timestamptz not null default now()
);

-- =========================================================
-- 5) MINT DAILY LOGIC (1 AUR/day, 90/10 split)
-- =========================================================
create or replace function public.mint_daily_aura()
returns void language plpgsql security definer set search_path = public as $$
declare 
  v_day date := (now() at time zone 'utc')::date;
  DAILY_MINT_ATOM constant numeric(78,0) := 1000000000000000000; -- 1 AUR
  CITIZEN_POT_ATOM constant numeric(78,0) := floor(DAILY_MINT_ATOM * 0.90);
  AI_SHARE_ATOM constant numeric(78,0) := DAILY_MINT_ATOM - CITIZEN_POT_ATOM;
  v_total_min numeric;
  v_ai_addr text := public.get_ai_guardian_address();
  v_ai_pk text := public.get_ai_guardian_public_key();
begin
  insert into public.mint_daily_lock(mint_day) values (v_day);
  
  -- Auto-register AI Account
  insert into public.aura_accounts(address, public_key) 
  values (v_ai_addr, v_ai_pk) on conflict (address) do nothing;
  
  insert into public.aura_vault(address, balance_atom) 
  values (v_ai_addr, 0) on conflict (address) do nothing;

  -- Ledger: MINT
  insert into public.aura_ledger(event_type, from_address, to_address, amount_atom, meta)
  values ('MINT', null, null, DAILY_MINT_ATOM, jsonb_build_object('day_utc',v_day));

  -- Pay AI 10%
  update public.aura_vault set balance_atom = balance_atom + AI_SHARE_ATOM where address = v_ai_addr;
  insert into public.aura_ledger(event_type, from_address, to_address, amount_atom, meta)
  values ('DISTRIBUTE', null, v_ai_addr, AI_SHARE_ATOM, jsonb_build_object('target','AI_GUARDIAN'));

  -- Distribute Citizens Pot
  select coalesce(sum(total_minutes_today), 0)::numeric into v_total_min from public.online_sessions where address <> v_ai_addr;
  
  if v_total_min > 0 then
    insert into public.aura_vault(address, balance_atom)
    select s.address, 0 from public.online_sessions s where s.total_minutes_today > 0 and s.address <> v_ai_addr on conflict (address) do nothing;

    update public.aura_vault v set balance_atom = v.balance_atom + floor((CITIZEN_POT_ATOM * s.total_minutes_today::numeric) / v_total_min)
    from public.online_sessions s where v.address = s.address and s.total_minutes_today > 0 and s.address <> v_ai_addr;
    
    insert into public.aura_ledger(event_type, from_address, to_address, amount_atom, meta)
    values ('DISTRIBUTE', null, null, CITIZEN_POT_ATOM, jsonb_build_object('target','CITIZENS','total_min',v_total_min));
  else
    insert into public.aura_ledger(event_type, from_address, to_address, amount_atom, meta)
    values ('BURN', null, null, CITIZEN_POT_ATOM, jsonb_build_object('reason','NO_USERS_ONLINE'));
  end if;

  update public.online_sessions set total_minutes_today = 0;
exception when unique_violation then return;
end;$$;

-- =========================================================
-- 6) TRANSFER BURN 1% WRAPPER
-- =========================================================
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname='public' and p.proname='apply_transfer_v1') then
    execute 'alter function public.apply_transfer(text,text,numeric,bigint,text,text,text,jsonb) rename to apply_transfer_v1';
  end if;
end $$;

create or replace function public.apply_transfer(
  p_from_address text, p_to_address text, p_amount_atom numeric, p_from_nonce bigint,
  p_prev_event_hash text, p_public_key text, p_signature text, p_payload jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_burn_atom numeric; v_net_atom numeric; v_event_id uuid;
begin
  v_burn_atom := floor(p_amount_atom * 0.01);
  v_net_atom := p_amount_atom - v_burn_atom;
  
  v_event_id := public.apply_transfer_v1(p_from_address, p_to_address, v_net_atom, p_from_nonce, p_prev_event_hash, p_public_key, p_signature, coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('burn_1pct', v_burn_atom));

  if v_burn_atom > 0 then
    insert into public.aura_ledger(event_type, from_address, to_address, amount_atom, meta)
    values ('BURN', p_from_address, null, v_burn_atom, jsonb_build_object('reason','TRANSFER_BURN','linked_event',v_event_id));
  end if;
  return v_event_id;
end;$$;

commit;
