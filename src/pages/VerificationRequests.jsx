import { useEffect, useState } from "react";
import { BadgeCheck, MapPin, Phone, RotateCcw, UserRound } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../context/ToastContext";

const FILTERS = [
  { value: "unverified", label: "Not verified" },
  { value: "verified", label: "Verified" }
];

const btn = (primary) => ({
  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px",
  minHeight: "44px", padding: "0 16px", borderRadius: "10px", cursor: "pointer",
  fontWeight: "700", fontSize: "13px",
  border: primary ? "none" : "1px solid #e5e7eb",
  background: primary ? "#16a34a" : "#fff",
  color: primary ? "#fff" : "#374151"
});

// Admin-only (route + database policy). Only admins can change
// farmer_profiles.verified; a trigger undoes it for anyone else.
export default function VerificationRequests() {
  const toast = useToast();
  const [filter, setFilter] = useState("unverified");
  const [farmers, setFarmers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data, error: loadError } = await supabase
        .from("farmer_profiles")
        .select("id, full_name, farm_name, county, phone, farm_type, avatar_url, user_email, verified, created_at")
        .eq("verified", filter === "verified")
        .order("created_at", { ascending: false })
        .limit(200);

      if (cancelled) return;
      if (loadError) {
        setError("We couldn't load farmers. Check your connection and try again.");
      } else {
        setFarmers(data || []);
        setError("");
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [filter, reload]);

  function changeFilter(value) {
    setFilter(value);
    setLoading(true);
  }

  async function setVerified(farmer, verified) {
    setBusyId(farmer.id);
    const { data, error: updateError } = await supabase
      .from("farmer_profiles")
      .update({ verified })
      .eq("id", farmer.id)
      .select("verified");
    setBusyId(null);

    // An update blocked by permissions returns no rows rather than an error.
    if (updateError || !data?.length || data[0].verified !== verified) {
      toast.error(updateError ? "That didn't save: " + updateError.message : "That didn't save. Your account may not have admin rights.");
      return;
    }
    toast.success(verified ? `${farmer.full_name || "Farmer"} is now verified.` : `Verification removed for ${farmer.full_name || "this farmer"}.`);
    setFarmers(prev => prev.filter(f => f.id !== farmer.id));
  }

  return (
    <div style={{ maxWidth: "880px" }}>
      <h1 style={{ margin: 0, fontSize: "30px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
        Farmer verification
      </h1>
      <p style={{ margin: "6px 0 20px", color: "#6b7280", fontSize: "14px" }}>
        Mark farmers you've confirmed as genuine. Vets and suppliers are reviewed in the Admin Panel.
      </p>

      <div role="tablist" aria-label="Filter farmers" style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        {FILTERS.map(f => (
          <button key={f.value} role="tab" aria-selected={filter === f.value} onClick={() => changeFilter(f.value)}
            style={{
              ...btn(false), borderRadius: "22px",
              background: filter === f.value ? "#111827" : "#fff",
              color: filter === f.value ? "#fff" : "#6b7280",
              border: `1.5px solid ${filter === f.value ? "#111827" : "#e5e7eb"}`
            }}>
            {f.label}
          </button>
        ))}
      </div>

      {error ? (
        <div role="alert" style={{ padding: "14px 16px", borderRadius: "12px", background: "#fef2f2", color: "#b91c1c", display: "flex", gap: "12px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span>{error}</span>
          <button style={btn(false)} onClick={() => { setError(""); setLoading(true); setReload(n => n + 1); }}>Try again</button>
        </div>
      ) : loading ? (
        <p style={{ color: "#9ca3af" }}>Loading farmers...</p>
      ) : farmers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 20px", background: "#fff", borderRadius: "16px", border: "1px solid #f0f0f0", color: "#9ca3af" }}>
          <UserRound size={40} aria-hidden="true" />
          <p style={{ margin: "10px 0 0" }}>{filter === "verified" ? "No verified farmers yet." : "Every farmer is verified."}</p>
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: "12px" }}>
          {farmers.map(f => (
            <li key={f.id} style={{
              background: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "16px",
              display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap"
            }}>
              <span aria-hidden="true" style={{
                width: "52px", height: "52px", borderRadius: "50%", overflow: "hidden", flex: "none",
                display: "grid", placeItems: "center", background: "#f0fdf4", color: "#15803d", fontWeight: "800"
              }}>
                {f.avatar_url
                  ? <img src={f.avatar_url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : (f.full_name || "F").charAt(0).toUpperCase()}
              </span>
              <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                <div style={{ fontWeight: "700", color: "#111827", overflowWrap: "anywhere" }}>
                  {f.full_name || "Farmer"}{f.farm_name ? ` · ${f.farm_name}` : ""}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", marginTop: "4px", fontSize: "13px", color: "#6b7280" }}>
                  {f.county && <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}><MapPin size={13} aria-hidden="true" /> {f.county}</span>}
                  {(f.phone || f.user_email) && <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", overflowWrap: "anywhere" }}><Phone size={13} aria-hidden="true" /> {f.phone || f.user_email}</span>}
                  {f.farm_type && <span>{f.farm_type}</span>}
                </div>
              </div>
              {filter === "unverified" ? (
                <button style={btn(true)} disabled={busyId === f.id} onClick={() => setVerified(f, true)}>
                  <BadgeCheck size={16} aria-hidden="true" /> {busyId === f.id ? "Saving..." : "Verify"}
                </button>
              ) : (
                <button style={btn(false)} disabled={busyId === f.id} onClick={() => setVerified(f, false)}>
                  <RotateCcw size={16} aria-hidden="true" /> {busyId === f.id ? "Saving..." : "Remove verification"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
