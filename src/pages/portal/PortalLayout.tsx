import { withBase } from "../../lib/base";
import { NavLink, Outlet } from "react-router-dom";
import { BrandMark } from "../../components/Brand";
import { useAuth } from "../../lib/auth";
import { SITE } from "../../lib/site";
import { supabaseConfigured } from "../../lib/supabase";
import type { Role } from "../../lib/types";
import Login from "./Login";

const NAV: Record<Role, { to: string; label: string }[]> = {
  owner: [
    { to: "/portal", label: "Overview" },
    { to: "/portal/statements", label: "Statements" },
    { to: "/portal/work-orders", label: "Maintenance" },
    { to: "/portal/documents", label: "Documents" },
    { to: "/portal/tax", label: "Year-end tax" },
  ],
  tenant: [
    { to: "/portal", label: "My home" },
    { to: "/portal/maintenance", label: "Maintenance" },
    { to: "/portal/documents", label: "Documents" },
    { to: "/portal/move-out", label: "Moving out" },
  ],
  staff: [
    { to: "/portal", label: "Today" },
    { to: "/portal/requests", label: "Leads" },
    { to: "/portal/work-orders", label: "Work orders" },
    { to: "/portal/transactions", label: "Ledger" },
    { to: "/portal/statements", label: "Statements" },
    { to: "/portal/leases", label: "Leases" },
    { to: "/portal/documents", label: "Documents" },
    { to: "/portal/move-outs", label: "Move-outs" },
    { to: "/portal/units", label: "Units" },
    { to: "/portal/properties", label: "Properties" },
    { to: "/portal/owners", label: "Owners" },
    { to: "/portal/tenants", label: "Tenants" },
    { to: "/portal/accounts", label: "Accounts" },
  ],
};

function Shell({ children, nav }: { children: React.ReactNode; nav?: { to: string; label: string }[] }) {
  const { session, profile, signOut } = useAuth();
  return (
    <div className="app">
      <div className="app-top">
        <div className="wrap app-top-in">
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
      {nav && (
        <nav className="app-nav" aria-label="Portal">
          <div className="wrap">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === "/portal"}>
                {n.label}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
      <div className="app-main">
        <div className="wrap">{children}</div>
      </div>
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
    <Shell nav={NAV[profile.role]}>
      <Outlet />
    </Shell>
  );
}
