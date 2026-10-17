-- Harden the order rate limiter against concurrent requests and phone-format bypasses.
-- Existing order records are not changed.
create index if not exists orders_phone_digits_created_idx
  on public.orders (
    (pg_catalog.regexp_replace(coalesce(customer_phone, ''), '[^0-9]', '', 'g')),
    created_at desc
  );

create or replace function public.enforce_order_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  v_phone_digits text := pg_catalog.regexp_replace(coalesce(new.customer_phone, ''), '[^0-9]', '', 'g');
begin
  if pg_catalog.char_length(v_phone_digits) < 8 or pg_catalog.char_length(v_phone_digits) > 15 then
    raise exception 'Invalid customer phone';
  end if;

  -- Acquire locks in a consistent order so concurrent requests cannot all pass
  -- the count checks before any of them inserts its order.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('order-phone:' || v_phone_digits, 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('order-restaurant:' || coalesce(new.restaurant_id::text, ''), 0)
  );

  if (
    select count(*)
    from public.orders o
    where pg_catalog.regexp_replace(coalesce(o.customer_phone, ''), '[^0-9]', '', 'g') = v_phone_digits
      and o.created_at > pg_catalog.now() - interval '10 minutes'
  ) >= 3 then
    raise exception 'Too many orders from this phone. Try again later.';
  end if;

  if (
    select count(*)
    from public.orders o
    where o.restaurant_id = new.restaurant_id
      and o.created_at > pg_catalog.now() - interval '10 minutes'
  ) >= 30 then
    raise exception 'Restaurant is receiving too many orders. Try again shortly.';
  end if;

  return new;
end;
$function$;

revoke all on function public.enforce_order_rate_limit() from public, anon, authenticated;
