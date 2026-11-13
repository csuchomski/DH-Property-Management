import { supabase } from "./supabase";
import { FEE_CATEGORIES, isExpense, isIncome, type Lease, type Owner, type Property, type Transaction, type Unit } from "./types";

export type UnitWithLeases = Unit & { leases: Lease[] };
export type PropertyWithUnits = Property & { units: UnitWithLeases[] };

// Owners see only their own rows through RLS; staff pass an owner id to filter.
export async function loadPortfolio(ownerId: string) {
  const [owner, props] = await Promise.all([
    supabase.from("owners").select("*").eq("id", ownerId).single(),
    supabase
      .from("properties")
      .select("*, units(*, leases(*, lease_tenants(tenants(id, full_name))))")
      .eq("owner_id", ownerId)
      .order("address"),
  ]);
  const error = owner.error ?? props.error;
  if (error) return { data: null, error };
  const properties = (props.data as PropertyWithUnits[]).map((p) => ({
    ...p,
    units: [...p.units].sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
  }));
  return { data: { owner: owner.data as Owner, properties }, error: null };
}

export type TxnWithProperty = Transaction & { properties: { owner_id: string; address: string; city: string } };

export async function loadTransactions(ownerId: string, from: string, to: string) {
  const res = await supabase
    .from("transactions")
    .select("*, properties!inner(owner_id, address, city)")
    .eq("properties.owner_id", ownerId)
    .gte("txn_date", from)
    .lt("txn_date", to)
    .order("txn_date")
    .order("created_at");
  return { data: res.data as TxnWithProperty[] | null, error: res.error };
}

// The lease currently attached to a unit: not ended, most recent start.
export function currentLease(u: UnitWithLeases): Lease | null {
  return (
    u.leases
      .filter((l) => l.status !== "ended")
      .sort((a, b) => b.start_date.localeCompare(a.start_date))[0] ?? null
  );
}

export const tenantNames = (l: Lease | null) =>
  l?.lease_tenants?.map((lt) => lt.tenants?.full_name).filter(Boolean).join(", ") || "";

// Management fee is charged per month on collected rent and late fees, rounded to the cent.
export function managementFee(txns: Transaction[], rate: number) {
  const byMonth = new Map<string, number>();
  for (const t of txns) {
    if (t.kind === "receipt" && FEE_CATEGORIES.includes(t.category)) {
      const m = t.txn_date.slice(0, 7);
      byMonth.set(m, (byMonth.get(m) ?? 0) + Number(t.amount));
    }
  }
  let fee = 0;
  byMonth.forEach((base) => (fee += Math.round(base * rate * 100) / 100));
  return Math.round(fee * 100) / 100;
}

export const sum = (xs: { amount: number | string }[]) =>
  Math.round(xs.reduce((s, x) => s + Number(x.amount), 0) * 100) / 100;

export interface PropertySummary {
  property: { id: string; address: string; city: string };
  collected: number;
  operating: number;
  fee: number;
  net: number;
}

export function summarizeByProperty(txns: TxnWithProperty[], rate: number): PropertySummary[] {
  const groups = new Map<string, TxnWithProperty[]>();
  for (const t of txns) groups.set(t.property_id, [...(groups.get(t.property_id) ?? []), t]);
  return [...groups.entries()]
    .map(([id, ts]) => {
      // Owner contributions, fee transfers and payouts move money but aren't income or expense.
      const collected = sum(ts.filter((t) => t.kind === "receipt" && isIncome(t.category)));
      const operating = sum(ts.filter((t) => t.kind === "disbursement" && isExpense(t.category)));
      const fee = managementFee(ts, rate);
      return {
        property: { id, address: ts[0].properties.address, city: ts[0].properties.city },
        collected,
        operating,
        fee,
        net: Math.round((collected - operating - fee) * 100) / 100,
      };
    })
    .sort((a, b) => a.property.address.localeCompare(b.property.address));
}

export interface TrustPosition {
  property_id: string;
  address: string;
  balance: number;
  fee_due: number;
}

// The owner's rent-trust balance by property, from the database (owners see only theirs).
export async function loadTrustPosition(ownerId: string, asOf?: string) {
  const res = await supabase.rpc("owner_trust_position", asOf ? { p_owner: ownerId, p_as_of: asOf } : { p_owner: ownerId });
  return { data: res.data as TrustPosition[] | null, error: res.error };
}
