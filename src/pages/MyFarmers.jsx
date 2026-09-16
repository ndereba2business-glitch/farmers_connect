import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Users, Search, Phone, MapPin, Calendar,
  MessageSquare, Stethoscope, History, X, FileText,
  Pill, Syringe, Beaker, ExternalLink
} from "lucide-react";
import VisitReportModal from "../components/VisitReportModal";

const RECORD_TYPE_META = {
  prescription: { icon: Pill, label: "Prescription", color: "#16a34a" },
  diagnosis: { icon: Stethoscope, label: "Diagnosis", color: "#3b82f6" },
  vaccination: { icon: Syringe, label: "Vaccination", color: "#8b5cf6" },
  lab_result: { icon: Beaker, label: "Lab Result", color: "#ef4444" },
};

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
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [farmers, setFarmers] = useState([]);
  const [search, setSearch] = useState("");

  // ── VISIT HISTORY (Phase 3.3) ──
  const [historyTarget, setHistoryTarget] = useState(null); // the farmer whose history is open
  const [historyList, setHistoryList] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── STANDALONE MEDICAL RECORDS (prescriptions/diagnoses/vaccinations/lab results) ──
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loadingMedicalRecords, setLoadingMedicalRecords] = useState(false);

  const [reportTarget, setReportTarget] = useState(null); // the appointment whose report is open
  const [reportRecord, setReportRecord] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  useEffect(() => {
    if (user?.id) fetchMyFarmers();
  }, [user?.id]);

  async function openHistory(farmer) {
    setHistoryTarget(farmer);
    setLoadingHistory(true);
    setLoadingMedicalRecords(true);

    const [{ data, error }, { data: records, error: recordsError }] = await Promise.all([
      supabase.from("vet_appointments")
        .select("*")
        .eq("vet_id", user.id)
        .eq("farmer_email", farmer.email)
        .eq("status", "completed")
        .order("appointment_date", { ascending: false }),
      supabase.from("vet_medical_records")
        .select("*")
        .eq("vet_id", user.id)
        .eq("farmer_email", farmer.email)
        .order("created_at", { ascending: false })
    ]);

    if (error) console.error("MyFarmers: failed to load visit history —", error.message);
    if (recordsError) console.error("MyFarmers: failed to load medical records —", recordsError.message);

    setHistoryList(data || []);
    setLoadingHistory(false);
    setMedicalRecords(records || []);
    setLoadingMedicalRecords(false);
  }

  async function viewLabResult(record) {
    const { data, error } = await supabase.storage
      .from("lab-results")
      .createSignedUrl(record.file_path, 3600);
    if (error || !data?.signedUrl) {
      console.error("MyFarmers: failed to create signed URL —", error?.message);
      toast.error("Failed to open file: " + (error?.message || "unknown error"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function openReport(appt) {
    setReportTarget(appt);
    setReportRecord(null);
    setLoadingReport(true);
    const { data, error } = await supabase
      .from("visit_records")
      .select("*")
      .eq("appointment_id", appt.id)
      .maybeSingle();
    if (error) console.error("MyFarmers: failed to load visit report —", error.message);
    setReportRecord(data || null);
    setLoadingReport(false);
  }

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

                {/* DATE + ACTIONS */}
                <div style={{ textAlign: "right", flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end", color: "#9ca3af", fontSize: "12px" }}>
                    <Calendar size={12} /> {formatDate(f.lastDate)}
                  </div>
                  <button
                    onClick={() => openHistory(f)}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "6px 14px", background: "#fff", color: "#374151",
                      border: "1px solid #e5e7eb", borderRadius: "8px",
                      fontWeight: "600", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap"
                    }}
                  >
                    <History size={13} /> View History
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* VISIT HISTORY MODAL */}
      {historyTarget && (
        <div
          onClick={() => setHistoryTarget(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: "20px", padding: "28px",
              maxWidth: "520px", width: "100%", maxHeight: "90vh", overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700" }}>Visit History</h2>
              <button onClick={() => setHistoryTarget(null)} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>
            <p style={{ margin: "0 0 18px", fontSize: "13px", color: "#6b7280" }}>
              {historyTarget.fullName}
            </p>

            {loadingHistory ? (
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>Loading...</p>
            ) : historyList.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>No completed visits with this farmer yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {historyList.map(appt => (
                  <div key={appt.id} style={{
                    border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px",
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    flexWrap: "wrap", gap: "10px"
                  }}>
                    <div>
                      <p style={{ margin: "0 0 2px", fontWeight: "700", fontSize: "13px", color: "#111827" }}>
                        {formatDate(appt.appointment_date)}
                      </p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
                        KES {Number(appt.fee || 0).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => openReport(appt)}
                      style={{
                        display: "flex", alignItems: "center", gap: "6px",
                        padding: "7px 14px", background: "#f0fdf4", color: "#16a34a",
                        border: "1px solid #bbf7d0", borderRadius: "8px",
                        fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap"
                      }}
                    >
                      <FileText size={13} /> View Report
                    </button>
                  </div>
                ))}
              </div>
            )}

            <h3 style={{ margin: "22px 0 12px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
              Medical Records
            </h3>
            {loadingMedicalRecords ? (
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>Loading...</p>
            ) : medicalRecords.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>No prescriptions, diagnoses, vaccinations, or lab results logged yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {medicalRecords.map(record => {
                  const meta = RECORD_TYPE_META[record.record_type] || RECORD_TYPE_META.diagnosis;
                  const Icon = meta.icon;
                  return (
                    <div key={record.id} style={{
                      border: "1px solid #e5e7eb", borderRadius: "12px", padding: "14px",
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      flexWrap: "wrap", gap: "10px"
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <Icon size={16} color={meta.color} style={{ marginTop: "2px", flexShrink: 0 }} />
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                            <p style={{ margin: 0, fontWeight: "700", fontSize: "13px", color: "#111827" }}>
                              {record.title}
                            </p>
                            <span style={{
                              fontSize: "10px", fontWeight: "700", padding: "2px 8px",
                              borderRadius: "20px", background: "#f3f4f6", color: meta.color
                            }}>
                              {meta.label}
                            </span>
                          </div>
                          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9ca3af" }}>
                            {formatDate(record.created_at)}
                            {record.record_type === "vaccination" && record.next_due_date &&
                              ` · Next due ${formatDate(record.next_due_date)}`}
                          </p>
                        </div>
                      </div>
                      {record.record_type === "lab_result" && (
                        <button
                          onClick={() => viewLabResult(record)}
                          style={{
                            display: "flex", alignItems: "center", gap: "6px",
                            padding: "7px 14px", background: "#fef2f2", color: "#ef4444",
                            border: "1px solid #fecaca", borderRadius: "8px",
                            fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap"
                          }}
                        >
                          <ExternalLink size={13} /> View File
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISIT REPORT MODAL */}
      {reportTarget && (
        <VisitReportModal
          appointment={reportTarget}
          record={reportRecord}
          loading={loadingReport}
          onClose={() => { setReportTarget(null); setReportRecord(null); }}
        />
      )}
    </div>
  );
}