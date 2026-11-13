import { useSearchParams } from "react-router-dom";
import { useOwnerSelection } from "../../../components/OwnerPicker";
import { Loading } from "../../../components/Status";
import { acct } from "../../../lib/format";
import { loadPortfolio, loadTransactions, managementFee, sum, type TxnWithProperty } from "../../../lib/portfolio";
import { CATEGORY_LABEL, SCHEDULE_E, isIncome } from "../../../lib/types";
import { useQuery } from "../../../lib/useQuery";

const lineFor = (category: string): number | string => {
  if (["owner_contribution", "management_fee", "owner_distribution"].includes(category)) return "transfer";
  if (["rent", "late_fee", "other_income"].includes(category)) return 3;
  return SCHEDULE_E.find((l) => l.categories.includes(category))?.line ?? 19;
};

function downloadCsv(year: number, rows: TxnWithProperty[]) {
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = ["date", "property", "kind", "category", "schedule_e_line", "description", "payee_payer", "reference", "amount"];
  const lines = rows.map((t) =>
    [t.txn_date, t.properties.address, t.kind, CATEGORY_LABEL[t.category] ?? t.category, lineFor(t.category), t.description, t.payee_payer, t.reference, Number(t.amount).toFixed(2)]
      .map(esc)
      .join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `transactions-${year}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function TaxSummary() {
  const { ownerId, picker } = useOwnerSelection();
  const [params, setParams] = useSearchParams();
  const year = Number(params.get("year") ?? new Date().getFullYear() - 1);

  const portfolio = useQuery(async () => (ownerId ? loadPortfolio(ownerId) : { data: null, error: null }), [ownerId]);
  const txns = useQuery(
    async () => (ownerId ? loadTransactions(ownerId, `${year}-01-01`, `${year + 1}-01-01`) : { data: [], error: null }),
    [ownerId, year],
  );

  const rate = Number(portfolio.data?.owner.mgmt_rate ?? 0);
  const properties = portfolio.data?.properties ?? [];
  const rows = txns.data ?? [];
  const cols = properties.map((p) => {
    const ts = rows.filter((t) => t.property_id === p.id);
    const expense = (cats: string[]) => sum(ts.filter((t) => t.kind === "disbursement" && cats.includes(t.category)));
    const rents = sum(ts.filter((t) => t.kind === "receipt" && isIncome(t.category)));
    const fee = managementFee(ts, rate);
    const lines = SCHEDULE_E.map((l) => expense(l.categories));
    const total = Math.round((lines.reduce((a, b) => a + b, 0) + fee) * 100) / 100;
    return { id: p.id, address: p.address, rents, fee, lines, total, income: Math.round((rents - total) * 100) / 100 };
  });
  const tot = (f: (c: (typeof cols)[number]) => number) => Math.round(cols.reduce((s, c) => s + f(c), 0) * 100) / 100;
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  // Management fees (line 11) sit between lines 10 and 14 on the form.
  const beforeFee = SCHEDULE_E.filter((l) => l.line < 11);
  const afterFee = SCHEDULE_E.filter((l) => l.line > 11);
  const row = (l: (typeof SCHEDULE_E)[number]) => {
    const i = SCHEDULE_E.indexOf(l);
    return (
      <tr key={l.line}>
        <td>{l.line}</td>
        <td>{l.label}</td>
        {cols.map((c) => (
          <td className="n" key={c.id}>{c.lines[i] ? acct(c.lines[i]) : "—"}</td>
        ))}
        <td className="n">{acct(tot((c) => c.lines[i]))}</td>
      </tr>
    );
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Year-end tax summary</h1>
          <p className="sub">Tax year {year}, cash basis &middot; income and expense by property, mapped to Schedule E lines</p>
        </div>
        <div className="controls">
          {picker}
          <label className="field">
            <span>Tax year</span>
            <select
              value={year}
              onChange={(e) => {
                const next = new URLSearchParams(params);
                next.set("year", e.target.value);
                setParams(next);
              }}
            >
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          <button className="btn btn-ghost btn-sm" disabled={!rows.length} onClick={() => downloadCsv(year, rows)}>
            Download CSV
          </button>
        </div>
      </div>
      <Loading error={portfolio.error ?? txns.error} loading={txns.loading && !txns.data} />
      {!txns.loading && rows.length === 0 && <p className="notice">No transactions recorded for {year}.</p>}

      <div className="card">
        <h2>Schedule E worksheet</h2>
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 640 + cols.length * 90 }}>
            <thead>
              <tr>
                <th>Sch. E</th>
                <th>Line item</th>
                {cols.map((c) => (
                  <th className="n" key={c.id}>{c.address}</th>
                ))}
                <th className="n">Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>3</td>
                <td>Rents received</td>
                {cols.map((c) => (
                  <td className="n" key={c.id}>{acct(c.rents)}</td>
                ))}
                <td className="n">{acct(tot((c) => c.rents))}</td>
              </tr>
              <tr className="group">
                <td colSpan={3 + cols.length}>Expenses paid through us</td>
              </tr>
              {beforeFee.map(row)}
              <tr>
                <td>11</td>
                <td>Management fees</td>
                {cols.map((c) => (
                  <td className="n" key={c.id}>{acct(c.fee)}</td>
                ))}
                <td className="n">{acct(tot((c) => c.fee))}</td>
              </tr>
              {afterFee.map(row)}
              <tr className="total">
                <td>20</td>
                <td>Total expenses</td>
                {cols.map((c) => (
                  <td className="n" key={c.id}>{acct(c.total)}</td>
                ))}
                <td className="n">{acct(tot((c) => c.total))}</td>
              </tr>
              <tr className="total">
                <td />
                <td>Income before depreciation</td>
                {cols.map((c) => (
                  <td className="n" key={c.id}>{acct(c.income)}</td>
                ))}
                <td className="n">{acct(tot((c) => c.income))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: ".85rem", marginTop: 8 }}>
          Covers only what passed through our books. Mortgage interest (line 12), and any insurance or property tax you
          paid directly, come from your own records. Line 18, depreciation, is left to your CPA. Not tax advice.
        </p>
      </div>
    </>
  );
}
