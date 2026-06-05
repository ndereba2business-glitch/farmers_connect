import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Stethoscope, Search, AlertTriangle,
  X, Send, Upload, MapPin, Star
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

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "#fff"
};

export default function Bookings() {
  const { userEmail } = useAuth();
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

  async function submitQuestion() {
    if (!questionText.trim()) return;
    setSubmitting(true);
    await supabase.from("vet_questions").insert([{
      user_email: userEmail,
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
      category: "Emergency",
      question: emergencyText,
      status: "pending",
      is_emergency: true
    }]);
    setEmergencyText("");
    setShowEmergency(false);
    alert("Emergency request sent! A vet will respond urgently.");
  }

  const TABS = [
    { key: "vets", label: "Vets", icon: "🩺" },
    { key: "ask", label: "Ask", icon: "💬" },
    { key: "bookings", label: "Bookings", icon: "📅" },
    { key: "suppliers", label: "Suppliers", icon: "🏪" },
  ];

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
        <div style={{
          textAlign: "center", padding: "60px 20px",
          background: "#fff", borderRadius: "20px", border: "1px solid #f0f0f0"
        }}>
          <span style={{ fontSize: "48px", display: "block", marginBottom: "12px" }}>📅</span>
          <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#111827", margin: "0 0 8px" }}>
            Vet Bookings Coming Soon
          </h3>
          <p style={{ color: "#9ca3af", fontSize: "14px" }}>
            Schedule video or in-person consultations with verified vets.
          </p>
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