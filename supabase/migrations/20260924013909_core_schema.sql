-- DH Property Management core schema.
--
-- Roles:
--   staff  - DH Property Management employees; full read/write.
--   owner  - a property owner (an entity like "Kettle Ridge Holdings LLC"); reads their
--            own portfolio and approves or declines work orders above their threshold.
--   tenant - reads their own lease, ledger and work orders; submits maintenance requests.
--   (none) - a signed-in user not yet linked to an owner or tenant record sees nothing.
--
-- Anonymous visitors can submit quote requests and rental applications and can read
-- the public listing of vacant units through public_listings().

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('staff', 'owner', 'tenant');
create type public.unit_status as enum ('occupied', 'vacant', 'turnover', 'listed');
create type public.lease_status as enum ('active', 'notice_given', 'renewal_out', 'ended');
create type public.txn_kind as enum ('receipt', 'disbursement');
create type public.work_order_status as enum (
  'open', 'awaiting_approval', 'approved', 'declined', 'scheduled', 'closed'
);
create type public.request_status as enum ('new', 'contacted', 'closed');
create type public.application_status as enum ('submitted', 'screening', 'approved', 'declined', 'withdrawn');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- entity that holds title
  contact_name text,
  email text,
  phone text,
  mgmt_rate numeric(5,4) not null default 0.09 check (mgmt_rate >= 0 and mgmt_rate < 1),
  approval_threshold numeric(10,2) not null default 500 check (approval_threshold >= 0),
  reserve_target numeric(10,2) not null default 1500 check (reserve_target >= 0),
  ach_last4 text check (ach_last4 ~ '^[0-9]{4}$'),
  notes text,
  created_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.owners(id) on delete restrict,
  address text not null,
  city text not null,
  state text not null default 'WI',
  zip text,
  kind text,                                -- duplex, single family, four-plex...
  year_built int,
  notes text,
  created_at timestamptz not null default now()
);
create index on public.properties (owner_id);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  label text not null default '',           -- 'A', '2', or '' for a single-family house
  beds numeric(3,1),
  baths numeric(3,1),
  market_rent numeric(10,2),
  status public.unit_status not null default 'vacant',
  -- listing details, shown publicly only while status = 'listed'
  asking_rent numeric(10,2),
  available_on date,
  listing_title text,
  listing_description text,
  pets_allowed boolean,
  created_at timestamptz not null default now(),
  unique (property_id, label)
);
create index on public.units (property_id);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid not null references public.units(id) on delete restrict,
  start_date date not null,
  end_date date,
  rent numeric(10,2) not null check (rent >= 0),
  deposit numeric(10,2) not null default 0 check (deposit >= 0),
  late_fee numeric(10,2) not null default 0,
  grace_days int not null default 5,
  status public.lease_status not null default 'active',
  notice_date date,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);
create index on public.leases (unit_id);

create table public.lease_tenants (
  lease_id uuid not null references public.leases(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  primary key (lease_id, tenant_id)
);
create index on public.lease_tenants (tenant_id);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  number text unique,                       -- e.g. 2608-02; filled in by trigger
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null, -- null = common area
  opened_on date not null default current_date,
  category text not null default 'General',
  title text not null,
  description text,
  vendor text,
  status public.work_order_status not null default 'open',
  is_emergency boolean not null default false,
  bid_amount numeric(10,2),
  cost numeric(10,2),
  closed_on date,
  -- tenant-supplied details that speed up the visit
  entry_permission boolean,
  pet_on_site text,
  availability text,
  submitted_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_note text,
  created_at timestamptz not null default now()
);
create index on public.work_orders (property_id);
create index on public.work_orders (unit_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid references public.units(id) on delete set null,
  lease_id uuid references public.leases(id) on delete set null,
  work_order_id uuid references public.work_orders(id) on delete set null,
  txn_date date not null,
  kind public.txn_kind not null,
  -- receipts: rent, late_fee, other_income
  -- disbursements: repairs, cleaning_maintenance, grounds, utilities, supplies,
  --   advertising, legal_professional, insurance, taxes, other
  category text not null,
  description text,
  payee_payer text,                         -- tenant name on receipts, vendor on disbursements
  method text,                              -- autopay, bank transfer, check, cash...
  reference text,                           -- invoice or work order number
  amount numeric(12,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index on public.transactions (property_id, txn_date);
create index on public.transactions (lease_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role public.app_role,                     -- null until staff links the account
  owner_id uuid references public.owners(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  created_at timestamptz not null default now(),
  check (role is distinct from 'owner' or owner_id is not null),
  check (role is distinct from 'tenant' or tenant_id is not null)
);

create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 200),
  email text not null check (length(email) between 3 and 320),
  phone text check (length(phone) <= 40),
  service text not null default 'full' check (service in ('full', 'leasing')),
  unit_count int check (unit_count between 1 and 500),
  addresses text check (length(addresses) <= 4000),
  message text check (length(message) <= 4000),
  status public.request_status not null default 'new',
  created_at timestamptz not null default now()
);

create table public.rental_applications (
  id uuid primary key default gen_random_uuid(),
  unit_id uuid references public.units(id) on delete set null,
  full_name text not null check (length(full_name) between 1 and 200),
  email text not null check (length(email) between 3 and 320),
  phone text check (length(phone) <= 40),
  desired_move_in date,
  adults int check (adults between 1 and 20),
  monthly_income numeric(12,2) check (monthly_income >= 0),
  current_address text check (length(current_address) <= 500),
  pets text check (length(pets) <= 500),
  message text check (length(message) <= 4000),
  status public.application_status not null default 'submitted',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer so policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'staff');
$$;

create or replace function public.my_owner_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select owner_id from public.profiles where id = auth.uid() and role = 'owner';
$$;

create or replace function public.my_tenant_id()
returns uuid language sql stable security definer set search_path = ''
as $$
  select tenant_id from public.profiles where id = auth.uid() and role = 'tenant';
$$;

-- Units on any lease (current or past) the signed-in tenant is party to.
create or replace function public.my_unit_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select l.unit_id
  from public.leases l
  join public.lease_tenants lt on lt.lease_id = l.id
  where lt.tenant_id = public.my_tenant_id();
$$;

create or replace function public.my_lease_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select lease_id from public.lease_tenants where tenant_id = public.my_tenant_id();
$$;

create or replace function public.owner_of_property(p_property uuid)
returns uuid language sql stable security definer set search_path = ''
as $$
  select owner_id from public.properties where id = p_property;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- A profile row for every new auth user. Role stays null until linked.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Work order numbers: YYMM-NN, sequential within the month opened.
create or replace function public.set_work_order_number()
returns trigger language plpgsql set search_path = ''
as $$
declare
  prefix text := to_char(new.opened_on, 'YYMM');
  n int;
begin
  if new.number is null then
    perform pg_advisory_xact_lock(hashtext('work_order_number:' || prefix));
    select coalesce(max(split_part(number, '-', 2)::int), 0) + 1 into n
    from public.work_orders
    where number like prefix || '-%';
    new.number := prefix || '-' || lpad(n::text, 2, '0');
  end if;
  return new;
end;
$$;

create trigger work_orders_number
  before insert on public.work_orders
  for each row execute function public.set_work_order_number();

-- ---------------------------------------------------------------------------
-- Account linking: a signed-in user with a confirmed email claims the owner or
-- tenant record whose email matches. Staff accounts are promoted by hand (see README).
-- ---------------------------------------------------------------------------
create or replace function public.link_my_account()
returns public.profiles language plpgsql security definer set search_path = ''
as $$
declare
  v_email text;
  v_confirmed timestamptz;
  v_owner uuid;
  v_tenant uuid;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select lower(email), email_confirmed_at into v_email, v_confirmed
  from auth.users where id = auth.uid();

  insert into public.profiles (id, email) values (auth.uid(), v_email)
  on conflict (id) do nothing;

  select * into v_profile from public.profiles where id = auth.uid();

  if v_profile.role is null and v_confirmed is not null and v_email is not null then
    select id into v_owner from public.owners where lower(email) = v_email order by created_at limit 1;
    if v_owner is not null then
      update public.profiles set role = 'owner', owner_id = v_owner
      where id = auth.uid() returning * into v_profile;
    else
      select id into v_tenant from public.tenants where lower(email) = v_email order by created_at limit 1;
      if v_tenant is not null then
        update public.profiles set role = 'tenant', tenant_id = v_tenant
        where id = auth.uid() returning * into v_profile;
      end if;
    end if;
  end if;

  return v_profile;
end;
$$;

-- ---------------------------------------------------------------------------
-- Owner and tenant actions
-- ---------------------------------------------------------------------------

-- Owner approves or declines a work order that is waiting on them.
create or replace function public.decide_work_order(p_id uuid, p_approve boolean, p_note text default null)
returns public.work_orders language plpgsql security definer set search_path = ''
as $$
declare
  v_wo public.work_orders;
begin
  select * into v_wo from public.work_orders where id = p_id for update;
  if v_wo.id is null then
    raise exception 'work order not found';
  end if;
  if not (public.is_staff() or public.owner_of_property(v_wo.property_id) = public.my_owner_id()) then
    raise exception 'not allowed';
  end if;
  if v_wo.status <> 'awaiting_approval' then
    raise exception 'work order is not awaiting approval';
  end if;

  update public.work_orders
     set status = case when p_approve then 'approved'::public.work_order_status
                       else 'declined'::public.work_order_status end,
         decided_by = auth.uid(),
         decided_at = now(),
         decision_note = left(p_note, 2000)
   where id = p_id
  returning * into v_wo;
  return v_wo;
end;
$$;

-- Tenant submits a maintenance request for a unit on their active lease.
create or replace function public.submit_maintenance_request(
  p_unit_id uuid,
  p_title text,
  p_description text,
  p_category text default 'General',
  p_entry_permission boolean default false,
  p_pet_on_site text default null,
  p_availability text default null
)
returns public.work_orders language plpgsql security definer set search_path = ''
as $$
declare
  v_property uuid;
  v_wo public.work_orders;
begin
  if not exists (
    select 1 from public.leases l
    join public.lease_tenants lt on lt.lease_id = l.id
    where l.unit_id = p_unit_id
      and lt.tenant_id = public.my_tenant_id()
      and l.status <> 'ended'
  ) then
    raise exception 'no active lease for this unit';
  end if;
  if coalesce(length(trim(p_title)), 0) = 0 then
    raise exception 'a short summary is required';
  end if;

  select property_id into v_property from public.units where id = p_unit_id;

  insert into public.work_orders (
    property_id, unit_id, category, title, description,
    entry_permission, pet_on_site, availability, submitted_by
  ) values (
    v_property, p_unit_id, left(coalesce(p_category, 'General'), 60), left(p_title, 200),
    left(p_description, 4000), p_entry_permission, left(p_pet_on_site, 500),
    left(p_availability, 500), auth.uid()
  ) returning * into v_wo;
  return v_wo;
end;
$$;

-- Work orders on the signed-in tenant's units, without owner-only fields.
create or replace function public.my_work_orders()
returns table (
  id uuid,
  number text,
  unit_id uuid,
  opened_on date,
  category text,
  title text,
  description text,
  status public.work_order_status,
  is_emergency boolean,
  closed_on date
)
language sql stable security definer set search_path = ''
as $$
  select w.id, w.number, w.unit_id, w.opened_on, w.category, w.title, w.description,
         -- owners' approval step is internal; tenants just see it as open
         case when w.status in ('awaiting_approval', 'approved', 'declined')
              then 'open'::public.work_order_status else w.status end,
         w.is_emergency, w.closed_on
  from public.work_orders w
  where w.unit_id in (select public.my_unit_ids())
  order by w.opened_on desc, w.number desc;
$$;

-- Public listing of units currently marketed for rent.
create or replace function public.public_listings()
returns table (
  unit_id uuid,
  title text,
  city text,
  neighborhood_address text,
  label text,
  beds numeric,
  baths numeric,
  asking_rent numeric,
  available_on date,
  description text,
  pets_allowed boolean
)
language sql stable security definer set search_path = ''
as $$
  select u.id, coalesce(u.listing_title, p.kind), p.city,
         p.address, u.label, u.beds, u.baths, u.asking_rent, u.available_on,
         u.listing_description, u.pets_allowed
  from public.units u
  join public.properties p on p.id = u.property_id
  where u.status = 'listed'
  order by u.available_on nulls last, u.asking_rent;
$$;

-- ---------------------------------------------------------------------------
-- Reporting views (security_invoker, so the caller's RLS applies)
-- ---------------------------------------------------------------------------

-- One row per property per month: collected, operating, management fee, net.
create view public.monthly_property_summary
with (security_invoker = true) as
select
  p.id as property_id,
  p.owner_id,
  date_trunc('month', t.txn_date)::date as month,
  coalesce(sum(t.amount) filter (where t.kind = 'receipt'), 0) as collected,
  coalesce(sum(t.amount) filter (where t.kind = 'receipt' and t.category in ('rent', 'late_fee')), 0) as fee_base,
  coalesce(sum(t.amount) filter (where t.kind = 'disbursement'), 0) as operating,
  round(coalesce(sum(t.amount) filter (where t.kind = 'receipt' and t.category in ('rent', 'late_fee')), 0) * o.mgmt_rate, 2) as mgmt_fee
from public.transactions t
join public.properties p on p.id = t.property_id
join public.owners o on o.id = p.owner_id
group by p.id, p.owner_id, date_trunc('month', t.txn_date), o.mgmt_rate;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.owners enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.leases enable row level security;
alter table public.lease_tenants enable row level security;
alter table public.work_orders enable row level security;
alter table public.transactions enable row level security;
alter table public.profiles enable row level security;
alter table public.quote_requests enable row level security;
alter table public.rental_applications enable row level security;

-- Staff: everything.
create policy staff_all on public.owners for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_all on public.properties for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_all on public.units for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_all on public.tenants for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_all on public.leases for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_all on public.lease_tenants for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_all on public.work_orders for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_all on public.transactions for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_all on public.profiles for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_all on public.quote_requests for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_all on public.rental_applications for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- Everyone signed in: read their own profile.
create policy own_profile on public.profiles for select to authenticated
  using (id = (select auth.uid()));

-- Owners: read their own portfolio.
create policy owner_read on public.owners for select to authenticated
  using (id = (select public.my_owner_id()));
create policy owner_read on public.properties for select to authenticated
  using (owner_id = (select public.my_owner_id()));
create policy owner_read on public.units for select to authenticated
  using (public.owner_of_property(property_id) = (select public.my_owner_id()));
create policy owner_read on public.leases for select to authenticated
  using (exists (
    select 1 from public.units u
    where u.id = unit_id and public.owner_of_property(u.property_id) = (select public.my_owner_id())
  ));
create policy owner_read on public.lease_tenants for select to authenticated
  using (exists (
    select 1 from public.leases l join public.units u on u.id = l.unit_id
    where l.id = lease_id and public.owner_of_property(u.property_id) = (select public.my_owner_id())
  ));
create policy owner_read on public.tenants for select to authenticated
  using (exists (
    select 1 from public.lease_tenants lt
    join public.leases l on l.id = lt.lease_id
    join public.units u on u.id = l.unit_id
    where lt.tenant_id = tenants.id
      and public.owner_of_property(u.property_id) = (select public.my_owner_id())
  ));
create policy owner_read on public.work_orders for select to authenticated
  using (public.owner_of_property(property_id) = (select public.my_owner_id()));
create policy owner_read on public.transactions for select to authenticated
  using (public.owner_of_property(property_id) = (select public.my_owner_id()));

-- Tenants: their own record, leases, units, receipts and requests.
create policy tenant_read on public.tenants for select to authenticated
  using (id = (select public.my_tenant_id()));
create policy tenant_read on public.lease_tenants for select to authenticated
  using (tenant_id = (select public.my_tenant_id()));
create policy tenant_read on public.leases for select to authenticated
  using (id in (select public.my_lease_ids()));
create policy tenant_read on public.units for select to authenticated
  using (id in (select public.my_unit_ids()));
create policy tenant_read on public.properties for select to authenticated
  using (id in (select u.property_id from public.units u where u.id in (select public.my_unit_ids())));
create policy tenant_read on public.transactions for select to authenticated
  using (kind = 'receipt' and lease_id in (select public.my_lease_ids()));
-- Tenants read their work orders through my_work_orders(), which leaves out bids,
-- costs, vendors and owner decision notes.

-- Public forms: anyone can submit, nobody but staff can read back.
create policy public_submit on public.quote_requests for insert to anon, authenticated
  with check (status = 'new');
create policy public_submit on public.rental_applications for insert to anon, authenticated
  with check (status = 'submitted');

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.link_my_account() from public, anon;
revoke execute on function public.decide_work_order(uuid, boolean, text) from public, anon;
revoke execute on function public.submit_maintenance_request(uuid, text, text, text, boolean, text, text) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.link_my_account() to authenticated;
grant execute on function public.decide_work_order(uuid, boolean, text) to authenticated;
grant execute on function public.submit_maintenance_request(uuid, text, text, text, boolean, text, text) to authenticated;
grant execute on function public.public_listings() to anon, authenticated;
revoke execute on function public.my_work_orders() from public, anon;
grant execute on function public.my_work_orders() to authenticated;
