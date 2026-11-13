import { withBase } from "../../../lib/base";
import { DocumentList, UploadForm } from "../../../components/Documents";
import { Loading } from "../../../components/Status";
import { tenantUpload, type DocumentKind, type DocumentRow } from "../../../lib/documents";
import { fullDate, parseDate, todayISO } from "../../../lib/format";
import { SITE } from "../../../lib/site";
import { supabase } from "../../../lib/supabase";
import { useQuery } from "../../../lib/useQuery";
import { leasePlace, loadMyLeases, type TenantLease } from "./tenantData";

const addDays = (iso: string, days: number) => {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export default function TenantDocuments() {
  const leases = useQuery(loadMyLeases, []);
  const docs = useQuery<DocumentRow[]>(
    async () =>
      await supabase.from("documents").select("*").neq("kind", "maintenance_photo").order("created_at", { ascending: false }),
    [],
  );
  const current = leases.data?.filter((l) => l.status !== "ended") ?? [];
  const all = docs.data ?? [];
  const templates = (kind: DocumentKind) => all.filter((d) => d.kind === kind);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Documents</h1>
          <p className="sub">Your signed lease, checklists and insurance, in one place. Only you, DH and your landlord can open these.</p>
        </div>
      </div>
      <Loading error={leases.error ?? docs.error} loading={(leases.loading && !leases.data) || (docs.loading && !docs.data)} />
      {leases.data && current.length === 0 && (
        <p className="notice">We don't have a current lease on file for you. Call {SITE.phone} if that's wrong.</p>
      )}
      {docs.data &&
        current.map((l) => (
          <LeaseDocuments
            key={l.id}
            lease={l}
            docs={all.filter((d) => d.lease_id === l.id)}
            moveInBlank={templates("move_in_template")}
            moveOutBlank={templates("move_out_template")}
            reload={docs.reload}
            multiple={current.length > 1}
          />
        ))}
    </>
  );
}

function LeaseDocuments({
  lease,
  docs,
  moveInBlank,
  moveOutBlank,
  reload,
  multiple,
}: {
  lease: TenantLease;
  docs: DocumentRow[];
  moveInBlank: DocumentRow[];
  moveOutBlank: DocumentRow[];
  reload: () => void;
  multiple: boolean;
}) {
  const of = (...kinds: DocumentKind[]) => docs.filter((d) => kinds.includes(d.kind));
  const upload = (v: { file: File; kind: DocumentKind; title: string; expiresOn: string | null }) =>
    tenantUpload({ leaseId: lease.id }, v.file, v).then(reload);

  // Wisconsin gives a tenant seven days from the start of the tenancy to note existing damage.
  const checkInDue = addDays(lease.start_date, 7);
  const checkInOpen = todayISO() <= checkInDue;
  const insurance = of("renters_insurance");
  const latestEnd = insurance.map((d) => d.expires_on).filter(Boolean).sort().pop() ?? null;
  const soon = addDays(todayISO(), 30);

  return (
    <>
      {multiple && <h2 style={{ marginTop: 26 }}>{leasePlace(lease)}</h2>}

      <div className="card">
        <h2>Lease paperwork</h2>
        <DocumentList docs={of("lease", "addendum")} empty="Your signed lease hasn't been posted yet. The office adds it once everyone has signed." />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Move-in checklist</h2>
          <span className={`tag ${checkInOpen ? "warn" : ""}`}>
            {checkInOpen ? `Due ${fullDate(checkInDue)}` : `Was due ${fullDate(checkInDue)}`}
          </span>
        </div>
        <p className="note-text">
          Walk through the unit, note anything already damaged, and take photos. Wisconsin gives you seven days from
          move-in, and this report is the best protection for your deposit. Download the blank checklist, fill it in,
          then upload it with your photos.
        </p>
        <h3 className="sub-h">Blank checklist</h3>
        <DocumentList docs={moveInBlank} showKind={false} empty="The blank checklist hasn't been posted yet. Ask the office for a copy." />
        <h3 className="sub-h">What you've sent</h3>
        <DocumentList docs={of("move_in_checklist")} showKind={false} empty="Nothing uploaded yet." />
        <UploadForm kinds={["move_in_checklist"]} defaultTitle={() => "Move-in checklist"} buttonLabel="Upload checklist or photo" onUpload={upload} />
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Renters insurance</h2>
          {latestEnd ? (
            <span className={`tag ${latestEnd < todayISO() ? "flag" : latestEnd <= soon ? "warn" : "ok"}`}>
              {latestEnd < todayISO() ? `Ended ${fullDate(latestEnd)}` : `Covered through ${fullDate(latestEnd)}`}
            </span>
          ) : (
            <span className="tag flag">Not on file</span>
          )}
        </div>
        <p className="note-text">
          Your lease requires it. Upload the declarations page, the page listing your name, this address and the
          policy dates, and upload the new one when you renew.
        </p>
        <DocumentList docs={insurance} showKind={false} empty="No policy on file." />
        <UploadForm kinds={["renters_insurance"]} askExpiry defaultTitle={() => "Renters insurance declarations"} buttonLabel="Upload policy" onUpload={upload} />
      </div>

      <div className="card">
        <h2>Move-out checklist</h2>
        <p className="note-text">
          Moving out? Give notice on the <a href={withBase("/portal/move-out")}>Move-out</a> page, then use this checklist before you hand
          back the keys.
        </p>
        <h3 className="sub-h">Blank checklist</h3>
        <DocumentList docs={moveOutBlank} showKind={false} empty="The blank checklist hasn't been posted yet. Ask the office for a copy." />
        <h3 className="sub-h">What you've sent</h3>
        <DocumentList docs={of("move_out_checklist")} showKind={false} empty="Nothing uploaded yet." />
        <UploadForm kinds={["move_out_checklist"]} defaultTitle={() => "Move-out checklist"} buttonLabel="Upload checklist or photo" onUpload={upload} />
      </div>

      {of("deposit_statement").length > 0 && (
        <div className="card">
          <h2>Deposit statement</h2>
          <DocumentList docs={of("deposit_statement")} showKind={false} />
        </div>
      )}

      <div className="card">
        <h2>Other files</h2>
        <DocumentList docs={of("other")} showKind={false} empty="Nothing here." />
        <UploadForm kinds={["other"]} buttonLabel="Upload" onUpload={upload} />
      </div>
    </>
  );
}
