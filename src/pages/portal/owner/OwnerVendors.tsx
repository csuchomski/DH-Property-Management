// Owners name the trades they want called first ("use my plumber"). Staff review each one.
import { useState, type FormEvent } from "react";
import { Field, FormMessage, formValues, orNull } from "../../../components/Forms";
import { useOwnerSelection } from "../../../components/OwnerPicker";
import { Loading } from "../../../components/Status";
import { shortDate } from "../../../lib/format";
import { loadPortfolio } from "../../../lib/portfolio";
import { supabase } from "../../../lib/supabase";
import { useQuery } from "../../../lib/useQuery";
import { TRADES, TRADE_LABEL, type VendorPreference } from "../../../lib/vendors";

const STATUS: Record<VendorPreference["status"], { label: string; cls: string }> = {
  pending: { label: "Waiting on review", cls: "warn" },
  approved: { label: "On our list · called first", cls: "ok" },
  declined: { label: "Not added", cls: "flag" },
};

export default function OwnerVendors() {
  const { ownerId, picker } = useOwnerSelection();
  const portfolio = useQuery(async () => (ownerId ? loadPortfolio(ownerId) : { data: null, error: null }), [ownerId]);
  const prefs = useQuery<VendorPreference[]>(
    async () =>
      ownerId
        ? await supabase.from("owner_vendor_preferences").select("*").eq("owner_id", ownerId).order("created_at", { ascending: false })
        : { data: [], error: null },
    [ownerId],
  );
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const properties = portfolio.data?.properties ?? [];
  const address = new Map(properties.map((p) => [p.id, p.address]));

  async function add(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const v = formValues(e.currentTarget);
    setBusy(true);
    setError(null);
    const res = await supabase.from("owner_vendor_preferences").insert({
      owner_id: ownerId,
      property_id: orNull(v.property_id),
      trade: v.trade,
      name: v.name,
      phone: orNull(v.phone),
      email: orNull(v.email),
      notes: orNull(v.notes),
    });
    setBusy(false);
    if (res.error) return setError(res.error.message);
    setAdding(false);
    setOk(`Thanks. We'll check ${v.name}'s license and insurance and let you know by email.`);
    prefs.reload();
  }

  async function remove(p: VendorPreference) {
    if (!window.confirm(`Stop asking us to call ${p.name} first?`)) return;
    const { error } = await supabase.from("owner_vendor_preferences").delete().eq("id", p.id);
    if (error) setError(error.message);
    else prefs.reload();
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Your vendors</h1>
          <p className="sub">
            Have a plumber, electrician or furnace company you trust? Tell us and we'll call them first for that kind
            of work, once we've confirmed they're licensed where the trade requires it and insured.
          </p>
        </div>
        <div className="controls">{picker}</div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>Your preferred trades</h2>
          {!adding && (
            <button className="btn btn-primary btn-xs" onClick={() => { setOk(null); setAdding(true); }}>
              Add a vendor
            </button>
          )}
        </div>
        {!adding && <FormMessage ok={ok} error={error} />}

        {adding && (
          <form className="form" onSubmit={add} style={{ marginBottom: 18 }}>
            <div className="row">
              <Field label="Trade">
                <select name="trade" required defaultValue="">
                  <option value="">Choose…</option>
                  {TRADES.map((t) => (
                    <option key={t} value={t}>{TRADE_LABEL[t]}</option>
                  ))}
                </select>
              </Field>
              <Field label="Use them for">
                <select name="property_id" defaultValue="">
                  <option value="">All my properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.address}, {p.city}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="row">
              <Field label="Name or company">
                <input name="name" required maxLength={200} placeholder="Krueger Plumbing" />
              </Field>
              <Field label="Phone">
                <input name="phone" type="tel" maxLength={40} />
              </Field>
              <Field label="Email (optional)">
                <input name="email" type="email" maxLength={200} />
              </Field>
            </div>
            <Field label="Anything we should know (optional)" hint="How you know them, who to ask for, license number if you have it.">
              <textarea name="notes" maxLength={2000} />
            </Field>
            <FormMessage error={error} />
            <div className="btn-row">
              <button className="btn btn-primary btn-sm" type="submit" disabled={busy || !ownerId}>
                {busy ? "Sending…" : "Send to DH"}
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setAdding(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}

        <Loading error={prefs.error ?? portfolio.error} loading={prefs.loading && !prefs.data} />
        {prefs.data?.length === 0 && !adding && (
          <p className="muted">
            None yet. Without a preference we use our own vetted vendors, always billed to you at cost.
          </p>
        )}
        {!!prefs.data?.length && (
          <div className="tbl-wrap">
            <table className="tbl rt">
              <thead>
                <tr>
                  <th>Trade</th>
                  <th>Vendor</th>
                  <th>For</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {prefs.data.map((p) => (
                  <tr key={p.id}>
                    <td data-label="Trade"><div className="cell">{TRADE_LABEL[p.trade] ?? p.trade}</div></td>
                    <td data-label="Vendor">
                      <div className="cell">
                        <b>{p.name}</b>
                        {p.phone && <div className="muted">{p.phone}</div>}
                      </div>
                    </td>
                    <td data-label="For">
                      <div className="cell">{p.property_id ? address.get(p.property_id) ?? "One property" : "All properties"}</div>
                    </td>
                    <td data-label="Status">
                      <div className="cell">
                        <span className={`tag ${STATUS[p.status].cls}`}>{STATUS[p.status].label}</span>
                        {p.staff_note && <div className="muted" style={{ fontSize: ".85rem", marginTop: 4 }}>{p.staff_note}</div>}
                        {p.status === "pending" && <div className="muted" style={{ fontSize: ".8rem" }}>Sent {shortDate(p.created_at.slice(0, 10))}</div>}
                      </div>
                    </td>
                    <td className="actions">
                      <button className="link-btn danger" onClick={() => void remove(p)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted" style={{ fontSize: ".88rem" }}>
        Emergencies go to whoever can be there fastest, even if that isn't your preferred vendor. Anything above your
        approval threshold still comes to you with a bid first.
      </p>
    </>
  );
}
