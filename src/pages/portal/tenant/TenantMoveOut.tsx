import { useState, type FormEvent } from "react";
import { DocumentList } from "../../../components/Documents";
import { Field, FormMessage } from "../../../components/Forms";
import { Loading } from "../../../components/Status";
import type { DocumentRow } from "../../../lib/documents";
import { fullDate, money, todayISO } from "../../../lib/format";
import { SITE } from "../../../lib/site";
import { supabase } from "../../../lib/supabase";
import { useQuery } from "../../../lib/useQuery";
import { leasePlace, loadMyLeases, type TenantLease } from "./tenantData";

export interface MoveOut {
  id: string;
  lease_id: string;
  move_out_date: string;
  forwarding_address: string | null;
  walkthrough_requested: boolean;
  tenant_note: string | null;
  submitted_at: string;
  walkthrough_on: string | null;
  deposit_refund: number | null;
  deposit_withheld: number | null;
  deposit_statement_sent_on: string | null;
}

export default function TenantMoveOut() {
  const leases = useQuery(loadMyLeases, []);
  const moveOuts = useQuery<MoveOut[]>(async () => await supabase.from("move_outs").select("*"), []);
  const statements = useQuery<DocumentRow[]>(
    async () => await supabase.from("documents").select("*").eq("kind", "deposit_statement").order("created_at", { ascending: false }),
    [],
  );
  const list = leases.data ?? [];
  const byLease = new Map((moveOuts.data ?? []).map((m) => [m.lease_id, m]));
  // Current leases, plus ended ones that still have a deposit to show.
  const shown = list.filter((l) => l.status !== "ended" || byLease.has(l.id));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Moving out</h1>
          <p className="sub">Give notice, tell us where to send your deposit, and book a walkthrough before you go.</p>
        </div>
      </div>
      <Loading error={leases.error ?? moveOuts.error} loading={(leases.loading && !leases.data) || (moveOuts.loading && !moveOuts.data)} />
      {leases.data && moveOuts.data && shown.length === 0 && (
        <p className="notice">We don't have a current lease on file for you. Call {SITE.phone}.</p>
      )}
      {leases.data &&
        moveOuts.data &&
        shown.map((l) => (
          <LeaseMoveOut
            key={l.id}
            lease={l}
            moveOut={byLease.get(l.id) ?? null}
            statements={(statements.data ?? []).filter((d) => d.lease_id === l.id)}
            onSaved={() => {
              moveOuts.reload();
              leases.reload();
            }}
          />
        ))}
    </>
  );
}

function LeaseMoveOut({
  lease,
  moveOut,
  statements,
  onSaved,
}: {
  lease: TenantLease;
  moveOut: MoveOut | null;
  statements: DocumentRow[];
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(!moveOut);
  const [date, setDate] = useState(moveOut?.move_out_date ?? lease.end_date ?? "");
  const [address, setAddress] = useState(moveOut?.forwarding_address ?? "");
  const [walk, setWalk] = useState(moveOut?.walkthrough_requested ?? true);
  const [note, setNote] = useState(moveOut?.tenant_note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const settled = !!moveOut?.deposit_statement_sent_on;
  const ended = lease.status === "ended";

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!date) {
      setError("Pick the day you'll hand back the keys.");
      return;
    }
    if (!address.trim()) {
      setError("Add a forwarding address. That's where we mail your deposit and the itemized statement.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc("submit_move_out_notice", {
      p_lease_id: lease.id,
      p_move_out_date: date,
      p_forwarding_address: address.trim(),
      p_walkthrough: walk,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setOk(moveOut ? "Saved." : "Notice received. We'll confirm the walkthrough and send move-out instructions.");
    setEditing(false);
    onSaved();
  }

  return (
    <div className="card">
      <div className="card-head">
        <h2>{leasePlace(lease)}</h2>
        {moveOut ? (
          <span className={`tag ${settled ? "ok" : "warn"}`}>{settled ? "Deposit settled" : `Moving out ${fullDate(moveOut.move_out_date)}`}</span>
        ) : (
          <span className="tag">Lease {lease.end_date ? `ends ${fullDate(lease.end_date)}` : "is month to month"}</span>
        )}
      </div>
      <FormMessage ok={ok} />

      {moveOut && !editing && (
        <>
          <dl className="kv">
            <dt>Notice given</dt>
            <dd>{fullDate(moveOut.submitted_at.slice(0, 10))}</dd>
            <dt>Move-out date</dt>
            <dd>{fullDate(moveOut.move_out_date)}</dd>
            <dt>Forwarding address</dt>
            <dd style={{ whiteSpace: "pre-wrap" }}>{moveOut.forwarding_address ?? "—"}</dd>
            <dt>Walkthrough</dt>
            <dd>
              {moveOut.walkthrough_on
                ? `Scheduled ${fullDate(moveOut.walkthrough_on)}`
                : moveOut.walkthrough_requested
                  ? "Requested. We'll call to set a time."
                  : "Not requested"}
            </dd>
          </dl>
          {!settled && !ended && (
            <div className="btn-row" style={{ marginTop: 14 }}>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Change details</button>
            </div>
          )}
        </>
      )}

      {editing && !settled && !ended && (
        <form className="form" onSubmit={submit}>
          {!moveOut && (
            <p className="note-text">
              Check your lease for the notice it requires (often 28 or 60 days before the end date). Submitting this form
              is your written notice; the date it arrives is recorded.
            </p>
          )}
          <div className="row">
            <Field label="Move-out date" hint="The day you'll return every key.">
              <input type="date" value={date} min={todayISO()} onChange={(e) => setDate(e.target.value)} required />
            </Field>
          </div>
          <Field label="Forwarding address" hint="Where we mail your deposit and the itemized statement.">
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} maxLength={500} rows={3} />
          </Field>
          <label className="check">
            <input type="checkbox" checked={walk} onChange={(e) => setWalk(e.target.checked)} />
            <span>Book a pre-move-out walkthrough, so I know what to fix before I leave.</span>
          </label>
          <Field label="Anything we should know (optional)">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={2} />
          </Field>
          <FormMessage error={error} />
          <div className="btn-row">
            <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
              {busy ? "Sending…" : moveOut ? "Save changes" : "Give notice"}
            </button>
            {moveOut && (
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(false)}>Cancel</button>
            )}
          </div>
        </form>
      )}

      <h3 className="sub-h">Your deposit</h3>
      {settled ? (
        <>
          <dl className="kv">
            <dt>Deposit held</dt>
            <dd>{money(lease.deposit)}</dd>
            <dt>Withheld</dt>
            <dd>{money(moveOut?.deposit_withheld ?? 0)}</dd>
            <dt>Refunded</dt>
            <dd>{money(moveOut?.deposit_refund ?? 0)}</dd>
            <dt>Statement sent</dt>
            <dd>{fullDate(moveOut!.deposit_statement_sent_on)}</dd>
          </dl>
          <DocumentList docs={statements} showKind={false} empty="The itemized statement will appear here." />
          <p className="note-text" style={{ marginTop: 10 }}>
            Disagree with an item? Reply in writing to the office within the time your statement gives, and we'll put the
            invoice in front of you.
          </p>
        </>
      ) : (
        <p className="note-text">
          {money(lease.deposit)} held in trust. Within 21 days of move-out you'll get it back, minus anything itemized
          beyond normal wear, with the statement mailed to your forwarding address and posted here.
        </p>
      )}
    </div>
  );
}
