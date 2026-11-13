// Everything recorded in the ledger for one vendor, with totals by year (useful at 1099 time).
import { useState } from "react";
import { FormMessage } from "../../../components/Forms";
import { Loading } from "../../../components/Status";
import { acct, fullDate, money } from "../../../lib/format";
import { supabase } from "../../../lib/supabase";
import { CATEGORY_LABEL } from "../../../lib/types";
import { useQuery } from "../../../lib/useQuery";
import type { Vendor } from "../../../lib/vendors";

interface Row {
  id: string;
  txn_date: string;
  kind: "receipt" | "disbursement";
  category: string;
  description: string | null;
  reference: string | null;
  payee_payer: string | null;
  amount: number;
  vendor_id: string | null;
  properties: { address: string; owners: { name: string } | null } | null;
}

const SELECT = "id, txn_date, kind, category, description, reference, payee_payer, amount, vendor_id, properties(address, owners(name))";

// Paid out counts as positive; anything the vendor paid back (a refund) counts against it.
const paid = (r: Row) => (r.kind === "disbursement" ? Number(r.amount) : -Number(r.amount));

export default function VendorHistory({ vendor }: { vendor: Vendor }) {
  const linked = useQuery<Row[]>(
    async () => {
      const res = await supabase.from("transactions").select(SELECT).eq("vendor_id", vendor.id).order("txn_date", { ascending: false });
      return { data: res.data as unknown as Row[] | null, error: res.error };
    },
    [vendor.id],
  );
  // Entries that mention the vendor's name but aren't linked (e.g. "Krueger Plumbing LLC").
  const word = vendor.name.split(/\s+/).find((w) => w.length >= 4) ?? vendor.name;
  const loose = useQuery<Row[]>(
    async () => {
      const res = await supabase
        .from("transactions")
        .select(SELECT)
        .is("vendor_id", null)
        .ilike("payee_payer", `%${word.replace(/[%_,()]/g, "")}%`)
        .order("txn_date", { ascending: false })
        .limit(50);
      return { data: res.data as unknown as Row[] | null, error: res.error };
    },
    [vendor.id, word],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function link(rows: Row[]) {
    setBusy(true);
    setError(null);
    const res = await supabase.from("transactions").update({ vendor_id: vendor.id }).in("id", rows.map((r) => r.id));
    setBusy(false);
    if (res.error) return setError(res.error.message);
    linked.reload();
    loose.reload();
  }

  const rows = linked.data ?? [];
  const byYear = new Map<string, { n: number; total: number }>();
  for (const r of rows) {
    const y = r.txn_date.slice(0, 4);
    const cur = byYear.get(y) ?? { n: 0, total: 0 };
    byYear.set(y, { n: cur.n + 1, total: cur.total + paid(r) });
  }
  const total = rows.reduce((s, r) => s + paid(r), 0);

  return (
    <div className="vendor-history">
      <Loading error={linked.error} loading={linked.loading && !linked.data} />
      <FormMessage error={error} />
      {linked.data && rows.length === 0 && <p className="muted">Nothing in the ledger for {vendor.name} yet.</p>}
      {rows.length > 0 && (
        <>
          <div className="history-totals">
            <div>
              <span>All time</span>
              <b>{money(total)}</b>
              <small>{rows.length} {rows.length === 1 ? "entry" : "entries"}</small>
            </div>
            {[...byYear.entries()].map(([y, t]) => (
              <div key={y}>
                <span>{y}</span>
                <b>{money(t.total)}</b>
                <small>
                  {t.n} {t.n === 1 ? "entry" : "entries"}
                </small>
              </div>
            ))}
          </div>
          <div className="tbl-wrap">
            <table className="tbl rt">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Property</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Ref</th>
                  <th className="n">Amount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Date"><div className="cell">{fullDate(r.txn_date)}</div></td>
                    <td data-label="Property">
                      <div className="cell">
                        {r.properties?.address}
                        {r.properties?.owners?.name && <div className="muted" style={{ fontSize: ".8rem" }}>{r.properties.owners.name}</div>}
                      </div>
                    </td>
                    <td data-label="Category"><div className="cell">{CATEGORY_LABEL[r.category] ?? r.category}</div></td>
                    <td data-label="Description"><div className="cell">{r.description ?? ""}</div></td>
                    <td data-label="Ref"><div className="cell">{r.reference ?? ""}</div></td>
                    <td data-label="Amount" className={r.kind === "receipt" ? "n" : "n"}>
                      <div className="cell">{r.kind === "receipt" ? `(${acct(Number(r.amount))}) refund` : acct(Number(r.amount))}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {!!loose.data?.length && (
        <div className="history-loose">
          <p>
            <b>{loose.data.length}</b> other ledger {loose.data.length === 1 ? "entry mentions" : "entries mention"} “{word}” but
            {loose.data.length === 1 ? " isn't" : " aren't"} linked:
          </p>
          <ul className="plain-list">
            {loose.data.map((r) => (
              <li key={r.id}>
                {fullDate(r.txn_date)} · {r.payee_payer} · {r.properties?.address} · {money(Number(r.amount))}{" "}
                <button className="link-btn" disabled={busy} onClick={() => void link([r])}>Link</button>
              </li>
            ))}
          </ul>
          {loose.data.length > 1 && (
            <button className="btn btn-ghost btn-xs" disabled={busy} onClick={() => void link(loose.data!)}>
              Link all {loose.data.length}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
