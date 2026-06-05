import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { Calculator, Egg, Info, Clock, Trash2 } from "lucide-react";

const BROILER_PHASES = [
  { name: "Starter", days: [1, 14], gPerBird: 13, feedType: "High-protein starter (22% CP)", meals: 2 },
  { name: "Grower", days: [15, 28], gPerBird: 50, feedType: "Grower mash (20% CP)", meals: 3 },
  { name: "Finisher", days: [29, 42], gPerBird: 90, feedType: "Finisher pellets (18% CP)", meals: 3 },
];

const LAYER_PHASES = [
  { name: "Chick", days: [1, 42], gPerBird: 20, feedType: "Chick mash (22% CP)", meals: 2 },
  { name: "Grower", days: [43, 126], gPerBird: 60, feedType: "Grower mash (18% CP)", meals: 3 },
  { name: "Pre-layer", days: [127, 154], gPerBird: 80, feedType: "Pre-layer mash (16% CP)", meals: 3 },
  { name: "Layer", days: [155, 365], gPerBird: 110, feedType: "Layer mash (16% CP)", meals: 3 },
];

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

function getPhase(chickenType, ageDay) {
  const phases = chickenType === "layer" ? LAYER_PHASES : BROILER_PHASES;
  return phases.find(p => ageDay >= p.days[0] && ageDay <= p.days[1])
    || phases[phases.length - 1];
}

function calcTotalFeed(chickenType, currentAge, targetAge, numBirds) {
  const phases = chickenType === "layer" ? LAYER_PHASES : BROILER_PHASES;
  let totalGrams = 0;
  const phaseBreakdown = [];

  phases.forEach(phase => {
    const startDay = Math.max(phase.days[0], currentAge);
    const endDay = Math.min(phase.days[1], targetAge);
    if (endDay < startDay) return;
    const days = endDay - startDay + 1;
    const grams = days * phase.gPerBird * numBirds;
    totalGrams += grams;
    phaseBreakdown.push({
      ...phase,
      days,
      totalKg: (grams / 1000).toFixed(1),
      bags50: Math.ceil(grams / 1000 / 50),
      bags70: Math.ceil(grams / 1000 / 70),
    });
  });

  return {
    totalKg: (totalGrams / 1000).toFixed(1),
    bags50: Math.ceil(totalGrams / 1000 / 50),
    bags70: Math.ceil(totalGrams / 1000 / 70),
    phaseBreakdown: phaseBreakdown.filter(p => p.days > 0)
  };
}

// ✅ Build daily tracking from current to target age
function buildDailyPlan(chickenType, currentAge, targetAge, numBirds) {
  const plan = [];
  for (let day = currentAge; day <= targetAge; day++) {
    const phase = getPhase(chickenType, day || 1);
    const totalKgToday = (phase.gPerBird * numBirds) / 1000;
    plan.push({
      day,
      phase: phase.name,
      feedType: phase.feedType,
      gPerBird: phase.gPerBird,
      totalKgToday: totalKgToday.toFixed(2),
      meals: phase.meals,
      perMeal: (totalKgToday / phase.meals).toFixed(2)
    });
  }
  return plan;
}

export default function FeedCalculator() {
  const { userEmail } = useAuth();
  const [batches, setBatches] = useState([]);
  const [savedCalculations, setSavedCalculations] = useState([]);
  const [selectedBatch, setSelectedBatch] = useState("manual");
  const [results, setResults] = useState(null);
  const [dailyPlan, setDailyPlan] = useState([]);
  const [showDailyPlan, setShowDailyPlan] = useState(false);
  const [activeCalcTab, setActiveCalcTab] = useState("new");
  const [form, setForm] = useState({
    chickenType: "broiler",
    numBirds: 100,
    currentAge: 0,
    targetAge: 42
  });

  useEffect(() => {
    loadBatches();
    loadSavedCalculations();
  }, [userEmail]);

  async function loadBatches() {
    if (!userEmail) return;
    const { data } = await supabase
      .from("farm_batches")
      .select("*")
      .eq("user_email", userEmail)
      .eq("status", "active");
    setBatches(data || []);
  }

  async function loadSavedCalculations() {
    if (!userEmail) return;
    const { data } = await supabase
      .from("feed_calculations")
      .select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false })
      .limit(10);
    setSavedCalculations(data || []);
  }

  function handleBatchSelect(batchId) {
    setSelectedBatch(batchId);
    if (batchId === "manual") return;
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return;
    const ageInDays = Math.floor(
      (new Date() - new Date(batch.hatch_date)) / (1000 * 60 * 60 * 24)
    );
    const maxAge = batch.batch_type === "layer" ? 365 : 42;
    setForm({
      chickenType: batch.batch_type === "layer" ? "layer" : "broiler",
      numBirds: batch.current_count || batch.quantity,
      currentAge: Math.max(0, ageInDays),
      targetAge: maxAge
    });
  }

  async function calculate() {
    const { chickenType, numBirds, currentAge, targetAge } = form;
    if (!numBirds || currentAge > targetAge) return;

    const todayPhase = getPhase(chickenType, currentAge || 1);
    const totalFeedToday = (todayPhase.gPerBird * numBirds) / 1000;
    const perMeal = totalFeedToday / todayPhase.meals;
    const totals = calcTotalFeed(chickenType, Math.max(1, currentAge), targetAge, numBirds);
    const plan = buildDailyPlan(chickenType, Math.max(1, currentAge), targetAge, numBirds);

    const calcResults = {
      todayPhase, totalFeedToday, perMeal, ...totals,
      numBirds, currentAge, targetAge, chickenType
    };

    setResults(calcResults);
    setDailyPlan(plan);

    // ✅ Save to database
    const selectedBatchObj = batches.find(b => b.id === selectedBatch);
    await supabase.from("feed_calculations").insert([{
      user_email: userEmail,
      batch_id: selectedBatch !== "manual" ? selectedBatch : null,
      batch_name: selectedBatchObj?.batch_name || "Manual Entry",
      chicken_type: chickenType,
      num_birds: numBirds,
      current_age: currentAge,
      target_age: targetAge,
      total_kg: Number(totals.totalKg),
      bags_50: totals.bags50,
      bags_70: totals.bags70
    }]);

    loadSavedCalculations();
  }

  function loadSavedCalc(calc) {
    setForm({
      chickenType: calc.chicken_type,
      numBirds: calc.num_birds,
      currentAge: calc.current_age,
      targetAge: calc.target_age
    });
    setSelectedBatch(calc.batch_id || "manual");
    setActiveCalcTab("new");
    // Auto calculate
    setTimeout(() => {
      const todayPhase = getPhase(calc.chicken_type, calc.current_age || 1);
      const totalFeedToday = (todayPhase.gPerBird * calc.num_birds) / 1000;
      const totals = calcTotalFeed(calc.chicken_type, Math.max(1, calc.current_age), calc.target_age, calc.num_birds);
      const plan = buildDailyPlan(calc.chicken_type, Math.max(1, calc.current_age), calc.target_age, calc.num_birds);
      setResults({
        todayPhase, totalFeedToday,
        perMeal: totalFeedToday / todayPhase.meals,
        ...totals,
        numBirds: calc.num_birds,
        currentAge: calc.current_age,
        targetAge: calc.target_age,
        chickenType: calc.chicken_type
      });
      setDailyPlan(plan);
    }, 100);
  }

  async function deleteCalc(id) {
    await supabase.from("feed_calculations").delete().eq("id", id);
    loadSavedCalculations();
  }

  const maxAge = form.chickenType === "layer" ? 365 : 42;

  return (
    <div style={{ maxWidth: "800px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
        <Calculator size={28} color="#22c55e" />
        <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
          Feed Calculator
        </h1>
      </div>
      <p style={{ color: "#6b7280", fontSize: "15px", marginBottom: "24px" }}>
        Estimate total feed needed and daily feeding amounts for healthy growth.
      </p>

      {/* TABS */}
      <div style={{
        display: "flex", background: "#f3f4f6",
        borderRadius: "12px", padding: "4px",
        marginBottom: "20px", width: "fit-content"
      }}>
        {[
          { key: "new", label: "New Calculation" },
          { key: "saved", label: `Saved (${savedCalculations.length})` }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveCalcTab(tab.key)}
            style={{
              padding: "8px 20px", borderRadius: "9px",
              border: "none", cursor: "pointer",
              fontWeight: "600", fontSize: "13px",
              background: activeCalcTab === tab.key ? "#fff" : "transparent",
              color: activeCalcTab === tab.key ? "#111827" : "#9ca3af",
              boxShadow: activeCalcTab === tab.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.2s"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ====== SAVED CALCULATIONS ====== */}
      {activeCalcTab === "saved" && (
        <div>
          {savedCalculations.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "#fff", borderRadius: "20px", border: "1px solid #f0f0f0"
            }}>
              <Calculator size={48} color="#e5e7eb" style={{ marginBottom: "12px" }} />
              <p style={{ color: "#9ca3af", fontSize: "15px" }}>
                No saved calculations yet. Run your first calculation above.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {savedCalculations.map(calc => (
                <div key={calc.id} style={{
                  background: "#fff", borderRadius: "16px",
                  border: "1px solid #e5e7eb", padding: "16px 20px",
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: "16px"
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      <span style={{
                        background: calc.chicken_type === "layer" ? "#edf9f1" : "#fff7e6",
                        color: calc.chicken_type === "layer" ? "#16a34a" : "#d97706",
                        fontSize: "11px", fontWeight: "700",
                        padding: "2px 8px", borderRadius: "20px", textTransform: "capitalize"
                      }}>
                        {calc.chicken_type}
                      </span>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "#111827" }}>
                        {calc.batch_name}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                      <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                        🐔 {calc.num_birds} birds
                      </span>
                      <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                        📅 Day {calc.current_age} → {calc.target_age}
                      </span>
                      <span style={{ fontSize: "12px", color: "#22c55e", fontWeight: "600" }}>
                        📦 {calc.total_kg}kg total
                      </span>
                      <span style={{ fontSize: "12px", color: "#f59e0b", fontWeight: "600" }}>
                        🛍 {calc.bags_50} bags (50kg)
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px" }}>
                      <Clock size={11} color="#9ca3af" />
                      <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                        {new Date(calc.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={() => loadSavedCalc(calc)}
                      style={{
                        padding: "8px 14px", background: "#f0fdf4",
                        border: "1px solid #dcfce7", borderRadius: "8px",
                        cursor: "pointer", fontWeight: "600",
                        fontSize: "12px", color: "#16a34a"
                      }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteCalc(calc.id)}
                      style={{
                        width: "34px", height: "34px", borderRadius: "8px",
                        border: "1px solid #fee2e2", background: "#fff",
                        cursor: "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center"
                      }}
                    >
                      <Trash2 size={14} color="#ef4444" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ====== NEW CALCULATION ====== */}
      {activeCalcTab === "new" && (
        <>
          {/* INPUTS */}
          <div style={{
            background: "#fff", borderRadius: "20px",
            border: "1px solid #e5e7eb", padding: "28px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)", marginBottom: "20px"
          }}>
            <h2 style={{ margin: "0 0 20px", fontSize: "16px", fontWeight: "700", color: "#111827" }}>
              Calculator Inputs
            </h2>

            <div style={{ marginBottom: "20px" }}>
              <label style={labelStyle}>Select Batch</label>
              <select
                value={selectedBatch}
                onChange={e => handleBatchSelect(e.target.value)}
                style={{ ...inputStyle, appearance: "none", border: "1.5px solid #22c55e" }}
              >
                <option value="manual">Manual Entry</option>
                {batches.map(b => (
                  <option key={b.id} value={b.id}>{b.batch_name}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div>
                <label style={labelStyle}>Chicken Type</label>
                <select
                  value={form.chickenType}
                  onChange={e => setForm({
                    ...form, chickenType: e.target.value,
                    targetAge: e.target.value === "layer" ? 365 : 42
                  })}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="broiler">Broiler</option>
                  <option value="layer">Layer</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Number of Birds</label>
                <input
                  type="number" min="1"
                  value={form.numBirds}
                  onChange={e => setForm({ ...form, numBirds: Number(e.target.value) })}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
              <div>
                <label style={labelStyle}>Current Age (days)</label>
                <input
                  type="number" min="0" max={maxAge}
                  value={form.currentAge}
                  onChange={e => setForm({ ...form, currentAge: Number(e.target.value) })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Target Age (days)</label>
                <input
                  type="number" min="1" max={maxAge}
                  value={form.targetAge}
                  onChange={e => setForm({ ...form, targetAge: Number(e.target.value) })}
                  style={inputStyle}
                />
                <p style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                  Max maturity: {maxAge} days
                </p>
              </div>
            </div>

            <button
              onClick={calculate}
              style={{
                width: "100%", padding: "14px",
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                color: "#fff", border: "none", borderRadius: "12px",
                fontWeight: "700", fontSize: "15px", cursor: "pointer",
                boxShadow: "0 6px 20px rgba(34,197,94,0.25)"
              }}
            >
              Calculate Feed
            </button>
          </div>

          {/* RESULTS */}
          {results && (
            <>
              {/* TODAY'S GUIDE */}
              <div style={{
                background: "#fff", borderRadius: "20px",
                border: "1px solid #e5e7eb", padding: "24px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)", marginBottom: "16px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                  <Egg size={20} color="#22c55e" />
                  <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#111827" }}>
                    Today's Feeding Guide (Day {results.currentAge})
                  </h2>
                </div>
                <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#9ca3af" }}>
                  {results.todayPhase.name} phase — {results.todayPhase.feedType}
                </p>

                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "12px", marginBottom: "16px"
                }}>
                  {[
                    { value: `${results.todayPhase.gPerBird}g`, label: "per bird/day", color: "#22c55e" },
                    { value: `${results.totalFeedToday.toFixed(1)}kg`, label: "total today", color: "#22c55e" },
                    { value: `${results.todayPhase.meals}x`, label: "meals/day", color: "#111827" },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: "#f9fafb", borderRadius: "14px",
                      padding: "16px", textAlign: "center"
                    }}>
                      <div style={{ fontSize: "24px", fontWeight: "800", color: item.color }}>
                        {item.value}
                      </div>
                      <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{
                  background: "#fffbeb", border: "1px solid #fde68a",
                  borderRadius: "10px", padding: "12px 14px",
                  display: "flex", alignItems: "flex-start", gap: "8px"
                }}>
                  <Info size={14} color="#d97706" style={{ marginTop: "2px", flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: "13px", color: "#92400e" }}>
                    Feed {results.perMeal.toFixed(2)}kg per meal, spread evenly.
                    Ensure fresh clean water is always available.
                  </p>
                </div>
              </div>

              {/* FEED PURCHASE ESTIMATE */}
              <div style={{
                background: "#fff", borderRadius: "20px",
                border: "1px solid #e5e7eb", padding: "24px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)", marginBottom: "16px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "18px" }}>📦</span>
                  <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#111827" }}>
                    Feed Purchase Estimate
                  </h2>
                </div>

                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "12px", marginBottom: "16px"
                }}>
                  {[
                    { value: `${results.totalKg}kg`, label: "Total Feed", color: "#22c55e" },
                    { value: results.bags50, label: "Bags (50kg)", color: "#f59e0b" },
                    { value: results.bags70, label: "Bags (70kg)", color: "#f59e0b" },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: "#f9fafb", borderRadius: "14px",
                      padding: "16px", textAlign: "center"
                    }}>
                      <div style={{ fontSize: "28px", fontWeight: "800", color: item.color }}>
                        {item.value}
                      </div>
                      <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "4px" }}>
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>

                <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
                  For <strong style={{ color: "#111827" }}>{results.numBirds} birds</strong> from
                  day {results.currentAge} to day {results.targetAge} ({results.targetAge - results.currentAge} days)
                </p>
              </div>

              {/* PHASE BREAKDOWN */}
              <div style={{
                background: "#fff", borderRadius: "20px",
                border: "1px solid #e5e7eb", padding: "24px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)", marginBottom: "16px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <span style={{ fontSize: "18px" }}>📈</span>
                  <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#111827" }}>
                    Phase Breakdown
                  </h2>
                </div>

                {results.phaseBreakdown.map((phase, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", padding: "16px 0",
                    borderBottom: i < results.phaseBreakdown.length - 1
                      ? "1px solid #f3f4f6" : "none"
                  }}>
                    <div>
                      <p style={{ margin: "0 0 4px", fontWeight: "700", fontSize: "15px", color: "#111827" }}>
                        {phase.name}
                      </p>
                      <p style={{ margin: "0 0 2px", fontSize: "13px", color: "#9ca3af" }}>
                        {phase.feedType}
                      </p>
                      <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
                        {phase.days} days
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ margin: "0 0 6px", fontWeight: "700", fontSize: "16px", color: "#111827" }}>
                        {phase.totalKg} kg
                      </p>
                      <span style={{
                        background: "#fef3c7", color: "#d97706",
                        fontSize: "12px", fontWeight: "700",
                        padding: "3px 10px", borderRadius: "20px"
                      }}>
                        {phase.bags50} bags
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* DAILY PLAN */}
              <div style={{
                background: "#fff", borderRadius: "20px",
                border: "1px solid #e5e7eb", padding: "24px",
                boxShadow: "0 4px 20px rgba(0,0,0,0.04)", marginBottom: "16px"
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: "16px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "18px" }}>📅</span>
                    <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#111827" }}>
                      Daily Feed Plan
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowDailyPlan(!showDailyPlan)}
                    style={{
                      padding: "8px 14px", background: "#f0fdf4",
                      border: "1px solid #dcfce7", borderRadius: "8px",
                      cursor: "pointer", fontWeight: "600",
                      fontSize: "12px", color: "#16a34a"
                    }}
                  >
                    {showDailyPlan ? "Hide" : "Show All Days"}
                  </button>
                </div>

                <p style={{ margin: "0 0 14px", fontSize: "13px", color: "#9ca3af" }}>
                  Day-by-day feeding guide from day {results.currentAge} to day {results.targetAge}
                </p>

                {/* TABLE HEADER */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "60px 80px 1fr 80px 80px 80px",
                  gap: "8px", padding: "8px 12px",
                  background: "#f9fafb", borderRadius: "10px",
                  fontSize: "11px", fontWeight: "700",
                  color: "#9ca3af", textTransform: "uppercase",
                  letterSpacing: "0.05em", marginBottom: "6px"
                }}>
                  <span>Day</span>
                  <span>Phase</span>
                  <span>Feed Type</span>
                  <span>g/bird</span>
                  <span>Total kg</span>
                  <span>Meals</span>
                </div>

                {/* SHOW TODAY + next 6 days by default, all if expanded */}
                {(showDailyPlan ? dailyPlan : dailyPlan.slice(0, 7)).map((day, i) => {
                  const isToday = day.day === results.currentAge;
                  return (
                    <div
                      key={i}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "60px 80px 1fr 80px 80px 80px",
                        gap: "8px", padding: "10px 12px",
                        borderRadius: "10px",
                        background: isToday ? "#f0fdf4" : i % 2 === 0 ? "#fff" : "#fafafa",
                        border: isToday ? "1px solid #dcfce7" : "none",
                        marginBottom: "4px", fontSize: "13px"
                      }}
                    >
                      <span style={{ fontWeight: isToday ? "800" : "600", color: isToday ? "#16a34a" : "#374151" }}>
                        {isToday ? "→" : ""} {day.day}
                      </span>
                      <span style={{
                        fontSize: "11px", fontWeight: "600",
                        color: day.phase === "Starter" ? "#3b82f6"
                          : day.phase === "Grower" ? "#f59e0b"
                          : day.phase === "Finisher" ? "#ef4444"
                          : "#22c55e"
                      }}>
                        {day.phase}
                      </span>
                      <span style={{ fontSize: "11px", color: "#9ca3af" }}>
                        {day.feedType}
                      </span>
                      <span style={{ color: "#374151", fontWeight: "600" }}>
                        {day.gPerBird}g
                      </span>
                      <span style={{ color: "#22c55e", fontWeight: "700" }}>
                        {day.totalKgToday}kg
                      </span>
                      <span style={{ color: "#374151" }}>
                        {day.meals}x
                      </span>
                    </div>
                  );
                })}

                {!showDailyPlan && dailyPlan.length > 7 && (
                  <p style={{
                    textAlign: "center", color: "#9ca3af",
                    fontSize: "13px", marginTop: "10px"
                  }}>
                    + {dailyPlan.length - 7} more days — click "Show All Days"
                  </p>
                )}
              </div>

              {/* STORAGE TIP */}
              <div style={{
                background: "#eff6ff", border: "1px solid #bfdbfe",
                borderRadius: "14px", padding: "14px 16px",
                display: "flex", alignItems: "flex-start", gap: "10px"
              }}>
                <Info size={16} color="#3b82f6" style={{ marginTop: "2px", flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: "13px", color: "#1e40af", lineHeight: "1.5" }}>
                  Add 5–10% buffer stock to account for spillage and wastage.
                  Store feed in a cool, dry, rodent-proof area.
                  Never feed mouldy or wet feed to birds.
                </p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}