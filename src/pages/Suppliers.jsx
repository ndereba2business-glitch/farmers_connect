import { useEffect, useState } from "react";
import { Phone, MessageCircle, MapPin, Truck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

const TYPES = [
  { value: "all", label: "All" },
  { value: "feeds", label: "Feeds" },
  { value: "hatchery", label: "Chicks / hatchery" },
  { value: "medicine", label: "Medicine" },
  { value: "equipment", label: "Equipment" },
  { value: "other", label: "Other" }
];

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
        .select("id, business_name, supplier_type, county, phone, whatsapp_number, description, delivery_available")
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
    (type === "all" || s.supplier_type === type) &&
    (!q || s.business_name?.toLowerCase().includes(q) || s.county?.toLowerCase().includes(q))
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
            <div style={{ fontWeight: "800", fontSize: "16px", color: "#111827" }}>
              {s.business_name}{" "}
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: "20px", verticalAlign: "middle" }}>
                ✔ Verified
              </span>
            </div>
            <div style={{ marginTop: "8px", fontSize: "13px", color: "#6b7280", display: "grid", gap: "4px" }}>
              {s.supplier_type && <span style={{ textTransform: "capitalize" }}>{s.supplier_type}</span>}
              {s.county && <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><MapPin size={13} aria-hidden="true" /> {s.county}</span>}
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
