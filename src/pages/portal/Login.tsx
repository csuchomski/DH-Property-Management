import { withBase } from "../../lib/base";
import { useState, type FormEvent } from "react";
import { BrandMark } from "../../components/Brand";
import { Field, FormMessage } from "../../components/Forms";
import { SITE } from "../../lib/site";
import { supabase } from "../../lib/supabase";

// Supabase limits how many sign-in emails go out per hour (and per address, per minute).
function friendlyError(err: { message: string; status?: number }) {
  if (err.status === 429 || /rate limit|security purposes/i.test(err.message)) {
    return "Too many sign-in emails have been sent in the last little while. Wait a few minutes, then try again.";
  }
  return err.message;
}

// Passwordless sign-in: Supabase emails a one-time link. Using the link proves the
// person controls the address, which is what link_my_account() relies on.
export default function Login() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.href },
    });
    setBusy(false);
    if (error) setError(friendlyError(error));
    else setSent(true);
  }

  return (
    <div className="app login">
      <div className="login-box">
        <a className="brand" href={withBase("/")}>
          <BrandMark />
          {SITE.name}
        </a>
        <h1>Log in</h1>
        {sent ? (
          <>
            <p>
              Check <b>{email}</b> for a sign-in link. It works once and expires in an hour.
            </p>
            <p className="muted">
              Nothing arrived? Check spam, or <button className="link-btn" onClick={() => setSent(false)}>try again</button>.
            </p>
          </>
        ) : (
          <>
            <p>Owners and tenants: use the email address we have on file. We'll send you a sign-in link.</p>
            <form className="form" onSubmit={submit}>
              <Field label="Email">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </Field>
              <FormMessage error={error} />
              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy ? "Sending…" : "Email me a sign-in link"}
              </button>
            </form>
          </>
        )}
        <p className="muted" style={{ marginTop: 20, fontSize: ".85rem" }}>
          Maintenance emergency? Don't wait on email. Call <a href={SITE.phoneHref}>{SITE.phone}</a> and press 1.
        </p>
      </div>
    </div>
  );
}
