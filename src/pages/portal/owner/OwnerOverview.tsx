import { Approvals, WO_SELECT_BY_OWNER, type WorkOrderRow } from "../../../components/Approvals";
import { useOwnerSelection } from "../../../components/OwnerPicker";
import { LeaseTag, Loading } from "../../../components/Status";
import { acct, fullDate, money, pct } from "../../../lib/format";
import { currentLease, loadPortfolio, loadTrustPosition, tenantNames } from "../../../lib/portfolio";
import { supabase } from "../../../lib/supabase";
import { useQuery } from "../../../lib/useQuery";

export default function OwnerOverview() {
  const { ownerId, picker } = useOwnerSelection();
  const portfolio = useQuery(async () => (ownerId ? loadPortfolio(ownerId) : { data: null, error: null }), [ownerId]);
  const trust = useQuery(async () => (ownerId ? loadTrustPosition(ownerId) : { data: [], error: null }), [ownerId]);
  const approvals = useQuery<WorkOrderRow[]>(
    async () =>
      ownerId
        ? await supabase
            .from("work_orders")
            .select(WO_SELECT_BY_OWNER)
            .eq("properties.owner_id", ownerId)
            .eq("status", "awaiting_approval")
            .order("opened_on")
        : { data: [], error: null },
    [ownerId],
  );

  const p = portfolio.data;
  const units = p?.properties.flatMap((x) => x.units) ?? [];
  const leased = units.map(currentLease).filter((l) => l !== null);
  const market = units.reduce((s, u) => s + Number(u.market_rent ?? 0), 0);
  const inPlace = leased.reduce((s, l) => s + Number(l.rent), 0);
  const deposits = leased.reduce((s, l) => s + Number(l.deposit), 0);
  const trustBalance = (trust.data ?? []).reduce((s, r) => s + Number(r.balance), 0);
  const reserve = Number(p?.owner.reserve_target ?? 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{p?.owner.name ?? "Portfolio"}</h1>
          {p && (
            <p className="sub">
              {p.properties.length} {p.properties.length === 1 ? "property" : "properties"} &middot; {units.length}{" "}
              {units.length === 1 ? "unit" : "units"} &middot; {pct(p.owner.mgmt_rate)} of collected rent &middot; approval
              threshold {money(p.owner.approval_threshold)}
            </p>
          )}
        </div>
        <div className="controls">{picker}</div>
      </div>
      <Loading error={portfolio.error} loading={portfolio.loading && !p} />

      {p && (
        <>
          <div className="stats">
            <div>
              <span>Physical occupancy</span>
              <b>{units.length ? pct(leased.length / units.length) : "—"}</b>
              <small>
                {leased.length} of {units.length} units leased
              </small>
            </div>
            <div>
              <span>Rent in place</span>
              <b>{money(inPlace)}</b>
              <small>Monthly, leased units</small>
            </div>
            <div>
              <span>Economic occupancy</span>
              <b>{market ? pct(inPlace / market) : "—"}</b>
              <small>In-place ÷ market rent</small>
            </div>
            <div>
              <span>Your trust balance</span>
              <b className={trustBalance < 0 ? "neg" : undefined}>{trust.data ? money(trustBalance) : "—"}</b>
              <small>
                {trust.data
                  ? trustBalance < reserve
                    ? `Below your ${money(reserve)} reserve`
                    : `Reserve ${money(reserve)} held`
                  : "Rent trust account"}
              </small>
            </div>
          </div>

          <div className="card">
            <h2>Waiting on your approval</h2>
            <Loading error={approvals.error} />
            {approvals.data && <Approvals items={approvals.data} onDone={approvals.reload} />}
          </div>

          <div className="card">
            <h2>Rent roll</h2>
            <div className="tbl-wrap">
              <table className="tbl" style={{ minWidth: 760 }}>
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Tenant</th>
                    <th>Type</th>
                    <th className="n">Market</th>
                    <th className="n">In place</th>
                    <th>Lease term</th>
                    <th className="n">Deposit</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {p.properties.map((prop) => [
                    <tr className="group" key={prop.id}>
                      <td colSpan={8}>
                        {prop.address}, {prop.city}
                        {prop.kind ? ` — ${prop.kind.toLowerCase()}` : ""}
                        {prop.year_built ? `, built ${prop.year_built}` : ""}
                      </td>
                    </tr>,
                    ...prop.units.map((u) => {
                      const l = currentLease(u);
                      return (
                        <tr key={u.id}>
                          <td>{u.label || "—"}</td>
                          <td>{l ? tenantNames(l) || "—" : <span className="muted">Vacant</span>}</td>
                          <td>
                            {u.beds !== null ? `${Number(u.beds)} bd` : ""}
                            {u.baths !== null ? ` / ${Number(u.baths)} ba` : ""}
                          </td>
                          <td className="n">{u.market_rent !== null ? acct(Number(u.market_rent)) : "—"}</td>
                          <td className="n">{l ? acct(Number(l.rent)) : "—"}</td>
                          <td>{l ? `${fullDate(l.start_date)} – ${fullDate(l.end_date)}` : "—"}</td>
                          <td className="n">{l ? acct(Number(l.deposit)) : "—"}</td>
                          <td>
                            {l ? (
                              <LeaseTag status={l.status} />
                            ) : (
                              <span className={`tag ${u.status === "listed" ? "warn" : "flag"}`}>
                                {u.status === "listed" ? "Leasing" : u.status === "turnover" ? "Turnover" : "Vacant"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }),
                  ])}
                  <tr className="total">
                    <td colSpan={3}>Totals — {units.length} units</td>
                    <td className="n">{acct(market)}</td>
                    <td className="n">{acct(inPlace)}</td>
                    <td />
                    <td className="n">{acct(deposits)}</td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
