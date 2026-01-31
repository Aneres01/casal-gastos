-- CasalGastos (Web) - Supabase schema + RLS
create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Minha Casa',
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  family_id uuid not null references public.families(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  icon text not null default 'category',
  color bigint not null default 0xFF14B8A6,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  date date not null,
  category_id uuid not null references public.categories(id) on delete restrict,
  payment_method text not null default 'pix',
  description text not null default '',
  created_at timestamptz not null default now()
);

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;

create or replace function public.current_family_id()
returns uuid
language sql
stable
as $$
  select family_id from public.profiles where id = auth.uid()
$$;

create policy "profiles_select_own"
on public.profiles for select
using (id = auth.uid());

create policy "profiles_insert_own"
on public.profiles for insert
with check (id = auth.uid());

create policy "profiles_update_own"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

create policy "families_select_own"
on public.families for select
using (id = public.current_family_id());

create policy "families_insert_auth"
on public.families for insert
with check (auth.role() = 'authenticated');

create policy "categories_select_family"
on public.categories for select
using (family_id = public.current_family_id());

create policy "categories_insert_family"
on public.categories for insert
with check (family_id = public.current_family_id());

create policy "categories_update_family"
on public.categories for update
using (family_id = public.current_family_id())
with check (family_id = public.current_family_id());

create policy "categories_delete_family"
on public.categories for delete
using (family_id = public.current_family_id());

create policy "transactions_select_family"
on public.transactions for select
using (family_id = public.current_family_id());

create policy "transactions_insert_family"
on public.transactions for insert
with check (family_id = public.current_family_id() and created_by = auth.uid());

create policy "transactions_update_family"
on public.transactions for update
using (family_id = public.current_family_id());

create policy "transactions_delete_family"
on public.transactions for delete
using (family_id = public.current_family_id());
