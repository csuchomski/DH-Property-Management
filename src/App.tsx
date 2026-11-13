import { lazy, Suspense, type ReactElement } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { RouterLinks, ScrollToHash } from "./components/RouterLinks";
import SiteLayout from "./components/SiteLayout";
import { useAuth } from "./lib/auth";
import type { Role } from "./lib/types";
import PortalLayout from "./pages/portal/PortalLayout";
import Home from "./pages/site/Home";
import NotFound from "./pages/site/NotFound";
import Owners from "./pages/site/Owners";
import Rentals from "./pages/site/Rentals";
import Tenants from "./pages/site/Tenants";

const OwnerOverview = lazy(() => import("./pages/portal/owner/OwnerOverview"));
const OwnerWorkOrders = lazy(() => import("./pages/portal/owner/OwnerWorkOrders"));
const Statements = lazy(() => import("./pages/portal/owner/Statements"));
const TaxSummary = lazy(() => import("./pages/portal/owner/TaxSummary"));
const StaffToday = lazy(() => import("./pages/portal/staff/StaffToday"));
const TenantHome = lazy(() => import("./pages/portal/tenant/TenantHome"));
const TenantMaintenance = lazy(() => import("./pages/portal/tenant/TenantMaintenance"));
const TenantDocuments = lazy(() => import("./pages/portal/tenant/TenantDocuments"));
const TenantMoveOut = lazy(() => import("./pages/portal/tenant/TenantMoveOut"));
const OwnerDocuments = lazy(() => import("./pages/portal/owner/OwnerDocuments"));
const staffDocs = () => import("./pages/portal/staff/StaffDocuments");
const StaffDocuments = lazy(() => staffDocs().then((m) => ({ default: m.StaffDocuments })));
const StaffMoveOuts = lazy(() => staffDocs().then((m) => ({ default: m.StaffMoveOuts })));
const StaffTrust = lazy(() => import("./pages/portal/staff/StaffTrust"));
const SampleReports = lazy(() => import("./pages/site/SampleReports"));
const staff = () => import("./pages/portal/staff/StaffRecords");
const StaffAccounts = lazy(() => staff().then((m) => ({ default: m.StaffAccounts })));
const StaffLeads = lazy(() => staff().then((m) => ({ default: m.StaffLeads })));
const StaffLeases = lazy(() => staff().then((m) => ({ default: m.StaffLeases })));
const StaffOwners = lazy(() => staff().then((m) => ({ default: m.StaffOwners })));
const StaffProperties = lazy(() => staff().then((m) => ({ default: m.StaffProperties })));
const StaffTenants = lazy(() => staff().then((m) => ({ default: m.StaffTenants })));
const StaffTransactions = lazy(() => staff().then((m) => ({ default: m.StaffTransactions })));
const StaffUnits = lazy(() => staff().then((m) => ({ default: m.StaffUnits })));
const StaffWorkOrders = lazy(() => staff().then((m) => ({ default: m.StaffWorkOrders })));

// One URL, different screen per role; anything a role can't use goes back to /portal.
function ByRole(props: Partial<Record<Role, ReactElement>>) {
  const { profile } = useAuth();
  const el = profile?.role ? props[profile.role] : undefined;
  return el ?? <Navigate to="/portal" replace />;
}

export default function App() {
  return (
    <RouterLinks>
      <ScrollToHash />
      <Suspense fallback={<p style={{ padding: 24 }}>Loading…</p>}>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<Home />} />
          <Route path="owners" element={<Owners />} />
          <Route path="tenants" element={<Tenants />} />
          <Route path="rentals" element={<Rentals />} />
          <Route path="sample-reports" element={<SampleReports />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="portal" element={<PortalLayout />}>
          <Route index element={<ByRole owner={<OwnerOverview />} tenant={<TenantHome />} staff={<StaffToday />} />} />
          <Route path="statements" element={<ByRole owner={<Statements />} staff={<Statements />} />} />
          <Route path="tax" element={<ByRole owner={<TaxSummary />} staff={<TaxSummary />} />} />
          <Route path="work-orders" element={<ByRole owner={<OwnerWorkOrders />} staff={<StaffWorkOrders />} />} />
          <Route path="maintenance" element={<ByRole tenant={<TenantMaintenance />} />} />
          <Route path="documents" element={<ByRole tenant={<TenantDocuments />} owner={<OwnerDocuments />} staff={<StaffDocuments />} />} />
          <Route path="move-out" element={<ByRole tenant={<TenantMoveOut />} />} />
          <Route path="move-outs" element={<ByRole staff={<StaffMoveOuts />} />} />
          <Route path="requests" element={<ByRole staff={<StaffLeads />} />} />
          <Route path="transactions" element={<ByRole staff={<StaffTransactions />} />} />
          <Route path="trust" element={<ByRole staff={<StaffTrust />} />} />
          <Route path="leases" element={<ByRole staff={<StaffLeases />} />} />
          <Route path="units" element={<ByRole staff={<StaffUnits />} />} />
          <Route path="properties" element={<ByRole staff={<StaffProperties />} />} />
          <Route path="owners" element={<ByRole staff={<StaffOwners />} />} />
          <Route path="tenants" element={<ByRole staff={<StaffTenants />} />} />
          <Route path="accounts" element={<ByRole staff={<StaffAccounts />} />} />
          <Route path="*" element={<Navigate to="/portal" replace />} />
        </Route>
      </Routes>
      </Suspense>
    </RouterLinks>
  );
}
