import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { Stethoscope, CheckCircle2, Clock, XCircle, Ban, Save } from "lucide-react";

const KENYA_COUNTIES = [
  "Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", "Thika",
  "Kiambu", "Machakos", "Meru", "Nyeri", "Kakamega", "Kisii",
  "Embu", "Garissa"
];

const SPECIALIZATION_OPTIONS = [
  "Disease Diagnosis", "Vaccination", "Nutrition",
  "Egg Production", "Chick Mortality", "Broiler Growth", "Layers"
];

const STATUS_META = {
  unverified: { bg: "#f3f4f6", color: "#6b7280", icon: Clock, label: "Not submitted yet — fill out your profile below" },
  missing: { bg: "#f3f4f6", color: "#6b7280", icon: Clock, label: "Not submitted yet — fill out your profile below" },
  pending: { bg: "#fef3c7", color: "#d97706", icon: Clock, label: "Pending review — an admin will review your profile soon" },
  verified: { bg: "#dcfce7", color: "#16a34a", icon: CheckCircle2, label: "Verified — farmers can find and book you" },
  rejected: { bg: "#fee2e2", color: "#ef4444", icon: XCircle, label: "Rejected — update your details and resubmit" },
  suspended: { bg: "#fee2e2", color: "#991b1b", icon: Ban, label: "Suspended — contact support to appeal" },
};

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "#fff", color: "#111827"
};

const labelStyle = {
  display: "block", fontSize: "13px", fontWeight: "600",
  color: "#374151", marginBottom: "6px"
};

const EMPTY_FORM = {
  full_name: "", bio: "", service_counties: [], specializations: [],
  accepts_emergency: false, base_fee: "", license_number: ""
};

export default function VetProfileSetup() {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(null); // null = not loaded yet
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from("vet_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) {
        console.error("VetProfileSetup: failed to load profile —", fetchError.message);
        setLoading(false);
        return;
      }

      if (data) {
        setCurrentStatus(data.verification_status);
        setForm({
          full_name: data.full_name || "",
          bio: data.bio || "",
          service_counties: data.service_counties || [],
          specializations: data.specializations || [],
          accepts_emergency: !!data.accepts_emergency,
          base_fee: data.base_fee != null ? String(data.base_fee) : "",
          license_number: data.license_number || ""
        });
      } else {
        setCurrentStatus("missing");
        setForm(f => ({ ...f, full_name: profile?.full_name || "" }));
      }
      setLoading(false);
    }
    loadProfile();
  }, [user?.id]);

  function toggleArrayValue(field, value) {
    setForm(f => {
      const list = f[field].includes(value)
        ? f[field].filter(v => v !== value)
        : [...f[field], value];
      return { ...f, [field]: list };
    });
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");

    if (!form.full_name.trim()) {
      setError("Full name is required.");
      return;
    }
    if (!user?.id) {
      setError("You must be logged in.");
      return;
    }

    // A suspended vet can't self-reactivate by editing their profile.
    // Rejected/unverified re-enters the pending review queue on resubmit.
    // Already verified or already pending simply keeps its current state.
    let nextStatus = "pending";
    if (currentStatus === "suspended") nextStatus = "suspended";
    else if (currentStatus === "verified" || currentStatus === "pending") nextStatus = currentStatus;

    setSaving(true);

    const { error: upsertError } = await supabase
      .from("vet_profiles")
      .upsert({
        user_id: user.id,
        full_name: form.full_name.trim(),
        bio: form.bio.trim() || null,
        service_counties: form.service_counties,
        specializations: form.specializations,
        accepts_emergency: form.accepts_emergency,
        base_fee: form.base_fee ? Number(form.base_fee) : null,
        license_number: form.license_number.trim() || null,
        verification_status: nextStatus,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    setSaving(false);

    if (upsertError) {
      setError("Failed to save profile: " + upsertError.message);
      return;
    }

    setCurrentStatus(nextStatus);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  const statusMeta = STATUS_META[currentStatus] || STATUS_META.missing;
  const StatusIcon = statusMeta.icon;

  if (loading) {
    return <p style={{ color: "#9ca3af", fontSize: "14px" }}>Loading your profile...</p>;
  }

  return (
    <div style={{ maxWidth: "680px" }}>
      {/* HEADER */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <Stethoscope size={28} color="#22c55e" />
        <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
          My Vet Profile
        </h1>
      </div>
      <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "20px" }}>
        This information is shown to farmers when they choose a vet to book.
      </p>

      {/* STATUS BANNER */}
      <div style={{
        display: "flex", alignItems: "center", gap: "10px",
        padding: "14px 16px", borderRadius: "12px",
        background: statusMeta.bg, marginBottom: "24px"
      }}>
        <StatusIcon size={18} color={statusMeta.color} />
        <span style={{ fontSize: "13px", fontWeight: "600", color: statusMeta.color }}>
          {statusMeta.label}
        </span>
      </div>

      <form onSubmit={handleSave} style={{
        background: "#fff", borderRadius: "20px", border: "1px solid #e5e7eb",
        padding: "28px", boxShadow: "0 4px 20px rgba(0,0,0,0.04)"
      }}>
        {/* FULL NAME */}
        <div style={{ marginBottom: "18px" }}>
          <label style={labelStyle}>Full Name</label>
          <input
            placeholder="Dr. Jane Wanjiru"
            value={form.full_name}
            onChange={e => setForm({ ...form, full_name: e.target.value })}
            required
            style={inputStyle}
          />
        </div>

        {/* BIO */}
        <div style={{ marginBottom: "18px" }}>
          <label style={labelStyle}>Bio (optional)</label>
          <textarea
            placeholder="A short introduction — experience, focus areas, years practicing..."
            value={form.bio}
            onChange={e => setForm({ ...form, bio: e.target.value })}
            style={{ ...inputStyle, minHeight: "90px", resize: "vertical" }}
          />
        </div>

        {/* LICENSE NUMBER */}
        <div style={{ marginBottom: "18px" }}>
          <label style={labelStyle}>License / Registration Number (optional)</label>
          <input
            placeholder="e.g. KVB-2024-00123"
            value={form.license_number}
            onChange={e => setForm({ ...form, license_number: e.target.value })}
            style={inputStyle}
          />
          <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#9ca3af" }}>
            Helps admins verify you faster. Document upload is coming in a future update.
          </p>
        </div>

        {/* BASE FEE */}
        <div style={{ marginBottom: "22px" }}>
          <label style={labelStyle}>Typical Visit Fee (KES, optional)</label>
          <input
            type="number" placeholder="e.g. 1500"
            value={form.base_fee}
            onChange={e => setForm({ ...form, base_fee: e.target.value })}
            style={inputStyle}
          />
        </div>

        {/* SERVICE COUNTIES */}
        <div style={{ marginBottom: "22px" }}>
          <label style={labelStyle}>Counties You Serve</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {KENYA_COUNTIES.map(county => {
              const active = form.service_counties.includes(county);
              return (
                <button
                  key={county}
                  type="button"
                  onClick={() => toggleArrayValue("service_counties", county)}
                  style={{
                    padding: "6px 14px", borderRadius: "20px",
                    border: `1.5px solid ${active ? "#22c55e" : "#e5e7eb"}`,
                    background: active ? "#f0fdf4" : "#fff",
                    color: active ? "#16a34a" : "#374151",
                    fontWeight: "600", fontSize: "13px", cursor: "pointer"
                  }}
                >
                  {county}
                </button>
              );
            })}
          </div>
        </div>

        {/* SPECIALIZATIONS */}
        <div style={{ marginBottom: "22px" }}>
          <label style={labelStyle}>Specializations</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {SPECIALIZATION_OPTIONS.map(spec => {
              const active = form.specializations.includes(spec);
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => toggleArrayValue("specializations", spec)}
                  style={{
                    padding: "6px 14px", borderRadius: "20px",
                    border: `1.5px solid ${active ? "#22c55e" : "#e5e7eb"}`,
                    background: active ? "#f0fdf4" : "#fff",
                    color: active ? "#16a34a" : "#374151",
                    fontWeight: "600", fontSize: "13px", cursor: "pointer"
                  }}
                >
                  {spec}
                </button>
              );
            })}
          </div>
        </div>

        {/* EMERGENCY AVAILABILITY */}
        <label style={{
          display: "flex", alignItems: "center", gap: "10px",
          padding: "14px 16px", borderRadius: "12px",
          background: "#fef2f2", border: "1px solid #fecaca",
          marginBottom: "24px", cursor: "pointer"
        }}>
          <input
            type="checkbox"
            checked={form.accepts_emergency}
            onChange={e => setForm({ ...form, accepts_emergency: e.target.checked })}
            style={{ width: "18px", height: "18px", accentColor: "#ef4444" }}
          />
          <span style={{ fontSize: "13px", fontWeight: "600", color: "#991b1b" }}>
            I'm available for emergency requests
          </span>
        </label>

        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca",
            color: "#dc2626", padding: "10px 14px",
            borderRadius: "8px", fontSize: "13px", marginBottom: "16px"
          }}>
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          style={{
            width: "100%", padding: "14px",
            background: saving ? "#86efac" : "linear-gradient(135deg,#22c55e,#16a34a)",
            color: "#fff", border: "none", borderRadius: "12px",
            fontWeight: "700", fontSize: "15px",
            cursor: saving ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "8px"
          }}
        >
          <Save size={16} />
          {saving ? "Saving..." : saved ? "Saved ✓" : (currentStatus !== "missing" ? "Update Profile" : "Submit for Review")}
        </button>
      </form>
    </div>
  );
}