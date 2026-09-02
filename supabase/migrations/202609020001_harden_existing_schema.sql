-- Security hardening for the existing Supabase project.
-- Generated from the audited production schema on 2026-09-02.
-- Review and test in a preview environment before applying to production.

begin;

-- Helper used by RLS policies. SECURITY DEFINER avoids recursive policy checks while
-- exposing only a boolean ownership decision.
create or replace function public.owns_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.restaurants r
    where r.id = p_restaurant_id
      and r.owner_id = auth.uid()
  );
$$;

revoke all on function public.owns_restaurant(uuid) from public;
grant execute on function public.owns_restaurant(uuid) to authenticated;

-- Enable RLS everywhere. Policies below are explicit and replace the duplicated
-- builder-generated policies found during the audit.
alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_addons enable row level security;
alter table public.combos enable row level security;
alter table public.combo_items enable row level security;
alter table public.business_hours enable row level security;
alter table public.delivery_settings enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.push_subscriptions enable row level security;

-- Remove every existing policy from the audited public tables so duplicated and
-- ineffective policies cannot survive this migration.
do $$
declare
  p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any (array[
        'restaurants','categories','products','product_addons','combos',
        'combo_items','business_hours','delivery_settings','delivery_zones',
        'orders','order_items','push_subscriptions'
      ])
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end
$$;

-- Public storefront reads.
create policy restaurants_public_read
  on public.restaurants for select
  to anon, authenticated
  using (true);

create policy categories_public_read
  on public.categories for select
  to anon, authenticated
  using (true);

create policy products_public_read
  on public.products for select
  to anon, authenticated
  using (true);

create policy product_addons_public_read
  on public.product_addons for select
  to anon, authenticated
  using (true);

create policy combos_public_read
  on public.combos for select
  to anon, authenticated
  using (true);

create policy combo_items_public_read
  on public.combo_items for select
  to anon, authenticated
  using (true);

create policy business_hours_public_read
  on public.business_hours for select
  to anon, authenticated
  using (true);

create policy delivery_settings_public_read
  on public.delivery_settings for select
  to anon, authenticated
  using (true);

create policy delivery_zones_public_read
  on public.delivery_zones for select
  to anon, authenticated
  using (true);

-- Restaurant owner administration.
create policy restaurants_owner_insert
  on public.restaurants for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy restaurants_owner_update
  on public.restaurants for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy restaurants_owner_delete
  on public.restaurants for delete
  to authenticated
  using (owner_id = auth.uid());

create policy categories_owner_write
  on public.categories for all
  to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy products_owner_write
  on public.products for all
  to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy product_addons_owner_write
  on public.product_addons for all
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and public.owns_restaurant(p.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = product_id
        and public.owns_restaurant(p.restaurant_id)
    )
  );

create policy combos_owner_write
  on public.combos for all
  to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

-- The audited schema currently models combo_items.combo_id -> products.id.
create policy combo_items_owner_write
  on public.combo_items for all
  to authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = combo_id
        and public.owns_restaurant(p.restaurant_id)
    )
  )
  with check (
    exists (
      select 1 from public.products p
      where p.id = combo_id
        and public.owns_restaurant(p.restaurant_id)
    )
  );

create policy business_hours_owner_write
  on public.business_hours for all
  to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy delivery_settings_owner_write
  on public.delivery_settings for all
  to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy delivery_zones_owner_write
  on public.delivery_zones for all
  to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy orders_owner_read
  on public.orders for select
  to authenticated
  using (public.owns_restaurant(restaurant_id));

create policy orders_owner_update
  on public.orders for update
  to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

create policy order_items_owner_read
  on public.order_items for select
  to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and public.owns_restaurant(o.restaurant_id)
    )
  );

-- Push tokens are managed by Edge Functions with the service role. Owners may read
-- and deactivate only their own devices from authenticated clients if needed.
create policy push_subscriptions_owner_read
  on public.push_subscriptions for select
  to authenticated
  using (public.owns_restaurant(restaurant_id));

create policy push_subscriptions_owner_update
  on public.push_subscriptions for update
  to authenticated
  using (public.owns_restaurant(restaurant_id))
  with check (public.owns_restaurant(restaurant_id));

-- Replace broad default grants with the minimum required by the REST API.
revoke all on all tables in schema public from anon, authenticated;

grant select on public.restaurants, public.categories, public.products,
  public.product_addons, public.combos, public.combo_items, public.business_hours,
  public.delivery_settings, public.delivery_zones
to anon, authenticated;

grant insert, update, delete on public.restaurants, public.categories,
  public.products, public.product_addons, public.combos, public.combo_items,
  public.business_hours, public.delivery_settings, public.delivery_zones
to authenticated;

grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;
grant select, update on public.push_subscriptions to authenticated;

-- Atomic checkout RPC. The browser supplies identifiers and quantities only.
-- Prices, availability, delivery fee, status and final total are resolved here.
create or replace function public.create_order(
  p_restaurant_id uuid,
  p_customer_name text,
  p_customer_phone text,
  p_address text,
  p_neighborhood text,
  p_payment_method text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_delivery public.delivery_settings%rowtype;
  v_item jsonb;
  v_product public.products%rowtype;
  v_product_id uuid;
  v_quantity integer;
  v_addon_ids uuid[];
  v_addon_count integer;
  v_addon_total numeric;
  v_addon_names text;
  v_delivery_fee numeric := 0;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_unit_price numeric;
  v_order_id uuid;
  v_normalized_items jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if nullif(btrim(p_customer_name), '') is null
     or char_length(btrim(p_customer_name)) > 120 then
    raise exception 'Invalid customer name';
  end if;

  if nullif(btrim(p_customer_phone), '') is null
     or char_length(btrim(p_customer_phone)) > 30 then
    raise exception 'Invalid customer phone';
  end if;

  if nullif(btrim(p_address), '') is null
     or char_length(btrim(p_address)) > 300 then
    raise exception 'Invalid address';
  end if;

  if p_payment_method not in ('cash', 'card', 'pix') then
    raise exception 'Invalid payment method';
  end if;

  if p_notes is not null and char_length(p_notes) > 1000 then
    raise exception 'Notes are too long';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 50 then
    raise exception 'Order must contain between 1 and 50 items';
  end if;

  select *
    into v_restaurant
  from public.restaurants
  where id = p_restaurant_id;

  if not found then
    raise exception 'Restaurant not found';
  end if;

  if coalesce(v_restaurant.is_open, false) is not true then
    raise exception 'Restaurant is closed';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then
      raise exception 'Invalid order item';
    end;

    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'Invalid item quantity';
    end if;

    select *
      into v_product
    from public.products
    where id = v_product_id
      and restaurant_id = p_restaurant_id
      and coalesce(available, false) = true;

    if not found then
      raise exception 'Product is unavailable';
    end if;

    begin
      select coalesce(array_agg(value::uuid), '{}'::uuid[])
        into v_addon_ids
      from jsonb_array_elements_text(coalesce(v_item -> 'addon_ids', '[]'::jsonb));
    exception when others then
      raise exception 'Invalid addon selection';
    end;

    select count(*), coalesce(sum(a.price), 0), coalesce(string_agg(a.name, ', ' order by a.name), '')
      into v_addon_count, v_addon_total, v_addon_names
    from public.product_addons a
    where a.product_id = v_product_id
      and coalesce(a.available, false) = true
      and a.id = any(v_addon_ids);

    if v_addon_count <> cardinality(v_addon_ids) then
      raise exception 'Addon is unavailable or does not belong to the product';
    end if;

    v_unit_price := v_product.price + v_addon_total;
    v_subtotal := v_subtotal + (v_unit_price * v_quantity);

    v_normalized_items := v_normalized_items || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'product_name',
          case when v_addon_names <> ''
            then v_product.name || ' (+ ' || v_addon_names || ')'
            else v_product.name
          end,
        'quantity', v_quantity,
        'unit_price', v_unit_price
      )
    );
  end loop;

  select *
    into v_delivery
  from public.delivery_settings
  where restaurant_id = p_restaurant_id;

  if found then
    if v_delivery.type = 'fixed' then
      v_delivery_fee := greatest(coalesce(v_delivery.fixed_fee, 0), 0);
    elsif v_delivery.type = 'by_neighborhood' then
      select greatest(z.fee, 0)
        into v_delivery_fee
      from public.delivery_zones z
      where z.restaurant_id = p_restaurant_id
        and coalesce(z.available, false) = true
        and lower(btrim(z.neighborhood)) = lower(btrim(coalesce(p_neighborhood, '')))
      limit 1;

      if not found then
        raise exception 'Delivery neighborhood is unavailable';
      end if;
    end if;
  end if;

  v_total := v_subtotal + v_delivery_fee;

  insert into public.orders (
    restaurant_id, customer_name, customer_phone, address, neighborhood,
    payment_method, status, total, delivery_fee, notes
  )
  values (
    p_restaurant_id, btrim(p_customer_name), btrim(p_customer_phone),
    btrim(p_address), nullif(btrim(p_neighborhood), ''), p_payment_method,
    'pending', v_total, v_delivery_fee, coalesce(p_notes, '')
  )
  returning id into v_order_id;

  insert into public.order_items (
    order_id, product_id, product_name, quantity, unit_price
  )
  select
    v_order_id,
    (item ->> 'product_id')::uuid,
    item ->> 'product_name',
    (item ->> 'quantity')::integer,
    (item ->> 'unit_price')::numeric
  from jsonb_array_elements(v_normalized_items) item;

  return jsonb_build_object(
    'order_id', v_order_id,
    'total', v_total,
    'delivery_fee', v_delivery_fee
  );
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.create_order(uuid, text, text, text, text, text, text, jsonb) to authenticated;

-- Storage bucket and object ownership policies. Existing files use
-- <restaurant-id>/<timestamp>.<extension>.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_public_read on storage.objects;
drop policy if exists product_images_owner_insert on storage.objects;
drop policy if exists product_images_owner_update on storage.objects;
drop policy if exists product_images_owner_delete on storage.objects;

create policy product_images_public_read
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy product_images_owner_insert
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
  );

create policy product_images_owner_update
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'product-images'
    and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
  );

create policy product_images_owner_delete
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and public.owns_restaurant(((storage.foldername(name))[1])::uuid)
  );

commit;
