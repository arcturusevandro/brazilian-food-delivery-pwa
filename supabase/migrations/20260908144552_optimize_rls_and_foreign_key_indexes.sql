create index if not exists combo_items_combo_id_idx
  on public.combo_items (combo_id);

create index if not exists combo_items_product_id_idx
  on public.combo_items (product_id);

create index if not exists delivery_zones_restaurant_id_idx
  on public.delivery_zones (restaurant_id);

create index if not exists order_items_product_id_idx
  on public.order_items (product_id);

create index if not exists product_addons_product_id_idx
  on public.product_addons (product_id);

create index if not exists restaurants_owner_id_idx
  on public.restaurants (owner_id);

drop policy if exists "Dono le itens" on public.order_items;
create policy "order_items_owner_read"
  on public.order_items
  for select
  to authenticated
  using (
    order_id in (
      select o.id
      from public.orders o
      join public.restaurants r on r.id = o.restaurant_id
      where r.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Dono atualiza status pedido" on public.orders;
create policy "orders_owner_update"
  on public.orders
  for update
  to authenticated
  using (
    restaurant_id in (
      select r.id
      from public.restaurants r
      where r.owner_id = (select auth.uid())
    )
  )
  with check (
    restaurant_id in (
      select r.id
      from public.restaurants r
      where r.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Dono le e atualiza pedidos" on public.orders;
create policy "orders_owner_read"
  on public.orders
  for select
  to authenticated
  using (
    restaurant_id in (
      select r.id
      from public.restaurants r
      where r.owner_id = (select auth.uid())
    )
  );
