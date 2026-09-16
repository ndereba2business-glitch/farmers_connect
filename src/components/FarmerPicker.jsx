import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Search, X } from "lucide-react";

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "#fff", color: "#111827"
};

// Extracted from the debounced farmer search originally built inline for
// VetDashboard.jsx's "Schedule Visit" modal — reused wherever a vet needs
// to pick any farmer (not just ones they already have an appointment
// with; see the "verified vets can view farmer profiles" RLS policy).
// Controlled component: `value` is the selected farmer object (or null),
// `onChange` receives the new selection.
export default function FarmerPicker({ value, onChange }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query.trim() || value) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      const { data, error } = await supabase
        .from("farmer_profiles")
        .select("user_email, full_name, county, phone")
        .or(`full_name.ilike.%${query}%,user_email.ilike.%${query}%`)
        .limit(6);

      if (error) {
        console.error("FarmerPicker: search failed —", error.message);
        setResults([]);
      } else {
        setResults(data || []);
      }
      setSearching(false);
    }, 300);

    return () => clearTimeout(timeout);
  }, [query, value]);

  if (value) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px", borderRadius: "10px",
        border: "1.5px solid #22c55e", background: "#f0fdf4"
      }}>
        <div>
          <p style={{ margin: 0, fontWeight: "700", fontSize: "13px", color: "#111827" }}>
            {value.full_name || "Farmer"}
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
            {value.user_email}{value.county ? ` · ${value.county}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { onChange(null); setQuery(""); }}
          aria-label="Clear selected farmer"
          style={{ background: "none", border: "none", cursor: "pointer" }}
        >
          <X size={16} color="#6b7280" />
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <Search size={15} style={{
        position: "absolute", left: "13px", top: "50%",
        transform: "translateY(-50%)", color: "#9ca3af"
      }} />
      <input
        placeholder="Search farmer by name or email..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{ ...inputStyle, paddingLeft: "36px" }}
      />
      {query.trim() && (
        <div style={{
          marginTop: "6px", border: "1px solid #e5e7eb", borderRadius: "10px",
          maxHeight: "180px", overflowY: "auto", background: "#fff"
        }}>
          {searching ? (
            <p style={{ margin: 0, padding: "10px 14px", fontSize: "13px", color: "#9ca3af" }}>
              Searching...
            </p>
          ) : results.length === 0 ? (
            <p style={{ margin: 0, padding: "10px 14px", fontSize: "13px", color: "#9ca3af" }}>
              No farmers found.
            </p>
          ) : (
            results.map(f => (
              <div
                key={f.user_email}
                onClick={() => { onChange(f); setResults([]); }}
                style={{
                  padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f3f4f6"
                }}
                onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                onMouseLeave={e => e.currentTarget.style.background = "#fff"}
              >
                <p style={{ margin: 0, fontWeight: "600", fontSize: "13px", color: "#111827" }}>
                  {f.full_name || "Farmer"}
                </p>
                <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
                  {f.user_email}{f.county ? ` · ${f.county}` : ""}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
