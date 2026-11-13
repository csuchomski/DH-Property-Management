import { Approvals, WO_SELECT_BY_OWNER, woPlace, type WorkOrderRow } from "../../../components/Approvals";
import { PhotoStrip } from "../../../components/Documents";
import { useOwnerSelection } from "../../../components/OwnerPicker";
import { Loading, PriorityTag, WorkOrderTag } from "../../../components/Status";
import { acct, shortDate } from "../../../lib/format";
import type { DocumentRow } from "../../../lib/documents";
import { supabase } from "../../../lib/supabase";
import { useQuery } from "../../../lib/useQuery";

export default function OwnerWorkOrders() {
  const { ownerId } = useOwnerSelection();
  const wos = useQuery<WorkOrderRow[]>(
    async () =>
      ownerId
        ? await supabase
            .from("work_orders")
            .select(WO_SELECT_BY_OWNER)
            .eq("properties.owner_id", ownerId)
            .order("opened_on", { ascending: false })
            .order("number", { ascending: false })
            .limit(300)
        : { data: [], error: null },
    [ownerId],
  );
  const photos = useQuery<DocumentRow[]>(
    async () => await supabase.from("documents").select("*").eq("kind", "maintenance_photo").order("created_at"),
    [ownerId],
  );
  const all = wos.data ?? [];
  const waiting = all.filter((w) => w.status === "awaiting_approval");
  const open = all.filter((w) => w.status !== "closed" && w.status !== "declined");
  const closed = all.filter((w) => w.status === "closed");

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Maintenance and work orders</h1>
          <p className="sub">Every request, what it cost, and how long it stayed open</p>
        </div>
      </div>
      <Loading error={wos.error} loading={wos.loading && !wos.data} />

      <div className="stats">
        <div>
          <span>Waiting on you</span>
          <b>{waiting.length}</b>
          <small>Above your threshold</small>
        </div>
        <div>
          <span>Open</span>
          <b>{open.length}</b>
          <small>Including approved work</small>
        </div>
        <div>
          <span>Closed</span>
          <b>{closed.length}</b>
          <small>All time</small>
        </div>
        <div>
          <span>Billed, closed work</span>
          <b>${acct(closed.reduce((s, w) => s + Number(w.cost ?? 0), 0))}</b>
          <small>Work orders only</small>
        </div>
      </div>

      <div className="card">
        <h2>Waiting on your approval</h2>
        <Approvals items={waiting} onDone={wos.reload} />
      </div>

      <div className="card">
        <h2>Work order log</h2>
        <div className="tbl-wrap">
          <table className="tbl" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th>WO</th>
                <th>Opened</th>
                <th>Unit</th>
                <th>Category</th>
                <th>Description</th>
                <th>Vendor</th>
                <th>Response</th>
                <th>Status</th>
                <th className="n">Cost</th>
              </tr>
            </thead>
            <tbody>
              {all.map((w) => (
                <tr key={w.id}>
                  <td>{w.number}</td>
                  <td>{shortDate(w.opened_on)}</td>
                  <td>{woPlace(w)}</td>
                  <td>{w.category}</td>
                  <td>
                    <b>{w.title}</b>
                    {w.description ? <>. {w.description}</> : null}
                    <PhotoStrip docs={(photos.data ?? []).filter((p) => p.work_order_id === w.id)} />
                    {!!w.triage_answers?.length && (
                      <ul className="triage-trail">
                        {w.triage_answers.map((t, i) => (
                          <li key={i}>{t.q} → {t.a}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td>{w.vendor ?? "—"}</td>
                  <td>
                    <PriorityTag priority={w.priority} />
                    {w.rule_id && <div className="rule-chip">{w.rule_id}</div>}
                  </td>
                  <td>
                    <WorkOrderTag status={w.status} closedOn={w.closed_on ? shortDate(w.closed_on) : null} />
                  </td>
                  <td className="n">
                    {w.cost !== null ? acct(Number(w.cost)) : w.bid_amount !== null ? <span className="muted">bid {acct(Number(w.bid_amount))}</span> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
