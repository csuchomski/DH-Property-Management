import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ACCEPT, KIND_LABEL, checkFile, downloadUrl, fileSize, isImage, signedLinks,
  type DocumentKind, type DocumentRow,
} from "../lib/documents";
import { fullDate, shortDate } from "../lib/format";
import { Field, FormMessage } from "./Forms";

// Signed links for a list of documents, refreshed whenever the list changes.
export function useSignedLinks(docs: DocumentRow[] | null | undefined) {
  const [links, setLinks] = useState<Map<string, string>>(new Map());
  const key = (docs ?? []).map((d) => d.id).join(",");
  useEffect(() => {
    let active = true;
    if (!docs?.length) {
      setLinks(new Map());
      return;
    }
    signedLinks(docs)
      .then((m) => active && setLinks(m))
      .catch(() => active && setLinks(new Map()));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return links;
}

const UPLOADER: Record<string, string> = { staff: "DH", tenant: "Tenant", owner: "Owner" };

export function DocumentList({
  docs,
  empty = "Nothing here yet.",
  showKind = true,
  onDelete,
}: {
  docs: DocumentRow[];
  empty?: string;
  showKind?: boolean;
  onDelete?: (doc: DocumentRow) => void;
}) {
  const links = useSignedLinks(docs);
  const [confirm, setConfirm] = useState<string | null>(null);
  if (!docs.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="doc-list">
      {docs.map((d) => {
        const url = links.get(d.storage_path);
        return (
          <li key={d.id}>
            <div className="doc-main">
              <b>{d.title}</b>
              <span className="muted">
                {showKind && <>{KIND_LABEL[d.kind]} · </>}
                {UPLOADER[d.uploaded_by_role ?? ""] ?? "Added"} {shortDate(d.created_at.slice(0, 10))}
                {d.size_bytes ? ` · ${fileSize(d.size_bytes)}` : ""}
                {d.expires_on ? ` · policy ends ${fullDate(d.expires_on)}` : ""}
              </span>
            </div>
            <div className="doc-actions">
              {url ? (
                <>
                  <a href={url} target="_blank" rel="noreferrer">View</a>
                  <a href={downloadUrl(url, d)}>Download</a>
                </>
              ) : (
                <span className="muted">Preparing link…</span>
              )}
              {onDelete &&
                (confirm === d.id ? (
                  <>
                    <button className="link-btn danger" onClick={() => onDelete(d)}>Confirm delete</button>
                    <button className="link-btn" onClick={() => setConfirm(null)}>Keep</button>
                  </>
                ) : (
                  <button className="link-btn danger" onClick={() => setConfirm(d.id)}>Delete</button>
                ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Thumbnails for maintenance photos; other files show as links.
export function PhotoStrip({ docs }: { docs: DocumentRow[] }) {
  const links = useSignedLinks(docs);
  if (!docs.length) return null;
  return (
    <div className="photo-strip">
      {docs.map((d) => {
        const url = links.get(d.storage_path);
        if (!url) return <span key={d.id} className="photo ph" />;
        return (
          <a key={d.id} href={url} target="_blank" rel="noreferrer" className="photo" title={d.title}>
            {isImage(d) ? <img src={url} alt={d.title} loading="lazy" /> : <span>{d.title}</span>}
          </a>
        );
      })}
    </div>
  );
}

export interface UploadValues {
  file: File;
  title: string;
  kind: DocumentKind;
  expiresOn: string | null;
}

// One file at a time: pick it, name it, send it. `kinds` limits what the uploader may
// choose; with a single kind the picker is hidden.
export function UploadForm({
  kinds,
  defaultTitle,
  askExpiry,
  buttonLabel = "Upload",
  onUpload,
}: {
  kinds: DocumentKind[];
  defaultTitle?: (kind: DocumentKind) => string;
  askExpiry?: boolean;
  buttonLabel?: string;
  onUpload: (v: UploadValues) => Promise<void>;
}) {
  const [kind, setKind] = useState<DocumentKind>(kinds[0]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    const tooBig = checkFile(file);
    if (tooBig) {
      setError(tooBig);
      return;
    }
    const needsExpiry = askExpiry && kind === "renters_insurance";
    if (needsExpiry && !expires) {
      setError("Add the date the policy ends, from the declarations page.");
      return;
    }
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await onUpload({
        file,
        kind,
        title: title.trim() || defaultTitle?.(kind) || file.name,
        expiresOn: needsExpiry ? expires : null,
      });
      setOk(`Uploaded ${file.name}.`);
      setFile(null);
      setTitle("");
      setExpires("");
      if (input.current) input.current.value = "";
    } catch (err) {
      setError(friendlyUploadError((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form upload-form" onSubmit={submit}>
      <div className="row">
        {kinds.length > 1 && (
          <Field label="What is it">
            <select value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)}>
              {kinds.map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </Field>
        )}
        <Field label="File" hint="PDF, photo or Word document, up to 15 MB.">
          <input ref={input} type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>
        <Field label="Name (optional)">
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={defaultTitle?.(kind) ?? file?.name ?? ""} />
        </Field>
        {askExpiry && kind === "renters_insurance" && (
          <Field label="Policy end date">
            <input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </Field>
        )}
      </div>
      <FormMessage ok={ok} error={error} />
      <div>
        <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
          {busy ? "Uploading…" : buttonLabel}
        </button>
      </div>
    </form>
  );
}

export function friendlyUploadError(msg: string) {
  if (/mime type|not supported/i.test(msg)) return "That file type isn't accepted. Upload a PDF, a photo (JPG, PNG, HEIC) or a Word document.";
  if (/exceeded the maximum|too large|payload/i.test(msg)) return "That file is larger than 15 MB.";
  if (/row-level security|only add files/i.test(msg)) return "You can only add files to your own current lease. If that's what you were doing, call the office.";
  return msg;
}
