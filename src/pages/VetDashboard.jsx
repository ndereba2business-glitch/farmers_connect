import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Stethoscope, Calendar, AlertTriangle, FileText, Users, Wallet,
  MessageCircle, X, Syringe, Pill, Beaker, Send, Clock, ClipboardList,
  CalendarPlus, Search, CheckCircle2
} from "lucide-react";

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box",
  background: "#fff", color: "#111827"
};

const labelStyle = {
  display: "block", fontSize: "12px", fontWeight: "600",
  color: "#6b7280", marginBottom: "5px"
};

const URGENCY_COLORS = {
  low: { bg: "#f0fdf4", color: "#16a34a" },
  medium: { bg: "#fffbeb", color: "#d97706" },
  high: { bg: "#fff7ed", color: "#ea580c" },
};

const PROFILE_BANNER_META = {
  missing: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", text: "You haven't set up your vet profile yet. Complete it so farmers can find and book you." },
  pending: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af", text: "Your vet profile is pending admin review. You'll be listed to farmers once verified." },
  rejected: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b", text: "Your vet profile was rejected. Update your details and resubmit." },
  suspended: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b", text: "Your vet account is suspended. Contact support to appeal." },
};

const EMPTY_ESCALATE_FORM = {
  farm_name: "", county: "", bird_count: "",
  appointment_date: "", appointment_time: "", urgency: "high", reason: ""
};

const EMPTY_SCHEDULE_FORM = {
  farm_name: "", county: "", bird_count: "",
  appointment_date: "", appointment_time: "", reason: "", urgency: "medium"
};

// NEW — Phase 2.1: relative-time helper for the recent activity feed
function timeAgo(timestamp) {
  if (!timestamp) return "";
  const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function VetDashboard() {
  const { userEmail, profile, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(""); // NEW — Phase 2.1 visible error surface
  const [appointments, setAppointments] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]); // NEW — Phase 2.1 recent activity feed
  const [emergencies, setEmergencies] = useState([]);
  const [vetProfileStatus, setVetProfileStatus] = useState(null);
  const [stats, setStats] = useState({
    todayVisits: 0, emergencies: 0, pendingReports: 0,
    totalFarmers: 0, monthlyEarnings: 0, unreadMessages: 0,
    upcomingVisits: 0, pendingRequests: 0, completedVisits: 0 // NEW
  });
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(EMPTY_SCHEDULE_FORM);
  const [scheduleError, setScheduleError] = useState("");

  // ── FARMER PICKER FOR SCHEDULE VISIT ──
  const [farmerQuery, setFarmerQuery] = useState("");
  const [farmerResults, setFarmerResults] = useState([]);
  const [farmerSearching, setFarmerSearching] = useState(false);
  const [selectedFarmer, setSelectedFarmer] = useState(null);

  // ── ESCALATE QUESTION → VISIT ──
  const [escalateTarget, setEscalateTarget] = useState(null);
  const [escalateForm, setEscalateForm] = useState(EMPTY_ESCALATE_FORM);
  const [escalateSaving, setEscalateSaving] = useState(false);
  const [escalateError, setEscalateError] = useState("");

  useEffect(() => {
    if (userEmail) loadDashboard();
  }, [userEmail]);

  // ── FARMER SEARCH (debounced) ──
  useEffect(() => {
    if (!farmerQuery.trim() || selectedFarmer) {
      setFarmerResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setFarmerSearching(true);
      const { data, error } = await supabase
        .from("farmer_profiles")
        .select("user_email, full_name, county, phone")
        .or(`full_name.ilike.%${farmerQuery}%,user_email.ilike.%${farmerQuery}%`)
        .limit(6);

      if (error) {
        console.error("VetDashboard: farmer search failed —", error.message);
        setFarmerResults([]);
      } else {
        setFarmerResults(data || []);
      }
      setFarmerSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [farmerQuery, selectedFarmer]);

  async function loadDashboard() {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString().split("T")[0];

    // NEW — Phase 2.1: bounded upcoming-visits window (today + next 7 days)
    const upcomingCutoffDate = new Date();
    upcomingCutoffDate.setDate(upcomingCutoffDate.getDate() + 7);
    const upcomingCutoff = upcomingCutoffDate.toISOString().split("T")[0];

    const [
      { data: upcomingAppts, error: apptError },
      { data: allAppts },
      { data: emergencyData, error: emError },
      { count: pendingCount },
      { data: vetProfileData, error: vetProfileError },
      { data: recentActivityData, error: recentActivityError } // NEW
    ] = await Promise.all([
      supabase.from("vet_appointments").select("*")
        .eq("vet_email", userEmail)
        .gte("appointment_date", today)
        .lte("appointment_date", upcomingCutoff)
        .in("status", ["pending", "accepted"])
        .order("appointment_date", { ascending: true })
        .order("appointment_time", { ascending: true })
        .limit(15),
      supabase.from("vet_appointments").select("farmer_email, fee, status, appointment_date")
        .eq("vet_email", userEmail),
      supabase.from("vet_questions").select("*")
        .eq("is_emergency", true).eq("status", "pending")
        .order("created_at", { ascending: false }),
      supabase.from("vet_questions").select("*", { count: "exact", head: true })
        .eq("is_emergency", false).eq("status", "pending"),
      user?.id
        ? supabase.from("vet_profiles").select("verification_status").eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      // NEW — Phase 2.1: recent activity feed, last 5 appointment events for this vet
      supabase.from("vet_appointments").select("id, farm_name, status, appointment_date, created_at")
        .eq("vet_email", userEmail)
        .order("created_at", { ascending: false })
        .limit(5)
    ]);

    if (apptError) console.error("VetDashboard: failed to load upcoming appointments —", apptError.message);
    if (emError) console.error("VetDashboard: failed to load emergencies —", emError.message);
    if (vetProfileError) console.error("VetDashboard: failed to load vet profile —", vetProfileError.message);
    if (recentActivityError) console.error("VetDashboard: failed to load recent activity —", recentActivityError.message);

    // NEW — Phase 2.1: surface load failures visibly instead of only logging
    setLoadError(apptError || emError ? "Some dashboard data couldn't load. Check your connection and retry." : "");

    setAppointments(upcomingAppts || []);
    setRecentActivity(recentActivityData || []); // NEW
    setEmergencies(emergencyData || []);
    setVetProfileStatus(vetProfileData?.verification_status || "missing");

    const uniqueFarmers = new Set((allAppts || []).map(a => a.farmer_email).filter(Boolean));
    const monthlyEarnings = (allAppts || [])
      .filter(a => a.status === "completed" && a.appointment_date >= monthStart)
      .reduce((sum, a) => sum + Number(a.fee || 0), 0);

    // NEW — Phase 2.1 dashboard stats
    const pendingRequests = (allAppts || []).filter(a => a.status === "pending").length;
    const completedVisits = (allAppts || []).filter(a => a.status === "completed").length;
    const upcomingVisitsCount = (upcomingAppts || []).length;
    const todayVisitsCount = (upcomingAppts || []).filter(a => a.appointment_date === today).length;

    setStats({
      todayVisits: todayVisitsCount,
      emergencies: (emergencyData || []).length,
      pendingReports: pendingCount || 0,
      totalFarmers: uniqueFarmers.size,
      monthlyEarnings,
      unreadMessages: 0, // no vet-farmer messaging system yet — see roadmap note below
      upcomingVisits: upcomingVisitsCount, // NEW
      pendingRequests, // NEW
      completedVisits // NEW
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

  // ── OPEN ESCALATE MODAL ──
  function openEscalate(question) {
    setEscalateError("");
    setEscalateForm({
      ...EMPTY_ESCALATE_FORM,
      appointment_date: new Date().toISOString().split("T")[0],
      urgency: question.is_emergency ? "high" : "medium",
      reason: question.question || ""
    });
    setEscalateTarget(question);
  }

  // ── SAVE ESCALATE → CREATE APPOINTMENT + LINK BACK ──
  async function handleEscalateSave(e) {
    e.preventDefault();
    setEscalateError("");

    if (!escalateForm.farm_name || !escalateForm.appointment_date) {
      setEscalateError("Farm name and date are required.");
      return;
    }

    setEscalateSaving(true);

    const { data: newAppt, error: apptError } = await supabase
      .from("vet_appointments")
      .insert([{
        vet_id: user?.id || null,
        vet_email: userEmail,
        farmer_id: escalateTarget.farmer_id || null,
        farmer_email: escalateTarget.user_email,
        farm_name: escalateForm.farm_name,
        county: escalateForm.county,
        bird_count: escalateForm.bird_count ? Number(escalateForm.bird_count) : null,
        appointment_date: escalateForm.appointment_date,
        appointment_time: escalateForm.appointment_time,
        reason: escalateForm.reason,
        urgency: escalateForm.urgency,
        status: "pending",
        source: "escalated_question"
      }])
      .select()
      .single();

    if (apptError) {
      setEscalateError("Failed to create visit: " + apptError.message);
      setEscalateSaving(false);
      return;
    }

    const { error: linkError } = await supabase
      .from("vet_questions")
      .update({
        escalated_appointment_id: newAppt.id,
        status: "escalated",
        assigned_vet: userEmail,
        responded_at: new Date().toISOString()
      })
      .eq("id", escalateTarget.id);

    setEscalateSaving(false);

    if (linkError) {
      alert("Visit created, but couldn't link it back to the original question: " + linkError.message);
    }

    setEscalateTarget(null);
    loadDashboard();
  }

  function closeScheduleForm() {
    setShowScheduleForm(false);
    setScheduleForm(EMPTY_SCHEDULE_FORM);
    setScheduleError("");
    setSelectedFarmer(null);
    setFarmerQuery("");
    setFarmerResults([]);
  }

  async function handleScheduleVisit(e) {
    e.preventDefault();
    setScheduleError("");

    if (!scheduleForm.farm_name || !scheduleForm.appointment_date) return;

    if (!selectedFarmer) {
      setScheduleError("Select which farmer this visit is for.");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("vet_appointments").insert([{
      vet_id: user?.id || null,
      vet_email: userEmail,
      farmer_email: selectedFarmer.user_email,
      farm_name: scheduleForm.farm_name,
      county: scheduleForm.county,
      bird_count: scheduleForm.bird_count ? Number(scheduleForm.bird_count) : null,
      appointment_date: scheduleForm.appointment_date,
      appointment_time: scheduleForm.appointment_time,
      reason: scheduleForm.reason,
      urgency: scheduleForm.urgency,
      status: "pending",
      source: "direct"
    }]);

    setSaving(false);
    if (error) {
      setScheduleError("Failed to schedule visit: " + error.message);
      return;
    }
    closeScheduleForm();
    loadDashboard();
  }

  function comingSoon(feature) {
    alert(`${feature} isn't built yet — it needs its own backend. On the roadmap.`);
  }

  // UPDATED — Phase 2.1: consolidated to 6 glanceable cards (dropped the
  // always-zero "Unread Messages" placeholder; merged "Pending Reports"
  // into "Pending Requests" since both mean "things awaiting your action")
  const STAT_CARDS = [
    { label: "Total Farmers", value: stats.totalFarmers, icon: Users, color: "#edf5ff", iconColor: "#3b82f6" },
    { label: "Upcoming Visits", value: stats.upcomingVisits, icon: CalendarPlus, color: "#edf9f1", iconColor: "#22c55e" },
    { label: "Pending Requests", value: stats.pendingRequests + stats.pendingReports, icon: ClipboardList, color: "#fff7e6", iconColor: "#f59e0b" },
    { label: "Completed Visits", value: stats.completedVisits, icon: CheckCircle2, color: "#ecfdf5", iconColor: "#059669" },
    { label: "Emergencies", value: stats.emergencies, icon: AlertTriangle, color: "#fef2f2", iconColor: "#ef4444" },
    { label: "Monthly Earnings", value: `KES ${stats.monthlyEarnings.toLocaleString()}`, icon: Wallet, color: "#f3f0ff", iconColor: "#8b5cf6" },
  ];

  const QUICK_ACTIONS = [
    // NEW — Phase 2.1 additions
    { icon: Users, label: "View Farmers", action: () => comingSoon("Farmers list — tell me the intended route and I'll wire this up"), bg: "#edf5ff", iconColor: "#3b82f6" },
    { icon: ClipboardList, label: "Manage Requests", action: () => navigate("/appointments"), bg: "#f0fdf4", iconColor: "#16a34a" },
    // existing
    { icon: Pill, label: "Create Prescription", action: () => comingSoon("Prescriptions"), bg: "#f0fdf4", iconColor: "#22c55e" },
    { icon: Stethoscope, label: "Record Diagnosis", action: () => comingSoon("Diagnosis records"), bg: "#eff6ff", iconColor: "#3b82f6" },
    { icon: Syringe, label: "Add Vaccination Record", action: () => comingSoon("Vaccination records"), bg: "#f5f3ff", iconColor: "#8b5cf6" },
    { icon: Calendar, label: "Schedule Visit", action: () => setShowScheduleForm(true), bg: "#fff7e6", iconColor: "#f59e0b" },
    { icon: Beaker, label: "Upload Lab Results", action: () => comingSoon("Lab result uploads"), bg: "#fef2f2", iconColor: "#ef4444" },
    { icon: Send, label: "Message Farmer", action: () => comingSoon("Vet-to-farmer messaging"), bg: "#eff6ff", iconColor: "#3b82f6" },
  ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const todayStr = new Date().toISOString().split("T")[0]; // NEW — "Today" tag in upcoming list

  const profileBanner = vetProfileStatus && vetProfileStatus !== "verified"
    ? (PROFILE_BANNER_META[vetProfileStatus] || PROFILE_BANNER_META.missing)
    : null;

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

      {/* LOAD ERROR BANNER — NEW (Phase 2.1) */}
      {!loading && loadError && (
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "12px 16px", borderRadius: "12px",
          background: "#fef2f2", border: "1px solid #fecaca",
          color: "#991b1b", fontSize: "13px", marginBottom: "20px"
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{loadError}</span>
          <button
            onClick={loadDashboard}
            style={{
              marginLeft: "auto", background: "none", border: "1px solid #fca5a5",
              borderRadius: "8px", padding: "4px 12px", cursor: "pointer",
              color: "#991b1b", fontWeight: "600", fontSize: "12px", flexShrink: 0
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* VET PROFILE COMPLETION BANNER */}
      {!loading && profileBanner && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: "14px", flexWrap: "wrap",
          padding: "14px 18px", borderRadius: "14px",
          background: profileBanner.bg, border: `1px solid ${profileBanner.border}`,
          marginBottom: "20px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <ClipboardList size={18} color={profileBanner.color} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: "13px", fontWeight: "600", color: profileBanner.color }}>
              {profileBanner.text}
            </span>
          </div>
          <button
            onClick={() => navigate("/vet-profile")}
            style={{
              padding: "8px 16px", background: "#fff", border: `1px solid ${profileBanner.border}`,
              borderRadius: "8px", fontWeight: "700", fontSize: "12px", color: profileBanner.color,
              cursor: "pointer", whiteSpace: "nowrap"
            }}
          >
            {vetProfileStatus === "missing" ? "Set Up Profile" : "Update Profile"}
          </button>
        </div>
      )}

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

        {/* UPCOMING APPOINTMENTS */}
        <div style={{
          background: "#fff", borderRadius: "24px", padding: "24px",
          border: "1px solid #e5e7eb", boxShadow: "0 4px 20px rgba(0,0,0,0.04)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>
                Upcoming Appointments
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9ca3af" }}>
                Next 7 days
              </p>
            </div>
            <span style={{ fontSize: "13px", color: "#22c55e", fontWeight: "600" }}>
              {appointments.length} scheduled
            </span>
          </div>

          {loading ? (
            <p style={{ color: "#9ca3af", fontSize: "14px" }}>Loading...</p>
          ) : appointments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Calendar size={40} color="#e5e7eb" style={{ marginBottom: "10px" }} />
              <p style={{ color: "#9ca3af", fontSize: "14px" }}>No appointments scheduled in the next 7 days.</p>
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
                          {appt.appointment_date === todayStr && (
                            <span style={{
                              fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px",
                              background: "#dbeafe", color: "#1d4ed8"
                            }}>
                              Today
                            </span>
                          )}
                          {appt.source === "escalated_question" && (
                            <span style={{
                              fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px",
                              background: "#fef2f2", color: "#ef4444"
                            }}>
                              🚨 From Emergency
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "#9ca3af", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          {appt.farmer_email && <span>👤 {appt.farmer_email}</span>}
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
                          onClick={() => navigate("/appointments")}
                          style={{
                            padding: "8px 16px", background: "#fff", color: "#374151",
                            border: "1px solid #e5e7eb", borderRadius: "8px",
                            fontWeight: "600", fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap"
                          }}
                        >
                          Manage
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
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => respondToEmergency(em)}
                      style={{
                        flex: 1, padding: "8px", background: "#ef4444", color: "#fff",
                        border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: "pointer"
                      }}
                    >
                      Respond
                    </button>
                    <button
                      onClick={() => openEscalate(em)}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                        padding: "8px", background: "#fff", color: "#ef4444",
                        border: "1px solid #ef4444", borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: "pointer"
                      }}
                    >
                      <CalendarPlus size={13} /> Escalate to Visit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RECENT ACTIVITY — NEW (Phase 2.1) */}
      <div style={{
        background: "#fff", borderRadius: "24px", padding: "24px",
        border: "1px solid #e5e7eb", boxShadow: "0 4px 20px rgba(0,0,0,0.04)", marginTop: "18px"
      }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: "700", color: "#111827" }}>
          Recent Activity
        </h2>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: "44px", borderRadius: "10px", background: "#f3f4f6" }} />
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <p style={{ margin: 0, color: "#9ca3af", fontSize: "14px" }}>
            No recent activity yet — new bookings and status changes will show up here.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentActivity.map(item => (
              <div key={item.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderRadius: "10px", background: "#f9fafb"
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: "600", fontSize: "13px", color: "#111827" }}>
                    {item.farm_name || "Untitled visit"}
                  </div>
                  <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                    {item.appointment_date} · {timeAgo(item.created_at)}
                  </div>
                </div>
                <span style={{
                  fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "20px",
                  background: item.status === "completed" ? "#dcfce7"
                    : item.status === "accepted" ? "#dbeafe"
                    : "#fef3c7",
                  color: item.status === "completed" ? "#16a34a"
                    : item.status === "accepted" ? "#1d4ed8"
                    : "#d97706",
                  textTransform: "capitalize", flexShrink: 0
                }}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
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
          {QUICK_ACTIONS.map(({ icon: Icon, label, action, bg, iconColor }) => (
            <button
              key={label}
              onClick={action}
              style={{
                display: "flex", alignItems: "center", gap: "10px", padding: "16px",
                borderRadius: "16px", border: "1px solid #e5e7eb", background: bg || "#fff",
                cursor: "pointer", fontWeight: "600", fontSize: "13px", color: "#374151", textAlign: "left", transition: "all 0.15s",
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,0,0,0.06)"}
              onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}
            >
              <div style={{
                width: "38px", height: "38px", borderRadius: "12px", background: bg,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
              }}>
                <Icon size={18} color={iconColor} />
              </div>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* SCHEDULE VISIT MODAL */}
      {showScheduleForm && (
        <div
          onClick={closeScheduleForm}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: "20px", padding: "28px", maxWidth: "480px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>Schedule a Visit</h2>
              <button onClick={closeScheduleForm} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleScheduleVisit}>

              {/* FARMER PICKER */}
              <div style={{ marginBottom: "12px" }}>
                <label style={labelStyle}>Farmer</label>
                {selectedFarmer ? (
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "10px 14px", borderRadius: "10px",
                    border: "1.5px solid #22c55e", background: "#f0fdf4"
                  }}>
                    <div>
                      <p style={{ margin: 0, fontWeight: "700", fontSize: "13px", color: "#111827" }}>
                        {selectedFarmer.full_name || "Farmer"}
                      </p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
                        {selectedFarmer.user_email}{selectedFarmer.county ? ` · ${selectedFarmer.county}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setSelectedFarmer(null); setFarmerQuery(""); }}
                      style={{ background: "none", border: "none", cursor: "pointer" }}
                    >
                      <X size={16} color="#6b7280" />
                    </button>
                  </div>
                ) : (
                  <div style={{ position: "relative" }}>
                    <Search size={15} style={{
                      position: "absolute", left: "13px", top: "50%",
                      transform: "translateY(-50%)", color: "#9ca3af"
                    }} />
                    <input
                      placeholder="Search farmer by name or email..."
                      value={farmerQuery}
                      onChange={e => setFarmerQuery(e.target.value)}
                      style={{ ...inputStyle, paddingLeft: "36px" }}
                    />
                    {farmerQuery.trim() && (
                      <div style={{
                        marginTop: "6px", border: "1px solid #e5e7eb", borderRadius: "10px",
                        maxHeight: "180px", overflowY: "auto", background: "#fff"
                      }}>
                        {farmerSearching ? (
                          <p style={{ margin: 0, padding: "10px 14px", fontSize: "13px", color: "#9ca3af" }}>
                            Searching...
                          </p>
                        ) : farmerResults.length === 0 ? (
                          <p style={{ margin: 0, padding: "10px 14px", fontSize: "13px", color: "#9ca3af" }}>
                            No farmers found.
                          </p>
                        ) : (
                          farmerResults.map(f => (
                            <div
                              key={f.user_email}
                              onClick={() => { setSelectedFarmer(f); setFarmerResults([]); }}
                              style={{
                                padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f3f4f6"
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                              onMouseLeave={e => e.currentTarget.style.background = "#fff"}
                            >
                              <p style={{ margin: 0, fontWeight: "600", fontSize: "13px", color: "#111827" }}>
                                {f.full_name || "Farmer"}
                              </p>
                              <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
                                {f.user_email}{f.county ? ` · ${f.county}` : ""}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

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

              {scheduleError && (
                <div style={{
                  background: "#fef2f2", border: "1px solid #fecaca",
                  color: "#dc2626", padding: "10px 14px",
                  borderRadius: "8px", fontSize: "13px", marginBottom: "14px"
                }}>
                  ⚠️ {scheduleError}
                </div>
              )}

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

      {/* ESCALATE TO VISIT MODAL */}
      {escalateTarget && (
        <div
          onClick={() => setEscalateTarget(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: "20px", padding: "28px",
              maxWidth: "480px", width: "100%", maxHeight: "90vh", overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#111827" }}>
                Escalate to Visit
              </h2>
              <button onClick={() => setEscalateTarget(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} color="#9ca3af" />
              </button>
            </div>
            <p style={{ margin: "0 0 18px", fontSize: "12px", color: "#9ca3af" }}>
              From: {escalateTarget.user_email}
            </p>

            <form onSubmit={handleEscalateSave}>
              <div style={{ marginBottom: "12px" }}>
                <label style={labelStyle}>Farm Name</label>
                <input
                  placeholder="Farm name"
                  value={escalateForm.farm_name}
                  onChange={e => setEscalateForm({ ...escalateForm, farm_name: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={labelStyle}>County</label>
                  <input
                    placeholder="County"
                    value={escalateForm.county}
                    onChange={e => setEscalateForm({ ...escalateForm, county: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Bird Count</label>
                  <input
                    type="number" placeholder="Bird count"
                    value={escalateForm.bird_count}
                    onChange={e => setEscalateForm({ ...escalateForm, bird_count: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={labelStyle}>Visit Date</label>
                  <input
                    type="date"
                    value={escalateForm.appointment_date}
                    onChange={e => setEscalateForm({ ...escalateForm, appointment_date: e.target.value })}
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Visit Time</label>
                  <input
                    type="time"
                    value={escalateForm.appointment_time}
                    onChange={e => setEscalateForm({ ...escalateForm, appointment_time: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ marginBottom: "12px" }}>
                <label style={labelStyle}>Urgency</label>
                <select
                  value={escalateForm.urgency}
                  onChange={e => setEscalateForm({ ...escalateForm, urgency: e.target.value })}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="low">Low urgency</option>
                  <option value="medium">Medium urgency</option>
                  <option value="high">High urgency</option>
                </select>
              </div>
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Reason (from the original question)</label>
                <textarea
                  value={escalateForm.reason}
                  onChange={e => setEscalateForm({ ...escalateForm, reason: e.target.value })}
                  style={{ ...inputStyle, minHeight: "80px", resize: "vertical" }}
                />
              </div>

              {escalateError && (
                <div style={{
                  background: "#fef2f2", border: "1px solid #fecaca",
                  color: "#dc2626", padding: "10px 14px",
                  borderRadius: "8px", fontSize: "13px", marginBottom: "14px"
                }}>
                  ⚠️ {escalateError}
                </div>
              )}

              <button
                type="submit"
                disabled={escalateSaving}
                style={{
                  width: "100%", padding: "13px",
                  background: escalateSaving ? "#fca5a5" : "#ef4444",
                  color: "#fff", border: "none", borderRadius: "12px",
                  fontWeight: "700", fontSize: "14px", cursor: escalateSaving ? "not-allowed" : "pointer"
                }}
              >
                {escalateSaving ? "Creating visit..." : "Create Visit & Link Question"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}