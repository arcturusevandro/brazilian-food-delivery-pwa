-- RLS owner policies call this helper as the requesting authenticated role.
-- Keep it unavailable to unauthenticated API callers while allowing the
-- authenticated role to evaluate the ownership predicates.
revoke all on function public.owns_restaurant(uuid) from public;
revoke all on function public.owns_restaurant(uuid) from anon;
grant execute on function public.owns_restaurant(uuid) to authenticated;
grant execute on function public.owns_restaurant(uuid) to service_role;
