export const TYPE_LABELS = {
  feeds: "Feeds",
  hatchery: "Chicks / hatchery",
  medicine: "Medicine",
  equipment: "Equipment",
  other: "Other"
};

// Same values as products.category and supplier_profiles.product_categories
// (the database rejects anything else).
export const CATEGORIES = [
  { value: "feeds", label: "Feeds" },
  { value: "chickens", label: "Chicks & birds" },
  { value: "eggs", label: "Eggs" },
  { value: "medicine", label: "Medicine & vaccines" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" }
];

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

export const UNITS = [
  { value: "per_kg", label: "Per kg" },
  { value: "per_bag", label: "Per bag" },
  { value: "per_bird", label: "Per chick / bird" },
  { value: "per_tray", label: "Per tray" },
  { value: "per_piece", label: "Per item" },
  { value: "per_lot", label: "Per lot" }
];

export const UNIT_LABELS = {
  per_bird: "/bird",
  per_tray: "/tray",
  per_kg: "/kg",
  per_bag: "/bag",
  per_piece: "/piece",
  per_lot: "/lot"
};

export const VERIFICATION_META = {
  pending: { label: "Pending review", tone: "amber" },
  verified: { label: "Verified", tone: "green" },
  rejected: { label: "Not approved", tone: "red" },
  suspended: { label: "Suspended", tone: "red" }
};

// products.created_at and orders.created_at are `timestamp without time
// zone`, which PostgREST returns with no offset. The database clock is UTC,
// so treat a bare timestamp as UTC instead of the browser's local time.
export function parseDbDate(value) {
  if (!value) return null;
  const text = String(value);
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  const date = new Date(hasZone ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const RELATIVE_STEPS = [
  ["year", 31536000],
  ["month", 2592000],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60]
];

export function timeAgo(date, now = Date.now()) {
  if (!date) return "";
  const seconds = Math.round((date.getTime() - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of RELATIVE_STEPS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatKes(amount) {
  return `KES ${Number(amount || 0).toLocaleString()}`;
}

export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "S";
  return parts.slice(0, 2).map(p => p[0].toUpperCase()).join("");
}
