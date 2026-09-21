import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useSupplier } from "../components/supplier/supplierContext";

const TYPES = [
  { value: "feeds", label: "Feeds" },
  { value: "hatchery", label: "Chicks / hatchery" },
  { value: "medicine", label: "Medicine" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" }
];

const STATUS_META = {
  pending: { text: "Waiting for admin review. Farmers can order from you once you're verified.", bg: "#fffbeb", color: "#92400e" },
  verified: { text: "Verified. Farmers can now order your products.", bg: "#f0fdf4", color: "#166534" },
  rejected: { text: "Not approved. Contact support if you think this is a mistake.", bg: "#fef2f2", color: "#b91c1c" },
  suspended: { text: "Suspended. Contact support to restore your account.", bg: "#fef2f2", color: "#b91c1c" }
};

const inputStyle = {
  width: "100%", minHeight: "44px", padding: "10px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "16px", outline: "none",
  boxSizing: "border-box", background: "#fff", color: "#111827"
};
const labelStyle = { display: "block", fontSize: "13px", fontWeight: "600", color: "#374151", marginBottom: "6px" };

export default function SupplierProfileSetup() {
  const { user } = useAuth();
  const { refreshProfile } = useSupplier();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState({
    business_name: "", phone: "", whatsapp_number: "", county: "",
    supplier_type: "feeds", description: "", delivery_available: false
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      const { data, error: loadError } = await supabase
        .from("supplier_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (loadError) {
        setError("We couldn't load your profile. Check your connection and refresh.");
      } else if (data) {
        setStatus(data.verification_status);
        setForm({
          business_name: data.business_name || "",
          phone: data.phone || "",
          whatsapp_number: data.whatsapp_number || "",
          county: data.county || "",
          supplier_type: data.supplier_type || "feeds",
          description: data.description || "",
          delivery_available: !!data.delivery_available
        });
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user]);

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setError("");

    if (!form.business_name.trim() || !form.phone.trim() || !form.county.trim()) {
      setError("Business name, phone number and county are required.");
      return;
    }

    setSaving(true);
    // verification_status is deliberately not sent: new profiles start as
    // pending and only an admin can change it.
    const { data, error: saveError } = await supabase
      .from("supplier_profiles")
      .upsert({
        user_id: user.id,
        business_name: form.business_name.trim(),
        phone: form.phone.trim(),
        whatsapp_number: form.whatsapp_number.trim() || null,
        county: form.county.trim(),
        supplier_type: form.supplier_type,
        description: form.description.trim() || null,
        delivery_available: form.delivery_available
      }, { onConflict: "user_id" })
      .select("verification_status")
      .single();
    setSaving(false);

    if (saveError) {
      setError("Couldn't save your profile: " + saveError.message);
      return;
    }

    setStatus(data.verification_status);
    refreshProfile();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) return <p style={{ color: "#9ca3af" }}>Loading your profile...</p>;

  const meta = STATUS_META[status];

  return (
    <div style={{ maxWidth: "680px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <Store size={28} color="#22c55e" aria-hidden="true" />
        <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
          Supplier Profile
        </h1>
      </div>
      <p style={{ margin: "8px 0 20px", color: "#6b7280", fontSize: "15px" }}>
        This is what farmers see when they find your products.
      </p>

      {meta && (
        <div role="status" style={{ marginBottom: "20px", padding: "14px 16px", borderRadius: "12px", background: meta.bg, color: meta.color, fontSize: "14px" }}>
          {meta.text}
        </div>
      )}

      <form onSubmit={handleSave} style={{
        background: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px",
        padding: "24px", display: "grid", gap: "16px"
      }}>
        <div>
          <label style={labelStyle} htmlFor="sp-name">Business name</label>
          <input id="sp-name" style={inputStyle} value={form.business_name} onChange={e => set("business_name", e.target.value)} />
        </div>

        <div>
          <label style={labelStyle} htmlFor="sp-type">What do you supply?</label>
          <select id="sp-type" style={inputStyle} value={form.supplier_type} onChange={e => set("supplier_type", e.target.value)}>
            {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <label style={labelStyle} htmlFor="sp-phone">Phone number</label>
          <input id="sp-phone" type="tel" inputMode="tel" style={inputStyle} placeholder="e.g. 0712345678" value={form.phone} onChange={e => set("phone", e.target.value)} />
        </div>

        <div>
          <label style={labelStyle} htmlFor="sp-wa">WhatsApp number (optional)</label>
          <input id="sp-wa" type="tel" inputMode="tel" style={inputStyle} value={form.whatsapp_number} onChange={e => set("whatsapp_number", e.target.value)} />
        </div>

        <div>
          <label style={labelStyle} htmlFor="sp-county">County</label>
          <input id="sp-county" style={inputStyle} placeholder="e.g. Kiambu" value={form.county} onChange={e => set("county", e.target.value)} />
        </div>

        <div>
          <label style={labelStyle} htmlFor="sp-desc">About your business (optional)</label>
          <textarea id="sp-desc" rows={3} style={{ ...inputStyle, resize: "vertical" }} value={form.description} onChange={e => set("description", e.target.value)} />
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "12px", minHeight: "44px", fontSize: "14px", color: "#374151", cursor: "pointer" }}>
          <input type="checkbox" style={{ width: "22px", height: "22px" }} checked={form.delivery_available} onChange={e => set("delivery_available", e.target.checked)} />
          I can deliver to farmers
        </label>

        {error && (
          <div role="alert" style={{ padding: "12px 14px", borderRadius: "10px", background: "#fef2f2", color: "#b91c1c", fontSize: "14px" }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={saving} style={{
          minHeight: "48px", border: "none", borderRadius: "12px",
          background: saving ? "#86efac" : "linear-gradient(135deg,#22c55e,#16a34a)",
          color: "#fff", fontWeight: "700", fontSize: "15px",
          cursor: saving ? "not-allowed" : "pointer"
        }}>
          {saving ? "Saving..." : saved ? "Saved ✓" : status ? "Save changes" : "Submit for review"}
        </button>
      </form>
    </div>
  );
}
