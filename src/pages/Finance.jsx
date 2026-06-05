import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { createNotification } from "../lib/notifications";

export default function Finance() {

  const [records, setRecords] = useState([]);
  const [type, setType] = useState("expense");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  // =========================
  // FETCH RECORDS
  // =========================
  async function fetchRecords() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return;

    const email = userData.user.email;

    const { data } = await supabase
      .from("farm_finances")
      .select("*")
      .eq("user_email", email)
      .order("created_at", { ascending: false });

    setRecords(data || []);
  }

  useEffect(() => {
    fetchRecords();
  }, []);

  // =========================
  // ADD RECORD
  // =========================
  async function addRecord() {
    if (!category || !amount) return;

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user.email;

    await supabase.from("farm_finances").insert([
      {
        user_email: email,
        type,
        category,
        amount: Number(amount),
        description
      }
    ]);

    // ✅ NOTIFICATION — income recorded
    if (type === "income") {
      await createNotification({
        userEmail: email,
        type: "general",
        title: "Income Recorded 💰",
        message: `KES ${Number(amount).toLocaleString()} income from "${category}" has been saved.`,
        link: "/finance"
      });
    }

    // ✅ NOTIFICATION — expense recorded
    if (type === "expense") {
      await createNotification({
        userEmail: email,
        type: "general",
        title: "Expense Recorded 📉",
        message: `KES ${Number(amount).toLocaleString()} expense on "${category}" has been saved.`,
        link: "/finance"
      });
    }

    setCategory("");
    setAmount("");
    setDescription("");

    fetchRecords();
  }

  // =========================
  // ANALYTICS
  // =========================
  const totalIncome = records
    .filter((r) => r.type === "income")
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const totalExpenses = records
    .filter((r) => r.type === "expense")
    .reduce((sum, r) => sum + Number(r.amount), 0);

  const profit = totalIncome - totalExpenses;

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "20px" }}>

      <h1>Farm Finance 💰</h1>

      {/* ANALYTICS */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        gap: "15px",
        marginBottom: "25px"
      }}>
        <div style={{ border: "1px solid #ddd", padding: "20px", borderRadius: "10px", background: "#f0fdf4" }}>
          <h3 style={{ margin: "0 0 8px", color: "#6b7280", fontSize: "14px" }}>Total Income</h3>
          <h1 style={{ margin: 0, color: "#16a34a" }}>KES {totalIncome.toLocaleString()}</h1>
        </div>

        <div style={{ border: "1px solid #ddd", padding: "20px", borderRadius: "10px", background: "#fef2f2" }}>
          <h3 style={{ margin: "0 0 8px", color: "#6b7280", fontSize: "14px" }}>Total Expenses</h3>
          <h1 style={{ margin: 0, color: "#dc2626" }}>KES {totalExpenses.toLocaleString()}</h1>
        </div>

        <div style={{
          border: "1px solid #ddd", padding: "20px", borderRadius: "10px",
          background: profit >= 0 ? "#f0fdf4" : "#fef2f2"
        }}>
          <h3 style={{ margin: "0 0 8px", color: "#6b7280", fontSize: "14px" }}>Net Profit</h3>
          <h1 style={{ margin: 0, color: profit >= 0 ? "#16a34a" : "#dc2626" }}>
            KES {profit.toLocaleString()}
          </h1>
        </div>
      </div>

      {/* FORM */}
      <div style={{ border: "1px solid #ddd", padding: "20px", borderRadius: "10px", marginBottom: "30px" }}>
        <h2>Add Financial Record</h2>

        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd" }}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>

        <input
          placeholder="Category e.g. Feed, Medicine, Egg Sales"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box" }}
        />

        <input
          type="number"
          placeholder="Amount in KES"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: "100%", padding: "12px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box" }}
        />

        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: "100%", padding: "12px", minHeight: "100px", marginBottom: "10px", borderRadius: "8px", border: "1px solid #ddd", boxSizing: "border-box" }}
        />

        <button
          onClick={addRecord}
          style={{
            padding: "12px 24px", background: "#16a34a", color: "white",
            border: "none", borderRadius: "10px", fontWeight: "700",
            fontSize: "14px", cursor: "pointer"
          }}
        >
          Save Record
        </button>
      </div>

      {/* RECORDS */}
      <div>
        <h2>Financial Records</h2>

        {records.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
            No financial records yet. Add your first record above.
          </div>
        )}

        {records.map((r) => (
          <div
            key={r.id}
            style={{
              border: "1px solid #ddd", padding: "15px", borderRadius: "10px",
              marginBottom: "10px", display: "flex", justifyContent: "space-between",
              alignItems: "flex-start", background: r.type === "income" ? "#f0fdf4" : "#fef2f2"
            }}
          >
            <div>
              <h3 style={{ margin: "0 0 4px" }}>{r.category}</h3>
              <p style={{ margin: "0 0 4px", fontSize: "13px", color: "#6b7280" }}>{r.description}</p>
              <small style={{ color: "#9ca3af" }}>{new Date(r.created_at).toLocaleString()}</small>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{
                fontWeight: "700", fontSize: "16px", margin: "0 0 4px",
                color: r.type === "income" ? "#16a34a" : "#dc2626"
              }}>
                {r.type === "income" ? "+" : "-"} KES {Number(r.amount).toLocaleString()}
              </p>
              <span style={{
                fontSize: "11px", fontWeight: "600", padding: "2px 8px",
                borderRadius: "20px", background: r.type === "income" ? "#dcfce7" : "#fee2e2",
                color: r.type === "income" ? "#16a34a" : "#dc2626"
              }}>
                {r.type.toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}