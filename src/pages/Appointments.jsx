import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Calendar, Clock, Plus, X, CheckCircle2, Inbox, XCircle
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

const EMPTY_FORM = {
  farm_name: "", county: "", bird_count: "",
  appointment_date: "", appointment_time: "", reason: "", urgency: "medium"
};

export default function Appointments() {
  const { userEmail, user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [activeTab, setActiveTab] = useState("upcoming");

  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState(EMPTY_FORM);

  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const [completeTarget, setCompleteTarget] = useState(null);
  const [feeInput, setFeeInput] = useState("");

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
  }

  const isMine = (a) =>
    (user?.id && a.vet_id === user.id) || a.vet_email === userEmail;

  const upcoming = appointments.filter(a =>
    isMine(a) && ["pending", "accepted"].includes(a.status)
  );
  const unassigned = appointments.filter(a => !a.vet_id && !a.vet_email);
  const completed = appointments.filter(a => isMine(a) && a.status === "completed");
  const cancelled = appointments.filter(a => isMine(a) && a.status === "cancelled");

  const TABS = [
    { key: "upcoming", label: "Upcoming", count: upcoming.length },
    { key: "unassigned", label: "Unassigned Requests", count: unassigned.length },
    { key: "completed", label: "Completed", count: completed.length },
    { key: "cancelled", label: "Cancelled", count: cancelled.length },
  ];

  const displayList =
    activeTab === "upcoming" ? upcoming :
    activeTab === "unassigned" ? unassigned :
    activeTab === "completed" ? completed :
    cancelled;

  async function claimAppointment(id) {
    if (!user?.id) {
      alert("You must be logged in to claim an appointment.");
      return;
    }
    const { error } = await supabase.from("vet_appointments")
      .update({ vet_id: user.id, vet_email: userEmail }).eq("id", id);
    if (error) { alert("Failed to claim: " + error.message); return; }
    loadAppointments();
  }

  async function acceptAppointment(id) {
    const { error } = await supabase.from("vet_appointments")
      .update({
        status: "accepted",
        ...(user?.id ? { vet_id: user.id } : {}),
        vet_email: userEmail
      })
      .eq("id", id);
    if (error) { alert("Failed to accept: " + error.message); return; }
    loadAppointments();
  }

  async function cancelAppointment(id) {
    if (!window.confirm("Cancel this appointment?")) return;
    const { error } = await supabase.from("vet_appointments")
      .update({ status: "cancelled" }).eq("id", id);
    if (error) { alert("Failed to cancel: " + error.message); return; }
    loadAppointments();
  }

  function openEdit(appt) {
    setEditForm({
      farm_name: appt.farm_name || "",
      county: appt.county || "",
      bird_count: appt.bird_count || "",
      appointment_date: appt.appointment_date || "",
      appointment_time: appt.appointment_time || "",
      reason: appt.reason || "",
      urgency: appt.urgency || "medium"
    });
    setEditTarget(appt);
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("vet_appointments").update({
      farm_name: editForm.farm_name,
      county: editForm.county,
      bird_count: editForm.bird_count ? Number(editForm.bird_count) : null,
      appointment_date: editForm.appointment_date,
      appointment_time: editForm.appointment_time,
      reason: editForm.reason,
      urgency: editForm.urgency
    }).eq("id", editTarget.id);
    setSaving(false);
    if (error) { alert("Failed to save changes: " + error.message); return; }
    setEditTarget(null);
    loadAppointments();
  }

  function openComplete(appt) {
    setFeeInput("");
    setCompleteTarget(appt);
  }

  async function handleCompleteSave(e) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("vet_appointments").update({
      status: "completed",
      fee: feeInput ? Number(feeInput) : 0,
      completed_at: new Date().toISOString()
    }).eq("id", completeTarget.id);
    setSaving(false);
    if (error) { alert("Failed to mark complete: " + error.message); return; }
    setCompleteTarget(null);
    loadAppointments();
  }

  async function handleNewAppointment(e) {
    e.preventDefault();
    if (!newForm.farm_name || !newForm.appointment_date) return;
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
    if (error) { alert("Failed to create appointment: " + error.message); return; }
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
          onClick={() => setShowNewForm(true)}
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
          ) : (
            <Calendar size={48} color="#e5e7eb" style={{ marginBottom: "14px" }} />
          )}
          <p style={{ color: "#9ca3af", fontSize: "14px" }}>
            {activeTab === "upcoming" && "No upcoming appointments. Schedule one to get started."}
            {activeTab === "unassigned" && "No unclaimed requests right now."}
            {activeTab === "completed" && "No completed visits yet."}
            {activeTab === "cancelled" && "No cancelled appointments."}
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
                </div>

                {/* ACTIONS */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {activeTab === "unassigned" && (
                    <button onClick={() => claimAppointment(appt.id)} style={btnPrimary}>
                      Claim
                    </button>
                  )}
                  {activeTab === "upcoming" && (
                    <>
                      {appt.status !== "accepted" && (
                        <button onClick={() => acceptAppointment(appt.id)} style={btnPrimary}>
                          Accept
                        </button>
                      )}
                      <button onClick={() => openComplete(appt)} style={btnGhost}>
                        Mark Complete
                      </button>
                      <button onClick={() => openEdit(appt)} style={btnGhost}>
                        Reschedule
                      </button>
                      <button onClick={() => cancelAppointment(appt.id)} style={btnDanger}>
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
            <SubmitButton saving={saving} label="Create Appointment" />
          </form>
        </Modal>
      )}

      {/* EDIT / RESCHEDULE MODAL */}
      {editTarget && (
        <Modal title="Reschedule Appointment" onClose={() => setEditTarget(null)}>
          <form onSubmit={handleEditSave}>
            <AppointmentFields form={editForm} setForm={setEditForm} />
            <SubmitButton saving={saving} label="Save Changes" />
          </form>
        </Modal>
      )}

      {/* MARK COMPLETE MODAL */}
      {completeTarget && (
        <Modal title="Mark Visit Complete" onClose={() => setCompleteTarget(null)}>
          <form onSubmit={handleCompleteSave}>
            <p style={{ fontSize: "13px", color: "#6b7280", marginBottom: "16px" }}>
              {completeTarget.farm_name} — {completeTarget.appointment_date}
            </p>
            <label style={labelStyle}>Fee Charged (KES)</label>
            <input
              type="number" placeholder="e.g. 2500"
              value={feeInput}
              onChange={e => setFeeInput(e.target.value)}
              style={{ ...inputStyle, marginBottom: "18px" }}
            />
            <SubmitButton saving={saving} label="Mark Complete" />
          </form>
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
        style={{ background: "#fff", borderRadius: "20px", padding: "28px", maxWidth: "480px", width: "100%" }}
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