import { useSearchParams } from "react-router-dom";
import { useOwnerSelection } from "../../../components/OwnerPicker";
import { Loading } from "../../../components/Status";
import { acct, money, monthLabel, nextMonth, pct, shortDate } from "../../../lib/format";
import { currentLease, loadPortfolio, loadTransactions, loadTrustPosition, managementFee, sum, summarizeByProperty } from "../../../lib/portfolio";
import { CATEGORY_LABEL, isExpense, isIncome } from "../../../lib/types";
import { useQuery } from "../../../lib/useQuery";

// Last complete month, as YYYY-MM.
function defaultMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function Statements() {
  const { ownerId, picker } = useOwnerSelection();
  const [params, setParams] = useSearchParams();
  const month = params.get("month") ?? defaultMonth();
  const from = `${month}-01`;
  const to = nextMonth(month);

  const portfolio = useQuery(async () => (ownerId ? loadPortfolio(ownerId) : { data: null, error: null }), [ownerId]);
  const txns = useQuery(async () => (ownerId ? loadTransactions(ownerId, from, to) : { data: [], error: null }), [ownerId, month]);
  // Trust balance at the close of the month (the day before the next month starts).
  const monthEnd = (() => {
    const d = new Date(`${to}T12:00:00`);
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const trust = useQuery(async () => (ownerId ? loadTrustPosition(ownerId, monthEnd) : { data: [], error: null }), [ownerId, monthEnd]);

  const owner = portfolio.data?.owner;
  const rate = Number(owner?.mgmt_rate ?? 0);
  const rows = txns.data ?? [];
  const receipts = rows.filter((t) => t.kind === "receipt" && isIncome(t.category));
  const disb = rows.filter((t) => t.kind === "disbursement" && isExpense(t.category));
  const transfers = rows.filter((t) => !isIncome(t.category) && !isExpense(t.category));
  const paidOut = sum(transfers.filter((t) => t.category === "owner_distribution"));
  const trustBalance = (trust.data ?? []).reduce((s, r) => s + Number(r.balance), 0);
  const byProperty = summarizeByProperty(rows, rate);
  const collected = sum(receipts);
  const operating = sum(disb);
  const fee = managementFee(rows, rate);
  const net = Math.round((collected - operating - fee) * 100) / 100;
  const units = portfolio.data?.properties.flatMap((p) => p.units) ?? [];
  const unitLabel = new Map(units.map((u) => [u.id, u.label]));
  const deposits = units.map(currentLease).reduce((s, l) => s + (l ? Number(l.deposit) : 0), 0);

  const where = (t: (typeof rows)[number]) => {
    const short = t.properties.address.split(" ").slice(1).join(" ").replace(/ (St|Ave|Ct|Rd|Dr|Ln)$/, "");
    const label = t.unit_id ? unitLabel.get(t.unit_id) : null;
    return t.unit_id ? `${short}${label ? ` ${label}` : ""}` : `${short} — common`;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Monthly owner statement</h1>
          <p className="sub">
            {monthLabel(month)}
            {owner && <> &middot; {owner.name} &middot; {pct(rate)} of collected rent</>}
          </p>
        </div>
        <div className="controls">
          {picker}
          <label className="field">
            <span>Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                if (!e.target.value) return;
                const next = new URLSearchParams(params);
                next.set("month", e.target.value);
                setParams(next);
              }}
            />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>
      <Loading error={portfolio.error ?? txns.error} loading={txns.loading && !txns.data} />

      <div className="stats">
        <div>
          <span>Collected</span>
          <b>{money(collected)}</b>
          <small>{receipts.length} receipts</small>
        </div>
        <div>
          <span>Operating costs</span>
          <b>{money(operating)}</b>
          <small>Paid to vendors at cost</small>
        </div>
        <div>
          <span>Management fee</span>
          <b>{money(fee)}</b>
          <small>{pct(rate)} of collected rent</small>
        </div>
        <div>
          <span>Net income</span>
          <b>{money(net)}</b>
          <small>
            {paidOut ? `${money(paidOut)} paid out` : "Nothing paid out yet"}
            {owner?.ach_last4 ? ` · ACH ending ${owner.ach_last4}` : ""}
          </small>
        </div>
      </div>

      {rows.length === 0 && !txns.loading && <p className="notice">No activity recorded for {monthLabel(month)}.</p>}

      {rows.length > 0 && (
        <>
          <div className="card">
            <h2>Cash activity by property</h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th className="n">Collected</th>
                    <th className="n">Operating</th>
                    <th className="n">Mgmt fee</th>
                    <th className="n">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {byProperty.map((p) => (
                    <tr key={p.property.id}>
                      <td>
                        {p.property.address}, {p.property.city}
                      </td>
                      <td className="n">{acct(p.collected)}</td>
                      <td className="n neg">{acct(p.operating, true)}</td>
                      <td className="n neg">{acct(p.fee, true)}</td>
                      <td className="n">{acct(p.net)}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Total</td>
                    <td className="n">{acct(collected)}</td>
                    <td className="n">{acct(operating, true)}</td>
                    <td className="n">{acct(fee, true)}</td>
                    <td className="n">{acct(net)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>Receipts</h2>
            <div className="tbl-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Unit</th>
                    <th>Tenant</th>
                    <th>Type</th>
                    <th>Method</th>
                    <th className="n">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((t) => (
                    <tr key={t.id}>
                      <td>{shortDate(t.txn_date)}</td>
                      <td>{where(t)}</td>
                      <td>{t.payee_payer ?? "—"}</td>
                      <td>{CATEGORY_LABEL[t.category] ?? t.category}</td>
                      <td>{t.method ?? "—"}</td>
                      <td className="n">{acct(Number(t.amount))}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td colSpan={5}>Total receipts</td>
                    <td className="n">{acct(collected)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h2>Disbursements</h2>
            <div className="tbl-wrap">
              <table className="tbl" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Unit</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Vendor</th>
                    <th>Ref</th>
                    <th className="n">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {disb.map((t) => (
                    <tr key={t.id}>
                      <td>{shortDate(t.txn_date)}</td>
                      <td>{where(t)}</td>
                      <td>{CATEGORY_LABEL[t.category] ?? t.category}</td>
                      <td>{t.description ?? ""}</td>
                      <td>{t.payee_payer ?? ""}</td>
                      <td>{t.reference ?? ""}</td>
                      <td className="n">{acct(Number(t.amount))}</td>
                    </tr>
                  ))}
                  <tr className="total">
                    <td colSpan={6}>Total disbursements</td>
                    <td className="n">{acct(operating)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="muted" style={{ fontSize: ".85rem", marginTop: 8 }}>
              Vendor invoices pass through at cost. Nothing above carries a markup, coordination fee or trip charge.
            </p>
          </div>
        </>
      )}

      {transfers.length > 0 && (
        <div className="card">
          <h2>Transfers</h2>
          <p className="muted" style={{ fontSize: ".9rem" }}>
            Money moved in or out of your trust balance. These are not income or expenses.
          </p>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Property</th>
                  <th>Ref</th>
                  <th className="n">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td>{shortDate(t.txn_date)}</td>
                    <td>{CATEGORY_LABEL[t.category] ?? t.category}</td>
                    <td>{t.properties.address}</td>
                    <td>{t.reference ?? ""}</td>
                    <td className={t.kind === "receipt" ? "n" : "n neg"}>{acct(Number(t.amount), t.kind !== "receipt")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="card">
        <h2>Reserve and trust</h2>
        <dl className="kv">
          <dt>Your balance in the rent trust account, {shortDate(monthEnd)}</dt>
          <dd>{trust.error ? "—" : money(trustBalance)}</dd>
          <dt>Operating reserve target</dt>
          <dd>{money(owner?.reserve_target)}</dd>
          <dt>Security deposits held in trust</dt>
          <dd>{money(deposits)}</dd>
        </dl>
        <p className="muted" style={{ fontSize: ".85rem", marginTop: 10 }}>
          Your balance is rent and contributions received for your properties, less bills paid and payouts made. Each
          month DH keeps the reserve target and pays out the rest after the management fee. Deposits sit in a separate
          trust account, are never used for operating costs, and are excluded from your distribution.
        </p>
      </div>
    </>
  );
}
