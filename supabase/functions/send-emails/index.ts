// Delivers queued alert emails from public.email_outbox.
//
// pg_cron calls this once a minute while something is waiting (public.kick_email_sender).
// It claims up to 20 messages, sends each, and records the result; failures are retried
// with growing gaps, up to 5 tries. Calling it at any other time only sends what is
// already queued, so it runs without a JWT check.
//
// Sending, set in Edge Function secrets:
//   RESEND_API_KEY                       send through Resend's HTTPS API (needs a verified domain), or
//   SMTP_USER + SMTP_PASS                send through Gmail (an app password), with optional
//   SMTP_HOST (smtp.gmail.com), SMTP_PORT (465)
//   EMAIL_FROM                           e.g. DH Property Management <dhpropertymgmtmke@gmail.com>
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

interface Outbox {
  id: number;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string;
}

const env = (k: string) => Deno.env.get(k) ?? "";
const FROM = env("EMAIL_FROM") || `DH Property Management <${env("SMTP_USER")}>`;

async function sendResend(m: Outbox) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [m.to_email], subject: m.subject, text: m.body_text, html: m.body_html }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

function smtpTransport() {
  const port = Number(env("SMTP_PORT") || 465);
  return nodemailer.createTransport({
    host: env("SMTP_HOST") || "smtp.gmail.com",
    port,
    secure: port === 465, // 465: TLS from the start; 587: upgrades with STARTTLS
    auth: { user: env("SMTP_USER"), pass: env("SMTP_PASS") },
    connectionTimeout: 15000,
  });
}

Deno.serve(async () => {
  const useResend = !!env("RESEND_API_KEY");
  if (!useResend && !(env("SMTP_USER") && env("SMTP_PASS"))) {
    return Response.json({ error: "No sender configured: set RESEND_API_KEY, or SMTP_USER and SMTP_PASS." }, { status: 500 });
  }

  const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data, error } = await db.rpc("claim_emails", { p_limit: 20 });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const batch = (data ?? []) as Outbox[];
  if (!batch.length) return Response.json({ sent: 0, failed: 0 });

  let sent = 0;
  let failed = 0;
  let smtp: ReturnType<typeof smtpTransport> | null = null;
  try {
    for (const m of batch) {
      try {
        if (useResend) {
          await sendResend(m);
        } else {
          smtp ??= smtpTransport();
          await smtp.sendMail({ from: FROM, to: m.to_email, subject: m.subject, text: m.body_text, html: m.body_html });
        }
        await db.rpc("mark_email_result", { p_id: m.id, p_ok: true });
        sent++;
      } catch (e) {
        await db.rpc("mark_email_result", { p_id: m.id, p_ok: false, p_error: String((e as Error)?.message ?? e) });
        failed++;
      }
    }
  } finally {
    smtp?.close();
  }
  return Response.json({ sent, failed });
});
