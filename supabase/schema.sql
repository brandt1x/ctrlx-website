-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- Creates the purchases table and RLS policies

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null unique,
  items jsonb not null,
  created_at timestamptz default now()
);

create index if not exists idx_purchases_user on public.purchases(user_id);
create index if not exists idx_purchases_session on public.purchases(session_id);

-- RLS: users can only read their own purchases
alter table public.purchases enable row level security;

create policy "Users can read own purchases"
  on public.purchases for select
  using (auth.uid() = user_id);

-- Inserts are done by the webhook using service_role key (bypasses RLS).
