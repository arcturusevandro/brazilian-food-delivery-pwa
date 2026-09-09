-- Keep the audit timestamp aligned with every order update, including status changes.

create or replace function public.set_orders_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.set_orders_updated_at() from public, anon, authenticated;

drop trigger if exists "set-orders-updated-at" on public.orders;
create trigger "set-orders-updated-at"
before update on public.orders
for each row
execute function public.set_orders_updated_at();
