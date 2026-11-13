import { supabase } from "../../../lib/supabase";
import type { Lease, Priority, WorkOrderStatus } from "../../../lib/types";

export type TenantLease = Lease & {
  units: { id: string; label: string; properties: { address: string; city: string } | null } | null;
};

export async function loadMyLeases() {
  const res = await supabase
    .from("leases")
    .select("*, units(id, label, properties(address, city))")
    .order("start_date", { ascending: false });
  return { data: res.data as TenantLease[] | null, error: res.error };
}

export interface MyWorkOrder {
  id: string;
  number: string | null;
  unit_id: string | null;
  opened_on: string;
  category: string;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  is_emergency: boolean;
  closed_on: string | null;
  priority: Priority | null;
}

export const leasePlace = (l: TenantLease) =>
  `${l.units?.properties?.address ?? ""}${l.units?.label ? `, Unit ${l.units.label}` : ""}`;
