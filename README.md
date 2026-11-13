# DH Property Management

Public website and owner, tenant and staff portal for DH Property Management, which manages properties for owners of 1–20 units in Waukesha, Walworth and Milwaukee counties.

The marketing pages (home, owners, tenants, sample owner reports) are ported from the design prototype. The quote form, rental listings, applications and portals are backed by Supabase.

## What's in it

| Area | Who | What it does |
| --- | --- | --- |
| `/`, `/owners`, `/tenants` | Public | Prototype pages. The quote form saves to `quote_requests`. |
| `/rentals` | Public | Lists units a staff member marked **Listed**; the application form saves to `rental_applications`. |
| `/sample-reports` | Public | The prototype's four sample reports, printable. |
| `/portal` (owner) | Owners | Rent roll, occupancy, approving or declining work orders above their threshold, monthly statements, the work order log, and a year-end Schedule E summary with CSV export. |
| `/portal` (tenant) | Tenants | Lease details, payment history, and maintenance requests with their status. |
| `/portal` (staff) | DH staff | Today view, leads, work orders, ledger, leases, units, properties, owners, tenants and sign-in accounts. |

Statements and tax summaries are calculated from the `transactions` ledger. The management fee is the owner's rate × rent and late fees collected, rounded per month. Seeding the demo data reproduces the prototype's August 2026 statement exactly: $9,365.00 collected, $1,005.48 operating, $749.20 fee, $7,610.32 net.

## Stack

- Vite + React 19 + TypeScript, React Router
- Supabase: Postgres with row level security, passwordless email sign-in
- A static build (`dist/`) that runs on any static host. `vercel.json` and `public/_redirects` send every route to `index.html`.

## Deployment

`.github/workflows/deploy-pages.yml` builds the site and publishes it to GitHub Pages on every push to `claude/upbeat-curie-v1kvq0` or `main`: https://csuchomski.github.io/DH-Property-Management/

- It builds with `BASE_PATH=/DH-Property-Management/`, because project pages are served from a sub-path. All internal links go through `withBase()` in `src/lib/base.ts`.
- It copies `index.html` to `404.html` so that links like `/portal` load the app.
- One-time setup: in the repo settings under Pages, set the source to **GitHub Actions**.
- If you move to a custom domain, drop `BASE_PATH` (or set it to `/`).

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL and publishable (anon) key
npm run dev
```

The marketing site runs without `.env.local`. Without it, the forms and portal show a "not connected" message. `npm run build` reads `.env.production`, which points at the DH Property Management Supabase project (`tnohtkfgaaabiddukaoc`). Both values in it are public.

`npm run build` runs the typecheck and produces `dist/`.

## Supabase setup

1. **Apply the schema.** Already done on the DH Property Management project: every file in `supabase/migrations/` is applied there, and each file name starts with the version the live database recorded, so `supabase db push` sees the two as in step. For a new project, run them in order in the SQL editor, or with the CLI: `supabase link --project-ref <ref>` then `supabase db push`. When you change the live database, save the same SQL here under the version it was applied with.
2. **Demo data (optional, never in production).** `supabase/seed.sql` loads the fictional Kettle Ridge portfolio from the sample reports. Its owner is `owner.demo@example.com` and one tenant is `tenant.demo@example.com`. Change those to addresses you control if you want to sign in as them.
3. **Auth settings** (Authentication → URL Configuration): set the Site URL to where the site is hosted, and add `https://<your-domain>/portal/**` (plus `http://localhost:5173/portal/**` for development) to the redirect URLs. The email provider needs to be enabled; the portal uses one-time sign-in links.
4. **Make yourself staff.** Sign in once at `/portal`, then run in the SQL editor:
   ```sql
   update public.profiles set role = 'staff' where email = 'you@example.com';
   ```

### Sign-in email (Gmail SMTP)

Supabase's built-in sender only allows a few emails an hour, so sign-in emails go out through the company Gmail account.

1. In Google, turn on 2-Step Verification, then create an app password at https://myaccount.google.com/apppasswords (name it "Supabase").
2. In Supabase, go to Authentication → Emails → SMTP Settings and turn on custom SMTP:
   - Host `smtp.gmail.com`, port `587`
   - Username and sender email `dhpropertymgmtmke@gmail.com`, sender name `DH Property Management`
   - Password: the 16-character app password
3. Under Authentication → Rate Limits, raise "emails sent per hour" (for example to 30). Gmail allows about 500 a day.
4. Under Authentication → Emails → Templates, set the subject `Your DH Property Management sign-in link` and paste `supabase/templates/magic_link.html` into both the **Magic Link** and **Confirm signup** templates.

### Email alerts

Database triggers queue messages in `email_outbox`. The `send-emails` Edge Function (`supabase/functions/send-emails`) delivers them, and pg_cron wakes it once a minute while anything is waiting. Failed sends retry up to five times. Staff can read the outbox.

| Who | When |
| --- | --- |
| Staff (every staff account, or the list in `app_settings.staff_alert_emails`) | New tenant maintenance request (urgent ones flagged), owner approved or declined a bid, move-out notice or change, tenant upload, quote request, rental application |
| Owner | A bid needs their approval; a tenant gave notice |
| Tenant | Their request was scheduled or completed; lease, addendum or deposit statement posted; walkthrough scheduled; deposit settled |

Sender settings (Supabase → Edge Functions → Secrets):
- **Gmail:** `SMTP_USER` = `dhpropertymgmtmke@gmail.com`, `SMTP_PASS` = the Gmail app password, and `EMAIL_FROM` = `DH Property Management <dhpropertymgmtmke@gmail.com>`. `SMTP_HOST` and `SMTP_PORT` default to `smtp.gmail.com` and `465`.
- **Or an email service:** `RESEND_API_KEY`, which needs a domain verified in Resend, plus `EMAIL_FROM` on that domain. Use this if Supabase blocks the SMTP connection.

### How access works

- Every sign-in creates a `profiles` row with no role, which sees nothing.
- On sign-in the app calls `link_my_account()`. If the user's confirmed email matches an `owners.email` or `tenants.email`, the profile is linked as that owner or tenant. Staff can also link or fix accounts on the **Accounts** screen.
- Owners can read only their own properties, units, leases, tenants, work orders and ledger. Their one write action is approving or declining work orders that are waiting on them, through `decide_work_order()`.
- Tenants can read their own leases, units and receipts, and see their work orders through `my_work_orders()`, which leaves out bids, costs, vendors and owner notes. They can file requests only for units on a current lease, through `submit_maintenance_request()`.
- Anonymous visitors can submit quote requests and applications but can't read them back. They see listings only through `public_listings()`.

These rules were tested against a local Postgres 16 database with a stubbed `auth` schema, then applied to the live project and spot-checked there as the `anon` role.

## Before going live

- **Placeholders.** The phone number and office address in `src/lib/site.ts` come from the prototype and are fake (`555` number). The same number appears in the sample reports.
- **Legal copy.** The prototype flagged that the Wisconsin references (for example the 21-day deposit return, ATCP 134) need checking before use with real clients.
- **Not built yet:**
  - Online rent payment. The tenant page describes autopay, which needs a payment processor such as Stripe or your PM software.
  - Document storage for leases and invoices.
  - Owner ACH distributions.
  - Email notifications, for example to an owner when a bid needs approval or to staff on a new lead.
