import { useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import FarmerPicker from "./FarmerPicker";
import { X } from "lucide-react";

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "#fff", color: "#111827"
};

const labelStyle = {
  display: "block", fontSize: "12px", fontWeight: "600",
  color: "#6b7280", marginBottom: "5px"
};

const RECORD_META = {
  prescription: { modalTitle: "Create Prescription", submitLabel: "Save Prescription" },
  diagnosis: { modalTitle: "Record Diagnosis", submitLabel: "Save Diagnosis" },
  vaccination: { modalTitle: "Add Vaccination Record", submitLabel: "Save Vaccination Record" },
  lab_result: { modalTitle: "Upload Lab Results", submitLabel: "Upload" },
};

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

// Shared modal for VetDashboard.jsx's 4 standalone record-logging quick
// actions (Create Prescription / Record Diagnosis / Add Vaccination Record
// / Upload Lab Results). Not tied to any specific appointment — a vet may
// need to log one of these for a phone consult, walk-in, or follow-up.
// Contrast with Appointments.jsx's "Complete Visit" flow, which still owns
// diagnosis/treatment/medications tied to a specific scheduled visit
// (visit_records).
export default function MedicalRecordModal({ recordType, onClose, onSaved }) {
  const { user, userEmail } = useAuth();
  const toast = useToast();
  const meta = RECORD_META[recordType];

  const [farmer, setFarmer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Prescription
  const [medication, setMedication] = useState("");
  const [dosage, setDosage] = useState("");
  const [instructions, setInstructions] = useState("");

  // Diagnosis
  const [diagnosis, setDiagnosis] = useState("");
  const [diagnosisNotes, setDiagnosisNotes] = useState("");

  // Vaccination
  const [vaccineName, setVaccineName] = useState("");
  const [dateAdministered, setDateAdministered] = useState(todayISO());
  const [nextDueDate, setNextDueDate] = useState("");

  // Lab result
  const [testName, setTestName] = useState("");
  const [labNotes, setLabNotes] = useState("");
  const [file, setFile] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!farmer) {
      setError("Select which farmer this record is for.");
      return;
    }

    let title, details;
    if (recordType === "prescription") {
      if (!medication.trim()) { setError("Medication name is required."); return; }
      title = medication.trim();
      details = { medication: medication.trim(), dosage: dosage.trim(), instructions: instructions.trim() };
    } else if (recordType === "diagnosis") {
      if (!diagnosis.trim()) { setError("Diagnosis is required."); return; }
      title = diagnosis.trim();
      details = { diagnosis: diagnosis.trim(), notes: diagnosisNotes.trim() };
    } else if (recordType === "vaccination") {
      if (!vaccineName.trim()) { setError("Vaccine name is required."); return; }
      title = vaccineName.trim();
      details = { vaccine_name: vaccineName.trim(), date_administered: dateAdministered };
    } else {
      if (!testName.trim()) { setError("Test name is required."); return; }
      if (!file) { setError("Select a file to upload."); return; }
      title = testName.trim();
      details = { test_name: testName.trim(), notes: labNotes.trim() };
    }

    setSaving(true);

    let filePath = null;
    if (recordType === "lab_result" && file) {
      filePath = `${user?.id || userEmail}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("lab-results")
        .upload(filePath, file);
      if (uploadError) {
        setSaving(false);
        setError("Failed to upload file: " + uploadError.message);
        return;
      }
    }

    const { error: insertError } = await supabase.from("vet_medical_records").insert([{
      vet_id: user?.id || null,
      vet_email: userEmail,
      farmer_email: farmer.user_email,
      record_type: recordType,
      title,
      details,
      next_due_date: recordType === "vaccination" ? (nextDueDate || null) : null,
      file_path: filePath,
    }]);

    setSaving(false);

    if (insertError) {
      setError("Failed to save: " + insertError.message);
      return;
    }

    toast.success(`${meta.modalTitle} saved for ${farmer.full_name || farmer.user_email}.`);
    onSaved?.();
    onClose();
  }

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
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>{meta.modalTitle}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "14px" }}>
            <label style={labelStyle}>Farmer</label>
            <FarmerPicker value={farmer} onChange={setFarmer} />
          </div>

          {recordType === "prescription" && (
            <>
              <label style={labelStyle}>Medication</label>
              <input
                placeholder="e.g. Amoxicillin"
                value={medication}
                onChange={e => setMedication(e.target.value)}
                style={{ ...inputStyle, marginBottom: "12px" }}
              />
              <label style={labelStyle}>Dosage</label>
              <input
                placeholder="e.g. 1g per 5L water"
                value={dosage}
                onChange={e => setDosage(e.target.value)}
                style={{ ...inputStyle, marginBottom: "12px" }}
              />
              <label style={labelStyle}>Instructions</label>
              <textarea
                placeholder="e.g. Twice daily for 5 days"
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                style={{ ...inputStyle, minHeight: "70px", resize: "vertical", marginBottom: "14px" }}
              />
            </>
          )}

          {recordType === "diagnosis" && (
            <>
              <label style={labelStyle}>Diagnosis</label>
              <textarea
                placeholder="e.g. Suspected Newcastle disease"
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
                style={{ ...inputStyle, minHeight: "70px", resize: "vertical", marginBottom: "12px" }}
              />
              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                placeholder="Additional observations..."
                value={diagnosisNotes}
                onChange={e => setDiagnosisNotes(e.target.value)}
                style={{ ...inputStyle, minHeight: "60px", resize: "vertical", marginBottom: "14px" }}
              />
            </>
          )}

          {recordType === "vaccination" && (
            <>
              <label style={labelStyle}>Vaccine</label>
              <input
                placeholder="e.g. Newcastle Disease Vaccine"
                value={vaccineName}
                onChange={e => setVaccineName(e.target.value)}
                style={{ ...inputStyle, marginBottom: "12px" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={labelStyle}>Date Administered</label>
                  <input
                    type="date"
                    value={dateAdministered}
                    onChange={e => setDateAdministered(e.target.value)}
                    max={todayISO()}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Next Due Date (optional)</label>
                  <input
                    type="date"
                    value={nextDueDate}
                    onChange={e => setNextDueDate(e.target.value)}
                    min={todayISO()}
                    style={inputStyle}
                  />
                </div>
              </div>
            </>
          )}

          {recordType === "lab_result" && (
            <>
              <label style={labelStyle}>Test Name</label>
              <input
                placeholder="e.g. Avian Influenza PCR"
                value={testName}
                onChange={e => setTestName(e.target.value)}
                style={{ ...inputStyle, marginBottom: "12px" }}
              />
              <label style={labelStyle}>Notes (optional)</label>
              <textarea
                placeholder="Additional context for this result..."
                value={labNotes}
                onChange={e => setLabNotes(e.target.value)}
                style={{ ...inputStyle, minHeight: "60px", resize: "vertical", marginBottom: "12px" }}
              />
              <label style={labelStyle}>File</label>
              <input
                type="file"
                onChange={e => setFile(e.target.files?.[0] || null)}
                style={{ ...inputStyle, marginBottom: "14px", padding: "8px" }}
              />
              <p style={{ margin: "-8px 0 14px", fontSize: "12px", color: "#9ca3af" }}>
                Only you and this farmer can view this file.
              </p>
            </>
          )}

          {error && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              color: "#dc2626", padding: "10px 14px",
              borderRadius: "8px", fontSize: "13px", marginBottom: "14px"
            }}>
              ⚠️ {error}
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
            {saving ? "Saving..." : meta.submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}
