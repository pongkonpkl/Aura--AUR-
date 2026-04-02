-- ========================================================
-- INFRASTRUCTURE: Aura Blockchain (Hardened Schema)
-- ========================================================

create extension if not exists pgcrypto;

-- 1. Types
do $$ begin 
  if not exists (select 1 from pg_type where typname = 'ledger_event_type') then 
    create type public.ledger_event_type as enum ('mint', 'transfer'); 
  end if;
end $$;

-- 2. Tables
create table if not exists public.aura_accounts (
  address text primary key,
  public_key text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.aura_vault (
  address text primary key references public.aura_accounts(address) on delete restrict,
  balance_atom numeric(78,0) not null default 0,
  nonce bigint not null default 0,
  last_out_event_hash text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_events (
  event_id uuid primary key default gen_random_uuid(),
  event_type public.ledger_event_type not null,
  from_address text,
  to_address text not null,
  amount_atom numeric(78,0) not null check (amount_atom > 0),
  from_nonce bigint,
  prev_event_hash text not null default '',
  event_hash text not null unique,
  public_key text, 
  signature text, 
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.minting_history (
  mint_date date primary key,
  event_id uuid not null references public.ledger_events(event_id),
  minted_atom numeric(78,0) not null,
  created_at timestamptz not null default now()
);

-- 3. Security: RLS Policies
alter table public.aura_accounts enable row level security;
alter table public.aura_vault enable row level security;
alter table public.ledger_events enable row level security;
alter table public.minting_history enable row level security;

grant select on all tables in schema public to anon, authenticated;

create policy "public_read_accounts" on public.aura_accounts for select to anon, authenticated using (true);
create policy "public_read_vault" on public.aura_vault for select to anon, authenticated using (true);
create policy "public_read_ledger" on public.ledger_events for select to anon, authenticated using (true);
create policy "public_read_history" on public.minting_history for select to anon, authenticated using (true);

-- 4. Append-only enforcement (No update/delete)
create or replace function public.prevent_modification() returns trigger language plpgsql as $$
begin raise exception 'Immutable: Modification of ledger is strictly prohibited.'; end $$;

create trigger trg_no_update_ledger before update or delete on public.ledger_events for each row execute function public.prevent_modification();
create trigger trg_no_update_history before update or delete on public.minting_history for each row execute function public.prevent_modification();

-- 5. Helper: Compute Canonical Hash
create or replace function public.compute_event_hash( 
  p_event_type text, p_from_addr text, p_to_addr text, p_amount numeric, p_nonce bigint, p_prev_hash text, p_payload jsonb
) returns text language sql immutable set search_path = public as $$ 
  select encode(digest(coalesce(p_event_type,'') || '|' || coalesce(p_from_addr,'') || '|' || coalesce(p_to_addr,'') || '|' || coalesce(p_amount::text,'0') || '|' || coalesce(p_nonce::text,'') || '|' || coalesce(p_prev_hash,'') || '|' || coalesce(p_payload::text,'{}'), 'sha256'), 'hex');
$$;

-- 6. RPC: Register Account (Atomic)
create or replace function public.register_account(p_address text, p_public_key text) 
returns void language plpgsql security definer set search_path = public as $$
begin 
  insert into public.aura_accounts(address, public_key) values (p_address, p_public_key) on conflict (address) do nothing;
  insert into public.aura_vault(address) values (p_address) on conflict (address) do nothing;
end $$;
