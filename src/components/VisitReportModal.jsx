import { X, Pill } from "lucide-react";

const labelStyle = {
  display: "block", fontSize: "12px", fontWeight: "600",
  color: "#6b7280", marginBottom: "4px"
};

// Presentational-only — the actual fields of a visit_records row. Shared so
// Appointments.jsx (embedded in its own Details modal) and the standalone
// VisitReportModal below (used from MyFarmers.jsx / Bookings.jsx visit
// history) render the exact same clinical record the same way.
export function VisitReportFields({ record }) {
  if (!record) {
    return (
      <p style={{ fontSize: "13px", color: "#9ca3af" }}>
        No clinical record was saved for this visit.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {record.symptoms && (
        <div>
          <label style={labelStyle}>Symptoms</label>
          <p style={{ margin: 0, fontSize: "13px", color: "#111827" }}>{record.symptoms}</p>
        </div>
      )}
      {record.diagnosis && (
        <div>
          <label style={labelStyle}>Diagnosis</label>
          <p style={{ margin: 0, fontSize: "13px", color: "#111827" }}>{record.diagnosis}</p>
        </div>
      )}
      {record.treatment && (
        <div>
          <label style={labelStyle}>Treatment</label>
          <p style={{ margin: 0, fontSize: "13px", color: "#111827" }}>{record.treatment}</p>
        </div>
      )}
      {Array.isArray(record.medications) && record.medications.length > 0 && (
        <div>
          <label style={labelStyle}>Medications</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {record.medications.map((med, i) => (
              <div key={i} style={{
                border: "1px solid #e5e7eb", borderRadius: "10px", padding: "10px 12px",
                display: "flex", alignItems: "flex-start", gap: "8px"
              }}>
                <Pill size={14} color="#22c55e" style={{ marginTop: "2px", flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "#111827" }}>{med.name}</p>
                  {med.dosage && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>{med.dosage}</p>}
                  {med.instructions && <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9ca3af" }}>{med.instructions}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {record.vet_notes && (
        <div>
          <label style={labelStyle}>Vet Notes</label>
          <p style={{ margin: 0, fontSize: "13px", color: "#111827" }}>{record.vet_notes}</p>
        </div>
      )}
      {!record.symptoms && !record.diagnosis && !record.treatment && !record.vet_notes &&
        (!Array.isArray(record.medications) || record.medications.length === 0) && (
        <p style={{ fontSize: "13px", color: "#9ca3af" }}>No details were recorded for this visit.</p>
      )}
    </div>
  );
}

// Standalone modal — for pages that don't already have their own modal
// wrapping this content (visit history on MyFarmers.jsx and Bookings.jsx).
export default function VisitReportModal({ appointment, record, loading, onClose }) {
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>Visit Report</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>
        {appointment && (
          <p style={{ margin: "0 0 18px", fontSize: "13px", color: "#6b7280" }}>
            {appointment.farm_name} — {appointment.appointment_date}
          </p>
        )}
        {loading ? (
          <p style={{ fontSize: "13px", color: "#9ca3af" }}>Loading...</p>
        ) : (
          <VisitReportFields record={record} />
        )}
      </div>
    </div>
  );
}
