// Shared by the supplier pages and the farmer marketplace, so both describe
// a listing's availability, price and freshness in exactly the same words.

// products.availability (enforced by a check constraint)
export const AVAILABILITY = {
  in_stock: { label: "In stock", tone: "green" },
  on_order: { label: "Available on order", tone: "blue" },
  out_of_stock: { label: "Out of stock", tone: "amber" }
};

export const AVAILABILITY_OPTIONS = [
  { value: "in_stock", label: "In stock", hint: "Ready now" },
  { value: "on_order", label: "Available on order", hint: "You can get it, with a lead time" },
  { value: "out_of_stock", label: "Out of stock", hint: "Farmers still see it, marked out of stock" }
];

// A listing not updated for this long may no longer be accurate: farmers
// are told to confirm with the supplier, and the supplier is asked to check.
export const STALE_DAYS = 30;

const UNIT_SUFFIX = {
  per_bird: "/bird", per_tray: "/tray", per_kg: "/kg",
  per_bag: "/bag", per_piece: "/item", per_lot: "/lot"
};

const UNIT_WORDS = {
  per_bird: ["chick", "chicks"], per_tray: ["tray", "trays"], per_kg: ["kg", "kg"],
  per_bag: ["bag", "bags"], per_piece: ["item", "items"], per_lot: ["lot", "lots"]
};

export function unitSuffix(unit) {
  return UNIT_SUFFIX[unit] || "";
}

export function unitWord(unit, count = 1) {
  const words = UNIT_WORDS[unit];
  if (!words) return count === 1 ? "unit" : "units";
  return count === 1 ? words[0] : words[1];
}

const kes = (n) => `KES ${Number(n || 0).toLocaleString()}`;

// "KES 3,000" or "KES 3,000 - 3,400" (unit suffix added separately)
export function priceText(product) {
  const from = Number(product?.price || 0);
  const to = Number(product?.price_max || 0);
  return to > from ? `${kes(from)} - ${to.toLocaleString()}` : kes(from);
}

export function minOrderText(product) {
  const n = Number(product?.min_order_qty || 0);
  return n > 1 ? `Min. order ${n} ${unitWord(product.unit, n)}` : "";
}

// updated_at is timestamptz; older rows only have created_at, a UTC
// timestamp without time zone (no offset in the string).
function listingDate(product) {
  const value = product?.updated_at || product?.created_at;
  if (!value) return null;
  const text = String(value);
  const date = new Date(/([zZ]|[+-]\d{2}:?\d{2})$/.test(text) ? text : `${text}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function freshness(product, now = Date.now()) {
  const date = listingDate(product);
  if (!date) return { date: null, days: null, stale: false, label: "" };
  const days = Math.max(0, Math.floor((now - date.getTime()) / 86400000));
  const label =
    days === 0 ? "Updated today" :
    days === 1 ? "Updated yesterday" :
    days < 14 ? `Updated ${days} days ago` :
    days < 60 ? `Updated ${Math.round(days / 7)} weeks ago` :
    `Updated ${Math.round(days / 30)} months ago`;
  return { date, days, stale: days >= STALE_DAYS, label };
}
