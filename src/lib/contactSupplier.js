import { supabase } from "./supabaseClient";
import { AVAILABILITY, minOrderText, priceText, unitWord } from "./productListing";

// Kenyan numbers as international digits for tel: and wa.me links:
// "0712 345 678" / "+254712345678" / "254712345678" -> "254712345678".
// Returns "" when it isn't a usable number.
export function intlDigits(phone) {
  let digits = String(phone || "").replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  if (digits.startsWith("0")) digits = "254" + digits.slice(1);
  return digits.length >= 9 && digits.length <= 15 ? digits : "";
}

export function telHref(phone) {
  const digits = intlDigits(phone);
  return digits ? `tel:+${digits}` : "";
}

export function whatsappHref(phone, message) {
  const digits = intlDigits(phone);
  if (!digits) return "";
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

// Pre-written WhatsApp message carrying the product's context, so the
// supplier knows exactly which listing the farmer means.
export function productMessage(product) {
  const place = [product.location_details, product.county].filter(Boolean).join(", ");
  const status = AVAILABILITY[product.availability]?.label;
  const optional = [
    status ? `Listed as: ${status}` : null,
    minOrderText(product) || null,
    place ? `Location: ${place}` : null
  ].filter(Boolean);
  return [
    "Hello! I found your listing on Farmers Connect.",
    "",
    `Product: *${product.product_name}*`,
    `Price: ${priceText(product)} per ${unitWord(product.unit)}`,
    ...optional,
    "",
    "Is it still available? I'd like to know the price and delivery options."
  ].join("\n");
}

export function supplierMessage(supplier) {
  return `Hello ${supplier.business_name}! I found you in the Farmers Connect supplier directory. ` +
    "I'd like to ask about your products, prices and delivery.";
}

// Records that a farmer started a call or WhatsApp chat. Fire and forget:
// it must never delay or block the contact itself, and a same-day repeat
// (unique index) is simply already counted. Nobody can read these rows;
// suppliers only ever see counts.
export function recordContact({ productId = null, supplierId = null, channel }) {
  supabase
    .from("contact_events")
    .insert({ product_id: productId, supplier_id: productId ? null : supplierId, channel })
    .then(() => {}, () => {});
}
