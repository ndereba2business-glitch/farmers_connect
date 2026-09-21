import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Phone } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const STATUS = {
  pending: { label: "New request", bg: "#fef3c7", color: "#b45309" },
  confirmed: { label: "Confirmed", bg: "#dcfce7", color: "#15803d" },
  cancelled: { label: "Declined", bg: "#fee2e2", color: "#b91c1c" }
};

const DELIVERY_STEPS = [
  { value: "processing", label: "Preparing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" }
];

const actionBtn = (primary) => ({
  minHeight: "44px", padding: "0 16px", borderRadius: "10px",
  border: primary ? "none" : "1.5px solid #d1d5db",
  background: primary ? "linear-gradient(135deg,#22c55e,#16a34a)" : "#fff",
  color: primary ? "#fff" : "#374151",
  fontWeight: "700", fontSize: "13px", cursor: "pointer"
});

function telHref(phone) {
  return `tel:${String(phone).replace(/[^\d+]/g, "")}`;
}

export default function SupplierOrders() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(undefined);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload(n => n + 1), []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    async function load() {
      const { data: prof, error: profError } = await supabase
        .from("supplier_profiles")
        .select("id, business_name, verification_status")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (profError) {
        setError("We couldn't load your supplier account. Check your connection and try again.");
        setLoading(false);
        return;
      }
      setProfile(prof || null);

      if (!prof) {
        setLoading(false);
        return;
      }

      const { data, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .eq("supplier_id", prof.id)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (ordersError) {
        setError("We couldn't load your orders. Check your connection and try again.");
        setLoading(false);
        return;
      }

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
      .channel("supplier-orders-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [user, refresh]);

  async function update(id, changes) {
    setBusyId(id);
    const { error: updateError } = await supabase.from("orders").update(changes).eq("id", id);
    setBusyId(null);

    if (updateError) {
      setError("That change didn't save: " + updateError.message);
      return;
    }
    setError("");
    refresh();
  }

  if (loading) {
    return <p style={{ color: "#9ca3af" }}>Loading your orders...</p>;
  }

  if (profile === null) {
    return (
      <div style={{ maxWidth: "560px" }}>
        <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827" }}>Supplier Orders</h1>
        <p style={{ color: "#6b7280", margin: "12px 0 20px" }}>
          Set up your supplier profile first. Once an admin verifies it, your products can be
          ordered and requests appear here.
        </p>
        <Link to="/supplier-profile" style={{ ...actionBtn(true), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
          Set up supplier profile
        </Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "820px" }}>
      <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
        Supplier Orders
      </h1>
      <p style={{ marginTop: "6px", color: "#6b7280", fontSize: "15px" }}>
        Order requests for {profile.business_name}. Call the buyer to arrange payment and delivery.
      </p>

      {profile.verification_status !== "verified" && (
        <div role="status" style={{
          margin: "16px 0", padding: "14px 16px", borderRadius: "12px",
          background: "#fffbeb", color: "#92400e", fontSize: "14px"
        }}>
          Your supplier profile is <b>{profile.verification_status}</b>. Farmers can only order from
          verified suppliers, so no requests will arrive until an admin approves it.
        </div>
      )}

      {error && (
        <div role="alert" style={{
          margin: "16px 0", padding: "14px 16px", borderRadius: "12px",
          background: "#fef2f2", color: "#b91c1c", fontSize: "14px",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap"
        }}>
          <span>{error}</span>
          <button onClick={() => { setError(""); refresh(); }} style={actionBtn(false)}>Try again</button>
        </div>
      )}

      {orders.length === 0 && !error && (
        <p style={{ color: "#6b7280", marginTop: "24px" }}>No order requests yet.</p>
      )}

      <div style={{ display: "grid", gap: "14px", marginTop: "24px" }}>
        {orders.map(o => {
          const s = STATUS[o.status] || STATUS.pending;
          const busy = busyId === o.id;
          return (
            <div key={o.id} style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "18px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontWeight: "700", fontSize: "16px", color: "#111827" }}>
                    {o.quantity} × {o.product_name}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>
                    KES {Number(o.total_price || 0).toLocaleString()} · you receive KES{" "}
                    {Number(o.supplier_earnings || 0).toLocaleString()}
                  </div>
                </div>
                <span style={{
                  alignSelf: "flex-start", padding: "4px 12px", borderRadius: "20px",
                  fontSize: "12px", fontWeight: "700", background: s.bg, color: s.color
                }}>
                  {s.label}
                </span>
              </div>

              <div style={{
                marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #f3f4f6",
                display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap"
              }}>
                <span style={{ fontSize: "13px", color: "#6b7280" }}>
                  <b style={{ color: "#111827" }}>{o.customer_name}</b> · {o.county}
                </span>
                {o.customer_phone && (
                  <a href={telHref(o.customer_phone)} style={{
                    display: "inline-flex", alignItems: "center", gap: "8px",
                    minHeight: "44px", padding: "0 16px", borderRadius: "10px",
                    background: "#f0fdf4", border: "1.5px solid #22c55e",
                    color: "#15803d", fontWeight: "700", fontSize: "13px", textDecoration: "none"
                  }}>
                    <Phone size={16} aria-hidden="true" /> Call {o.customer_phone}
                  </a>
                )}
              </div>

              <div style={{ marginTop: "12px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {o.status === "pending" && (
                  <>
                    <button disabled={busy} onClick={() => update(o.id, { status: "confirmed" })} style={actionBtn(true)}>
                      Confirm order
                    </button>
                    <button disabled={busy} onClick={() => update(o.id, { status: "cancelled" })} style={actionBtn(false)}>
                      Decline
                    </button>
                  </>
                )}
                {o.status === "confirmed" && DELIVERY_STEPS.map(step => (
                  <button
                    key={step.value}
                    disabled={busy || o.delivery_status === step.value}
                    onClick={() => update(o.id, { delivery_status: step.value })}
                    style={{
                      ...actionBtn(o.delivery_status === step.value),
                      opacity: busy ? 0.6 : 1
                    }}
                  >
                    {o.delivery_status === step.value ? `✓ ${step.label}` : step.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
