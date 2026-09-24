import { useEffect, useState } from "react";
import { Phone, MessageCircle, MapPin, Truck, Clock } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIES, CATEGORY_LABELS, initialsOf } from "../components/supplier/supplierFormat";

const TYPES = [{ value: "all", label: "All" }, ...CATEGORIES];

const digits = (phone) => String(phone).replace(/[^\d+]/g, "");

function whatsappHref(number) {
  let n = digits(number).replace(/^\+/, "");
  if (n.startsWith("0")) n = "254" + n.slice(1);
  return `https://wa.me/${n}`;
}

const contactBtn = (whatsapp) => ({
  display: "inline-flex", alignItems: "center", gap: "8px",
  minHeight: "44px", padding: "0 16px", borderRadius: "10px",
  textDecoration: "none", fontWeight: "700", fontSize: "13px",
  border: "1.5px solid #22c55e",
  background: whatsapp ? "#22c55e" : "#f0fdf4",
  color: whatsapp ? "#fff" : "#15803d"
});

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchSuppliers() {
      const { data, error: fetchError } = await supabase
        .from("supplier_profiles")
        .select("id, business_name, product_categories, county, location_details, operating_hours, logo_url, phone, whatsapp_number, description, delivery_available")
        .eq("verification_status", "verified")
        .order("business_name", { ascending: true });

      if (cancelled) return;
      if (fetchError) {
        setError("We couldn't load suppliers. Check your connection and try again.");
        setLoading(false);
        return;
      }
      setSuppliers(data || []);
      setError("");
      setLoading(false);
    }

    fetchSuppliers();
    return () => { cancelled = true; };
  }, [reload]);

  const q = search.trim().toLowerCase();
  const shown = suppliers.filter(s =>
    (type === "all" || (s.product_categories || []).includes(type)) &&
    (!q || [s.business_name, s.county, s.location_details].some(v => v?.toLowerCase().includes(q)))
  );

  return (
    <div style={{ maxWidth: "960px" }}>
      <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
        Suppliers
      </h1>
      <p style={{ marginTop: "6px", color: "#6b7280", fontSize: "15px" }}>
        Verified suppliers of feed, chicks, medicine and equipment.
      </p>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", margin: "20px 0" }}>
        <input
          aria-label="Search suppliers"
          placeholder="Search by name or county..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: "1 1 220px", minHeight: "44px", padding: "10px 14px", borderRadius: "10px",
            border: "1.5px solid #e5e7eb", fontSize: "16px", boxSizing: "border-box"
          }}
        />
        <select
          aria-label="Filter by type"
          value={type}
          onChange={e => setType(e.target.value)}
          style={{
            minHeight: "44px", padding: "10px 14px", borderRadius: "10px",
            border: "1.5px solid #e5e7eb", fontSize: "16px", background: "#fff"
          }}
        >
          {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {error && (
        <div role="alert" style={{
          marginBottom: "16px", padding: "14px 16px", borderRadius: "12px",
          background: "#fef2f2", color: "#b91c1c", fontSize: "14px",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap"
        }}>
          <span>{error}</span>
          <button
            onClick={() => { setError(""); setLoading(true); setReload(n => n + 1); }}
            style={{ minHeight: "44px", padding: "0 18px", borderRadius: "10px", border: "1.5px solid #b91c1c", background: "#fff", color: "#b91c1c", fontWeight: "700", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      )}

      {loading && !error && <p style={{ color: "#9ca3af" }}>Loading suppliers...</p>}

      {!loading && !error && shown.length === 0 && (
        <p style={{ color: "#6b7280" }}>
          {suppliers.length === 0
            ? "No verified suppliers yet. Check back soon."
            : "No suppliers match your search."}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))", gap: "16px" }}>
        {shown.map(s => (
          <div key={s.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: "16px", padding: "18px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <span aria-hidden="true" style={{
                flex: "none", width: "48px", height: "48px", borderRadius: "12px", overflow: "hidden",
                display: "grid", placeItems: "center", fontWeight: "800", color: "#fff",
                background: "linear-gradient(155deg,#22c55e,#15803d)"
              }}>
                {s.logo_url
                  ? <img src={s.logo_url} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : initialsOf(s.business_name)}
              </span>
              <div style={{ fontWeight: "800", fontSize: "16px", color: "#111827", minWidth: 0, overflowWrap: "anywhere" }}>
                {s.business_name}{" "}
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: "20px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                  ✔ Verified
                </span>
              </div>
            </div>
            {(s.product_categories || []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "10px" }}>
                {s.product_categories.map(c => (
                  <span key={c} style={{ fontSize: "12px", fontWeight: "700", color: "#15803d", background: "#f0fdf4", padding: "3px 10px", borderRadius: "20px" }}>
                    {CATEGORY_LABELS[c] || c}
                  </span>
                ))}
              </div>
            )}
            <div style={{ marginTop: "8px", fontSize: "13px", color: "#6b7280", display: "grid", gap: "4px" }}>
              {s.county && <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><MapPin size={13} aria-hidden="true" /> {[s.location_details, s.county].filter(Boolean).join(", ")}</span>}
              {s.operating_hours && <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Clock size={13} aria-hidden="true" /> {s.operating_hours}</span>}
              {s.delivery_available && <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><Truck size={13} aria-hidden="true" /> Delivers</span>}
            </div>
            {s.description && <p style={{ margin: "10px 0 0", fontSize: "13px", color: "#6b7280", lineHeight: 1.5 }}>{s.description}</p>}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "14px" }}>
              {s.phone && (
                <a href={`tel:${digits(s.phone)}`} style={contactBtn(false)}>
                  <Phone size={16} aria-hidden="true" /> Call
                </a>
              )}
              {s.whatsapp_number && (
                <a href={whatsappHref(s.whatsapp_number)} target="_blank" rel="noopener noreferrer" style={contactBtn(true)}>
                  <MessageCircle size={16} aria-hidden="true" /> WhatsApp
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
