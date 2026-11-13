-- Trades become an editable list (Settings page) instead of a fixed set in a check constraint.
-- Each trade has a stable key (stored on vendors and preferences) and a label staff can rename.

create table public.trades (
  key text primary key check (key ~ '^[a-z0-9_]{1,40}$'),
  label text not null check (length(trim(label)) between 1 and 60),
  sort int not null default 100,
  active boolean not null default true,     -- hidden trades stay on existing records but aren't offered
  created_at timestamptz not null default now()
);
alter table public.trades enable row level security;
create policy read_all on public.trades for select to authenticated using (true);
create policy staff_insert on public.trades for insert to authenticated with check ((select public.is_staff()));
create policy staff_update on public.trades for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy staff_delete on public.trades for delete to authenticated using ((select public.is_staff()));

insert into public.trades (key, label, sort) values
  ('plumbing', 'Plumbing', 10), ('electrical', 'Electrical', 20), ('hvac', 'Heating & cooling', 30),
  ('appliance', 'Appliance repair', 40), ('handyman', 'Handyman', 50), ('roofing', 'Roofing & gutters', 60),
  ('painting', 'Painting', 70), ('flooring', 'Flooring', 80), ('pest', 'Pest control', 90),
  ('locksmith', 'Locks & keys', 100), ('cleaning', 'Cleaning', 110), ('lawn_snow', 'Lawn & snow', 120),
  ('general_contractor', 'General contractor', 130), ('other', 'Other', 140);

-- Preferences: one trade, a real foreign key.
alter table public.owner_vendor_preferences drop constraint owner_vendor_preferences_trade_check;
alter table public.owner_vendor_preferences
  add constraint owner_vendor_preferences_trade_fkey foreign key (trade) references public.trades(key) on update cascade;
create index on public.owner_vendor_preferences (trade);

-- Vendors: an array of trades, checked by trigger.
alter table public.vendors drop constraint vendors_trades_check;
alter table public.vendors add constraint vendors_trades_check check (cardinality(trades) > 0);

create or replace function public.check_vendor_trades()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare v_bad text;
begin
  select t into v_bad from unnest(new.trades) t
  where not exists (select 1 from public.trades x where x.key = t) limit 1;
  if v_bad is not null then
    raise exception 'Unknown trade: %', v_bad using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;
create trigger vendors_check_trades before insert or update of trades on public.vendors
  for each row execute function public.check_vendor_trades();

-- A trade still on a vendor can't be deleted (preferences are covered by the foreign key).
create or replace function public.guard_trade_delete()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  select count(*) into n from public.vendors where old.key = any(trades);
  if n > 0 then
    raise exception '% is used by % vendor%. Hide it instead, or take it off those vendors first.',
      old.label, n, case when n = 1 then '' else 's' end using errcode = 'foreign_key_violation';
  end if;
  return old;
end;
$$;
create trigger trades_guard_delete before delete on public.trades
  for each row execute function public.guard_trade_delete();

-- Alert emails use the trade's current label.
create or replace function public.alert_vendor_preference()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_owner public.owners;
  v_where text;
  v_trade text := coalesce((select label from public.trades where key = new.trade), initcap(replace(new.trade, '_', ' ')));
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

revoke execute on function public.check_vendor_trades() from public, anon, authenticated;
revoke execute on function public.guard_trade_delete() from public, anon, authenticated;
