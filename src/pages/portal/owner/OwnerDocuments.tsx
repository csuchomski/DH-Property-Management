import { DocumentList } from "../../../components/Documents";
import { useOwnerSelection } from "../../../components/OwnerPicker";
import { Loading } from "../../../components/Status";
import type { DocumentRow } from "../../../lib/documents";
import { supabase } from "../../../lib/supabase";
import { useQuery } from "../../../lib/useQuery";

type OwnerDoc = DocumentRow & { properties: { address: string; city: string } | null; units: { label: string } | null };

// Leases, addenda, checklists, insurance and deposit statements, filed by property and unit.
// Maintenance photos show on the work orders instead.
export default function OwnerDocuments() {
  const { ownerId, picker } = useOwnerSelection();
  const docs = useQuery<OwnerDoc[]>(
    async () =>
      ownerId
        ? await supabase
            .from("documents")
            .select("*, properties!inner(owner_id, address, city), units(label)")
            .eq("properties.owner_id", ownerId)
            .neq("kind", "maintenance_photo")
            .order("created_at", { ascending: false })
        : { data: [], error: null },
    [ownerId],
  );

  const groups = new Map<string, OwnerDoc[]>();
  for (const d of docs.data ?? []) {
    const key = `${d.properties?.address ?? ""}${d.units?.label ? ` — Unit ${d.units.label}` : ""}`;
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const keys = [...groups.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p className="sub">Leases, addenda, tenant checklists, insurance and deposit statements, filed by unit.</p>
        </div>
        <div className="controls">{picker}</div>
      </div>
      <Loading error={docs.error} loading={docs.loading && !docs.data} />
      {docs.data && keys.length === 0 && <p className="notice">No documents posted yet.</p>}
      {keys.map((k) => (
        <div className="card" key={k}>
          <h2>{k}</h2>
          <DocumentList docs={groups.get(k)!} />
        </div>
      ))}
    </>
  );
}
