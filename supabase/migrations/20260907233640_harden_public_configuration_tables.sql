-- Applied to production on 2026-09-07.
-- Intentionally excludes orders/order_items until storefront checkout switches to create_order RPC.

create or replace function public.owns_restaurant(p_restaurant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.restaurants r where r.id = p_restaurant_id and r.owner_id = auth.uid());
$$;
revoke all on function public.owns_restaurant(uuid) from public, anon;
grant execute on function public.owns_restaurant(uuid) to authenticated;

alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_addons enable row level security;
alter table public.combos enable row level security;
alter table public.combo_items enable row level security;
alter table public.business_hours enable row level security;
alter table public.delivery_settings enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.push_subscriptions enable row level security;

do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies
    where schemaname='public' and tablename = any(array['restaurants','categories','products','product_addons','combos','combo_items','business_hours','delivery_settings','delivery_zones','push_subscriptions'])
  loop execute format('drop policy if exists %I on %I.%I', p.policyname,p.schemaname,p.tablename); end loop;
end $$;

create policy restaurants_public_read on public.restaurants for select to anon, authenticated using (true);
create policy restaurants_owner_insert on public.restaurants for insert to authenticated with check (owner_id = (select auth.uid()));
create policy restaurants_owner_update on public.restaurants for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy restaurants_owner_delete on public.restaurants for delete to authenticated using (owner_id = (select auth.uid()));
create policy categories_public_read on public.categories for select to anon, authenticated using (true);
create policy categories_owner_write on public.categories for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy products_public_read on public.products for select to anon, authenticated using (true);
create policy products_owner_write on public.products for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy product_addons_public_read on public.product_addons for select to anon, authenticated using (true);
create policy product_addons_owner_write on public.product_addons for all to authenticated using (exists(select 1 from public.products p where p.id=product_id and public.owns_restaurant(p.restaurant_id))) with check (exists(select 1 from public.products p where p.id=product_id and public.owns_restaurant(p.restaurant_id)));
create policy combos_public_read on public.combos for select to anon, authenticated using (true);
create policy combos_owner_write on public.combos for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy combo_items_public_read on public.combo_items for select to anon, authenticated using (true);
create policy combo_items_owner_write on public.combo_items for all to authenticated using (exists(select 1 from public.products p where p.id=combo_id and public.owns_restaurant(p.restaurant_id))) with check (exists(select 1 from public.products p where p.id=combo_id and public.owns_restaurant(p.restaurant_id)));
create policy business_hours_public_read on public.business_hours for select to anon, authenticated using (true);
create policy business_hours_owner_write on public.business_hours for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy delivery_settings_public_read on public.delivery_settings for select to anon, authenticated using (true);
create policy delivery_settings_owner_write on public.delivery_settings for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy delivery_zones_public_read on public.delivery_zones for select to anon, authenticated using (true);
create policy delivery_zones_owner_write on public.delivery_zones for all to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));
create policy push_subscriptions_owner_read on public.push_subscriptions for select to authenticated using (public.owns_restaurant(restaurant_id));
create policy push_subscriptions_owner_update on public.push_subscriptions for update to authenticated using (public.owns_restaurant(restaurant_id)) with check (public.owns_restaurant(restaurant_id));

revoke all on public.restaurants, public.categories, public.products, public.product_addons, public.combos, public.combo_items, public.business_hours, public.delivery_settings, public.delivery_zones, public.push_subscriptions from anon, authenticated;
grant select on public.restaurants, public.categories, public.products, public.product_addons, public.combos, public.combo_items, public.business_hours, public.delivery_settings, public.delivery_zones to anon, authenticated;
grant insert, update, delete on public.restaurants, public.categories, public.products, public.product_addons, public.combos, public.combo_items, public.business_hours, public.delivery_settings, public.delivery_zones to authenticated;
grant select, update on public.push_subscriptions to authenticated;
