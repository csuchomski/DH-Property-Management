// Staff vendor list: find someone for a repair, review owners' preferred vendors, keep the list.
import { useMemo, useState, type FormEvent } from "react";
import { Field, FormMessage, formValues, orNull } from "../../../components/Forms";
import { Loading } from "../../../components/Status";
import { shortDate } from "../../../lib/format";
import { supabase } from "../../../lib/supabase";
import { useQuery } from "../../../lib/useQuery";
import {
  ALL_AREAS,
  DEFAULT_AREAS,
  TRADES,
  TRADE_LABEL,
  coversTown,
  insuranceState,
  sameTown,
  type Vendor,
  type VendorPreference,
} from "../../../lib/vendors";

interface Prop {
  id: string;
  address: string;
  city: string;
  owner_id: string;
  owners: { name: string } | null;
}

interface Data {
  vendors: Vendor[];
  prefs: VendorPreference[];
  props: Prop[];
}

export default function StaffVendors() {
  const data = useQuery<Data>(async () => {
    const [v, p, pr] = await Promise.all([
      supabase.from("vendors").select("*").order("name"),
      supabase.from("owner_vendor_preferences").select("*").order("created_at"),
      supabase.from("properties").select("id, address, city, owner_id, owners(name)").order("address"),
    ]);
    const error = v.error ?? p.error ?? pr.error;
    if (error) return { data: null, error };
    return {
      data: {
        vendors: (v.data ?? []) as Vendor[],
        prefs: (p.data ?? []) as VendorPreference[],
        props: (pr.data ?? []) as unknown as Prop[],
      },
      error: null,
    };
  }, []);

  const d = data.data;
  // Towns to offer on the vendor form: the website's list, property cities and any already in use.
  const towns = useMemo(() => {
    const all = [...DEFAULT_AREAS, ...(d?.props.map((p) => p.city) ?? []), ...(d?.vendors.flatMap((v) => v.areas) ?? [])];
    const out: string[] = [];
    for (const t of all) if (t !== ALL_AREAS && !out.some((o) => sameTown(o, t))) out.push(t.trim());
    return out.sort((a, b) => a.localeCompare(b));
  }, [d]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Vendors</h1>
          <p className="sub">
            Your trades, tagged by what they do and where they'll go, plus the vendors owners have asked you to call
            first.
          </p>
        </div>
      </div>
      <Loading error={data.error} loading={data.loading && !d} />
      {d && (
        <>
          <Finder data={d} />
          <Review data={d} onDone={data.reload} />
          <VendorList data={d} towns={towns} onDone={data.reload} />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Find someone: property + trade -> owner's pick first, then vendors covering that town.

function Finder({ data }: { data: Data }) {
  const [propId, setPropId] = useState("");
  const [trade, setTrade] = useState("");
  const prop = data.props.find((p) => p.id === propId);
  const byId = new Map(data.vendors.map((v) => [v.id, v]));

  const ownerPicks = prop
    ? data.prefs.filter(
        (p) =>
          p.owner_id === prop.owner_id &&
          p.trade === trade &&
          p.status !== "declined" &&
          (p.property_id === null || p.property_id === prop.id),
      )
    : [];
  const pickedIds = new Set(ownerPicks.map((p) => p.vendor_id).filter(Boolean));
  const matches = prop
    ? data.vendors
        .filter((v) => v.active && v.trades.includes(trade) && coversTown(v, prop.city) && !pickedIds.has(v.id))
        .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name))
    : [];

  return (
    <div className="card">
      <h2>Find someone for a repair</h2>
      <div className="form">
        <div className="row">
          <Field label="Property">
            <select value={propId} onChange={(e) => setPropId(e.target.value)}>
              <option value="">Choose…</option>
              {data.props.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.address}, {p.city} · {p.owners?.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trade">
            <select value={trade} onChange={(e) => setTrade(e.target.value)}>
              <option value="">Choose…</option>
              {TRADES.map((t) => (
                <option key={t} value={t}>{TRADE_LABEL[t]}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      {prop && trade && (
        <div className="vendor-results">
          {ownerPicks.map((p) => {
            const v = p.vendor_id ? byId.get(p.vendor_id) : undefined;
            return (
              <VendorCard
                key={p.id}
                badge={p.status === "approved" ? `${prop.owners?.name}'s pick · call first` : `${prop.owners?.name}'s pick · not reviewed yet`}
                badgeCls={p.status === "approved" ? "ok" : "warn"}
                v={v ?? { name: p.name, phone: p.phone, email: p.email, notes: p.notes }}
                warn={v && v.active && !coversTown(v, prop.city) ? `Not tagged for ${prop.city}; check they'll make the trip.` : v && !v.active ? "You've marked them as not using." : undefined}
              />
            );
          })}
          {matches.map((v) => (
            <VendorCard key={v.id} v={v} />
          ))}
          {!ownerPicks.length && !matches.length && (
            <p className="muted">
              No {TRADE_LABEL[trade].toLowerCase()} vendor covers {prop.city} yet. Add one below, or give an existing one
              this town.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stars({ n }: { n: number | null }) {
  if (!n) return null;
  return <span className="stars" aria-label={`${n} of 5`}>{"★".repeat(n)}{"☆".repeat(5 - n)}</span>;
}

function InsuranceTag({ expires }: { expires: string | null }) {
  const s = insuranceState(expires);
  if (s === "ok") return <span className="tag ok">Insured to {shortDate(expires)}</span>;
  if (s === "soon") return <span className="tag warn">Insurance ends {shortDate(expires)}</span>;
  if (s === "expired") return <span className="tag flag">Insurance expired {shortDate(expires)}</span>;
  return <span className="tag flag">No insurance on file</span>;
}

function VendorCard({ v, badge, badgeCls, warn }: { v: Partial<Vendor> & { name: string }; badge?: string; badgeCls?: string; warn?: string }) {
  const listed = "trades" in v && !!v.trades;
  return (
    <div className="vendor-card">
      <div className="vendor-top">
        <b>{v.name}</b>
        {badge && <span className={`tag ${badgeCls}`}>{badge}</span>}
        <Stars n={v.rating ?? null} />
      </div>
      <div className="vendor-contact">
        {v.contact_name && <span>{v.contact_name}</span>}
        {v.phone && <a href={`tel:${v.phone.replace(/[^\d+]/g, "")}`}>{v.phone}</a>}
        {v.email && <a href={`mailto:${v.email}`}>{v.email}</a>}
      </div>
      {listed && (
        <div className="vendor-tags">
          <InsuranceTag expires={v.insurance_expires ?? null} />
          {v.license_no && <span className="tag">License {v.license_no}</span>}
          {!v.w9_on_file && <span className="tag warn">No W-9</span>}
        </div>
      )}
      {!listed && <p className="muted" style={{ fontSize: ".85rem" }}>Not on your list yet: no license or insurance checked.</p>}
      {warn && <p className="muted" style={{ fontSize: ".85rem", color: "var(--clay)" }}>{warn}</p>}
      {v.notes && <p className="vendor-notes">{v.notes}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Owner suggestions waiting on a decision.

function Review({ data, onDone }: { data: Data; onDone: () => void }) {
  const pending = data.prefs.filter((p) => p.status === "pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [link, setLink] = useState<Record<string, string>>({});
  const owner = (id: string) => data.props.find((p) => p.owner_id === id)?.owners?.name ?? "Owner";
  const where = (p: VendorPreference) => data.props.find((x) => x.id === p.property_id)?.address ?? "All their properties";

  async function approve(p: VendorPreference) {
    setBusy(p.id);
    setError(null);
    let vendorId = link[p.id] || null;
    if (!vendorId) {
      // Add to the list, covering the towns this owner's properties are in.
      const cities = data.props
        .filter((x) => x.owner_id === p.owner_id && (p.property_id === null || x.id === p.property_id))
        .map((x) => x.city);
      const areas = cities.filter((c, i) => cities.findIndex((o) => sameTown(o, c)) === i);
      const ins = await supabase
        .from("vendors")
        .insert({
          name: p.name,
          phone: p.phone,
          email: p.email,
          trades: [p.trade],
          areas: areas.length ? areas : [ALL_AREAS],
          notes: [`Suggested by ${owner(p.owner_id)}.`, p.notes].filter(Boolean).join(" "),
        })
        .select("id")
        .single();
      if (ins.error) {
        setBusy(null);
        return setError(ins.error.message);
      }
      vendorId = ins.data.id;
    }
    const res = await supabase
      .from("owner_vendor_preferences")
      .update({ status: "approved", vendor_id: vendorId, reviewed_at: new Date().toISOString() })
      .eq("id", p.id);
    setBusy(null);
    if (res.error) return setError(res.error.message);
    setOk(`${p.name} approved. ${owner(p.owner_id)} gets an email. Add their license and insurance on the list below.`);
    onDone();
  }

  async function decline(p: VendorPreference) {
    const note = window.prompt(`Why can't you use ${p.name}? The owner sees this.`, "We couldn't confirm liability insurance.");
    if (note === null) return;
    setBusy(p.id);
    const res = await supabase
      .from("owner_vendor_preferences")
      .update({ status: "declined", staff_note: note.trim() || null, reviewed_at: new Date().toISOString() })
      .eq("id", p.id);
    setBusy(null);
    if (res.error) return setError(res.error.message);
    setOk(`Declined. ${owner(p.owner_id)} gets an email.`);
    onDone();
  }

  const approved = data.prefs.filter((p) => p.status === "approved");
  const vendorName = new Map(data.vendors.map((v) => [v.id, v.name]));

  return (
    <div className="card">
      <h2>Owners' preferred vendors</h2>
      <FormMessage ok={ok} error={error} />
      {pending.length === 0 && <p className="muted">Nothing waiting on you.</p>}
      {pending.map((p) => {
        const candidates = data.vendors.filter((v) => v.trades.includes(p.trade));
        return (
          <div className="review-row" key={p.id}>
            <div>
              <b>{p.name}</b> · {TRADE_LABEL[p.trade] ?? p.trade}
              <div className="muted" style={{ fontSize: ".88rem" }}>
                {owner(p.owner_id)} · {where(p)} · sent {shortDate(p.created_at.slice(0, 10))}
              </div>
              <div style={{ fontSize: ".9rem" }}>
                {[p.phone, p.email].filter(Boolean).join(" · ")}
                {p.notes && <div className="muted">“{p.notes}”</div>}
              </div>
            </div>
            <div className="review-actions">
              <select
                aria-label="Approve as"
                value={link[p.id] ?? ""}
                onChange={(e) => setLink((l) => ({ ...l, [p.id]: e.target.value }))}
              >
                <option value="">Add as a new vendor</option>
                {candidates.map((v) => (
                  <option key={v.id} value={v.id}>Same as {v.name}</option>
                ))}
              </select>
              <button className="btn btn-primary btn-xs" disabled={busy !== null} onClick={() => void approve(p)}>
                Approve
              </button>
              <button className="btn btn-ghost btn-xs" disabled={busy !== null} onClick={() => void decline(p)}>
                Decline
              </button>
            </div>
          </div>
        );
      })}
      {approved.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary>Approved owner picks ({approved.length})</summary>
          <ul className="plain-list">
            {approved.map((p) => (
              <li key={p.id}>
                {owner(p.owner_id)}: {TRADE_LABEL[p.trade]} → <b>{(p.vendor_id && vendorName.get(p.vendor_id)) || p.name}</b>{" "}
                <span className="muted">({where(p)})</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The list itself, with filters and an add/edit form.

function VendorList({ data, towns, onDone }: { data: Data; towns: string[]; onDone: () => void }) {
  const [trade, setTrade] = useState("");
  const [town, setTown] = useState("");
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const picksFor = (id: string) =>
    data.prefs
      .filter((p) => p.vendor_id === id && p.status === "approved")
      .map((p) => data.props.find((x) => x.owner_id === p.owner_id)?.owners?.name)
      .filter((n, i, a) => n && a.indexOf(n) === i);

  const rows = data.vendors.filter(
    (v) =>
      (showInactive || v.active) &&
      (!trade || v.trades.includes(trade)) &&
      (!town || coversTown(v, town)) &&
      (!q || `${v.name} ${v.contact_name ?? ""} ${v.notes ?? ""}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="card">
      <div className="card-head">
        <h2>Your vendor list</h2>
        {!editing && (
          <button className="btn btn-primary btn-xs" onClick={() => { setOk(null); setEditing("new"); }}>
            Add a vendor
          </button>
        )}
      </div>
      {!editing && <FormMessage ok={ok} />}
      {editing && (
        <VendorForm
          key={editing === "new" ? "new" : editing.id}
          vendor={editing === "new" ? null : editing}
          towns={towns}
          onCancel={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            setOk(msg);
            onDone();
          }}
        />
      )}

      <div className="form filters">
        <div className="row">
          <Field label="Trade">
            <select value={trade} onChange={(e) => setTrade(e.target.value)}>
              <option value="">All trades</option>
              {TRADES.map((t) => (
                <option key={t} value={t}>{TRADE_LABEL[t]}</option>
              ))}
            </select>
          </Field>
          <Field label="Works in">
            <select value={town} onChange={(e) => setTown(e.target.value)}>
              <option value="">Anywhere</option>
              {towns.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Search">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or notes" />
          </Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          <span>Show vendors you've stopped using</span>
        </label>
      </div>

      {rows.length === 0 && <p className="muted">{data.vendors.length ? "No vendors match." : "No vendors yet. Add your first one."}</p>}
      <div className="vendor-results">
        {rows.map((v) => {
          const picks = picksFor(v.id);
          return (
            <div className={v.active ? "vendor-card" : "vendor-card inactive"} key={v.id}>
              <div className="vendor-top">
                <b>{v.name}</b>
                <Stars n={v.rating} />
                {!v.active && <span className="tag">Not using</span>}
                <button className="link-btn" style={{ marginLeft: "auto" }} onClick={() => { setOk(null); setEditing(v); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  Edit
                </button>
              </div>
              <div className="vendor-contact">
                {v.contact_name && <span>{v.contact_name}</span>}
                {v.phone && <a href={`tel:${v.phone.replace(/[^\d+]/g, "")}`}>{v.phone}</a>}
                {v.email && <a href={`mailto:${v.email}`}>{v.email}</a>}
              </div>
              <div className="vendor-tags">
                {v.trades.map((t) => (
                  <span className="tag trade" key={t}>{TRADE_LABEL[t] ?? t}</span>
                ))}
                <span className="tag">{v.areas.includes(ALL_AREAS) ? "All areas" : v.areas.join(", ")}</span>
                <InsuranceTag expires={v.insurance_expires} />
                {!v.w9_on_file && <span className="tag warn">No W-9</span>}
                {picks.map((n) => (
                  <span className="tag ok" key={n}>{n}'s pick</span>
                ))}
              </div>
              {v.notes && <p className="vendor-notes">{v.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VendorForm({
  vendor,
  towns,
  onCancel,
  onSaved,
}: {
  vendor: Vendor | null;
  towns: string[];
  onCancel: () => void;
  onSaved: (msg: string) => void;
}) {
  const [trades, setTrades] = useState<string[]>(vendor?.trades ?? []);
  const [everywhere, setEverywhere] = useState(vendor ? vendor.areas.includes(ALL_AREAS) : false);
  const [areas, setAreas] = useState<string[]>(vendor?.areas.filter((a) => a !== ALL_AREAS) ?? []);
  const [extraTowns, setExtraTowns] = useState<string[]>([]);
  const [newTown, setNewTown] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
  const townOptions = [...towns, ...extraTowns.filter((t) => !towns.some((o) => sameTown(o, t)))];

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!trades.length) return setError("Pick at least one trade.");
    if (!everywhere && !areas.length) return setError("Pick the towns they'll work in, or All areas.");
    const v = formValues(e.currentTarget);
    const row = {
      name: v.name,
      contact_name: orNull(v.contact_name),
      phone: orNull(v.phone),
      email: orNull(v.email),
      trades,
      areas: everywhere ? [ALL_AREAS] : areas,
      license_no: orNull(v.license_no),
      insurance_expires: orNull(v.insurance_expires),
      w9_on_file: v.w9_on_file === "on",
      rating: v.rating ? Number(v.rating) : null,
      notes: orNull(v.notes),
      active: v.active === "on",
    };
    setBusy(true);
    setError(null);
    const res = vendor ? await supabase.from("vendors").update(row).eq("id", vendor.id) : await supabase.from("vendors").insert(row);
    setBusy(false);
    if (res.error) return setError(res.error.message);
    onSaved(vendor ? "Saved." : `${row.name} added.`);
  }

  async function remove() {
    if (!vendor || !window.confirm(`Delete ${vendor.name}? To keep their history, untick "Still using them" instead.`)) return;
    const { error } = await supabase.from("vendors").delete().eq("id", vendor.id);
    if (error) setError(error.message);
    else onSaved("Deleted.");
  }

  return (
    <form className="form" onSubmit={save} style={{ marginBottom: 20 }}>
      <h3>{vendor ? `Edit ${vendor.name}` : "New vendor"}</h3>
      <div className="row">
        <Field label="Business name">
          <input name="name" required maxLength={200} defaultValue={vendor?.name ?? ""} />
        </Field>
        <Field label="Contact (optional)">
          <input name="contact_name" maxLength={200} defaultValue={vendor?.contact_name ?? ""} />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" maxLength={40} defaultValue={vendor?.phone ?? ""} />
        </Field>
        <Field label="Email (optional)">
          <input name="email" type="email" maxLength={200} defaultValue={vendor?.email ?? ""} />
        </Field>
      </div>

      <fieldset className="checks">
        <legend>Trades</legend>
        {TRADES.map((t) => (
          <label className="check" key={t}>
            <input type="checkbox" checked={trades.includes(t)} onChange={() => setTrades((x) => toggle(x, t))} />
            <span>{TRADE_LABEL[t]}</span>
          </label>
        ))}
      </fieldset>

      <fieldset className="checks">
        <legend>Areas they'll work in</legend>
        <label className="check">
          <input type="checkbox" checked={everywhere} onChange={(e) => setEverywhere(e.target.checked)} />
          <span><b>All areas</b></span>
        </label>
        {!everywhere &&
          townOptions.map((t) => (
            <label className="check" key={t}>
              <input type="checkbox" checked={areas.some((a) => sameTown(a, t))} onChange={() => setAreas((x) => (x.some((a) => sameTown(a, t)) ? x.filter((a) => !sameTown(a, t)) : [...x, t]))} />
              <span>{t}</span>
            </label>
          ))}
        {!everywhere && (
          <span className="add-town">
            <input value={newTown} onChange={(e) => setNewTown(e.target.value)} placeholder="Another town" maxLength={60} aria-label="Another town" />
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => {
                const t = newTown.trim();
                if (!t) return;
                setExtraTowns((x) => [...x, t]);
                setAreas((x) => (x.some((a) => sameTown(a, t)) ? x : [...x, t]));
                setNewTown("");
              }}
            >
              Add
            </button>
          </span>
        )}
      </fieldset>

      <div className="row">
        <Field label="License # (optional)">
          <input name="license_no" maxLength={100} defaultValue={vendor?.license_no ?? ""} />
        </Field>
        <Field label="Insurance good through (optional)">
          <input name="insurance_expires" type="date" defaultValue={vendor?.insurance_expires ?? ""} />
        </Field>
        <Field label="Your rating (optional)">
          <select name="rating" defaultValue={vendor?.rating ? String(vendor.rating) : ""}>
            <option value="">—</option>
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>{"★".repeat(n)}</option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notes (optional)" hint="Rates, hours, who to ask for, what they're good at.">
        <textarea name="notes" maxLength={4000} defaultValue={vendor?.notes ?? ""} />
      </Field>
      <label className="check">
        <input type="checkbox" name="w9_on_file" defaultChecked={vendor?.w9_on_file ?? false} />
        <span>W-9 on file</span>
      </label>
      <label className="check">
        <input type="checkbox" name="active" defaultChecked={vendor?.active ?? true} />
        <span>Still using them</span>
      </label>
      <FormMessage error={error} />
      <div className="btn-row">
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button className="btn btn-ghost btn-sm" type="button" onClick={onCancel}>
          Cancel
        </button>
        {vendor && (
          <button className="link-btn danger" type="button" style={{ marginLeft: "auto" }} onClick={() => void remove()}>
            Delete
          </button>
        )}
      </div>
    </form>
  );
}
