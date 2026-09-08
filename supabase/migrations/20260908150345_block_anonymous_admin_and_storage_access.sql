
drop policy if exists "business_hours_owner_write" on public.business_hours;
create policy "business_hours_owner_insert" on public.business_hours
  for insert to authenticated
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));
create policy "business_hours_owner_update" on public.business_hours
  for update to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id))
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));
create policy "business_hours_owner_delete" on public.business_hours
  for delete to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));

drop policy if exists "categories_owner_write" on public.categories;
create policy "categories_owner_insert" on public.categories
  for insert to authenticated
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));
create policy "categories_owner_update" on public.categories
  for update to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id))
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));
create policy "categories_owner_delete" on public.categories
  for delete to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));

drop policy if exists "combos_owner_write" on public.combos;
create policy "combos_owner_insert" on public.combos
  for insert to authenticated
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));
create policy "combos_owner_update" on public.combos
  for update to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id))
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));
create policy "combos_owner_delete" on public.combos
  for delete to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));

drop policy if exists "delivery_settings_owner_write" on public.delivery_settings;
create policy "delivery_settings_owner_insert" on public.delivery_settings
  for insert to authenticated
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));
create policy "delivery_settings_owner_update" on public.delivery_settings
  for update to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id))
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));
create policy "delivery_settings_owner_delete" on public.delivery_settings
  for delete to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));

drop policy if exists "delivery_zones_owner_write" on public.delivery_zones;
create policy "delivery_zones_owner_insert" on public.delivery_zones
  for insert to authenticated
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));
create policy "delivery_zones_owner_update" on public.delivery_zones
  for update to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id))
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));
create policy "delivery_zones_owner_delete" on public.delivery_zones
  for delete to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));

drop policy if exists "products_owner_write" on public.products;
create policy "products_owner_insert" on public.products
  for insert to authenticated
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));
create policy "products_owner_update" on public.products
  for update to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id))
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));
create policy "products_owner_delete" on public.products
  for delete to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));

drop policy if exists "combo_items_owner_write" on public.combo_items;
create policy "combo_items_owner_insert" on public.combo_items
  for insert to authenticated
  with check (
    (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and exists (
      select 1 from public.products p
      where p.id = combo_items.combo_id and owns_restaurant(p.restaurant_id)
    )
  );
create policy "combo_items_owner_update" on public.combo_items
  for update to authenticated
  using (
    (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and exists (
      select 1 from public.products p
      where p.id = combo_items.combo_id and owns_restaurant(p.restaurant_id)
    )
  )
  with check (
    (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and exists (
      select 1 from public.products p
      where p.id = combo_items.combo_id and owns_restaurant(p.restaurant_id)
    )
  );
create policy "combo_items_owner_delete" on public.combo_items
  for delete to authenticated
  using (
    (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and exists (
      select 1 from public.products p
      where p.id = combo_items.combo_id and owns_restaurant(p.restaurant_id)
    )
  );

drop policy if exists "product_addons_owner_write" on public.product_addons;
create policy "product_addons_owner_insert" on public.product_addons
  for insert to authenticated
  with check (
    (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and exists (
      select 1 from public.products p
      where p.id = product_addons.product_id and owns_restaurant(p.restaurant_id)
    )
  );
create policy "product_addons_owner_update" on public.product_addons
  for update to authenticated
  using (
    (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and exists (
      select 1 from public.products p
      where p.id = product_addons.product_id and owns_restaurant(p.restaurant_id)
    )
  )
  with check (
    (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and exists (
      select 1 from public.products p
      where p.id = product_addons.product_id and owns_restaurant(p.restaurant_id)
    )
  );
create policy "product_addons_owner_delete" on public.product_addons
  for delete to authenticated
  using (
    (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and exists (
      select 1 from public.products p
      where p.id = product_addons.product_id and owns_restaurant(p.restaurant_id)
    )
  );

drop policy if exists "restaurants_owner_insert" on public.restaurants;
create policy "restaurants_owner_insert" on public.restaurants
  for insert to authenticated
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owner_id = (select auth.uid()));

drop policy if exists "restaurants_owner_update" on public.restaurants;
create policy "restaurants_owner_update" on public.restaurants
  for update to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owner_id = (select auth.uid()))
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owner_id = (select auth.uid()));

drop policy if exists "restaurants_owner_delete" on public.restaurants;
create policy "restaurants_owner_delete" on public.restaurants
  for delete to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owner_id = (select auth.uid()));

drop policy if exists "orders_owner_read" on public.orders;
create policy "orders_owner_read" on public.orders
  for select to authenticated
  using (
    (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and restaurant_id in (
      select r.id from public.restaurants r
      where r.owner_id = (select auth.uid())
    )
  );

drop policy if exists "orders_owner_update" on public.orders;
create policy "orders_owner_update" on public.orders
  for update to authenticated
  using (
    (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and restaurant_id in (
      select r.id from public.restaurants r
      where r.owner_id = (select auth.uid())
    )
  )
  with check (
    (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and restaurant_id in (
      select r.id from public.restaurants r
      where r.owner_id = (select auth.uid())
    )
  );

drop policy if exists "order_items_owner_read" on public.order_items;
create policy "order_items_owner_read" on public.order_items
  for select to authenticated
  using (
    (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and order_id in (
      select o.id
      from public.orders o
      join public.restaurants r on r.id = o.restaurant_id
      where r.owner_id = (select auth.uid())
    )
  );

drop policy if exists "push_subscriptions_owner_read" on public.push_subscriptions;
create policy "push_subscriptions_owner_read" on public.push_subscriptions
  for select to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));

drop policy if exists "push_subscriptions_owner_update" on public.push_subscriptions;
create policy "push_subscriptions_owner_update" on public.push_subscriptions
  for update to authenticated
  using ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id))
  with check ((select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false and owns_restaurant(restaurant_id));

drop policy if exists "Autenticado pode fazer upload" on storage.objects;
create policy "Permanent owner can upload product images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and exists (
      select 1 from public.restaurants r
      where r.owner_id = (select auth.uid())
    )
  );

drop policy if exists "Autenticado pode deletar" on storage.objects;
create policy "Permanent owner can delete product images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (select coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)) is false
    and exists (
      select 1 from public.restaurants r
      where r.owner_id = (select auth.uid())
    )
  );
