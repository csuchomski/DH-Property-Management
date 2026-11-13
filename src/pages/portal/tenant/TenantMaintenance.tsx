import { useState, type FormEvent } from "react";
import { PhotoStrip } from "../../../components/Documents";
import { Field, FormMessage } from "../../../components/Forms";
import { Loading, PriorityTag, WorkOrderTag } from "../../../components/Status";
import { PHOTO_ACCEPT, checkFile, tenantUpload, type DocumentRow } from "../../../lib/documents";
import { shortDate } from "../../../lib/format";
import { SITE } from "../../../lib/site";
import { supabase } from "../../../lib/supabase";
import { useQuery } from "../../../lib/useQuery";
import { leasePlace, loadMyLeases, type MyWorkOrder } from "./tenantData";
import {
  CATEGORIES, answerTrail, categoryById, emergencyStop, selfHelp, visibleQuestions,
  type Answers,
} from "./triage";

const STEPS = ["Problem", "Checks", "Details", "Access"];

interface Sent {
  number: string | null;
  sla: string;
  photoNote: string | null;
}

const MAX_PHOTOS = 6;

export default function TenantMaintenance() {
  const leases = useQuery(loadMyLeases, []);
  const requests = useQuery<MyWorkOrder[]>(async () => await supabase.rpc("my_work_orders"), []);
  const photos = useQuery<DocumentRow[]>(
    async () => await supabase.from("documents").select("*").eq("kind", "maintenance_photo").order("created_at"),
    [],
  );
  const current = leases.data?.filter((l) => l.status !== "ended" && l.units) ?? [];

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [unitId, setUnitId] = useState("");
  const [description, setDescription] = useState("");
  const [title, setTitle] = useState("");
  const [availability, setAvailability] = useState("");
  const [pet, setPet] = useState("");
  const [entry, setEntry] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<Sent | null>(null);
  const [closedOut, setClosedOut] = useState(false);

  const cat = categoryById(answers.cat);
  const questions = visibleQuestions(answers);
  const stop = emergencyStop(answers);
  const help = selfHelp(answers);

  function reset() {
    setStep(0);
    setAnswers({});
    setDescription("");
    setTitle("");
    setAvailability("");
    setPet("");
    setEntry(false);
    setFiles([]);
    setError(null);
    setSent(null);
    setClosedOut(false);
  }

  function pickCategory(id: string) {
    setAnswers({ cat: id });
    setError(null);
    setStep(1);
  }

  function answer(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  function next() {
    setError(null);
    if (step === 1) {
      const unanswered = questions.find((q) => !answers[q.id]);
      if (unanswered) {
        setError("Answer all the checks — they decide how fast someone comes.");
        return;
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (title.trim().length < 3) {
        setError("A few words on what's wrong, so we know what to send.");
        return;
      }
      const bad = files.map(checkFile).find(Boolean);
      if (bad) {
        setError(bad);
        return;
      }
      setStep(3);
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!unitId && current.length === 1) setUnitId(current[0].units!.id);
    const unit = unitId || current[0]?.units?.id;
    if (!unit) {
      setError("Pick which unit this is for.");
      return;
    }
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("submit_maintenance_request", {
      p_unit_id: unit,
      p_title: title.trim(),
      p_description: description.trim(),
      p_category: cat?.category ?? "General",
      p_entry_permission: entry,
      p_pet_on_site: pet.trim() || null,
      p_availability: availability.trim() || null,
      p_answers: answers,
      p_trail: answerTrail(answers),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    const wo = data as { id: string; number: string | null; rule_id: string | null };
    // Photos go up after the request exists, attached to it. A failed photo never loses the request.
    let photoNote: string | null = null;
    if (files.length) {
      let failed = 0;
      for (const [i, f] of files.entries()) {
        try {
          await tenantUpload({ workOrderId: wo.id }, f, { kind: "maintenance_photo", title: `Photo ${i + 1}` });
        } catch {
          failed++;
        }
      }
      photoNote = failed
        ? `${files.length - failed} of ${files.length} photos attached. Text the others to ${SITE.phone}.`
        : `${files.length} photo${files.length === 1 ? "" : "s"} attached.`;
      photos.reload();
    }
    // The promise shown to the tenant comes from the same rule that set the priority.
    const { data: decided } = await supabase.rpc("triage_decision", { p_answers: answers });
    const sla = Array.isArray(decided) && decided[0]?.sla ? (decided[0].sla as string) : "We'll be in touch with a window.";
    setSent({ number: wo.number, sla, photoNote });
    requests.reload();
  }

  const noLease = !!leases.data && current.length === 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Report maintenance</h1>
          <p className="sub">A few questions, then we know how fast to come. Under a minute.</p>
        </div>
      </div>

      <div className="callout" style={{ marginTop: 0 }}>
        <h3>Emergency? Don't use this form.</h3>
        <p>
          Call <a href={SITE.phoneHref}>{SITE.phone}</a> and press 1, any hour. Fire, gas smell, or an active electrical
          hazard: call 911 first. Emergencies include no heat in winter, no water, no working toilet in a one-bath unit,
          active flooding, a sewage backup, or a door or window that no longer locks.
        </p>
      </div>

      <div className="card">
        <Loading error={leases.error} loading={leases.loading && !leases.data} />
        {noLease && <p className="notice">We couldn't find a current lease for your account. Call {SITE.phone}.</p>}

        {!noLease && !!leases.data && (
          <>
            {sent ? (
              <div className="triage-done">
                <h2>Sent{sent.number ? ` — ${sent.number}` : ""}</h2>
                <p>{sent.sla}</p>
                {sent.photoNote && <p className="muted">{sent.photoNote}</p>}
                <p className="muted">
                  You'll get a text when a technician is scheduled. Reply to this request from the list below if anything
                  changes.
                </p>
                <button className="btn" type="button" onClick={reset}>Report something else</button>
              </div>
            ) : closedOut ? (
              <div className="triage-done">
                <h2>Closed out</h2>
                <p>Nothing was dispatched and nothing is billed. We logged it to your unit in case it happens again.</p>
                <button className="btn" type="button" onClick={reset}>Report something else</button>
              </div>
            ) : (
              <>
                <ol className="triage-steps">
                  {STEPS.map((label, i) => (
                    <li key={label} className={i === step ? "on" : i < step ? "done" : ""}>
                      <span>{label}</span>
                    </li>
                  ))}
                </ol>

                {step === 0 && (
                  <>
                    <h2>What's the problem?</h2>
                    <p className="muted">Pick the closest one. You can explain in your own words in a moment.</p>
                    <div className="triage-pick">
                      {CATEGORIES.map((c) => (
                        <button key={c.id} type="button" className="pick" onClick={() => pickCategory(c.id)}>
                          {c.label}
                          <small>{c.hint}</small>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <h2>A few quick checks</h2>
                    <p className="muted">These decide how fast someone comes, and they often solve it outright.</p>

                    {stop && (
                      <div className="callout" role="alert">
                        <h3>{stop.heading}</h3>
                        <p>{stop.body}</p>
                        <p style={{ marginTop: 10 }}>
                          <a className="btn btn-primary" href={SITE.phoneHref}>Call {SITE.phone}</a>
                        </p>
                      </div>
                    )}

                    {!stop && help && (
                      <div className="triage-help">
                        <h3>{help.heading}</h3>
                        <p>{help.body}</p>
                        {help.resolved && (
                          <button className="btn btn-pine btn-xs" type="button" onClick={() => setClosedOut(true)}>
                            That fixed it — close this
                          </button>
                        )}
                      </div>
                    )}

                    {questions.length === 0 && (
                      <p className="muted">Nothing to check for this one — carry on and tell us what's going on.</p>
                    )}

                    {questions.map((q) => (
                      <fieldset key={q.id} className="triage-q">
                        <legend>{q.q}</legend>
                        <div className="triage-opts">
                          {q.options.map(([value, label]) => (
                            <label key={value} className="opt">
                              <input
                                type="radio"
                                name={q.id}
                                value={value}
                                checked={answers[q.id] === value}
                                onChange={() => answer(q.id, value)}
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ))}
                  </>
                )}

                {step === 2 && (
                  <>
                    <h2>Tell us what's going on</h2>
                    <Field label="What's wrong, in a few words">
                      <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={200}
                        placeholder="e.g. Kitchen faucet drips"
                      />
                    </Field>
                    <Field label="Details" hint="For an appliance, include the brand and model from the model plate.">
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        maxLength={3000}
                        rows={4}
                        placeholder="What you noticed, when it started, anything you already tried."
                      />
                    </Field>
                    <Field label="Photos (optional)" hint={`Up to ${MAX_PHOTOS}. One of the problem, and one of the model plate if it's an appliance.`}>
                      <input
                        type="file"
                        accept={PHOTO_ACCEPT}
                        multiple
                        onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS))}
                      />
                    </Field>
                    {files.length > 0 && (
                      <p className="muted" style={{ fontSize: ".85rem" }}>
                        {files.length} photo{files.length === 1 ? "" : "s"} ready: {files.map((f) => f.name).join(", ")}
                      </p>
                    )}
                  </>
                )}

                {step === 3 && (
                  <form className="form" onSubmit={submit}>
                    <h2>Getting in</h2>
                    <p className="muted">You always get notice before anyone enters.</p>
                    {current.length > 1 && (
                      <Field label="Unit">
                        <select value={unitId} onChange={(e) => setUnitId(e.target.value)} required>
                          <option value="">Choose…</option>
                          {current.map((l) => (
                            <option key={l.id} value={l.units!.id}>{leasePlace(l)}</option>
                          ))}
                        </select>
                      </Field>
                    )}
                    <div className="row">
                      <Field label="When is someone usually around?">
                        <input
                          value={availability}
                          onChange={(e) => setAvailability(e.target.value)}
                          maxLength={500}
                          placeholder="e.g. Tue after 3pm, Thu morning"
                        />
                      </Field>
                      <Field label="Pets we should know about before entry">
                        <input value={pet} onChange={(e) => setPet(e.target.value)} maxLength={500} />
                      </Field>
                    </div>
                    <label className="check">
                      <input type="checkbox" checked={entry} onChange={(e) => setEntry(e.target.checked)} />
                      <span>You may use a key to enter if I'm not home. We still give notice before anyone enters.</span>
                    </label>
                    <FormMessage error={error} />
                    <div className="triage-nav">
                      <button className="btn" type="button" onClick={() => setStep(2)}>Back</button>
                      <button className="btn btn-primary" type="submit" disabled={busy}>
                        {busy ? "Sending…" : "Send request"}
                      </button>
                    </div>
                  </form>
                )}

                {step > 0 && step < 3 && (
                  <>
                    <FormMessage error={error} />
                    <div className="triage-nav">
                      <button className="btn" type="button" onClick={() => setStep(step - 1)}>Back</button>
                      <button className="btn btn-primary" type="button" onClick={next}>Continue</button>
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="card">
        <h2>Your requests</h2>
        <Loading error={requests.error} />
        {requests.data?.length === 0 && <p className="muted">No requests yet.</p>}
        {!!requests.data?.length && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Opened</th>
                  <th>Request</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.data.map((w) => (
                  <tr key={w.id}>
                    <td>{w.number}</td>
                    <td>{shortDate(w.opened_on)}</td>
                    <td>
                      <b>{w.title}</b>
                      <div className="muted" style={{ fontSize: ".85rem" }}>{w.category}</div>
                      <PhotoStrip docs={(photos.data ?? []).filter((p) => p.work_order_id === w.id)} />
                    </td>
                    <td>
                      <WorkOrderTag status={w.status} closedOn={w.closed_on ? shortDate(w.closed_on) : null} />{" "}
                      <PriorityTag priority={w.priority} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
