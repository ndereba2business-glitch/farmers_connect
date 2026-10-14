import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Stethoscope, Search, AlertTriangle, X, Send, Upload, MapPin,
  Calendar, Clock, CalendarPlus, FileText, Siren, Check, Bird, Bug, Syringe, Wheat, Egg, TrendingDown, TrendingUp, MessageCircleQuestion, CalendarDays, Mail, Store
} from "lucide-react";
import VisitReportModal from "../components/VisitReportModal";
import FarmerMessagesPanel from "../components/FarmerMessagesPanel";
import SupplierDirectory from "../components/SupplierDirectory";

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

const QUESTION_CATEGORIES = [
  { label: "Disease Symptoms", icon: Bug },
  { label: "Vaccination", icon: Syringe },
  { label: "Feeding", icon: Wheat },
  { label: "Egg Production", icon: Egg },
  { label: "Chick Mortality", icon: TrendingDown },
  { label: "Broiler Growth", icon: TrendingUp },
  { label: "Layers", icon: Bird },
  { label: "Emergency", icon: Siren },
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
  { value: "low", label: "Low — routine check", bg: "var(--fc-bg-green50)", color: "var(--fc-fg-green700)" },
  { value: "medium", label: "Medium — needs attention soon", bg: "var(--fc-bg-amber50)", color: "var(--fc-fg-amber600)" },
  { value: "high", label: "High — urgent", bg: "var(--fc-bg-amber51)", color: "var(--fc-fg-amber601)" },
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
  width: "100%", padding: "11px 14px", borderRadius: "12px",
  border: "1.5px solid var(--fc-line-gray200)", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "var(--fc-bg-gray0)"
};

const labelStyle = {
  display: "block", fontSize: "12px", fontWeight: "600",
  color: "var(--fc-fg-gray500)", marginBottom: "6px"
};

export default function Bookings() {
  const { userEmail, user } = useAuth();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState("ask");
  const [showEmergency, setShowEmergency] = useState(false);
  const [questions, setQuestions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("Disease Symptoms");
  const [questionText, setQuestionText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [emergencyText, setEmergencyText] = useState("");
  const [emergencySubmitting, setEmergencySubmitting] = useState(false);
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
  const [bookingsLoadError, setBookingsLoadError] = useState("");

  // ── VISIT REPORT (Phase 3.3) ──
  const [reportTarget, setReportTarget] = useState(null);
  const [reportRecord, setReportRecord] = useState(null);
  const [loadingReport, setLoadingReport] = useState(false);

  async function openReport(appt) {
    setReportTarget(appt);
    setReportRecord(null);
    setLoadingReport(true);
    const { data, error } = await supabase
      .from("visit_records")
      .select("*")
      .eq("appointment_id", appt.id)
      .maybeSingle();
    if (error) console.error("Bookings: failed to load visit report —", error.message);
    setReportRecord(data || null);
    setLoadingReport(false);
  }

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
        .select("user_id, email, full_name, service_counties, specializations, accepts_emergency")
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
      setBookingsLoadError("Your visit requests couldn't load. Check your connection and retry.");
      setLoadingBookings(false);
      return;
    }
    setBookingsLoadError("");
    setMyBookings(data || []);
    setLoadingBookings(false);
  }

  useEffect(() => {
    loadMyBookings();
  }, [user?.id, userEmail]);

  async function submitQuestion() {
    if (!questionText.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("vet_questions").insert([{
      user_email: userEmail,
      farmer_id: user?.id || null,
      category: selectedCategory,
      question: questionText,
      status: "pending",
      is_emergency: false
    }]);
    setSubmitting(false);
    // Keep the question in the box so nothing typed is lost; the button tries again.
    if (error) { toast.error("Your question was not sent. Check your connection and tap Submit again."); return; }
    setQuestionText("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
    const { data } = await supabase
      .from("vet_questions").select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });
    setQuestions(data || []);
  }

  async function submitEmergency() {
    if (!emergencyText.trim() || emergencySubmitting) return;
    setEmergencySubmitting(true);
    const { error } = await supabase.from("vet_questions").insert([{
      user_email: userEmail,
      farmer_id: user?.id || null,
      category: "Emergency",
      question: emergencyText,
      status: "pending",
      is_emergency: true
    }]);
    setEmergencySubmitting(false);
    if (error) { toast.error("Failed to send emergency request: " + error.message); return; }
    setEmergencyText("");
    setShowEmergency(false);
    toast.success("Emergency request sent! A vet will respond urgently.");
  }

  // ── SUBMIT A VISIT REQUEST ──
  async function submitBookingRequest(e) {
    e.preventDefault();
    setBookingError("");

    if (!bookingForm.farm_name || !bookingForm.appointment_date) {
      setBookingError("Farm name and date are required.");
      return;
    }
    if (bookingForm.appointment_date < todayISO()) {
      setBookingError("Preferred date can't be in the past.");
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
    const { data, error } = await supabase
      .from("vet_appointments")
      .update({ status: "cancelled" })
      .eq("id", id)
      .in("status", ["pending", "accepted"])
      .select();

    if (error) {
      toast.error("Failed to cancel: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      toast.error("This request can no longer be cancelled — its status already changed.");
    }
    loadMyBookings();
  }

  const TABS = [
    { key: "vets", label: "Vets", icon: Stethoscope },
    { key: "ask", label: "Ask", icon: MessageCircleQuestion },
    { key: "bookings", label: "Bookings", icon: CalendarDays },
    { key: "messages", label: "Messages", icon: Mail },
    { key: "suppliers", label: "Suppliers", icon: Store },
  ];

  function urgencyMeta(value) {
    return URGENCY_OPTIONS.find(u => u.value === value) || URGENCY_OPTIONS[1];
  }

  function statusMeta(status) {
    switch (status) {
      case "accepted": return { bg: "var(--fc-bg-green100)", color: "var(--fc-fg-green700)", label: "Confirmed" };
      case "completed": return { bg: "var(--fc-bg-green50)", color: "var(--fc-fg-green700)", label: "Completed" };
      case "cancelled": return { bg: "var(--fc-bg-gray100)", color: "var(--fc-fg-gray400)", label: "Cancelled" };
      case "rejected": return { bg: "var(--fc-bg-red50)", color: "var(--fc-fg-red500)", label: "Declined" };
      default: return { bg: "var(--fc-bg-amber100)", color: "var(--fc-fg-amber600)", label: "Pending" };
    }
  }

  return (
    <div style={{ maxWidth: "900px" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div>
            <h1 className="fc-page-title">
              Ask Vet
            </h1>
            <p style={{ margin: "4px 0 0", color: "var(--fc-fg-gray500)", fontSize: "14px" }}>
              Connect with verified poultry vets across Kenya
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowEmergency(true)}
          style={{
            height: "44px", padding: "0 20px", border: "none",
            borderRadius: "12px", background: "#dc2626",
            color: "white", fontWeight: "700", cursor: "pointer",
            fontSize: "14px", display: "flex", alignItems: "center",
            gap: "8px", boxShadow: "none"
          }}
        >
          <Siren size={14} aria-hidden="true" /> Emergency
        </button>
      </div>

      {/* TABS — one row on wider screens; wraps onto a second row on
          small phones so every tab stays visible and the page never
          scrolls sideways. */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "2px",
        background: "var(--fc-bg-gray100)",
        borderRadius: "12px", padding: "4px",
        marginBottom: "24px"
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className="fc-tap"
            aria-pressed={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: "1 0 auto", padding: "10px",
              whiteSpace: "nowrap",
              borderRadius: "12px", border: "none",
              cursor: "pointer", fontWeight: "600", fontSize: "13px",
              background: activeTab === tab.key ? "var(--fc-bg-gray0)" : "transparent",
              color: activeTab === tab.key ? "var(--fc-fg-gray900)" : "var(--fc-fg-gray400)",
              boxShadow: activeTab === tab.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              display: "flex", alignItems: "center",
              justifyContent: "center", gap: "6px",
              transition: "all 0.2s"
            }}
          >
            <tab.icon size={16} aria-hidden="true" /> {tab.label}
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
              top: "50%", transform: "translateY(-50%)", color: "var(--fc-fg-gray400)"
            }} />
            <input
              aria-label="Search vets by name" placeholder="Search vets by name..."
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
              background: "var(--fc-bg-gray0)", borderRadius: "16px", border: "1px solid var(--fc-line-gray101)"
            }}>
              <Stethoscope size={48} color="var(--fc-fg-gray200)" style={{ marginBottom: "12px" }} />
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--fc-fg-gray900)", margin: "0 0 8px" }}>
                No verified vets yet
              </h3>
              <p style={{ color: "var(--fc-fg-gray400)", fontSize: "14px" }}>
                Try adjusting your filters or check back later.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {vets.map(vet => (
                <div key={vet.id} style={{
                  background: "var(--fc-bg-gray0)", borderRadius: "16px",
                  border: "1px solid var(--fc-line-gray200)", padding: "16px 20px",
                  display: "flex", alignItems: "center", gap: "16px"
                }}>
                  <div style={{
                    width: "52px", height: "52px", borderRadius: "12px",
                    background: "var(--fc-bg-green100)", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: "22px", flexShrink: 0
                  }}>
                    {vet.avatar_url ? (
                      <img src={vet.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "12px" }} />
                    ) : <Stethoscope size={24} color="var(--fc-fg-green700)" aria-hidden="true" />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: "0 0 4px", fontWeight: "700", fontSize: "15px", color: "var(--fc-fg-gray900)" }}>
                      {vet.full_name}
                    </p>
                    {vet.county && (
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--fc-fg-gray400)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <MapPin size={11} /> {vet.county}
                      </p>
                    )}
                  </div>
                  <span style={{
                    background: "var(--fc-bg-green100)", color: "var(--fc-fg-green700)",
                    fontSize: "11px", fontWeight: "700",
                    padding: "3px 10px", borderRadius: "16px"
                  }}>
                    <Check size={14} aria-hidden="true" /> Verified
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
            background: "var(--fc-bg-gray0)", borderRadius: "16px",
            border: "1px solid var(--fc-line-gray200)", padding: "24px",
            boxShadow: "var(--fc-shadow-card)", marginBottom: "20px"
          }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "16px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
              Ask a Vet Question
            </h2>

            {/* CATEGORY CHIPS */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "16px" }}>
              {QUESTION_CATEGORIES.map(cat => (
                <button
                  key={cat.label}
                  className="fc-tap"
                  onClick={() => setSelectedCategory(cat.label)}
                  style={{
                    padding: "6px 14px", borderRadius: "16px",
                    border: `1.5px solid ${selectedCategory === cat.label ? "var(--fc-line-green700)" : "var(--fc-line-gray200)"}`,
                    background: selectedCategory === cat.label ? "var(--fc-bg-green50)" : "var(--fc-bg-gray0)",
                    color: selectedCategory === cat.label ? "var(--fc-fg-green700)" : "var(--fc-fg-gray700)",
                    fontWeight: "600", fontSize: "13px", cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                >
                  <cat.icon size={16} aria-hidden="true" /> {cat.label}
                </button>
              ))}
            </div>

            {/* QUESTION */}
            <textarea
              aria-label="Describe the problem" placeholder="Describe the problem in detail — symptoms, bird age, number affected, how long..."
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
                  background: "var(--fc-bg-gray50)", border: "1px solid var(--fc-line-gray200)",
                  borderRadius: "12px", cursor: "pointer",
                  fontWeight: "600", fontSize: "13px", color: "var(--fc-fg-gray700)",
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
                    ? "var(--fc-bg-green300)"
                    : "#15803d",
                  color: "var(--fc-fg-gray0)", border: "none", borderRadius: "12px",
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
          <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--fc-fg-gray900)", marginBottom: "12px" }}>
            My Questions
          </h3>
          {questions.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "40px 20px",
              background: "var(--fc-bg-gray0)", borderRadius: "16px", border: "1px solid var(--fc-line-gray101)"
            }}>
              <p style={{ color: "var(--fc-fg-gray400)", fontSize: "14px" }}>
                No questions yet. Ask your first question above.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {questions.map(q => (
                <div key={q.id} style={{
                  background: "var(--fc-bg-gray0)", borderRadius: "12px",
                  border: "1px solid var(--fc-line-gray200)", padding: "16px 18px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <span style={{
                        background: q.is_emergency ? "var(--fc-bg-red50)" : "var(--fc-bg-green50)",
                        color: q.is_emergency ? "var(--fc-fg-red500)" : "var(--fc-fg-green700)",
                        fontSize: "12px", fontWeight: "600",
                        padding: "3px 10px", borderRadius: "16px"
                      }}>
                        {q.is_emergency ? "Emergency" : q.category}
                      </span>
                      <span style={{
                        background: q.status === "answered" ? "var(--fc-bg-green100)" : "var(--fc-bg-gray100)",
                        color: q.status === "answered" ? "var(--fc-fg-green700)" : "var(--fc-fg-gray400)",
                        fontSize: "11px", fontWeight: "600",
                        padding: "3px 10px", borderRadius: "16px"
                      }}>
                        {q.status === "answered" ? "✓ Answered" : "Pending"}
                      </span>
                    </div>
                    <span style={{ fontSize: "12px", color: "var(--fc-fg-gray400)" }}>
                      {new Date(q.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p style={{ margin: "0 0 8px", fontSize: "14px", color: "var(--fc-fg-gray700)" }}>
                    {q.question}
                  </p>
                  {q.answer && (
                    <div style={{
                      background: "var(--fc-bg-green50)", borderRadius: "12px",
                      padding: "10px 14px", borderLeft: "3px solid var(--fc-line-green700)"
                    }}>
                      <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: "700", color: "var(--fc-fg-green700)" }}>
                        VET RESPONSE
                      </p>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--fc-fg-gray700)" }}>{q.answer}</p>
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
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
                My Visit Requests
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--fc-fg-gray400)" }}>
                Request a scheduled farm visit from a vet
              </p>
            </div>
            <button
              onClick={() => { setBookingError(""); setShowBookingForm(true); }}
              style={{
                height: "42px", padding: "0 18px", border: "none",
                borderRadius: "12px",
                background: "#15803d",
                color: "white", fontWeight: "700", cursor: "pointer",
                fontSize: "13px", display: "flex", alignItems: "center", gap: "8px"
              }}
            >
              <CalendarPlus size={16} /> Book a Visit
            </button>
          </div>

          {/* LOAD ERROR BANNER */}
          {!loadingBookings && bookingsLoadError && (
            <div style={{
              display: "flex", alignItems: "center", gap: "10px",
              padding: "12px 16px", borderRadius: "12px",
              background: "var(--fc-bg-red50)", border: "1px solid var(--fc-line-red200)",
              color: "var(--fc-fg-red800)", fontSize: "13px", marginBottom: "16px"
            }}>
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{bookingsLoadError}</span>
              <button
                onClick={loadMyBookings}
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

          {/* MY REQUESTS LIST */}
          {loadingBookings ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{ height: "96px", borderRadius: "16px", background: "var(--fc-bg-gray100)" }} />
              ))}
            </div>
          ) : myBookings.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "var(--fc-bg-gray0)", borderRadius: "16px", border: "1px solid var(--fc-line-gray101)"
            }}>
              <Calendar size={48} color="var(--fc-fg-gray200)" style={{ marginBottom: "12px" }} />
              <h3 style={{ fontSize: "16px", fontWeight: "700", color: "var(--fc-fg-gray900)", margin: "0 0 8px" }}>
                No visit requests yet
              </h3>
              <p style={{ color: "var(--fc-fg-gray400)", fontSize: "14px" }}>
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
                    background: "var(--fc-bg-gray0)", borderRadius: "16px",
                    border: "1px solid var(--fc-line-gray200)", padding: "16px 18px"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontWeight: "700", fontSize: "15px", color: "var(--fc-fg-gray900)" }}>
                            {b.farm_name}
                          </span>
                          <span style={{
                            fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                            borderRadius: "16px", background: urgency.bg, color: urgency.color,
                            textTransform: "capitalize"
                          }}>
                            {b.urgency}
                          </span>
                          <span style={{
                            fontSize: "11px", fontWeight: "700", padding: "2px 8px",
                            borderRadius: "16px", background: status.bg, color: status.color
                          }}>
                            {status.label}
                          </span>
                          {!b.requested_vet_id && b.status === "pending" && (
                            <span style={{
                              fontSize: "11px", fontWeight: "600", padding: "2px 8px",
                              borderRadius: "16px", background: "var(--fc-bg-blue50)", color: "var(--fc-fg-blue500)"
                            }}>
                              Open to any vet
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--fc-fg-gray400)", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Calendar size={11} /> {b.appointment_date}
                          </span>
                          {b.appointment_time && (
                            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={11} /> {b.appointment_time}
                            </span>
                          )}
                          {b.county && <span><MapPin size={14} aria-hidden="true" /> {b.county}</span>}
                          {b.bird_count && <span><Bird size={14} aria-hidden="true" /> {b.bird_count} birds</span>}
                        </div>
                        {b.reason && (
                          <p style={{ margin: "8px 0 0", fontSize: "13px", color: "var(--fc-fg-gray500)" }}>{b.reason}</p>
                        )}
                        {b.status === "rejected" && b.rejection_reason && (
                          <p style={{
                            margin: "8px 0 0", fontSize: "13px", color: "var(--fc-fg-red800)",
                            background: "var(--fc-bg-red50)", padding: "8px 12px", borderRadius: "8px"
                          }}>
                            <strong>Vet's reason:</strong> {b.rejection_reason}
                          </p>
                        )}
                      </div>
                      {canCancel && (
                        <button
                          onClick={() => cancelMyBooking(b.id)}
                          style={{
                            padding: "7px 14px", background: "var(--fc-bg-gray0)", color: "var(--fc-fg-red500)",
                            border: "1px solid var(--fc-line-red200)", borderRadius: "8px",
                            fontWeight: "600", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap"
                          }}
                        >
                          Cancel
                        </button>
                      )}
                      {b.status === "completed" && (
                        <button
                          onClick={() => openReport(b)}
                          style={{
                            display: "flex", alignItems: "center", gap: "6px",
                            padding: "7px 14px", background: "var(--fc-bg-green50)", color: "var(--fc-fg-green700)",
                            border: "1px solid var(--fc-line-green200)", borderRadius: "8px",
                            fontWeight: "700", fontSize: "12px", cursor: "pointer", whiteSpace: "nowrap"
                          }}
                        >
                          <FileText size={13} /> View Report
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

      {/* ====== MESSAGES TAB ====== */}
      {activeTab === "messages" && (
        <FarmerMessagesPanel />
      )}

      {/* ====== SUPPLIERS TAB ====== */}
      {activeTab === "suppliers" && (
        <SupplierDirectory
          intro="Need a vaccine, a medicine or a feed your vet mentioned? These suppliers have been approved by our team. Call or WhatsApp them to ask what they have and agree a price."
        />
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
              background: "var(--fc-bg-gray0)", borderRadius: "16px",
              padding: "28px", maxWidth: "480px", width: "100%",
              maxHeight: "90vh", overflowY: "auto"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
                Book a Visit
              </h2>
              <button
                onClick={() => setShowBookingForm(false)}
                aria-label="Close"
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} color="var(--fc-fg-gray400)" />
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
                  <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--fc-fg-gray400)" }}>
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
                    min={todayISO()}
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
                  aria-label="Describe the problem" placeholder="Describe the problem, symptoms, or purpose of the visit..."
                  value={bookingForm.reason}
                  onChange={e => setBookingForm({ ...bookingForm, reason: e.target.value })}
                  style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
                />
              </div>

              {bookingError && (
                <div style={{
                  background: "var(--fc-bg-red50)", border: "1px solid var(--fc-line-red200)",
                  color: "var(--fc-fg-red600)", padding: "10px 14px",
                  borderRadius: "8px", fontSize: "13px", marginBottom: "14px"
                }}>
                  <AlertTriangle size={14} aria-hidden="true" /> {bookingError}
                </div>
              )}

              <button
                type="submit"
                disabled={bookingSaving}
                style={{
                  width: "100%", padding: "14px",
                  background: bookingSaving
                    ? "var(--fc-bg-green300)"
                    : "#15803d",
                  color: "var(--fc-fg-gray0)", border: "none", borderRadius: "12px",
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
              background: "var(--fc-bg-gray0)", borderRadius: "16px",
              padding: "28px", maxWidth: "480px", width: "100%"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <AlertTriangle size={22} color="var(--fc-fg-red500)" />
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "var(--fc-fg-red500)" }}>
                  Emergency Poultry Support
                </h2>
              </div>
              <button
                onClick={() => setShowEmergency(false)}
                aria-label="Close"
                style={{ background: "none", border: "none", cursor: "pointer" }}
              >
                <X size={20} color="var(--fc-fg-gray400)" />
              </button>
            </div>
            <p style={{ color: "var(--fc-fg-gray500)", fontSize: "14px", marginBottom: "16px" }}>
              Describe the emergency — a verified vet will respond urgently.
            </p>
            <textarea
              placeholder="e.g. 50 birds suddenly dying, gasping for air, blood in droppings..."
              value={emergencyText}
              onChange={e => setEmergencyText(e.target.value)}
              style={{
                ...inputStyle,
                minHeight: "120px", resize: "vertical",
                border: "2px solid var(--fc-line-red500)", marginBottom: "16px"
              }}
            />
            <div style={{ marginBottom: "16px" }}>
              <p style={{ margin: "0 0 8px", fontSize: "13px", color: "var(--fc-fg-gray500)" }}>
                Upload photos/videos (optional)
              </p>
              <div style={{
                border: "1px solid var(--fc-line-gray200)", borderRadius: "12px",
                padding: "14px", display: "flex", alignItems: "center",
                gap: "8px", cursor: "pointer", color: "var(--fc-fg-gray400)", fontSize: "14px"
              }}>
                <Upload size={16} /> Tap to attach photos
              </div>
            </div>
            <button
              onClick={submitEmergency}
              disabled={emergencySubmitting}
              style={{
                width: "100%", padding: "14px",
                background: emergencySubmitting ? "var(--fc-bg-red300)" : "#dc2626", color: "var(--fc-fg-gray0)",
                border: "none", borderRadius: "12px",
                fontWeight: "700", fontSize: "15px", cursor: emergencySubmitting ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "center", gap: "8px"
              }}
            >
              {emergencySubmitting ? "Sending..." : "Send Emergency Request"}
            </button>
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