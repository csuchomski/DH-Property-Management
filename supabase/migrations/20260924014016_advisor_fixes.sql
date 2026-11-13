-- Follow-ups from the Supabase advisors.

-- Policy helpers only need to be callable by signed-in users (policies run as the
-- caller). Anonymous visitors only touch quote_requests / rental_applications inserts
-- and public_listings(), none of which use these.
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.my_owner_id() from public, anon;
revoke execute on function public.my_tenant_id() from public, anon;
revoke execute on function public.my_unit_ids() from public, anon;
revoke execute on function public.my_lease_ids() from public, anon;
revoke execute on function public.owner_of_property(uuid) from public, anon;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.my_owner_id() to authenticated;
grant execute on function public.my_tenant_id() to authenticated;
grant execute on function public.my_unit_ids() to authenticated;
grant execute on function public.my_lease_ids() to authenticated;
grant execute on function public.owner_of_property(uuid) to authenticated;

-- Cover the remaining foreign keys.
create index if not exists profiles_owner_id_idx on public.profiles (owner_id);
create index if not exists profiles_tenant_id_idx on public.profiles (tenant_id);
create index if not exists rental_applications_unit_id_idx on public.rental_applications (unit_id);
create index if not exists transactions_unit_id_idx on public.transactions (unit_id);
create index if not exists transactions_work_order_id_idx on public.transactions (work_order_id);
create index if not exists work_orders_submitted_by_idx on public.work_orders (submitted_by);
create index if not exists work_orders_decided_by_idx on public.work_orders (decided_by);
