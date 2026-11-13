-- Applied to the live project on 2026-11-13 after 20261113001839_maintenance_triage,
-- which first went out without a fixed search_path on triage_decision(). Recorded here
-- exactly as it ran so the repo's migration history matches the database's.
-- (The tenant messages use plain hyphens here; this version is the one that is live.)

create or replace function public.triage_decision(p_answers jsonb)
returns table (priority public.wo_priority, rule_id text, sla text)
language sql
immutable
set search_path to ''
as $fn$
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
     'Same-day service is being arranged. Keep the doors shut - a full freezer holds about 48 hours.',
     a.cat = 'appl' and a.which = 'fridge' and a.fridge = 'both'),
    ('P1', 'PST-01',
     'An inspection is booked for tomorrow. Please do not move bedding, clothing or furniture to another room - that is how it spreads.',
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
     'Pest control will be scheduled within two business days. Do not spray anything yourself - it scatters them and makes treatment harder.',
     a.cat = 'pest'),

    ('P3', 'APP-02',
     'This gets scheduled within about a week and you will have a window by tomorrow.',
     a.cat = 'appl'),
    ('P3', 'PLB-08',
     'This gets batched with the next visit to your building. Skip the store-bought drain chemicals - they damage the pipes and a plumber still has to snake it.',
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
$fn$;
