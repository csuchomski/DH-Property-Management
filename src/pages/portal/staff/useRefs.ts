import type { Option } from "../../../components/ResourceTable";
import { supabase } from "../../../lib/supabase";
import { useQuery } from "../../../lib/useQuery";

type U = { id: string; label: string; property_id: string; properties: { address: string } | null };
type L = {
  id: string;
  status: string;
  unit_id: string;
  units: { label: string; properties: { address: string } | null } | null;
  lease_tenants: { tenants: { full_name: string } | null }[];
};

const unitLabel = (u: { label: string; properties: { address: string } | null } | null) =>
  u ? `${u.properties?.address ?? ""}${u.label ? ` — ${u.label}` : ""}` : "";

export interface Refs {
  owners: Option[];
  properties: Option[];
  units: Option[];
  tenants: Option[];
  leases: Option[];
  unitProperty: Map<string, string>;
  leaseUnit: Map<string, string>;
}

// Dropdown options for the staff forms: owners, properties, units, tenants, leases.
export function useRefs() {
  return useQuery<Refs>(async () => {
    const [owners, properties, units, tenants, leases] = await Promise.all([
      supabase.from("owners").select("id, name").order("name"),
      supabase.from("properties").select("id, address, city").order("address"),
      supabase.from("units").select("id, label, property_id, properties(address)"),
      supabase.from("tenants").select("id, full_name").order("full_name"),
      supabase
        .from("leases")
        .select("id, status, unit_id, units(label, properties(address)), lease_tenants(tenants(full_name))")
        .order("start_date", { ascending: false }),
    ]);
    const error = owners.error ?? properties.error ?? units.error ?? tenants.error ?? leases.error;
    if (error) return { data: null, error };

    const unitRows = (units.data ?? []) as unknown as U[];
    const leaseRows = (leases.data ?? []) as unknown as L[];
    return {
      data: {
        owners: (owners.data ?? []).map((o) => ({ value: o.id, label: o.name })),
        properties: (properties.data ?? []).map((p) => ({ value: p.id, label: `${p.address}, ${p.city}` })),
        units: unitRows
          .map((u) => ({ value: u.id, label: unitLabel(u) }))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
        tenants: (tenants.data ?? []).map((t) => ({ value: t.id, label: t.full_name })),
        leases: leaseRows.map((l) => ({
          value: l.id,
          label: `${unitLabel(l.units)} · ${
            (l.lease_tenants ?? []).map((x) => x.tenants?.full_name).filter(Boolean).join(", ") || "no tenant"
          }${l.status === "ended" ? " (ended)" : ""}`,
        })),
        unitProperty: new Map(unitRows.map((u) => [u.id, u.property_id])),
        leaseUnit: new Map(leaseRows.map((l) => [l.id, l.unit_id])),
      },
      error: null,
    };
  }, []);
}
