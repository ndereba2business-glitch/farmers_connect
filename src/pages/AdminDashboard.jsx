import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Shield, Users, ShoppingBag, Egg, MessageSquare, Stethoscope, CheckCircle2, XCircle, Ban } from "lucide-react";

const VET_STATUS_META = {
  unverified: { bg: "#f3f4f6", color: "#6b7280", label: "Unverified" },
  pending: { bg: "#fef3c7", color: "#d97706", label: "Pending Review" },
  verified: { bg: "#dcfce7", color: "#16a34a", label: "Verified" },
  rejected: { bg: "#fee2e2", color: "#ef4444", label: "Rejected" },
  suspended: { bg: "#fee2e2", color: "#991b1b", label: "Suspended" },
};

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, products: 0, batches: 0, posts: 0, pendingVets: 0 });
  const [activeTab, setActiveTab] = useState("vets");
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [vetProfiles, setVetProfiles] = useState([]);
  const [vetFilter, setVetFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [updatingVetId, setUpdatingVetId] = useState(null);

  async function loadData() {
    setLoading(true);
    const [
      { data: profileData },
      { data: productData },
      { data: batchData },
      { count: posts },
      { data: vetData, error: vetError }
    ] = await Promise.all([
      supabase.from("farmer_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("farm_batches").select("*").order("created_at", { ascending: false }),
      supabase.from("community_posts").select("*", { count: "exact", head: true }),
      supabase.from("vet_profiles").select("*").order("created_at", { ascending: false })
    ]);

    if (vetError) console.error("AdminDashboard: failed to load vet profiles —", vetError.message);

    setUsers(profileData || []);
    setProducts(productData || []);
    setBatches(batchData || []);
    setVetProfiles(vetData || []);
    setStats({
      users: (profileData || []).length,
      products: (productData || []).length,
      batches: (batchData || []).length,
      posts: posts || 0,
      pendingVets: (vetData || []).filter(v => v.verification_status === "pending").length
    });
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function updateVetStatus(id, newStatus) {
    setUpdatingVetId(id);
    const { error } = await supabase
      .from("vet_profiles")
      .update({ verification_status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", id);

    setUpdatingVetId(null);

    if (error) {
      alert("Failed to update vet status: " + error.message);
      return;
    }
    loadData();
  }

  const statCards = [
    { title: "Total Users", value: stats.users, icon: Users, color: "#edf9f1", iconColor: "#22c55e" },
    { title: "Pending Vet Reviews", value: stats.pendingVets, icon: Stethoscope, color: "#fef3c7", iconColor: "#d97706" },
    { title: "Total Products", value: stats.products, icon: ShoppingBag, color: "#fff7e6", iconColor: "#f59e0b" },
    { title: "Chick Batches", value: stats.batches, icon: Egg, color: "#fff0eb", iconColor: "#f97316" },
    { title: "Community Posts", value: stats.posts, icon: MessageSquare, color: "#edf5ff", iconColor: "#3b82f6" },
  ];

  const filteredVets = vetFilter === "all"
    ? vetProfiles
    : vetProfiles.filter(v => v.verification_status === vetFilter);

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
        padding: "4px", marginBottom: "20px", width: "fit-content", flexWrap: "wrap"
      }}>
        {["vets", "users", "products", "batches"].map(tab => (
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
              textTransform: "capitalize", transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: "6px"
            }}
          >
            {tab === "vets" && stats.pendingVets > 0 && (
              <span style={{
                background: "#ef4444", color: "#fff", fontSize: "10px", fontWeight: "800",
                width: "16px", height: "16px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {stats.pendingVets}
              </span>
            )}
            {tab}
          </button>
        ))}
      </div>

      {/* ═══════════ VETS TAB ═══════════ */}
      {activeTab === "vets" && (
        <div>
          {/* SUB-FILTER */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {["pending", "verified", "rejected", "suspended", "all"].map(f => (
              <button
                key={f}
                onClick={() => setVetFilter(f)}
                style={{
                  padding: "6px 14px", borderRadius: "20px",
                  border: `1.5px solid ${vetFilter === f ? "#111827" : "#e5e7eb"}`,
                  background: vetFilter === f ? "#111827" : "#fff",
                  color: vetFilter === f ? "#fff" : "#6b7280",
                  fontWeight: "600", fontSize: "12px", cursor: "pointer",
                  textTransform: "capitalize"
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {filteredVets.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "#fff", borderRadius: "20px", border: "1px solid #f0f0f0"
            }}>
              <Stethoscope size={48} color="#e5e7eb" style={{ marginBottom: "12px" }} />
              <p style={{ color: "#9ca3af", fontSize: "14px" }}>
                No {vetFilter !== "all" ? vetFilter : ""} vet profiles.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredVets.map(vet => {
                const meta = VET_STATUS_META[vet.verification_status] || VET_STATUS_META.unverified;
                const busy = updatingVetId === vet.id;
                return (
                  <div key={vet.id} style={{
                    background: "#fff", borderRadius: "16px",
                    border: "1px solid #e5e7eb", padding: "18px 20px",
                    boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "flex-start", flexWrap: "wrap", gap: "14px"
                    }}>
                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: "700", fontSize: "15px", color: "#111827" }}>
                            {vet.full_name}
                          </span>
                          <span style={{
                            fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                            borderRadius: "20px", background: meta.bg, color: meta.color
                          }}>
                            {meta.label}
                          </span>
                        </div>
                        <div style={{ fontSize: "13px", color: "#6b7280", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {vet.license_number && <span>🪪 License: {vet.license_number}</span>}
                          {vet.service_counties?.length > 0 && (
                            <span>📍 {vet.service_counties.join(", ")}</span>
                          )}
                          {vet.specializations?.length > 0 && (
                            <span>🩺 {vet.specializations.join(", ")}</span>
                          )}
                          {vet.accepts_emergency && (
                            <span style={{ color: "#ef4444", fontWeight: "600" }}>🚨 Accepts emergencies</span>
                          )}
                          {vet.bio && (
                            <p style={{ margin: "6px 0 0", color: "#9ca3af", fontStyle: "italic" }}>
                              "{vet.bio}"
                            </p>
                          )}
                        </div>
                      </div>

                      {/* ACTIONS */}
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        {(vet.verification_status === "pending" || vet.verification_status === "unverified") && (
                          <>
                            <button
                              disabled={busy}
                              onClick={() => updateVetStatus(vet.id, "verified")}
                              style={{
                                display: "flex", alignItems: "center", gap: "6px",
                                padding: "8px 14px", background: "#16a34a", color: "#fff",
                                border: "none", borderRadius: "8px", fontWeight: "700",
                                fontSize: "12px", cursor: busy ? "not-allowed" : "pointer"
                              }}
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => updateVetStatus(vet.id, "rejected")}
                              style={{
                                display: "flex", alignItems: "center", gap: "6px",
                                padding: "8px 14px", background: "#fff", color: "#ef4444",
                                border: "1px solid #fecaca", borderRadius: "8px", fontWeight: "700",
                                fontSize: "12px", cursor: busy ? "not-allowed" : "pointer"
                              }}
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </>
                        )}
                        {vet.verification_status === "verified" && (
                          <button
                            disabled={busy}
                            onClick={() => updateVetStatus(vet.id, "suspended")}
                            style={{
                              display: "flex", alignItems: "center", gap: "6px",
                              padding: "8px 14px", background: "#fff", color: "#991b1b",
                              border: "1px solid #fecaca", borderRadius: "8px", fontWeight: "700",
                              fontSize: "12px", cursor: busy ? "not-allowed" : "pointer"
                            }}
                          >
                            <Ban size={14} /> Suspend
                          </button>
                        )}
                        {(vet.verification_status === "rejected" || vet.verification_status === "suspended") && (
                          <button
                            disabled={busy}
                            onClick={() => updateVetStatus(vet.id, "pending")}
                            style={{
                              padding: "8px 14px", background: "#f9fafb", color: "#374151",
                              border: "1px solid #e5e7eb", borderRadius: "8px", fontWeight: "600",
                              fontSize: "12px", cursor: busy ? "not-allowed" : "pointer"
                            }}
                          >
                            Move to Pending
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════ USERS TABLE ═══════════ */}
      {activeTab === "users" && (
        <div style={{
          background: "#fff", borderRadius: "20px",
          border: "1px solid #e5e7eb",
          boxShadow: "0 4px 16px rgba(0,0,0,0.04)", overflow: "hidden"
        }}>
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
        </div>
      )}

      {/* ═══════════ PRODUCTS TABLE ═══════════ */}
      {activeTab === "products" && (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "20px", border: "1px solid #e5e7eb", boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
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

      {/* ═══════════ BATCHES TABLE ═══════════ */}
      {activeTab === "batches" && (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: "20px", border: "1px solid #e5e7eb", boxShadow: "0 4px 16px rgba(0,0,0,0.04)" }}>
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
  );
}