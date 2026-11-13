import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && key);

// A sign-in link that was already used or has expired comes back as
// "#error=...&error_description=...". Read it before the client starts, then clear it
// from the address bar so it can't leak into the next sign-in link's return address.
function takeLinkError(): string | null {
  if (typeof window === "undefined") return null;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (!hash.get("error") || hash.get("access_token")) return null;
  history.replaceState(history.state, "", window.location.pathname + window.location.search);
  return hash.get("error_code") === "otp_expired"
    ? "That sign-in link has expired or was already used. Each link works once, within an hour. Request a new one below."
    : hash.get("error_description")?.replace(/\+/g, " ") ?? "That sign-in link didn't work. Request a new one below.";
}
let linkError = takeLinkError();
// Shown once on the login screen, then forgotten.
export function consumeSignInLinkError() {
  const e = linkError;
  linkError = null;
  return e;
}

// When the env vars are missing the marketing site still works; forms and the
// portal show a "not connected" message instead of failing.
export const supabase: SupabaseClient = createClient(
  url ?? "http://localhost:54321",
  key ?? "missing-anon-key",
  { auth: { persistSession: supabaseConfigured, autoRefreshToken: supabaseConfigured } },
);
