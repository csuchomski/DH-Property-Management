-- Security fix. decide_work_order() checked
--   is_staff() or owner_of_property(...) = my_owner_id()
-- For anyone who isn't an owner, my_owner_id() is null, the comparison is null, and
-- "not (false or null)" is null, which IF treats as false: the check never fired. A
-- signed-in tenant who knew a work order's id (my_work_orders() returns ids for their
-- unit) could approve or decline a bid. Treat an unknown comparison as "not the owner".
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
  if not (public.is_staff()
          or coalesce(public.owner_of_property(v_wo.property_id) = public.my_owner_id(), false)) then
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
