import { withBase } from "../../lib/base";
import { SITE } from "../../lib/site";
import { usePageTitle } from "../../lib/usePageTitle";

export default function Tenants() {
  usePageTitle("Tenants");
  return (
    <>
      {/* HERO */}
      <div className="hero hero-sm" id="top">
        <div className="wrap">
          <div style={{ maxWidth: "62ch" }}>
            <span className="kicker">For tenants</span>
            <h1 style={{ fontSize: "clamp(2.1rem,5.2vw,3.3rem)" }}>Pay rent, report a problem, get an answer</h1>
            <p className="lede">Everything you need is on this page. If it isn't here, call and a person picks up.</p>
            <div className="btn-row">
              <a className="btn btn-primary" href={withBase("/portal")}>Tenant log in</a>
              <a className="btn btn-ghost-dark" href="#pay">How to pay rent</a>
              <a className="btn btn-ghost-dark" href={withBase("/portal/maintenance")}>Report maintenance</a>
            </div>
          </div>
        </div>
      </div>

      {/* PAY RENT */}
      <section id="pay">
        <div className="wrap">
          <span className="kicker">Paying rent</span>
          <h2>Pay online through Zillow, free from your bank</h2>
          <p className="lede" style={{ marginTop: "14px" }}>
            We collect rent through Zillow Rental Manager. When your lease starts you'll get an email invitation from
            Zillow to set up payments; after that, you pay at zillow.com or in the Zillow app.
          </p>
          <div className="pay-grid">
            <div className="pay">
              <h3>Autopay from your bank</h3>
              <p>Link your bank account once and turn on autopay. Rent goes out on schedule and Zillow emails you a receipt.</p>
              <p className="meta">No fee &middot; recommended</p>
            </div>
            <div className="pay">
              <h3>One-time payment</h3>
              <p>Pay any amount, any time. A bank transfer is free. Zillow also takes cards, but charges a fee for them.</p>
              <p className="meta">Bank: no fee &middot; cards: Zillow's fee</p>
            </div>
            <div className="pay">
              <h3>Check or money order</h3>
              <p>Payable to {SITE.name}, mailed or dropped off at the office. Allow time for mail to arrive by the 1st.</p>
              <p className="meta">No fee</p>
            </div>
          </div>
          <p style={{ marginTop: "18px", fontSize: ".92rem", maxWidth: "70ch" }}>
            However you pay, it goes into our client trust account, never our operating account. It shows up in your
            payment history in the tenant portal once we post it, usually within one business day.
          </p>
          <div className="block">
            <h3>When rent is late</h3>
            <ul>
              <li>Rent is due on the 1st. Your lease states the grace period and the late fee amount &mdash; we don't add anything beyond what it says</li>
              <li>You get a reminder the morning of the 2nd, by text and email</li>
              <li>If you're going to be short, tell us before the 1st. A written payment arrangement is almost always better for you than silence</li>
              <li>We don't report late payments to credit bureaus. Zillow lets you opt in to reporting on-time payments, which can help build your credit</li>
            </ul>
          </div>
        </div>
      </section>

      {/* MAINTENANCE */}
      <section id="maintenance" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <span className="kicker">Maintenance</span>
          <h2>Submit it with a photo and you'll hear back same day</h2>
          <div className="callout" style={{ marginTop: "28px" }}>
            <h3>Emergency? Don't use the portal.</h3>
            <p>Call <a href={SITE.phoneHref}>{SITE.phone}</a> and press 1, any hour. Fire, gas smell, or an active electrical hazard: call 911 first. An emergency means no heat in winter, no water, no working toilet in a one-bath unit, active flooding, a sewage backup, a gas odor, or a door or window that no longer locks.</p>
          </div>
          <div className="two-up">
            <div className="block" style={{ marginTop: "0" }}>
              <h3>What counts as routine</h3>
              <ul>
                <li>Dripping faucet, slow drain, running toilet</li>
                <li>Appliance not working &mdash; tell us the brand and model</li>
                <li>Light fixtures, outlets, and switches</li>
                <li>Screens, blinds, cabinet doors, closet tracks</li>
                <li>Pests &mdash; report immediately, and don't spray first</li>
              </ul>
              <p style={{ marginTop: "14px", fontSize: ".93rem" }}>Routine requests get acknowledged the same business day and scheduled within three. If a part has to be ordered, we tell you when it lands.</p>
            </div>
            <div className="block" style={{ marginTop: "0" }}>
              <h3>Things that speed it up a lot</h3>
              <ul>
                <li>A photo, and a second one of the model plate if it's an appliance</li>
                <li>Whether it's getting worse or holding steady</li>
                <li>Two windows of time a technician can come</li>
                <li>Whether there's a pet we need to know about before entry</li>
                <li>Permission to use a key if you're not home &mdash; you decide, and we ask every time</li>
              </ul>
            </div>
          </div>
          <p style={{ marginTop: "22px", fontSize: ".93rem" }}>You'll always get notice before anyone enters, except in a genuine emergency. If a repair is needed because of damage beyond normal wear, we'll tell you in writing before the work is scheduled, not after.</p>
          <div className="btn-row" style={{ marginTop: "22px" }}>
            <a className="btn btn-primary" href={withBase("/portal/maintenance")}>Submit a request in the tenant portal</a>
          </div>
        </div>
      </section>

      {/* APPLY */}
      <section id="apply">
        <div className="wrap">
          <span className="kicker">Applying</span>
          <h2>Our screening standards, published in advance</h2>
          <p className="lede" style={{ marginTop: "16px" }}>Every applicant is measured against the same list. Nothing here changes based on who is asking.</p>
          <div className="two-up">
            <div className="block" style={{ marginTop: "0" }}>
              <h3>What we look at</h3>
              <ul>
                <li>Gross monthly income of roughly three times the rent, from any lawful source, documented</li>
                <li>Twelve months of verifiable rental or mortgage history</li>
                <li>No unpaid judgment from a prior landlord</li>
                <li>Credit history reviewed as a whole, not as a single cutoff score</li>
                <li>Criminal history reviewed individually, considering what happened, when, and what's happened since</li>
                <li>Every adult 18 or older applies, whether or not they're on the income</li>
              </ul>
            </div>
            <div className="block" style={{ marginTop: "0" }}>
              <h3>How it runs</h3>
              <ul>
                <li>Apply online in about fifteen minutes; the credit-check fee is capped at what Wisconsin allows</li>
                <li>Bring the last two pay stubs, or an offer letter, or benefit award letter</li>
                <li>Decisions usually land in two business days, three if a prior landlord is slow</li>
                <li>Applications are worked in the order they're completed, not the order they're started</li>
                <li>Turned down? We'll tell you the reason in writing and what would change it</li>
              </ul>
            </div>
          </div>
          <div className="block">
            <h3>Pets, smoking, and parking</h3>
            <ul>
              <li>Pets allowed at most properties with a pet addendum, a monthly pet rent, and proof of vaccination &mdash; breed and weight limits vary by building and by the owner's insurance</li>
              <li>Assistance animals are not pets, are never charged for, and are handled under fair-housing rules</li>
              <li>Smoking and vaping are prohibited inside every unit we manage, including cannabis</li>
              <li>Parking, storage, and laundry vary by building and are spelled out in the listing</li>
            </ul>
          </div>
          <div className="btn-row" style={{ marginTop: "28px" }}>
            <a className="btn btn-primary" href={withBase("/rentals")}>See available rentals</a>
            <a className="btn btn-ghost" href={withBase("/rentals#apply")}>Start an application</a>
          </div>
        </div>
      </section>

      {/* MOVING */}
      <section className="steps">
        <div className="wrap">
          <span className="kicker">Moving in and out</span>
          <h2>The two days that decide your deposit</h2>
          <div className="step-grid" style={{ marginTop: "38px" }}>
            <div className="step">
              <span className="n">Move-in</span>
              <h3>Fill out the check-in sheet</h3>
              <p>We hand you a condition report at key pickup. Wisconsin gives you seven days to note anything already damaged. Write down everything, photograph it, and send it back &mdash; this is the single best protection for your deposit.</p>
            </div>
            <div className="step">
              <span className="n">While you're there</span>
              <h3>Report small things early</h3>
              <p>A slow leak reported in March is a repair. The same leak found in October is a floor. Reporting promptly keeps damage off your ledger.</p>
            </div>
            <div className="step">
              <span className="n">Move-out</span>
              <h3>Get the walkthrough</h3>
              <p>Give written notice per your lease, ask for a pre-move-out walkthrough so you know what to fix, leave a forwarding address, and return every key.</p>
            </div>
          </div>
          <p style={{ marginTop: "26px", fontSize: ".95rem", color: "#AFBECE", maxWidth: "66ch" }}>Wisconsin requires your deposit back within 21 days of move-out, with an itemized written statement of anything withheld. Normal wear isn't chargeable. If you disagree with an item, reply in writing and we'll put the invoice in front of you.</p>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <div className="wrap narrow">
          <h2>Tenant questions</h2>
          <details>
            <summary>Can I get a roommate added to the lease?</summary>
            <p>Yes, if they apply and meet the same standards, and the owner approves. Nobody moves in first and applies after &mdash; that's a lease violation and it puts your tenancy at risk.</p>
          </details>
          <details>
            <summary>Can I break my lease early?</summary>
            <p>Talk to us before you go. Depending on the lease and the market you may owe rent until the unit is re-rented, plus a re-rental cost. We market the unit immediately, which usually makes it far cheaper than walking away silently.</p>
          </details>
          <details>
            <summary>Can I paint, mount a TV, or put in a garden?</summary>
            <p>Ask first and we'll ask the owner. Most say yes to paint with a return-to-original condition, and to a TV mount if the holes get patched. Written approval protects both of us at move-out.</p>
          </details>
          <details>
            <summary>Who shovels and mows?</summary>
            <p>It depends on the building and it's stated in your lease. In single-family and most duplexes it's the tenant; in larger buildings we contract it. Sidewalk clearing deadlines are set by your municipality and the fine follows whoever is responsible.</p>
          </details>
          <details>
            <summary>Do I need renters insurance?</summary>
            <p>Yes, and we verify it at move-in. The owner's policy covers the building, not your belongings, and not your liability if something you did floods the unit below.</p>
          </details>
          <details>
            <summary>My rent is going up. Can we talk about it?</summary>
            <p>You'll get renewal terms well before your lease ends, with the local comparables that produced the number. If the number doesn't work for you, tell us &mdash; a good tenant staying put is worth more than a higher rent with a vacancy in between.</p>
          </details>
        </div>
      </section>

      {/* CLOSING */}
      <section className="close">
        <div className="wrap">
          <span className="kicker">Get in touch</span>
          <h2>Office hours 8 to 5, weekdays. Emergencies, any hour.</h2>
          <p>Non-urgent requests through the portal get a same-business-day answer. If you'd rather talk to a person, call.</p>
          <div className="btn-row">
            <a className="btn btn-ghost" href={SITE.phoneHref}>{SITE.phone}</a>
            <a className="btn btn-ghost" href={withBase("/portal/maintenance")}>Report maintenance</a>
          </div>
        </div>
      </section>
    </>
  );
}
