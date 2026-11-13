-- Triage rule tests. Run against any environment after changing triage_decision():
--   psql "$DATABASE_URL" -f supabase/tests/triage_decision_test.sql
-- Prints one row per case and raises if any case regressed, so a reordered rule that
-- quietly downgrades a P1 fails loudly instead of shipping.
--
-- Add a case here before adding a rule. The P1 cases are the ones that matter: every
-- one of them is a situation where waiting until morning causes damage or harm.

\set ON_ERROR_STOP on

with cases(name, answers, expect) as (values
  -- P1: someone goes out tonight
  ('no heat, below 60F',        '{"cat":"heat","temp":"lt60"}'::jsonb,                             'P1/HVAC-01'),
  ('burning smell',             '{"cat":"elec","burn":"yes","scope":"one"}'::jsonb,                'P1/ELE-01'),
  ('breaker will not hold',     '{"cat":"elec","burn":"no","scope":"room","brk":"retrip"}'::jsonb, 'P1/ELE-02'),
  ('unit dark, neighbours on',  '{"cat":"elec","burn":"no","scope":"unit","nbr":"no"}'::jsonb,     'P1/ELE-02'),
  ('water spreading',           '{"cat":"leak","rate":"spread"}'::jsonb,                           'P1/PLB-01'),
  ('leak through a ceiling',    '{"cat":"leak","rate":"drip","where":"ceiling"}'::jsonb,           'P1/PLB-01'),
  ('main line backing up',      '{"cat":"drain","sev":"back"}'::jsonb,                             'P1/PLB-02'),
  ('sole toilet blocked',       '{"cat":"drain","sev":"blocked","fix":"toilet","only":"yes"}'::jsonb,'P1/PLB-03'),
  ('water heater leaking',      '{"cat":"hw","pool":"yes"}'::jsonb,                                'P1/PLB-04'),
  ('fridge and freezer warm',   '{"cat":"appl","which":"fridge","fridge":"both"}'::jsonb,          'P1/APP-01'),
  ('bed bugs',                  '{"cat":"pest","what":"bed"}'::jsonb,                              'P1/PST-01'),
  ('door will not secure',      '{"cat":"lock","secure":"no"}'::jsonb,                             'P1/SEC-01'),

  -- P2: scheduled, next day or two
  ('no heat, above 60F',        '{"cat":"heat","temp":"gt65"}'::jsonb,                             'P2/HVAC-02'),
  ('no hot water, no leak',     '{"cat":"hw","pool":"no","fuel":"gas"}'::jsonb,                    'P2/PLB-05'),
  ('contained sink drip',       '{"cat":"leak","rate":"drip","where":"sink"}'::jsonb,              'P2/PLB-06'),
  ('toilet blocked, has a 2nd', '{"cat":"drain","sev":"blocked","fix":"toilet","only":"no"}'::jsonb,'P2/PLB-07'),
  ('dead outlets after resets', '{"cat":"elec","burn":"no","scope":"one","gfci":"nochange"}'::jsonb,'P2/ELE-03'),
  ('utility outage',            '{"cat":"elec","burn":"no","scope":"unit","nbr":"yes"}'::jsonb,    'P2/ELE-03'),
  ('mice',                      '{"cat":"pest","what":"mice"}'::jsonb,                             'P2/PST-02'),

  -- P3: batched with the next visit to that building
  ('freezer still cold',        '{"cat":"appl","which":"fridge","fridge":"frz"}'::jsonb,           'P3/APP-02'),
  ('slow tub',                  '{"cat":"drain","sev":"slow","fix":"tub"}'::jsonb,                 'P3/PLB-08'),
  ('door sticks but secures',   '{"cat":"lock","secure":"sticks"}'::jsonb,                         'P3/DOR-01'),

  -- Fall through rather than fail: an unknown shape must still produce a ticket
  ('unmatched category',        '{"cat":"other"}'::jsonb,                                          'P3/GEN-01'),
  ('no answers at all',         '{}'::jsonb,                                                       'P3/GEN-01')
),
run as (
  select c.name, c.expect, d.priority || '/' || d.rule_id as got
  from cases c, lateral public.triage_decision(c.answers) d
)
select name, expect, got, case when got = expect then 'ok' else 'MISMATCH' end as result
from run order by expect, name;

do $$
declare v_bad int;
begin
  with cases(answers, expect) as (values
    ('{"cat":"heat","temp":"lt60"}'::jsonb,'P1/HVAC-01'),
    ('{"cat":"elec","burn":"yes"}'::jsonb,'P1/ELE-01'),
    ('{"cat":"elec","brk":"retrip"}'::jsonb,'P1/ELE-02'),
    ('{"cat":"elec","scope":"unit","nbr":"no"}'::jsonb,'P1/ELE-02'),
    ('{"cat":"leak","rate":"spread"}'::jsonb,'P1/PLB-01'),
    ('{"cat":"leak","where":"ceiling"}'::jsonb,'P1/PLB-01'),
    ('{"cat":"drain","sev":"back"}'::jsonb,'P1/PLB-02'),
    ('{"cat":"drain","sev":"blocked","fix":"toilet","only":"yes"}'::jsonb,'P1/PLB-03'),
    ('{"cat":"hw","pool":"yes"}'::jsonb,'P1/PLB-04'),
    ('{"cat":"appl","which":"fridge","fridge":"both"}'::jsonb,'P1/APP-01'),
    ('{"cat":"pest","what":"bed"}'::jsonb,'P1/PST-01'),
    ('{"cat":"lock","secure":"no"}'::jsonb,'P1/SEC-01'),
    ('{"cat":"heat","temp":"gt65"}'::jsonb,'P2/HVAC-02'),
    ('{"cat":"hw","pool":"no"}'::jsonb,'P2/PLB-05'),
    ('{"cat":"leak","rate":"drip","where":"sink"}'::jsonb,'P2/PLB-06'),
    ('{"cat":"drain","sev":"blocked","fix":"toilet","only":"no"}'::jsonb,'P2/PLB-07'),
    ('{"cat":"elec","burn":"no","scope":"one"}'::jsonb,'P2/ELE-03'),
    ('{"cat":"elec","scope":"unit","nbr":"yes"}'::jsonb,'P2/ELE-03'),
    ('{"cat":"pest","what":"mice"}'::jsonb,'P2/PST-02'),
    ('{"cat":"appl","which":"fridge","fridge":"frz"}'::jsonb,'P3/APP-02'),
    ('{"cat":"drain","sev":"slow"}'::jsonb,'P3/PLB-08'),
    ('{"cat":"lock","secure":"sticks"}'::jsonb,'P3/DOR-01'),
    ('{"cat":"other"}'::jsonb,'P3/GEN-01'),
    ('{}'::jsonb,'P3/GEN-01')
  )
  select count(*) into v_bad
  from cases c, lateral public.triage_decision(c.answers) d
  where d.priority || '/' || d.rule_id <> c.expect;

  if v_bad > 0 then
    raise exception 'triage_decision: % case(s) regressed', v_bad;
  end if;
  raise notice 'triage_decision: all cases pass';
end $$;
