import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function FinanceDashboard() {
  const [records, setRecords] =
    useState([]);

  const [form, setForm] = useState({
    batch_name: "",
    expense_type: "",
    amount: "",
    notes: ""
  });

  // ==========================
  // FETCH RECORDS
  // ==========================
  async function fetchRecords() {
    const { data: userData } =
      await supabase.auth.getUser();

    const email =
      userData.user.email;

    const { data } = await supabase
      .from("farm_finances")
      .select("*")
      .eq("user_email", email)
      .order("created_at", {
        ascending: false
      });

    setRecords(data || []);
  }

  useEffect(() => {
    fetchRecords();
  }, []);

  // ==========================
  // ADD RECORD
  // ==========================
  async function addRecord() {
    const { data: userData } =
      await supabase.auth.getUser();

    const email =
      userData.user.email;

    await supabase
      .from("farm_finances")
      .insert([
        {
          user_email: email,
          ...form,
          amount: Number(form.amount)
        }
      ]);

    setForm({
      batch_name: "",
      expense_type: "",
      amount: "",
      notes: ""
    });

    fetchRecords();
  }

  // ==========================
  // CALCULATIONS
  // ==========================
  const totalExpenses =
    records.reduce(
      (sum, r) => sum + Number(r.amount),
      0
    );

  return (
    <div style={{ padding: "20px" }}>
      <h1>Financial Dashboard 💰</h1>

      {/* SUMMARY */}
      <div
        style={{
          border: "1px solid #ccc",
          padding: "15px",
          marginBottom: "20px"
        }}
      >
        <h2>Farm Financial Summary</h2>

        <p>
          Total Expenses: KES{" "}
          {totalExpenses.toFixed(2)}
        </p>
      </div>

      {/* FORM */}
      <div
        style={{
          border: "1px solid #ddd",
          padding: "15px",
          marginBottom: "20px"
        }}
      >
        <h2>Add Expense</h2>

        <input
          placeholder="Batch Name"
          value={form.batch_name}
          onChange={(e) =>
            setForm({
              ...form,
              batch_name:
                e.target.value
            })
          }
        />

        <br />
        <br />

        <input
          placeholder="Expense Type"
          value={form.expense_type}
          onChange={(e) =>
            setForm({
              ...form,
              expense_type:
                e.target.value
            })
          }
        />

        <br />
        <br />

        <input
          type="number"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) =>
            setForm({
              ...form,
              amount:
                e.target.value
            })
          }
        />

        <br />
        <br />

        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) =>
            setForm({
              ...form,
              notes: e.target.value
            })
          }
        />

        <br />
        <br />

        <button onClick={addRecord}>
          Save Expense
        </button>
      </div>

      {/* RECORDS */}
      <div>
        <h2>Expense Records</h2>

        {records.map((r) => (
          <div
            key={r.id}
            style={{
              border: "1px solid #ccc",
              padding: "10px",
              marginBottom: "10px"
            }}
          >
            <p>
              Batch: {r.batch_name}
            </p>

            <p>
              Type: {r.expense_type}
            </p>

            <p>
              Amount: KES {r.amount}
            </p>

            <p>
              Notes: {r.notes}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}