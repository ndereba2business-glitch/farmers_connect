import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Calendar, Clock, Plus, X, CheckCircle2, Inbox, XCircle, Eye, Ban, AlertTriangle, MapPin, Bird
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
  const [loadError, setLoadError] = useState("");
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
      setLoadError("Appointments couldn't load. Check your connection and retry.");
      setLoading(false);
      return;
    }
    setLoadError("");
    setAppointments(data || []);
    setLoading(false);
  }

  // Visit reminders and status notifications are created by the database
  // (sync_my_reminders() and the vet_appointments triggers), for the
  // farmer and the vet alike.

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
          <h1 className="fc-page-title" style={{ margin: 0, fontWeight: "700", color: "var(--fc-fg-gray900)", letterSpacing: "-1px" }}>
            Appointments
          </h1>
          <p style={{ marginTop: "6px", color: "var(--fc-fg-gray500)", fontSize: "15px" }}>
            Manage farm visits, requests, and your visit history
          </p>
        </div>
        <button
          onClick={() => { setNewFormError(""); setShowNewForm(true); }}
          style={{
            height: "44px", padding: "0 20px", border: "none", borderRadius: "12px",
            background: "#15803d", color: "var(--fc-fg-gray0)",
            fontWeight: "700", cursor: "pointer", fontSize: "14px",
            display: "flex", alignItems: "center", gap: "8px",
            boxShadow: "none"
          }}
        >
          <Plus size={18} /> New Appointment
        </button>
      </div>

      {/* LOAD ERROR BANNER */}
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
            onClick={loadAppointments}
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

      {/* TABS */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", flexWrap: "wrap" }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className="fc-tap"
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "9px 18px", borderRadius: "16px",
              border: `1.5px solid ${activeTab === tab.key ? "var(--fc-line-gray900)" : "var(--fc-line-gray200)"}`,
              background: activeTab === tab.key ? "var(--fc-bg-gray900)" : "var(--fc-bg-gray0)",
              color: activeTab === tab.key ? "var(--fc-fg-gray0)" : "var(--fc-fg-gray500)",
              fontWeight: "600", fontSize: "13px", cursor: "pointer"
            }}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* LIST */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: "120px", borderRadius: "16px", background: "var(--fc-bg-gray100)" }} />
          ))}
        </div>
      ) : displayList.length === 0 ? (
        <div style={{
          textAlign: "center", padding: "70px 20px",
          background: "var(--fc-bg-gray0)", borderRadius: "16px", border: "1px solid var(--fc-line-gray101)"
        }}>
          {activeTab === "unassigned" ? (
            <Inbox size={48} color="var(--fc-fg-gray200)" style={{ marginBottom: "14px" }} />
          ) : activeTab === "completed" ? (
            <CheckCircle2 size={48} color="var(--fc-fg-gray200)" style={{ marginBottom: "14px" }} />
          ) : activeTab === "cancelled" ? (
            <XCircle size={48} color="var(--fc-fg-gray200)" style={{ marginBottom: "14px" }} />
          ) : activeTab === "rejected" ? (
            <Ban size={48} color="var(--fc-fg-gray200)" style={{ marginBottom: "14px" }} />
          ) : (
            <Calendar size={48} color="var(--fc-fg-gray200)" style={{ marginBottom: "14px" }} />
          )}
          <p style={{ color: "var(--fc-fg-gray400)", fontSize: "14px" }}>
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
                background: "var(--fc-bg-gray0)", borderRadius: "16px", padding: "18px 20px",
                border: "1px solid var(--fc-line-gray200)", boxShadow: "var(--fc-shadow-card)",
                display: "flex", justifyContent: "space-between",
                alignItems: "flex-start", flexWrap: "wrap", gap: "14px"
              }}>
                <div style={{ flex: 1, minWidth: "220px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                    <span style={{ fontWeight: "700", fontSize: "16px", color: "var(--fc-fg-gray900)" }}>
                      {appt.farm_name}
                    </span>
                    <span style={{
                      fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                      borderRadius: "16px", background: urgency.bg, color: urgency.color,
                      textTransform: "capitalize"
                    }}>
                      {appt.urgency}
                    </span>
                    {activeTab === "unassigned" && (
                      <span style={{
                        fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                        borderRadius: "16px", background: "var(--fc-bg-blue50)", color: "var(--fc-fg-blue500)"
                      }}>
                        {appt.requested_vet_id ? "Requested — You" : "Unclaimed"}
                      </span>
                    )}
                    {activeTab === "upcoming" && (
                      <span style={{
                        fontSize: "11px", fontWeight: "700", padding: "2px 8px", borderRadius: "16px",
                        background: appt.status === "accepted" ? "var(--fc-bg-green100)" : "var(--fc-bg-amber100)",
                        color: appt.status === "accepted" ? "var(--fc-fg-green700)" : "var(--fc-fg-amber600)",
                        textTransform: "capitalize"
                      }}>
                        {appt.status}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--fc-fg-gray500)", display: "flex", gap: "14px", flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <Calendar size={12} /> {appt.appointment_date}
                    </span>
                    {appt.appointment_time && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <Clock size={12} /> {appt.appointment_time}
                      </span>
                    )}
                    {appt.county && <span><MapPin size={14} aria-hidden="true" /> {appt.county}</span>}
                    {appt.bird_count && <span><Bird size={14} aria-hidden="true" /> {appt.bird_count} birds</span>}
                    {activeTab === "completed" && (
                      <span style={{ color: "var(--fc-fg-green700)", fontWeight: "700" }}>
                        KES {Number(appt.fee || 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {appt.reason && (
                    <p style={{ margin: "10px 0 0", fontSize: "13px", color: "var(--fc-fg-gray500)" }}>{appt.reason}</p>
                  )}
                  {activeTab === "rejected" && appt.rejection_reason && (
                    <p style={{ margin: "10px 0 0", fontSize: "13px", color: "var(--fc-fg-red800)", background: "var(--fc-bg-red50)", padding: "8px 12px", borderRadius: "8px" }}>
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
                background: "var(--fc-bg-red50)", border: "1px solid var(--fc-line-red200)",
                color: "var(--fc-fg-red600)", padding: "10px 14px",
                borderRadius: "8px", fontSize: "13px", marginBottom: "14px"
              }}>
                <AlertTriangle size={14} aria-hidden="true" /> {newFormError}
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
                background: "var(--fc-bg-red50)", border: "1px solid var(--fc-line-red200)",
                color: "var(--fc-fg-red600)", padding: "10px 14px",
                borderRadius: "8px", fontSize: "13px", marginBottom: "14px"
              }}>
                <AlertTriangle size={14} aria-hidden="true" /> {editFormError}
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
            <p style={{ fontSize: "13px", color: "var(--fc-fg-gray500)", marginBottom: "16px" }}>
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
              <p style={{ margin: "0 0 14px", fontSize: "12px", color: "var(--fc-fg-gray400)" }}>
                None added yet.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
                {medications.map((med, i) => (
                  <div key={i} style={{
                    border: "1px solid var(--fc-line-gray200)", borderRadius: "12px", padding: "12px",
                    display: "flex", flexDirection: "column", gap: "8px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--fc-fg-gray500)" }}>Medication {i + 1}</span>
                      <button type="button" onClick={() => removeMedication(i)} aria-label={`Remove medication ${i + 1}`} style={{ background: "none", border: "none", cursor: "pointer" }}>
                        <X size={14} color="var(--fc-fg-gray400)" />
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
            <p style={{ fontSize: "13px", color: "var(--fc-fg-gray500)", marginBottom: "16px" }}>
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
            <div style={{ marginTop: "18px", paddingTop: "18px", borderTop: "1px solid var(--fc-line-gray101)" }}>
              <h3 style={{ margin: "0 0 12px", fontSize: "14px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
                Visit Report
              </h3>
              {loadingVisitRecord ? (
                <p style={{ fontSize: "13px", color: "var(--fc-fg-gray400)" }}>Loading...</p>
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
          background: "var(--fc-bg-gray0)", borderRadius: "16px", padding: "28px",
          maxWidth: "480px", width: "100%", maxHeight: "90vh", overflowY: "auto"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer" }}>
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
      <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--fc-fg-gray500)" }}>{label}</span>
      <span style={{
        fontSize: "13px", fontWeight: "600", color: "var(--fc-fg-gray900)",
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
        background: saving ? "var(--fc-bg-green300)" : "#15803d",
        color: "var(--fc-fg-gray0)", border: "none", borderRadius: "12px",
        fontWeight: "700", fontSize: "14px", cursor: saving ? "not-allowed" : "pointer"
      }}
    >
      {saving ? "Saving..." : label}
    </button>
  );
}

const btnPrimary = {
  padding: "8px 16px", background: "#15803d", color: "var(--fc-fg-gray0)",
  border: "none", borderRadius: "8px", fontWeight: "700",
  fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap"
};

const btnGhost = {
  padding: "8px 16px", background: "var(--fc-bg-gray0)", color: "var(--fc-fg-gray700)",
  border: "1px solid var(--fc-line-gray200)", borderRadius: "8px", fontWeight: "600",
  fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap"
};

const btnDanger = {
  padding: "8px 16px", background: "var(--fc-bg-gray0)", color: "var(--fc-fg-red500)",
  border: "1px solid var(--fc-line-red200)", borderRadius: "8px", fontWeight: "600",
  fontSize: "13px", cursor: "pointer", whiteSpace: "nowrap"
};