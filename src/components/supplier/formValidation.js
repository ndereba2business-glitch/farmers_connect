// Kenyan numbers are entered as 07.., 01.., +2547.. or 2547..; allow spaces
// and dashes, then require 9-15 digits.
export function validatePhone(value, { required = false } = {}) {
  const text = String(value || "").trim();
  if (!text) return required ? "Enter a phone number farmers can call." : "";
  if (!/^\+?[\d\s-]+$/.test(text)) return "Use digits only, e.g. 0712 345 678.";
  const digits = text.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return "That doesn't look like a full phone number.";
  return "";
}

export function validatePrice(value) {
  const text = String(value ?? "").trim();
  if (!text) return "Enter a price.";
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return "Use numbers only, e.g. 3200 or 3200.50.";
  const n = Number(text);
  if (n <= 0) return "Price must be more than 0.";
  if (n > 10000000) return "That price looks too high. Check the amount.";
  return "";
}

export function validateStock(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (!/^\d+$/.test(text)) return "Use a whole number, e.g. 40.";
  if (Number(text) > 10000000) return "That quantity looks too high.";
  return "";
}

export function required(value, message) {
  return String(value || "").trim() ? "" : message;
}

export function maxLength(value, max, label) {
  return String(value || "").trim().length > max ? `${label} must be ${max} characters or fewer.` : "";
}

export function firstError(errors) {
  return Object.keys(errors).find(key => errors[key]);
}
