import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Stethoscope, Calendar, AlertTriangle, FileText, Users, Wallet,
  MessageCircle, X, Syringe, Pill, Beaker, Send, Clock
} from "lucide-react";

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box",
  background: "#fff", color: "#111827"
};

const URGENCY_COLORS = {
  low: { bg: "#f0fdf4", color: "#16a34a" },
  medium: { bg: "#fffbeb", color: "#d97706" },
  high: { bg: "#fff7ed", color: "#ea580c" },
};

export default function VetDashboard() {
  const { userEmail, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [emergencies, setEmergencies] = useState([]);
  const [stats, setStats] = useState({
    todayVisits: 0, emergencies: 0, pendingReports: 0,
    totalFarmers: 0, monthlyEarnings: 0, unreadMessages: 0
  });
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    farm_name: "", county: "", bird_count: "",
    appointment_date: "", appointment_time: "", reason: "", urgency: "medium"
  });

  useEffect(() => {
    if (userEmail) loadDashboard();
  }, [userEmail]);

  async function loadDashboard() {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().split("T")[0];

    const [
      { data: todayAppts, error: apptError },
      { data: allAppts },
      { data: emergencyData, error: emError },
      { count: pendingCount }
    ] = await Promise.all([
      supabase.from("vet_appointments").select("*")
        .eq("vet_email", userEmail).eq("appointment_date", today)
        .order("appointment_time", { ascending: true }),
      supabase.from("vet_appointments").select("farmer_email, fee, status, appointment_date")
        .eq("vet_email", userEmail),
      supabase.from("vet_questions").select("*")
        .eq("is_emergency", true).eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase.from("vet_questions").select("*", { count: "exact", head: true })
        .eq("is_emergency", false).eq("status", "pending")
    ]);

    if (apptError) console.error("VetDashboard: failed to load today's appointments —", apptError.message);
    if (emError) console.error("VetDashboard: failed to load emergencies —", emError.message);

    setAppointments(todayAppts || []);
    setEmergencies(emergencyData || []);

    const uniqueFarmers = new Set((allAppts || []).map(a => a.farmer_email).filter(Boolean));
    const monthlyEarnings = (allAppts || [])
      .filter(a => a.status === "completed" && a.appointment_date >= monthStart)
      .reduce((sum, a) => sum + Number(a.fee || 0), 0);

    setStats({
      todayVisits: (todayAppts || []).length,
      emergencies: (emergencyData || []).length,
      pendingReports: pendingCount || 0,
      totalFarmers: uniqueFarmers.size,
      monthlyEarnings,
      unreadMessages: 0 // no vet-farmer messaging system yet — see roadmap note below
    });

    setLoading(false);
  }

  async function updateAppointmentStatus(id, status) {
    const { error } = await supabase.from("vet_appointments").update({ status }).eq("id", id);
    if (error) {
      alert("Failed to update appointment: " + error.message);
      return;
    }
    loadDashboard();
  }

  async function respondToEmergency(question) {
    const { error } = await supabase.from("vet_questions")
      .update({
        status: "answered",
        assigned_vet: userEmail,
        responded_at: new Date().toISOString()
      })
      .eq("id", question.id);
    if (error) {
      alert("Failed to respond: " + error.message);
      return;
    }
    loadDashboard();
  }

  async function handleScheduleVisit(e) {
    e.preventDefault();
    if (!scheduleForm.farm_name || !scheduleForm.appointment_date) return;
    setSaving(true);

    const { error } = await supabase.from("vet_appointments").insert([{
      vet_email: userEmail,
      farm_name: scheduleForm.farm_name,
      county: scheduleForm.county,
      bird_count: scheduleForm.bird_count ? Number(scheduleForm.bird_count) : null,
      appointment_date: scheduleForm.appointment_date,
      appointment_time: scheduleForm.appointment_time,
      reason: scheduleForm.reason,
      urgency: scheduleForm.urgency,
      status: "pending"
    }]);

    setSaving(false);
    if (error) {
      alert("Failed to schedule visit: " + error.message);
      return;
    }
    setScheduleForm({
      farm_name: "", county: "", bird_count: "",
      appointment_date: "", appointment_time: "", reason: "", urgency: "medium"
    });
    setShowScheduleForm(false);
    loadDashboard();
  }

  function comingSoon(feature) {
    alert(`${feature} isn't built yet — it needs its own backend. On the roadmap.`);
  }

  const STAT_CARDS = [
    { label: "Today's Visits", value: stats.todayVisits, icon: Calendar, color: "#edf9f1", iconColor: "#22c55e" },
    { label: "Emergencies", value: stats.emergencies, icon: AlertTriangle, color: "#fef2f2", iconColor: "#ef4444" },
    { label: "Pending Reports", value: stats.pendingReports, icon: FileText, color: "#fff7e6", iconColor: "#f59e0b" },
    { label: "Total Farmers", value: stats.totalFarmers, icon: Users, color: "#edf5ff", iconColor: "#3b82f6" },
    { label: "Monthly Earnings", value: `KES ${stats.monthlyEarnings.toLocaleString()}`, icon: Wallet, color: "#f3f0ff", iconColor: "#8b5cf6" },
    { label: "Unread Messages", value: stats.unreadMessages, icon: MessageCircle, color: "#fff0eb", iconColor: "#f97316" },
  ];

  const QUICK_ACTIONS = [
    { icon: Pill, label: "Create Prescription", action: () => comingSoon("Prescriptions") },
    { icon: Stethoscope, label: "Record Diagnosis", action: () => comingSoon("Diagnosis records") },
    { icon: Syringe, label: "Add Vaccination Record", action: () => comingSoon("Vaccination records") },
    { icon: Calendar, label: "Schedule Visit", action: () => setShowScheduleForm(true) },
    { icon: Beaker, label: "Upload Lab Results", action: () => comingSoon("Lab result uploads") },
    { icon: Send, label: "Message Farmer", action: () => comingSoon("Vet-to-farmer messaging") },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div>
      {/* HEADER */}
      <div className="fc-page-header" style={{ marginBottom: "20px" }}>
        <div>
          <h1 className="fc-page-title" style={{ margin: 0, fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
            Dashboard
          </h1>
          <p style={{ marginTop: "6px", color: "#6b7280", fontSize: "15px" }}>
            Vet Workspace
          </p>
        </div>
      </div>

      {/* WELCOME BANNER */}
      <div style={{
        background: "linear-gradient(135deg,#22c55e,#16a34a)", borderRadius: "24px",
        padding: "28px 32px", color: "#fff", marginBottom: "24px",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: "16px"
      }}>
        <div>
          <p style={{ margin: "0 0 6px", fontSize: "13px", opacity: 0.85 }}>✨ {greeting},</p>
          <h2 style={{ margin: "0 0 6px", fontSize: "26px", fontWeight: "800" }}>
            Dr. {profile?.full_name || "Veterinarian"}
          </h2>
          <p style={{ margin: 0, fontSize: "14px", opacity: 0.9, display: "flex", alignItems: "center", gap: "6px" }}>
            <Stethoscope size={14} /> Poultry Veterinarian
          </p>
        </div>
        <span style={{
          background: "rgba(255,255,255,0.2)", padding: "8px 16px",
          borderRadius: "20px", fontSize: "13px", fontWeight: "600"
        }}>
          ● Available now
        </span>
      </div>

      {/* STAT CARDS */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
        gap: "16px", marginBottom: "24px"
      }}>
        {STAT_CARDS.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} style={{
              background: "#fff", borderRadius: "18px", padding: "18px",
              border: "1px solid #e5e7eb", boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
            }}>
              <div style={{
                width: "38px", height: "38px", borderRadius: "12px",
                background: item.color, display: "flex", alignItems: "center",
                justifyContent: "center", marginBottom: "12px"
              }}>
                <Icon size={18} color={item.iconColor} />
              </div>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#111827" }}>
                {loading ? "—" : item.value}
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px", fontWeight: "500" }}>
                {item.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* MAIN GRID */}
      <div className="fc-grid-2" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "18px" }}>

        {/* TODAY'S APPOINTMENTS */}
        <div style={{
          background: "#fff", borderRadius: "24px", padding: "24px",
          border: "1px solid #e5e7eb", boxShadow: "0 4px 20px rgba(0,0,0,0.04)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>
              Today's Appointments
            </h2>
            <span style={{ fontSize: "13px", color: "#22c55e", fontWeight: "600" }}>
              {appointments.length} scheduled
            </span>
          </div>

          {loading ? (
            <p style={{ color: "#9ca3af", fontSize: "14px" }}>Loading...</p>
          ) : appointments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Calendar size={40} color="#e5e7eb" style={{ marginBottom: "10px" }} />
              <p style={{ color: "#9ca3af", fontSize: "14px" }}>No appointments scheduled for today.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {appointments.map(appt => {
                const urgency = URGENCY_COLORS[appt.urgency] || URGENCY_COLORS.medium;
                return (
                  <div key={appt.id} style={{ border: "1px solid #f0f0f0", borderRadius: "16px", padding: "16px" }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "flex-start", flexWrap: "wrap", gap: "10px"
                    }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: "700", fontSize: "15px", color: "#111827" }}>
                            {appt.farm_name}
                          </span>
                          <span style={{
                            fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                            borderRadius: "20px", background: urgency.bg, color: urgency.color,
                            textTransform: "capitalize"
                          }}>
                            {appt.urgency}
                          </span>
                          <span style={{
                            fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px",
                            background: appt.status === "accepted" ? "#dcfce7" : "#fef3c7",
                            color: appt.status === "accepted" ? "#16a34a" : "#d97706",
                            textTransform: "capitalize"
                          }}>
                            {appt.status}
                          </span>
                        </div>
                        <div style={{ fontSize: "12px", color: "#9ca3af", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          {appt.appointment_time && (
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={11} /> {appt.appointment_time}
                            </span>
                          )}
                          {appt.county && <span>📍 {appt.county}</span>}
                          {appt.bird_count && <span>🐔 {appt.bird_count} birds</span>}
                        </div>
                        {appt.reason && (
                          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#6b7280" }}>{appt.reason}</p>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                        {appt.status !== "accepted" && (
                          <button
                            onClick={() => updateAppointmentStatus(appt.id, "accepted")}
                            style={{
                              padding: "8px 16px", background: "#16a34a", color: "#fff",
                              border: "none", borderRadius: "8px", fontWeight: "700",
                              fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap"
                            }}
                          >
                            Accept
                          </button>
                        )}
                        <button
                          onClick={() => updateAppointmentStatus(appt.id, "rescheduled")}
                          style={{
                            padding: "8px 16px", background: "#fff", color: "#374151",
                            border: "1px solid #e5e7eb", borderRadius: "8px",
                            fontWeight: "600", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap"
                          }}
                        >
                          Reschedule
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* EMERGENCY REQUESTS */}
        <div style={{
          background: "#fff", borderRadius: "24px", padding: "24px",
          border: "1px solid #e5e7eb", boxShadow: "0 4px 20px rgba(0,0,0,0.04)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>
              Emergency Requests
            </h2>
            {emergencies.length > 0 && (
              <span style={{
                background: "#ef4444", color: "#fff", fontSize: "12px", fontWeight: "700",
                width: "22px", height: "22px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {emergencies.length}
              </span>
            )}
          </div>

          {loading ? (
            <p style={{ color: "#9ca3af", fontSize: "14px" }}>Loading...</p>
          ) : emergencies.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <AlertTriangle size={36} color="#e5e7eb" style={{ marginBottom: "10px" }} />
              <p style={{ color: "#9ca3af", fontSize: "13px" }}>No active emergencies. 🎉</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {emergencies.map(em => (
                <div key={em.id} style={{
                  border: "1px solid #fecaca", borderRadius: "16px", padding: "14px", background: "#fef2f2"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px", gap: "8px" }}>
                    <span style={{ fontWeight: "700", fontSize: "13px", color: "#111827", wordBreak: "break-word" }}>
                      {em.user_email}
                    </span>
                    <span style={{
                      fontSize: "10px", fontWeight: "800", padding: "2px 8px", borderRadius: "20px",
                      background: "#ef4444", color: "#fff", textTransform: "uppercase", flexShrink: 0
                    }}>
                      {em.severity || "high"}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: "12px", color: "#7f1d1d" }}>
                    {em.question}
                  </p>
                  <button
                    onClick={() => respondToEmergency(em)}
                    style={{
                      width: "100%", padding: "8px", background: "#ef4444", color: "#fff",
                      border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: "pointer"
                    }}
                  >
                    Respond
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{
        background: "#fff", borderRadius: "24px", padding: "24px",
        border: "1px solid #e5e7eb", boxShadow: "0 4px 20px rgba(0,0,0,0.04)", marginTop: "18px"
      }}>
        <h2 style={{ margin: "0 0 18px", fontSize: "18px", fontWeight: "700", color: "#111827" }}>
          Quick Actions
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: "12px" }}>
          {QUICK_ACTIONS.map(({ icon: Icon, label, action }) => (
            <button
              key={label}
              onClick={action}
              style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "16px",
                borderRadius: "16px", border: "1px solid #e5e7eb", background: "#f9fafb",
                cursor: "pointer", fontWeight: "600", fontSize: "13px", color: "#374151", textAlign: "left"
              }}
            >
              <Icon size={18} color="#16a34a" /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* SCHEDULE VISIT MODAL */}
      {showScheduleForm && (
        <div
          onClick={() => setShowScheduleForm(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "20px", padding: "28px", maxWidth: "480px", width: "100%" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>Schedule a Visit</h2>
              <button onClick={() => setShowScheduleForm(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleScheduleVisit}>
              <input
                placeholder="Farm name"
                value={scheduleForm.farm_name}
                onChange={e => setScheduleForm({ ...scheduleForm, farm_name: e.target.value })}
                required
                style={{ ...inputStyle, marginBottom: "12px" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <input
                  placeholder="County"
                  value={scheduleForm.county}
                  onChange={e => setScheduleForm({ ...scheduleForm, county: e.target.value })}
                  style={inputStyle}
                />
                <input
                  type="number"
                  placeholder="Bird count"
                  value={scheduleForm.bird_count}
                  onChange={e => setScheduleForm({ ...scheduleForm, bird_count: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <input
                  type="date"
                  value={scheduleForm.appointment_date}
                  onChange={e => setScheduleForm({ ...scheduleForm, appointment_date: e.target.value })}
                  required
                  style={inputStyle}
                />
                <input
                  type="time"
                  value={scheduleForm.appointment_time}
                  onChange={e => setScheduleForm({ ...scheduleForm, appointment_time: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <select
                value={scheduleForm.urgency}
                onChange={e => setScheduleForm({ ...scheduleForm, urgency: e.target.value })}
                style={{ ...inputStyle, marginBottom: "12px", appearance: "none" }}
              >
                <option value="low">Low urgency</option>
                <option value="medium">Medium urgency</option>
                <option value="high">High urgency</option>
              </select>
              <textarea
                placeholder="Reason for visit"
                value={scheduleForm.reason}
                onChange={e => setScheduleForm({ ...scheduleForm, reason: e.target.value })}
                style={{ ...inputStyle, minHeight: "70px", resize: "vertical", marginBottom: "16px" }}
              />
              <button
                type="submit"
                disabled={saving}
                style={{
                  width: "100%", padding: "13px",
                  background: saving ? "#86efac" : "linear-gradient(135deg,#22c55e,#16a34a)",
                  color: "#fff", border: "none", borderRadius: "12px",
                  fontWeight: "700", fontSize: "14px", cursor: saving ? "not-allowed" : "pointer"
                }}
              >
                {saving ? "Saving..." : "Schedule Visit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}