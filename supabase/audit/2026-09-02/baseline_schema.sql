-- Reproducible baseline captured from project tnmxsmllorijtomwqxmp.
-- This file creates the audited schema for a fresh Supabase project.
-- Security policies and checkout hardening are applied by the next migration.

create extension if not exists pgcrypto;
create extension if not exists "uuid-ossp";
create extension if not exists pg_net;
create extension if not exists supabase_vault;

create table if not exists public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references auth.users(id),
  logo_url text,
  phone text,
  address text,
  is_open boolean default true,
  created_at timestamptz default now(),
  manual_override boolean default false
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  description text default '',
  price numeric not null,
  photo_url text,
  available boolean default true,
  created_at timestamptz default now(),
  is_combo boolean default false
);

create table if not exists public.product_addons (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  price numeric not null default 0,
  available boolean default true
);

create table if not exists public.combos (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text default '',
  price numeric not null,
  product_ids jsonb default '[]'::jsonb,
  available boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.combo_items (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.products(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  quantity integer not null default 1
);

create table if not exists public.business_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  day_of_week integer not null check (day_of_week >= 0 and day_of_week <= 6),
  open_time time not null default '18:00:00',
  close_time time not null default '23:00:00',
  is_active boolean default true,
  open_time_2 time,
  close_time_2 time,
  unique (restaurant_id, day_of_week)
);

create table if not exists public.delivery_settings (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null unique references public.restaurants(id) on delete cascade,
  type text not null default 'free'
    check (type = any (array['free'::text, 'fixed'::text, 'by_neighborhood'::text])),
  fixed_fee numeric default 0,
  updated_at timestamptz default now()
);

create table if not exists public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  neighborhood text not null,
  fee numeric not null default 0,
  available boolean default true
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  customer_name text not null,
  customer_phone text not null,
  address text not null,
  payment_method text not null,
  status text not null default 'pending'
    check (status = any (array[
      'pending'::text, 'preparing'::text, 'out_for_delivery'::text,
      'delivered'::text, 'cancelled'::text
    ])),
  total numeric not null,
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  delivery_fee numeric not null default 0,
  neighborhood text
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_name text not null,
  quantity integer not null default 1,
  unit_price numeric not null,
  created_at timestamptz default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  token text not null unique,
  device_name text,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_categories_restaurant
  on public.categories (restaurant_id);
create index if not exists idx_products_category
  on public.products (category_id);
create index if not exists idx_products_restaurant
  on public.products (restaurant_id);
create index if not exists idx_combos_restaurant
  on public.combos (restaurant_id);
create index if not exists idx_orders_created
  on public.orders (created_at desc);
create index if not exists idx_orders_restaurant
  on public.orders (restaurant_id);
create index if not exists idx_orders_status
  on public.orders (status);
create index if not exists idx_order_items_order
  on public.order_items (order_id);
create index if not exists push_subscriptions_active_idx
  on public.push_subscriptions (restaurant_id, is_active);
create index if not exists push_subscriptions_restaurant_id_idx
  on public.push_subscriptions (restaurant_id);

create or replace function public.notify_new_order_push()
returns trigger
language plpgsql
security definer
set search_path = 'public', 'vault', 'net'
as $$
declare
  webhook_secret text;
begin
  select decrypted_secret
    into webhook_secret
  from vault.decrypted_secrets
  where name = 'ORDER_PUSH_WEBHOOK_SECRET'
  limit 1;

  if webhook_secret is null then
    raise warning 'ORDER_PUSH_WEBHOOK_SECRET not found in Vault';
    return new;
  end if;

  perform net.http_post(
    url := 'https://tnmxsmllorijtomwqxmp.supabase.co/functions/v1/send-order-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'orders',
      'schema', 'public',
      'record', to_jsonb(new),
      'old_record', null
    ),
    timeout_milliseconds := 5000
  );

  return new;
end;
$$;

drop trigger if exists "new-order-push" on public.orders;
create trigger "new-order-push"
after insert on public.orders
for each row execute function public.notify_new_order_push();
