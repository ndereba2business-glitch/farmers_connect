import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Egg, Plus, Syringe, Calendar, CheckCircle2,
  Clock, AlertTriangle, ChevronDown, ChevronUp,
  WifiOff, X, Trash2, DollarSign, Skull, ShoppingCart
} from "lucide-react";

const BATCH_TYPES = [
  { value: "broiler", label: "Broiler" },
  { value: "layer", label: "Layer" },
  { value: "dual_purpose", label: "Dual Purpose" },
  { value: "indigenous", label: "Indigenous" },
];

const EXPENSE_CATEGORIES = [
  "Feed", "Medicine", "Vaccination", "Equipment",
  "Labour", "Transport", "Utilities", "Other"
];

const SALE_ITEMS = [
  "Live Birds", "Eggs", "Manure", "Feathers", "Other"
];

const SALE_UNITS = {
  "Live Birds": ["Birds", "Kg"],
  "Eggs": ["Trays", "Pieces", "Crates"],
  "Manure": ["Bags", "Kg", "Tonnes"],
  "Feathers": ["Kg", "Bags"],
  "Other": ["Units", "Kg", "Pieces"]
};

const ACTIVITY_TYPES = [
  "Egg Collection", "Weight Check", "Cleaning", "Other"
];

const TYPE_COLORS = {
  broiler: { bg: "#fff7e6", color: "#d97706" },
  layer: { bg: "#edf9f1", color: "#16a34a" },
  dual_purpose: { bg: "#f3f0ff", color: "#7c3aed" },
  indigenous: { bg: "#fff0eb", color: "#ea580c" },
};

function generateVaccinationSchedule(hatchDate, batchType) {
  const base = new Date(hatchDate);
  const addDays = (days) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };
  const broilerSchedule = [
    { day_number: 1, vaccine_name: "Marek's Disease", method: "injection" },
    { day_number: 7, vaccine_name: "Newcastle Disease (ND)", method: "eye_drop" },
    { day_number: 14, vaccine_name: "Gumboro (IBD)", method: "drinking_water" },
    { day_number: 21, vaccine_name: "Newcastle Booster", method: "drinking_water" },
    { day_number: 28, vaccine_name: "Fowl Pox", method: "wing_stab" },
  ];
  const layerSchedule = [
    { day_number: 1, vaccine_name: "Marek's Disease", method: "injection" },
    { day_number: 7, vaccine_name: "Newcastle Disease (ND)", method: "eye_drop" },
    { day_number: 14, vaccine_name: "Gumboro (IBD)", method: "drinking_water" },
    { day_number: 21, vaccine_name: "Newcastle Booster", method: "drinking_water" },
    { day_number: 35, vaccine_name: "Fowl Pox", method: "wing_stab" },
    { day_number: 42, vaccine_name: "Infectious Bronchitis", method: "spray" },
    { day_number: 120, vaccine_name: "Newcastle + IB Booster", method: "drinking_water" },
  ];
  const schedule = batchType === "layer" ? layerSchedule : broilerSchedule;
  return schedule.map(item => ({
    ...item,
    scheduled_date: addDays(item.day_number),
    completed: false,
    completed_date: null
  }));
}

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box",
  background: "#fff", color: "#111827"
};

const labelStyle = {
  display: "block", fontSize: "13px", fontWeight: "600",
  color: "#374151", marginBottom: "6px"
};

export default function MyFarm() {
  const { userEmail } = useAuth();
  const [batches, setBatches] = useState([]);
  const [vaccinations, setVaccinations] = useState([]);
  const [activeTab, setActiveTab] = useState("active");
  const [view, setView] = useState("list");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [form, setForm] = useState({
    batch_name: "", batch_type: "", breed: "",
    hatch_date: "", quantity: "", notes: ""
  });

  useEffect(() => {
    const up = () => setIsOnline(true);
    const down = () => setIsOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  async function fetchBatches() {
    if (!userEmail) return;
    setLoading(true);
    const { data: batchData } = await supabase
      .from("farm_batches").select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false });
    const { data: vaccData } = await supabase
      .from("vaccination_tasks").select("*")
      .order("day_number", { ascending: true });
    setBatches(batchData || []);
    setVaccinations(vaccData || []);
    setLoading(false);
  }

  useEffect(() => { fetchBatches(); }, [userEmail]);

  async function handleAddBatch(e) {
    e.preventDefault();
    if (!form.batch_name || !form.batch_type || !form.hatch_date || !form.quantity) return;
    setSaving(true);
    const { data: newBatch, error } = await supabase
      .from("farm_batches")
      .insert([{
        user_email: userEmail,
        batch_name: form.batch_name,
        batch_type: form.batch_type,
        breed: form.breed || "",
        hatch_date: form.hatch_date,
        quantity: Number(form.quantity),
        current_count: Number(form.quantity),
        mortality: 0,
        notes: form.notes || "",
        status: "active"
      }])
      .select().single();
    if (error) { alert("Failed to add batch: " + error.message); setSaving(false); return; }
    const schedule = generateVaccinationSchedule(form.hatch_date, form.batch_type);
    await supabase.from("vaccination_tasks").insert(
      schedule.map(v => ({ ...v, batch_id: newBatch.id, user_email: userEmail }))
    );
    setForm({ batch_name: "", batch_type: "", breed: "", hatch_date: "", quantity: "", notes: "" });
    setSaving(false);
    setView("list");
    fetchBatches();
  }

  async function toggleVaccination(task) {
    const completed = !task.completed;
    await supabase.from("vaccination_tasks")
      .update({ completed, completed_date: completed ? new Date().toISOString().split("T")[0] : null })
      .eq("id", task.id);
    fetchBatches();
  }

  async function deleteBatch(batchId) {
    if (!window.confirm("Delete this batch? This cannot be undone.")) return;
    await supabase.from("vaccination_tasks").delete().eq("batch_id", batchId);
    await supabase.from("mortality_logs").delete().eq("batch_id", batchId);
    await supabase.from("batch_expenses").delete().eq("batch_id", batchId);
    await supabase.from("batch_sales").delete().eq("batch_id", batchId);
    await supabase.from("batch_activities").delete().eq("batch_id", batchId);
    await supabase.from("farm_batches").delete().eq("id", batchId);
    fetchBatches();
  }

  async function markBatchComplete(batchId) {
    await supabase.from("farm_batches").update({ status: "completed" }).eq("id", batchId);
    fetchBatches();
  }

  const activeBatches = batches.filter(b => b.status === "active");
  const completedBatches = batches.filter(b => b.status !== "active");

  return (
    <div>
      {!isOnline && (
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "12px 16px", borderRadius: "12px",
          background: "#fffbeb", border: "1px solid #fde68a",
          color: "#92400e", fontSize: "13px", marginBottom: "20px"
        }}>
          <WifiOff size={16} />
          <span><strong>You're offline.</strong> Changes will sync when you reconnect.</span>
        </div>
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", marginBottom: "24px"
          }}>
            <div>
              <h1 style={{ margin: 0, fontSize: "36px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
                My Farm
              </h1>
              <p style={{ marginTop: "6px", color: "#6b7280", fontSize: "15px" }}>
                Manage your chick batches and vaccinations
              </p>
            </div>
            <button
              onClick={() => setView("add")}
              style={{
                height: "44px", padding: "0 20px", border: "none",
                borderRadius: "12px",
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                color: "white", fontWeight: "700", cursor: "pointer",
                fontSize: "14px", display: "flex", alignItems: "center",
                gap: "8px", boxShadow: "0 6px 20px rgba(34,197,94,0.3)"
              }}
            >
              <Plus size={18} /> Add Batch
            </button>
          </div>

          <div style={{ display: "flex", gap: "4px", marginBottom: "24px" }}>
            {[
              { key: "active", label: `Active (${activeBatches.length})` },
              { key: "completed", label: `Completed (${completedBatches.length})` }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "8px 20px", borderRadius: "20px",
                  border: `1.5px solid ${activeTab === tab.key ? "#111827" : "#e5e7eb"}`,
                  background: activeTab === tab.key ? "#111827" : "#fff",
                  color: activeTab === tab.key ? "#fff" : "#6b7280",
                  fontWeight: "600", fontSize: "13px", cursor: "pointer"
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {[1, 2].map(i => (
                <div key={i} style={{ height: "200px", borderRadius: "20px", background: "#f3f4f6" }} />
              ))}
            </div>
          )}

          {!loading && activeTab === "active" && (
            activeBatches.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "80px 20px",
                background: "#fff", borderRadius: "24px", border: "1px solid #f0f0f0"
              }}>
                <Egg size={64} color="#e5e7eb" style={{ marginBottom: "16px" }} />
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#111827", margin: "0 0 8px" }}>
                  No active batches
                </h3>
                <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "20px" }}>
                  Start by adding your first chick batch
                </p>
                <button
                  onClick={() => setView("add")}
                  style={{
                    padding: "12px 24px",
                    background: "linear-gradient(135deg,#22c55e,#16a34a)",
                    color: "#fff", border: "none", borderRadius: "12px",
                    fontWeight: "700", fontSize: "14px", cursor: "pointer"
                  }}
                >
                  Add Your First Batch
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {activeBatches.map(batch => (
                  <BatchCard
                    key={batch.id}
                    batch={batch}
                    vaccinations={vaccinations.filter(v => v.batch_id === batch.id)}
                    onToggleVaccination={toggleVaccination}
                    onDelete={deleteBatch}
                    onMarkComplete={markBatchComplete}
                    userEmail={userEmail}
                    onRefresh={fetchBatches}
                  />
                ))}
              </div>
            )
          )}

          {!loading && activeTab === "completed" && (
            completedBatches.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px 20px",
                background: "#fff", borderRadius: "24px", border: "1px solid #f0f0f0"
              }}>
                <CheckCircle2 size={48} color="#e5e7eb" style={{ marginBottom: "12px" }} />
                <p style={{ color: "#9ca3af", fontSize: "15px" }}>No completed batches yet.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {completedBatches.map(batch => (
                  <BatchCard
                    key={batch.id}
                    batch={batch}
                    vaccinations={vaccinations.filter(v => v.batch_id === batch.id)}
                    onToggleVaccination={toggleVaccination}
                    onDelete={deleteBatch}
                    onMarkComplete={markBatchComplete}
                    userEmail={userEmail}
                    onRefresh={fetchBatches}
                  />
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* ADD BATCH FORM */}
      {view === "add" && (
        <div style={{ maxWidth: "680px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "28px" }}>
            <button
              onClick={() => setView("list")}
              style={{
                width: "38px", height: "38px", borderRadius: "10px",
                border: "1.5px solid #e5e7eb", background: "#fff",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
              }}
            >
              <X size={18} color="#374151" />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "800", color: "#111827" }}>
                Add Chick Batch
              </h1>
              <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
                Register a new batch and auto-generate vaccination schedule
              </p>
            </div>
          </div>

          <div style={{
            background: "#fff", borderRadius: "20px",
            border: "1px solid #e5e7eb", padding: "28px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)"
          }}>
            <form onSubmit={handleAddBatch}>
              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Batch Name</label>
                <input
                  placeholder="e.g., Batch A - January 2025"
                  value={form.batch_name}
                  onChange={e => setForm({ ...form, batch_name: e.target.value })}
                  required style={inputStyle}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div>
                  <label style={labelStyle}>Batch Type</label>
                  <select
                    value={form.batch_type}
                    onChange={e => setForm({ ...form, batch_type: e.target.value })}
                    required style={{ ...inputStyle, appearance: "none" }}
                  >
                    <option value="">Select type</option>
                    {BATCH_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Breed</label>
                  <input
                    placeholder="e.g., Cobb 500"
                    value={form.breed}
                    onChange={e => setForm({ ...form, breed: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
                <div>
                  <label style={labelStyle}>Hatch Date</label>
                  <input
                    type="date" value={form.hatch_date}
                    onChange={e => setForm({ ...form, hatch_date: e.target.value })}
                    required style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Number of Chicks</label>
                  <input
                    type="number" placeholder="e.g., 500"
                    value={form.quantity}
                    onChange={e => setForm({ ...form, quantity: e.target.value })}
                    required style={inputStyle}
                  />
                </div>
              </div>
              <div style={{ marginBottom: "24px" }}>
                <label style={labelStyle}>Notes (Optional)</label>
                <textarea
                  placeholder="Any additional notes..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
                />
              </div>
              <div style={{
                background: "#f0fdf4", border: "1px solid #dcfce7",
                borderRadius: "12px", padding: "14px 16px",
                marginBottom: "24px", display: "flex", alignItems: "flex-start", gap: "10px"
              }}>
                <Syringe size={16} color="#16a34a" style={{ marginTop: "2px", flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: "13px", color: "#16a34a", fontWeight: "500" }}>
                  A vaccination schedule will be auto-generated based on the hatch date and batch type.
                </p>
              </div>
              <button
                type="submit" disabled={saving}
                style={{
                  width: "100%", padding: "14px",
                  background: saving ? "#86efac" : "linear-gradient(135deg,#22c55e,#16a34a)",
                  color: "#fff", border: "none", borderRadius: "12px",
                  fontWeight: "700", fontSize: "15px",
                  cursor: saving ? "not-allowed" : "pointer"
                }}
              >
                {saving ? "Creating batch..." : "Create Batch"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════
// BATCH CARD
// ══════════════════════════════════════════════════
function BatchCard({ batch, vaccinations, onToggleVaccination, onDelete, onMarkComplete, userEmail, onRefresh }) {
  const [expandedVacc, setExpandedVacc] = useState(false);
  const [expandedSales, setExpandedSales] = useState(false);
  const [showMortality, setShowMortality] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [showSale, setShowSale] = useState(false);
  const [salesList, setSalesList] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [activityType, setActivityType] = useState("Egg Collection");

  const today = new Date().toISOString().split("T")[0];

  const [mortalityForm, setMortalityForm] = useState({ count: "", date: today, notes: "" });
  const [expenseForm, setExpenseForm] = useState({ category: "Feed", amount: "", date: today, notes: "" });
  const [saleForm, setSaleForm] = useState({
    what_sold: "Live Birds", unit: "Birds",
    quantity: "", price_per_unit: "",
    date: today, buyer: "", notes: ""
  });
  const [activityForm, setActivityForm] = useState({ quantity: "", unit: "", notes: "" });

  const [savingMortality, setSavingMortality] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [savingSale, setSavingSale] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);

  const ageInDays = Math.floor((new Date() - new Date(batch.hatch_date)) / (1000 * 60 * 60 * 24));
  const completed = vaccinations.filter(v => v.completed).length;
  const total = vaccinations.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;
  const nextVaccine = vaccinations.filter(v => !v.completed).sort((a, b) => a.day_number - b.day_number)[0];
  const overdueCount = vaccinations.filter(v => !v.completed && v.scheduled_date < today).length;
  const typeColor = TYPE_COLORS[batch.batch_type] || { bg: "#f3f4f6", color: "#6b7280" };
  const typeLabel = BATCH_TYPES.find(t => t.value === batch.batch_type)?.label || batch.batch_type;

  // Load sales and expenses for this batch
  useEffect(() => {
    loadSalesAndExpenses();
  }, [batch.id]);

  async function loadSalesAndExpenses() {
    const [{ data: salesData, error: salesError }, { data: expData, error: expError }] = await Promise.all([
      supabase.from("batch_sales").select("*").eq("batch_id", batch.id).order("sale_date", { ascending: false }),
      supabase.from("batch_expenses").select("*").eq("batch_id", batch.id).order("expense_date", { ascending: false })
    ]);
    if (salesError) console.error("Error loading sales:", salesError.message);
    if (expError) console.error("Error loading expenses:", expError.message);
    setSalesList(salesData || []);
    setExpenses(expData || []);
  }

  const totalRevenue = salesList.reduce((s, sale) => s + Number(sale.total_amount || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netPL = totalRevenue - totalExpenses;

  async function getCurrentUserId() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      alert("You must be logged in to do this. Please log in again.");
      return null;
    }
    return data.user.id;
  }

  async function handleLogMortality(e) {
    e.preventDefault();
    if (!mortalityForm.count) return;
    setSavingMortality(true);
    const { error } = await supabase.from("mortality_logs").insert([{
      batch_id: batch.id, user_email: userEmail,
      date: mortalityForm.date,
      count: Number(mortalityForm.count),
      notes: mortalityForm.notes
    }]);
    if (error) {
      alert("Failed to log mortality: " + error.message);
      setSavingMortality(false);
      return;
    }
    const newCount = Math.max(0, (batch.current_count || batch.quantity) - Number(mortalityForm.count));
    const newMortality = (batch.mortality || 0) + Number(mortalityForm.count);
    await supabase.from("farm_batches")
      .update({ current_count: newCount, mortality: newMortality })
      .eq("id", batch.id);
    setMortalityForm({ count: "", date: today, notes: "" });
    setSavingMortality(false);
    setShowMortality(false);
    onRefresh();
  }

  async function handleLogExpense(e) {
    e.preventDefault();
    if (!expenseForm.amount) return;
    setSavingExpense(true);
    const userId = await getCurrentUserId();
    if (!userId) { setSavingExpense(false); return; }

    const { error } = await supabase.from("batch_expenses").insert([{
      batch_id: batch.id,
      user_id: userId,
      category: expenseForm.category,
      amount: Number(expenseForm.amount),
      expense_date: expenseForm.date,
      notes: expenseForm.notes
    }]);

    if (error) {
      alert("Failed to save expense: " + error.message);
      setSavingExpense(false);
      return;
    }

    setExpenseForm({ category: "Feed", amount: "", date: today, notes: "" });
    setSavingExpense(false);
    setShowExpense(false);
    loadSalesAndExpenses();
    onRefresh();
  }

  async function handleLogActivity(e) {
    e.preventDefault();
    setSavingActivity(true);
    await supabase.from("batch_activities").insert([{
      batch_id: batch.id, user_email: userEmail,
      activity_type: activityType,
      quantity: activityForm.quantity ? Number(activityForm.quantity) : null,
      unit: activityForm.unit,
      notes: activityForm.notes,
      date: today
    }]);
    setActivityForm({ quantity: "", unit: "", notes: "" });
    setSavingActivity(false);
  }

  async function handleRecordSale(e) {
    e.preventDefault();
    if (!saleForm.quantity || !saleForm.price_per_unit) return;
    setSavingSale(true);
    const userId = await getCurrentUserId();
    if (!userId) { setSavingSale(false); return; }

    const total_amount = Number(saleForm.quantity) * Number(saleForm.price_per_unit);

    const { error } = await supabase.from("batch_sales").insert([{
      batch_id: batch.id,
      user_id: userId,
      what_sold: saleForm.what_sold,
      unit: saleForm.unit,
      quantity: Number(saleForm.quantity),
      price_per_unit: Number(saleForm.price_per_unit),
      total_amount,
      sale_date: saleForm.date,
      buyer_name: saleForm.buyer,
      notes: saleForm.notes
    }]);

    if (error) {
      alert("Failed to save sale: " + error.message);
      setSavingSale(false);
      return;
    }

    setSaleForm({
      what_sold: "Live Birds", unit: "Birds",
      quantity: "", price_per_unit: "",
      date: today, buyer: "", notes: ""
    });
    setSavingSale(false);
    setShowSale(false);
    loadSalesAndExpenses();
    onRefresh();
  }

  const currentUnits = SALE_UNITS[saleForm.what_sold] || ["Units"];

  return (
    <div style={{
      background: "#fff", borderRadius: "20px",
      border: "1px solid #e5e7eb",
      boxShadow: "0 4px 16px rgba(0,0,0,0.04)", overflow: "hidden"
    }}>
      <div style={{ padding: "20px 24px" }}>

        {/* TOP ROW */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", marginBottom: "16px"
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "14px",
              background: "#edf9f1", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
              <Egg size={22} color="#22c55e" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "#111827" }}>
                {batch.batch_name}
              </h3>
              <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{
                  background: typeColor.bg, color: typeColor.color,
                  fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "20px"
                }}>
                  {typeLabel}
                </span>
                {batch.breed && <span style={{ fontSize: "12px", color: "#9ca3af" }}>{batch.breed}</span>}
                <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                  · {batch.current_count || batch.quantity} birds alive
                </span>
                {batch.mortality > 0 && (
                  <span style={{ fontSize: "12px", color: "#ef4444", fontWeight: "600" }}>
                    · {batch.mortality} deaths
                  </span>
                )}
                <span style={{ fontSize: "12px", color: "#9ca3af" }}>· Day {ageInDays}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {overdueCount > 0 && (
              <span style={{
                display: "flex", alignItems: "center", gap: "4px",
                background: "#fef2f2", color: "#ef4444",
                fontSize: "12px", fontWeight: "600", padding: "4px 10px", borderRadius: "20px"
              }}>
                <AlertTriangle size={12} /> {overdueCount} overdue
              </span>
            )}
            <button
              onClick={() => onDelete(batch.id)}
              style={{
                width: "32px", height: "32px", borderRadius: "8px",
                border: "1px solid #fee2e2", background: "#fff",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
              }}
            >
              <Trash2 size={14} color="#ef4444" />
            </button>
          </div>
        </div>

        {/* VACCINATION PROGRESS */}
        <div style={{ marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#9ca3af", marginBottom: "6px" }}>
            <span>Vaccination Progress</span>
            <span>{completed}/{total} completed</span>
          </div>
          <div style={{ height: "8px", background: "#f3f4f6", borderRadius: "20px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progress}%`,
              background: "linear-gradient(135deg,#22c55e,#16a34a)",
              borderRadius: "20px", transition: "width 0.5s ease"
            }} />
          </div>
        </div>

        {/* NEXT VACCINE */}
        {nextVaccine && (
          <div style={{
            padding: "12px 14px", borderRadius: "12px",
            background: "#f0fdf4", border: "1px solid #dcfce7", marginBottom: "14px"
          }}>
            <p style={{ margin: "0 0 2px", fontSize: "11px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase" }}>
              Next vaccination
            </p>
            <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "700", color: "#111827" }}>
              {nextVaccine.vaccine_name}
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
              Day {nextVaccine.day_number} · {nextVaccine.scheduled_date}
              {nextVaccine.scheduled_date === today && <span style={{ color: "#f59e0b", fontWeight: "700" }}> · TODAY</span>}
              {nextVaccine.scheduled_date < today && <span style={{ color: "#ef4444", fontWeight: "700" }}> · OVERDUE</span>}
            </p>
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
          <button
            onClick={() => { setShowMortality(!showMortality); setShowExpense(false); setShowSale(false); }}
            style={{
              flex: 1, padding: "9px 14px",
              background: showMortality ? "#fef2f2" : "#f9fafb",
              border: `1px solid ${showMortality ? "#fecaca" : "#e5e7eb"}`,
              borderRadius: "10px", cursor: "pointer", fontWeight: "600", fontSize: "13px",
              color: showMortality ? "#ef4444" : "#374151",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
            }}
          >
            <Skull size={14} /> Log Mortality
          </button>
          <button
            onClick={() => { setShowExpense(!showExpense); setShowMortality(false); setShowSale(false); }}
            style={{
              flex: 1, padding: "9px 14px",
              background: showExpense ? "#fffbeb" : "#f9fafb",
              border: `1px solid ${showExpense ? "#fde68a" : "#e5e7eb"}`,
              borderRadius: "10px", cursor: "pointer", fontWeight: "600", fontSize: "13px",
              color: showExpense ? "#d97706" : "#374151",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
            }}
          >
            <DollarSign size={14} /> Log Expense
          </button>
          {batch.status === "active" && (
            <button
              onClick={() => onMarkComplete(batch.id)}
              style={{
                flex: 1, padding: "9px 14px",
                background: "#f9fafb", border: "1px solid #e5e7eb",
                borderRadius: "10px", cursor: "pointer",
                fontWeight: "600", fontSize: "13px", color: "#374151",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
              }}
            >
              ✅ Mark Complete
            </button>
          )}
        </div>

        {/* MORTALITY FORM */}
        {showMortality && (
          <form onSubmit={handleLogMortality} style={{
            marginTop: "14px", padding: "16px",
            background: "#fef2f2", borderRadius: "12px", border: "1px solid #fecaca"
          }}>
            <p style={{ margin: "0 0 12px", fontWeight: "700", fontSize: "14px", color: "#ef4444" }}>
              🪦 Log Mortality
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={{ ...labelStyle, color: "#7f1d1d" }}>Number of Deaths</label>
                <input type="number" min="1" placeholder="e.g. 3"
                  value={mortalityForm.count}
                  onChange={e => setMortalityForm({ ...mortalityForm, count: e.target.value })}
                  required style={inputStyle} />
              </div>
              <div>
                <label style={{ ...labelStyle, color: "#7f1d1d" }}>Date</label>
                <input type="date" value={mortalityForm.date}
                  onChange={e => setMortalityForm({ ...mortalityForm, date: e.target.value })}
                  style={inputStyle} />
              </div>
            </div>
            <input placeholder="Notes e.g. suspected disease"
              value={mortalityForm.notes}
              onChange={e => setMortalityForm({ ...mortalityForm, notes: e.target.value })}
              style={{ ...inputStyle, marginBottom: "10px" }} />
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" disabled={savingMortality} style={{
                padding: "9px 20px", background: "#ef4444",
                color: "#fff", border: "none", borderRadius: "8px",
                fontWeight: "700", fontSize: "13px", cursor: "pointer"
              }}>
                {savingMortality ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => setShowMortality(false)} style={{
                padding: "9px 16px", background: "#fff",
                border: "1px solid #e5e7eb", borderRadius: "8px",
                cursor: "pointer", fontSize: "13px", color: "#374151"
              }}>Cancel</button>
            </div>
          </form>
        )}

        {/* EXPENSE FORM */}
        {showExpense && (
          <form onSubmit={handleLogExpense} style={{
            marginTop: "14px", padding: "16px",
            background: "#fffbeb", borderRadius: "12px", border: "1px solid #fde68a"
          }}>
            <p style={{ margin: "0 0 12px", fontWeight: "700", fontSize: "14px", color: "#d97706" }}>
              💰 Log Expense
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={{ ...labelStyle, color: "#78350f" }}>Category</label>
                <select value={expenseForm.category}
                  onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  style={{ ...inputStyle, appearance: "none" }}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, color: "#78350f" }}>Amount (KES)</label>
                <input type="number" placeholder="e.g. 5000"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  required style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={{ ...labelStyle, color: "#78350f" }}>Date</label>
                <input type="date" value={expenseForm.date}
                  onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ ...labelStyle, color: "#78350f" }}>Notes (Optional)</label>
                <input placeholder="e.g. Unga feeds 50kg"
                  value={expenseForm.notes}
                  onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" disabled={savingExpense} style={{
                padding: "9px 20px", background: "#d97706",
                color: "#fff", border: "none", borderRadius: "8px",
                fontWeight: "700", fontSize: "13px", cursor: "pointer"
              }}>
                {savingExpense ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => setShowExpense(false)} style={{
                padding: "9px 16px", background: "#fff",
                border: "1px solid #e5e7eb", borderRadius: "8px",
                cursor: "pointer", fontSize: "13px", color: "#374151"
              }}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* ── LOG DAILY ACTIVITY ── */}
      <div style={{ borderTop: "1px solid #f3f4f6", padding: "16px 24px" }}>
        <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: "700", color: "#6b7280" }}>
          Log Daily Activity
        </h4>
        {/* ACTIVITY TYPE TABS */}
        <div style={{
          display: "flex", background: "#f3f4f6",
          borderRadius: "10px", padding: "3px",
          marginBottom: "12px", gap: "2px"
        }}>
          {ACTIVITY_TYPES.map(type => (
            <button
              key={type}
              onClick={() => setActivityType(type)}
              style={{
                flex: 1, padding: "7px 8px",
                borderRadius: "8px", border: "none", cursor: "pointer",
                fontWeight: "600", fontSize: "12px",
                background: activityType === type ? "#fff" : "transparent",
                color: activityType === type ? "#111827" : "#9ca3af",
                boxShadow: activityType === type ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s"
              }}
            >
              {type}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
          <input
            placeholder="Quantity (e.g. 5)"
            type="number"
            value={activityForm.quantity}
            onChange={e => setActivityForm({ ...activityForm, quantity: e.target.value })}
            style={inputStyle}
          />
          <input
            placeholder="Unit (kg, trays...)"
            value={activityForm.unit}
            onChange={e => setActivityForm({ ...activityForm, unit: e.target.value })}
            style={inputStyle}
          />
        </div>
        <textarea
          placeholder="Notes (optional)"
          value={activityForm.notes}
          onChange={e => setActivityForm({ ...activityForm, notes: e.target.value })}
          style={{ ...inputStyle, minHeight: "70px", resize: "vertical", marginBottom: "10px" }}
        />
        <button
          onClick={handleLogActivity}
          disabled={savingActivity}
          style={{
            width: "100%", padding: "12px",
            background: "linear-gradient(135deg,#22c55e,#16a34a)",
            color: "#fff", border: "none", borderRadius: "10px",
            fontWeight: "700", fontSize: "14px", cursor: "pointer"
          }}
        >
          {savingActivity ? "Logging..." : "Log Activity"}
        </button>
      </div>

      {/* ── RECORD A SALE ── */}
      <div style={{ borderTop: "1px solid #f3f4f6" }}>
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 24px", cursor: "pointer"
          }}
          onClick={() => setShowSale(!showSale)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ShoppingCart size={16} color="#374151" />
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#111827" }}>
              Record a Sale
            </span>
          </div>
          <button style={{
            width: "28px", height: "28px", borderRadius: "50%",
            border: "1px solid #e5e7eb", background: "#fff",
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: "18px", color: "#374151", fontWeight: "300"
          }}>
            {showSale ? "×" : "+"}
          </button>
        </div>

        {showSale && (
          <form onSubmit={handleRecordSale} style={{ padding: "0 24px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={labelStyle}>What was sold?</label>
                <select
                  value={saleForm.what_sold}
                  onChange={e => setSaleForm({
                    ...saleForm, what_sold: e.target.value,
                    unit: SALE_UNITS[e.target.value]?.[0] || "Units"
                  })}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  {SALE_ITEMS.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Unit</label>
                <select
                  value={saleForm.unit}
                  onChange={e => setSaleForm({ ...saleForm, unit: e.target.value })}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  {currentUnits.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={labelStyle}>Quantity</label>
                <input type="number" placeholder="e.g. 50"
                  value={saleForm.quantity}
                  onChange={e => setSaleForm({ ...saleForm, quantity: e.target.value })}
                  required style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Price per unit (KES)</label>
                <input type="number" placeholder="e.g. 500"
                  value={saleForm.price_per_unit}
                  onChange={e => setSaleForm({ ...saleForm, price_per_unit: e.target.value })}
                  required style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={saleForm.date}
                  onChange={e => setSaleForm({ ...saleForm, date: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Buyer (optional)</label>
                <input placeholder="Buyer name"
                  value={saleForm.buyer}
                  onChange={e => setSaleForm({ ...saleForm, buyer: e.target.value })}
                  style={inputStyle} />
              </div>
            </div>
            <textarea placeholder="Notes (optional)"
              value={saleForm.notes}
              onChange={e => setSaleForm({ ...saleForm, notes: e.target.value })}
              style={{ ...inputStyle, minHeight: "70px", resize: "vertical", marginBottom: "12px" }} />
            <button type="submit" disabled={savingSale} style={{
              width: "100%", padding: "13px",
              background: "linear-gradient(135deg,#22c55e,#16a34a)",
              color: "#fff", border: "none", borderRadius: "10px",
              fontWeight: "700", fontSize: "14px", cursor: "pointer"
            }}>
              {savingSale ? "Saving..." : "Save Sale"}
            </button>
          </form>
        )}
      </div>

      {/* ── BATCH P&L ── */}
      <div style={{ borderTop: "1px solid #f3f4f6" }}>
        <div
          style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", padding: "14px 24px",
            cursor: "pointer"
          }}
          onClick={() => setExpandedSales(!expandedSales)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%",
              background: netPL >= 0 ? "#f0fdf4" : "#fef2f2",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {netPL >= 0
                ? <span style={{ fontSize: "14px" }}>↗</span>
                : <span style={{ fontSize: "14px", color: "#ef4444" }}>↘</span>}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#6b7280" }}>
                Batch P&L
              </p>
              <p style={{
                margin: 0, fontSize: "18px", fontWeight: "800",
                color: netPL >= 0 ? "#16a34a" : "#ef4444"
              }}>
                {netPL >= 0 ? "+" : ""}KES {netPL.toLocaleString()}
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: "0 0 2px", fontSize: "13px", color: "#22c55e" }}>
              Revenue: KES {totalRevenue.toLocaleString()}
            </p>
            <p style={{ margin: "0 0 6px", fontSize: "13px", color: "#ef4444" }}>
              Expenses: KES {totalExpenses.toLocaleString()}
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
              {salesList.length} sale{salesList.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
          <ChevronDown size={16} color="#9ca3af"
            style={{ transform: expandedSales ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>

        {expandedSales && salesList.length > 0 && (
          <div style={{ padding: "0 24px 16px" }}>
            <p style={{
              fontSize: "11px", fontWeight: "700", color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px"
            }}>
              Sales History
            </p>
            {salesList.map(sale => (
              <div key={sale.id} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "10px 12px",
                background: "#f9fafb", borderRadius: "10px",
                marginBottom: "6px"
              }}>
                <div>
                  <p style={{ margin: 0, fontWeight: "600", fontSize: "13px", color: "#111827" }}>
                    {sale.what_sold} — {sale.quantity} {sale.unit}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9ca3af" }}>
                    {sale.sale_date}{sale.buyer_name ? ` · ${sale.buyer_name}` : ""}
                  </p>
                </div>
                <p style={{ margin: 0, fontWeight: "700", fontSize: "14px", color: "#22c55e" }}>
                  +KES {Number(sale.total_amount).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── VACCINATION SCHEDULE ── */}
      <div style={{ borderTop: "1px solid #f3f4f6" }}>
        <button
          onClick={() => setExpandedVacc(!expandedVacc)}
          style={{
            width: "100%", padding: "14px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "none", border: "none", cursor: "pointer",
            fontSize: "13px", color: "#6b7280", fontWeight: "600"
          }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Syringe size={16} /> Vaccination Schedule ({total} vaccines)
          </span>
          {expandedVacc ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {expandedVacc && (
          <div style={{ padding: "0 24px 20px" }}>
            {vaccinations.length === 0 ? (
              <p style={{ textAlign: "center", color: "#9ca3af", fontSize: "13px", padding: "16px 0" }}>
                No vaccination schedule generated.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {vaccinations.sort((a, b) => a.day_number - b.day_number).map(task => {
                  const isOverdue = !task.completed && task.scheduled_date < today;
                  const isDueToday = task.scheduled_date === today;
                  return (
                    <div key={task.id} style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "12px 14px", borderRadius: "12px",
                      background: task.completed ? "#f0fdf4" : isOverdue ? "#fef2f2" : isDueToday ? "#fffbeb" : "#f9fafb",
                      border: `1px solid ${task.completed ? "#dcfce7" : isOverdue ? "#fecaca" : isDueToday ? "#fde68a" : "#f0f0f0"}`
                    }}>
                      <input
                        type="checkbox" checked={task.completed}
                        onChange={() => onToggleVaccination(task)}
                        style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0, accentColor: "#22c55e" }}
                      />
                      <div style={{ flex: 1 }}>
                        <p style={{
                          margin: 0, fontSize: "13px", fontWeight: "600",
                          color: task.completed ? "#9ca3af" : "#111827",
                          textDecoration: task.completed ? "line-through" : "none"
                        }}>
                          {task.vaccine_name}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#9ca3af" }}>
                          Day {task.day_number} · {task.method?.replace("_", " ")} · {task.scheduled_date}
                        </p>
                      </div>
                      {task.completed ? <CheckCircle2 size={16} color="#22c55e" />
                        : isOverdue ? <AlertTriangle size={16} color="#ef4444" />
                        : isDueToday ? <Clock size={16} color="#f59e0b" />
                        : <Calendar size={16} color="#9ca3af" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}