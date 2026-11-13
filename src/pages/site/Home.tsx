import { withBase } from "../../lib/base";
import QuoteForm from "../../components/QuoteForm";
import { usePageTitle } from "../../lib/usePageTitle";

export default function Home() {
  usePageTitle("Home");
  return (
    <>
      {/* HERO */}
      <div className="hero" id="top">
        <div className="wrap hero-grid">
          <div className="reveal">
            <span className="kicker">One to twenty units</span>
            <h1>Twenty units is our ceiling. <em>Not our minimum.</em></h1>
            <p className="lede">Most managers in southeast Wisconsin want fifty doors before they'll return the call. DH Property Management was built the other way around: the duplex, the four-plex, the twelve you bought one at a time. A percentage of the rent we actually collect, no markup on repairs, and a statement your accountant can use without a phone call.</p>
            <div className="btn-row">
              <a className="btn btn-primary" href="#quote">Get a management quote</a>
              <a className="btn btn-ghost-dark" href="#pricing">See what we charge</a>
            </div>
            <p className="hero-note">Twelve-month agreement, 30 days to walk. No setup fee.</p>
          </div>

          <div className="reveal">
            <div className="stmt">
              <div className="stmt-head">
                <div>
                  <h3>Owner statement</h3>
                  <span>1042 Tallmadge St &mdash; Unit B &middot; August 2026</span>
                </div>
                <div className="stmt-tag">Deposited Sep 3</div>
              </div>
              <div className="stmt-row"><span>Rent collected</span><b>$1,425.00</b></div>
              <div className="stmt-row"><span>Late fee collected</span><b>$45.00</b></div>
              <div className="stmt-row neg"><span>Management fee &mdash; 8% of collected rent</span><b>&minus;$117.60</b></div>
              <div className="stmt-row neg"><span>Repair: water heater igniter (Krueger Plumbing, at cost)</span><b>&minus;$142.00</b></div>
              <div className="stmt-row neg"><span>Reserve held</span><b>&minus;$150.00</b></div>
              <div className="stmt-net"><span>Net to you</span><b>$1,060.40</b></div>
              <p className="stmt-foot">Invoices and lease documents attached. Year-end Schedule E summary posts every January.</p>
            </div>
          </div>
        </div>
      </div>

      {/* NUMBERS */}
      <section className="numbers">
        <div className="wrap">
          <span className="kicker">The portfolio you actually have</span>
          <h2>Small owners get treated like an afterthought. That's the whole opening.</h2>
          <div className="num-grid">
            <div className="num">
              <b>1&ndash;20</b>
              <p>Units we take on. No minimum door count and no waiting list for one-unit owners.</p>
            </div>
            <div className="num">
              <b>7&ndash;9%</b>
              <p>Of rent actually collected, and nothing else. No per-unit minimum, no fee on a vacant unit, no fee on rent that didn't come in.</p>
            </div>
            <div className="num">
              <b>$0</b>
              <p>Added to a vendor invoice. You see the plumber's bill, not our version of it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section>
        <div className="wrap">
          <span className="kicker">Who this is for</span>
          <h2>If any of these is you, you're the client</h2>
          <div className="prob-grid">
            <div className="prob">
              <h3>You own two to six units and nobody will quote you</h3>
              <p>The regional firms want a portfolio. The one-man operators are at capacity. You've been told to call back when you're bigger.</p>
              <p className="fix">Small portfolios aren't our overflow work. They're the entire book.</p>
            </div>
            <div className="prob">
              <h3>You self-manage and it's finally too much</h3>
              <p>You can handle the accounting. It's the 11pm call, the showings on a Saturday, and the tenant who needs a notice served properly.</p>
              <p className="fix">Take the whole thing or just the vacancies. Both are real options here.</p>
            </div>
            <div className="prob">
              <h3>You live an hour or three away</h3>
              <p>You bought in Elkhorn or Waukesha and moved. You need somebody who can be at the building today, not next week.</p>
              <p className="fix">We stay inside a radius we can drive, and we say no to properties outside it.</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHY OWNERS LEAVE */}
      <section className="svc">
        <div className="wrap">
          <span className="kicker">Why owners leave their last manager</span>
          <h2>Three things that push small owners back to self-managing</h2>
          <div className="prob-grid">
            <div className="prob">
              <h3>Flat fees that eat a small unit alive</h3>
              <p>A $150 monthly minimum on a $1,100 rent is 14%. On a vacant unit it's the whole thing. Flat pricing is built for big portfolios, not yours.</p>
              <p className="fix">We charge a percentage of collected rent with no minimum attached.</p>
            </div>
            <div className="prob">
              <h3>Maintenance you can't audit</h3>
              <p>A trip charge, a markup baked into the invoice, a $600 repair you'd have handled for $200 with your own guy.</p>
              <p className="fix">Vendor invoices pass through at cost. Keep your own trades if you want them.</p>
            </div>
            <div className="prob">
              <h3>Silence between statements</h3>
              <p>You find out about the vacancy when the deposit doesn't hit. Nobody answers until the fifth of the month.</p>
              <p className="fix">Live rent roll, work orders as they open, and a named person who knows your buildings.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services">
        <div className="wrap">
          <span className="kicker">Two ways to work together</span>
          <h2>Hand over everything, or just the part you hate</h2>
          <div className="svc-grid">
            <div className="svc-card">
              <h3>Full management</h3>
              <p>Day-to-day operations for owners who want the property off their calendar entirely.</p>
              <ul>
                <li>Rent collected into a client trust account, with your payout by ACH by the 10th</li>
                <li>Tenant screening, lease prep, renewals, and rent-increase timing</li>
                <li>24/7 maintenance line and work-order dispatch to vetted trades</li>
                <li>Move-in and move-out inspections with photo record</li>
                <li>Security deposits in a separate trust account, itemized inside Wisconsin's return window</li>
                <li>Notices, nonpayment filings, and eviction coordination with counsel</li>
                <li>Monthly owner statement and year-end Schedule E summary</li>
              </ul>
              <p className="price">7&ndash;9% of collected rent, by unit count</p>
              <a className="btn btn-primary" href="#quote">Get a quote</a>
            </div>
            <div className="svc-card">
              <h3>Leasing only</h3>
              <p>You run the property. We fill the vacancy and hand you a signed, screened tenant.</p>
              <ul>
                <li>Rent survey for the block, not the county</li>
                <li>Photos, listing, and syndication to the major rental sites</li>
                <li>Showings and applicant follow-up</li>
                <li>Credit, income, eviction, and prior-landlord screening</li>
                <li>Wisconsin-compliant lease, addenda, and check-in report</li>
                <li>Keys, deposit, and first month handed over to you</li>
              </ul>
              <p className="price">65% of one month's rent &middot; nothing owed until a lease is signed</p>
              <a className="btn btn-ghost-dark" href="#quote">Start a vacancy</a>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ background: "var(--paper-2)" }}>
        <div className="wrap">
          <span className="kicker">Pricing</span>
          <h2>One line item: a percentage of the rent we collect</h2>
          <p className="lede" style={{ marginTop: "16px" }}>No per-unit minimum, no monthly platform charge, nothing owed on an empty unit. The rate steps down as the portfolio grows.</p>
          <div className="tier-grid">
            <div className="tier">
              <span className="units">1&ndash;3 units</span>
              <h3>Single</h3>
              <p className="rate">9%<small> of collected rent</small></p>
              <p className="sub">No minimum, no vacancy fee</p>
              <ul>
                <li>Full management, everything listed above</li>
                <li>Leasing fee 65% of one month's rent</li>
                <li>No renewal fee</li>
              </ul>
              <a className="btn btn-ghost" href="#quote">Get a quote</a>
            </div>
            <div className="tier feature">
              <span className="units">4&ndash;9 units</span>
              <h3>Portfolio</h3>
              <p className="rate">8%<small> of collected rent</small></p>
              <p className="sub">No minimum, no vacancy fee</p>
              <ul>
                <li>Everything in Single</li>
                <li>Leasing fee 50% of one month's rent</li>
                <li>Quarterly portfolio review and rent-increase plan</li>
                <li>Annual exterior and mechanical walkthrough</li>
              </ul>
              <a className="btn btn-primary" href="#quote">Get a quote</a>
            </div>
            <div className="tier">
              <span className="units">10&ndash;20 units</span>
              <h3>Operator</h3>
              <p className="rate">7%<small> of collected rent</small></p>
              <p className="sub">No minimum, no vacancy fee</p>
              <ul>
                <li>Everything in Portfolio</li>
                <li>Leasing fee 40% of one month's rent</li>
                <li>Capital-expense planning and bid management</li>
                <li>Direct line to your account manager</li>
              </ul>
              <a className="btn btn-ghost" href="#quote">Get a quote</a>
            </div>
          </div>

          <div className="nofee">
            <h3>Fees we don't charge</h3>
            <ul>
              <li>No per-unit monthly minimum</li>
              <li>No fee while a unit is vacant</li>
              <li>No onboarding or setup fee</li>
              <li>No markup or coordination fee on repairs</li>
              <li>No lease-renewal fee</li>
              <li>No cancellation penalty after 30 days' notice</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ONBOARDING */}
      <section className="steps" id="onboarding">
        <div className="wrap">
          <span className="kicker">Onboarding</span>
          <h2>From handshake to first deposit in about three weeks</h2>
          <div className="step-grid">
            <div className="step">
              <span className="n">Step 1</span>
              <h3>Walk the units</h3>
              <p>We tour every unit with you, photograph condition, read the existing leases, and flag anything that won't survive an inspection or a deposit dispute. You get the written punch list whether or not you sign.</p>
            </div>
            <div className="step">
              <span className="n">Step 2</span>
              <h3>Move the paperwork</h3>
              <p>Tenants get one introduction letter with one place to pay and one number to call. Deposits transfer into trust, insurance and W-9s get squared away, and we keep the vendors you want kept.</p>
            </div>
            <div className="step">
              <span className="n">Step 3</span>
              <h3>Run it</h3>
              <p>Rent posts, work orders route, and your first statement lands the following month. Anything above your approval threshold comes to you with a bid before a wrench turns.</p>
            </div>
          </div>
          <div className="btn-row" style={{ marginTop: "34px" }}>
            <a className="btn btn-primary" href={withBase("/owners")}>See the full owner walkthrough</a>
            <a className="btn btn-ghost-dark" href={withBase("/sample-reports")}>See sample owner reports</a>
          </div>
        </div>
      </section>

      {/* AREA + FAQ */}
      <section className="area" id="area">
        <div className="wrap">
          <span className="kicker">Service area</span>
          <h2>Close enough to be there the same day</h2>
          <div className="area-grid">
            <div>
              <p>We stay inside a radius we can actually drive. If your property is outside it, we'll tell you straight and point you at someone who covers it.</p>
              <p style={{ marginTop: "14px" }}><strong>Waukesha &middot; Walworth &middot; Milwaukee counties</strong></p>
            </div>
            <div className="area-cols">
              <span>Mukwonago</span><span>Elkhorn</span>
              <span>North Prairie</span><span>Delavan</span>
              <span>Waukesha</span><span>Lake Geneva</span>
              <span>East Troy</span><span>Whitewater</span>
              <span>New Berlin</span><span>West Allis</span>
              <span>Wauwatosa</span><span>Oak Creek</span>
            </div>
          </div>

          <div style={{ marginTop: "clamp(44px,6vw,72px)" }}>
            <h2>Questions owners ask first</h2>
            <details>
              <summary>Will you really manage one duplex?</summary>
              <p>Yes. One to twenty units is the entire business. A single-unit owner gets the same statement, portal, and maintenance line as the twenty-unit accounts.</p>
            </details>
            <details>
              <summary>Can I keep using my own plumber and HVAC guy?</summary>
              <p>Yes, as long as they're licensed, insured, and answer the phone. Put them on your vendor list during onboarding and we'll dispatch them first.</p>
            </details>
            <details>
              <summary>How do tenants pay, and when do I get paid?</summary>
              <p>Tenants pay through Zillow, free by bank transfer, and the money lands in our client trust account, on your own ledger. By the 10th we pay out your balance by ACH, less the month's bills, our fee and your reserve. Your money never covers another owner's bills, and we reconcile the account to the penny every month.</p>
            </details>
            <details>
              <summary>Who holds the security deposits?</summary>
              <p>Deposits sit in a separate trust account, never in operating funds. At move-out the tenant gets an itemized statement of any withholding inside the window Wisconsin law requires, and you get a copy.</p>
            </details>
            <details>
              <summary>What happens if a tenant stops paying?</summary>
              <p>Notice goes out on the schedule your lease and state law allow, we document everything, and we coordinate with your attorney if it reaches a filing. You approve the decision to proceed; we handle the legwork and appear in court.</p>
            </details>
            <details>
              <summary>How do I get out of the agreement?</summary>
              <p>Thirty days' written notice after the first twelve months, no penalty. Leases, deposits, ledgers, and tenant contacts go out in a format the next manager can load.</p>
            </details>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="close" id="quote">
        <div className="wrap">
          <span className="kicker">Get a quote</span>
          <h2>Send the addresses and the rent roll. We'll send back a number.</h2>
          <p>No pitch meeting required. Fifteen minutes on the phone, a walkthrough of the units, and a written quote with the punch list included.</p>
          <QuoteForm />
        </div>
      </section>
    </>
  );
}
