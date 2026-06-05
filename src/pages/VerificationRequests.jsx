import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function VerificationRequests() {
  const [farmers, setFarmers] =
    useState([]);

  // ==========================
  // FETCH FARMERS
  // ==========================
  async function fetchFarmers() {
    const { data } = await supabase
      .from("farmer_profiles")
      .select("*")
      .eq("verified", false);

    setFarmers(data || []);
  }

  useEffect(() => {
    fetchFarmers();
  }, []);

  // ==========================
  // VERIFY FARMER
  // ==========================
  async function verifyFarmer(id) {
    await supabase
      .from("farmer_profiles")
      .update({
        verified: true
      })
      .eq("id", id);

    fetchFarmers();
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>
        Verification Requests ✅
      </h1>

      {farmers.map((f) => (
        <div
          key={f.id}
          style={{
            border: "1px solid #ccc",
            padding: "15px",
            marginBottom: "15px"
          }}
        >
          {f.avatar_url && (
            <img
              src={f.avatar_url}
              alt="Farmer"
              style={{
                width: "100px",
                height: "100px",
                borderRadius: "50%",
                objectFit: "cover"
              }}
            />
          )}

          <h3>{f.full_name}</h3>

          <p>County: {f.county}</p>

          <p>
            Farm Type: {f.farm_type}
          </p>

          <p>
            Phone: {f.phone}
          </p>

          <button
            onClick={() =>
              verifyFarmer(f.id)
            }
          >
            Verify Farmer
          </button>
        </div>
      ))}
    </div>
  );
}