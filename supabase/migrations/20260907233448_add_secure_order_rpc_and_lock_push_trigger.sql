-- Applied to production on 2026-09-07 after schema audit.
-- Adds a server-side checkout path without removing the legacy direct-insert path yet.

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
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if nullif(btrim(p_customer_name), '') is null or char_length(btrim(p_customer_name)) > 120 then raise exception 'Invalid customer name'; end if;
  if nullif(btrim(p_customer_phone), '') is null or char_length(btrim(p_customer_phone)) > 30 then raise exception 'Invalid customer phone'; end if;
  if nullif(btrim(p_address), '') is null or char_length(btrim(p_address)) > 300 then raise exception 'Invalid address'; end if;
  if p_payment_method not in ('cash','card','pix') then raise exception 'Invalid payment method'; end if;
  if p_notes is not null and char_length(p_notes) > 1000 then raise exception 'Notes are too long'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then raise exception 'Order must contain between 1 and 50 items'; end if;

  select * into v_restaurant from public.restaurants where id = p_restaurant_id;
  if not found then raise exception 'Restaurant not found'; end if;
  if coalesce(v_restaurant.is_open, false) is not true then raise exception 'Restaurant is closed'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_item ->> 'product_id')::uuid;
      v_quantity := (v_item ->> 'quantity')::integer;
    exception when others then raise exception 'Invalid order item'; end;
    if v_quantity < 1 or v_quantity > 99 then raise exception 'Invalid item quantity'; end if;

    select * into v_product from public.products
    where id = v_product_id and restaurant_id = p_restaurant_id and coalesce(available, false) = true;
    if not found then raise exception 'Product is unavailable'; end if;

    begin
      select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_addon_ids
      from jsonb_array_elements_text(coalesce(v_item -> 'addon_ids', '[]'::jsonb));
    exception when others then raise exception 'Invalid addon selection'; end;

    select count(*), coalesce(sum(a.price), 0), coalesce(string_agg(a.name, ', ' order by a.name), '')
    into v_addon_count, v_addon_total, v_addon_names
    from public.product_addons a
    where a.product_id = v_product_id and coalesce(a.available, false) = true and a.id = any(v_addon_ids);
    if v_addon_count <> cardinality(v_addon_ids) then raise exception 'Addon is unavailable or does not belong to the product'; end if;

    v_unit_price := v_product.price + v_addon_total;
    v_subtotal := v_subtotal + (v_unit_price * v_quantity);
    v_normalized_items := v_normalized_items || jsonb_build_array(jsonb_build_object(
      'product_id', v_product.id,
      'product_name', case when v_addon_names <> '' then v_product.name || ' (+ ' || v_addon_names || ')' else v_product.name end,
      'quantity', v_quantity,
      'unit_price', v_unit_price
    ));
  end loop;

  select * into v_delivery from public.delivery_settings where restaurant_id = p_restaurant_id;
  if found then
    if v_delivery.type = 'fixed' then
      v_delivery_fee := greatest(coalesce(v_delivery.fixed_fee, 0), 0);
    elsif v_delivery.type = 'by_neighborhood' then
      select greatest(z.fee, 0) into v_delivery_fee
      from public.delivery_zones z
      where z.restaurant_id = p_restaurant_id and coalesce(z.available, false) = true
        and lower(btrim(z.neighborhood)) = lower(btrim(coalesce(p_neighborhood, '')))
      limit 1;
      if not found then raise exception 'Delivery neighborhood is unavailable'; end if;
    end if;
  end if;

  v_total := v_subtotal + v_delivery_fee;
  insert into public.orders (restaurant_id, customer_name, customer_phone, address, neighborhood, payment_method, status, total, delivery_fee, notes)
  values (p_restaurant_id, btrim(p_customer_name), btrim(p_customer_phone), btrim(p_address), nullif(btrim(p_neighborhood), ''), p_payment_method, 'pending', v_total, v_delivery_fee, coalesce(p_notes, ''))
  returning id into v_order_id;

  insert into public.order_items (order_id, product_id, product_name, quantity, unit_price)
  select v_order_id, (item ->> 'product_id')::uuid, item ->> 'product_name', (item ->> 'quantity')::integer, (item ->> 'unit_price')::numeric
  from jsonb_array_elements(v_normalized_items) item;

  return jsonb_build_object('order_id', v_order_id, 'total', v_total, 'delivery_fee', v_delivery_fee);
end;
$$;

revoke all on function public.create_order(uuid, text, text, text, text, text, text, jsonb) from public, anon;
grant execute on function public.create_order(uuid, text, text, text, text, text, text, jsonb) to authenticated;

revoke execute on function public.notify_new_order_push() from public, anon, authenticated;
