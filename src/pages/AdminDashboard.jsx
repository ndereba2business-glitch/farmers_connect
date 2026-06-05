import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Shield, Users, ShoppingBag, Egg, MessageSquare } from "lucide-react";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, products: 0, batches: 0, posts: 0 });
  const [activeTab, setActiveTab] = useState("users");
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      const [
        { data: profileData },
        { data: productData },
        { data: batchData },
        { count: posts }
      ] = await Promise.all([
        supabase.from("farmer_profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("farm_batches").select("*").order("created_at", { ascending: false }),
        supabase.from("community_posts").select("*", { count: "exact", head: true })
      ]);

      setUsers(profileData || []);
      setProducts(productData || []);
      setBatches(batchData || []);
      setStats({
        users: (profileData || []).length,
        products: (productData || []).length,
        batches: (batchData || []).length,
        posts: posts || 0
      });
      setLoading(false);
    }
    loadData();
  }, []);

  const statCards = [
    { title: "Total Users", value: stats.users, icon: Users, color: "#edf9f1", iconColor: "#22c55e" },
    { title: "Total Products", value: stats.products, icon: ShoppingBag, color: "#fff7e6", iconColor: "#f59e0b" },
    { title: "Chick Batches", value: stats.batches, icon: Egg, color: "#fff0eb", iconColor: "#f97316" },
    { title: "Community Posts", value: stats.posts, icon: MessageSquare, color: "#edf5ff", iconColor: "#3b82f6" },
  ];

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <Shield size={28} color="#22c55e" />
        <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
          Admin Dashboard
        </h1>
      </div>
      <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "28px" }}>
        Platform overview and management
      </p>

      {/* STAT CARDS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "16px", marginBottom: "28px"
      }}>
        {statCards.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.title} style={{
              background: "#fff", borderRadius: "20px", padding: "20px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
              display: "flex", alignItems: "center", gap: "16px"
            }}>
              <div style={{
                width: "52px", height: "52px", borderRadius: "16px",
                background: item.color, display: "flex",
                alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <Icon size={24} color={item.iconColor} />
              </div>
              <div>
                <div style={{ fontSize: "28px", fontWeight: "800", color: "#111827" }}>
                  {loading ? "—" : item.value}
                </div>
                <div style={{ fontSize: "13px", color: "#6b7280", fontWeight: "500" }}>
                  {item.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* TABS */}
      <div style={{
        display: "flex", gap: "4px",
        background: "#f3f4f6", borderRadius: "12px",
        padding: "4px", marginBottom: "20px", width: "fit-content"
      }}>
        {["users", "products", "batches"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 20px", borderRadius: "9px",
              border: "none", cursor: "pointer",
              fontWeight: "600", fontSize: "13px",
              background: activeTab === tab ? "#fff" : "transparent",
              color: activeTab === tab ? "#111827" : "#9ca3af",
              boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              textTransform: "capitalize", transition: "all 0.2s"
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* TABLE */}
      <div style={{
        background: "#fff", borderRadius: "20px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 4px 16px rgba(0,0,0,0.04)", overflow: "hidden"
      }}>
        {/* USERS TABLE */}
        {activeTab === "users" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                {["Name", "Email", "Role", "Joined"].map(h => (
                  <th key={h} style={{
                    padding: "14px 20px", textAlign: "left",
                    fontSize: "12px", fontWeight: "600",
                    color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em"
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
                    No users yet.
                  </td>
                </tr>
              ) : users.map((user, i) => (
                <tr key={user.id} style={{
                  borderBottom: i < users.length - 1 ? "1px solid #f9f9f9" : "none",
                  transition: "background 0.15s"
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "14px 20px", fontWeight: "600", fontSize: "14px", color: "#111827" }}>
                    {user.full_name || "—"}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: "14px", color: "#6b7280" }}>
                    {user.user_email}
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{
                      background: "#dcfce7", color: "#16a34a",
                      fontSize: "12px", fontWeight: "700",
                      padding: "3px 10px", borderRadius: "20px"
                    }}>
                      {user.role || "farmer"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: "14px", color: "#6b7280" }}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* PRODUCTS TABLE */}
        {activeTab === "products" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                {["Title", "Category", "Price", "Seller", "Status"].map(h => (
                  <th key={h} style={{
                    padding: "14px 20px", textAlign: "left",
                    fontSize: "12px", fontWeight: "600",
                    color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em"
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
                    No products yet.
                  </td>
                </tr>
              ) : products.map((product, i) => (
                <tr key={product.id} style={{
                  borderBottom: i < products.length - 1 ? "1px solid #f9f9f9" : "none"
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "14px 20px", fontWeight: "600", fontSize: "14px", color: "#111827" }}>
                    {product.product_name}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: "14px", color: "#6b7280" }}>
                    {product.category}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: "14px", fontWeight: "600", color: "#22c55e" }}>
                    KES {Number(product.price).toLocaleString()}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: "14px", color: "#6b7280" }}>
                    {product.supplier_name || "—"}
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{
                      background: product.sold_out ? "#fee2e2" : "#dcfce7",
                      color: product.sold_out ? "#ef4444" : "#16a34a",
                      fontSize: "12px", fontWeight: "700",
                      padding: "3px 10px", borderRadius: "20px"
                    }}>
                      {product.sold_out ? "sold out" : "active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* BATCHES TABLE */}
        {activeTab === "batches" && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f3f4f6" }}>
                {["Batch Name", "Type", "Quantity", "Farmer", "Status"].map(h => (
                  <th key={h} style={{
                    padding: "14px 20px", textAlign: "left",
                    fontSize: "12px", fontWeight: "600",
                    color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em"
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
                    No batches yet.
                  </td>
                </tr>
              ) : batches.map((batch, i) => (
                <tr key={batch.id} style={{
                  borderBottom: i < batches.length - 1 ? "1px solid #f9f9f9" : "none"
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "#fafafa"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "14px 20px", fontWeight: "600", fontSize: "14px", color: "#111827" }}>
                    {batch.batch_name}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: "14px", color: "#6b7280" }}>
                    {batch.batch_type}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: "14px", color: "#6b7280" }}>
                    {batch.quantity}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: "14px", color: "#6b7280" }}>
                    {batch.user_email}
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{
                      background: batch.status === "active" ? "#dcfce7" : "#f3f4f6",
                      color: batch.status === "active" ? "#16a34a" : "#9ca3af",
                      fontSize: "12px", fontWeight: "700",
                      padding: "3px 10px", borderRadius: "20px"
                    }}>
                      {batch.status || "active"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}