import { useState, type FormEvent, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { useQuery } from "../lib/useQuery";
import { Field, FormMessage } from "./Forms";
import { Loading } from "./Status";

export interface Option {
  value: string;
  label: string;
}

type Row = Record<string, unknown> & { id: string };

export interface Column {
  key: string;
  label: string;
  formLabel?: string; // label in the edit form, when the list column shows something broader
  type?: "text" | "number" | "money" | "date" | "bool" | "textarea" | "select";
  options?: Option[];
  required?: boolean;
  hint?: string;
  placeholder?: string;
  step?: string;
  default?: string | number | boolean;
  list?: boolean; // show in the table (default true)
  form?: boolean; // show in the form (default true)
  render?: (row: Row) => ReactNode;
}

interface Props {
  table: string;
  title: string;
  intro?: ReactNode;
  select?: string;
  order: { column: string; ascending?: boolean }[];
  columns: Column[];
  eq?: Record<string, string | number | boolean>; // simple equality filters
  range?: { column: string; from: string; to: string }; // from <= column < to
  notIn?: { column: string; values: string[] };
  deps?: unknown[];
  canCreate?: boolean;
  canDelete?: boolean;
  createLabel?: string;
  onSaved?: () => void;
  // Adjust values before saving (e.g. derive property from unit). Throw to show an error.
  transform?: (values: Record<string, unknown>) => Record<string, unknown>;
}

// Values from the form, typed for Postgres. Blank optional fields become null.
function toDb(col: Column, raw: FormDataEntryValue | null): unknown {
  if (col.type === "bool") return raw === "on";
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "") return null;
  if (col.type === "number" || col.type === "money") return Number(s);
  return s;
}

function display(col: Column, row: Row): ReactNode {
  if (col.render) return col.render(row);
  const v = row[col.key];
  if (v === null || v === undefined || v === "") return <span className="muted">—</span>;
  if (col.type === "bool") return v ? "Yes" : "No";
  if (col.type === "money") return Number(v).toLocaleString("en-US", { style: "currency", currency: "USD" });
  if (col.options) return col.options.find((o) => o.value === v)?.label ?? String(v);
  return String(v);
}

export default function ResourceTable(props: Props) {
  const { table, title, intro, select = "*", order, columns, eq, deps = [], canCreate = true, canDelete = true } = props;
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const rows = useQuery<Row[]>(async () => {
    let q = supabase.from(table).select(select);
    for (const [k, v] of Object.entries(eq ?? {})) q = q.eq(k, v);
    if (props.range) q = q.gte(props.range.column, props.range.from).lt(props.range.column, props.range.to);
    if (props.notIn) q = q.not(props.notIn.column, "in", `(${props.notIn.values.join(",")})`);
    for (const o of order) q = q.order(o.column, { ascending: o.ascending ?? true });
    const res = await q.limit(1000);
    return { data: res.data as unknown as Row[] | null, error: res.error };
  }, [table, select, JSON.stringify([eq, props.range, props.notIn]), ...deps]);

  const listCols = columns.filter((c) => c.list !== false);
  const formCols = columns.filter((c) => c.form !== false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const values: Record<string, unknown> = {};
    for (const c of formCols) values[c.key] = toDb(c, fd.get(c.key));
    setError(null);
    let payload = values;
    try {
      if (props.transform) payload = props.transform(values);
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    setBusy(true);
    const res =
      editing === "new"
        ? await supabase.from(table).insert(payload)
        : await supabase.from(table).update(payload).eq("id", (editing as Row).id);
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setOk(editing === "new" ? "Added." : "Saved.");
    setEditing(null);
    rows.reload();
    props.onSaved?.();
  }

  async function remove(row: Row) {
    if (!window.confirm("Delete this record? This can't be undone.")) return;
    const { error } = await supabase.from(table).delete().eq("id", row.id);
    if (error) setError(error.message);
    else {
      setOk("Deleted.");
      rows.reload();
      props.onSaved?.();
    }
  }

  const current = editing && editing !== "new" ? editing : null;

  return (
    <div className="card">
      <div className="card-head">
        <h2>{title}</h2>
        {canCreate && !editing && (
          <button
            className="btn btn-primary btn-xs"
            onClick={() => {
              setOk(null);
              setError(null);
              setEditing("new");
            }}
          >
            {props.createLabel ?? "Add"}
          </button>
        )}
      </div>
      {intro}
      {!editing && <FormMessage ok={ok} error={error} />}

      {editing && (
        <form className="form" onSubmit={save} key={current?.id ?? "new"} style={{ marginBottom: 18 }}>
          <h3>{editing === "new" ? `New ${title.toLowerCase().replace(/s$/, "")}` : "Edit"}</h3>
          <div className="row">
            {formCols
              .filter((c) => c.type !== "textarea" && c.type !== "bool")
              .map((c) => {
                const v = current ? current[c.key] : c.default;
                const dv = v === null || v === undefined ? "" : String(v);
                return (
                  <Field key={c.key} label={(c.formLabel ?? c.label) + (c.required ? "" : " (optional)")} hint={c.hint}>
                    {c.options ? (
                      <select name={c.key} defaultValue={dv} required={c.required}>
                        {!c.required && <option value="">—</option>}
                        {c.required && dv === "" && <option value="">Choose…</option>}
                        {c.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        name={c.key}
                        defaultValue={dv}
                        required={c.required}
                        placeholder={c.placeholder}
                        type={c.type === "number" || c.type === "money" ? "number" : c.type === "date" ? "date" : "text"}
                        step={c.step ?? (c.type === "money" ? "0.01" : c.type === "number" ? "any" : undefined)}
                      />
                    )}
                  </Field>
                );
              })}
          </div>
          {formCols
            .filter((c) => c.type === "textarea")
            .map((c) => (
              <Field key={c.key} label={(c.formLabel ?? c.label) + (c.required ? "" : " (optional)")} hint={c.hint}>
                <textarea name={c.key} defaultValue={current ? String(current[c.key] ?? "") : ""} required={c.required} />
              </Field>
            ))}
          {formCols
            .filter((c) => c.type === "bool")
            .map((c) => (
              <label className="check" key={c.key}>
                <input type="checkbox" name={c.key} defaultChecked={Boolean(current ? current[c.key] : c.default)} />
                <span>{c.formLabel ?? c.label}</span>
              </label>
            ))}
          <FormMessage error={error} />
          <div className="btn-row">
            <button className="btn btn-primary btn-sm" type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => setEditing(null)}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <Loading error={rows.error} loading={rows.loading && !rows.data} />
      {rows.data?.length === 0 && <p className="muted">Nothing here yet.</p>}
      {!!rows.data?.length && (
        <div className="tbl-wrap">
          <table className="tbl rt">
            <thead>
              <tr>
                {listCols.map((c) => (
                  <th key={c.key} className={c.type === "money" || c.type === "number" ? "n" : undefined}>
                    {c.label}
                  </th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.data.map((r) => (
                <tr key={r.id} className={current?.id === r.id ? "editing" : undefined}>
                  {listCols.map((c) => (
                    <td key={c.key} data-label={c.label} className={c.type === "money" || c.type === "number" ? "n" : undefined}>
                      <div className="cell">{display(c, r)}</div>
                    </td>
                  ))}
                  <td className="actions">
                    <button
                      className="link-btn"
                      onClick={() => {
                        setOk(null);
                        setError(null);
                        setEditing(r);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Edit
                    </button>
                    {canDelete && (
                      <>
                        {" · "}
                        <button className="link-btn" style={{ color: "var(--clay)" }} onClick={() => void remove(r)}>
                          Delete
                        </button>
                      </>
                    )}
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
