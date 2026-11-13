// Staff: post lease paperwork and blank checklists, see what tenants upload, and close
// out move-outs (walkthrough date, deposit refund and statement).
import { useState } from "react";
import { DocumentList, UploadForm } from "../../../components/Documents";
import ResourceTable from "../../../components/ResourceTable";
import { Loading } from "../../../components/Status";
import { KIND_LABEL, staffDelete, staffUpload, type DocumentKind, type DocumentRow } from "../../../lib/documents";
import { fullDate, money } from "../../../lib/format";
import { supabase } from "../../../lib/supabase";
import { useQuery } from "../../../lib/useQuery";
import { useRefs } from "./useRefs";

const LEASE_KINDS: DocumentKind[] = [
  "lease", "addendum", "deposit_statement", "move_in_checklist", "move_out_checklist", "renters_insurance", "other",
];
const TEMPLATE_KINDS: DocumentKind[] = ["move_in_template", "move_out_template"];

export function StaffDocuments() {
  const refs = useRefs();
  const [target, setTarget] = useState<string>("templates");
  const isTemplates = target === "templates";
  const docs = useQuery<DocumentRow[]>(
    async () => {
      const q = supabase.from("documents").select("*").order("created_at", { ascending: false });
      return await (isTemplates ? q.in("kind", TEMPLATE_KINDS) : q.eq("lease_id", target));
    },
    [target],
  );
  const recent = useQuery<DocumentRow[]>(
    async () =>
      await supabase.from("documents").select("*").eq("uploaded_by_role", "tenant").order("created_at", { ascending: false }).limit(25),
    [],
  );
  const leaseLabel = new Map((refs.data?.leases ?? []).map((o) => [o.value, o.label]));
  const [error, setError] = useState<string | null>(null);

  async function remove(d: DocumentRow) {
    setError(null);
    try {
      await staffDelete(d);
      docs.reload();
      recent.reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p className="sub">
            Post the signed lease and addenda to each lease, and the blank checklists every tenant downloads. Tenants and
            the owner see a lease's files; nobody else does.
          </p>
        </div>
        <div className="controls">
          <label className="field">
            <span>Files for</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="templates">Blank checklists (all tenants)</option>
              {(refs.data?.leases ?? []).map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <Loading error={refs.error} />

      <div className="card">
        <h2>{isTemplates ? "Blank checklists" : leaseLabel.get(target) ?? "Lease files"}</h2>
        {error && <p className="form-msg err">{error}</p>}
        <Loading error={docs.error} loading={docs.loading && !docs.data} />
        {docs.data && <DocumentList docs={docs.data} onDelete={remove} empty={isTemplates ? "No blank checklists posted yet." : "No files on this lease yet."} />}
        <h3 className="sub-h">Add a file</h3>
        <UploadForm
          key={target}
          kinds={isTemplates ? TEMPLATE_KINDS : LEASE_KINDS}
          askExpiry
          defaultTitle={(k) => KIND_LABEL[k].replace(" (blank)", "")}
          onUpload={async (v) => {
            await staffUpload(isTemplates ? { template: true } : { leaseId: target }, v.file, v);
            docs.reload();
          }}
        />
      </div>

      <div className="card">
        <h2>Recent tenant uploads</h2>
        <Loading error={recent.error} />
        {recent.data && recent.data.length === 0 && <p className="muted">Nothing yet.</p>}
        {recent.data && recent.data.length > 0 && (
          <>
            <p className="muted" style={{ fontSize: ".85rem", marginBottom: 8 }}>
              Maintenance photos show on the work order; everything else is listed here.
            </p>
            <DocumentList docs={recent.data.filter((d) => d.kind !== "maintenance_photo")} />
          </>
        )}
      </div>
    </>
  );
}

export function StaffMoveOuts() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Move-outs</h1>
          <p className="sub">
            Notices tenants give in the portal. Schedule the walkthrough, and once the deposit is settled record the
            amounts and post the itemized statement under Documents. Wisconsin's deadline is 21 days after move-out.
          </p>
        </div>
      </div>
      <ResourceTable
        table="move_outs"
        title="Notices"
        canCreate={false}
        select="*, leases(deposit, units(label, properties(address)), lease_tenants(tenants(full_name)))"
        order={[{ column: "move_out_date" }]}
        columns={[
          {
            key: "lease",
            label: "Lease",
            form: false,
            render: (r) => {
              const l = r.leases as {
                deposit: number;
                units: { label: string; properties: { address: string } | null } | null;
                lease_tenants: { tenants: { full_name: string } | null }[];
              } | null;
              return (
                <>
                  <b>{l?.units?.properties?.address}{l?.units?.label ? ` — ${l.units.label}` : ""}</b>
                  <div className="muted">{l?.lease_tenants.map((x) => x.tenants?.full_name).filter(Boolean).join(", ")}</div>
                  <div className="muted">Deposit {money(l?.deposit)}</div>
                </>
              );
            },
          },
          { key: "submitted_at", label: "Notice", form: false, render: (r) => fullDate(String(r.submitted_at).slice(0, 10)) },
          { key: "move_out_date", label: "Move-out", type: "date", required: true, render: (r) => fullDate(r.move_out_date as string) },
          {
            key: "deadline",
            label: "Deposit due",
            form: false,
            render: (r) => {
              const d = new Date(`${r.move_out_date}T00:00:00`);
              d.setDate(d.getDate() + 21);
              return r.deposit_statement_sent_on ? <span className="tag ok">Sent {fullDate(r.deposit_statement_sent_on as string)}</span> : d.toLocaleDateString("en-US");
            },
          },
          { key: "forwarding_address", label: "Forwarding address", type: "textarea", render: (r) => <div style={{ whiteSpace: "pre-wrap", maxWidth: 240 }}>{(r.forwarding_address as string) ?? "—"}</div> },
          { key: "walkthrough_requested", label: "Walkthrough requested", type: "bool", list: false },
          {
            key: "walkthrough_on",
            label: "Walkthrough",
            type: "date",
            render: (r) => (r.walkthrough_on ? fullDate(r.walkthrough_on as string) : r.walkthrough_requested ? <span className="tag warn">Requested</span> : "—"),
          },
          { key: "tenant_note", label: "Tenant note", form: false, list: false },
          { key: "deposit_withheld", label: "Withheld", type: "money" },
          { key: "deposit_refund", label: "Refunded", type: "money" },
          { key: "deposit_statement_sent_on", label: "Statement sent", type: "date", list: false, hint: "Once set, the tenant can no longer change their notice in the portal." },
        ]}
      />
    </>
  );
}
