import { withBase } from "../../lib/base";
import QuoteForm from "../../components/QuoteForm";
import { usePageTitle } from "../../lib/usePageTitle";

export default function Owners() {
  usePageTitle("Owners");
  return (
    <>
      {/* HERO */}
      <div className="hero hero-sm" id="top">
        <div className="wrap">
          <div style={{ maxWidth: "62ch" }}>
            <span className="kicker">For owners</span>
            <h1 style={{ fontSize: "clamp(2.1rem,5.2vw,3.3rem)" }}>What it's actually like to hand us the keys</h1>
            <p className="lede">The month-to-month rhythm, what you approve, what you never hear about, and what switching managers mid-lease really involves.</p>
            <div className="btn-row">
              <a className="btn btn-primary" href="#quote">Get a quote</a>
              <a className="btn btn-ghost-dark" href="#portal">See the owner portal</a>
              <a className="btn btn-ghost-dark" href={withBase("/portal")}>Owner log in</a>
            </div>
          </div>
        </div>
      </div>

      {/* MONTH IN THE LIFE */}
      <section>
        <div className="wrap">
          <span className="kicker">A month on the calendar</span>
          <h2>Four dates you can count on</h2>
          <div className="step-grid four" style={{ marginTop: "38px" }}>
            <div className="step">
              <span className="n">1st</span>
              <h3>Rent comes in</h3>
              <p>Tenants pay through Zillow, free by bank transfer, into our client trust account. Anything unpaid gets a reminder the next morning, not a week later.</p>
            </div>
            <div className="step">
              <span className="n">5th</span>
              <h3>Notices go out</h3>
              <p>Late fees apply per the lease and any required notice is served properly and documented the same day.</p>
            </div>
            <div className="step">
              <span className="n">10th</span>
              <h3>Money moves</h3>
              <p>Your balance, less the month's bills, our fee and your reserve, goes to your account by ACH. No holding your rent for a float period.</p>
            </div>
            <div className="step">
              <span className="n">12th</span>
              <h3>Statement posts</h3>
              <p>Every dollar in and out, per unit, with the vendor invoices attached as PDFs.</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT'S INCLUDED */}
      <section style={{ background: "var(--paper-2)" }} id="included">
        <div className="wrap">
          <span className="kicker">Scope</span>
          <h2>Where full management ends and leasing-only begins</h2>
          <div className="cmp">
            <table>
              <thead>
                <tr><th>Included</th><th>Full management</th><th>Leasing only</th></tr>
              </thead>
              <tbody>
                <tr><td>Rent survey and pricing the vacancy</td><td className="yes">Yes</td><td className="yes">Yes</td></tr>
                <tr><td>Photos, listing, syndication, showings</td><td className="yes">Yes</td><td className="yes">Yes</td></tr>
                <tr><td>Credit, income, eviction, landlord screening</td><td className="yes">Yes</td><td className="yes">Yes</td></tr>
                <tr><td>Wisconsin lease, addenda, check-in report</td><td className="yes">Yes</td><td className="yes">Yes</td></tr>
                <tr><td>Rent collection, late fees, notices</td><td className="yes">Yes</td><td className="no">You handle it</td></tr>
                <tr><td>24/7 maintenance line and dispatch</td><td className="yes">Yes</td><td className="no">You handle it</td></tr>
                <tr><td>Security deposit held in trust</td><td className="yes">Yes</td><td className="no">Handed to you at signing</td></tr>
                <tr><td>Move-out inspection and deposit itemization</td><td className="yes">Yes</td><td className="no">You handle it</td></tr>
                <tr><td>Nonpayment filing and eviction coordination</td><td className="yes">Yes</td><td className="no">You handle it</td></tr>
                <tr><td>Monthly statement and year-end tax packet</td><td className="yes">Yes</td><td className="no">Not applicable</td></tr>
                <tr><td>Renewals and rent-increase timing</td><td className="yes">Yes</td><td className="no">You handle it</td></tr>
              </tbody>
            </table>
          </div>
          <p style={{ marginTop: "18px", fontSize: ".92rem" }}>Not included in either: capital projects, full turnovers and rehab, insurance claims management, and evictions past the filing. We'll quote those separately or hand you a bid from a trade you can hire directly.</p>
        </div>
      </section>

      {/* APPROVALS AND MAINTENANCE */}
      <section>
        <div className="wrap">
          <span className="kicker">Maintenance and money</span>
          <h2>You set the line. We stay on our side of it.</h2>
          <div className="two-up">
            <div className="block" style={{ marginTop: "0" }}>
              <h3>How approvals work</h3>
              <ul>
                <li>Pick a per-incident threshold at onboarding &mdash; most owners land between $250 and $500</li>
                <li>Under it, we dispatch and it shows on your statement</li>
                <li>Over it, you get photos, a written bid, and a yes/no</li>
                <li>Health-and-safety emergencies get handled first and reported immediately, threshold or not</li>
                <li>Repairs draw from a reserve you fund once; we never advance our own money and never bill interest</li>
                <li>If a bill is bigger than your balance, we ask you to top it up first. Another owner's money never covers your bills, and yours never covers theirs</li>
              </ul>
            </div>
            <div className="block" style={{ marginTop: "0" }}>
              <h3>How we handle vendors</h3>
              <ul>
                <li>Your trades go on the dispatch list first if you have them</li>
                <li>Every vendor carries a license where the trade requires it, plus liability insurance on file</li>
                <li>Invoices pass through at cost &mdash; no markup, no coordination fee, no trip charge from us</li>
                <li>Anything over $1,500 goes out for a second bid unless you tell us not to bother</li>
                <li>1099s for your vendors go out in January if we paid them on your behalf</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST */}
      <section id="trust" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <span className="kicker">Where your money sits</span>
          <h2>In trust, on your own ledger, reconciled every month</h2>
          <p className="lede" style={{ marginTop: "16px" }}>
            Rent is your money from the moment a tenant pays it. We hold it the way the rules for client funds expect,
            and you can see your balance any day.
          </p>
          <div className="two-up">
            <div className="block" style={{ marginTop: "0" }}>
              <h3>How it's held</h3>
              <ul>
                <li>Rent goes into a client trust account, kept apart from DH's own operating account</li>
                <li>Security deposits sit in a second, separate trust account and are never used for bills</li>
                <li>Every owner has their own ledger inside the trust account, broken down by property</li>
                <li>Bills are paid only from your balance. If it can't cover one, you hear from us before anything is paid</li>
                <li>Our fee moves out of trust only when your payout does, and it's shown as its own line</li>
              </ul>
            </div>
            <div className="block" style={{ marginTop: "0" }}>
              <h3>How it's checked</h3>
              <ul>
                <li>Every month we reconcile three numbers: the bank statement, our books, and the total of every owner's ledger</li>
                <li>The three have to match to the penny, and the signed reconciliation is kept on file</li>
                <li>Your statement shows what came in, what went out, your payout, and your balance at month end</li>
                <li>The owner portal shows your current trust balance and reserve, not just last month's</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* REPORTING */}
      <section id="portal" style={{ background: "var(--ink)", color: "#AFBECE" }}>
        <div className="wrap">
          <span className="kicker" style={{ color: "var(--amber)" }}>Owner portal</span>
          <h2 style={{ color: "var(--paper)" }}>Every building on one screen, current as of this morning</h2>
          <div className="portal-grid">
            <div className="screen" style={{ background: "var(--ink-soft)" }} aria-label="Sample owner portal screen">
              <div className="screen-bar"><i></i><i></i><i></i></div>
              <p className="screen-title">Rent roll &mdash; September 2026</p>
              <div className="unit"><div><b>1042 Tallmadge St &mdash; A</b><span>$1,350 &middot; lease ends 6/30/27</span></div><span className="pill paid">Paid</span></div>
              <div className="unit"><div><b>1042 Tallmadge St &mdash; B</b><span>$1,425 &middot; lease ends 8/31/27</span></div><span className="pill paid">Paid</span></div>
              <div className="unit"><div><b>318 Brinkman Ave</b><span>$1,795 &middot; notice given 9/1</span></div><span className="pill due">Due 9/5</span></div>
              <div className="unit"><div><b>7 Foundry Ct &mdash; 2</b><span>Furnace inducer motor &middot; bid $410</span></div><span className="pill work">Needs OK</span></div>
              <div className="unit"><div><b>7 Foundry Ct &mdash; 3</b><span>Vacant &middot; listed 9/8, 6 showings</span></div><span className="pill work">Leasing</span></div>
            </div>
            <div className="portal-list">
              <div>
                <h3>Your trust balance, any day</h3>
                <p>What we're holding for you right now, your reserve, and every payout, without waiting for the statement.</p>
              </div>
              <div>
                <h3>A written read every month</h3>
                <p>Plain-English commentary on each property with the statement: what moved, what's off-pattern, and what's coming up.</p>
              </div>
              <div>
                <h3>Approve the spend, not the small stuff</h3>
                <p>Bids, photos, and a yes/no button on anything above your threshold. Everything below it just appears on the statement.</p>
              </div>
              <div>
                <h3>Documents where you'll find them</h3>
                <p>Leases, addenda, inspection photos, insurance certificates, and every vendor invoice, filed by unit.</p>
              </div>
              <div>
                <h3>Tax-season exports</h3>
                <p>Income and expense by property, mapped to Schedule E lines, plus the 1099 packet for your CPA in January.</p>
              </div>
              <div>
                <h3>Statements going back to day one</h3>
                <p>Download any month as PDF or CSV. If you leave, the whole history leaves with you.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SWITCHING */}
      <section id="switching" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <span className="kicker">Switching managers</span>
          <h2>Mid-lease is fine. Here's the actual sequence.</h2>
          <p className="lede" style={{ marginTop: "16px" }}>Owners put this off for a year because they assume it means breaking leases. It doesn't. The lease follows the property, not the manager.</p>
          <div className="step-grid four" style={{ marginTop: "38px" }}>
            <div className="step">
              <span className="n">Step 1</span>
              <h3>Read your agreement</h3>
              <p>Find the notice period and any termination fee. Send us the document and we'll tell you the date you can move without paying for it.</p>
            </div>
            <div className="step">
              <span className="n">Step 2</span>
              <h3>Send the notice</h3>
              <p>We'll give you the letter to sign. It requests leases, deposit balances, ledgers, keys, and tenant contact records on a specific date.</p>
            </div>
            <div className="step">
              <span className="n">Step 3</span>
              <h3>Transfer deposits</h3>
              <p>Deposit balances move into our trust account and get reconciled against each lease. Gaps get documented in writing before we take over.</p>
            </div>
            <div className="step">
              <span className="n">Step 4</span>
              <h3>Tell the tenants once</h3>
              <p>One letter, one new place to pay, one number for maintenance. Their lease terms, rent, and deposit don't change.</p>
            </div>
          </div>
          <div className="callout">
            <h3>The one thing to check first</h3>
            <p>Look for an automatic renewal clause and an exclusive leasing commission that survives termination. Those two lines are where owners get stuck. Send us the agreement before you sign anything with us and we'll read it for free.</p>
          </div>
        </div>
      </section>

      {/* WHAT WE NEED */}
      <section>
        <div className="wrap narrow">
          <span className="kicker">Onboarding checklist</span>
          <h2>What we'll ask you for</h2>
          <div className="block">
            <h3>Per property</h3>
            <ul>
              <li>Address, unit count, and year built</li>
              <li>Current leases and any addenda</li>
              <li>Rent roll with deposit amounts held</li>
              <li>Insurance declaration page, with us added as additional interest</li>
              <li>Mortgage and tax escrow contacts, if we'll be paying anything on your behalf</li>
              <li>Appliance and mechanical ages, plus any warranties still live</li>
              <li>Keys, fobs, garage remotes, and mailbox keys</li>
            </ul>
          </div>
          <div className="block">
            <h3>Per owner</h3>
            <ul>
              <li>W-9 for the entity that holds title</li>
              <li>ACH details for deposits</li>
              <li>Your maintenance approval threshold</li>
              <li>Vendors you want kept on the dispatch list</li>
              <li>How you want to be reached, and how fast</li>
            </ul>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ background: "var(--paper-2)" }}>
        <div className="wrap narrow">
          <h2>Owner questions</h2>
          <details>
            <summary>Do I need to carry different insurance?</summary>
            <p>You'll need a landlord policy with liability, and we ask to be named as an additional interest so we get notice if it lapses. We also require tenants to carry renters insurance and we verify it at move-in.</p>
          </details>
          <details>
            <summary>Who signs the lease &mdash; you or me?</summary>
            <p>We sign as your agent, with your entity named as owner. You see every executed lease in the portal the day it's signed.</p>
          </details>
          <details>
            <summary>Can I still use the unit for family, or sell mid-lease?</summary>
            <p>Yes to both. A sale doesn't break the lease; the buyer takes the property subject to it. Give us notice and we'll coordinate showings around tenant rights and hand the file to the buyer's manager.</p>
          </details>
          <details>
            <summary>What if I want to approve every tenant myself?</summary>
            <p>Some owners do. We'll send you the screening file with our recommendation and you make the call. Screening criteria stay fixed and applied to everyone equally &mdash; that part isn't negotiable, for fair-housing reasons.</p>
          </details>
          <details>
            <summary>Do you manage properties you or your partners own?</summary>
            <p>Yes, and we'll tell you which ones. Our units never get priority on showings, dispatch, or listing spend, and we'll put that in the agreement.</p>
          </details>
          <details>
            <summary>What does a turnover usually run?</summary>
            <p>Paint, clean, carpet, and small repairs on a two-bedroom in this market typically lands in the high hundreds to low thousands, depending on how the last tenant left it. You get the bid before anything starts.</p>
          </details>
        </div>
      </section>

      {/* CLOSING */}
      <section className="close" id="quote">
        <div className="wrap">
          <span className="kicker">Get a quote</span>
          <h2>Send the addresses and the rent roll. We'll send back a number.</h2>
          <p>Fifteen minutes on the phone, a walkthrough of the units, and a written quote with the punch list included &mdash; whether or not you sign.</p>
          <QuoteForm />
        </div>
      </section>
    </>
  );
}
