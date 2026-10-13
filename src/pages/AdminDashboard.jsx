import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import CommunityModeration from "../components/CommunityModeration";
import CluckyUsage from "../components/CluckyUsage";
import AdminListings from "../components/AdminListings";
import AdminRequests from "../components/AdminRequests";
import { Shield, Users, ShoppingBag, Egg, MessageSquare, Stethoscope, Store, CheckCircle2, XCircle, Ban, PhoneCall, IdCard, MapPin, Siren, Package, Phone, Truck
} from "lucide-react";

const VET_STATUS_META = {
  unverified: { bg: "var(--fc-bg-gray100)", color: "var(--fc-fg-gray500)", label: "Unverified" },
  pending: { bg: "var(--fc-bg-amber100)", color: "var(--fc-fg-amber600)", label: "Pending Review" },
  verified: { bg: "var(--fc-bg-green100)", color: "var(--fc-fg-green700)", label: "Verified" },
  rejected: { bg: "var(--fc-bg-red100)", color: "var(--fc-fg-red500)", label: "Rejected" },
  suspended: { bg: "var(--fc-bg-red100)", color: "var(--fc-fg-red800)", label: "Suspended" },
};

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, products: 0, batches: 0, posts: 0, pendingVets: 0, pendingSuppliers: 0, contactFarmers: 0, contactSuppliers: 0 });
  const [activeTab, setActiveTab] = useState("vets");
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [batches, setBatches] = useState([]);
  const [vetProfiles, setVetProfiles] = useState([]);
  const [vetFilter, setVetFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [updatingVetId, setUpdatingVetId] = useState(null);
  const [supplierProfiles, setSupplierProfiles] = useState([]);
  const [supplierFilter, setSupplierFilter] = useState("pending");
  const [updatingSupplierId, setUpdatingSupplierId] = useState(null);
  const [openReports, setOpenReports] = useState(0);

  // The badge on the Community tab, before that tab has been opened.
  useEffect(() => {
    let cancelled = false;
    supabase.from("community_reports").select("id", { count: "exact", head: true }).eq("status", "open")
      .then(({ count }) => { if (!cancelled) setOpenReports(count || 0); });
    return () => { cancelled = true; };
  }, []);

  async function loadData() {
    setLoading(true);
    const [
      { data: profileData },
      { data: productData },
      { data: batchData },
      { count: posts },
      { data: vetData, error: vetError },
      { data: supplierData, error: supplierError },
      { data: contactData }
    ] = await Promise.all([
      supabase.from("farmer_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("farm_batches").select("*").order("created_at", { ascending: false }),
      supabase.from("community_chat").select("id", { count: "exact", head: true }).is("removed_at", null),
      supabase.from("vet_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("supplier_profiles").select("*").order("created_at", { ascending: false }),
      // counts only; admin-checked in the database
      supabase.rpc("admin_contact_stats", { p_days: 30 })
    ]);

    if (vetError) console.error("AdminDashboard: failed to load vet profiles —", vetError.message);
    if (supplierError) console.error("AdminDashboard: failed to load supplier profiles —", supplierError.message);
    setSupplierProfiles(supplierData || []);

    setUsers(profileData || []);
    setProducts(productData || []);
    setBatches(batchData || []);
    setVetProfiles(vetData || []);
    setStats({
      users: (profileData || []).length,
      products: (productData || []).length,
      batches: (batchData || []).length,
      posts: posts || 0,
      pendingVets: (vetData || []).filter(v => v.verification_status === "pending").length,
      pendingSuppliers: (supplierData || []).filter(s => s.verification_status === "pending").length,
      contactFarmers: Number(contactData?.[0]?.farmers || 0),
      contactSuppliers: Number(contactData?.[0]?.suppliers || 0)
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

  async function updateSupplierStatus(id, newStatus) {
    setUpdatingSupplierId(id);
    const { error } = await supabase
      .from("supplier_profiles")
      .update({ verification_status: newStatus })
      .eq("id", id);

    setUpdatingSupplierId(null);

    if (error) {
      alert("Failed to update supplier status: " + error.message);
      return;
    }
    loadData();
  }

  const statCards = [
    { title: "Total Users", value: stats.users, icon: Users, color: "var(--fc-bg-green51)", iconColor: "var(--fc-fg-green700)" },
    {
      title: `Farmers who contacted a supplier (30 days) · ${stats.contactSuppliers} supplier${stats.contactSuppliers === 1 ? "" : "s"} reached`,
      value: stats.contactFarmers, icon: PhoneCall, color: "var(--fc-bg-blue50)", iconColor: "var(--fc-fg-blue700)"
    },
    { title: "Pending Vet Reviews", value: stats.pendingVets, icon: Stethoscope, color: "var(--fc-bg-amber100)", iconColor: "var(--fc-fg-amber600)" },
    { title: "Pending Supplier Reviews", value: stats.pendingSuppliers, icon: Store, color: "var(--fc-bg-amber100)", iconColor: "var(--fc-fg-amber600)" },
    { title: "Total Products", value: stats.products, icon: ShoppingBag, color: "var(--fc-bg-amber52)", iconColor: "var(--fc-fg-amber500)" },
    { title: "Chick Batches", value: stats.batches, icon: Egg, color: "var(--fc-bg-red52)", iconColor: "var(--fc-fg-amber501)" },
    { title: "Community Messages", value: stats.posts, icon: MessageSquare, color: "var(--fc-bg-blue51)", iconColor: "var(--fc-fg-blue500)" },
  ];

  const filteredVets = vetFilter === "all"
    ? vetProfiles
    : vetProfiles.filter(v => v.verification_status === vetFilter);

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <Shield size={28} color="var(--fc-fg-green700)" />
        <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "700", color: "var(--fc-fg-gray900)", letterSpacing: "-1px" }}>
          Admin Dashboard
        </h1>
      </div>
      <p style={{ color: "var(--fc-fg-gray500)", fontSize: "14px", marginBottom: "28px" }}>
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
              background: "var(--fc-bg-gray0)", borderRadius: "16px", padding: "20px",
              border: "1px solid var(--fc-line-gray200)",
              boxShadow: "var(--fc-shadow-card)",
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
                <div style={{ fontSize: "28px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
                  {loading ? "—" : item.value}
                </div>
                <div style={{ fontSize: "13px", color: "var(--fc-fg-gray500)", fontWeight: "500" }}>
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
        background: "var(--fc-bg-gray100)", borderRadius: "12px",
        padding: "4px", marginBottom: "20px", width: "fit-content", flexWrap: "wrap"
      }}>
        {["vets", "suppliers", "community", "requests", "clucky", "users", "products", "batches"].map(tab => (
          <button
            key={tab}
            className="fc-tap"
            aria-pressed={activeTab === tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 20px", borderRadius: "8px",
              border: "none", cursor: "pointer",
              fontWeight: "600", fontSize: "13px",
              background: activeTab === tab ? "var(--fc-bg-gray0)" : "transparent",
              color: activeTab === tab ? "var(--fc-fg-gray900)" : "var(--fc-fg-gray400)",
              boxShadow: activeTab === tab ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              textTransform: "capitalize", transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: "6px"
            }}
          >
            {tab === "vets" && stats.pendingVets > 0 && (
              <span style={{
                background: "#dc2626", color: "var(--fc-fg-gray0)", fontSize: "10px", fontWeight: "700",
                width: "16px", height: "16px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {stats.pendingVets}
              </span>
            )}
            {tab === "suppliers" && stats.pendingSuppliers > 0 && (
              <span style={{
                background: "#dc2626", color: "var(--fc-fg-gray0)", fontSize: "10px", fontWeight: "700",
                width: "16px", height: "16px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {stats.pendingSuppliers}
              </span>
            )}
            {tab === "community" && openReports > 0 && (
              <span
                aria-label={`${openReports} reported`}
                style={{
                  background: "#dc2626", color: "var(--fc-fg-gray0)", fontSize: "10px", fontWeight: "700",
                  minWidth: "16px", height: "16px", padding: "0 4px", borderRadius: "8px",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}
              >
                {openReports}
              </span>
            )}
            {tab}
          </button>
        ))}
      </div>

      {/* ═══════════ COMMUNITY TAB ═══════════ */}
      {activeTab === "community" && <CommunityModeration onOpenCount={setOpenReports} />}

      {/* ═══════════ CLUCKY TAB: usage of the AI service ═══════════ */}
      {activeTab === "clucky" && <CluckyUsage />}

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
                  padding: "6px 14px", borderRadius: "16px",
                  border: `1.5px solid ${vetFilter === f ? "var(--fc-line-gray900)" : "var(--fc-line-gray200)"}`,
                  background: vetFilter === f ? "var(--fc-bg-gray900)" : "var(--fc-bg-gray0)",
                  color: vetFilter === f ? "var(--fc-fg-gray0)" : "var(--fc-fg-gray500)",
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
              background: "var(--fc-bg-gray0)", borderRadius: "16px", border: "1px solid var(--fc-line-gray101)"
            }}>
              <Stethoscope size={48} color="var(--fc-fg-gray200)" style={{ marginBottom: "12px" }} />
              <p style={{ color: "var(--fc-fg-gray400)", fontSize: "14px" }}>
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
                    background: "var(--fc-bg-gray0)", borderRadius: "16px",
                    border: "1px solid var(--fc-line-gray200)", padding: "18px 20px",
                    boxShadow: "var(--fc-shadow-card)"
                  }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "flex-start", flexWrap: "wrap", gap: "14px"
                    }}>
                      <div style={{ flex: 1, minWidth: "220px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: "700", fontSize: "15px", color: "var(--fc-fg-gray900)" }}>
                            {vet.full_name}
                          </span>
                          <span style={{
                            fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                            borderRadius: "16px", background: meta.bg, color: meta.color
                          }}>
                            {meta.label}
                          </span>
                        </div>
                        <div style={{ fontSize: "13px", color: "var(--fc-fg-gray500)", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {vet.license_number && <span><IdCard size={14} aria-hidden="true" /> License: {vet.license_number}</span>}
                          {vet.service_counties?.length > 0 && (
                            <span><MapPin size={14} aria-hidden="true" /> {vet.service_counties.join(", ")}</span>
                          )}
                          {vet.specializations?.length > 0 && (
                            <span><Stethoscope size={14} aria-hidden="true" /> {vet.specializations.join(", ")}</span>
                          )}
                          {vet.accepts_emergency && (
                            <span style={{ color: "var(--fc-fg-red500)", fontWeight: "600" }}><Siren size={14} aria-hidden="true" /> Accepts emergencies</span>
                          )}
                          {vet.bio && (
                            <p style={{ margin: "6px 0 0", color: "var(--fc-fg-gray400)", fontStyle: "italic" }}>
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
                                padding: "8px 14px", background: "#15803d", color: "var(--fc-fg-gray0)",
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
                                padding: "8px 14px", background: "var(--fc-bg-gray0)", color: "var(--fc-fg-red500)",
                                border: "1px solid var(--fc-line-red200)", borderRadius: "8px", fontWeight: "700",
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
                              padding: "8px 14px", background: "var(--fc-bg-gray0)", color: "var(--fc-fg-red800)",
                              border: "1px solid var(--fc-line-red200)", borderRadius: "8px", fontWeight: "700",
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
                              padding: "8px 14px", background: "var(--fc-bg-gray50)", color: "var(--fc-fg-gray700)",
                              border: "1px solid var(--fc-line-gray200)", borderRadius: "8px", fontWeight: "600",
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

      {/* ═══════════ SUPPLIERS TAB ═══════════ */}
      {activeTab === "suppliers" && (
        <div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {["pending", "verified", "rejected", "suspended", "all"].map(f => (
              <button
                key={f}
                onClick={() => setSupplierFilter(f)}
                style={{
                  padding: "6px 14px", borderRadius: "16px",
                  border: `1.5px solid ${supplierFilter === f ? "var(--fc-line-gray900)" : "var(--fc-line-gray200)"}`,
                  background: supplierFilter === f ? "var(--fc-bg-gray900)" : "var(--fc-bg-gray0)",
                  color: supplierFilter === f ? "var(--fc-fg-gray0)" : "var(--fc-fg-gray500)",
                  fontWeight: "600", fontSize: "12px", cursor: "pointer",
                  textTransform: "capitalize"
                }}
              >
                {f}
              </button>
            ))}
          </div>

          {(() => {
            const shown = supplierFilter === "all"
              ? supplierProfiles
              : supplierProfiles.filter(s => s.verification_status === supplierFilter);

            if (shown.length === 0) {
              return (
                <div style={{
                  textAlign: "center", padding: "60px 20px",
                  background: "var(--fc-bg-gray0)", borderRadius: "16px", border: "1px solid var(--fc-line-gray101)"
                }}>
                  <Store size={48} color="var(--fc-fg-gray200)" style={{ marginBottom: "12px" }} />
                  <p style={{ color: "var(--fc-fg-gray400)", fontSize: "14px" }}>
                    No {supplierFilter !== "all" ? supplierFilter : ""} supplier profiles.
                  </p>
                </div>
              );
            }

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {shown.map(sup => {
                  const meta = VET_STATUS_META[sup.verification_status] || VET_STATUS_META.unverified;
                  const busy = updatingSupplierId === sup.id;
                  // "solid" is the one filled button (approve); the rest are outlined in their own colour
                  const actionStyle = (color, border) => ({
                    display: "flex", alignItems: "center", gap: "6px", minHeight: "44px",
                    padding: "0 16px", background: color === "solid" ? "var(--fc-primary)" : "var(--fc-surface)",
                    color: color === "solid" ? "#fff" : color, border: border || "none",
                    borderRadius: "8px", fontWeight: "700", fontSize: "12px",
                    cursor: busy ? "not-allowed" : "pointer"
                  });
                  return (
                    <div key={sup.id} style={{
                      background: "var(--fc-bg-gray0)", borderRadius: "16px",
                      border: "1px solid var(--fc-line-gray200)", padding: "18px 20px",
                      boxShadow: "var(--fc-shadow-card)"
                    }}>
                      <div style={{
                        display: "flex", justifyContent: "space-between",
                        alignItems: "flex-start", flexWrap: "wrap", gap: "14px"
                      }}>
                        <div style={{ flex: 1, minWidth: "220px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontWeight: "700", fontSize: "15px", color: "var(--fc-fg-gray900)" }}>
                              {sup.business_name}
                            </span>
                            <span style={{
                              fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                              borderRadius: "16px", background: meta.bg, color: meta.color
                            }}>
                              {meta.label}
                            </span>
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--fc-fg-gray500)", display: "flex", flexDirection: "column", gap: "4px" }}>
                            {(sup.product_categories || []).length > 0
                              ? <span><Package size={14} aria-hidden="true" /> {sup.product_categories.join(", ")}</span>
                              : sup.supplier_type && <span><Package size={14} aria-hidden="true" /> {sup.supplier_type}</span>}
                            {sup.location_details && <span><Store size={14} aria-hidden="true" /> {sup.location_details}</span>}
                            {sup.county && <span><MapPin size={14} aria-hidden="true" /> {sup.county}</span>}
                            {sup.phone && <span><Phone size={14} aria-hidden="true" /> {sup.phone}</span>}
                            {sup.delivery_available && <span><Truck size={14} aria-hidden="true" /> Delivers</span>}
                            {sup.description && (
                              <p style={{ margin: "6px 0 0", color: "var(--fc-fg-gray400)", fontStyle: "italic" }}>
                                "{sup.description}"
                              </p>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          {sup.verification_status === "pending" && (
                            <>
                              <button disabled={busy} onClick={() => updateSupplierStatus(sup.id, "verified")} style={actionStyle("solid")}>
                                <CheckCircle2 size={14} /> Approve
                              </button>
                              <button disabled={busy} onClick={() => updateSupplierStatus(sup.id, "rejected")} style={actionStyle("var(--fc-fg-red500)", "1px solid var(--fc-line-red200)")}>
                                <XCircle size={14} /> Reject
                              </button>
                            </>
                          )}
                          {sup.verification_status === "verified" && (
                            <button disabled={busy} onClick={() => updateSupplierStatus(sup.id, "suspended")} style={actionStyle("var(--fc-fg-red800)", "1px solid var(--fc-line-red200)")}>
                              <Ban size={14} /> Suspend
                            </button>
                          )}
                          {(sup.verification_status === "rejected" || sup.verification_status === "suspended") && (
                            <button disabled={busy} onClick={() => updateSupplierStatus(sup.id, "pending")} style={actionStyle("var(--fc-fg-gray700)", "1px solid var(--fc-line-gray200)")}>
                              Move to Pending
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══════════ USERS TABLE ═══════════ */}
      {activeTab === "users" && (
        <div style={{
          background: "var(--fc-bg-gray0)", borderRadius: "16px",
          border: "1px solid var(--fc-line-gray200)",
          boxShadow: "var(--fc-shadow-card)", overflow: "hidden"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--fc-line-gray100)" }}>
                {["Name", "Email", "Role", "Joined"].map(h => (
                  <th key={h} style={{
                    padding: "14px 20px", textAlign: "left",
                    fontSize: "12px", fontWeight: "600",
                    color: "var(--fc-fg-gray400)", textTransform: "uppercase", letterSpacing: "0.05em"
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: "40px", color: "var(--fc-fg-gray400)" }}>
                    No users yet.
                  </td>
                </tr>
              ) : users.map((user, i) => (
                <tr key={user.id} style={{
                  borderBottom: i < users.length - 1 ? "1px solid var(--fc-line-gray51)" : "none",
                  transition: "background 0.15s"
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--fc-bg-gray25)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "14px 20px", fontWeight: "600", fontSize: "14px", color: "var(--fc-fg-gray900)" }}>
                    {user.full_name || "—"}
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: "14px", color: "var(--fc-fg-gray500)" }}>
                    {user.user_email}
                  </td>
                  <td style={{ padding: "14px 20px" }}>
                    <span style={{
                      background: "var(--fc-bg-green100)", color: "var(--fc-fg-green700)",
                      fontSize: "12px", fontWeight: "700",
                      padding: "3px 10px", borderRadius: "16px"
                    }}>
                      {user.role || "farmer"}
                    </span>
                  </td>
                  <td style={{ padding: "14px 20px", fontSize: "14px", color: "var(--fc-fg-gray500)" }}>
                    {user.created_at ? new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════ PRODUCTS TABLE ═══════════ */}
      {activeTab === "products" && <AdminListings products={products} onChanged={loadData} />}

      {/* ═══════════ ACCOUNT REQUESTS AND REPORTS ═══════════ */}
      {activeTab === "requests" && <AdminRequests />}

      {/* ═══════════ BATCHES TABLE ═══════════ */}
      {activeTab === "batches" && (
        <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--fc-bg-gray0)", borderRadius: "16px", border: "1px solid var(--fc-line-gray200)", boxShadow: "var(--fc-shadow-card)" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--fc-line-gray100)" }}>
              {["Batch Name", "Type", "Quantity", "Farmer", "Status"].map(h => (
                <th key={h} style={{
                  padding: "14px 20px", textAlign: "left",
                  fontSize: "12px", fontWeight: "600",
                  color: "var(--fc-fg-gray400)", textTransform: "uppercase", letterSpacing: "0.05em"
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "var(--fc-fg-gray400)" }}>
                  No batches yet.
                </td>
              </tr>
            ) : batches.map((batch, i) => (
              <tr key={batch.id} style={{
                borderBottom: i < batches.length - 1 ? "1px solid var(--fc-line-gray51)" : "none"
              }}
                onMouseEnter={e => e.currentTarget.style.background = "var(--fc-bg-gray25)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <td style={{ padding: "14px 20px", fontWeight: "600", fontSize: "14px", color: "var(--fc-fg-gray900)" }}>
                  {batch.batch_name}
                </td>
                <td style={{ padding: "14px 20px", fontSize: "14px", color: "var(--fc-fg-gray500)" }}>
                  {batch.batch_type}
                </td>
                <td style={{ padding: "14px 20px", fontSize: "14px", color: "var(--fc-fg-gray500)" }}>
                  {batch.quantity}
                </td>
                <td style={{ padding: "14px 20px", fontSize: "14px", color: "var(--fc-fg-gray500)" }}>
                  {batch.user_email}
                </td>
                <td style={{ padding: "14px 20px" }}>
                  <span style={{
                    background: batch.status === "active" ? "var(--fc-bg-green100)" : "var(--fc-bg-gray100)",
                    color: batch.status === "active" ? "var(--fc-fg-green700)" : "var(--fc-fg-gray400)",
                    fontSize: "12px", fontWeight: "700",
                    padding: "3px 10px", borderRadius: "16px"
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