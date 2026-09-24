import { parseDbDate } from "./supplierFormat";
import { productStatus } from "./useSupplierProducts";

// Keeps "3 × Layers Mash" from wrapping between the quantity and the name.
const NBSP = String.fromCharCode(160);

// Every number here is derived from columns that exist today:
//   products.is_active / sold_out, orders.status / delivery_status /
//   supplier_earnings (orders only when in-app ordering is on).
//
// Definitions (kept explicit so the UI never overstates anything):
//   active products   = visible to farmers and not sold out
//   out of stock      = visible to farmers, marked sold out
//   inactive          = hidden from farmers by the supplier
//   pending requests  = order requests still waiting for the supplier
//                       (Contact Seller only opens WhatsApp/phone, so no
//                       inquiry is ever stored to count)
//   earned            = supplier_earnings on confirmed, delivered orders
export function computeOverview(products, orders) {
  const statuses = products.map(p => productStatus(p).key);
  const delivered = orders.filter(o => o.status === "confirmed" && o.delivery_status === "delivered");

  return {
    totalProducts: products.length,
    activeProducts: statuses.filter(s => s === "active").length,
    outOfStock: statuses.filter(s => s === "soldOut").length,
    inactive: statuses.filter(s => s === "inactive").length,
    pendingRequests: orders.filter(o => o.status === "pending").length,
    inProgress: orders.filter(o => o.status === "confirmed" && o.delivery_status !== "delivered").length,
    delivered: delivered.length,
    earned: delivered.reduce((sum, o) => sum + Number(o.supplier_earnings || 0), 0)
  };
}

export function orderStatusLabel(order) {
  if (order.status === "cancelled") return { label: "Declined", tone: "red" };
  if (order.status === "confirmed") {
    return order.delivery_status === "delivered"
      ? { label: "Delivered", tone: "green" }
      : { label: "Confirmed", tone: "blue" };
  }
  return { label: "Waiting for you", tone: "amber" };
}

// The schema records when a product was listed and when an order request
// arrived, but not when a product was edited, so the feed only shows those
// two kinds of event.
export function buildActivity(products, orders, limit = 8) {
  const events = [];

  for (const p of products) {
    const at = parseDbDate(p.created_at);
    if (at) {
      events.push({
        id: `product-${p.id}`,
        kind: "product",
        at,
        title: p.product_name,
        detail: "Listed on the marketplace"
      });
    }
  }

  for (const o of orders) {
    const at = parseDbDate(o.created_at);
    if (at) {
      events.push({
        id: `order-${o.id}`,
        kind: "order",
        at,
        title: `${o.customer_name || "A buyer"} requested ${o.quantity}${NBSP}×${NBSP}${o.product_name}`,
        status: orderStatusLabel(o)
      });
    }
  }

  return events.sort((a, b) => b.at - a.at).slice(0, limit);
}
