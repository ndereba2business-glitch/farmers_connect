import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function VetVerification() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    license_number: "",
    county: ""
  });

  async function submitRequest() {
    if (
      !form.name ||
      !form.email ||
      !form.license_number ||
      !form.county
    ) {
      alert("Fill all fields");
      return;
    }

    const { error } = await supabase
      .from("vet_requests")
      .insert([
        {
          name: form.name,
          email: form.email,
          license_number:
            form.license_number,
          county: form.county,
          status: "pending"
        }
      ]);

    if (error) {
      console.error(error.message);
      return;
    }

    alert("Request submitted");

    setForm({
      name: "",
      email: "",
      license_number: "",
      county: ""
    });
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Vet Verification</h1>

      <input
        placeholder="Full Name"
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
        placeholder="Email"
        value={form.email}
        onChange={(e) =>
          setForm({
            ...form,
            email: e.target.value
          })
        }
      />

      <br /><br />

      <input
        placeholder="License Number"
        value={form.license_number}
        onChange={(e) =>
          setForm({
            ...form,
            license_number:
              e.target.value
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

      <button onClick={submitRequest}>
        Submit for Verification
      </button>
    </div>
  );
}