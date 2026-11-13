import { withBase } from "../lib/base";
import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BrandMark } from "./Brand";
import { SITE } from "../lib/site";

const NAV = [
  { href: "/#services", label: "Services" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/owners", label: "For owners" },
  { href: "/tenants", label: "For tenants" },
  { href: "/rentals", label: "Rentals" },
];

export default function SiteLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  return (
    <>
      <div className="banner">
        Now taking on owners of one unit and up in {SITE.counties}. <a href={withBase("/#quote")}>Check availability</a>
      </div>

      <header className="nav">
        <div className="wrap nav-in">
          <a className="brand" href={withBase("/")}>
            <BrandMark />
            DH<span className="bn-rest"> Property Management</span>
          </a>
          <nav className={`nav-links${open ? " open" : ""}`} aria-label="Main" onClick={() => setOpen(false)}>
            {NAV.map((n) => (
              <a key={n.href} href={withBase(n.href)} aria-current={pathname === n.href ? "page" : undefined}>
                {n.label}
              </a>
            ))}
            <NavLink to="/portal">Log in</NavLink>
          </nav>
          <a className="btn btn-primary btn-sm nav-cta" href={withBase("/#quote")}>
            Get a quote
          </a>
          <button
            className="nav-toggle"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand">
              <a className="brand" href={withBase("/")}>
                <BrandMark />
                {SITE.name}
              </a>
              <p>Property management for small portfolios in southeast Wisconsin. No door minimum.</p>
            </div>
            <div>
              <h4>Services</h4>
              <ul>
                <li><a href={withBase("/#services")}>Full management</a></li>
                <li><a href={withBase("/#services")}>Leasing only</a></li>
                <li><a href={withBase("/#pricing")}>Pricing</a></li>
                <li><a href={withBase("/owners#portal")}>Owner portal</a></li>
                <li><a href={withBase("/sample-reports")}>Sample owner reports</a></li>
              </ul>
            </div>
            <div>
              <h4>Owners &amp; tenants</h4>
              <ul>
                <li><a href={withBase("/owners")}>For owners</a></li>
                <li><a href={withBase("/tenants")}>For tenants</a></li>
                <li><a href={withBase("/portal")}>Log in</a></li>
                <li><a href={withBase("/tenants#maintenance")}>Report maintenance</a></li>
                <li><a href={withBase("/rentals")}>Available rentals</a></li>
              </ul>
            </div>
            <div>
              <h4>Company</h4>
              <ul>
                <li><a href={withBase("/#quote")}>Contact</a></li>
                <li><a href={withBase("/#area")}>Service area</a></li>
                <li><a href={withBase("/owners#switching")}>Switching managers</a></li>
                <li><a href={withBase("/#quote")}>Refer an owner</a></li>
              </ul>
            </div>
          </div>
          <div className="foot-bottom">
            <span>&copy; {new Date().getFullYear()} {SITE.name}. Licensed in Wisconsin. Equal Housing Opportunity.</span>
            <span>Privacy &middot; Terms</span>
          </div>
        </div>
      </footer>
    </>
  );
}
