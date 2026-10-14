import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import {
  Egg, Plus, Syringe, Calendar, CheckCircle2,
  Clock, AlertTriangle, ChevronDown, ChevronUp,
  WifiOff, X, Trash2, DollarSign, Skull, ShoppingCart, TrendingDown, Banknote, TrendingUp
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
  broiler: { bg: "var(--fc-bg-amber52)", color: "var(--fc-fg-amber600)" },
  layer: { bg: "var(--fc-bg-green51)", color: "var(--fc-fg-green700)" },
  dual_purpose: { bg: "var(--fc-bg-violet51)", color: "var(--fc-fg-violet600)" },
  indigenous: { bg: "var(--fc-bg-red52)", color: "var(--fc-fg-amber601)" },
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
  width: "100%", padding: "11px 14px", borderRadius: "12px",
  border: "1.5px solid var(--fc-line-gray200)", fontSize: "14px",
  outline: "none", boxSizing: "border-box",
  background: "var(--fc-bg-gray0)", color: "var(--fc-fg-gray900)"
};

const labelStyle = {
  display: "block", fontSize: "13px", fontWeight: "600",
  color: "var(--fc-fg-gray700)", marginBottom: "6px"
};

export default function MyFarm() {
  const { userEmail } = useAuth();
  const toast = useToast();
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
    const { error: scheduleError } = await supabase.from("vaccination_tasks").insert(
      schedule.map(v => ({ ...v, batch_id: newBatch.id, user_email: userEmail }))
    );
    // The batch itself is saved; say so, rather than leave it without reminders unnoticed.
    if (scheduleError) toast.error("The batch was saved, but its vaccination schedule was not. Check your connection, then delete and add the batch again.");
    setForm({ batch_name: "", batch_type: "", breed: "", hatch_date: "", quantity: "", notes: "" });
    setSaving(false);
    setView("list");
    fetchBatches();
  }

  async function toggleVaccination(task) {
    const completed = !task.completed;
    const { error } = await supabase.from("vaccination_tasks")
      .update({ completed, completed_date: completed ? new Date().toISOString().split("T")[0] : null })
      .eq("id", task.id);
    if (error) toast.error("That vaccination was not updated. Check your connection and try again.");
    fetchBatches();
  }

  async function deleteBatch(batchId) {
    if (!window.confirm("Delete this batch? This cannot be undone.")) return;
    // Records first, the batch last; stop at the first failure so a batch is
    // never removed while its records are left behind.
    for (const table of ["vaccination_tasks", "mortality_logs", "batch_expenses", "batch_sales", "batch_activities"]) {
      const { error } = await supabase.from(table).delete().eq("batch_id", batchId);
      if (error) { toast.error("The batch was not deleted. Check your connection and try again."); fetchBatches(); return; }
    }
    const { error } = await supabase.from("farm_batches").delete().eq("id", batchId);
    if (error) toast.error("The batch was not deleted. Check your connection and try again.");
    fetchBatches();
  }

  async function markBatchComplete(batchId) {
    const { error } = await supabase.from("farm_batches").update({ status: "completed" }).eq("id", batchId);
    if (error) toast.error("The batch was not marked complete. Check your connection and try again.");
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
          background: "var(--fc-bg-amber50)", border: "1px solid var(--fc-line-amber200)",
          color: "var(--fc-fg-amber800)", fontSize: "13px", marginBottom: "20px"
        }}>
          <WifiOff size={16} />
          <span><strong>You're offline.</strong> Changes will sync when you reconnect.</span>
        </div>
      )}

      {/* LIST VIEW */}
      {view === "list" && (
        <div>
          <div className="fc-page-header" style={{
            alignItems: "flex-start", marginBottom: "24px"
          }}>
            <div>
              <h1 className="fc-page-title" style={{ margin: 0, fontWeight: "700", color: "var(--fc-fg-gray900)", letterSpacing: "-1px" }}>
                My Farm
              </h1>
              <p style={{ marginTop: "6px", color: "var(--fc-fg-gray500)", fontSize: "15px" }}>
                Manage your chick batches and vaccinations
              </p>
            </div>
            <button
              onClick={() => setView("add")}
              style={{
                height: "44px", padding: "0 20px", border: "none",
                borderRadius: "12px",
                background: "#15803d",
                color: "white", fontWeight: "700", cursor: "pointer",
                fontSize: "14px", display: "flex", alignItems: "center",
                gap: "8px", boxShadow: "none"
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
                className="fc-tap"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "8px 20px", borderRadius: "16px",
                  border: `1.5px solid ${activeTab === tab.key ? "var(--fc-line-gray900)" : "var(--fc-line-gray200)"}`,
                  background: activeTab === tab.key ? "var(--fc-bg-gray900)" : "var(--fc-bg-gray0)",
                  color: activeTab === tab.key ? "var(--fc-fg-gray0)" : "var(--fc-fg-gray500)",
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
                <div key={i} style={{ height: "200px", borderRadius: "16px", background: "var(--fc-bg-gray100)" }} />
              ))}
            </div>
          )}

          {!loading && activeTab === "active" && (
            activeBatches.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "80px 20px",
                background: "var(--fc-bg-gray0)", borderRadius: "16px", border: "1px solid var(--fc-line-gray101)"
              }}>
                <Egg size={64} color="var(--fc-fg-gray200)" style={{ marginBottom: "16px" }} />
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--fc-fg-gray900)", margin: "0 0 8px" }}>
                  No active batches
                </h3>
                <p style={{ color: "var(--fc-fg-gray400)", fontSize: "14px", marginBottom: "20px" }}>
                  Start by adding your first chick batch
                </p>
                <button
                  onClick={() => setView("add")}
                  style={{
                    padding: "12px 24px",
                    background: "#15803d",
                    color: "var(--fc-fg-gray0)", border: "none", borderRadius: "12px",
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
                background: "var(--fc-bg-gray0)", borderRadius: "16px", border: "1px solid var(--fc-line-gray101)"
              }}>
                <CheckCircle2 size={48} color="var(--fc-fg-gray200)" style={{ marginBottom: "12px" }} />
                <p style={{ color: "var(--fc-fg-gray400)", fontSize: "15px" }}>No completed batches yet.</p>
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
                width: "38px", height: "38px", borderRadius: "12px",
                border: "1.5px solid var(--fc-line-gray200)", background: "var(--fc-bg-gray0)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
              }}
            >
              <X size={18} color="var(--fc-fg-gray700)" />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: "28px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
                Add Chick Batch
              </h1>
              <p style={{ margin: "4px 0 0", color: "var(--fc-fg-gray500)", fontSize: "14px" }}>
                Register a new batch and auto-generate vaccination schedule
              </p>
            </div>
          </div>

          <div style={{
            background: "var(--fc-bg-gray0)", borderRadius: "16px",
            border: "1px solid var(--fc-line-gray200)", padding: "28px",
            boxShadow: "var(--fc-shadow-card)"
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
              <div className="fc-form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
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
              <div className="fc-form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
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
                  aria-label="Any additional notes" placeholder="Any additional notes..."
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
                />
              </div>
              <div style={{
                background: "var(--fc-bg-green50)", border: "1px solid var(--fc-line-green100)",
                borderRadius: "12px", padding: "14px 16px",
                marginBottom: "24px", display: "flex", alignItems: "flex-start", gap: "10px"
              }}>
                <Syringe size={16} color="var(--fc-fg-green700)" style={{ marginTop: "2px", flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: "13px", color: "var(--fc-fg-green700)", fontWeight: "500" }}>
                  A vaccination schedule will be auto-generated based on the hatch date and batch type.
                </p>
              </div>
              <button
                type="submit" disabled={saving}
                style={{
                  width: "100%", padding: "14px",
                  background: saving ? "var(--fc-bg-green300)" : "#15803d",
                  color: "var(--fc-fg-gray0)", border: "none", borderRadius: "12px",
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
  const toast = useToast();

  const ageInDays = Math.floor((new Date() - new Date(batch.hatch_date)) / (1000 * 60 * 60 * 24));
  const completed = vaccinations.filter(v => v.completed).length;
  const total = vaccinations.length;
  const progress = total > 0 ? (completed / total) * 100 : 0;
  const nextVaccine = vaccinations.filter(v => !v.completed).sort((a, b) => a.day_number - b.day_number)[0];
  const overdueCount = vaccinations.filter(v => !v.completed && v.scheduled_date < today).length;
  const typeColor = TYPE_COLORS[batch.batch_type] || { bg: "var(--fc-bg-gray100)", color: "var(--fc-fg-gray500)" };
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
    const { error: countError } = await supabase.from("farm_batches")
      .update({ current_count: newCount, mortality: newMortality })
      .eq("id", batch.id);
    if (countError) toast.error("The deaths were recorded, but the bird count on this batch was not updated. Refresh and check it.");
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
    const { error } = await supabase.from("batch_activities").insert([{
      batch_id: batch.id, user_email: userEmail,
      activity_type: activityType,
      quantity: activityForm.quantity ? Number(activityForm.quantity) : null,
      unit: activityForm.unit,
      notes: activityForm.notes,
      date: today
    }]);
    setSavingActivity(false);
    // keep what was typed so the farmer can simply try again
    if (error) { toast.error("That activity was not saved. Check your connection and try again."); return; }
    toast.success("Activity saved.");
    setActivityForm({ quantity: "", unit: "", notes: "" });
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
      background: "var(--fc-bg-gray0)", borderRadius: "16px",
      border: "1px solid var(--fc-line-gray200)",
      boxShadow: "var(--fc-shadow-card)", overflow: "hidden"
    }}>
      <div style={{ padding: "20px 24px" }}>

        {/* TOP ROW */}
        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "flex-start", marginBottom: "16px",
          flexWrap: "wrap", gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px",
              background: "var(--fc-bg-green51)", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0
            }}>
              <Egg size={22} color="var(--fc-fg-green700)" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
                {batch.batch_name}
              </h3>
              <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{
                  background: typeColor.bg, color: typeColor.color,
                  fontSize: "12px", fontWeight: "600", padding: "3px 10px", borderRadius: "16px"
                }}>
                  {typeLabel}
                </span>
                {batch.breed && <span style={{ fontSize: "12px", color: "var(--fc-fg-gray400)" }}>{batch.breed}</span>}
                <span style={{ fontSize: "12px", color: "var(--fc-fg-gray400)" }}>
                  · {batch.current_count || batch.quantity} birds alive
                </span>
                {batch.mortality > 0 && (
                  <span style={{ fontSize: "12px", color: "var(--fc-fg-red500)", fontWeight: "600" }}>
                    · {batch.mortality} deaths
                  </span>
                )}
                <span style={{ fontSize: "12px", color: "var(--fc-fg-gray400)" }}>· Day {ageInDays}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {overdueCount > 0 && (
              <span style={{
                display: "flex", alignItems: "center", gap: "4px",
                background: "var(--fc-bg-red50)", color: "var(--fc-fg-red500)",
                fontSize: "12px", fontWeight: "600", padding: "4px 10px", borderRadius: "16px"
              }}>
                <AlertTriangle size={12} /> {overdueCount} overdue
              </span>
            )}
            <button
              onClick={() => onDelete(batch.id)}
              aria-label={`Delete batch ${batch.batch_name}`}
              className="fc-tap"
              style={{
                width: "44px", height: "32px", borderRadius: "8px",
                border: "1px solid var(--fc-line-red100)", background: "var(--fc-bg-gray0)",
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
              }}
            >
              <Trash2 size={14} color="var(--fc-fg-red500)" />
            </button>
          </div>
        </div>

        {/* VACCINATION PROGRESS */}
        <div style={{ marginBottom: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "var(--fc-fg-gray400)", marginBottom: "6px" }}>
            <span>Vaccination Progress</span>
            <span>{completed}/{total} completed</span>
          </div>
          <div style={{ height: "8px", background: "var(--fc-bg-gray100)", borderRadius: "16px", overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${progress}%`,
              background: "#15803d",
              borderRadius: "16px", transition: "width 0.5s ease"
            }} />
          </div>
        </div>

        {/* NEXT VACCINE */}
        {nextVaccine && (
          <div style={{
            padding: "12px 14px", borderRadius: "12px", marginBottom: "14px",
            background: nextVaccine.scheduled_date < today ? "var(--fc-bg-red50)" : nextVaccine.scheduled_date === today ? "var(--fc-bg-amber50)" : "var(--fc-bg-gray50)",
            border: `1px solid ${nextVaccine.scheduled_date < today ? "var(--fc-line-red200)" : nextVaccine.scheduled_date === today ? "var(--fc-line-amber200)" : "var(--fc-line-gray200)"}`
          }}>
            <p style={{ margin: "0 0 2px", fontSize: "12px", color: "var(--fc-fg-gray500)", fontWeight: "600" }}>
              Next vaccination
            </p>
            <p style={{ margin: "0 0 2px", fontSize: "14px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
              {nextVaccine.vaccine_name}
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--fc-fg-gray500)" }}>
              Day {nextVaccine.day_number} · {nextVaccine.scheduled_date}
              {nextVaccine.scheduled_date === today && <span style={{ color: "var(--fc-fg-amber700)", fontWeight: "700" }}> · Today</span>}
              {nextVaccine.scheduled_date < today && <span style={{ color: "var(--fc-fg-red700)", fontWeight: "700" }}> · Overdue</span>}
            </p>
          </div>
        )}

        {/* ACTION BUTTONS */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "4px" }}>
          <button
            onClick={() => { setShowMortality(!showMortality); setShowExpense(false); setShowSale(false); }}
            style={{
              flex: 1, padding: "9px 14px",
              background: showMortality ? "var(--fc-bg-red50)" : "var(--fc-bg-gray50)",
              border: `1px solid ${showMortality ? "var(--fc-line-red200)" : "var(--fc-line-gray200)"}`,
              borderRadius: "12px", cursor: "pointer", fontWeight: "600", fontSize: "13px",
              color: showMortality ? "var(--fc-fg-red500)" : "var(--fc-fg-gray700)",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
            }}
          >
            <Skull size={14} /> Log Mortality
          </button>
          <button
            onClick={() => { setShowExpense(!showExpense); setShowMortality(false); setShowSale(false); }}
            style={{
              flex: 1, padding: "9px 14px",
              background: showExpense ? "var(--fc-bg-amber50)" : "var(--fc-bg-gray50)",
              border: `1px solid ${showExpense ? "var(--fc-line-amber200)" : "var(--fc-line-gray200)"}`,
              borderRadius: "12px", cursor: "pointer", fontWeight: "600", fontSize: "13px",
              color: showExpense ? "var(--fc-fg-amber600)" : "var(--fc-fg-gray700)",
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
                background: "var(--fc-bg-gray50)", border: "1px solid var(--fc-line-gray200)",
                borderRadius: "12px", cursor: "pointer",
                fontWeight: "600", fontSize: "13px", color: "var(--fc-fg-gray700)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "6px"
              }}
            >
              <CheckCircle2 size={14} aria-hidden="true" /> Mark Complete
            </button>
          )}
        </div>

        {/* MORTALITY FORM */}
        {showMortality && (
          <form onSubmit={handleLogMortality} style={{
            marginTop: "14px", padding: "16px",
            background: "var(--fc-bg-red50)", borderRadius: "12px", border: "1px solid var(--fc-line-red200)"
          }}>
            <p style={{ margin: "0 0 12px", fontWeight: "700", fontSize: "14px", color: "var(--fc-fg-red500)" }}>
              <TrendingDown size={14} aria-hidden="true" /> Log Mortality
            </p>
            <div className="fc-form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={{ ...labelStyle, color: "var(--fc-fg-red900)" }}>Number of Deaths</label>
                <input type="number" min="1" placeholder="e.g. 3"
                  value={mortalityForm.count}
                  onChange={e => setMortalityForm({ ...mortalityForm, count: e.target.value })}
                  required style={inputStyle} />
              </div>
              <div>
                <label style={{ ...labelStyle, color: "var(--fc-fg-red900)" }}>Date</label>
                <input type="date" value={mortalityForm.date}
                  onChange={e => setMortalityForm({ ...mortalityForm, date: e.target.value })}
                  style={inputStyle} />
              </div>
            </div>
            <input aria-label="Notes" placeholder="Notes e.g. suspected disease"
              value={mortalityForm.notes}
              onChange={e => setMortalityForm({ ...mortalityForm, notes: e.target.value })}
              style={{ ...inputStyle, marginBottom: "10px" }} />
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" disabled={savingMortality} style={{
                padding: "9px 20px", background: "#dc2626",
                color: "var(--fc-fg-gray0)", border: "none", borderRadius: "8px",
                fontWeight: "700", fontSize: "13px", cursor: "pointer"
              }}>
                {savingMortality ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => setShowMortality(false)} style={{
                padding: "9px 16px", background: "var(--fc-bg-gray0)",
                border: "1px solid var(--fc-line-gray200)", borderRadius: "8px",
                cursor: "pointer", fontSize: "13px", color: "var(--fc-fg-gray700)"
              }}>Cancel</button>
            </div>
          </form>
        )}

        {/* EXPENSE FORM */}
        {showExpense && (
          <form onSubmit={handleLogExpense} style={{
            marginTop: "14px", padding: "16px",
            background: "var(--fc-bg-amber50)", borderRadius: "12px", border: "1px solid var(--fc-line-amber200)"
          }}>
            <p style={{ margin: "0 0 12px", fontWeight: "700", fontSize: "14px", color: "var(--fc-fg-amber600)" }}>
              <Banknote size={14} aria-hidden="true" /> Log Expense
            </p>
            <div className="fc-form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={{ ...labelStyle, color: "var(--fc-fg-amber900)" }}>Category</label>
                <select value={expenseForm.category}
                  onChange={e => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  style={{ ...inputStyle, appearance: "none" }}>
                  {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, color: "var(--fc-fg-amber900)" }}>Amount (KES)</label>
                <input type="number" placeholder="e.g. 5000"
                  value={expenseForm.amount}
                  onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                  required style={inputStyle} />
              </div>
            </div>
            <div className="fc-form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={{ ...labelStyle, color: "var(--fc-fg-amber900)" }}>Date</label>
                <input type="date" value={expenseForm.date}
                  onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={{ ...labelStyle, color: "var(--fc-fg-amber900)" }}>Notes (Optional)</label>
                <input placeholder="e.g. Unga feeds 50kg"
                  value={expenseForm.notes}
                  onChange={e => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="submit" disabled={savingExpense} style={{
                padding: "9px 20px", background: "#d97706",
                color: "var(--fc-fg-gray0)", border: "none", borderRadius: "8px",
                fontWeight: "700", fontSize: "13px", cursor: "pointer"
              }}>
                {savingExpense ? "Saving..." : "Save"}
              </button>
              <button type="button" onClick={() => setShowExpense(false)} style={{
                padding: "9px 16px", background: "var(--fc-bg-gray0)",
                border: "1px solid var(--fc-line-gray200)", borderRadius: "8px",
                cursor: "pointer", fontSize: "13px", color: "var(--fc-fg-gray700)"
              }}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      {/* ── LOG DAILY ACTIVITY ── */}
      <div style={{ borderTop: "1px solid var(--fc-line-gray100)", padding: "16px 24px" }}>
        <h4 style={{ margin: "0 0 12px", fontSize: "13px", fontWeight: "700", color: "var(--fc-fg-gray500)" }}>
          Log Daily Activity
        </h4>
        {/* ACTIVITY TYPE TABS */}
        <div style={{
          display: "flex", background: "var(--fc-bg-gray100)",
          borderRadius: "12px", padding: "3px",
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
                background: activityType === type ? "var(--fc-bg-gray0)" : "transparent",
                color: activityType === type ? "var(--fc-fg-gray900)" : "var(--fc-fg-gray400)",
                boxShadow: activityType === type ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s"
              }}
            >
              {type}
            </button>
          ))}
        </div>
        <div className="fc-form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
          <input
            aria-label="Quantity" placeholder="Quantity (e.g. 5)"
            type="number"
            value={activityForm.quantity}
            onChange={e => setActivityForm({ ...activityForm, quantity: e.target.value })}
            style={inputStyle}
          />
          <input
            aria-label="Unit" placeholder="Unit (kg, trays...)"
            value={activityForm.unit}
            onChange={e => setActivityForm({ ...activityForm, unit: e.target.value })}
            style={inputStyle}
          />
        </div>
        <textarea
          aria-label="Notes" placeholder="Notes (optional)"
          value={activityForm.notes}
          onChange={e => setActivityForm({ ...activityForm, notes: e.target.value })}
          style={{ ...inputStyle, minHeight: "70px", resize: "vertical", marginBottom: "10px" }}
        />
        <button
          onClick={handleLogActivity}
          disabled={savingActivity}
          style={{
            width: "100%", padding: "12px",
            background: "#15803d",
            color: "var(--fc-fg-gray0)", border: "none", borderRadius: "12px",
            fontWeight: "700", fontSize: "14px", cursor: "pointer"
          }}
        >
          {savingActivity ? "Logging..." : "Log Activity"}
        </button>
      </div>

      {/* ── RECORD A SALE ── */}
      <div style={{ borderTop: "1px solid var(--fc-line-gray100)" }}>
        <div
          style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 24px", cursor: "pointer"
          }}
          onClick={() => setShowSale(!showSale)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <ShoppingCart size={16} color="var(--fc-fg-gray700)" />
            <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>
              Record a Sale
            </span>
          </div>
          <button style={{
            width: "28px", height: "28px", borderRadius: "50%",
            border: "1px solid var(--fc-line-gray200)", background: "var(--fc-bg-gray0)",
            cursor: "pointer", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: "18px", color: "var(--fc-fg-gray700)", fontWeight: "300"
          }}>
            {showSale ? "×" : "+"}
          </button>
        </div>

        {showSale && (
          <form onSubmit={handleRecordSale} style={{ padding: "0 24px 20px" }}>
            <div className="fc-form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
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
            <div className="fc-form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
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
            <div className="fc-form-grid-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={saleForm.date}
                  onChange={e => setSaleForm({ ...saleForm, date: e.target.value })}
                  style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Buyer (optional)</label>
                <input aria-label="Buyer name" placeholder="Buyer name"
                  value={saleForm.buyer}
                  onChange={e => setSaleForm({ ...saleForm, buyer: e.target.value })}
                  style={inputStyle} />
              </div>
            </div>
            <textarea aria-label="Notes" placeholder="Notes (optional)"
              value={saleForm.notes}
              onChange={e => setSaleForm({ ...saleForm, notes: e.target.value })}
              style={{ ...inputStyle, minHeight: "70px", resize: "vertical", marginBottom: "12px" }} />
            <button type="submit" disabled={savingSale} style={{
              width: "100%", padding: "13px",
              background: "#15803d",
              color: "var(--fc-fg-gray0)", border: "none", borderRadius: "12px",
              fontWeight: "700", fontSize: "14px", cursor: "pointer"
            }}>
              {savingSale ? "Saving..." : "Save Sale"}
            </button>
          </form>
        )}
      </div>

      {/* ── BATCH P&L ── */}
      <div style={{ borderTop: "1px solid var(--fc-line-gray100)" }}>
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
              background: netPL >= 0 ? "var(--fc-bg-green50)" : "var(--fc-bg-red50)",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              {netPL >= 0
                ? <TrendingUp size={14} aria-hidden="true" />
                : <TrendingDown size={14} color="var(--fc-fg-red700)" aria-hidden="true" />}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "var(--fc-fg-gray500)" }}>
                Batch P&L
              </p>
              <p style={{
                margin: 0, fontSize: "18px", fontWeight: "700",
                color: netPL >= 0 ? "var(--fc-fg-green700)" : "var(--fc-fg-red500)"
              }}>
                {netPL >= 0 ? "+" : ""}KES {netPL.toLocaleString()}
              </p>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: "0 0 2px", fontSize: "13px", color: "var(--fc-fg-green700)" }}>
              Revenue: KES {totalRevenue.toLocaleString()}
            </p>
            <p style={{ margin: "0 0 6px", fontSize: "13px", color: "var(--fc-fg-red500)" }}>
              Expenses: KES {totalExpenses.toLocaleString()}
            </p>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--fc-fg-gray400)" }}>
              {salesList.length} sale{salesList.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
          <ChevronDown size={16} color="var(--fc-fg-gray400)"
            style={{ transform: expandedSales ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </div>

        {expandedSales && salesList.length > 0 && (
          <div style={{ padding: "0 24px 16px" }}>
            <p style={{
              fontSize: "11px", fontWeight: "700", color: "var(--fc-fg-gray400)",
              textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px"
            }}>
              Sales History
            </p>
            {salesList.map(sale => (
              <div key={sale.id} style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "10px 12px",
                background: "var(--fc-bg-gray50)", borderRadius: "12px",
                marginBottom: "6px"
              }}>
                <div>
                  <p style={{ margin: 0, fontWeight: "600", fontSize: "13px", color: "var(--fc-fg-gray900)" }}>
                    {sale.what_sold} — {sale.quantity} {sale.unit}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--fc-fg-gray400)" }}>
                    {sale.sale_date}{sale.buyer_name ? ` · ${sale.buyer_name}` : ""}
                  </p>
                </div>
                <p style={{ margin: 0, fontWeight: "700", fontSize: "14px", color: "var(--fc-fg-green700)" }}>
                  +KES {Number(sale.total_amount).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── VACCINATION SCHEDULE ── */}
      <div style={{ borderTop: "1px solid var(--fc-line-gray100)" }}>
        <button
          onClick={() => setExpandedVacc(!expandedVacc)}
          style={{
            width: "100%", padding: "14px 24px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "none", border: "none", cursor: "pointer",
            fontSize: "13px", color: "var(--fc-fg-gray500)", fontWeight: "600"
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
              <p style={{ textAlign: "center", color: "var(--fc-fg-gray400)", fontSize: "13px", padding: "16px 0" }}>
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
                      background: task.completed ? "var(--fc-bg-green50)" : isOverdue ? "var(--fc-bg-red50)" : isDueToday ? "var(--fc-bg-amber50)" : "var(--fc-bg-gray50)",
                      border: `1px solid ${task.completed ? "var(--fc-line-green100)" : isOverdue ? "var(--fc-line-red200)" : isDueToday ? "var(--fc-line-amber200)" : "var(--fc-line-gray101)"}`
                    }}>
                      <input
                        type="checkbox" checked={task.completed}
                        onChange={() => onToggleVaccination(task)}
                        style={{ width: "18px", height: "18px", cursor: "pointer", flexShrink: 0, accentColor: "var(--fc-fg-green700)" }}
                      />
                      <div style={{ flex: 1 }}>
                        <p style={{
                          margin: 0, fontSize: "13px", fontWeight: "600",
                          color: task.completed ? "var(--fc-fg-gray400)" : "var(--fc-fg-gray900)",
                          textDecoration: task.completed ? "line-through" : "none"
                        }}>
                          {task.vaccine_name}
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "var(--fc-fg-gray400)" }}>
                          Day {task.day_number} · {task.method?.replace("_", " ")} · {task.scheduled_date}
                        </p>
                      </div>
                      {task.completed ? <CheckCircle2 size={16} color="var(--fc-fg-green700)" />
                        : isOverdue ? <AlertTriangle size={16} color="var(--fc-fg-red500)" />
                        : isDueToday ? <Clock size={16} color="var(--fc-fg-amber500)" />
                        : <Calendar size={16} color="var(--fc-fg-gray400)" />}
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