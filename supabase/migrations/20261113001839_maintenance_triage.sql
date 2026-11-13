-- Maintenance triage.
--
-- The tenant form asks a few conditional checks instead of one free-text box, and the
-- answers decide how fast someone comes. The rules live here, in the database, rather
-- than in the page: the client can be modified, so a gas smell must never depend on
-- what the browser sends. The page asks the questions; this file decides the priority.

create type wo_priority as enum ('P1', 'P2', 'P3');

alter table work_orders
  add column priority wo_priority,
  add column rule_id text,
  add column triage_answers jsonb not null default '[]'::jsonb;

comment on column work_orders.priority is 'Set by triage_decision() at submission. Null on work orders opened by staff directly.';
comment on column work_orders.rule_id is 'Which rule in triage_decision() set the priority, so the decision can be explained to an owner.';
comment on column work_orders.triage_answers is 'The question/answer trail the tenant gave, as [{"q":...,"a":...}]. Evidence for the priority.';

create index work_orders_priority_idx on work_orders (priority) where status <> 'closed';

-- One place, evaluated in order, first match wins. Returns the priority, the rule that
-- set it, and the sentence the tenant is shown. Keep the P1 block first and additive:
-- a new category that matches nothing falls through to GEN-01 at P3, never to silence.
create or replace function public.triage_decision(p_answers jsonb)
returns table (priority public.wo_priority, rule_id text, sla text)
language sql
immutable
set search_path to ''
as $$
  with a as (select
    p_answers ->> 'cat'    as cat,
    p_answers ->> 'secure' as secure,
    p_answers ->> 'rate'   as rate,
    p_answers ->> 'where'  as whr,
    p_answers ->> 'sev'    as sev,
    p_answers ->> 'fix'    as fix,
    p_answers ->> 'only'   as only_toilet,
    p_answers ->> 'temp'   as temp,
    p_answers ->> 'burn'   as burn,
    p_answers ->> 'brk'    as brk,
    p_answers ->> 'scope'  as scope,
    p_answers ->> 'nbr'    as nbr,
    p_answers ->> 'pool'   as pool,
    p_answers ->> 'which'  as which,
    p_answers ->> 'fridge' as fridge,
    p_answers ->> 'what'   as what
  )
  select v.priority, v.rule_id, v.sla
  from a, lateral (values
    ('P1'::public.wo_priority, 'SEC-01',
     'A locksmith is being dispatched tonight. A unit that cannot be locked is an emergency whatever the hour.',
     a.cat = 'lock' and a.secure = 'no'),
    ('P1', 'PLB-01',
     'A plumber is on the way tonight. Move anything valuable clear of the water.',
     a.cat = 'leak' and (a.rate = 'spread' or a.whr = 'ceiling')),
    ('P1', 'PLB-02',
     'A plumber with a camera is being dispatched tonight. Stop running water until someone arrives.',
     a.cat = 'drain' and a.sev = 'back'),
    ('P1', 'PLB-03',
     'Someone is coming tonight. A unit with no working toilet does not wait.',
     a.cat = 'drain' and a.sev = 'blocked' and a.fix = 'toilet' and a.only_toilet = 'yes'),
    ('P1', 'HVAC-01',
     'A technician is being dispatched tonight and Chris has been paged.',
     a.cat = 'heat' and a.temp = 'lt60'),
    ('P1', 'ELE-01',
     'An electrician is being called tonight. Leave that circuit switched off until someone has looked at it.',
     a.cat = 'elec' and a.burn = 'yes'),
    ('P1', 'ELE-02',
     'An electrician is being called tonight. Leave the breaker off in the meantime.',
     a.cat = 'elec' and (a.brk = 'retrip' or (a.scope = 'unit' and a.nbr = 'no'))),
    ('P1', 'PLB-04',
     'Someone is on the way. If water is spreading, shut the valve on the pipe entering the top of the heater.',
     a.cat = 'hw' and a.pool = 'yes'),
    ('P1', 'APP-01',
     'Same-day service is being arranged. Keep the doors shut — a full freezer holds about 48 hours.',
     a.cat = 'appl' and a.which = 'fridge' and a.fridge = 'both'),
    ('P1', 'PST-01',
     'An inspection is booked for tomorrow. Please do not move bedding, clothing or furniture to another room — that is how it spreads.',
     a.cat = 'pest' and a.what = 'bed'),

    ('P2', 'HVAC-02',
     'A technician will be scheduled for tomorrow and you will have the window by 8am.',
     a.cat = 'heat'),
    ('P2', 'PLB-05',
     'A plumber will be scheduled for tomorrow and you will have the window by 8am.',
     a.cat = 'hw'),
    ('P2', 'PLB-06',
     'A plumber will be out within two business days. Keep something under it and clear the cabinet.',
     a.cat = 'leak'),
    ('P2', 'PLB-07',
     'A plumber will be out within one business day. Please do not run that fixture meanwhile.',
     a.cat = 'drain' and a.sev = 'blocked'),
    ('P2', 'ELE-03',
     'An electrician will be scheduled within two business days.',
     a.cat = 'elec'),
    ('P2', 'PST-02',
     'Pest control will be scheduled within two business days. Do not spray anything yourself — it scatters them and makes treatment harder.',
     a.cat = 'pest'),

    ('P3', 'APP-02',
     'This gets scheduled within about a week and you will have a window by tomorrow.',
     a.cat = 'appl'),
    ('P3', 'PLB-08',
     'This gets batched with the next visit to your building. Skip the store-bought drain chemicals — they damage the pipes and a plumber still has to snake it.',
     a.cat = 'drain'),
    ('P3', 'DOR-01',
     'Chris will handle this on the next visit to your building.',
     a.cat = 'lock'),
    ('P3', 'GEN-01',
     'Chris reads these himself each morning and will come back to you with a plan.',
     true)
  ) as v(priority, rule_id, sla, matched)
  where v.matched
  limit 1;
$$;

comment on function public.triage_decision(jsonb) is
  'Maintenance triage rules, evaluated in order, first match wins. Pure function — same answers always give the same priority, which is what lets a priority be explained to an owner after the fact.';

-- Replace rather than overload: an added defaulted parameter would make the old
-- seven-argument call ambiguous.
drop function if exists public.submit_maintenance_request(uuid, text, text, text, boolean, text, text);

create or replace function public.submit_maintenance_request(
  p_unit_id uuid,
  p_title text,
  p_description text,
  p_category text default 'General',
  p_entry_permission boolean default false,
  p_pet_on_site text default null,
  p_availability text default null,
  p_answers jsonb default '{}'::jsonb,
  p_trail jsonb default '[]'::jsonb
)
returns work_orders
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_property uuid;
  v_wo public.work_orders;
  v_decision record;
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

  -- Answers come from the browser, so the priority is computed here and the value the
  -- client believes is never read.
  select * into v_decision
  from public.triage_decision(coalesce(p_answers, '{}'::jsonb));

  insert into public.work_orders (
    property_id, unit_id, category, title, description,
    entry_permission, pet_on_site, availability, submitted_by,
    priority, rule_id, triage_answers, is_emergency
  ) values (
    v_property, p_unit_id, left(coalesce(p_category, 'General'), 60), left(p_title, 200),
    left(p_description, 4000), p_entry_permission, left(p_pet_on_site, 500),
    left(p_availability, 500), auth.uid(),
    v_decision.priority, v_decision.rule_id,
    case when jsonb_typeof(p_trail) = 'array' then p_trail else '[]'::jsonb end,
    v_decision.priority = 'P1'
  ) returning * into v_wo;

  return v_wo;
end;
$$;

-- Tenants see the promise, not the internal label. Dropped first: adding a column to
-- the returned row changes the function's return type, which replace cannot do.
drop function if exists public.my_work_orders();

create or replace function public.my_work_orders()
returns table (
  id uuid, number text, unit_id uuid, opened_on date, category text, title text,
  description text, status work_order_status, is_emergency boolean, closed_on date,
  priority wo_priority
)
language sql
stable
security definer
set search_path to ''
as $$
  select w.id, w.number, w.unit_id, w.opened_on, w.category, w.title, w.description,
         -- owners' approval step is internal; tenants just see it as open
         case when w.status in ('awaiting_approval', 'approved', 'declined')
              then 'open'::public.work_order_status else w.status end,
         w.is_emergency, w.closed_on, w.priority
  from public.work_orders w
  where w.unit_id in (select public.my_unit_ids())
  order by w.opened_on desc, w.number desc;
$$;
