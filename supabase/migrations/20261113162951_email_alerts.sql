-- Email alerts.
--
-- Database triggers write messages to public.email_outbox as things happen. The
-- send-emails Edge Function (supabase/functions/send-emails) delivers them; pg_cron
-- calls it once a minute while anything is waiting. Nothing here sends mail itself, so
-- a slow or failing mail server never blocks a tenant's request or a staff edit.
--
-- Who hears about what:
--   staff   new maintenance request (urgent ones flagged), owner approved/declined a bid,
--           move-out notice or change, tenant uploaded a document, quote request,
--           rental application
--   owner   a bid is waiting for their approval, a tenant gave notice
--   tenant  their request was scheduled or completed, lease paperwork or deposit
--           statement posted, walkthrough scheduled, deposit settled

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Settings and outbox
-- ---------------------------------------------------------------------------
create table public.app_settings (
  key text primary key,
  value text,
  note text
);
alter table public.app_settings enable row level security;
create policy staff_all on public.app_settings for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

insert into public.app_settings (key, value, note) values
  ('portal_url', 'https://csuchomski.github.io/DH-Property-Management/portal', 'Links in alert emails point here.'),
  ('staff_alert_emails', null, 'Comma-separated addresses for staff alerts. Empty means every staff account.');

create table public.email_outbox (
  id bigint generated always as identity primary key,
  event text not null,
  to_email text not null check (to_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  subject text not null,
  body_text text not null,
  body_html text not null,
  created_at timestamptz not null default now(),
  send_after timestamptz not null default now(),
  attempts int not null default 0,
  sent_at timestamptz,
  last_error text
);
create index email_outbox_pending_idx on public.email_outbox (send_after) where sent_at is null;
alter table public.email_outbox enable row level security;
-- Staff can see what went out (and what failed); only the sender function changes rows.
create policy staff_read on public.email_outbox for select to authenticated
  using ((select public.is_staff()));

-- ---------------------------------------------------------------------------
-- Building and queueing messages
-- ---------------------------------------------------------------------------
create or replace function public.setting(p_key text)
returns text language sql stable security definer set search_path = ''
as $$ select value from public.app_settings where key = p_key $$;

create or replace function public.html_escape(p text)
returns text language sql immutable set search_path = ''
as $$
  select replace(replace(replace(replace(coalesce(p, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;')
$$;

-- One message to one address. p_lines become paragraphs; p_path is a portal page.
create or replace function public.queue_email(p_event text, p_to text, p_subject text, p_lines text[], p_path text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_url text := rtrim(coalesce(public.setting('portal_url'), ''), '/') || coalesce(p_path, '');
  v_text text;
  v_html text;
  v_line text;
begin
  if p_to is null or trim(p_to) !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return;
  end if;
  v_text := array_to_string(p_lines, E'\n\n') || E'\n\nOpen the portal: ' || v_url
            || E'\n\n-- \nDH Property Management';
  v_html := '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#374A5E;max-width:560px">'
            || '<p style="margin:0 0 16px"><span style="display:inline-block;background:#EFB13B;color:#101B2B;font-weight:bold;font-size:12px;line-height:22px;width:24px;text-align:center;border-radius:5px">DH</span>'
            || ' <b style="color:#101B2B">DH Property Management</b></p>';
  foreach v_line in array p_lines loop
    v_html := v_html || '<p style="margin:0 0 12px">' || public.html_escape(v_line) || '</p>';
  end loop;
  v_html := v_html || '<p style="margin:20px 0"><a href="' || public.html_escape(v_url)
            || '" style="display:inline-block;background:#EFB13B;color:#101B2B;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:999px">Open the portal</a></p>'
            || '<p style="font-size:12px;color:#6C7C8D">You get this because you have an account in the DH Property Management portal.</p></div>';
  insert into public.email_outbox (event, to_email, subject, body_text, body_html)
  values (p_event, lower(trim(p_to)), left(p_subject, 200), v_text, v_html);
end;
$$;

create or replace function public.staff_alert_emails()
returns setof text language sql stable security definer set search_path = ''
as $$
  select trim(e) from unnest(string_to_array(public.setting('staff_alert_emails'), ',')) e
  where nullif(trim(e), '') is not null
  union
  select p.email from public.profiles p
  where p.role = 'staff' and p.email is not null
    and nullif(trim(coalesce(public.setting('staff_alert_emails'), '')), '') is null;
$$;

create or replace function public.queue_staff_email(p_event text, p_subject text, p_lines text[], p_path text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare v_to text;
begin
  for v_to in select * from public.staff_alert_emails() loop
    perform public.queue_email(p_event, v_to, p_subject, p_lines, p_path);
  end loop;
end;
$$;

create or replace function public.queue_lease_tenants_email(p_lease uuid, p_event text, p_subject text, p_lines text[], p_path text default '')
returns void language plpgsql security definer set search_path = ''
as $$
declare v_to text;
begin
  for v_to in
    select distinct t.email from public.lease_tenants lt join public.tenants t on t.id = lt.tenant_id
    where lt.lease_id = p_lease and t.email is not null
  loop
    perform public.queue_email(p_event, v_to, p_subject, p_lines, p_path);
  end loop;
end;
$$;

-- "1042 Tallmadge St — B" for a unit, or the property address for common areas.
create or replace function public.place_name(p_property uuid, p_unit uuid)
returns text language sql stable security definer set search_path = ''
as $$
  select p.address || coalesce(nullif(' — ' || u.label, ' — '), '')
  from public.properties p left join public.units u on u.id = p_unit
  where p.id = p_property
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
create or replace function public.alert_work_order()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_place text := public.place_name(new.property_id, new.unit_id);
  v_owner_email text;
  v_lease uuid;
begin
  -- A tenant submitted a request.
  if tg_op = 'INSERT' and new.submitted_by is not null then
    perform public.queue_staff_email(
      'work_order.new',
      case when new.priority = 'P1' then 'URGENT: ' else '' end
        || 'New request ' || coalesce(new.number, '') || ' · ' || v_place || ' · ' || new.title,
      array_remove(array[
        'A tenant submitted a maintenance request.',
        'Where: ' || v_place,
        'What: ' || new.title || coalesce(' (' || new.category || ')', ''),
        case when new.priority is not null then 'Response: ' || new.priority || coalesce(' / ' || new.rule_id, '') end,
        nullif(left(coalesce(new.description, ''), 600), ''),
        case when new.availability is not null then 'Availability: ' || new.availability end,
        case when new.entry_permission then 'Key entry allowed if no one is home.' end
      ], null),
      '/work-orders');
  end if;

  -- A bid needs the owner's approval (a new work order created that way, or one moved there).
  if new.status = 'awaiting_approval'
     and (tg_op = 'INSERT' or new.status is distinct from old.status) then
      select o.email into v_owner_email
      from public.properties p join public.owners o on o.id = p.owner_id where p.id = new.property_id;
      perform public.queue_email(
        'work_order.awaiting_approval', v_owner_email,
        'Approval needed: ' || new.title || coalesce(' · $' || to_char(new.bid_amount, 'FM999,990.00'), ''),
        array_remove(array[
          'A repair at ' || v_place || ' needs your OK before work starts.',
          'What: ' || new.title,
          case when new.bid_amount is not null then 'Bid: $' || to_char(new.bid_amount, 'FM999,990.00') || coalesce(' from ' || new.vendor, '') end,
          'Approve or decline it in your portal.'
        ], null),
        '/work-orders');
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    -- The owner decided.
    if old.status = 'awaiting_approval' and new.status in ('approved', 'declined') then
      perform public.queue_staff_email(
        'work_order.decided',
        'Owner ' || new.status || ' ' || coalesce(new.number, '') || ' · ' || new.title,
        array_remove(array[
          'The owner ' || new.status || ' the bid for ' || new.title || ' at ' || v_place || '.',
          case when new.decision_note is not null then 'Their note: ' || new.decision_note end
        ], null),
        '/work-orders');
    end if;

    -- Tell the tenant when their request is scheduled or done.
    if new.submitted_by is not null and new.unit_id is not null and new.status in ('scheduled', 'closed') then
      for v_lease in
        select l.id from public.leases l where l.unit_id = new.unit_id and l.status <> 'ended'
      loop
        perform public.queue_lease_tenants_email(
          v_lease, 'work_order.' || new.status::text,
          case when new.status = 'scheduled' then 'Your request is scheduled: ' else 'Your request is complete: ' end || new.title,
          array_remove(array[
            case when new.status = 'scheduled'
              then 'Your maintenance request "' || new.title || '" is scheduled. We will confirm the time and give notice before anyone enters.'
              else 'Your maintenance request "' || new.title || '" is marked complete. If it isn''t fixed, reply in the portal or call the office.' end,
            'Request number: ' || coalesce(new.number, '')
          ], null),
          '/maintenance');
      end loop;
    end if;
  end if;
  return new;
end;
$$;

create trigger work_orders_alert
  after insert or update of status on public.work_orders
  for each row execute function public.alert_work_order();

create or replace function public.alert_move_out()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_place text;
  v_owner_email text;
  v_tenants text;
begin
  select public.place_name(u.property_id, u.id), o.email,
         (select string_agg(t.full_name, ', ') from public.lease_tenants lt join public.tenants t on t.id = lt.tenant_id where lt.lease_id = l.id)
    into v_place, v_owner_email, v_tenants
  from public.leases l join public.units u on u.id = l.unit_id
  join public.properties p on p.id = u.property_id join public.owners o on o.id = p.owner_id
  where l.id = new.lease_id;

  if tg_op = 'INSERT' then
    perform public.queue_staff_email(
      'move_out.notice', 'Move-out notice · ' || v_place || ' · ' || to_char(new.move_out_date, 'FMMon FMDD'),
      array_remove(array[
        coalesce(v_tenants, 'The tenant') || ' gave notice to move out of ' || v_place || '.',
        'Move-out date: ' || to_char(new.move_out_date, 'FMMonth FMDD, YYYY'),
        case when new.walkthrough_requested then 'They asked for a pre-move-out walkthrough.' end,
        'Forwarding address: ' || coalesce(new.forwarding_address, 'not given'),
        case when new.tenant_note is not null then 'Note: ' || new.tenant_note end
      ], null),
      '/move-outs');
    perform public.queue_email(
      'move_out.notice_owner', v_owner_email, 'Tenant notice · ' || v_place,
      array[
        'Your tenant at ' || v_place || ' gave notice to move out on ' || to_char(new.move_out_date, 'FMMonth FMDD, YYYY') || '.',
        'We will handle the walkthrough, turnover and deposit, and talk with you about pricing and timing for the next lease.'
      ],
      '');
  elsif tg_op = 'UPDATE' then
    if (new.move_out_date, new.forwarding_address, new.walkthrough_requested, new.tenant_note)
       is distinct from (old.move_out_date, old.forwarding_address, old.walkthrough_requested, old.tenant_note)
       and new.deposit_statement_sent_on is null and old.deposit_statement_sent_on is null
       and new.walkthrough_on is not distinct from old.walkthrough_on then
      perform public.queue_staff_email(
        'move_out.changed', 'Move-out details changed · ' || v_place,
        array_remove(array[
          'The tenant updated their move-out details for ' || v_place || '.',
          'Move-out date: ' || to_char(new.move_out_date, 'FMMonth FMDD, YYYY'),
          'Forwarding address: ' || coalesce(new.forwarding_address, 'not given'),
          case when new.walkthrough_requested then 'Walkthrough requested.' end
        ], null),
        '/move-outs');
    end if;
    if new.walkthrough_on is not null and new.walkthrough_on is distinct from old.walkthrough_on then
      perform public.queue_lease_tenants_email(
        new.lease_id, 'move_out.walkthrough', 'Your move-out walkthrough: ' || to_char(new.walkthrough_on, 'FMMonth FMDD'),
        array['Your pre-move-out walkthrough at ' || v_place || ' is set for ' || to_char(new.walkthrough_on, 'FMDay, FMMonth FMDD') || '. We will confirm the time.'],
        '/move-out');
    end if;
    if new.deposit_statement_sent_on is not null and old.deposit_statement_sent_on is null then
      perform public.queue_lease_tenants_email(
        new.lease_id, 'move_out.deposit', 'Your security deposit statement',
        array_remove(array[
          'Your deposit for ' || v_place || ' is settled.',
          case when new.deposit_refund is not null then 'Refunded: $' || to_char(new.deposit_refund, 'FM999,990.00') end,
          case when new.deposit_withheld is not null then 'Withheld: $' || to_char(new.deposit_withheld, 'FM999,990.00') end,
          'The itemized statement is in the portal and in the mail to your forwarding address.'
        ], null),
        '/move-out');
    end if;
  end if;
  return new;
end;
$$;

create trigger move_outs_alert
  after insert or update on public.move_outs
  for each row execute function public.alert_move_out();

create or replace function public.alert_document()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  v_place text := public.place_name(new.property_id, new.unit_id);
  v_label text := case new.kind
    when 'lease' then 'signed lease' when 'addendum' then 'lease addendum'
    when 'move_in_checklist' then 'move-in checklist' when 'move_out_checklist' then 'move-out checklist'
    when 'renters_insurance' then 'renters insurance' when 'deposit_statement' then 'deposit statement'
    else 'file' end;
begin
  if new.uploaded_by_role = 'tenant' and new.kind <> 'maintenance_photo' then
    perform public.queue_staff_email(
      'document.tenant_upload', 'Tenant upload: ' || v_label || ' · ' || coalesce(v_place, ''),
      array_remove(array[
        'A tenant at ' || coalesce(v_place, 'a property') || ' uploaded their ' || v_label || ': "' || new.title || '".',
        case when new.expires_on is not null then 'Policy ends ' || to_char(new.expires_on, 'FMMonth FMDD, YYYY') || '.' end
      ], null),
      '/documents');
  elsif new.lease_id is not null and new.kind in ('lease', 'addendum', 'deposit_statement') and coalesce(new.uploaded_by_role, 'staff') = 'staff' then
    perform public.queue_lease_tenants_email(
      new.lease_id, 'document.posted', 'Your ' || v_label || ' is in the portal',
      array['We posted your ' || v_label || ' ("' || new.title || '") for ' || coalesce(v_place, 'your home') || '. You can view and download it any time.'],
      '/documents');
  end if;
  return new;
end;
$$;

create trigger documents_alert
  after insert on public.documents
  for each row execute function public.alert_document();

create or replace function public.alert_lead()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_table_name = 'quote_requests' then
    perform public.queue_staff_email(
      'lead.quote', 'Quote request · ' || new.name || coalesce(' · ' || new.unit_count || ' units', ''),
      array_remove(array[
        new.name || ' asked for a ' || case when new.service = 'leasing' then 'leasing-only' else 'full management' end || ' quote.',
        'Email: ' || new.email,
        case when new.phone is not null then 'Phone: ' || new.phone end,
        case when new.addresses is not null then 'Properties: ' || new.addresses end,
        nullif(new.message, '')
      ], null),
      '/requests');
  else
    perform public.queue_staff_email(
      'lead.application', 'Rental application · ' || new.full_name,
      array_remove(array[
        new.full_name || ' started a rental application.',
        'Email: ' || new.email,
        case when new.phone is not null then 'Phone: ' || new.phone end,
        case when new.monthly_income is not null then 'Monthly income: $' || to_char(new.monthly_income, 'FM999,990') end,
        nullif(new.message, '')
      ], null),
      '/requests');
  end if;
  return new;
end;
$$;

create trigger quote_requests_alert after insert on public.quote_requests
  for each row execute function public.alert_lead();
create trigger rental_applications_alert after insert on public.rental_applications
  for each row execute function public.alert_lead();

-- ---------------------------------------------------------------------------
-- Delivery: the send-emails function claims a batch, sends, and reports back.
-- Only the service role (the function) can call these.
-- ---------------------------------------------------------------------------
create or replace function public.claim_emails(p_limit int default 20)
returns setof public.email_outbox language sql security definer set search_path = ''
as $$
  update public.email_outbox e
     set attempts = e.attempts + 1,
         -- hold the row while it's being sent; mark_email_result sets the real retry time
         send_after = now() + interval '10 minutes'
   where e.id in (
     select id from public.email_outbox
     where sent_at is null and attempts < 5 and send_after <= now()
     order by id limit greatest(1, least(p_limit, 50))
     for update skip locked
   )
  returning e.*;
$$;

create or replace function public.mark_email_result(p_id bigint, p_ok boolean, p_error text default null)
returns void language sql security definer set search_path = ''
as $$
  update public.email_outbox
     set sent_at = case when p_ok then now() end,
         last_error = case when p_ok then null else left(p_error, 1000) end,
         -- 2, 8, 18, 32 minutes between tries
         send_after = case when p_ok then send_after else now() + make_interval(mins => 2 * attempts * attempts) end
   where id = p_id;
$$;

-- Called by cron: wake the function only when something is due.
create or replace function public.kick_email_sender()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.email_outbox where sent_at is null and attempts < 5 and send_after <= now()) then
    perform net.http_post(
      url := 'https://tnohtkfgaaabiddukaoc.supabase.co/functions/v1/send-emails',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
  end if;
end;
$$;

select cron.schedule('send-emails', '* * * * *', 'select public.kick_email_sender()');

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke execute on function public.setting(text) from public, anon, authenticated;
revoke execute on function public.queue_email(text, text, text, text[], text) from public, anon, authenticated;
revoke execute on function public.staff_alert_emails() from public, anon, authenticated;
revoke execute on function public.queue_staff_email(text, text, text[], text) from public, anon, authenticated;
revoke execute on function public.queue_lease_tenants_email(uuid, text, text, text[], text) from public, anon, authenticated;
revoke execute on function public.place_name(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.alert_work_order() from public, anon, authenticated;
revoke execute on function public.alert_move_out() from public, anon, authenticated;
revoke execute on function public.alert_document() from public, anon, authenticated;
revoke execute on function public.alert_lead() from public, anon, authenticated;
revoke execute on function public.claim_emails(int) from public, anon, authenticated;
revoke execute on function public.mark_email_result(bigint, boolean, text) from public, anon, authenticated;
revoke execute on function public.kick_email_sender() from public, anon, authenticated;
grant execute on function public.claim_emails(int) to service_role;
grant execute on function public.mark_email_result(bigint, boolean, text) to service_role;
