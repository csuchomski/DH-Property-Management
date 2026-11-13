import { supabase } from "./supabase";

export const BUCKET = "documents";

export type DocumentKind =
  | "lease" | "addendum"
  | "move_in_template" | "move_out_template"
  | "move_in_checklist" | "move_out_checklist"
  | "renters_insurance" | "deposit_statement"
  | "maintenance_photo" | "other";

export interface DocumentRow {
  id: string;
  kind: DocumentKind;
  title: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  lease_id: string | null;
  work_order_id: string | null;
  property_id: string | null;
  unit_id: string | null;
  expires_on: string | null;
  uploaded_by_role: "staff" | "owner" | "tenant" | null;
  created_at: string;
}

export const KIND_LABEL: Record<DocumentKind, string> = {
  lease: "Signed lease",
  addendum: "Addendum",
  move_in_template: "Move-in checklist (blank)",
  move_out_template: "Move-out checklist (blank)",
  move_in_checklist: "Move-in checklist",
  move_out_checklist: "Move-out checklist",
  renters_insurance: "Renters insurance",
  deposit_statement: "Deposit statement",
  maintenance_photo: "Photo",
  other: "Other",
};

// What the bucket accepts; keep in step with the documents_and_move_out migration.
export const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.doc,.docx";
export const PHOTO_ACCEPT = "image/*";
export const MAX_BYTES = 15 * 1024 * 1024;

export const fileSize = (n: number | null) =>
  n === null ? "" : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;

// Storage keys: keep letters, digits, dot, dash and underscore; prefix a random id so two
// files with the same name never collide.
function storageName(file: File) {
  const clean = file.name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-80) || "file";
  return `${crypto.randomUUID().slice(0, 8)}-${clean}`;
}

export function checkFile(file: File): string | null {
  if (file.size > MAX_BYTES) return `${file.name} is larger than 15 MB.`;
  return null;
}

async function put(prefix: string, file: File) {
  const path = `${prefix}/${storageName(file)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || undefined,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return path;
}

interface Meta {
  kind: DocumentKind;
  title: string;
  expiresOn?: string | null;
}

// Tenants: upload under their lease or work order, then register the file. The
// database checks both steps, so this can't be used to reach someone else's lease.
export async function tenantUpload(target: { leaseId?: string; workOrderId?: string }, file: File, meta: Meta) {
  const prefix = target.leaseId ? `leases/${target.leaseId}` : `work_orders/${target.workOrderId}`;
  const path = await put(prefix, file);
  const { error } = await supabase.rpc("register_document", {
    p_path: path,
    p_kind: meta.kind,
    p_title: meta.title,
    p_mime: file.type || null,
    p_size: file.size,
    p_expires_on: meta.expiresOn || null,
  });
  if (error) throw new Error(error.message);
}

// Staff: upload anywhere and write the documents row directly.
export async function staffUpload(target: { leaseId?: string; workOrderId?: string; template?: boolean }, file: File, meta: Meta) {
  const prefix = target.template ? "templates" : target.leaseId ? `leases/${target.leaseId}` : `work_orders/${target.workOrderId}`;
  const path = await put(prefix, file);
  const { error } = await supabase.from("documents").insert({
    kind: meta.kind,
    title: meta.title,
    storage_path: path,
    mime_type: file.type || null,
    size_bytes: file.size,
    lease_id: target.leaseId ?? null,
    work_order_id: target.workOrderId ?? null,
    expires_on: meta.expiresOn || null,
    uploaded_by_role: "staff",
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
}

export async function staffDelete(doc: DocumentRow) {
  const { error } = await supabase.from("documents").delete().eq("id", doc.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from(BUCKET).remove([doc.storage_path]);
}

// Private files open through links that expire after an hour. One request signs a whole list.
export async function signedLinks(docs: DocumentRow[]) {
  const map = new Map<string, string>();
  if (!docs.length) return map;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(docs.map((d) => d.storage_path), 3600);
  if (error) throw new Error(error.message);
  for (const s of data ?? []) if (s.path && s.signedUrl) map.set(s.path, s.signedUrl);
  return map;
}

export const downloadUrl = (signed: string, doc: DocumentRow) => {
  const ext = doc.storage_path.split(".").pop();
  const name = `${doc.title.replace(/[^\w .-]+/g, "").trim() || "document"}${ext && ext.length <= 5 ? `.${ext}` : ""}`;
  return `${signed}${signed.includes("?") ? "&" : "?"}download=${encodeURIComponent(name)}`;
};

export const isImage = (doc: DocumentRow) => (doc.mime_type ?? "").startsWith("image/") && !/hei[cf]/.test(doc.mime_type ?? "");
