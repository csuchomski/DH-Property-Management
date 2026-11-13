import {
  LEASE_STATUS_LABEL, PRIORITY_HINT, PRIORITY_LABEL, WO_STATUS_LABEL,
  type LeaseStatus, type Priority, type WorkOrderStatus,
} from "../lib/types";

const PRIORITY_TONE: Record<Priority, string> = { P1: "crit", P2: "warn", P3: "" };

// Null for work orders staff opened directly: those never went through triage, and an
// invented priority would undercut the point of showing one.
export function PriorityTag({ priority, showRule }: { priority: Priority | null; showRule?: string | null }) {
  if (!priority) return null;
  return (
    <span className={`tag ${PRIORITY_TONE[priority]}`} title={`${priority} — ${PRIORITY_HINT[priority]}`}>
      {PRIORITY_LABEL[priority]}{showRule ? ` · ${showRule}` : ""}
    </span>
  );
}

const WO_TONE: Record<WorkOrderStatus, string> = {
  open: "",
  awaiting_approval: "warn",
  approved: "flag",
  declined: "",
  scheduled: "flag",
  closed: "ok",
};

export function WorkOrderTag({ status, closedOn }: { status: WorkOrderStatus; closedOn?: string | null }) {
  return <span className={`tag ${WO_TONE[status]}`}>{WO_STATUS_LABEL[status]}{status === "closed" && closedOn ? ` ${closedOn}` : ""}</span>;
}

const LEASE_TONE: Record<LeaseStatus, string> = { active: "ok", notice_given: "warn", renewal_out: "warn", ended: "" };

export function LeaseTag({ status }: { status: LeaseStatus }) {
  return <span className={`tag ${LEASE_TONE[status]}`}>{LEASE_STATUS_LABEL[status]}</span>;
}

export function Loading({ error, loading }: { error?: string | null; loading?: boolean }) {
  if (error) return <p className="notice">Couldn't load: {error}</p>;
  if (loading) return <p className="muted" style={{ marginTop: 16 }}>Loading…</p>;
  return null;
}
