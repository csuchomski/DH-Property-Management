export type Role = "staff" | "owner" | "tenant";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role | null;
  owner_id: string | null;
  tenant_id: string | null;
}

export interface Owner {
  id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  mgmt_rate: number;
  approval_threshold: number;
  reserve_target: number;
  ach_last4: string | null;
}

export interface Property {
  id: string;
  owner_id: string;
  address: string;
  city: string;
  county: string | null;
  state: string;
  zip: string | null;
  kind: string | null;
  year_built: number | null;
}

export type UnitStatus = "occupied" | "vacant" | "turnover" | "listed";
export interface Unit {
  id: string;
  property_id: string;
  label: string;
  beds: number | null;
  baths: number | null;
  market_rent: number | null;
  status: UnitStatus;
  asking_rent: number | null;
  available_on: string | null;
}

export type LeaseStatus = "active" | "notice_given" | "renewal_out" | "ended";
export interface Lease {
  id: string;
  unit_id: string;
  start_date: string;
  end_date: string | null;
  rent: number;
  deposit: number;
  late_fee: number;
  grace_days: number;
  status: LeaseStatus;
  notice_date: string | null;
  lease_tenants?: { tenants: { id: string; full_name: string } | null }[];
}

export type WorkOrderStatus = "open" | "awaiting_approval" | "approved" | "declined" | "scheduled" | "closed";

// Set by triage_decision() in the database when a tenant submits. Null on work orders
// staff opened directly, which never went through triage.
export type Priority = "P1" | "P2" | "P3";

export interface TriageAnswer {
  q: string;
  a: string;
}

export interface WorkOrder {
  id: string;
  number: string | null;
  property_id: string;
  unit_id: string | null;
  opened_on: string;
  category: string;
  title: string;
  description: string | null;
  vendor: string | null;
  status: WorkOrderStatus;
  is_emergency: boolean;
  bid_amount: number | null;
  cost: number | null;
  closed_on: string | null;
  decision_note: string | null;
  priority: Priority | null;
  rule_id: string | null;
  triage_answers: TriageAnswer[];
}

export interface Transaction {
  id: string;
  property_id: string;
  unit_id: string | null;
  lease_id: string | null;
  txn_date: string;
  kind: "receipt" | "disbursement";
  category: string;
  description: string | null;
  payee_payer: string | null;
  method: string | null;
  reference: string | null;
  amount: number;
}

// Income: counts on statements and Schedule E.
export const INCOME_CATEGORIES = ["rent", "late_fee", "other_income"] as const;
// Expenses paid from trust on the owner's behalf.
export const EXPENSE_CATEGORIES = [
  "repairs", "cleaning_maintenance", "grounds", "utilities", "supplies",
  "advertising", "legal_professional", "insurance", "taxes", "other",
] as const;
// Money moving in or out of trust that is neither income nor an expense.
export const TRANSFER_CATEGORIES = ["owner_contribution", "management_fee", "owner_distribution"] as const;

export const RECEIPT_CATEGORIES = [...INCOME_CATEGORIES, "owner_contribution"] as const;
export const DISBURSEMENT_CATEGORIES = [...EXPENSE_CATEGORIES, "management_fee", "owner_distribution"] as const;

export const isIncome = (c: string) => (INCOME_CATEGORIES as readonly string[]).includes(c);
export const isExpense = (c: string) => (EXPENSE_CATEGORIES as readonly string[]).includes(c);

export const CATEGORY_LABEL: Record<string, string> = {
  rent: "Rent",
  late_fee: "Late fee",
  other_income: "Other income",
  repairs: "Repair",
  cleaning_maintenance: "Cleaning & maintenance",
  grounds: "Grounds",
  utilities: "Utilities",
  supplies: "Supplies",
  advertising: "Advertising",
  legal_professional: "Legal & professional",
  insurance: "Insurance",
  taxes: "Taxes",
  other: "Other",
  owner_contribution: "Owner contribution",
  management_fee: "Management fee to DH",
  owner_distribution: "Owner payout",
};

// Schedule E line for each category. Management fees (line 11) are computed, not stored.
export const SCHEDULE_E: { line: number; label: string; categories: string[] }[] = [
  { line: 5, label: "Advertising", categories: ["advertising"] },
  { line: 7, label: "Cleaning and maintenance", categories: ["cleaning_maintenance"] },
  { line: 9, label: "Insurance", categories: ["insurance"] },
  { line: 10, label: "Legal and professional fees", categories: ["legal_professional"] },
  { line: 14, label: "Repairs", categories: ["repairs"] },
  { line: 15, label: "Supplies", categories: ["supplies"] },
  { line: 16, label: "Taxes", categories: ["taxes"] },
  { line: 17, label: "Utilities", categories: ["utilities"] },
  { line: 19, label: "Other — lawn, snow, licenses, inspections", categories: ["grounds", "other"] },
];

export const FEE_CATEGORIES = ["rent", "late_fee"];

export const WO_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  open: "Open",
  awaiting_approval: "Awaiting your OK",
  approved: "Approved",
  declined: "Declined",
  scheduled: "Scheduled",
  closed: "Closed",
};

// What each priority promises. Shown to tenants and owners, so it has to match the sla
// text in triage_decision() — change both together.
export const PRIORITY_LABEL: Record<Priority, string> = {
  P1: "Tonight",
  P2: "Scheduled",
  P3: "Next visit",
};

export const PRIORITY_HINT: Record<Priority, string> = {
  P1: "Dispatched the same night — damage or safety if it waits",
  P2: "Next business day or two",
  P3: "Batched with the next trip to that building",
};

export const LEASE_STATUS_LABEL: Record<LeaseStatus, string> = {
  active: "Current",
  notice_given: "Notice given",
  renewal_out: "Renewal out",
  ended: "Ended",
};
