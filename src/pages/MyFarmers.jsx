import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Users, Search, Phone, MapPin, Calendar,
  MessageSquare, Stethoscope
} from "lucide-react";

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "#fff"
};

const STATUS_COLORS = {
  pending: { bg: "#fffbeb", color: "#d97706" },
  claimed: { bg: "#eff6ff", color: "#3b82f6" },
  accepted: { bg: "#eff6ff", color: "#3b82f6" },
  completed: { bg: "#f0fdf4", color: "#16a34a" },
  cancelled: { bg: "#fef2f2", color: "#ef4444" }
};

export default function MyFarmers() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [farmers, setFarmers] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user?.id) fetchMyFarmers();
  }, [user?.id]);

  async function fetchMyFarmers() {
    setLoading(true);

    // 1. All appointments this vet has actually handled (vet_id = assigned vet's auth.uid())
    const { data: appointments, error: apptError } = await supabase
      .from("vet_appointments")
      .select("*")
      .eq("vet_id", user.id)
      .order("created_at", { ascending: false });

    if (apptError) {
      console.error("MyFarmers: failed to load vet_appointments —", apptError.message);
      setFarmers([]);
      setLoading(false);
      return;
    }

    // 2. Dedupe by farmer_email — first occurrence wins since we sorted newest first
    const latestByFarmer = {};
    (appointments || []).forEach(appt => {
      const email = appt.farmer_email;
      if (!email) return;
      if (!latestByFarmer[email]) {
        latestByFarmer[email] = { ...appt, appointmentCount: 1 };
      } else {
        latestByFarmer[email].appointmentCount += 1;
      }
    });

    const farmerEmails = Object.keys(latestByFarmer);

    if (farmerEmails.length === 0) {
      setFarmers([]);
      setLoading(false);
      return;
    }

    // 3. Manual client-side join to farmer_profiles — no FK exists between
    // vet_appointments.farmer_email and farmer_profiles.user_email
    const { data: profiles, error: profileError } = await supabase
      .from("farmer_profiles")
      .select("*")
      .in("user_email", farmerEmails);

    if (profileError) {
      console.error("MyFarmers: failed to load farmer_profiles —", profileError.message);
    }

    const profileByEmail = {};
    (profiles || []).forEach(p => { profileByEmail[p.user_email] = p; });

    const merged = farmerEmails.map(email => {
      const appt = latestByFarmer[email];
      const profile = profileByEmail[email];
      return {
        email,
        fullName: profile?.full_name || "Unknown Farmer",
        county: profile?.county || "",
        phone: profile?.phone || "",
        avatarUrl: profile?.avatar_url || "",
        appointmentCount: appt.appointmentCount,
        lastStatus: appt.status || "pending",
        lastReason: appt.reason || appt.question || appt.notes || appt.symptoms || "No details provided",
        lastDate: appt.appointment_date || appt.scheduled_date || appt.created_at,
        lastUpdated: appt.updated_at || appt.created_at,
        urgency: appt.urgency || "normal"
      };
    });

    merged.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

    setFarmers(merged);
    setLoading(false);
  }

  const filtered = farmers.filter(f =>
    !search ||
    f.fullName.toLowerCase().includes(search.toLowerCase()) ||
    f.email.toLowerCase().includes(search.toLowerCase()) ||
    f.county.toLowerCase().includes(search.toLowerCase())
  );

  function formatDate(dateStr) {
    if (!dateStr) return "—";
    try {
      return new Date(dateStr).toLocaleDateString("en-GB", {
        day: "numeric", month: "short", year: "numeric"
      });
    } catch {
      return dateStr;
    }
  }

  return (
    <div>
      {/* HEADER */}
      <div className="fc-page-header" style={{ marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Users size={28} color="#22c55e" />
          <div>
            <h1 className="fc-page-title" style={{ margin: 0, fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
              My Farmers
            </h1>
            <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
              {farmers.length} farmer{farmers.length !== 1 ? "s" : ""} you've worked with
            </p>
          </div>
        </div>
      </div>

      {/* SEARCH */}
      <div style={{ position: "relative", margin: "20px 0 24px" }}>
        <Search size={16} style={{
          position: "absolute", left: "14px", top: "50%",
          transform: "translateY(-50%)", color: "#9ca3af"
        }} />
        <input
          placeholder="Search by name, email, or county..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ ...inputStyle, paddingLeft: "40px", maxWidth: "420px" }}
        />
      </div>

      {/* LOADING */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: "84px", borderRadius: "16px", background: "#f3f4f6" }} />
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && filtered.length === 0 && (
        <div style={{
          textAlign: "center", padding: "80px 20px",
          background: "#fff", borderRadius: "24px", border: "1px solid #f0f0f0"
        }}>
          <Users size={56} color="#e5e7eb" style={{ marginBottom: "16px" }} />
          <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#111827", margin: "0 0 8px" }}>
            {search ? "No farmers match your search" : "No farmers yet"}
          </h3>
          <p style={{ color: "#9ca3af", fontSize: "14px" }}>
            {search ? "Try a different search term." : "Farmers whose appointments you accept will show up here."}
          </p>
        </div>
      )}

      {/* FARMER LIST */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map(f => {
            const statusStyle = STATUS_COLORS[f.lastStatus] || { bg: "#f3f4f6", color: "#6b7280" };
            return (
              <div key={f.email} style={{
                background: "#fff", borderRadius: "18px",
                border: "1px solid #e5e7eb", padding: "18px 20px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center"
              }}>
                {/* AVATAR */}
                <div style={{
                  width: "48px", height: "48px", borderRadius: "14px",
                  background: "#dcfce7", display: "flex", alignItems: "center",
                  justifyContent: "center", flexShrink: 0, overflow: "hidden",
                  fontWeight: "700", color: "#16a34a", fontSize: "18px"
                }}>
                  {f.avatarUrl
                    ? <img src={f.avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : f.fullName.charAt(0).toUpperCase()
                  }
                </div>

                {/* INFO */}
                <div style={{ flex: 1, minWidth: "220px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", flexWrap: "wrap" }}>
                    <p style={{ margin: 0, fontWeight: "700", fontSize: "15px", color: "#111827" }}>
                      {f.fullName}
                    </p>
                    <span style={{
                      background: statusStyle.bg, color: statusStyle.color,
                      fontSize: "11px", fontWeight: "700",
                      padding: "2px 9px", borderRadius: "20px", textTransform: "capitalize"
                    }}>
                      {f.lastStatus}
                    </span>
                    {f.urgency === "high" && (
                      <span style={{
                        background: "#fef2f2", color: "#ef4444",
                        fontSize: "11px", fontWeight: "700",
                        padding: "2px 9px", borderRadius: "20px"
                      }}>
                        🚨 Urgent
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: "14px", flexWrap: "wrap", fontSize: "12px", color: "#9ca3af", marginBottom: "6px" }}>
                    {f.county && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <MapPin size={11} /> {f.county}
                      </span>
                    )}
                    {f.phone && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Phone size={11} /> {f.phone}
                      </span>
                    )}
                    <span>{f.email}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Stethoscope size={11} /> {f.appointmentCount} appointment{f.appointmentCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p style={{
                    margin: 0, fontSize: "13px", color: "#374151",
                    display: "flex", alignItems: "flex-start", gap: "6px"
                  }}>
                    <MessageSquare size={13} style={{ marginTop: "2px", flexShrink: 0, color: "#9ca3af" }} />
                    {f.lastReason}
                  </p>
                </div>

                {/* DATE */}
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end", color: "#9ca3af", fontSize: "12px" }}>
                    <Calendar size={12} /> {formatDate(f.lastDate)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}