import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Stethoscope, Search, AlertTriangle, X, Send, Upload, MapPin,
  Calendar, Clock, CalendarPlus, CheckCircle2, XCircle
} from "lucide-react";

const QUESTION_CATEGORIES = [
  { label: "Disease Symptoms", emoji: "🦠" },
  { label: "Vaccination", emoji: "💉" },
  { label: "Feeding", emoji: "🌾" },
  { label: "Egg Production", emoji: "🥚" },
  { label: "Chick Mortality", emoji: "💀" },
  { label: "Broiler Growth", emoji: "📈" },
  { label: "Layers", emoji: "🐔" },
  { label: "Emergency", emoji: "🚨" },
];

const KENYA_COUNTIES = [
  "All Counties", "Nairobi", "Mombasa", "Kisumu", "Nakuru",
  "Eldoret", "Thika", "Kiambu", "Machakos", "Meru",
  "Nyeri", "Kakamega", "Kisii", "Embu", "Garissa"
];

const SPECIALIZATIONS = [
  "All Specializations", "Disease Diagnosis", "Vaccination",
  "Nutrition", "Egg Production", "Chick Mortality", "Broiler Growth", "Layers"
];

const URGENCY_OPTIONS = [
  { value: "low", label: "Low — routine check", bg: "#f0fdf4", color: "#16a34a" },
  { value: "medium", label: "Medium — needs attention soon", bg: "#fffbeb", color: "#d97706" },
  { value: "high", label: "High — urgent", bg: "#fff7ed", color: "#ea580c" },
];

const EMPTY_BOOKING_FORM = {
  requested_vet_id: "",
  farm_name: "",
  county: "",
  bird_count: "",
  appointment_date: "",
  appointment_time: "",
  reason: "",
  urgency: "medium"
};

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "#fff"
};

const labelStyle = {
  display: "block", fontSize: "12px", fontWeight: "600",
  color: "#6b7280", marginBottom: "6px"
};

export default function Bookings() {
  const { userEmail, user } = useAuth();
  const [activeTab, setActiveTab] = useState("ask");
  const [showEmergency, setShowEmergency] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Disease Symptoms");
  const [questionText, setQuestionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emergencyText, setEmergencyText] = useState("");
  const [vetSearch, setVetSearch] = useState("");
  const [county, setCounty] = useState("All Counties");
  const [specialization, setSpecialization] = useState("All Specializations");
  const [vets, setVets] = useState([]);

  // ── BOOK A VISIT (vet_appointments) ──
  const [verifiedVets, setVerifiedVets] = useState([]);
  const [myBookings, setMyBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [bookingForm, setBookingForm] = useState(EMPTY_BOOKING_FORM);
  const [bookingSaving, setBookingSaving] = useState(false);
  const [bookingError, setBookingError] = useState("");

  useEffect(() => {
    async function fetchData() {
      if (!userEmail) return;
      const { data } = await supabase
        .from("vet_questions")
        .select("*")
        .eq("user_email", userEmail)
        .order("created_at", { ascending: false });
      setQuestions(data || []);

      const { data: vetData } = await supabase
        .from("farmer_profiles")
        .select("*")
        .eq("role", "vet");
      setVets(vetData || []);
    }
    fetchData();
  }, [userEmail]);

  // ── LOAD VERIFIED VETS FOR THE BOOKING DROPDOWN ──
  useEffect(() => {
    async function loadVerifiedVets() {
      const { data, error } = await supabase
        .from("vet_profiles")
        .select("user_id, full_name, service_counties, specializations, accepts_emergency")
        .eq("verification_status", "verified")
        .order("full_name", { ascending: true });

      if (error) {
        console.error("Bookings: failed to load verified vets —", error.message);
        return;
      }
      setVerifiedVets(data || []);
    }
    loadVerifiedVets();
  }, []);

  // ── LOAD FARMER'S OWN VISIT REQUESTS ──
  async function loadMyBookings() {
    if (!user?.id && !userEmail) return;
    setLoadingBookings(true);

    const orFilter = user?.id
      ? `farmer_id.eq.${user.id},farmer_email.eq.${userEmail}`
      : `farmer_email.eq.${userEmail}`;

    const { data, error } = await supabase
      .from("vet_appointments")
      .select("*")
      .or(orFilter)
      .order("appointment_date", { ascending: false });

    if (error) {
      console.error("Bookings: failed to load my visit requests —", error.message);
      setLoadingBookings(false);
      return;
    }
    setMyBookings(data || []);
    setLoadingBookings(false);
  }

  useEffect(() => {
    loadMyBookings();
  }, [user?.id, userEmail]);

  async function submitQuestion() {
    if (!questionText.trim()) return;
    setSubmitting(true);
    await supabase.from("vet_questions").insert([{
      user_email: userEmail,
      farmer_id: user?.id || null,
      category: selectedCategory,
      question: questionText,
      status: "pending",
      is_emergency: false
    }]);
    setQuestionText("");
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    const { data } = await supabase
      .from("vet_questions").select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });
    setQuestions(data || []);
  }

  async function submitEmergency() {
    if (!emergencyText.trim()) return;
    await supabase.from("vet_questions").insert([{
      user_email: userEmail,
      farmer_id: user?.id || null,
      category: "Emergency",
      question: emergencyText,
      status: "pending",
      is_emergency: true
    }]);
    setEmergencyText("");
    setShowEmergency(false);
    alert("Emergency request sent! A vet will respond urgently.");
  }

  // ── SUBMIT A VISIT REQUEST ──
  async function submitBookingRequest(e) {
    e.preventDefault();
    setBookingError("");

    if (!bookingForm.farm_name || !bookingForm.appointment_date) {
      setBookingError("Farm name and date are required.");
      return;
    }
    if (!user?.id) {
      setBookingError("You must be logged in to book a visit.");
      return;
    }

    setBookingSaving(true);

    const { error } = await supabase.from("vet_appointments").insert([{
      farmer_id: user.id,
      farmer_email: userEmail,
      requested_vet_id: bookingForm.requested_vet_id || null,
      vet_id: null,
      vet_email: null,
      farm_name: bookingForm.farm_name,
      county: bookingForm.county,
      bird_count: bookingForm.bird_count ? Number(bookingForm.bird_count) : null,
      appointment_date: bookingForm.appointment_date,
      appointment_time: bookingForm.appointment_time,
      reason: bookingForm.reason,
      urgency: bookingForm.urgency,
      status: "pending",
      source: "direct"
    }]);

    setBookingSaving(false);

    if (error) {
      setBookingError("Failed to submit request: " + error.message);
      return;
    }

    setBookingForm(EMPTY_BOOKING_FORM);
    setShowBookingForm(false);
    loadMyBookings();
  }

  // ── CANCEL A PENDING/ACCEPTED REQUEST ──
  async function cancelMyBooking(id) {
    if (!window.confirm("Cancel this visit request?")) return;
    const { error } = await supabase
      .from("vet_appointments")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      alert("Failed to cancel: " + error.message);
      return;
    }
    loadMyBookings();
  }

  const TABS = [
    { key: "vets", label: "Vets", icon: "🩺" },
    { key: "ask", label: "Ask", icon: "💬" },
    { key: "bookings", label: "Bookings", icon: "📅" },
    { key: "suppliers", label: "Suppliers", icon: "🏪" },
  ];

  function urgencyMeta(value) {
    return URGENCY_OPTIONS.find(u => u.value === value) || URGENCY_OPTIONS[1];
  }

  function statusMeta(status) {
    switch (status) {
      case "accepted": return { bg: "#dcfce7", color: "#16a34a", label: "Confirmed" };
      case "completed": return { bg: "#f0fdf4", color: "#16a34a", label: "Completed" };
      case "cancelled": return { bg: "#f3f4f6", color: "#9ca3af", label: "Cancelled" };
      case "declined": return { bg: "#fef2f2", color: "#ef4444", label: "Declined" };
      default: return { bg: "#fef3c7", color: "#d97706", label: "Pending" };
    }
  }

  return (
    <div style={{ maxWidth: "900px" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Stethoscope size={28} color="#22c55e" />
          <div>
            <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
              Ask Vet
            </h1>
            <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
              Connect with verified poultry vets across Kenya
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowEmergency(true)}
          style={{
            height: "44px", padding: "0 20px", border: "none",
            borderRadius: "12px", background: "#ef4444",
            color: "white", fontWeight: "700", cursor: "pointer",
            fontSize: "14px", display: "flex", alignItems: "center",
            gap: "8px", boxShadow: "0 6px 20px rgba(239,68,68,0.3)"
          }}
        >
          🚨 Emergency
        </button>
      </div>

      {/* TABS */}
      <div style={{
        display: "flex", background: "#f3f4f6",
        borderRadius: "14px", padding: "4px",
        marginBottom: "24px"
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: "10px",
              borderRadius: "10px", border: "none",
              cursor: "pointer", fontWeight: "600", fontSize: "13px",
              background: activeTab === tab.key ? "#fff" : "transparent",
              color: activeTab === tab.key ? "#111827" : "#9ca3af",
              boxShadow: activeTab === tab.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              display: "flex", alignItems: "center",
              justifyContent: "center", gap: "6px",
              transition: "all 0.2s"
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ====== VETS TAB ====== */}
      {activeTab === "vets" && (
        <div>
          {/* SEARCH */}
          <div style={{ position: "relative", marginBottom: "12px" }}>
            <Search size={16} style={{
              position: "absolute", left: "14px",
              top: "50%", transform: "translateY(-50%)", color: "#9ca3af"
            }} />
            <input
              placeholder="Search vets by name..."
              value={vetSearch}
              onChange={e => setVetSearch(e.target.value)}
              style={{ ...inputStyle, paddingLeft: "40px" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" }}>
            <select
              value={county}
              onChange={e => setCounty(e.target.value)}
              style={{ ...inputStyle, appearance: "none" }}
            >
              {KENYA_COUNTIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select
              value={specialization}
              onChange={e => setSpecialization(e.target.value)}
              style={{ ...inputStyle, appearance: "none" }}
            >
              {SPECIALIZATIONS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {vets.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "#fff", borderRadius: "20px", border: "1px solid #f0f0f0"
            }}>
              <Stethoscope size={48} color="#e5e7eb" style={{ marginBottom: "12px" }} />
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#111827", margin: "0 0 8px" }}>
                No verified vets yet
              </h3>
              <p style={{ color: "#9ca3af", fontSize: "14px" }}>
                Try adjusting your filters or check back later.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {vets.map(vet => (
                <div key={vet.id} style={{
                  background: "#fff", borderRadius: "16px",
                  border: "1px solid #e5e7eb", padding: "16px 20px",
                  display: "flex", alignItems: "center", gap: "16px"
                }}>
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "14px",
                    background: "#dcfce7", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: "22px", flexShrink: 0
                  }}>
                    {vet.avatar_url ? (
                      <img src={vet.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "14px" }} />
                    ) : "👨‍⚕️"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px", fontWeight: "700", fontSize: "15px", color: "#111827" }}>
                      {vet.full_name}
                    </p>
                    {vet.county && (
                      <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af", display: "flex", alignItems: "center", gap: "4px" }}>
                        <MapPin size={11} /> {vet.county}
                      </p>
                    )}
                  </div>
                  <span style={{
                    background: "#dcfce7", color: "#16a34a",
                    fontSize: "11px", fontWeight: "700",
                    padding: "3px 10px", borderRadius: "20px"
                  }}>
                    ✔ Verified
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== ASK TAB ====== */}
      {activeTab === "ask" && (
        <div>
          <div style={{
            background: "#fff", borderRadius: "20px",
            border: "1px solid #e5e7eb", padding: "24px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)", marginBottom: "20px"
          }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "700", color: "#111827" }}>
              Ask a Vet Question
            </h2>

            {/* CATEGORY CHIPS */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              {QUESTION_CATEGORIES.map(cat => (
                <button
                  key={cat.label}
                  onClick={() => setSelectedCategory(cat.label)}
                  style={{
                    padding: "6px 14px", borderRadius: "20px",
                    border: `1.5px solid ${selectedCategory === cat.label ? "#22c55e" : "#e5e7eb"}`,
                    background: selectedCategory === cat.label ? "#f0fdf4" : "#fff",
                    color: selectedCategory === cat.label ? "#16a34a" : "#374151",
                    fontWeight: "600", fontSize: "13px", cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  {cat.emoji} {cat.label}
                </button>
              ))}
            </div>

            {/* QUESTION */}
            <textarea
              placeholder="Describe the problem in detail — symptoms, bird age, number affected, how long..."
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              style={{
                ...inputStyle, minHeight: "120px",
                resize: "vertical", marginBottom: "16px"
              }}
            />

            {/* ACTIONS */}
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                type="button"
                style={{
                  flex: 1, padding: "12px",
                  background: "#f9fafb", border: "1px solid #e5e7eb",
                  borderRadius: "10px", cursor: "pointer",
                  fontWeight: "600", fontSize: "13px", color: "#374151",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                }}
              >
                <Upload size={16} /> Attach photos
              </button>
              <button
                onClick={submitQuestion}
                disabled={submitting || !questionText.trim()}
                style={{
                  flex: 2, padding: "12px",
                  background: !questionText.trim()
                    ? "#86efac"
                    : "linear-gradient(135deg,#22c55e,#16a34a)",
                  color: "#fff", border: "none", borderRadius: "10px",
                  fontWeight: "700", fontSize: "14px",
                  cursor: !questionText.trim() ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
                }}
              >
                <Send size={16} />
                {submitting ? "Submitting..." : submitted ? "Submitted! ✓" : "Submit"}
              </button>
            </div>
          </div>

          {/* MY QUESTIONS */}
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "#111827", marginBottom: "12px" }}>
            My Questions
          </h3>
          {questions.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "40px 20px",
              background: "#fff", borderRadius: "16px", border: "1px solid #f0f0f0"
            }}>
              <p style={{ color: "#9ca3af", fontSize: "14px" }}>
                No questions yet. Ask your first question above.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {questions.map(q => (
                <div key={q.id} style={{
                  background: "#fff", borderRadius: "14px",
                  border: "1px solid #e5e7eb", padding: "16px 18px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{
                        background: q.is_emergency ? "#fef2f2" : "#f0fdf4",
                        color: q.is_emergency ? "#ef4444" : "#16a34a",
                        fontSize: "12px", fontWeight: "600",
                        padding: "3px 10px", borderRadius: "20px"
                      }}>
                        {q.is_emergency ? "🚨 Emergency" : q.category}
                      </span>
                      <span style={{
                        background: q.status === "answered" ? "#dcfce7" : "#f3f4f6",
                        color: q.status === "answered" ? "#16a34a" : "#9ca3af",
                        fontSize: "11px", fontWeight: "600",
                        padding: "3px 10px", borderRadius: "20px"
                      }}>
                        {q.status === "answered" ? "✓ Answered" : "Pending"}
                      </span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                      {new Date(q.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: "14px", color: "#374151" }}>
                    {q.question}
                  </p>
                  {q.answer && (
                    <div style={{
                      background: "#f0fdf4", borderRadius: "10px",
                      padding: "10px 14px", borderLeft: "3px solid #22c55e"
                    }}>
                      <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "#16a34a" }}>
                        VET RESPONSE
                      </p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#374151" }}>{q.answer}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== BOOKINGS TAB ====== */}
      {activeTab === "bookings" && (
        <div>
          {/* HEADER ROW */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#111827" }}>
                My Visit Requests
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#9ca3af" }}>
                Request a scheduled farm visit from a vet
              </p>
            </div>
            <button
              onClick={() => { setBookingError(""); setShowBookingForm(true); }}
              style={{
                height: "42px", padding: "0 18px", border: "none",
                borderRadius: "10px",
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                color: "white", fontWeight: "700", cursor: "pointer",
                fontSize: "13px", display: "flex", alignItems: "center", gap: "8px"
              }}
            >
              <CalendarPlus size={16} /> Book a Visit
            </button>
          </div>

          {/* MY REQUESTS LIST */}
          {loadingBookings ? (
            <p style={{ color: "#9ca3af", fontSize: "14px" }}>Loading...</p>
          ) : myBookings.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "#fff", borderRadius: "20px", border: "1px solid #f0f0f0"
            }}>
              <Calendar size={48} color="#e5e7eb" style={{ marginBottom: "12px" }} />
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#111827", margin: "0 0 8px" }}>
                No visit requests yet
              </h3>
              <p style={{ color: "#9ca3af", fontSize: "14px" }}>
                Book a visit above and a vet will confirm it.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {myBookings.map(b => {
                const urgency = urgencyMeta(b.urgency);
                const status = statusMeta(b.status);
                const canCancel = ["pending", "accepted"].includes(b.status);
                return (
                  <div key={b.id} style={{
                    background: "#fff", borderRadius: "16px",
                    border: "1px solid #e5e7eb", padding: "16px 18px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: "700", fontSize: "15px", color: "#111827" }}>
                            {b.farm_name}
                          </span>
                          <span style={{
                            fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                            borderRadius: "20px", background: urgency.bg, color: urgency.color,
                            textTransform: "capitalize"
                          }}>
                            {b.urgency}
                          </span>
                          <span style={{
                            fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                            borderRadius: "20px", background: status.bg, color: status.color
                          }}>
                            {status.label}
                          </span>
                          {!b.requested_vet_id && b.status === "pending" && (
                            <span style={{
                              fontSize: "11px", fontWeight: "600", padding: "2px 8px",
                              borderRadius: "20px", background: "#eff6ff", color: "#3b82f6"
                            }}>
                              Open to any vet
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "#9ca3af", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Calendar size={11} /> {b.appointment_date}
                          </span>
                          {b.appointment_time && (
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={11} /> {b.appointment_time}
                            </span>
                          )}
                          {b.county && <span>📍 {b.county}</span>}
                          {b.bird_count && <span>🐔 {b.bird_count} birds</span>}
                        </div>
                        {b.reason && (
                          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "#6b7280" }}>{b.reason}</p>
                        )}
                      </div>
                      {canCancel && (
                        <button
                          onClick={() => cancelMyBooking(b.id)}
                          style={{
                            padding: "7px 14px", background: "#fff", color: "#ef4444",
                            border: "1px solid #fecaca", borderRadius: "8px",
                            fontWeight: "600", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap"
                          }}
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ====== SUPPLIERS TAB ====== */}
      {activeTab === "suppliers" && (
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: "#fff", borderRadius: "20px", border: "1px solid #f0f0f0"
        }}>
          <span style={{ fontSize: "48px", display: "block", marginBottom: "12px" }}>🏪</span>
          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#111827", margin: "0 0 8px" }}>
            Verified Suppliers Coming Soon
          </h3>
          <p style={{ color: "#9ca3af", fontSize: "14px" }}>
            Find trusted feed, medicine and equipment suppliers near you.
          </p>
        </div>
      )}

      {/* ====== BOOK A VISIT MODAL ====== */}
      {showBookingForm && (
        <div
          onClick={() => setShowBookingForm(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, padding: "20px"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: "20px",
              padding: "28px", maxWidth: "480px", width: "100%",
              maxHeight: "90vh", overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#111827" }}>
                Book a Visit
              </h2>
              <button
                onClick={() => setShowBookingForm(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} color="#9ca3af" />
              </button>
            </div>

            <form onSubmit={submitBookingRequest}>
              {/* PREFERRED VET */}
              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Preferred Vet (optional)</label>
                <select
                  value={bookingForm.requested_vet_id}
                  onChange={e => setBookingForm({ ...bookingForm, requested_vet_id: e.target.value })}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="">No preference — open to any available vet</option>
                  {verifiedVets.map(v => (
                    <option key={v.user_id} value={v.user_id}>
                      {v.full_name}
                      {v.service_counties?.length ? ` — ${v.service_counties.join(", ")}` : ""}
                    </option>
                  ))}
                </select>
                {verifiedVets.length === 0 && (
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#9ca3af" }}>
                    No verified vets listed yet — your request will be open to any available vet.
                  </p>
                )}
              </div>

              {/* FARM NAME */}
              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Farm Name</label>
                <input
                  placeholder="e.g. Green Valley Poultry"
                  value={bookingForm.farm_name}
                  onChange={e => setBookingForm({ ...bookingForm, farm_name: e.target.value })}
                  required
                  style={inputStyle}
                />
              </div>

              {/* COUNTY + BIRD COUNT */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={labelStyle}>County</label>
                  <input
                    placeholder="e.g. Kiambu"
                    value={bookingForm.county}
                    onChange={e => setBookingForm({ ...bookingForm, county: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Bird Count</label>
                  <input
                    type="number" placeholder="e.g. 200"
                    value={bookingForm.bird_count}
                    onChange={e => setBookingForm({ ...bookingForm, bird_count: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* DATE + TIME */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <label style={labelStyle}>Preferred Date</label>
                  <input
                    type="date"
                    value={bookingForm.appointment_date}
                    onChange={e => setBookingForm({ ...bookingForm, appointment_date: e.target.value })}
                    required
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Preferred Time</label>
                  <input
                    type="time"
                    value={bookingForm.appointment_time}
                    onChange={e => setBookingForm({ ...bookingForm, appointment_time: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* URGENCY */}
              <div style={{ marginBottom: "14px" }}>
                <label style={labelStyle}>Urgency</label>
                <select
                  value={bookingForm.urgency}
                  onChange={e => setBookingForm({ ...bookingForm, urgency: e.target.value })}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  {URGENCY_OPTIONS.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>

              {/* REASON */}
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Reason for Visit</label>
                <textarea
                  placeholder="Describe the problem, symptoms, or purpose of the visit..."
                  value={bookingForm.reason}
                  onChange={e => setBookingForm({ ...bookingForm, reason: e.target.value })}
                  style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
                />
              </div>

              {bookingError && (
                <div style={{
                  background: "#fef2f2", border: "1px solid #fecaca",
                  color: "#dc2626", padding: "10px 14px",
                  borderRadius: "8px", fontSize: "13px", marginBottom: "14px"
                }}>
                  ⚠️ {bookingError}
                </div>
              )}

              <button
                type="submit"
                disabled={bookingSaving}
                style={{
                  width: "100%", padding: "14px",
                  background: bookingSaving
                    ? "#86efac"
                    : "linear-gradient(135deg,#22c55e,#16a34a)",
                  color: "#fff", border: "none", borderRadius: "12px",
                  fontWeight: "700", fontSize: "15px",
                  cursor: bookingSaving ? "not-allowed" : "pointer"
                }}
              >
                {bookingSaving ? "Submitting..." : "Submit Request"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ====== EMERGENCY MODAL ====== */}
      {showEmergency && (
        <div
          onClick={() => setShowEmergency(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, padding: "20px"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: "20px",
              padding: "28px", maxWidth: "480px", width: "100%"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <AlertTriangle size={22} color="#ef4444" />
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#ef4444" }}>
                  Emergency Poultry Support
                </h2>
              </div>
              <button
                onClick={() => setShowEmergency(false)}
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} color="#9ca3af" />
              </button>
            </div>
            <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "16px" }}>
              Describe the emergency — a verified vet will respond urgently.
            </p>
            <textarea
              placeholder="e.g. 50 birds suddenly dying, gasping for air, blood in droppings..."
              value={emergencyText}
              onChange={e => setEmergencyText(e.target.value)}
              style={{
                ...inputStyle,
                minHeight: "120px", resize: "vertical",
                border: "2px solid #ef4444", marginBottom: "16px"
              }}
            />
            <div style={{ marginBottom: "16px" }}>
              <p style={{ margin: "0 0 8px", fontSize: "13px", color: "#6b7280" }}>
                Upload photos/videos (optional)
              </p>
              <div style={{
                border: "1px solid #e5e7eb", borderRadius: "10px",
                padding: "14px", display: "flex", alignItems: "center",
                gap: "8px", cursor: "pointer", color: "#9ca3af", fontSize: "14px"
              }}>
                <Upload size={16} /> Tap to attach photos
              </div>
            </div>
            <button
              onClick={submitEmergency}
              style={{
                width: "100%", padding: "14px",
                background: "#ef4444", color: "#fff",
                border: "none", borderRadius: "12px",
                fontWeight: "700", fontSize: "15px", cursor: "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: "8px"
              }}
            >
              🚨 Send Emergency Request
            </button>
          </div>
        </div>
      )}
    </div>
  );
}