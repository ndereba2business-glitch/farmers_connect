import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import FarmerPicker from "../components/FarmerPicker";
import MedicalRecordModal from "../components/MedicalRecordModal";
import VetMessagesModal from "../components/VetMessagesModal";
import {
  Stethoscope, Calendar, AlertTriangle, Users,
  X, Syringe, Pill, Beaker, Send, Clock, ClipboardList,
  CalendarPlus, CheckCircle2, Siren, User, MapPin, Bird
} from "lucide-react";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "12px",
  border: "1.5px solid var(--fc-line-gray200)", fontSize: "14px",
  outline: "none", boxSizing: "border-box",
  background: "var(--fc-bg-gray0)", color: "var(--fc-fg-gray900)"
};

const labelStyle = {
  display: "block", fontSize: "12px", fontWeight: "600",
  color: "var(--fc-fg-gray500)", marginBottom: "5px"
};

const URGENCY_COLORS = {
  low: { bg: "var(--fc-bg-green50)", color: "var(--fc-fg-green700)" },
  medium: { bg: "var(--fc-bg-amber50)", color: "var(--fc-fg-amber600)" },
  high: { bg: "var(--fc-bg-amber51)", color: "var(--fc-fg-amber601)" },
};

const PROFILE_BANNER_META = {
  missing: { bg: "var(--fc-bg-amber50)", border: "var(--fc-line-amber200)", color: "var(--fc-fg-amber800)", text: "You haven't set up your vet profile yet. Complete it so farmers can find and book you." },
  pending: { bg: "var(--fc-bg-blue50)", border: "var(--fc-line-blue200)", color: "var(--fc-fg-blue800)", text: "Your vet profile is pending admin review. You'll be listed to farmers once verified." },
  rejected: { bg: "var(--fc-bg-red50)", border: "var(--fc-line-red200)", color: "var(--fc-fg-red800)", text: "Your vet profile was rejected. Update your details and resubmit." },
  suspended: { bg: "var(--fc-bg-red50)", border: "var(--fc-line-red200)", color: "var(--fc-fg-red800)", text: "Your vet account is suspended. Contact support to appeal." },
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
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(""); // NEW — Phase 2.1 visible error surface
  const [appointments, setAppointments] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]); // NEW — Phase 2.1 recent activity feed
  const [emergencies, setEmergencies] = useState([]);
  const [vetProfileStatus, setVetProfileStatus] = useState(null);
  const [stats, setStats] = useState({
    todayVisits: 0, emergencies: 0, pendingReports: 0,
    totalFarmers: 0, unreadMessages: 0,
    upcomingVisits: 0, pendingRequests: 0, completedVisits: 0 // NEW
  });
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(EMPTY_SCHEDULE_FORM);
  const [scheduleError, setScheduleError] = useState("");

  // ── FARMER PICKER FOR SCHEDULE VISIT ──
  const [selectedFarmer, setSelectedFarmer] = useState(null);

  // ── ESCALATE QUESTION → VISIT ──
  const [escalateTarget, setEscalateTarget] = useState(null);
  const [escalateForm, setEscalateForm] = useState(EMPTY_ESCALATE_FORM);
  const [escalateSaving, setEscalateSaving] = useState(false);
  const [escalateError, setEscalateError] = useState("");

  // ── STANDALONE MEDICAL RECORDS (Prescription/Diagnosis/Vaccination/Lab Results) ──
  const [medicalRecordType, setMedicalRecordType] = useState(null);

  // ── MESSAGE FARMER ──
  const [showMessages, setShowMessages] = useState(false);

  useEffect(() => {
    if (userEmail) loadDashboard();
  }, [userEmail]);

  async function loadDashboard() {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

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
      supabase.from("vet_appointments").select("farmer_email, status, appointment_date")
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
      unreadMessages: 0, // no vet-farmer messaging system yet — see roadmap note below
      upcomingVisits: upcomingVisitsCount, // NEW
      pendingRequests, // NEW
      completedVisits // NEW
    });

    setLoading(false);
  }

  async function updateAppointmentStatus(appt, status) {
    // Only pending -> accepted flows through here today — guard the source
    // status so a stale card can't push a cancelled/completed visit backwards.
    if (status === "accepted") {
      const vetId = user?.id || appt.vet_id;
      // Skip the check when there's no time to compare — see the matching
      // helper in Appointments.jsx for why.
      if (vetId && appt.appointment_time) {
        const { data: conflicts, error: conflictError } = await supabase.from("vet_appointments")
          .select("id")
          .eq("vet_id", vetId)
          .eq("appointment_date", appt.appointment_date)
          .eq("appointment_time", appt.appointment_time)
          .eq("status", "accepted")
          .neq("id", appt.id);
        if (!conflictError && conflicts && conflicts.length > 0) {
          toast.error("You already have another accepted appointment at this exact date and time. Reschedule one of them first.");
          return;
        }
      }
    }
    const { data, error } = await supabase.from("vet_appointments")
      .update({ status })
      .eq("id", appt.id)
      .in("status", ["pending"])
      .select();
    if (error) {
      toast.error("Failed to update appointment: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error("This appointment's status changed elsewhere and could not be updated.");
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
      toast.error("Failed to respond: " + error.message);
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
    if (escalateForm.appointment_date < todayISO()) {
      setEscalateError("Visit date can't be in the past.");
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
      toast.error("Visit created, but couldn't link it back to the original question: " + linkError.message);
    }

    setEscalateTarget(null);
    loadDashboard();
  }

  function closeScheduleForm() {
    setShowScheduleForm(false);
    setScheduleForm(EMPTY_SCHEDULE_FORM);
    setScheduleError("");
    setSelectedFarmer(null);
  }

  async function handleScheduleVisit(e) {
    e.preventDefault();
    setScheduleError("");

    if (!scheduleForm.farm_name || !scheduleForm.appointment_date) return;

    if (scheduleForm.appointment_date < todayISO()) {
      setScheduleError("Visit date can't be in the past.");
      return;
    }

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

  // UPDATED — Phase 2.1: consolidated to 6 glanceable cards (dropped the
  // always-zero "Unread Messages" placeholder; merged "Pending Reports"
  // into "Pending Requests" since both mean "things awaiting your action")
  const STAT_CARDS = [
    { label: "Total Farmers", value: stats.totalFarmers, icon: Users },
    { label: "Upcoming Visits", value: stats.upcomingVisits, icon: CalendarPlus },
    { label: "Pending Requests", value: stats.pendingRequests + stats.pendingReports, icon: ClipboardList },
    { label: "Completed Visits", value: stats.completedVisits, icon: CheckCircle2 },
    { label: "Emergencies", value: stats.emergencies, icon: AlertTriangle, alert: true },
  ];

  const QUICK_ACTIONS = [
    // NEW — Phase 2.1 additions
    { icon: Users, label: "View Farmers", action: () => navigate("/vet/farmers") },
    { icon: ClipboardList, label: "Manage Requests", action: () => navigate("/appointments") },
    // existing
    { icon: Pill, label: "Create Prescription", action: () => setMedicalRecordType("prescription") },
    { icon: Stethoscope, label: "Record Diagnosis", action: () => setMedicalRecordType("diagnosis") },
    { icon: Syringe, label: "Add Vaccination Record", action: () => setMedicalRecordType("vaccination") },
    { icon: Calendar, label: "Schedule Visit", action: () => setShowScheduleForm(true) },
    { icon: Beaker, label: "Upload Lab Results", action: () => setMedicalRecordType("lab_result") },
    { icon: Send, label: "Message Farmer", action: () => setShowMessages(true) },
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
          <h1 className="fc-page-title">Dashboard</h1>
          <p className="fc-page-sub">{greeting}, Dr. {profile?.full_name || "Veterinarian"}</p>
        </div>
      </div>

      {/* LOAD ERROR BANNER — NEW (Phase 2.1) */}
      {!loading && loadError && (
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "12px 16px", borderRadius: "12px",
          background: "var(--fc-bg-red50)", border: "1px solid var(--fc-line-red200)",
          color: "var(--fc-fg-red800)", fontSize: "13px", marginBottom: "20px"
        }}>
          <AlertTriangle size={16} style={{ flexShrink: 0 }} />
          <span>{loadError}</span>
          <button
            onClick={loadDashboard}
            style={{
              marginLeft: "auto", background: "none", border: "1px solid var(--fc-line-red300)",
              borderRadius: "8px", padding: "4px 12px", cursor: "pointer",
              color: "var(--fc-fg-red800)", fontWeight: "600", fontSize: "12px", flexShrink: 0
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
          padding: "14px 18px", borderRadius: "12px",
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
              padding: "8px 16px", background: "var(--fc-bg-gray0)", border: `1px solid ${profileBanner.border}`,
              borderRadius: "8px", fontWeight: "700", fontSize: "12px", color: profileBanner.color,
              cursor: "pointer", whiteSpace: "nowrap"
            }}
          >
            {vetProfileStatus === "missing" ? "Set Up Profile" : "Update Profile"}
          </button>
        </div>
      )}

      {/* FIGURES */}
      <div className="fc-stats" style={{ marginBottom: "16px" }}>
        {STAT_CARDS.map(item => {
          const Icon = item.icon;
          return (
            <div key={item.label} className={`fc-stat fc-stat--static${item.alert && item.value > 0 ? " fc-stat--danger" : ""}`}>
              <span className="fc-stat-label"><Icon size={16} aria-hidden="true" /> {item.label}</span>
              <span className="fc-stat-value">{loading ? "—" : item.value}</span>
            </div>
          );
        })}
      </div>

      {/* MAIN GRID */}
      <div className="fc-grid-2" style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "18px" }}>

        {/* UPCOMING APPOINTMENTS */}
        <div style={{
          background: "var(--fc-bg-gray0)", borderRadius: "16px", padding: "24px",
          border: "1px solid var(--fc-line-gray200)", boxShadow: "var(--fc-shadow-card)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px", marginBottom: "18px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
                Upcoming visits
              </h2>
              <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--fc-fg-gray400)" }}>
                Next 7 days
              </p>
            </div>
            <span style={{ fontSize: "13px", color: "var(--fc-fg-green700)", fontWeight: "600" }}>
              {appointments.length} scheduled
            </span>
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: "96px", borderRadius: "16px", background: "var(--fc-bg-gray100)" }} />
              ))}
            </div>
          ) : appointments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px" }}>
              <Calendar size={40} color="var(--fc-fg-gray200)" style={{ marginBottom: "10px" }} />
              <p style={{ color: "var(--fc-fg-gray400)", fontSize: "14px" }}>No appointments scheduled in the next 7 days.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {appointments.map(appt => {
                const urgency = URGENCY_COLORS[appt.urgency] || URGENCY_COLORS.medium;
                return (
                  <div key={appt.id} style={{ border: "1px solid var(--fc-line-gray101)", borderRadius: "16px", padding: "16px" }}>
                    <div style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "flex-start", flexWrap: "wrap", gap: "10px"
                    }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: "700", fontSize: "15px", color: "var(--fc-fg-gray900)" }}>
                            {appt.farm_name}
                          </span>
                          <span style={{
                            fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                            borderRadius: "16px", background: urgency.bg, color: urgency.color,
                            textTransform: "capitalize"
                          }}>
                            {appt.urgency}
                          </span>
                          <span style={{
                            fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "16px",
                            background: appt.status === "accepted" ? "var(--fc-bg-green100)" : "var(--fc-bg-amber100)",
                            color: appt.status === "accepted" ? "var(--fc-fg-green700)" : "var(--fc-fg-amber600)",
                            textTransform: "capitalize"
                          }}>
                            {appt.status}
                          </span>
                          {appt.appointment_date === todayStr && (
                            <span style={{
                              fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "16px",
                              background: "var(--fc-bg-blue100)", color: "var(--fc-fg-blue700)"
                            }}>
                              Today
                            </span>
                          )}
                          {appt.source === "escalated_question" && (
                            <span style={{
                              fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "16px",
                              background: "var(--fc-bg-red50)", color: "var(--fc-fg-red500)"
                            }}>
                              <Siren size={14} aria-hidden="true" /> From Emergency
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--fc-fg-gray400)", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                          {appt.farmer_email && <span><User size={14} aria-hidden="true" /> {appt.farmer_email}</span>}
                          {appt.appointment_time && (
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={11} /> {appt.appointment_time}
                            </span>
                          )}
                          {appt.county && <span><MapPin size={14} aria-hidden="true" /> {appt.county}</span>}
                          {appt.bird_count && <span><Bird size={14} aria-hidden="true" /> {appt.bird_count} birds</span>}
                        </div>
                        {appt.reason && (
                          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--fc-fg-gray500)" }}>{appt.reason}</p>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
                        {appt.status !== "accepted" && (
                          <button
                            onClick={() => updateAppointmentStatus(appt, "accepted")}
                            style={{
                              padding: "8px 16px", background: "#15803d", color: "var(--fc-fg-gray0)",
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
                            padding: "8px 16px", background: "var(--fc-bg-gray0)", color: "var(--fc-fg-gray700)",
                            border: "1px solid var(--fc-line-gray200)", borderRadius: "8px",
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
          background: "var(--fc-bg-gray0)", borderRadius: "16px", padding: "24px",
          border: "1px solid var(--fc-line-gray200)", boxShadow: "var(--fc-shadow-card)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
              Emergency Requests
            </h2>
            {emergencies.length > 0 && (
              <span style={{
                background: "#dc2626", color: "var(--fc-fg-gray0)", fontSize: "12px", fontWeight: "700",
                width: "22px", height: "22px", borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {emergencies.length}
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2].map(i => (
                <div key={i} style={{ height: "96px", borderRadius: "16px", background: "var(--fc-bg-gray100)" }} />
              ))}
            </div>
          ) : emergencies.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 10px" }}>
              <AlertTriangle size={36} color="var(--fc-fg-gray200)" style={{ marginBottom: "10px" }} />
              <p style={{ color: "var(--fc-fg-gray400)", fontSize: "13px" }}>No active emergencies.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {emergencies.map(em => (
                <div key={em.id} style={{
                  border: "1px solid var(--fc-line-red200)", borderRadius: "16px", padding: "14px", background: "var(--fc-bg-red50)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "6px", gap: "8px" }}>
                    <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--fc-fg-gray900)", wordBreak: "break-word" }}>
                      {em.user_email}
                    </span>
                    <span style={{
                      fontSize: "10px", fontWeight: "700", padding: "2px 8px", borderRadius: "16px",
                      background: "#dc2626", color: "var(--fc-fg-gray0)", textTransform: "uppercase", flexShrink: 0
                    }}>
                      {em.severity || "high"}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 10px", fontSize: "12px", color: "var(--fc-fg-red900)" }}>
                    {em.question}
                  </p>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => respondToEmergency(em)}
                      style={{
                        flex: 1, padding: "8px", background: "#dc2626", color: "var(--fc-fg-gray0)",
                        border: "none", borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: "pointer"
                      }}
                    >
                      Respond
                    </button>
                    <button
                      onClick={() => openEscalate(em)}
                      style={{
                        flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "5px",
                        padding: "8px", background: "var(--fc-bg-gray0)", color: "var(--fc-fg-red500)",
                        border: "1px solid var(--fc-line-red500)", borderRadius: "8px", fontWeight: "700", fontSize: "12px", cursor: "pointer"
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
        background: "var(--fc-bg-gray0)", borderRadius: "16px", padding: "24px",
        border: "1px solid var(--fc-line-gray200)", boxShadow: "var(--fc-shadow-card)", marginTop: "18px"
      }}>
        <h2 style={{ margin: "0 0 16px", fontSize: "18px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
          Recent Activity
        </h2>

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: "44px", borderRadius: "12px", background: "var(--fc-bg-gray100)" }} />
            ))}
          </div>
        ) : recentActivity.length === 0 ? (
          <p style={{ margin: 0, color: "var(--fc-fg-gray400)", fontSize: "14px" }}>
            No recent activity yet — new bookings and status changes will show up here.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recentActivity.map(item => (
              <div key={item.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "10px 14px", borderRadius: "12px", background: "var(--fc-bg-gray50)"
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: "600", fontSize: "13px", color: "var(--fc-fg-gray900)" }}>
                    {item.farm_name || "Untitled visit"}
                  </div>
                  <div style={{ fontSize: "11px", color: "var(--fc-fg-gray400)" }}>
                    {item.appointment_date} · {timeAgo(item.created_at)}
                  </div>
                </div>
                <span style={{
                  fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "16px",
                  background: item.status === "completed" ? "var(--fc-bg-green100)"
                    : item.status === "accepted" ? "var(--fc-bg-blue100)"
                    : "var(--fc-bg-amber100)",
                  color: item.status === "completed" ? "var(--fc-fg-green700)"
                    : item.status === "accepted" ? "var(--fc-fg-blue700)"
                    : "var(--fc-fg-amber600)",
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
      <div className="fc-card" style={{ marginTop: "16px" }}>
        <h2 className="fc-section-title">Quick actions</h2>
        <div className="fc-quick fc-quick--wide">
          {QUICK_ACTIONS.map(({ icon: Icon, label, action }) => (
            <button key={label} type="button" className="fc-quick-btn" onClick={action}>
              <Icon size={20} aria-hidden="true" />
              <span>{label}</span>
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
            style={{ background: "var(--fc-bg-gray0)", borderRadius: "16px", padding: "28px", maxWidth: "480px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>Schedule a Visit</h2>
              <button onClick={closeScheduleForm} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleScheduleVisit}>

              {/* FARMER PICKER */}
              <div style={{ marginBottom: "12px" }}>
                <label style={labelStyle}>Farmer</label>
                <FarmerPicker value={selectedFarmer} onChange={setSelectedFarmer} />
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
                  min={todayISO()}
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
                  background: "var(--fc-bg-red50)", border: "1px solid var(--fc-line-red200)",
                  color: "var(--fc-fg-red600)", padding: "10px 14px",
                  borderRadius: "8px", fontSize: "13px", marginBottom: "14px"
                }}>
                  <AlertTriangle size={14} aria-hidden="true" /> {scheduleError}
                </div>
              )}

              <button
                type="submit"
                disabled={saving}
                style={{
                  width: "100%", padding: "13px",
                  background: saving ? "var(--fc-bg-green300)" : "#15803d",
                  color: "var(--fc-fg-gray0)", border: "none", borderRadius: "12px",
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
              background: "var(--fc-bg-gray0)", borderRadius: "16px", padding: "28px",
              maxWidth: "480px", width: "100%", maxHeight: "90vh", overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
                Escalate to Visit
              </h2>
              <button onClick={() => setEscalateTarget(null)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} color="var(--fc-fg-gray400)" />
              </button>
            </div>
            <p style={{ margin: "0 0 18px", fontSize: "12px", color: "var(--fc-fg-gray400)" }}>
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
                    min={todayISO()}
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
                  background: "var(--fc-bg-red50)", border: "1px solid var(--fc-line-red200)",
                  color: "var(--fc-fg-red600)", padding: "10px 14px",
                  borderRadius: "8px", fontSize: "13px", marginBottom: "14px"
                }}>
                  <AlertTriangle size={14} aria-hidden="true" /> {escalateError}
                </div>
              )}

              <button
                type="submit"
                disabled={escalateSaving}
                style={{
                  width: "100%", padding: "13px",
                  background: escalateSaving ? "var(--fc-bg-red300)" : "#dc2626",
                  color: "var(--fc-fg-gray0)", border: "none", borderRadius: "12px",
                  fontWeight: "700", fontSize: "14px", cursor: escalateSaving ? "not-allowed" : "pointer"
                }}
              >
                {escalateSaving ? "Creating visit..." : "Create Visit & Link Question"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* STANDALONE MEDICAL RECORD MODAL */}
      {medicalRecordType && (
        <MedicalRecordModal
          recordType={medicalRecordType}
          onClose={() => setMedicalRecordType(null)}
        />
      )}

      {/* MESSAGE FARMER MODAL */}
      {showMessages && (
        <VetMessagesModal onClose={() => setShowMessages(false)} />
      )}
    </div>
  );
}