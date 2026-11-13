-- 20261113001839_maintenance_triage dropped and recreated submit_maintenance_request()
-- and my_work_orders(), and created triage_decision(). New functions get EXECUTE for
-- PUBLIC by default, which undid core_schema's grants: signed-out visitors could call
-- them again. They returned nothing useful without a tenant account, but the portal
-- only calls them signed in, so put the restriction back.
revoke execute on function public.submit_maintenance_request(uuid, text, text, text, boolean, text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.my_work_orders() from public, anon;
revoke execute on function public.triage_decision(jsonb) from public, anon;
grant execute on function public.submit_maintenance_request(uuid, text, text, text, boolean, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.my_work_orders() to authenticated;
grant execute on function public.triage_decision(jsonb) to authenticated;
