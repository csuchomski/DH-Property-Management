-- Trust accounting.
--
-- Rent and owner money sit in one pooled rent trust account; security deposits in a
-- separate deposit trust account. The transactions ledger is the record of the rent
-- trust account, split by owner and property:
--   owner balance = receipts - disbursements, over the owner's properties
-- Three new categories record money moving in and out of trust that isn't income or
-- expense: owner_contribution (owner funds their reserve or a repair),
-- management_fee (fee moved to the DH operating account) and owner_distribution
-- (payout to the owner).
--
-- Rules enforced here:
--   * categories must be ones the portal knows (fees and tax lines depend on them)
--   * no entry may take an owner's trust balance below zero (one owner's money never
--     pays another owner's bills)
--   * payouts move the management fee due first, then pay the owner, in one step

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
-- Rows entered with display names ("Rent", "Late fee") instead of codes: map them.
update public.transactions set category = case category
    when 'Rent' then 'rent'
    when 'Late fee' then 'late_fee'
    when 'Other income' then 'other_income'
    when 'Repair' then 'repairs'
    when 'Repairs' then 'repairs'
    when 'Cleaning & maintenance' then 'cleaning_maintenance'
    when 'Grounds' then 'grounds'
    when 'Utilities' then 'utilities'
    when 'Supplies' then 'supplies'
    when 'Life safety' then 'supplies'
    when 'Advertising' then 'advertising'
    when 'Legal & professional' then 'legal_professional'
    when 'Insurance' then 'insurance'
    when 'Taxes' then 'taxes'
    when 'Other' then 'other'
    else category end
  where category <> lower(category) or category like '% %';

alter table public.transactions add constraint transactions_category_check check (
  (kind = 'receipt' and category in ('rent', 'late_fee', 'other_income', 'owner_contribution'))
  or (kind = 'disbursement' and category in (
    'repairs', 'cleaning_maintenance', 'grounds', 'utilities', 'supplies', 'advertising',
    'legal_professional', 'insurance', 'taxes', 'other', 'management_fee', 'owner_distribution'))
);

-- ---------------------------------------------------------------------------
-- Balances
-- ---------------------------------------------------------------------------
-- Management fee earned on a property through a date: the owner's rate times rent and
-- late fees collected, rounded per month (the same rule the statements use).
create or replace function public.fee_accrued(p_property uuid, p_as_of date)
returns numeric language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(round(m.base * r.rate, 2)), 0)
  from (
    select date_trunc('month', t.txn_date) as mth, sum(t.amount) as base
    from public.transactions t
    where t.property_id = p_property and t.kind = 'receipt'
      and t.category in ('rent', 'late_fee') and t.txn_date <= p_as_of
    group by 1
  ) m
  cross join (
    select o.mgmt_rate as rate from public.properties p join public.owners o on o.id = p.owner_id
    where p.id = p_property
  ) r
$$;

-- An owner's position in the rent trust account, by property.
create or replace function public.owner_trust_position(p_owner uuid, p_as_of date default current_date)
returns table (property_id uuid, address text, balance numeric, fee_due numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  -- coalesce: for non-owners the comparison is null, which must count as "not allowed".
  if not (public.is_staff() or coalesce(public.my_owner_id() = p_owner, false)) then
    raise exception 'not allowed';
  end if;
  return query
  select p.id, p.address,
         coalesce(sum(case when t.kind = 'receipt' then t.amount else -t.amount end)
                  filter (where t.txn_date <= p_as_of), 0)::numeric,
         greatest(public.fee_accrued(p.id, p_as_of)
                  - coalesce(sum(t.amount) filter (where t.category = 'management_fee' and t.txn_date <= p_as_of), 0), 0)::numeric
  from public.properties p
  left join public.transactions t on t.property_id = p.id
  where p.owner_id = p_owner
  group by p.id, p.address
  order by p.address;
end;
$$;

-- Every owner's totals, for the payouts and reconciliation screens.
create or replace function public.trust_owner_balances(p_as_of date default current_date)
returns table (owner_id uuid, owner_name text, balance numeric, fee_due numeric, reserve_target numeric, available numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  return query
  select o.id, o.name, coalesce(sum(pos.balance), 0), coalesce(sum(pos.fee_due), 0), o.reserve_target,
         greatest(coalesce(sum(pos.balance), 0) - coalesce(sum(pos.fee_due), 0) - o.reserve_target, 0)
  from public.owners o
  left join lateral public.owner_trust_position(o.id, p_as_of) pos on true
  group by o.id, o.name, o.reserve_target
  order by o.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- No owner below zero
-- ---------------------------------------------------------------------------
create or replace function public.guard_trust_balance()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_delta numeric;
  v_balance numeric;
  v_name text;
begin
  for v_owner in
    select distinct p.owner_id from public.properties p
    where p.id in (
      case when tg_op <> 'DELETE' then new.property_id end,
      case when tg_op <> 'INSERT' then old.property_id end)
  loop
    -- How much this change moved the owner's balance.
    v_delta := 0;
    if tg_op <> 'DELETE' and (select owner_id from public.properties where id = new.property_id) = v_owner then
      v_delta := v_delta + case when new.kind = 'receipt' then new.amount else -new.amount end;
    end if;
    if tg_op <> 'INSERT' and (select owner_id from public.properties where id = old.property_id) = v_owner then
      v_delta := v_delta - case when old.kind = 'receipt' then old.amount else -old.amount end;
    end if;
    if v_delta >= 0 then
      continue;
    end if;
    select coalesce(sum(case when t.kind = 'receipt' then t.amount else -t.amount end), 0)
      into v_balance
    from public.transactions t join public.properties p on p.id = t.property_id
    where p.owner_id = v_owner;
    if v_balance < 0 then
      select name into v_name from public.owners where id = v_owner;
      raise exception 'This would take % below zero in trust (balance after: $%). Record their contribution or the rent first. One owner''s money can''t cover another''s bills.',
        v_name, to_char(v_balance, 'FM999,999,990.00')
        using errcode = 'check_violation';
    end if;
  end loop;
  return null;
end;
$$;

create trigger transactions_trust_guard
  after insert or update or delete on public.transactions
  for each row execute function public.guard_trust_balance();

-- ---------------------------------------------------------------------------
-- Owner payouts
-- ---------------------------------------------------------------------------
-- Moves the management fee due to the operating account, then pays the owner, split
-- across their properties in proportion to what each holds. One call, all or nothing.
create or replace function public.record_owner_payout(p_owner uuid, p_date date, p_amount numeric, p_reference text default null)
returns table (fees_moved numeric, paid_out numeric)
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_fees numeric := 0;
  v_pos numeric;
  v_n int;
  v_i int := 0;
  v_left numeric;
  v_share numeric;
  v_ref text := left(nullif(trim(p_reference), ''), 120);
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'enter a payout amount of zero or more';
  end if;

  for r in select * from public.owner_trust_position(p_owner, p_date) loop
    if r.fee_due > 0 then
      insert into public.transactions (property_id, txn_date, kind, category, description, payee_payer, reference, amount)
      values (r.property_id, p_date, 'disbursement', 'management_fee',
              'Management fee moved to operating account', 'DH Property Management', v_ref, r.fee_due);
      v_fees := v_fees + r.fee_due;
    end if;
  end loop;

  if p_amount > 0 then
    select coalesce(sum(balance) filter (where balance > 0), 0), count(*) filter (where balance > 0)
      into v_pos, v_n
    from public.owner_trust_position(p_owner, p_date);
    if p_amount > v_pos then
      raise exception 'only $% is in trust for this owner after fees', to_char(v_pos, 'FM999,999,990.00');
    end if;
    v_left := p_amount;
    for r in select * from public.owner_trust_position(p_owner, p_date) where balance > 0 order by balance desc loop
      v_i := v_i + 1;
      v_share := case when v_i = v_n then v_left else least(round(p_amount * r.balance / v_pos, 2), v_left) end;
      if v_share > 0 then
        insert into public.transactions (property_id, txn_date, kind, category, description, payee_payer, reference, amount)
        values (r.property_id, p_date, 'disbursement', 'owner_distribution',
                'Owner distribution', (select name from public.owners where id = p_owner), v_ref, v_share);
        v_left := v_left - v_share;
      end if;
    end loop;
  end if;

  return query select v_fees, p_amount;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reconciliation
-- ---------------------------------------------------------------------------
-- Book side for a month end: the rent trust ledger total, the sum of owner balances,
-- owners below zero, and security deposits held (current leases plus ended leases whose
-- deposit hasn't been settled; this one is as of today, not the month end).
create or replace function public.trust_book(p_as_of date)
returns table (rent_book numeric, owner_total numeric, owners_below_zero int, deposits_held numeric)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'staff only';
  end if;
  return query
  select
    (select coalesce(sum(case when kind = 'receipt' then amount else -amount end), 0)
       from public.transactions where txn_date <= p_as_of),
    (select coalesce(sum(b.balance), 0) from public.trust_owner_balances(p_as_of) b),
    (select count(*)::int from public.trust_owner_balances(p_as_of) b where b.balance < 0),
    (select coalesce(sum(l.deposit), 0) from public.leases l
       where l.status <> 'ended'
          or exists (select 1 from public.move_outs m where m.lease_id = l.id and m.deposit_statement_sent_on is null));
end;
$$;

create table public.trust_reconciliations (
  id uuid primary key default gen_random_uuid(),
  account text not null check (account in ('rent', 'deposits')),
  period_end date not null,
  bank_balance numeric(12,2) not null,
  adjustments numeric(12,2) not null default 0,   -- deposits in transit minus outstanding checks
  book_balance numeric(12,2) not null,
  owner_total numeric(12,2),
  difference numeric(12,2) generated always as (bank_balance + adjustments - book_balance) stored,
  note text check (length(note) <= 2000),
  reconciled_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (account, period_end)
);
create index on public.trust_reconciliations (reconciled_by);
alter table public.trust_reconciliations enable row level security;
create policy staff_all on public.trust_reconciliations for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.fee_accrued(uuid, date) from public, anon, authenticated;
revoke execute on function public.guard_trust_balance() from public, anon, authenticated;
revoke execute on function public.owner_trust_position(uuid, date) from public, anon;
revoke execute on function public.trust_owner_balances(date) from public, anon;
revoke execute on function public.record_owner_payout(uuid, date, numeric, text) from public, anon;
revoke execute on function public.trust_book(date) from public, anon;
grant execute on function public.owner_trust_position(uuid, date) to authenticated;
grant execute on function public.trust_owner_balances(date) to authenticated;
grant execute on function public.record_owner_payout(uuid, date, numeric, text) to authenticated;
grant execute on function public.trust_book(date) to authenticated;
