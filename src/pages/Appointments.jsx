import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Calendar, Clock, Plus, X, CheckCircle2, Inbox, XCircle, Eye, Ban
} from "lucide-react";
import { VisitReportFields } from "../components/VisitReportModal";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// Only these transitions are allowed — once a visit is completed, cancelled
// or rejected it's terminal. Rejection only applies to a still-pending
// request — once a vet has accepted it, declining means cancelling instead.
const STATUS_TRANSITIONS = {
  pending: ["accepted", "cancelled", "completed", "rejected"],
  accepted: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
  rejected: [],
};

function canTransition(currentStatus, targetStatus) {
  return (STATUS_TRANSITIONS[currentStatus] || []).includes(targetStatus);
}

// Statuses a row must currently be in for `targetStatus` to be a legal move —
// passed to Supabase as an .in() filter so a concurrent update (another vet
// claiming it, a farmer cancelling it) can't be silently overwritten.
function sourceStatusesFor(targetStatus) {
  return Object.keys(STATUS_TRANSITIONS).filter(s => STATUS_TRANSITIONS[s].includes(targetStatus));
}

// Phase 4.2 — pre-check before accepting so a vet gets a clean message
// instead of a raw constraint error; the DB's partial unique index on
// (vet_id, appointment_date, appointment_time) where status='accepted' is
// the authoritative backstop for the race two concurrent accepts create.
// Appointments with no time set are skipped — without a time there's no
// reliable way to tell two same-day visits actually conflict.
async function hasConflictingAcceptedAppointment(vetId, appt) {
  if (!vetId || !appt.appointment_time) return false;
  const { data, error } = await supabase.from("vet_appointments")
    .select("id")
    .eq("vet_id", vetId)
    .eq("appointment_date", appt.appointment_date)
    .eq("appointment_time", appt.appointment_time)
    .eq("status", "accepted")
    .neq("id", appt.id);
  if (error) {
    console.error("Appointments: double-booking check failed —", error.message);
    return false; // don't block accepting just because the check itself failed
  }
  return (data || []).length > 0;
}

// Best-effort status update for the farmer — reuses the existing
// notifications table/NotificationsBell (src/components/NotificationsBell.jsx),
// already wired up for every role. Never blocks or surfaces errors to the
// vet: the appointment mutation already succeeded by the time this runs.
async function notifyFarmer(appt, title, message) {
  if (!appt.farmer_email) return;
  const { error } = await supabase.from("notifications").insert([{
    user_email: appt.farmer_email,
    type: "vet",
    title,
    message,
  }]);
  if (error) console.error("Appointments: failed to notify farmer —", error.message);
}

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

const EMPTY_FORM = {
  farm_name: "", county: "", bird_count: "",
  appointment_date: "", appointment_time: "", reason: "", urgency: "medium"
};

const EMPTY_VISIT_FORM = {
  symptoms: "", diagnosis: "", treatment: "", vet_notes: "", fee: ""
};

const EMPTY_MEDICATION = { name: "", dosage: "", instructions: "" };

export default function Appointments() {
  const { userEmail, user } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState("upcoming");

  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [newFormError, setNewFormError] = useState("");

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editFormError, setEditFormError] = useState("");

  const [completeTarget, setCompleteTarget] = useState(null);
  const [visitForm, setVisitForm] = useState(EMPTY_VISIT_FORM);
  const [medications, setMedications] = useState([]);

  const [detailsTarget, setDetailsTarget] = useState(null);
  const [visitRecord, setVisitRecord] = useState(null);
  const [loadingVisitRecord, setLoadingVisitRecord] = useState(false);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userEmail) loadAppointments();
  }, [userEmail, user?.id]);

  async function loadAppointments() {
    setLoading(true);

    // A vet needs to see: appointments already assigned to them (by id or
    // legacy email), plus the open claim pool — unassigned requests that are
    // either not targeted at a specific vet, or specifically targeted at them.
    const orParts = [
      `vet_email.eq.${userEmail}`,
      `and(vet_id.is.null,vet_email.is.null,requested_vet_id.is.null)`,
    ];
    if (user?.id) {
      orParts.push(`vet_id.eq.${user.id}`);
      orParts.push(`and(vet_id.is.null,vet_email.is.null,requested_vet_id.eq.${user.id})`);
    }

    const { data, error } = await supabase
      .from("vet_appointments")
      .select("*")
      .or(orParts.join(","))
      .order("appointment_date", { ascending: true })
      .order("appointment_time", { ascending: true });

    if (error) {
      console.error("Appointments: failed to load —", error.message);
      setLoading(false);
      return;
    }
    setAppointments(data || []);
    setLoading(false);
    sendDueReminders(data || []); // fire-and-forget, doesn't block the UI
  }

  // Phase 5 — appointment reminders, checked opportunistically whenever a
  // vet loads their appointments (no scheduled job exists in this repo —
  // see the Phase 5 plan). Sends once per appointment via reminder_sent.
  async function sendDueReminders(list) {
    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const due = list.filter(a =>
      a.status === "accepted" && !a.reminder_sent &&
      (a.appointment_date === today || a.appointment_date === tomorrow)
    );
    if (due.length === 0) return;

    await Promise.all(due.map(async (appt) => {
      await notifyFarmer(
        appt,
        "Upcoming visit reminder",
        `Reminder: your visit for ${appt.farm_name} is on ${appt.appointment_date}${appt.appointment_time ? ` at ${appt.appointment_time}` : ""}.`
      );
      const { error: flagError } = await supabase.from("vet_appointments")
        .update({ reminder_sent: true })
        .eq("id", appt.id);
      if (flagError) console.error("Appointments: failed to flag reminder sent —", flagError.message);
    }));
  }

  const isMine = (a) =>
    (user?.id && a.vet_id === user.id) || a.vet_email === userEmail;

  const upcoming = appointments.filter(a =>
    isMine(a) && ["pending", "accepted"].includes(a.status)
  );
  // Only still-pending requests are claimable — a request the farmer already
  // cancelled shouldn't show up as available to pick up.
  const unassigned = appointments.filter(a => !a.vet_id && !a.vet_email && a.status === "pending");
  const completed = appointments.filter(a => isMine(a) && a.status === "completed");
  const cancelled = appointments.filter(a => isMine(a) && a.status === "cancelled");
  const rejected = appointments.filter(a => isMine(a) && a.status === "rejected");

  const TABS = [
    { key: "upcoming", label: "Upcoming", count: upcoming.length },
    { key: "unassigned", label: "Unassigned Requests", count: unassigned.length },
    { key: "completed", label: "Completed", count: completed.length },
    { key: "cancelled", label: "Cancelled", count: cancelled.length },
    { key: "rejected", label: "Rejected", count: rejected.length },
  ];

  const displayList =
    activeTab === "upcoming" ? upcoming :
    activeTab === "unassigned" ? unassigned :
    activeTab === "completed" ? completed :
    activeTab === "cancelled" ? cancelled :
    rejected;

  async function claimAppointment(appt) {
    if (!user?.id) {
      toast.error("You must be logged in to claim an appointment.");
      return;
    }
    if (appt.status !== "pending") {
      toast.error("This request is no longer available to claim.");
      loadAppointments();
      return;
    }
    const { data, error } = await supabase.from("vet_appointments")
      .update({ vet_id: user.id, vet_email: userEmail })
      .eq("id", appt.id)
      .is("vet_id", null)
      .is("vet_email", null)
      .select();
    if (error) { toast.error("Failed to claim: " + error.message); return; }
    if (!data || data.length === 0) {
      toast.error("Another vet already claimed this request.");
    }
    loadAppointments();
  }

  async function acceptAppointment(appt) {
    if (!canTransition(appt.status, "accepted")) {
      toast.error(`Can't accept an appointment that's already ${appt.status}.`);
      loadAppointments();
      return;
    }
    const vetId = user?.id || appt.vet_id;
    if (await hasConflictingAcceptedAppointment(vetId, appt)) {
      toast.error("You already have another accepted appointment at this exact date and time. Reschedule one of them first.");
      return;
    }
    const { data, error } = await supabase.from("vet_appointments")
      .update({
        status: "accepted",
        ...(user?.id ? { vet_id: user.id } : {}),
        vet_email: userEmail
      })
      .eq("id", appt.id)
      .in("status", sourceStatusesFor("accepted"))
      .select();
    if (error) { toast.error("Failed to accept: " + error.message); return; }
    if (!data || data.length === 0) {
      toast.error("This appointment's status changed elsewhere and can no longer be accepted.");
    } else {
      notifyFarmer(appt, "Visit request accepted", `Your visit request for ${appt.farm_name} on ${appt.appointment_date} was accepted.`);
    }
    loadAppointments();
  }

  function openReject(appt) {
    if (!canTransition(appt.status, "rejected")) {
      toast.error(`Can't reject an appointment that's already ${appt.status}.`);
      return;
    }
    setRejectReason("");
    setRejectTarget(appt);
  }

  async function handleRejectSave(e) {
    e.preventDefault();
    if (!rejectReason.trim()) return;
    setSaving(true);
    const { data, error } = await supabase.from("vet_appointments")
      .update({ status: "rejected", rejection_reason: rejectReason.trim() })
      .eq("id", rejectTarget.id)
      .in("status", sourceStatusesFor("rejected"))
      .select();
    setSaving(false);
    if (error) { toast.error("Failed to reject: " + error.message); return; }
    if (!data || data.length === 0) {
      toast.error("This appointment's status changed elsewhere and can no longer be rejected.");
    } else {
      notifyFarmer(rejectTarget, "Visit request declined", `Your visit request for ${rejectTarget.farm_name} on ${rejectTarget.appointment_date} was declined: ${rejectReason.trim()}`);
    }
    setRejectTarget(null);
    loadAppointments();
  }

  async function cancelAppointment(appt) {
    if (!canTransition(appt.status, "cancelled")) {
      toast.error(`Can't cancel an appointment that's already ${appt.status}.`);
      loadAppointments();
      return;
    }
    if (!window.confirm("Cancel this appointment?")) return;
    const { data, error } = await supabase.from("vet_appointments")
      .update({ status: "cancelled" })
      .eq("id", appt.id)
      .in("status", sourceStatusesFor("cancelled"))
      .select();
    if (error) { toast.error("Failed to cancel: " + error.message); return; }
    if (!data || data.length === 0) {
      toast.error("This appointment's status changed elsewhere and can no longer be cancelled.");
    } else {
      notifyFarmer(appt, "Visit cancelled", `Your visit for ${appt.farm_name} on ${appt.appointment_date} was cancelled by the vet.`);
    }
    loadAppointments();
  }

  function openEdit(appt) {
    if (!["pending", "accepted"].includes(appt.status)) {
      toast.error(`Can't reschedule an appointment that's already ${appt.status}.`);
      return;
    }
    setEditForm({
      farm_name: appt.farm_name || "",
      county: appt.county || "",
      bird_count: appt.bird_count || "",
      appointment_date: appt.appointment_date || "",
      appointment_time: appt.appointment_time || "",
      reason: appt.reason || "",
      urgency: appt.urgency || "medium"
    });
    setEditFormError("");
    setEditTarget(appt);
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setEditFormError("");
    if (editForm.appointment_date < todayISO()) {
      setEditFormError("Appointment date can't be in the past.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.from("vet_appointments").update({
      farm_name: editForm.farm_name,
      county: editForm.county,
      bird_count: editForm.bird_count ? Number(editForm.bird_count) : null,
      appointment_date: editForm.appointment_date,
      appointment_time: editForm.appointment_time,
      reason: editForm.reason,
      urgency: editForm.urgency
    })
      .eq("id", editTarget.id)
      .in("status", ["pending", "accepted"])
      .select();
    setSaving(false);
    if (error) { toast.error("Failed to save changes: " + error.message); return; }
    if (!data || data.length === 0) {
      toast.error("This appointment's status changed elsewhere and can no longer be rescheduled.");
    }
    setEditTarget(null);
    loadAppointments();
  }

  async function openDetails(appt) {
    setDetailsTarget(appt);
    setVisitRecord(null);
    if (appt.status !== "completed") return;
    setLoadingVisitRecord(true);
    const { data, error } = await supabase.from("visit_records")
      .select("*")
      .eq("appointment_id", appt.id)
      .maybeSingle();
    if (error) console.error("Appointments: failed to load visit record —", error.message);
    setVisitRecord(data || null);
    setLoadingVisitRecord(false);
  }

  function openComplete(appt) {
    if (!canTransition(appt.status, "completed")) {
      toast.error(`Can't mark an appointment complete when it's already ${appt.status}.`);
      return;
    }
    setVisitForm(EMPTY_VISIT_FORM);
    setMedications([]);
    setCompleteTarget(appt);
  }

  function addMedication() {
    setMedications(m => [...m, { ...EMPTY_MEDICATION }]);
  }

  function updateMedication(index, field, value) {
    setMedications(m => m.map((med, i) => i === index ? { ...med, [field]: value } : med));
  }

  function removeMedication(index) {
    setMedications(m => m.filter((_, i) => i !== index));
  }

  async function handleCompleteSave(e) {
    e.preventDefault();
    setSaving(true);

    // Completing a visit is two writes (appointment status + the clinical
    // record) — the appointment update is guarded first since it's the one
    // other vets/farmers race against; the visit record only matters once
    // that's confirmed to have actually landed.
    const { data, error } = await supabase.from("vet_appointments").update({
      status: "completed",
      fee: visitForm.fee ? Number(visitForm.fee) : 0,
      completed_at: new Date().toISOString()
    })
      .eq("id", completeTarget.id)
      .in("status", sourceStatusesFor("completed"))
      .select();

    if (error) { setSaving(false); toast.error("Failed to mark complete: " + error.message); return; }
    if (!data || data.length === 0) {
      setSaving(false);
      toast.error("This appointment's status changed elsewhere and can no longer be marked complete.");
      setCompleteTarget(null);
      loadAppointments();
      return;
    }

    const cleanMedications = medications
      .filter(m => m.name.trim())
      .map(m => ({ name: m.name.trim(), dosage: m.dosage.trim(), instructions: m.instructions.trim() }));

    const { error: visitRecordError } = await supabase.from("visit_records").insert([{
      appointment_id: completeTarget.id,
      vet_id: user?.id || null,
      vet_email: userEmail,
      farmer_id: completeTarget.farmer_id || null,
      farmer_email: completeTarget.farmer_email || null,
      symptoms: visitForm.symptoms.trim() || null,
      diagnosis: visitForm.diagnosis.trim() || null,
      treatment: visitForm.treatment.trim() || null,
      medications: cleanMedications,
      vet_notes: visitForm.vet_notes.trim() || null,
    }]);

    setSaving(false);

    if (visitRecordError) {
      // The appointment is already marked completed at this point — surface
      // this loudly rather than silently leaving a visit with no record.
      toast.error("Visit marked complete, but the clinical record failed to save: " + visitRecordError.message);
    } else {
      notifyFarmer(completeTarget, "Visit completed", `Your visit for ${completeTarget.farm_name} on ${completeTarget.appointment_date} has been marked complete.`);
    }
    setCompleteTarget(null);
    loadAppointments();
  }

  async function handleNewAppointment(e) {
    e.preventDefault();
    setNewFormError("");
    if (!newForm.farm_name || !newForm.appointment_date) {
      setNewFormError("Farm name and date are required.");
      return;
    }
    if (newForm.appointment_date < todayISO()) {
      setNewFormError("Appointment date can't be in the past.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("vet_appointments").insert([{
      vet_id: user?.id || null,
      vet_email: userEmail,
      farm_name: newForm.farm_name,
      county: newForm.county,
      bird_count: newForm.bird_count ? Number(newForm.bird_count) : null,
      appointment_date: newForm.appointment_date,
      appointment_time: newForm.appointment_time,
      reason: newForm.reason,
      urgency: newForm.urgency,
      status: "pending",
      source: "direct"
    }]);
    setSaving(false);
    if (error) { setNewFormError("Failed to create appointment: " + error.message); return; }
    setNewForm(EMPTY_FORM);
    setShowNewForm(false);
    loadAppointments();
  }

  return (
    <div>
      {/* HEADER */}
      <div className="fc-page-header" style={{ marginBottom: "20px" }}>
        <div>
          <h1 className="fc-page-title" style={{ margin: 0, fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
            Appointments
          </h1>
          <p style={{ marginTop: "6px", color: "#6b7280", fontSize: "15px" }}>
            Manage farm visits, requests, and your visit history
          </p>
        </div>
        <button
          onClick={() => { setNewFormError(""); setShowNewForm(true); }}
          style={{
            height: "44px", padding: "0 20px", border: "none", borderRadius: "12px",
            background: "linear-gradient(135deg,#22c55e,#16a34a)", color: "#fff",
            fontWeight: "700", cursor: "pointer", fontSize: "14px",
            display: "flex", alignItems: "center", gap: "8px",
            boxShadow: "0 6px 20px rgba(34,197,94,0.3)"
          }}
        >
          <Plus size={18} /> New Appointment
        </button>
      </div>

      {/* TABS */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", flexWrap: "wrap" }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "9px 18px", borderRadius: "20px",
              border: `1.5px solid ${activeTab === tab.key ? "#111827" : "#e5e7eb"}`,
              background: activeTab === tab.key ? "#111827" : "#fff",
              color: activeTab === tab.key ? "#fff" : "#6b7280",
              fontWeight: "600", fontSize: "13px", cursor: "pointer"
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* LIST */}
      {loading ? (
        <p style={{ color: "#9ca3af", fontSize: "14px" }}>Loading...</p>
      ) : displayList.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "70px 20px",
          background: "#fff", borderRadius: "24px", border: "1px solid #f0f0f0"
        }}>
          {activeTab === "unassigned" ? (
            <Inbox size={48} color="#e5e7eb" style={{ marginBottom: "14px" }} />
          ) : activeTab === "completed" ? (
            <CheckCircle2 size={48} color="#e5e7eb" style={{ marginBottom: "14px" }} />
          ) : activeTab === "cancelled" ? (
            <XCircle size={48} color="#e5e7eb" style={{ marginBottom: "14px" }} />
          ) : activeTab === "rejected" ? (
            <Ban size={48} color="#e5e7eb" style={{ marginBottom: "14px" }} />
          ) : (
            <Calendar size={48} color="#e5e7eb" style={{ marginBottom: "14px" }} />
          )}
          <p style={{ color: "#9ca3af", fontSize: "14px" }}>
            {activeTab === "upcoming" && "No upcoming appointments. Schedule one to get started."}
            {activeTab === "unassigned" && "No unclaimed requests right now."}
            {activeTab === "completed" && "No completed visits yet."}
            {activeTab === "cancelled" && "No cancelled appointments."}
            {activeTab === "rejected" && "No rejected requests."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {displayList.map(appt => {
            const urgency = URGENCY_COLORS[appt.urgency] || URGENCY_COLORS.medium;
            return (
              <div key={appt.id} style={{
                background: "#fff", borderRadius: "18px", padding: "18px 20px",
                border: "1px solid #e5e7eb", boxShadow: "0 2px 10px rgba(0,0,0,0.04)",
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", flexWrap: "wrap", gap: "14px"
              }}>
                <div style={{ flex: 1, minWidth: "220px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "700", fontSize: "16px", color: "#111827" }}>
                      {appt.farm_name}
                    </span>
                    <span style={{
                      fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                      borderRadius: "20px", background: urgency.bg, color: urgency.color,
                      textTransform: "capitalize"
                    }}>
                      {appt.urgency}
                    </span>
                    {activeTab === "unassigned" && (
                      <span style={{
                        fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                        borderRadius: "20px", background: "#eff6ff", color: "#3b82f6"
                      }}>
                        {appt.requested_vet_id ? "Requested — You" : "Unclaimed"}
                      </span>
                    )}
                    {activeTab === "upcoming" && (
                      <span style={{
                        fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "20px",
                        background: appt.status === "accepted" ? "#dcfce7" : "#fef3c7",
                        color: appt.status === "accepted" ? "#16a34a" : "#d97706",
                        textTransform: "capitalize"
                      }}>
                        {appt.status}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "13px", color: "#6b7280", display: "flex", gap: "14px", flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Calendar size={12} /> {appt.appointment_date}
                    </span>
                    {appt.appointment_time && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} /> {appt.appointment_time}
                      </span>
                    )}
                    {appt.county && <span>📍 {appt.county}</span>}
                    {appt.bird_count && <span>🐔 {appt.bird_count} birds</span>}
                    {activeTab === "completed" && (
                      <span style={{ color: "#16a34a", fontWeight: "700" }}>
                        KES {Number(appt.fee || 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {appt.reason && (
                    <p style={{ margin: "10px 0 0", fontSize: "13px", color: "#6b7280" }}>{appt.reason}</p>
                  )}
                  {activeTab === "rejected" && appt.rejection_reason && (
                    <p style={{ margin: "10px 0 0", fontSize: "13px", color: "#991b1b", background: "#fef2f2", padding: "8px 12px", borderRadius: "8px" }}>
                      <strong>Reason:</strong> {appt.rejection_reason}
                    </p>
                  )}
                </div>

                {/* ACTIONS */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button onClick={() => openDetails(appt)} style={btnGhost}>
                    <Eye size={13} style={{ marginRight: "5px", verticalAlign: "-2px" }} />
                    Details
                  </button>
                  {activeTab === "unassigned" && (
                    <button onClick={() => claimAppointment(appt)} style={btnPrimary}>
                      Claim
                    </button>
                  )}
                  {activeTab === "unassigned" && appt.requested_vet_id && (
                    <button onClick={() => openReject(appt)} style={btnDanger}>
                      Reject
                    </button>
                  )}
                  {activeTab === "upcoming" && (
                    <>
                      {appt.status !== "accepted" && (
                        <button onClick={() => acceptAppointment(appt)} style={btnPrimary}>
                          Accept
                        </button>
                      )}
                      {appt.status === "pending" && (
                        <button onClick={() => openReject(appt)} style={btnDanger}>
                          Reject
                        </button>
                      )}
                      <button onClick={() => openComplete(appt)} style={btnGhost}>
                        Mark Complete
                      </button>
                      <button onClick={() => openEdit(appt)} style={btnGhost}>
                        Reschedule
                      </button>
                      <button onClick={() => cancelAppointment(appt)} style={btnDanger}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* NEW APPOINTMENT MODAL */}
      {showNewForm && (
        <Modal title="New Appointment" onClose={() => setShowNewForm(false)}>
          <form onSubmit={handleNewAppointment}>
            <AppointmentFields form={newForm} setForm={setNewForm} />
            {newFormError && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                color: "#dc2626", padding: "10px 14px",
                borderRadius: "8px", fontSize: "13px", marginBottom: "14px"
              }}>
                ⚠️ {newFormError}
              </div>
            )}
            <SubmitButton saving={saving} label="Create Appointment" />
          </form>
        </Modal>
      )}

      {/* EDIT / RESCHEDULE MODAL */}
      {editTarget && (
        <Modal title="Reschedule Appointment" onClose={() => setEditTarget(null)}>
          <form onSubmit={handleEditSave}>
            <AppointmentFields form={editForm} setForm={setEditForm} />
            {editFormError && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                color: "#dc2626", padding: "10px 14px",
                borderRadius: "8px", fontSize: "13px", marginBottom: "14px"
              }}>
                ⚠️ {editFormError}
              </div>
            )}
            <SubmitButton saving={saving} label="Save Changes" />
          </form>
        </Modal>
      )}

      {/* COMPLETE VISIT MODAL — captures the clinical record (Phase 3.2) */}
      {completeTarget && (
        <Modal title="Complete Visit" onClose={() => setCompleteTarget(null)}>
          <form onSubmit={handleCompleteSave}>
            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
              {completeTarget.farm_name} — {completeTarget.appointment_date}
            </p>

            <label style={labelStyle}>Symptoms observed</label>
            <textarea
              placeholder="e.g. Lethargy, reduced feed intake, respiratory distress..."
              value={visitForm.symptoms}
              onChange={e => setVisitForm({ ...visitForm, symptoms: e.target.value })}
              style={{ ...inputStyle, minHeight: "70px", resize: "vertical", marginBottom: "14px" }}
            />

            <label style={labelStyle}>Diagnosis</label>
            <textarea
              placeholder="e.g. Suspected Newcastle disease"
              value={visitForm.diagnosis}
              onChange={e => setVisitForm({ ...visitForm, diagnosis: e.target.value })}
              style={{ ...inputStyle, minHeight: "60px", resize: "vertical", marginBottom: "14px" }}
            />

            <label style={labelStyle}>Treatment given</label>
            <textarea
              placeholder="e.g. Supportive care, isolated affected birds..."
              value={visitForm.treatment}
              onChange={e => setVisitForm({ ...visitForm, treatment: e.target.value })}
              style={{ ...inputStyle, minHeight: "60px", resize: "vertical", marginBottom: "14px" }}
            />

            {/* MEDICATIONS */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Medications</label>
              <button type="button" onClick={addMedication} style={{ ...btnGhost, padding: "5px 12px" }}>
                <Plus size={12} style={{ marginRight: "4px", verticalAlign: "-2px" }} />
                Add
              </button>
            </div>
            {medications.length === 0 ? (
              <p style={{ margin: "0 0 14px", fontSize: "12px", color: "#9ca3af" }}>
                None added yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
                {medications.map((med, i) => (
                  <div key={i} style={{
                    border: "1px solid #e5e7eb", borderRadius: "10px", padding: "12px",
                    display: "flex", flexDirection: "column", gap: "8px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#6b7280" }}>Medication {i + 1}</span>
                      <button type="button" onClick={() => removeMedication(i)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                        <X size={14} color="#9ca3af" />
                      </button>
                    </div>
                    <input
                      placeholder="Name (e.g. Amoxicillin)"
                      value={med.name}
                      onChange={e => updateMedication(i, "name", e.target.value)}
                      style={inputStyle}
                    />
                    <input
                      placeholder="Dosage (e.g. 1g per 5L water)"
                      value={med.dosage}
                      onChange={e => updateMedication(i, "dosage", e.target.value)}
                      style={inputStyle}
                    />
                    <input
                      placeholder="Instructions (e.g. Twice daily for 5 days)"
                      value={med.instructions}
                      onChange={e => updateMedication(i, "instructions", e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>
            )}

            <label style={labelStyle}>Vet notes (optional)</label>
            <textarea
              placeholder="Anything else worth recording for future visits..."
              value={visitForm.vet_notes}
              onChange={e => setVisitForm({ ...visitForm, vet_notes: e.target.value })}
              style={{ ...inputStyle, minHeight: "60px", resize: "vertical", marginBottom: "14px" }}
            />

            <label style={labelStyle}>Fee Charged (KES)</label>
            <input
              type="number" placeholder="e.g. 2500"
              value={visitForm.fee}
              onChange={e => setVisitForm({ ...visitForm, fee: e.target.value })}
              style={{ ...inputStyle, marginBottom: "18px" }}
            />
            <SubmitButton saving={saving} label="Complete Visit" />
          </form>
        </Modal>
      )}

      {/* REJECT MODAL */}
      {rejectTarget && (
        <Modal title="Reject Visit Request" onClose={() => setRejectTarget(null)}>
          <form onSubmit={handleRejectSave}>
            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
              {rejectTarget.farm_name} — {rejectTarget.appointment_date}
            </p>
            <label style={labelStyle}>Reason for rejecting (shown to the farmer)</label>
            <textarea
              placeholder="e.g. Outside my service area, fully booked that day..."
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              required
              style={{ ...inputStyle, minHeight: "90px", resize: "vertical", marginBottom: "18px" }}
            />
            <SubmitButton saving={saving} label="Reject Request" />
          </form>
        </Modal>
      )}

      {/* APPOINTMENT DETAILS MODAL */}
      {detailsTarget && (
        <Modal title="Appointment Details" onClose={() => { setDetailsTarget(null); setVisitRecord(null); }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <DetailRow label="Farm" value={detailsTarget.farm_name} />
            <DetailRow label="Farmer" value={detailsTarget.farmer_email} />
            <DetailRow label="County" value={detailsTarget.county} />
            <DetailRow label="Bird Count" value={detailsTarget.bird_count} />
            <DetailRow label="Date" value={detailsTarget.appointment_date} />
            <DetailRow label="Time" value={detailsTarget.appointment_time} />
            <DetailRow label="Urgency" value={detailsTarget.urgency} capitalize />
            <DetailRow label="Status" value={detailsTarget.status} capitalize />
            <DetailRow label="Reason" value={detailsTarget.reason} />
            {detailsTarget.status === "rejected" && (
              <DetailRow label="Rejection Reason" value={detailsTarget.rejection_reason} />
            )}
            {detailsTarget.status === "completed" && (
              <DetailRow label="Fee Charged" value={`KES ${Number(detailsTarget.fee || 0).toLocaleString()}`} />
            )}
            <DetailRow label="Source" value={detailsTarget.source} capitalize />
            {detailsTarget.created_at && (
              <DetailRow label="Requested On" value={new Date(detailsTarget.created_at).toLocaleString()} />
            )}
            {detailsTarget.completed_at && (
              <DetailRow label="Completed On" value={new Date(detailsTarget.completed_at).toLocaleString()} />
            )}
          </div>

          {detailsTarget.status === "completed" && (
            <div style={{ marginTop: "18px", paddingTop: "18px", borderTop: "1px solid #f0f0f0" }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
                Visit Report
              </h3>
              {loadingVisitRecord ? (
                <p style={{ fontSize: "13px", color: "#9ca3af" }}>Loading...</p>
              ) : (
                <VisitReportFields record={visitRecord} />
              )}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
// SHARED SUB-COMPONENTS
// ══════════════════════════════════════════════════
function Modal({ title, onClose, children }) {
  return (
    <div
      onClick={onClose}
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>{title}</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value, capitalize }) {
  if (value === null || value === undefined || value === "") return null;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
      <span style={{ fontSize: "12px", fontWeight: "600", color: "#6b7280" }}>{label}</span>
      <span style={{
        fontSize: "13px", fontWeight: "600", color: "#111827",
        textAlign: "right", textTransform: capitalize ? "capitalize" : "none", wordBreak: "break-word"
      }}>
        {value}
      </span>
    </div>
  );
}

function AppointmentFields({ form, setForm }) {
  return (
    <>
      <input
        placeholder="Farm name"
        value={form.farm_name}
        onChange={e => setForm({ ...form, farm_name: e.target.value })}
        required
        style={{ ...inputStyle, marginBottom: "12px" }}
      />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <input
          placeholder="County"
          value={form.county}
          onChange={e => setForm({ ...form, county: e.target.value })}
          style={inputStyle}
        />
        <input
          type="number" placeholder="Bird count"
          value={form.bird_count}
          onChange={e => setForm({ ...form, bird_count: e.target.value })}
          style={inputStyle}
        />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
        <input
          type="date"
          value={form.appointment_date}
          onChange={e => setForm({ ...form, appointment_date: e.target.value })}
          min={todayISO()}
          required
          style={inputStyle}
        />
        <input
          type="time"
          value={form.appointment_time}
          onChange={e => setForm({ ...form, appointment_time: e.target.value })}
          style={inputStyle}
        />
      </div>
      <select
        value={form.urgency}
        onChange={e => setForm({ ...form, urgency: e.target.value })}
        style={{ ...inputStyle, marginBottom: "12px", appearance: "none" }}
      >
        <option value="low">Low urgency</option>
        <option value="medium">Medium urgency</option>
        <option value="high">High urgency</option>
      </select>
      <textarea
        placeholder="Reason for visit"
        value={form.reason}
        onChange={e => setForm({ ...form, reason: e.target.value })}
        style={{ ...inputStyle, minHeight: "70px", resize: "vertical", marginBottom: "18px" }}
      />
    </>
  );
}

function SubmitButton({ saving, label }) {
  return (
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
      {saving ? "Saving..." : label}
    </button>
  );
}

const btnPrimary = {
  padding: "8px 16px", background: "#16a34a", color: "#fff",
  border: "none", borderRadius: "8px", fontWeight: "700",
  fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap"
};

const btnGhost = {
  padding: "8px 16px", background: "#fff", color: "#374151",
  border: "1px solid #e5e7eb", borderRadius: "8px", fontWeight: "600",
  fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap"
};

const btnDanger = {
  padding: "8px 16px", background: "#fff", color: "#ef4444",
  border: "1px solid #fecaca", borderRadius: "8px", fontWeight: "600",
  fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap"
};