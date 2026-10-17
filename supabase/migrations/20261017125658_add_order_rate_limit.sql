-- Restored from the production schema on 2026-10-17.
-- Keep this migration versioned: it is already recorded as applied in production.
create index if not exists orders_phone_created_idx
  on public.orders using btree (customer_phone, created_at desc);

create index if not exists orders_restaurant_created_idx
  on public.orders using btree (restaurant_id, created_at desc);

create or replace function public.enforce_order_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if (
    select count(*)
    from public.orders o
    where o.customer_phone = new.customer_phone
      and o.created_at > now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'Too many orders from this phone. Try again later.';
  end if;

  if (
    select count(*)
    from public.orders o
    where o.restaurant_id = new.restaurant_id
      and o.created_at > now() - interval '10 minutes'
  ) >= 30 then
    raise exception 'Restaurant is receiving too many orders. Try again shortly.';
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_order_rate_limit() from public, anon, authenticated;

drop trigger if exists orders_rate_limit on public.orders;
create trigger orders_rate_limit
  before insert on public.orders
  for each row execute function public.enforce_order_rate_limit();
