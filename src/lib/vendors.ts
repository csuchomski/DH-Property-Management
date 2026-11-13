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

// Towns on the website's service-area list. Staff can add others on the vendor form;
// property cities are added automatically.
export const DEFAULT_AREAS = [
  "Delavan", "East Troy", "Elkhorn", "Lake Geneva", "Mukwonago", "New Berlin", "North Prairie",
  "Oak Creek", "Waukesha", "Wauwatosa", "West Allis", "Whitewater",
];
export const ALL_AREAS = "all";

export interface Vendor {
  id: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  trades: string[];
  areas: string[];
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

export const sameTown = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
export const coversTown = (v: Pick<Vendor, "areas">, city: string) =>
  v.areas.includes(ALL_AREAS) || v.areas.some((a) => sameTown(a, city));

// Insurance on file and not expiring within 30 days.
export function insuranceState(expires: string | null): "ok" | "soon" | "expired" | "none" {
  if (!expires) return "none";
  const days = (new Date(`${expires}T12:00:00`).getTime() - Date.now()) / 86400000;
  return days < 0 ? "expired" : days < 30 ? "soon" : "ok";
}
