-- Vendors: DH's own list (staff only) and owners' preferred trades.
--
-- vendors                     staff-managed list, tagged by trade and by area (town, or 'all')
-- owner_vendor_preferences    an owner's "use my guy" for a trade, for all their properties or one;
--                             staff approve it (linking or adding it to the vendor list) or decline it.

create table public.vendors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  contact_name text check (length(contact_name) <= 200),
  phone text check (length(phone) <= 40),
  email text check (length(email) <= 200),
  trades text[] not null check (cardinality(trades) > 0 and trades <@ array[
    'plumbing','electrical','hvac','appliance','handyman','roofing','painting','flooring',
    'pest','locksmith','cleaning','lawn_snow','general_contractor','other']::text[]),
  areas text[] not null default array['all']::text[] check (cardinality(areas) > 0 and cardinality(areas) <= 60),
  license_no text check (length(license_no) <= 100),
  insurance_expires date,
  w9_on_file boolean not null default false,
  rating smallint check (rating between 1 and 5),
  notes text check (length(notes) <= 4000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index vendors_trades_idx on public.vendors using gin (trades);
alter table public.vendors enable row level security;
create policy staff_all on public.vendors for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create table public.owner_vendor_preferences (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,   -- null = all the owner's properties
  trade text not null check (trade in (
    'plumbing','electrical','hvac','appliance','handyman','roofing','painting','flooring',
    'pest','locksmith','cleaning','lawn_snow','general_contractor','other')),
  name text not null check (length(name) between 1 and 200),
  phone text check (length(phone) <= 40),
  email text check (length(email) <= 200),
  notes text check (length(notes) <= 2000),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  vendor_id uuid references public.vendors(id) on delete set null,
  staff_note text check (length(staff_note) <= 2000),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.owner_vendor_preferences (owner_id);
create index on public.owner_vendor_preferences (property_id);
create index on public.owner_vendor_preferences (vendor_id);
alter table public.owner_vendor_preferences enable row level security;

create policy staff_all on public.owner_vendor_preferences for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy owner_read on public.owner_vendor_preferences for select to authenticated
  using (owner_id = (select public.my_owner_id()));
-- Owners add suggestions for their own properties; staff decide them.
create policy owner_insert on public.owner_vendor_preferences for insert to authenticated
  with check (
    owner_id = (select public.my_owner_id())
    and status = 'pending' and vendor_id is null and staff_note is null and reviewed_at is null
    and (property_id is null
         or coalesce(public.owner_of_property(property_id) = (select public.my_owner_id()), false))
  );
create policy owner_delete on public.owner_vendor_preferences for delete to authenticated
  using (owner_id = (select public.my_owner_id()));

-- Alerts: staff hear about a new suggestion; the owner hears the decision.
create or replace function public.alert_vendor_preference()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_owner public.owners;
  v_where text;
  v_trade text := case new.trade
    when 'hvac' then 'Heating and cooling' when 'lawn_snow' then 'Lawn and snow'
    when 'general_contractor' then 'General contracting' when 'pest' then 'Pest control'
    when 'appliance' then 'Appliance repair' else initcap(new.trade) end;
begin
  select * into v_owner from public.owners where id = new.owner_id;
  v_where := coalesce((select address from public.properties where id = new.property_id), 'all their properties');
  if tg_op = 'INSERT' then
    perform public.queue_staff_email(
      'vendor.suggested', 'Owner''s preferred vendor · ' || v_owner.name || ' · ' || v_trade,
      array_remove(array[
        v_owner.name || ' wants ' || new.name || ' used for ' || lower(v_trade) || ' at ' || v_where || '.',
        case when new.phone is not null then 'Phone: ' || new.phone end,
        case when new.email is not null then 'Email: ' || new.email end,
        nullif(new.notes, ''),
        'Approve it or decline it on the Vendors page.'
      ], null),
      '/vendors');
  elsif new.status is distinct from old.status and new.status in ('approved', 'declined') and v_owner.email is not null then
    perform public.queue_email(
      'vendor.decided', v_owner.email,
      case when new.status = 'approved'
        then 'We''ll call ' || new.name || ' first for ' || lower(v_trade)
        else 'About ' || new.name || ' for ' || lower(v_trade) end,
      array_remove(array[
        case when new.status = 'approved'
          then new.name || ' is on our list. We''ll call them first for ' || lower(v_trade) || ' at ' || v_where || '.'
          else 'We can''t add ' || new.name || ' to our dispatch list for ' || lower(v_trade) || ' right now.' end,
        nullif(new.staff_note, '')
      ], null),
      '/vendors');
  end if;
  return new;
end;
$$;
create trigger owner_vendor_preferences_alert after insert or update of status on public.owner_vendor_preferences
  for each row execute function public.alert_vendor_preference();

revoke execute on function public.alert_vendor_preference() from public, anon, authenticated;
