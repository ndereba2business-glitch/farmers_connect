import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SupplierVerification() {
  const [form, setForm] = useState({
    name: "",
    business_name: "",
    contact: "",
    county: ""
  });

  async function submitSupplier() {
    if (
      !form.name ||
      !form.business_name ||
      !form.contact ||
      !form.county
    ) {
      alert("Fill all fields");
      return;
    }

    const { error } = await supabase
      .from("supplier_requests")
      .insert([
        {
          name: form.name,
          business_name:
            form.business_name,
          contact: form.contact,
          county: form.county,
          status: "pending"
        }
      ]);

    if (error) {
      console.error(error.message);
      return;
    }

    alert("Supplier request sent");

    setForm({
      name: "",
      business_name: "",
      contact: "",
      county: ""
    });
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Supplier Verification</h1>

      <input
        placeholder="Your Name"
        value={form.name}
        onChange={(e) =>
          setForm({
            ...form,
            name: e.target.value
          })
        }
      />

      <br /><br />

      <input
        placeholder="Business Name"
        value={form.business_name}
        onChange={(e) =>
          setForm({
            ...form,
            business_name:
              e.target.value
          })
        }
      />

      <br /><br />

      <input
        placeholder="Contact"
        value={form.contact}
        onChange={(e) =>
          setForm({
            ...form,
            contact: e.target.value
          })
        }
      />

      <br /><br />

      <input
        placeholder="County"
        value={form.county}
        onChange={(e) =>
          setForm({
            ...form,
            county: e.target.value
          })
        }
      />

      <br /><br />

      <button onClick={submitSupplier}>
        Submit Supplier Request
      </button>
    </div>
  );
}