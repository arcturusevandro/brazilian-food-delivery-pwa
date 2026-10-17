-- Secure invite-only administrative access for existing restaurants.
create table if not exists public.restaurant_memberships (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create table if not exists public.restaurant_admin_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.restaurant_memberships enable row level security;
alter table public.restaurant_admin_invites enable row level security;
revoke all on public.restaurant_memberships from anon, authenticated;
revoke all on public.restaurant_admin_invites from anon, authenticated;
grant select, insert, delete on public.restaurant_memberships to service_role;
grant select, insert, update on public.restaurant_admin_invites to service_role;

create or replace function public.owns_restaurant(p_restaurant_id uuid)
returns boolean
language sql
stable
security definer
set search_path to ''
as $function$
  select exists (
    select 1 from public.restaurants r
    where r.id = p_restaurant_id
      and (
        r.owner_id = auth.uid()
        or exists (
          select 1 from public.restaurant_memberships m
          where m.restaurant_id = r.id and m.user_id = auth.uid()
        )
      )
  );
$function$;

create or replace function public.get_my_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path to ''
as $function$
  select r.id
  from public.restaurants r
  where r.owner_id = auth.uid()
     or exists (
       select 1 from public.restaurant_memberships m
       where m.restaurant_id = r.id and m.user_id = auth.uid()
     )
  order by case when r.owner_id = auth.uid() then 0 else 1 end
  limit 1;
$function$;

revoke all on function public.get_my_restaurant_id() from public, anon;
grant execute on function public.get_my_restaurant_id() to authenticated;

drop policy if exists restaurants_owner_update on public.restaurants;
create policy restaurants_owner_update on public.restaurants
for update to authenticated
using (
  coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
  and public.owns_restaurant(id)
)
with check (
  coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) is false
  and public.owns_restaurant(id)
);

create or replace function public.claim_restaurant_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_invite public.restaurant_admin_invites%rowtype;
begin
  if v_user_id is null then
    raise exception 'É necessário entrar na conta primeiro.';
  end if;

  if length(coalesce(p_code, '')) < 32 or length(p_code) > 128 then
    raise exception 'Código de convite inválido.';
  end if;

  select i.* into v_invite
  from public.restaurant_admin_invites i
  where i.token_hash = encode(digest(p_code, 'sha256'), 'hex')
    and lower(i.email) = v_email
    and i.used_at is null
    and i.expires_at > now()
  for update;

  if not found then
    raise exception 'Convite inválido, expirado ou já utilizado.';
  end if;

  update public.restaurant_admin_invites
  set used_at = now()
  where id = v_invite.id;

  insert into public.restaurant_memberships (restaurant_id, user_id, role)
  values (v_invite.restaurant_id, v_user_id, 'admin')
  on conflict (restaurant_id, user_id) do nothing;

  return v_invite.restaurant_id;
end;
$function$;

revoke all on function public.claim_restaurant_invite(text) from public, anon;
grant execute on function public.claim_restaurant_invite(text) to authenticated;
