import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

const linkBtn = (primary) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center",
  minHeight: "44px", padding: "0 18px", borderRadius: "10px",
  textDecoration: "none", fontWeight: "700", fontSize: "14px",
  border: primary ? "none" : "1.5px solid #22c55e",
  background: primary ? "linear-gradient(135deg,#22c55e,#16a34a)" : "#f0fdf4",
  color: primary ? "#fff" : "#15803d"
});

function Stat({ label, value }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "14px", padding: "16px" }}>
      <div style={{ fontSize: "26px", fontWeight: "800", color: "#111827" }}>{value}</div>
      <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "2px" }}>{label}</div>
    </div>
  );
}

export default function SupplierDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState(null);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
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
        setError("We couldn't load your dashboard. Check your connection and try again.");
        setLoading(false);
        return;
      }
      setProfile(prof || null);

      if (prof) {
        const [ordersRes, productsRes] = await Promise.all([
          supabase.from("orders")
            .select("id, status, delivery_status, supplier_earnings")
            .eq("supplier_id", prof.id),
          supabase.from("products")
            .select("id, product_name, price, stock, sold_out")
            .eq("supplier_id", prof.id)
            .order("created_at", { ascending: false })
        ]);

        if (cancelled) return;
        if (ordersRes.error || productsRes.error) {
          setError("We couldn't load all of your data. Check your connection and try again.");
          setLoading(false);
          return;
        }
        setOrders(ordersRes.data || []);
        setProducts(productsRes.data || []);
      }

      setError("");
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user, reload]);

  async function toggleSoldOut(product) {
    setBusyId(product.id);
    const { error: updateError } = await supabase
      .from("products")
      .update({ sold_out: !product.sold_out })
      .eq("id", product.id);
    setBusyId(null);
    if (updateError) {
      setError("That change didn't save: " + updateError.message);
      return;
    }
    refresh();
  }

  if (loading) return <p style={{ color: "#9ca3af" }}>Loading your dashboard...</p>;

  if (error && !profile) {
    return (
      <div role="alert" style={{ padding: "14px 16px", borderRadius: "12px", background: "#fef2f2", color: "#b91c1c", maxWidth: "560px" }}>
        {error}{" "}
        <button onClick={() => { setError(""); setLoading(true); refresh(); }} style={{ minHeight: "44px", padding: "0 16px", marginLeft: "8px", borderRadius: "10px", border: "1.5px solid #b91c1c", background: "#fff", color: "#b91c1c", fontWeight: "700", cursor: "pointer" }}>
          Try again
        </button>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ maxWidth: "560px" }}>
        <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>Welcome</h1>
        <p style={{ color: "#6b7280", margin: "12px 0 20px" }}>
          Set up your supplier profile to start. Once an admin verifies it, farmers can find and
          order your products.
        </p>
        <Link to="/supplier-profile" style={linkBtn(true)}>Set up supplier profile</Link>
      </div>
    );
  }

  const isVerified = profile.verification_status === "verified";
  const newRequests = orders.filter(o => o.status === "pending").length;
  const inProgress = orders.filter(o => o.status === "confirmed" && o.delivery_status !== "delivered").length;
  const delivered = orders.filter(o => o.status === "confirmed" && o.delivery_status === "delivered");
  const earned = delivered.reduce((sum, o) => sum + Number(o.supplier_earnings || 0), 0);

  return (
    <div style={{ maxWidth: "820px" }}>
      <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
        {profile.business_name}
      </h1>

      <div role="status" style={{
        margin: "14px 0 20px", padding: "12px 16px", borderRadius: "12px", fontSize: "14px",
        background: isVerified ? "#f0fdf4" : "#fffbeb", color: isVerified ? "#166534" : "#92400e"
      }}>
        {isVerified
          ? "Your profile is verified. Farmers can order your products."
          : `Your profile is ${profile.verification_status}. Farmers can order from you once an admin verifies it.`}
      </div>

      {error && (
        <div role="alert" style={{ marginBottom: "16px", padding: "12px 14px", borderRadius: "10px", background: "#fef2f2", color: "#b91c1c", fontSize: "14px" }}>
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px" }}>
        <Stat label="New requests" value={newRequests} />
        <Stat label="In progress" value={inProgress} />
        <Stat label="Delivered" value={delivered.length} />
        <Stat label="Earned from delivered (KES)" value={earned.toLocaleString()} />
      </div>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", margin: "20px 0 28px" }}>
        <Link to="/supplier-orders" style={linkBtn(true)}>
          {newRequests > 0 ? `View ${newRequests} new request${newRequests !== 1 ? "s" : ""}` : "View orders"}
        </Link>
        <Link to="/marketplace" style={linkBtn(false)}>List a product</Link>
        <Link to="/supplier-profile" style={linkBtn(false)}>Edit profile</Link>
      </div>

      <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#111827", margin: "0 0 12px" }}>Your products</h2>
      {products.length === 0 ? (
        <p style={{ color: "#6b7280" }}>You haven't listed any products yet. Use "List a product" to add one.</p>
      ) : (
        <div style={{ display: "grid", gap: "10px" }}>
          {products.map(p => (
            <div key={p.id} style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px 16px",
              display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap"
            }}>
              <div>
                <div style={{ fontWeight: "700", color: "#111827" }}>{p.product_name}</div>
                <div style={{ fontSize: "13px", color: "#6b7280" }}>
                  KES {Number(p.price || 0).toLocaleString()}{p.stock > 0 ? ` · ${p.stock} in stock` : ""}
                </div>
              </div>
              <button
                disabled={busyId === p.id}
                onClick={() => toggleSoldOut(p)}
                style={{
                  minHeight: "44px", padding: "0 16px", borderRadius: "10px", fontWeight: "700", fontSize: "13px", cursor: "pointer",
                  border: "1.5px solid " + (p.sold_out ? "#22c55e" : "#d1d5db"),
                  background: p.sold_out ? "#f0fdf4" : "#fff", color: p.sold_out ? "#15803d" : "#374151"
                }}
              >
                {p.sold_out ? "Mark available" : "Mark sold out"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
