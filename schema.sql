create extension if not exists pgcrypto;

-- ======================
-- Types
-- ======================
do $$ 
begin 
  if not exists (select 1 from pg_type where typname = 'ledger_event_type') then 
    create type public.ledger_event_type as enum ('mint', 'transfer'); 
  end if;
end $$;

-- ======================
-- Accounts (address <-> public_key)
-- address = Base58(SHA256(public_key_bytes)) computed in Edge/Client tooling
-- ======================
create table if not exists public.aura_accounts (
  address text primary key,
  public_key text unique not null,
  created_at timestamptz not null default now()
);

-- ======================
-- Vault (state cache)
-- balance in atom (1 AUR = 10^18 atom)
-- nonce applies to outgoing transfers only
-- last_out_event_hash is the replay-protection anchor for outgoing txs
-- updated_at for convenience
-- ======================
create table if not exists public.aura_vault (
  address text primary key references public.aura_accounts(address) on delete restrict,
  balance_atom numeric(78,0) not null default 0,
  nonce bigint not null default 0,
  last_out_event_hash text not null default '',
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin 
  new.updated_at = now(); 
  return new;
end $$;

drop trigger if exists trg_aura_vault_updated_at on public.aura_vault;
create trigger trg_aura_vault_updated_at
before update on public.aura_vault
for each row execute function public.set_updated_at();

-- ======================
-- Ledger events (append-only truth)
-- ======================
create table if not exists public.ledger_events (
  event_id uuid primary key default gen_random_uuid(),
  event_type public.ledger_event_type not null,
  from_address text,
  to_address text not null,
  amount_atom numeric(78,0) not null check (amount_atom > 0),
  -- For transfers: sender nonce & sender anchor 
  from_nonce bigint,
  prev_event_hash text not null default '',
  event_hash text not null unique,
  public_key text, -- signer public key for transfers; 'SYSTEM' for mint 
  signature text, -- signature (verified in Edge Function) 
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ledger_events_from_idx on public.ledger_events(from_address);
create index if not exists ledger_events_to_idx on public.ledger_events(to_address);
create index if not exists ledger_events_created_idx on public.ledger_events(created_at);

-- Append-only enforcement
create or replace function public.prevent_update_delete()
returns trigger language plpgsql as $$
begin 
  raise exception 'Append-only table: updates/deletes are not allowed';
end $$;

drop trigger if exists trg_ledger_events_no_update on public.ledger_events;
create trigger trg_ledger_events_no_update
before update or delete on public.ledger_events
for each row execute function public.prevent_update_delete();

-- ======================
-- Mint history (prevent double-mint per day)
-- ======================
create table if not exists public.minting_history (
  mint_date date primary key,
  event_id uuid not null references public.ledger_events(event_id),
  minted_atom numeric(78,0) not null,
  created_at timestamptz not null default now()
);

drop trigger if exists trg_minting_history_no_update on public.minting_history;
create trigger trg_minting_history_no_update
before update or delete on public.minting_history
for each row execute function public.prevent_update_delete();

-- ======================
-- Hash helper
-- IMPORTANT: must match server canonicalization for audit; signature verification is outside DB.
-- ======================
create or replace function public.compute_event_hash( 
  p_event_type public.ledger_event_type, 
  p_from_address text, 
  p_to_address text, 
  p_amount_atom numeric, 
  p_from_nonce bigint, 
  p_prev_event_hash text, 
  p_payload jsonb
) returns text
language sql immutable as $$ 
  select encode( 
    digest( 
      coalesce(p_event_type::text,'') || '|' || 
      coalesce(p_from_address,'') || '|' || 
      coalesce(p_to_address,'') || '|' || 
      coalesce(p_amount_atom::text,'0') || '|' || 
      coalesce(p_from_nonce::text,'') || '|' || 
      coalesce(p_prev_event_hash,'') || '|' || 
      coalesce(p_payload::text,'{}'), 
      'sha256' 
    ), 
    'hex' 
  );
$$;

-- ======================
-- Debug helper: show today's UTC date (to avoid confusion)
-- ======================
create or replace function public.utc_today()
returns date
language sql stable
as $$ 
  select (now() at time zone 'utc')::date;
$$;

-- ======================
-- Register account (create account+vault)
-- Use via Edge Function with service role.
-- Hardened: public_key is immutable once set (prevents account takeover)
-- ======================
create or replace function public.register_account( 
  p_address text, 
  p_public_key text
) returns void
language plpgsql
security definer
as $$
declare 
  v_existing_pub text;
begin 
  select public_key into v_existing_pub from public.aura_accounts where address = p_address; 
  if v_existing_pub is null then 
    insert into public.aura_accounts(address, public_key) values (p_address, p_public_key); 
  else 
    if v_existing_pub <> p_public_key then 
      raise exception 'public_key is immutable for address %', p_address; 
    end if; 
  -- else: same key => ok 
  end if; 
  insert into public.aura_vault(address) values (p_address) on conflict (address) do nothing;
end $$;

-- ======================
-- Atomic transfer apply (nonce + prev hash enforce)
-- Signature must be verified BEFORE calling this function.
-- Locks BOTH sender & receiver rows in a stable order to avoid races.
-- ======================
create or replace function public.apply_transfer( 
  p_from_address text, 
  p_to_address text, 
  p_amount_atom numeric(78,0), 
  p_from_nonce bigint, 
  p_prev_event_hash text, 
  p_public_key text, 
  p_signature text, 
  p_payload jsonb
) returns uuid
language plpgsql
security definer
as $$
declare 
  v_event_hash text; 
  v_event_id uuid; 
  v_from_balance numeric(78,0); 
  v_addr1 text; 
  v_addr2 text;
begin 
  if p_amount_atom <= 0 then 
    raise exception 'amount_atom must be > 0'; 
  end if; 
  if p_from_address = p_to_address then 
    raise exception 'from_address and to_address must be different'; 
  end if; 
  -- Both must exist / be registered 
  if not exists (select 1 from public.aura_accounts where address = p_from_address) then 
    raise exception 'sender not registered'; 
  end if; 
  if not exists (select 1 from public.aura_accounts where address = p_to_address) then 
    raise exception 'receiver not registered'; 
  end if; 
  -- Stable locking order to prevent deadlocks 
  v_addr1 := least(p_from_address, p_to_address); 
  v_addr2 := greatest(p_from_address, p_to_address); 
  perform 1 from public.aura_vault where address = v_addr1 for update; 
  perform 1 from public.aura_vault where address = v_addr2 for update; 
  -- Sender balance (locked) 
  select balance_atom into v_from_balance from public.aura_vault where address = p_from_address; 
  if v_from_balance is null then 
    raise exception 'sender vault not found'; 
  end if; 
  -- Enforce outgoing nonce and outgoing hash anchor 
  if not exists ( 
    select 1 from public.aura_vault 
    where address = p_from_address 
    and nonce = p_from_nonce 
    and last_out_event_hash = p_prev_event_hash 
  ) then 
    raise exception 'invalid nonce or prev_event_hash'; 
  end if; 
  if v_from_balance < p_amount_atom then 
    raise exception 'insufficient funds'; 
  end if; 
  v_event_hash := public.compute_event_hash( 
    'transfer', p_from_address, p_to_address, p_amount_atom, p_from_nonce, p_prev_event_hash, p_payload 
  ); 
  insert into public.ledger_events( 
    event_type, from_address, to_address, amount_atom, from_nonce, prev_event_hash, event_hash, public_key, signature, payload 
  ) values ( 
    'transfer', p_from_address, p_to_address, p_amount_atom, p_from_nonce, p_prev_event_hash, v_event_hash, p_public_key, p_signature, coalesce(p_payload,'{}'::jsonb) 
  ) returning event_id into v_event_id; 
  -- Apply state updates 
  update public.aura_vault 
  set balance_atom = balance_atom - p_amount_atom, 
      nonce = nonce + 1, 
      last_out_event_hash = v_event_hash 
  where address = p_from_address; 
  update public.aura_vault 
  set balance_atom = balance_atom + p_amount_atom 
  where address = p_to_address; 
  return v_event_id;
end $$;

-- ======================
-- Daily mint: 1 AUR/day (10^18 atom) into Aura_Common_Pool
-- Mint is system event; does NOT affect any account's nonce/last_out_event_hash
-- ======================
create or replace function public.mint_daily_aura( 
  p_pool_address text
) returns uuid
language plpgsql
security definer
as $$
declare 
  v_today date := (now() at time zone 'utc')::date; 
  v_event_hash text; 
  v_event_id uuid; 
  v_amount numeric(78,0) := 1000000000000000000; -- 1 AUR in atom
begin 
  -- Prevent double mint (PK also enforces) 
  if exists (select 1 from public.minting_history where mint_date = v_today) then 
    raise exception 'already minted for %', v_today; 
  end if; 
  if not exists (select 1 from public.aura_accounts where address = p_pool_address) then 
    raise exception 'pool address not registered'; 
  end if; 
  -- Lock pool vault row to serialize balance updates 
  perform 1 from public.aura_vault where address = p_pool_address for update; 
  
  v_event_hash := public.compute_event_hash( 
    'mint', null, p_pool_address, v_amount, null, '', 
    jsonb_build_object('reason','daily_mint','mint_date',v_today::text) 
  ); 
  
  insert into public.ledger_events( 
    event_type, from_address, to_address, amount_atom, from_nonce, prev_event_hash, event_hash, public_key, signature, payload 
  ) values ( 
    'mint', null, p_pool_address, v_amount, null, '', v_event_hash, 'SYSTEM', 'SYSTEM', 
    jsonb_build_object('reason','daily_mint','mint_date',v_today::text) 
  ) returning event_id into v_event_id;
  
  -- Record in history
  insert into public.minting_history(mint_date, event_id, minted_atom)
  values (v_today, v_event_id, v_amount);
  
  -- Apply state updates
  update public.aura_vault 
  set balance_atom = balance_atom + v_amount 
  where address = p_pool_address;
  
  return v_event_id;
end $$;
