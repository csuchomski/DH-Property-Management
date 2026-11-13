// Staff settings. For now: the list of vendor trades.
import { useState, type FormEvent } from "react";
import { FormMessage } from "../../../components/Forms";
import { Loading } from "../../../components/Status";
import { supabase } from "../../../lib/supabase";
import { useQuery } from "../../../lib/useQuery";
import type { Trade } from "../../../lib/vendors";

export default function StaffSettings() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Settings</h1>
          <p className="sub">Lists the rest of the portal uses.</p>
        </div>
      </div>
      <TradesSettings />
    </>
  );
}

interface TradeData {
  trades: Trade[];
  used: Map<string, number>; // vendors + owner picks using each trade
}

// "Lawn & snow" -> "lawn_snow"
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36) || "trade";

const friendly = (e: { message: string; code?: string }) =>
  e.code === "23503" && !e.message.includes("Hide it")
    ? "Owners have picked vendors under this trade, so it can't be deleted. Hide it instead."
    : e.message;

function TradesSettings() {
  const data = useQuery<TradeData>(async () => {
    const [t, v, p] = await Promise.all([
      supabase.from("trades").select("key, label, sort, active").order("sort").order("label"),
      supabase.from("vendors").select("trades"),
      supabase.from("owner_vendor_preferences").select("trade"),
    ]);
    const error = t.error ?? v.error ?? p.error;
    if (error) return { data: null, error };
    const used = new Map<string, number>();
    for (const row of (v.data ?? []) as { trades: string[] }[]) for (const k of row.trades) used.set(k, (used.get(k) ?? 0) + 1);
    for (const row of (p.data ?? []) as { trade: string }[]) used.set(row.trade, (used.get(row.trade) ?? 0) + 1);
    return { data: { trades: (t.data ?? []) as Trade[], used }, error: null };
  }, []);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");

  const trades = data.data?.trades ?? [];

  async function run(fn: () => PromiseLike<{ error: { message: string; code?: string } | null }>, done?: string) {
    setBusy(true);
    setError(null);
    setOk(null);
    const { error } = await fn();
    setBusy(false);
    if (error) setError(friendly(error));
    else if (done) setOk(done);
    data.reload();
  }

  async function rename(t: Trade, label: string) {
    const next = label.trim();
    if (!next || next === t.label) return;
    await run(() => supabase.from("trades").update({ label: next }).eq("key", t.key), `Renamed to ${next}.`);
  }

  async function move(i: number, dir: -1 | 1) {
    const a = trades[i];
    const b = trades[i + dir];
    if (!a || !b) return;
    // Renumber the whole list in steps of 10 with the two swapped, so ties never stick.
    const order = trades.map((t) => t.key);
    [order[i], order[i + dir]] = [order[i + dir], order[i]];
    await run(async () => {
      for (const [n, key] of order.entries()) {
        const sort = (n + 1) * 10;
        if (trades.find((t) => t.key === key)?.sort === sort) continue;
        const res = await supabase.from("trades").update({ sort }).eq("key", key);
        if (res.error) return res;
      }
      return { error: null };
    });
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    if (trades.some((t) => t.label.toLowerCase() === label.toLowerCase())) return setError(`${label} is already on the list.`);
    let key = slug(label);
    for (let n = 2; trades.some((t) => t.key === key); n++) key = `${slug(label)}_${n}`;
    const sort = (trades.reduce((m, t) => Math.max(m, t.sort), 0) || 0) + 10;
    setNewLabel("");
    await run(() => supabase.from("trades").insert({ key, label, sort }), `${label} added.`);
  }

  async function remove(t: Trade) {
    if (!window.confirm(`Delete ${t.label}?`)) return;
    await run(() => supabase.from("trades").delete().eq("key", t.key), `${t.label} deleted.`);
  }

  return (
    <div className="card">
      <h2>Vendor trades</h2>
      <p className="muted" style={{ fontSize: ".9rem" }}>
        The trades you tag vendors with, and the list owners choose from when they suggest a vendor. Renaming a trade
        updates it everywhere. Hide one you no longer use: vendors keep it, but it isn't offered for new ones. A trade
        can only be deleted when nothing uses it.
      </p>
      <FormMessage ok={ok} error={error} />
      <Loading error={data.error} loading={data.loading && !data.data} />
      {trades.length > 0 && (
        <ul className="settings-list">
          {trades.map((t, i) => {
            const used = data.data?.used.get(t.key) ?? 0;
            return (
              <li key={t.key} className={t.active ? undefined : "hidden-row"}>
                <span className="order">
                  <button className="icon-btn" aria-label={`Move ${t.label} up`} disabled={busy || i === 0} onClick={() => void move(i, -1)}>
                    ↑
                  </button>
                  <button
                    className="icon-btn"
                    aria-label={`Move ${t.label} down`}
                    disabled={busy || i === trades.length - 1}
                    onClick={() => void move(i, 1)}
                  >
                    ↓
                  </button>
                </span>
                <input
                  className="label-input"
                  aria-label={`Name for ${t.label}`}
                  defaultValue={t.label}
                  key={t.label}
                  maxLength={60}
                  onBlur={(e) => void rename(t, e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
                <span className="muted used">{used ? `${used} in use` : "Not used"}</span>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={t.active}
                    disabled={busy}
                    onChange={(e) =>
                      void run(
                        () => supabase.from("trades").update({ active: e.target.checked }).eq("key", t.key),
                        e.target.checked ? `${t.label} is offered again.` : `${t.label} is hidden.`,
                      )
                    }
                  />
                  <span>Offered</span>
                </label>
                <button className="link-btn danger" disabled={busy || used > 0} title={used ? "In use: hide it instead" : undefined} onClick={() => void remove(t)}>
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <form className="settings-add" onSubmit={add}>
        <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="New trade, e.g. Gutter cleaning" maxLength={60} aria-label="New trade" />
        <button className="btn btn-primary btn-xs" type="submit" disabled={busy || !newLabel.trim()}>
          Add trade
        </button>
      </form>
    </div>
  );
}
