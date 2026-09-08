alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "Qualquer um pode criar pedido" on public.orders;
drop policy if exists "Qualquer um pode criar itens" on public.order_items;

revoke all on table public.orders from anon;
revoke all on table public.order_items from anon;

revoke insert, delete, truncate, references, trigger on table public.orders from authenticated;
revoke insert, update, delete, truncate, references, trigger on table public.order_items from authenticated;

grant select, update on table public.orders to authenticated;
grant select on table public.order_items to authenticated;
