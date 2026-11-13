import { withBase } from "../../lib/base";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { BrandMark } from "../../components/Brand";
import { useAuth } from "../../lib/auth";
import { SITE } from "../../lib/site";
import { supabaseConfigured } from "../../lib/supabase";
import type { Role } from "../../lib/types";
import Login from "./Login";

interface NavItem {
  to: string;
  label: string;
}
interface NavGroup {
  heading?: string;
  items: NavItem[];
}

// Owners and tenants have a handful of pages: one top bar. Staff get a grouped sidebar.
const NAV: Record<Role, NavGroup[]> = {
  owner: [
    {
      items: [
        { to: "/portal", label: "Overview" },
        { to: "/portal/statements", label: "Statements" },
        { to: "/portal/work-orders", label: "Maintenance" },
        { to: "/portal/documents", label: "Documents" },
        { to: "/portal/vendors", label: "Vendors" },
        { to: "/portal/tax", label: "Year-end tax" },
      ],
    },
  ],
  tenant: [
    {
      items: [
        { to: "/portal", label: "My home" },
        { to: "/portal/maintenance", label: "Maintenance" },
        { to: "/portal/documents", label: "Documents" },
        { to: "/portal/move-out", label: "Moving out" },
      ],
    },
  ],
  staff: [
    { items: [{ to: "/portal", label: "Today" }] },
    {
      heading: "Operations",
      items: [
        { to: "/portal/requests", label: "Leads" },
        { to: "/portal/work-orders", label: "Work orders" },
        { to: "/portal/vendors", label: "Vendors" },
        { to: "/portal/move-outs", label: "Move-outs" },
        { to: "/portal/documents", label: "Documents" },
      ],
    },
    {
      heading: "Money",
      items: [
        { to: "/portal/transactions", label: "Ledger" },
        { to: "/portal/trust", label: "Trust" },
        { to: "/portal/statements", label: "Owner statements" },
        { to: "/portal/tax", label: "Tax summary" },
      ],
    },
    {
      heading: "Records",
      items: [
        { to: "/portal/properties", label: "Properties" },
        { to: "/portal/units", label: "Units" },
        { to: "/portal/leases", label: "Leases" },
        { to: "/portal/tenants", label: "Tenants" },
        { to: "/portal/owners", label: "Owners" },
      ],
    },
    { heading: "Admin", items: [{ to: "/portal/accounts", label: "Accounts" }] },
  ],
};

function NavLinks({ items, onPick }: { items: NavItem[]; onPick?: () => void }) {
  return (
    <>
      {items.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === "/portal"} onClick={onPick}>
          {n.label}
        </NavLink>
      ))}
    </>
  );
}

function Shell({ children, nav, side = false }: { children: React.ReactNode; nav?: NavGroup[]; side?: boolean }) {
  const { session, profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const sidebar = side && !!nav;

  return (
    <div className={sidebar ? "app app-side" : "app"}>
      <div className="app-top">
        <div className={sidebar ? "app-top-in app-top-full" : "wrap app-top-in"}>
          {sidebar && (
            <button
              className="menu-btn"
              aria-label="Menu"
              aria-expanded={open}
              aria-controls="side-nav"
              onClick={() => setOpen((o) => !o)}
            >
              <span aria-hidden="true" />
              Menu
            </button>
          )}
          <a className="brand" href={withBase("/")}>
            <BrandMark />
            DH<span className="bn-rest"> Property Management</span>
          </a>
          {session && (
            <div className="who">
              <span>
                <b>{profile?.full_name || session.user.email}</b>
                {profile?.role && <> &middot; {profile.role}</>}
              </span>
              <button className="btn btn-ghost-dark btn-sm" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>

      {nav && !sidebar && (
        <nav className="app-nav" aria-label="Portal">
          <div className="wrap">
            <NavLinks items={nav.flatMap((g) => g.items)} />
          </div>
        </nav>
      )}

      {sidebar ? (
        <div className="app-body">
          <nav id="side-nav" className={open ? "side-nav open" : "side-nav"} aria-label="Portal">
            {nav!.map((g, i) => (
              <div className="side-group" key={g.heading ?? i}>
                {g.heading && <h2>{g.heading}</h2>}
                <NavLinks items={g.items} onPick={() => setOpen(false)} />
              </div>
            ))}
          </nav>
          {open && <div className="side-scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
          <div className="app-main">
            <div className="wrap">{children}</div>
          </div>
        </div>
      ) : (
        <div className="app-main">
          <div className="wrap">{children}</div>
        </div>
      )}
    </div>
  );
}

export default function PortalLayout() {
  const { loading, session, profile, error, refreshProfile } = useAuth();

  if (!supabaseConfigured) {
    return (
      <Shell>
        <h1>Portal not connected</h1>
        <p className="notice">
          This build has no Supabase project configured. Set <code>VITE_SUPABASE_URL</code> and{" "}
          <code>VITE_SUPABASE_ANON_KEY</code> (see <code>.env.example</code>) and rebuild.
        </p>
      </Shell>
    );
  }
  if (loading) {
    return (
      <Shell>
        <p>Loading…</p>
      </Shell>
    );
  }
  if (!session) return <Login />;

  if (error || !profile?.role) {
    return (
      <Shell>
        <h1>We don't have your account linked yet</h1>
        <p className="sub" style={{ maxWidth: "62ch" }}>
          You're signed in as <b>{session.user.email}</b>, but that address isn't on an owner or tenant record. If you
          use a different email with us, sign out and use that one. Otherwise call {SITE.phone} and we'll connect it.
        </p>
        {error && <p className="notice">{error}</p>}
        <div className="btn-row" style={{ marginTop: 18 }}>
          <button className="btn btn-ghost" onClick={() => void refreshProfile()}>
            Check again
          </button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell nav={NAV[profile.role]} side={profile.role === "staff"}>
      <Outlet />
    </Shell>
  );
}
