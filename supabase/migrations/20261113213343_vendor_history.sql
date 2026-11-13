-- Vendor websites, and ledger entries linked to a vendor so staff can see everything paid to one.

alter table public.vendors add column website text check (length(website) <= 300);

alter table public.transactions add column vendor_id uuid references public.vendors(id) on delete set null;
create index on public.transactions (vendor_id);

-- Keep the payee name and the vendor link in step:
--   picked a vendor and left the payee blank -> payee is the vendor's name
--   typed a payee that is exactly one vendor's name -> linked to that vendor
create or replace function public.link_transaction_vendor()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  if new.vendor_id is not null and nullif(trim(new.payee_payer), '') is null then
    select name into new.payee_payer from public.vendors where id = new.vendor_id;
  elsif new.vendor_id is null and nullif(trim(new.payee_payer), '') is not null
        and (tg_op = 'INSERT' or new.payee_payer is distinct from old.payee_payer) then
    select min(id::text)::uuid into v_id from public.vendors
    where lower(trim(name)) = lower(trim(new.payee_payer))
    having count(*) = 1;
    new.vendor_id := v_id;
  end if;
  return new;
end;
$$;
create trigger transactions_link_vendor before insert or update of payee_payer, vendor_id on public.transactions
  for each row execute function public.link_transaction_vendor();

-- A new or renamed vendor picks up past entries paid to that exact name.
create or replace function public.link_vendor_history()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.vendors where lower(trim(name)) = lower(trim(new.name))) = 1 then
    update public.transactions set vendor_id = new.id
    where vendor_id is null and lower(trim(payee_payer)) = lower(trim(new.name));
  end if;
  return null;
end;
$$;
create trigger vendors_link_history after insert or update of name on public.vendors
  for each row execute function public.link_vendor_history();

-- Link what's already there.
update public.transactions t set vendor_id = v.id
from public.vendors v
where t.vendor_id is null and lower(trim(t.payee_payer)) = lower(trim(v.name))
  and (select count(*) from public.vendors v2 where lower(trim(v2.name)) = lower(trim(v.name))) = 1;

revoke execute on function public.link_transaction_vendor() from public, anon, authenticated;
revoke execute on function public.link_vendor_history() from public, anon, authenticated;
