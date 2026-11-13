// Vendor trades and service areas, shared by the owner and staff vendor pages.
export const TRADES = [
  "plumbing", "electrical", "hvac", "appliance", "handyman", "roofing", "painting", "flooring",
  "pest", "locksmith", "cleaning", "lawn_snow", "general_contractor", "other",
] as const;
export type Trade = (typeof TRADES)[number];

export const TRADE_LABEL: Record<string, string> = {
  plumbing: "Plumbing",
  electrical: "Electrical",
  hvac: "Heating & cooling",
  appliance: "Appliance repair",
  handyman: "Handyman",
  roofing: "Roofing & gutters",
  painting: "Painting",
  flooring: "Flooring",
  pest: "Pest control",
  locksmith: "Locks & keys",
  cleaning: "Cleaning",
  lawn_snow: "Lawn & snow",
  general_contractor: "General contractor",
  other: "Other",
};

// Counties a vendor can cover: southeast Wisconsin, core service area first.
export const COUNTIES = [
  "Waukesha", "Walworth", "Milwaukee", "Racine", "Kenosha", "Jefferson", "Washington", "Ozaukee", "Rock", "Dodge",
];
export const ALL_AREAS = "all";
export const countyLabel = (c: string) => (c === ALL_AREAS ? "All areas" : `${c} County`);

export interface Vendor {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  trades: string[];
  areas: string[]; // counties, or ["all"]
  location: string | null; // where the vendor is based
  license_no: string | null;
  insurance_expires: string | null;
  w9_on_file: boolean;
  rating: number | null;
  notes: string | null;
  active: boolean;
}

export interface VendorPreference {
  id: string;
  owner_id: string;
  property_id: string | null;
  trade: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: "pending" | "approved" | "declined";
  vendor_id: string | null;
  staff_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const coversCounty = (v: Pick<Vendor, "areas">, county: string | null) =>
  v.areas.includes(ALL_AREAS) || (!!county && v.areas.some((a) => same(a, county)));
// Covers any of the chosen counties (none chosen = no filter).
export const coversAny = (v: Pick<Vendor, "areas">, counties: string[]) =>
  !counties.length || v.areas.includes(ALL_AREAS) || counties.some((c) => coversCounty(v, c));

// Insurance on file and not expiring within 30 days.
export function insuranceState(expires: string | null): "ok" | "soon" | "expired" | "none" {
  if (!expires) return "none";
  const days = (new Date(`${expires}T12:00:00`).getTime() - Date.now()) / 86400000;
  return days < 0 ? "expired" : days < 30 ? "soon" : "ok";
}
