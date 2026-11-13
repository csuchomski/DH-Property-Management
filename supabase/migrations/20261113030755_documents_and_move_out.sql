-- Documents (signed leases, addenda, move-in/move-out checklists, renters insurance,
-- deposit statements, maintenance photos) and tenant move-out notices.
--
-- Files live in the private "documents" storage bucket. Paths say what a file belongs to:
--   leases/<lease id>/<random>-<file name>         lease paperwork and tenant uploads
--   work_orders/<work order id>/<random>-<name>    maintenance photos
--   templates/<random>-<file name>                 blank checklists for everyone
-- Each file has a row in public.documents, and a file can be opened only by someone who
-- can see that row: staff everything, owners their properties, tenants their own leases.
-- Tenants upload through tenant_can_upload_to() and register_document(), which only
-- accept paths under their own current lease or their own work orders.

-- ---------------------------------------------------------------------------
-- Documents
-- ---------------------------------------------------------------------------
create type public.document_kind as enum (
  'lease', 'addendum',
  'move_in_template', 'move_out_template',
  'move_in_checklist', 'move_out_checklist',
  'renters_insurance', 'deposit_statement',
  'maintenance_photo', 'other'
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  kind public.document_kind not null,
  title text not null check (length(title) between 1 and 200),
  storage_path text not null unique,
  mime_type text,
  size_bytes bigint,
  lease_id uuid references public.leases(id) on delete cascade,
  work_order_id uuid references public.work_orders(id) on delete cascade,
  -- filled in by trigger from the lease or work order, so owner access is one lookup
  property_id uuid references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  expires_on date,                          -- renters insurance policy end
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_by_role public.app_role,
  created_at timestamptz not null default now(),
  check ((kind in ('move_in_template', 'move_out_template')) = (lease_id is null and work_order_id is null)),
  check ((kind = 'maintenance_photo') = (work_order_id is not null)),
  check (lease_id is null or work_order_id is null)
);
create index on public.documents (lease_id);
create index on public.documents (work_order_id);
create index on public.documents (property_id);
create index on public.documents (unit_id);
create index on public.documents (uploaded_by);

create or replace function public.set_document_location()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.lease_id is not null then
    select u.property_id, u.id into new.property_id, new.unit_id
    from public.leases l join public.units u on u.id = l.unit_id
    where l.id = new.lease_id;
  elsif new.work_order_id is not null then
    select w.property_id, w.unit_id into new.property_id, new.unit_id
    from public.work_orders w where w.id = new.work_order_id;
  else
    new.property_id := null;
    new.unit_id := null;
  end if;
  return new;
end;
$$;

create trigger documents_location
  before insert or update of lease_id, work_order_id on public.documents
  for each row execute function public.set_document_location();

-- Work orders on the signed-in tenant's units (tenants can't select work_orders directly).
create or replace function public.my_work_order_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select w.id from public.work_orders w where w.unit_id in (select public.my_unit_ids());
$$;

-- Leases the signed-in tenant is on that haven't ended: the only ones they can add files to.
create or replace function public.my_current_lease_ids()
returns setof uuid language sql stable security definer set search_path = ''
as $$
  select l.id from public.leases l
  join public.lease_tenants lt on lt.lease_id = l.id
  where lt.tenant_id = public.my_tenant_id() and l.status <> 'ended';
$$;

-- Whether the signed-in tenant may put a file at this storage path.
create or replace function public.tenant_can_upload_to(p_path text)
returns boolean language plpgsql stable security definer set search_path = ''
as $$
declare
  v_root text := split_part(p_path, '/', 1);
  v_id text := split_part(p_path, '/', 2);
begin
  if public.my_tenant_id() is null or split_part(p_path, '/', 3) = '' then
    return false;
  end if;
  if v_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  if v_root = 'leases' then
    return v_id::uuid in (select public.my_current_lease_ids());
  elsif v_root = 'work_orders' then
    return v_id::uuid in (select public.my_work_order_ids());
  end if;
  return false;
end;
$$;

-- A tenant records a file they just uploaded. Staff insert into documents directly.
create or replace function public.register_document(
  p_path text,
  p_kind public.document_kind,
  p_title text,
  p_mime text default null,
  p_size bigint default null,
  p_expires_on date default null
)
returns public.documents language plpgsql security definer set search_path = ''
as $$
declare
  v_doc public.documents;
  v_root text := split_part(p_path, '/', 1);
begin
  if not public.tenant_can_upload_to(p_path) then
    raise exception 'you can only add files to your own current lease or requests';
  end if;
  if p_kind not in ('move_in_checklist', 'move_out_checklist', 'renters_insurance', 'maintenance_photo', 'other') then
    raise exception 'tenants cannot add that kind of document';
  end if;
  if (v_root = 'work_orders') <> (p_kind = 'maintenance_photo') then
    raise exception 'photos belong to a request; lease paperwork belongs to a lease';
  end if;
  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = 'documents' and o.name = p_path and o.owner_id = auth.uid()::text
  ) then
    raise exception 'upload the file before registering it';
  end if;

  insert into public.documents (
    kind, title, storage_path, mime_type, size_bytes, lease_id, work_order_id,
    expires_on, uploaded_by, uploaded_by_role
  ) values (
    p_kind, left(coalesce(nullif(trim(p_title), ''), 'Untitled'), 200), p_path,
    left(p_mime, 120), p_size,
    case when v_root = 'leases' then split_part(p_path, '/', 2)::uuid end,
    case when v_root = 'work_orders' then split_part(p_path, '/', 2)::uuid end,
    case when p_kind = 'renters_insurance' then p_expires_on end,
    auth.uid(), 'tenant'
  ) returning * into v_doc;
  return v_doc;
end;
$$;

alter table public.documents enable row level security;

create policy staff_all on public.documents for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy templates_read on public.documents for select to authenticated
  using (kind in ('move_in_template', 'move_out_template'));
create policy owner_read on public.documents for select to authenticated
  using (property_id is not null and public.owner_of_property(property_id) = (select public.my_owner_id()));
create policy tenant_read on public.documents for select to authenticated
  using (lease_id in (select public.my_lease_ids()) or work_order_id in (select public.my_work_order_ids()));

-- ---------------------------------------------------------------------------
-- Storage bucket and its access rules
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents', 'documents', false, 15728640,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do nothing;

create policy documents_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'documents' and (select public.is_staff()))
  with check (bucket_id = 'documents' and (select public.is_staff()));

-- Opening a file: allowed when the caller can see its documents row (that table's own
-- policies decide), so file access always matches what the portal lists.
create policy documents_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and (
    exists (select 1 from public.documents d where d.storage_path = objects.name)
    -- the uploader's own file in their own folder, between upload and registration
    or (owner_id = (select auth.uid())::text and public.tenant_can_upload_to(name))
  ));

create policy documents_tenant_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.tenant_can_upload_to(name));

-- ---------------------------------------------------------------------------
-- Move-out notices
-- ---------------------------------------------------------------------------
create table public.move_outs (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null unique references public.leases(id) on delete cascade,
  move_out_date date not null,
  forwarding_address text check (length(forwarding_address) <= 500),
  walkthrough_requested boolean not null default false,
  tenant_note text check (length(tenant_note) <= 2000),
  submitted_at timestamptz not null default now(),
  submitted_by uuid references auth.users(id) on delete set null,
  -- staff fill these in
  walkthrough_on date,
  deposit_refund numeric(10,2) check (deposit_refund >= 0),
  deposit_withheld numeric(10,2) check (deposit_withheld >= 0),
  deposit_statement_sent_on date,
  created_at timestamptz not null default now()
);
create index on public.move_outs (submitted_by);

alter table public.move_outs enable row level security;

create policy staff_all on public.move_outs for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy tenant_read on public.move_outs for select to authenticated
  using (lease_id in (select public.my_lease_ids()));
create policy owner_read on public.move_outs for select to authenticated
  using (exists (
    select 1 from public.leases l join public.units u on u.id = l.unit_id
    where l.id = lease_id and public.owner_of_property(u.property_id) = (select public.my_owner_id())
  ));

-- A tenant gives notice, or updates it (date, forwarding address, walkthrough request)
-- until the deposit statement has gone out. Marks the lease as notice given.
create or replace function public.submit_move_out_notice(
  p_lease_id uuid,
  p_move_out_date date,
  p_forwarding_address text,
  p_walkthrough boolean default false,
  p_note text default null
)
returns public.move_outs language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.move_outs;
begin
  if p_lease_id not in (select public.my_current_lease_ids()) then
    raise exception 'no current lease found for this notice';
  end if;
  if p_move_out_date is null or p_move_out_date < current_date then
    raise exception 'pick a move-out date that has not passed';
  end if;
  if exists (select 1 from public.move_outs where lease_id = p_lease_id and deposit_statement_sent_on is not null) then
    raise exception 'your deposit statement has already been sent; call the office to change anything';
  end if;

  insert into public.move_outs (lease_id, move_out_date, forwarding_address, walkthrough_requested, tenant_note, submitted_by)
  values (p_lease_id, p_move_out_date, left(nullif(trim(p_forwarding_address), ''), 500),
          coalesce(p_walkthrough, false), left(nullif(trim(p_note), ''), 2000), auth.uid())
  on conflict (lease_id) do update set
    move_out_date = excluded.move_out_date,
    forwarding_address = excluded.forwarding_address,
    walkthrough_requested = excluded.walkthrough_requested,
    tenant_note = excluded.tenant_note
  returning * into v_row;

  update public.leases
     set status = 'notice_given', notice_date = coalesce(notice_date, current_date)
   where id = p_lease_id and status in ('active', 'renewal_out');

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: everything here is for signed-in users only
-- ---------------------------------------------------------------------------
revoke execute on function public.my_work_order_ids() from public, anon;
revoke execute on function public.my_current_lease_ids() from public, anon;
revoke execute on function public.tenant_can_upload_to(text) from public, anon;
revoke execute on function public.register_document(text, public.document_kind, text, text, bigint, date) from public, anon;
revoke execute on function public.submit_move_out_notice(uuid, date, text, boolean, text) from public, anon;
revoke execute on function public.set_document_location() from public, anon, authenticated;
grant execute on function public.my_work_order_ids() to authenticated;
grant execute on function public.my_current_lease_ids() to authenticated;
grant execute on function public.tenant_can_upload_to(text) to authenticated;
grant execute on function public.register_document(text, public.document_kind, text, text, bigint, date) to authenticated;
grant execute on function public.submit_move_out_notice(uuid, date, text, boolean, text) to authenticated;
