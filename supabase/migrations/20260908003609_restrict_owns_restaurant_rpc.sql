-- Restrict the internal owner-check helper from the exposed authenticated API.
-- RLS policies can still invoke the function internally; direct RPC execution is not required.
revoke all on function public.owns_restaurant(uuid) from public;
revoke all on function public.owns_restaurant(uuid) from anon;
revoke all on function public.owns_restaurant(uuid) from authenticated;
grant execute on function public.owns_restaurant(uuid) to service_role;
