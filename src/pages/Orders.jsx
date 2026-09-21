import { useCallback, useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const STATUS = {
  pending: { label: "Waiting for supplier", bg: "#fef3c7", color: "#b45309" },
  confirmed: { label: "Confirmed", bg: "#dcfce7", color: "#15803d" },
  cancelled: { label: "Declined", bg: "#fee2e2", color: "#b91c1c" }
};

const DELIVERY = {
  pending: "Not yet dispatched",
  processing: "Being prepared",
  shipped: "On the way",
  delivered: "Delivered"
};

function telHref(phone) {
  return `tel:${String(phone).replace(/[^\d+]/g, "")}`;
}

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload(n => n + 1), []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    async function load() {
      const { data, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (ordersError) {
        setError("We couldn't load your orders. Check your connection and try again.");
        setLoading(false);
        return;
      }

      const supplierIds = [...new Set((data || []).map(o => o.supplier_id).filter(Boolean))];
      let byId = {};
      if (supplierIds.length > 0) {
        const { data: profiles } = await supabase
          .from("supplier_profiles")
          .select("id, business_name, phone, whatsapp_number")
          .in("id", supplierIds);
        byId = Object.fromEntries((profiles || []).map(s => [s.id, s]));
      }

      if (cancelled) return;
      setSuppliers(byId);
      setOrders(data || []);
      setError("");
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user, reload]);

  useEffect(() => {
    if (!user) return undefined;
    const channel = supabase
      .channel("my-orders-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `buyer_id=eq.${user.id}` },
        refresh
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, refresh]);

  return (
    <div style={{ maxWidth: "760px" }}>
      <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
        My Orders
      </h1>
      <p style={{ marginTop: "6px", color: "#6b7280", fontSize: "15px" }}>
        Requests you've sent to suppliers. Suppliers contact you to arrange payment and delivery.
      </p>

      {error && (
        <div role="alert" style={{
          margin: "20px 0", padding: "14px 16px", borderRadius: "12px",
          background: "#fef2f2", color: "#b91c1c", fontSize: "14px",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap"
        }}>
          <span>{error}</span>
          <button
            onClick={() => { setError(""); setLoading(true); refresh(); }}
            style={{
              minHeight: "44px", padding: "0 18px", borderRadius: "10px",
              border: "1.5px solid #b91c1c", background: "#fff", color: "#b91c1c",
              fontWeight: "700", cursor: "pointer"
            }}
          >
            Try again
          </button>
        </div>
      )}

      {loading && !error && <p style={{ color: "#9ca3af", marginTop: "24px" }}>Loading your orders...</p>}

      {!loading && !error && orders.length === 0 && (
        <p style={{ color: "#6b7280", marginTop: "24px" }}>
          You haven't ordered anything yet. Add products from the Marketplace to send a request.
        </p>
      )}

      <div style={{ display: "grid", gap: "14px", marginTop: "24px" }}>
        {orders.map(o => {
          const s = STATUS[o.status] || STATUS.pending;
          const supplier = suppliers[o.supplier_id];
          const phone = supplier?.phone || supplier?.whatsapp_number;
          return (
            <div key={o.id} style={{
              background: "#fff", border: "1px solid #e5e7eb",
              borderRadius: "14px", padding: "18px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "16px", color: "#111827" }}>{o.product_name}</div>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
                    {o.quantity} × · KES {Number(o.total_price || 0).toLocaleString()}
                  </div>
                </div>
                <span style={{
                  alignSelf: "flex-start", padding: "4px 12px", borderRadius: "20px",
                  fontSize: "12px", fontWeight: "700", background: s.bg, color: s.color
                }}>
                  {s.label}
                </span>
              </div>

              <div style={{ marginTop: "10px", fontSize: "13px", color: "#374151" }}>
                Delivery: <b>{DELIVERY[o.delivery_status] || o.delivery_status}</b>
              </div>

              {supplier && (
                <div style={{
                  marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #f3f4f6",
                  display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap"
                }}>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>
                    Supplier: <b style={{ color: "#111827" }}>{supplier.business_name}</b>
                  </span>
                  {phone && (
                    <a href={telHref(phone)} style={{
                      display: "inline-flex", alignItems: "center", gap: "8px",
                      minHeight: "44px", padding: "0 16px", borderRadius: "10px",
                      background: "#f0fdf4", border: "1.5px solid #22c55e",
                      color: "#15803d", fontWeight: "700", fontSize: "13px", textDecoration: "none"
                    }}>
                      <Phone size={16} aria-hidden="true" /> Call {phone}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
