// Trust accounting for staff: owner payouts and the month-end three-way reconciliation.
import { useState, type FormEvent } from "react";
import { FormMessage } from "../../../components/Forms";
import { Loading } from "../../../components/Status";
import { acct, money, monthLabel, nextMonth, shortDate, todayISO } from "../../../lib/format";
import { supabase } from "../../../lib/supabase";
import { useQuery } from "../../../lib/useQuery";

interface OwnerBalance {
  owner_id: string;
  owner_name: string;
  balance: number;
  fee_due: number;
  reserve_target: number;
  available: number;
}

interface Book {
  rent_book: number;
  owner_total: number;
  owners_below_zero: number;
  deposits_held: number;
}

interface Reconciliation {
  id: string;
  account: "rent" | "deposits";
  period_end: string;
  bank_balance: number;
  adjustments: number;
  book_balance: number;
  owner_total: number | null;
  difference: number;
  note: string | null;
  created_at: string;
}

const cents = (n: number) => Math.round(n * 100) / 100;

// Last day of a YYYY-MM month.
function lastDay(month: string) {
  const d = new Date(`${nextMonth(month)}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function lastMonth() {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function StaffTrust() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Trust</h1>
          <p className="sub">
            Rent sits in one pooled trust account, with a ledger for each owner. Pay owners out of their own balance only,
            and reconcile the bank, the books and the owner ledgers every month.
          </p>
        </div>
      </div>
      <Payouts />
      <Reconcile />
    </>
  );
}

function Payouts() {
  const balances = useQuery<OwnerBalance[]>(async () => supabase.rpc("trust_owner_balances"), []);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [date, setDate] = useState(todayISO());
  const [busy, setBusy] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(b: OwnerBalance) {
    const amount = Number(amounts[b.owner_id] ?? b.available);
    if (!(amount >= 0)) return setError("Enter a payout amount of zero or more.");
    const fee = Number(b.fee_due);
    const lines = [
      fee > 0 ? `move ${money(fee)} management fee to DH` : null,
      amount > 0 ? `record a ${money(amount)} payout to ${b.owner_name}` : null,
    ].filter(Boolean);
    if (!lines.length) return setError("Nothing to record: no fee is due and the payout is $0.");
    if (!window.confirm(`On ${shortDate(date)}, ${lines.join(" and ")}?\n\nSend the bank transfer yourself; this records it.`)) return;
    setBusy(b.owner_id);
    setOk(null);
    setError(null);
    const res = await supabase.rpc("record_owner_payout", {
      p_owner: b.owner_id,
      p_date: date,
      p_amount: amount,
      p_reference: `Payout ${date}`,
    });
    setBusy(null);
    if (res.error) return setError(res.error.message);
    const r = (res.data as { fees_moved: number; paid_out: number }[])[0];
    setOk(`${b.owner_name}: ${money(r.fees_moved)} fee moved, ${money(r.paid_out)} paid out. Both are on the ledger.`);
    setAmounts(({ [b.owner_id]: _done, ...rest }) => rest);
    balances.reload();
  }

  const rows = balances.data ?? [];
  return (
    <div className="card noprint">
      <div className="card-head">
        <h2>Owner balances and payouts</h2>
        <label className="field" style={{ margin: 0 }}>
          <span>Payout date</span>
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} />
        </label>
      </div>
      <p className="muted" style={{ fontSize: ".9rem" }}>
        Available = balance − management fee due − reserve target. Paying out moves the fee to DH first, then records the
        payout across the owner's properties. A bill that would take an owner below zero is refused.
      </p>
      <FormMessage ok={ok} error={error} />
      <Loading error={balances.error} loading={balances.loading && !balances.data} />
      {balances.data && rows.length === 0 && <p className="muted">No owners yet.</p>}
      {rows.length > 0 && (
        <div className="tbl-wrap">
          <table className="tbl rt">
            <thead>
              <tr>
                <th>Owner</th>
                <th className="n">Balance</th>
                <th className="n">Fee due</th>
                <th className="n">Reserve</th>
                <th className="n">Available</th>
                <th>Pay out</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.owner_id}>
                  <td data-label="Owner">
                    <div className="cell">{b.owner_name}</div>
                  </td>
                  <td data-label="Balance" className={Number(b.balance) < 0 ? "n neg" : "n"}>
                    <div className="cell">{acct(Number(b.balance))}</div>
                  </td>
                  <td data-label="Fee due" className="n">
                    <div className="cell">{acct(Number(b.fee_due))}</div>
                  </td>
                  <td data-label="Reserve" className="n">
                    <div className="cell">{acct(Number(b.reserve_target))}</div>
                  </td>
                  <td data-label="Available" className="n">
                    <div className="cell">
                      <b>{acct(Number(b.available))}</b>
                    </div>
                  </td>
                  <td data-label="Pay out" className="actions">
                    <div className="cell" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        aria-label={`Payout for ${b.owner_name}`}
                        style={{ width: 110 }}
                        value={amounts[b.owner_id] ?? String(cents(Number(b.available)))}
                        onChange={(e) => setAmounts((a) => ({ ...a, [b.owner_id]: e.target.value }))}
                      />
                      <button className="btn btn-primary btn-xs" disabled={busy !== null} onClick={() => void pay(b)}>
                        {busy === b.owner_id ? "Saving…" : "Record"}
                      </button>
                    </div>
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

function Reconcile() {
  const [month, setMonth] = useState(lastMonth());
  const periodEnd = lastDay(month);
  const book = useQuery<Book[]>(async () => supabase.rpc("trust_book", { p_as_of: periodEnd }), [periodEnd]);
  const history = useQuery<Reconciliation[]>(
    async () => supabase.from("trust_reconciliations").select("*").order("period_end", { ascending: false }).order("account").limit(48),
    [],
  );
  const saved = (account: string) => history.data?.find((r) => r.account === account && r.period_end === periodEnd);
  const b = book.data?.[0];

  return (
    <div className="card trust-recon">
      <div className="card-head">
        <h2>Month-end reconciliation</h2>
        <div className="controls">
          <label className="field" style={{ margin: 0 }}>
            <span>Month</span>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} />
          </label>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
            Print / PDF
          </button>
        </div>
      </div>
      <p className="muted" style={{ fontSize: ".9rem" }}>
        Three numbers must agree as of {shortDate(periodEnd)}: the bank statement (plus deposits in transit, minus
        outstanding checks), the ledger, and the sum of the owner ledgers. Enter the bank balance from the statement and
        save it as the record for {monthLabel(month)}.
      </p>
      <Loading error={book.error ?? history.error} loading={book.loading && !book.data} />
      {b && (
        <>
          {b.owners_below_zero > 0 && (
            <p className="form-msg err" role="alert">
              {b.owners_below_zero} owner{b.owners_below_zero === 1 ? " is" : "s are"} below zero as of{" "}
              {shortDate(periodEnd)}. Another owner's money is covering them; collect a contribution.
            </p>
          )}
          <div className="recon-grid">
            <AccountRecon
              key={`rent-${periodEnd}-${saved("rent")?.id ?? ""}`}
              account="rent"
              title="Rent trust account"
              periodEnd={periodEnd}
              book={Number(b.rent_book)}
              ownerTotal={Number(b.owner_total)}
              existing={saved("rent")}
              onSaved={history.reload}
            />
            <AccountRecon
              key={`dep-${periodEnd}-${saved("deposits")?.id ?? ""}`}
              account="deposits"
              title="Security deposit trust account"
              periodEnd={periodEnd}
              book={Number(b.deposits_held)}
              existing={saved("deposits")}
              onSaved={history.reload}
              bookNote="Deposits on current leases, plus ended leases whose deposit statement hasn't gone out. Reflects lease status today."
            />
          </div>
        </>
      )}

      {!!history.data?.length && (
        <>
          <h3 style={{ marginTop: 24 }}>Saved reconciliations</h3>
          <div className="tbl-wrap">
            <table className="tbl rt">
              <thead>
                <tr>
                  <th>Month end</th>
                  <th>Account</th>
                  <th className="n">Bank + adj.</th>
                  <th className="n">Book</th>
                  <th className="n">Owner ledgers</th>
                  <th className="n">Difference</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {history.data.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Month end"><div className="cell">{shortDate(r.period_end)}</div></td>
                    <td data-label="Account"><div className="cell">{r.account === "rent" ? "Rent" : "Deposits"}</div></td>
                    <td data-label="Bank + adj." className="n"><div className="cell">{acct(Number(r.bank_balance) + Number(r.adjustments))}</div></td>
                    <td data-label="Book" className="n"><div className="cell">{acct(Number(r.book_balance))}</div></td>
                    <td data-label="Owner ledgers" className="n"><div className="cell">{r.owner_total === null ? "—" : acct(Number(r.owner_total))}</div></td>
                    <td data-label="Difference" className={Number(r.difference) === 0 ? "n" : "n neg"}>
                      <div className="cell">{Number(r.difference) === 0 ? "Balanced" : acct(Number(r.difference))}</div>
                    </td>
                    <td data-label="Note"><div className="cell">{r.note ?? ""}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function AccountRecon(props: {
  account: "rent" | "deposits";
  title: string;
  periodEnd: string;
  book: number;
  ownerTotal?: number;
  existing?: Reconciliation;
  bookNote?: string;
  onSaved: () => void;
}) {
  const { existing } = props;
  const [bank, setBank] = useState(existing ? String(existing.bank_balance) : "");
  const [adj, setAdj] = useState(existing ? String(existing.adjustments) : "0");
  const [note, setNote] = useState(existing?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(existing ? `Saved ${shortDate(existing.created_at.slice(0, 10))}.` : null);
  const [error, setError] = useState<string | null>(null);

  const adjusted = bank === "" ? null : cents(Number(bank) + Number(adj || 0));
  const diff = adjusted === null ? null : cents(adjusted - props.book);
  const ledgerDiff = props.ownerTotal === undefined ? 0 : cents(props.book - props.ownerTotal);
  const balanced = diff === 0 && ledgerDiff === 0;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await supabase.from("trust_reconciliations").upsert(
      {
        account: props.account,
        period_end: props.periodEnd,
        bank_balance: Number(bank),
        adjustments: Number(adj || 0),
        book_balance: props.book,
        owner_total: props.ownerTotal ?? null,
        note: note.trim() || null,
      },
      { onConflict: "account,period_end" },
    );
    setBusy(false);
    if (res.error) return setError(res.error.message);
    setOk("Saved.");
    props.onSaved();
  }

  return (
    <form className="form recon" onSubmit={save}>
      <h3>{props.title}</h3>
      <dl className="kv">
        <dt>
          <label htmlFor={`bank-${props.account}`}>Bank statement balance</label>
        </dt>
        <dd>
          <input id={`bank-${props.account}`} type="number" step="0.01" required value={bank} onChange={(e) => setBank(e.target.value)} />
        </dd>
        <dt>
          <label htmlFor={`adj-${props.account}`}>In transit − outstanding checks</label>
        </dt>
        <dd>
          <input id={`adj-${props.account}`} type="number" step="0.01" value={adj} onChange={(e) => setAdj(e.target.value)} />
        </dd>
        <dt>Adjusted bank balance</dt>
        <dd>{adjusted === null ? "—" : money(adjusted)}</dd>
        <dt>Book balance</dt>
        <dd>{money(props.book)}</dd>
        {props.ownerTotal !== undefined && (
          <>
            <dt>Sum of owner ledgers</dt>
            <dd>{money(props.ownerTotal)}</dd>
          </>
        )}
        <dt>Result</dt>
        <dd>
          {diff === null ? (
            <span className="muted">Enter the bank balance</span>
          ) : balanced ? (
            <span className="tag ok">Balanced</span>
          ) : (
            <span className="tag flag">
              {diff !== 0 ? `Bank vs book off by ${money(diff)}` : ""}
              {diff !== 0 && ledgerDiff !== 0 ? " · " : ""}
              {ledgerDiff !== 0 ? `Book vs owners off by ${money(ledgerDiff)}` : ""}
            </span>
          )}
        </dd>
      </dl>
      {props.bookNote && <p className="muted" style={{ fontSize: ".8rem" }}>{props.bookNote}</p>}
      <label className="field">
        <span>Note (optional)</span>
        <input value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder="Check 1043 outstanding" />
      </label>
      <FormMessage ok={ok} error={error} />
      <div className="btn-row">
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy || bank === ""}>
          {busy ? "Saving…" : existing ? "Update record" : "Save record"}
        </button>
      </div>
    </form>
  );
}
