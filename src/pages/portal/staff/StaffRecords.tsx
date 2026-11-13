// Staff back office: record-keeping screens built on ResourceTable.
import { useState } from "react";
import ResourceTable, { type Column, type Option } from "../../../components/ResourceTable";
import { LeaseTag, Loading, PriorityTag, WorkOrderTag } from "../../../components/Status";
import { fullDate, nextMonth, pct, shortDate, todayISO } from "../../../lib/format";
import { supabase } from "../../../lib/supabase";
import {
  CATEGORY_LABEL,
  DISBURSEMENT_CATEGORIES,
  LEASE_STATUS_LABEL,
  RECEIPT_CATEGORIES,
  WO_STATUS_LABEL,
  type LeaseStatus,
  type Priority,
  type WorkOrderStatus,
} from "../../../lib/types";
import { useQuery } from "../../../lib/useQuery";
import { useRefs, type Refs } from "./useRefs";

const opts = (xs: readonly string[], labels?: Record<string, string>): Option[] =>
  xs.map((x) => ({ value: x, label: labels?.[x] ?? x }));

function WithRefs({ children }: { children: (refs: Refs, reload: () => void) => React.ReactNode }) {
  const refs = useRefs();
  if (!refs.data) return <Loading error={refs.error} loading />;
  return <>{children(refs.data, refs.reload)}</>;
}

function Head({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
    </div>
  );
}

export function StaffOwners() {
  return (
    <>
      <Head title="Owners" sub="The entity that holds title, its fee rate, and how it wants to be reached." />
      <ResourceTable
        table="owners"
        title="Owners"
        order={[{ column: "name" }]}
        columns={[
          { key: "name", label: "Entity", required: true, placeholder: "Kettle Ridge Holdings LLC" },
          { key: "contact_name", label: "Contact" },
          {
            key: "email",
            label: "Email",
            hint: "The owner signs in to the portal with this address.",
          },
          { key: "phone", label: "Phone", list: false },
          {
            key: "mgmt_rate",
            label: "Fee rate",
            type: "number",
            step: "0.0001",
            required: true,
            default: 0.09,
            hint: "0.09 = 9%. Tiers: 1–3 units 9%, 4–9 units 8%, 10–20 units 7%.",
            render: (r) => pct(Number(r.mgmt_rate)),
          },
          { key: "approval_threshold", label: "Approval threshold", type: "money", required: true, default: 500 },
          { key: "reserve_target", label: "Reserve target", type: "money", required: true, default: 1500, list: false },
          { key: "ach_last4", label: "ACH last 4", list: false, placeholder: "4417" },
          { key: "notes", label: "Notes", type: "textarea", list: false },
        ]}
      />
    </>
  );
}

export function StaffProperties() {
  return (
    <WithRefs>
      {(refs, reload) => (
        <>
          <Head title="Properties" />
          <ResourceTable
            table="properties"
            title="Properties"
            order={[{ column: "address" }]}
            onSaved={reload}
            columns={[
              { key: "owner_id", label: "Owner", options: refs.owners, required: true },
              { key: "address", label: "Street address", required: true },
              { key: "city", label: "City", required: true },
              { key: "state", label: "State", default: "WI", required: true, list: false },
              { key: "zip", label: "ZIP", list: false },
              { key: "kind", label: "Type", placeholder: "Duplex, four-plex, single family…" },
              { key: "year_built", label: "Built", type: "number", step: "1" },
              { key: "notes", label: "Notes", type: "textarea", list: false },
            ]}
          />
        </>
      )}
    </WithRefs>
  );
}

const UNIT_STATUS: Option[] = [
  { value: "occupied", label: "Occupied" },
  { value: "vacant", label: "Vacant" },
  { value: "turnover", label: "Turnover" },
  { value: "listed", label: "Listed (shows on /rentals)" },
];

export function StaffUnits() {
  return (
    <WithRefs>
      {(refs, reload) => (
        <>
          <Head title="Units" sub="Set a unit to Listed with an asking rent to publish it on the rentals page." />
          <ResourceTable
            table="units"
            title="Units"
            select="*, properties(address)"
            order={[{ column: "property_id" }, { column: "label" }]}
            onSaved={reload}
            columns={[
              { key: "property_id", label: "Property", options: refs.properties, required: true },
              { key: "label", label: "Unit", hint: "Leave blank for a single-family house.", default: "" },
              { key: "beds", label: "Beds", type: "number", step: "0.5" },
              { key: "baths", label: "Baths", type: "number", step: "0.5" },
              { key: "market_rent", label: "Market rent", type: "money" },
              { key: "status", label: "Status", options: UNIT_STATUS, required: true, default: "vacant" },
              { key: "asking_rent", label: "Asking rent", type: "money", list: false },
              { key: "available_on", label: "Available", type: "date", list: false },
              { key: "listing_title", label: "Listing headline", list: false },
              { key: "listing_description", label: "Listing description", type: "textarea", list: false },
              { key: "pets_allowed", label: "Pets considered", type: "bool", list: false },
            ]}
            transform={(v) => ({ ...v, label: v.label ?? "" })}
          />
        </>
      )}
    </WithRefs>
  );
}

export function StaffTenants() {
  return (
    <>
      <Head title="Tenants" sub="A tenant signs in with the email on their record." />
      <ResourceTable
        table="tenants"
        title="Tenants"
        order={[{ column: "full_name" }]}
        columns={[
          { key: "full_name", label: "Name", required: true },
          { key: "email", label: "Email" },
          { key: "phone", label: "Phone" },
        ]}
      />
    </>
  );
}

const LEASE_STATUS = opts(["active", "notice_given", "renewal_out", "ended"], LEASE_STATUS_LABEL);

export function StaffLeases() {
  return (
    <WithRefs>
      {(refs, reload) => (
        <>
          <Head title="Leases" sub="Create the lease, then attach one or more tenants to it below." />
          <ResourceTable
            table="leases"
            title="Leases"
            select="*, units(label, properties(address)), lease_tenants(tenants(full_name))"
            order={[{ column: "start_date", ascending: false }]}
            onSaved={reload}
            columns={[
              { key: "unit_id", label: "Unit", options: refs.units, required: true },
              {
                key: "tenants",
                label: "Tenants",
                form: false,
                render: (r) =>
                  (r.lease_tenants as { tenants: { full_name: string } | null }[])
                    .map((x) => x.tenants?.full_name)
                    .filter(Boolean)
                    .join(", ") || <span className="muted">none attached</span>,
              },
              { key: "start_date", label: "Start", type: "date", required: true, render: (r) => fullDate(r.start_date as string) },
              { key: "end_date", label: "End", type: "date", render: (r) => fullDate(r.end_date as string | null) },
              { key: "rent", label: "Rent", type: "money", required: true },
              { key: "deposit", label: "Deposit", type: "money", required: true, default: 0 },
              { key: "late_fee", label: "Late fee", type: "money", required: true, default: 0, list: false },
              { key: "grace_days", label: "Grace days", type: "number", step: "1", required: true, default: 5, list: false },
              {
                key: "status",
                label: "Status",
                options: LEASE_STATUS,
                required: true,
                default: "active",
                render: (r) => <LeaseTag status={r.status as LeaseStatus} />,
              },
              { key: "notice_date", label: "Notice date", type: "date", list: false },
            ]}
          />
          <LeaseTenants refs={refs} onChange={reload} />
        </>
      )}
    </WithRefs>
  );
}

function LeaseTenants({ refs, onChange }: { refs: Refs; onChange: () => void }) {
  const [lease, setLease] = useState("");
  const [tenant, setTenant] = useState("");
  const [error, setError] = useState<string | null>(null);
  const links = useQuery<{ lease_id: string; tenant_id: string }[]>(
    async () => await supabase.from("lease_tenants").select("lease_id, tenant_id"),
    [],
  );
  const leaseLabel = new Map(refs.leases.map((o) => [o.value, o.label]));
  const tenantLabel = new Map(refs.tenants.map((o) => [o.value, o.label]));

  async function add() {
    setError(null);
    const { error } = await supabase.from("lease_tenants").insert({ lease_id: lease, tenant_id: tenant });
    if (error) setError(error.message);
    else {
      links.reload();
      onChange();
    }
  }
  async function remove(l: { lease_id: string; tenant_id: string }) {
    const { error } = await supabase.from("lease_tenants").delete().eq("lease_id", l.lease_id).eq("tenant_id", l.tenant_id);
    if (error) setError(error.message);
    else {
      links.reload();
      onChange();
    }
  }

  return (
    <div className="card">
      <h2>Tenants on each lease</h2>
      <div className="form">
        <div className="row">
          <label className="field">
            <span>Lease</span>
            <select value={lease} onChange={(e) => setLease(e.target.value)}>
              <option value="">Choose…</option>
              {refs.leases.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Tenant</span>
            <select value={tenant} onChange={(e) => setTenant(e.target.value)}>
              <option value="">Choose…</option>
              {refs.tenants.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="form-msg err">{error}</p>}
        <div>
          <button className="btn btn-primary btn-xs" disabled={!lease || !tenant} onClick={() => void add()}>
            Attach tenant to lease
          </button>
        </div>
      </div>
      <Loading error={links.error} />
      {!!links.data?.length && (
        <div className="tbl-wrap" style={{ marginTop: 14 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Lease</th>
                <th>Tenant</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {links.data
                .map((l) => ({ ...l, ll: leaseLabel.get(l.lease_id) ?? "", tl: tenantLabel.get(l.tenant_id) ?? "" }))
                .sort((a, b) => a.ll.localeCompare(b.ll, undefined, { numeric: true }))
                .map((l) => (
                  <tr key={l.lease_id + l.tenant_id}>
                    <td>{l.ll.split(" · ")[0]}</td>
                    <td>{l.tl}</td>
                    <td className="actions">
                      <button className="link-btn" style={{ color: "var(--clay)" }} onClick={() => void remove(l)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const CATEGORY_OPTIONS: Option[] = [
  ...RECEIPT_CATEGORIES.map((c) => ({ value: c, label: `Receipt · ${CATEGORY_LABEL[c]}` })),
  ...DISBURSEMENT_CATEGORIES.map((c) => ({ value: c, label: `Disbursement · ${CATEGORY_LABEL[c]}` })),
];

// Pick the unit (or lease) and the property is filled in; property alone = common area.
function deriveLocation(refs: Refs, v: Record<string, unknown>) {
  const out = { ...v };
  if (out.lease_id && !out.unit_id) out.unit_id = refs.leaseUnit.get(out.lease_id as string) ?? null;
  if (out.unit_id) {
    const prop = refs.unitProperty.get(out.unit_id as string);
    if (out.property_id && out.property_id !== prop) throw new Error("That unit belongs to a different property.");
    out.property_id = prop;
  }
  if (!out.property_id) throw new Error("Choose a unit, or a property for common-area items.");
  return out;
}

export function StaffTransactions() {
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const from = `${month}-01`;
  return (
    <WithRefs>
      {(refs) => (
        <>
          <div className="page-head">
            <div>
              <h1>Ledger</h1>
              <p className="sub">
                Rent and fees received, and money paid out on owners' behalf. Statements and tax summaries are built
                from these rows.
              </p>
            </div>
            <div className="controls">
              <label className="field">
                <span>Month</span>
                <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
              </label>
            </div>
          </div>
          <MonthLedger refs={refs} from={from} month={month} />
        </>
      )}
    </WithRefs>
  );
}

function MonthLedger({ refs, from, month }: { refs: Refs; from: string; month: string }) {
  const unitLabel = new Map(refs.units.map((o) => [o.value, o.label]));
  const propLabel = new Map(refs.properties.map((o) => [o.value, o.label]));
  const columns: Column[] = [
    { key: "txn_date", label: "Date", type: "date", required: true, default: todayISO(), render: (r) => shortDate(r.txn_date as string) },
    { key: "category", label: "Category", options: CATEGORY_OPTIONS, required: true, render: (r) => CATEGORY_LABEL[r.category as string] ?? String(r.category) },
    { key: "kind", label: "Kind", list: false, form: false },
    {
      key: "where",
      label: "Unit",
      form: false,
      render: (r) => (r.unit_id ? unitLabel.get(r.unit_id as string) : `${propLabel.get(r.property_id as string)} — common`),
    },
    { key: "lease_id", label: "Lease", options: refs.leases, list: false, hint: "For rent and late fees, pick the lease; unit and property fill in." },
    { key: "unit_id", label: "Unit", options: refs.units, list: false },
    { key: "property_id", label: "Property", options: refs.properties, list: false, hint: "Only needed for common-area items." },
    { key: "payee_payer", label: "Tenant / vendor" },
    { key: "description", label: "Description" },
    { key: "method", label: "Method", placeholder: "Autopay, bank transfer, check…", list: false },
    { key: "reference", label: "Ref", placeholder: "INV 4821, WO-2608-02" },
    { key: "amount", label: "Amount", type: "money", required: true },
  ];
  return (
    <ResourceTable
      table="transactions"
      title="Transactions"
      createLabel="Record a transaction"
      order={[{ column: "txn_date" }, { column: "created_at" }]}
      range={{ column: "txn_date", from, to: nextMonth(month) }}
      columns={columns}
      transform={(v) => {
        const out = deriveLocation(refs, v);
        out.kind = (RECEIPT_CATEGORIES as readonly string[]).includes(out.category as string) ? "receipt" : "disbursement";
        return out;
      }}
      intro={<MonthFilterNote from={from} />}
    />
  );
}

function MonthFilterNote({ from }: { from: string }) {
  return (
    <p className="muted" style={{ fontSize: ".85rem", marginBottom: 10 }}>
      Showing {new Date(`${from}T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.
    </p>
  );
}

const WO_STATUS = opts(["open", "awaiting_approval", "approved", "declined", "scheduled", "closed"], WO_STATUS_LABEL);

export function StaffWorkOrders() {
  const [show, setShow] = useState<"open" | "all">("open");
  return (
    <WithRefs>
      {(refs) => {
        const unitLabel = new Map(refs.units.map((o) => [o.value, o.label]));
        const propLabel = new Map(refs.properties.map((o) => [o.value, o.label]));
        return (
          <>
            <div className="page-head">
              <div>
                <h1>Work orders</h1>
                <p className="sub">
                  Anything over the owner's threshold goes to Awaiting approval with a bid; the owner approves it in their
                  portal.
                </p>
              </div>
              <div className="controls">
                <label className="field">
                  <span>Show</span>
                  <select value={show} onChange={(e) => setShow(e.target.value as "open" | "all")}>
                    <option value="open">Not closed</option>
                    <option value="all">All</option>
                  </select>
                </label>
              </div>
            </div>
            <ResourceTable
              table="work_orders"
              title="Work orders"
              createLabel="Open a work order"
              order={[{ column: "opened_on", ascending: false }, { column: "number", ascending: false }]}
              key={show}
              notIn={show === "open" ? { column: "status", values: ["closed", "declined"] } : undefined}
              transform={(v) => deriveLocation(refs, v)}
              columns={[
                { key: "number", label: "WO", form: false },
                { key: "opened_on", label: "Opened", type: "date", required: true, default: todayISO(), render: (r) => shortDate(r.opened_on as string) },
                { key: "unit_id", label: "Unit", options: refs.units, list: false, hint: "Leave blank for common areas and pick the property." },
                { key: "property_id", label: "Property", options: refs.properties, list: false },
                {
                  key: "where",
                  label: "Where",
                  form: false,
                  render: (r) => (r.unit_id ? unitLabel.get(r.unit_id as string) : `${propLabel.get(r.property_id as string)} — common`),
                },
                { key: "category", label: "Category", required: true, default: "General" },
                { key: "title", label: "Summary", required: true },
                { key: "description", label: "Details", type: "textarea", list: false },
                {
                  // Set by triage when a tenant submits; blank on work orders staff open here.
                  key: "priority",
                  label: "Response",
                  form: false,
                  render: (r) => (
                    <>
                      <PriorityTag priority={(r.priority as Priority | null) ?? null} />
                      {r.rule_id ? <div className="rule-chip">{r.rule_id as string}</div> : null}
                    </>
                  ),
                },
                { key: "vendor", label: "Vendor" },
                {
                  key: "status",
                  label: "Status",
                  options: WO_STATUS,
                  required: true,
                  default: "open",
                  render: (r) => <WorkOrderTag status={r.status as WorkOrderStatus} />,
                },
                { key: "bid_amount", label: "Bid", type: "money" },
                { key: "cost", label: "Final cost", type: "money" },
                { key: "closed_on", label: "Closed", type: "date", list: false },
                { key: "is_emergency", label: "Emergency", type: "bool", list: false },
                { key: "availability", label: "Tenant availability", list: false },
                { key: "pet_on_site", label: "Pet on site", list: false },
                { key: "entry_permission", label: "Tenant allows key entry", type: "bool", list: false },
                { key: "decision_note", label: "Owner note", form: false, list: false },
              ]}
            />
          </>
        );
      }}
    </WithRefs>
  );
}

const REQUEST_STATUS = opts(["new", "contacted", "closed"], { new: "New", contacted: "Contacted", closed: "Closed" });
const APP_STATUS = opts(["submitted", "screening", "approved", "declined", "withdrawn"], {
  submitted: "Submitted",
  screening: "Screening",
  approved: "Approved",
  declined: "Declined",
  withdrawn: "Withdrawn",
});

export function StaffLeads() {
  return (
    <WithRefs>
      {(refs) => (
        <>
          <Head title="Leads" sub="Quote requests from owners and rental applications from the website." />
          <ResourceTable
            table="quote_requests"
            title="Quote requests"
            canCreate={false}
            order={[{ column: "created_at", ascending: false }]}
            columns={[
              { key: "created_at", label: "Received", form: false, render: (r) => shortDate(r.created_at as string) },
              { key: "name", label: "Name", form: false },
              {
                key: "contact",
                label: "Contact",
                form: false,
                render: (r) => (
                  <>
                    <a href={`mailto:${r.email}`}>{String(r.email)}</a>
                    {r.phone ? <div>{String(r.phone)}</div> : null}
                  </>
                ),
              },
              { key: "service", label: "Service", form: false, render: (r) => (r.service === "leasing" ? "Leasing only" : "Full") },
              { key: "unit_count", label: "Units", type: "number", form: false },
              {
                key: "addresses",
                label: "Addresses / notes",
                form: false,
                render: (r) => (
                  <div style={{ whiteSpace: "pre-wrap", maxWidth: 360 }}>
                    {[r.addresses, r.message].filter(Boolean).join("\n\n") || "—"}
                  </div>
                ),
              },
              { key: "status", label: "Status", options: REQUEST_STATUS, required: true },
            ]}
          />
          <ResourceTable
            table="rental_applications"
            title="Rental applications"
            canCreate={false}
            order={[{ column: "created_at", ascending: false }]}
            columns={[
              { key: "created_at", label: "Received", form: false, render: (r) => shortDate(r.created_at as string) },
              { key: "full_name", label: "Applicant", form: false },
              {
                key: "contact",
                label: "Contact",
                form: false,
                render: (r) => (
                  <>
                    <a href={`mailto:${r.email}`}>{String(r.email)}</a>
                    {r.phone ? <div>{String(r.phone)}</div> : null}
                  </>
                ),
              },
              { key: "unit_id", label: "Unit", options: refs.units, form: false },
              { key: "monthly_income", label: "Income / mo", type: "money", form: false },
              { key: "adults", label: "Adults", type: "number", form: false },
              { key: "desired_move_in", label: "Move-in", form: false, render: (r) => fullDate(r.desired_move_in as string | null) },
              {
                key: "notes",
                label: "Pets / notes",
                form: false,
                render: (r) => (
                  <div style={{ whiteSpace: "pre-wrap", maxWidth: 300 }}>
                    {[r.pets && `Pets: ${r.pets}`, r.current_address && `Now at: ${r.current_address}`, r.message]
                      .filter(Boolean)
                      .join("\n") || "—"}
                  </div>
                ),
              },
              { key: "status", label: "Status", options: APP_STATUS, required: true },
            ]}
          />
        </>
      )}
    </WithRefs>
  );
}

const ROLE_OPTIONS: Option[] = [
  { value: "owner", label: "Owner" },
  { value: "tenant", label: "Tenant" },
  { value: "staff", label: "Staff" },
];

export function StaffAccounts() {
  return (
    <WithRefs>
      {(refs) => (
        <>
          <Head
            title="Accounts"
            sub="Everyone who has signed in. Owners and tenants link themselves automatically when their email matches a record; use this to fix the ones that don't, or to add staff."
          />
          <ResourceTable
            table="profiles"
            title="Sign-in accounts"
            canCreate={false}
            canDelete={false}
            order={[{ column: "created_at", ascending: false }]}
            columns={[
              { key: "email", label: "Email", form: false },
              { key: "full_name", label: "Name" },
              { key: "role", label: "Role", options: ROLE_OPTIONS, render: (r) => (r.role ? String(r.role) : <span className="tag warn">Not linked</span>) },
              { key: "owner_id", label: "Owner record", options: refs.owners, hint: "Required when the role is Owner." },
              { key: "tenant_id", label: "Tenant record", options: refs.tenants, hint: "Required when the role is Tenant." },
            ]}
          />
        </>
      )}
    </WithRefs>
  );
}
