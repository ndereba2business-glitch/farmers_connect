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

// Optional top of a price range: must be a valid price above the from-price.
export function validatePriceMax(value, price) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const problem = validatePrice(text);
  if (problem) return problem;
  if (!validatePrice(price) && Number(text) <= Number(price)) return "The top of the range must be more than the price.";
  return "";
}

export function validateMinOrder(value) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (!/^\d+$/.test(text) || Number(text) < 1) return "Use a whole number of 1 or more, e.g. 5.";
  if (Number(text) > 1000000) return "That minimum looks too high.";
  return "";
}

// "Prevent false availability": the status and the numbers must agree.
export function validateAvailability({ availability, stock, min_order_qty }) {
  const qty = String(stock ?? "").trim() === "" ? null : Number(stock);
  const min = String(min_order_qty ?? "").trim() === "" ? null : Number(min_order_qty);
  if (availability === "in_stock" && qty === 0) {
    return "You entered 0 available. Choose Out of stock, or leave the quantity empty.";
  }
  if (availability === "out_of_stock" && qty > 0) {
    return `You entered ${qty} available but chose Out of stock. Change one of them.`;
  }
  if (availability === "in_stock" && qty > 0 && min > qty) {
    return `The minimum order (${min}) is more than you have available (${qty}).`;
  }
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
