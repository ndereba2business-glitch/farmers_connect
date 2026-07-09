import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import "./Dashboard.css";
import {
  Egg, Syringe, ShoppingBag, Users, ArrowUpRight,
  Plus, MessageCircle, CheckCircle2,
  AlertTriangle, X, TrendingUp, TrendingDown, DollarSign, Wallet
} from "lucide-react";
import {
  ComposedChart, BarChart as RechartsBarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";


function DailyFinanceTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "white", borderRadius: "10px", padding: "10px 14px",
      border: "1px solid #e5e7eb", boxShadow: "0 6px 20px rgba(15,23,42,0.12)"
    }}>
      <p style={{ margin: 0, fontSize: "var(--fs-small, 12px)", fontWeight: "700", color: "#111827" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "4px 0 0", fontSize: "var(--fs-small, 12px)", color: p.color, fontWeight: "600" }}>
          {p.name}: KES {Number(p.value).toLocaleString()}
        </p>
      ))}
    </div>
  );
}

// ── CUSTOM TOOLTIP FOR THE 14-DAY DAILY DEATHS CHART ──
function DailyDeathsTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "white", borderRadius: "10px", padding: "10px 14px",
      border: "1px solid #e5e7eb", boxShadow: "0 6px 20px rgba(15,23,42,0.12)"
    }}>
      <p style={{ margin: 0, fontSize: "var(--fs-small, 13px)", fontWeight: "700", color: "#1e293b" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "4px 0 0", fontSize: "var(--fs-small, 12px)", color: "#ef4444", fontWeight: "600" }}>
          {p.name} : {p.value}
        </p>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { profile, userEmail } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);

  const [stats, setStats] = useState({
    batches: 0, vaccines: 0, listings: 0, posts: 0, tasks: 0
  });

  const [recentTasks, setRecentTasks] = useState([]);
  const [overdueVaccines, setOverdueVaccines] = useState([]);
  const [mortalityData, setMortalityData] = useState([]);
  const [financeData, setFinanceData] = useState({
    totalIncome: 0, totalExpenses: 0, profit: 0
  });

  const [dailyFinanceData, setDailyFinanceData] = useState([]);
  const [periodTotals, setPeriodTotals] = useState({ revenue: 0, expenses: 0, profit: 0 });

  const [dailyMortalityData, setDailyMortalityData] = useState([]);

  useEffect(() => {
    if (userEmail) loadDashboard();
  }, [userEmail]);

  async function loadDashboard() {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) console.error("Dashboard: failed to get current user —", authError.message);
    const userId = authData?.user?.id || null;

    const [
      { count: batches },
      { count: listings },
      { count: posts },
      { count: tasks },
      { data: taskData },
      { data: vaccineData },
      { data: batchData },
      { data: mortalityLogs },
      { data: expenseData, error: expenseError },
      { data: salesData, error: salesError },
      { data: financeRecords }
    ] = await Promise.all([
      supabase.from("farm_batches").select("*", { count: "exact", head: true })
        .eq("user_email", userEmail).eq("status", "active"),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("community_posts").select("*", { count: "exact", head: true }),
      supabase.from("farm_tasks").select("*", { count: "exact", head: true })
        .eq("user_email", userEmail).eq("completed", false),
      supabase.from("farm_tasks").select("*")
        .eq("user_email", userEmail).eq("completed", false)
        .order("due_date", { ascending: true }).limit(4),
      supabase.from("vaccination_tasks")
        .select("*, farm_batches(batch_name)")
        .eq("user_email", userEmail)
        .eq("completed", false)
        .lt("scheduled_date", today),
      supabase.from("farm_batches").select("*")
        .eq("user_email", userEmail),
      supabase.from("mortality_logs").select("*")
        .eq("user_email", userEmail),
      supabase.from("batch_expenses").select("*")
        .eq("user_id", userId),
      supabase.from("batch_sales").select("*")
        .eq("user_id", userId),
      supabase.from("farm_finances").select("*")
        .eq("user_email", userEmail)
    ]);

    if (expenseError) console.error("Dashboard: failed to load expenses —", expenseError.message);
    if (salesError) console.error("Dashboard: failed to load sales —", salesError.message);

    setOverdueVaccines(vaccineData || []);

    const mortality = (batchData || []).map(batch => {
      const logs = (mortalityLogs || []).filter(m => m.batch_id === batch.id);
      const totalDeaths = logs.reduce((s, m) => s + Number(m.count), 0);
      const aliveCount = batch.current_count || batch.quantity;
      const totalCount = batch.quantity;
      const survivalRate = totalCount > 0
        ? (((totalCount - totalDeaths) / totalCount) * 100).toFixed(1)
        : "100.0";
      return { batch_name: batch.batch_name, totalDeaths, aliveCount, survivalRate, totalCount };
    });
    setMortalityData(mortality);

    const income = (financeRecords || [])
      .filter(r => r.type === "income")
      .reduce((s, r) => s + Number(r.amount), 0);
    const expenses = (financeRecords || [])
      .filter(r => r.type === "expense")
      .reduce((s, r) => s + Number(r.amount), 0);
    setFinanceData({ totalIncome: income, totalExpenses: expenses, profit: income - expenses });

    const dayList = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      dayList.push(d);
    }

    const salesByDate = {};
    (salesData || []).forEach(sale => {
      if (!sale.sale_date) return;
      const key = String(sale.sale_date).split("T")[0];
      salesByDate[key] = (salesByDate[key] || 0) + Number(sale.total_amount || 0);
    });

    const expensesByDate = {};
    (expenseData || []).forEach(exp => {
      if (!exp.expense_date) return;
      const key = String(exp.expense_date).split("T")[0];
      expensesByDate[key] = (expensesByDate[key] || 0) + Number(exp.amount || 0);
    });

    const daily = dayList.map(d => {
      const key = d.toISOString().split("T")[0];
      const daySales = salesByDate[key] || 0;
      const dayExpenses = expensesByDate[key] || 0;
      return {
        date: key,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        sales: daySales,
        expenses: dayExpenses,
        profit: daySales - dayExpenses
      };
    });
    setDailyFinanceData(daily);

    const periodRevenue = daily.reduce((s, d) => s + d.sales, 0);
    const periodExpenses = daily.reduce((s, d) => s + d.expenses, 0);
    setPeriodTotals({
      revenue: periodRevenue,
      expenses: periodExpenses,
      profit: periodRevenue - periodExpenses
    });

    const deathsByDate = {};
    (mortalityLogs || []).forEach(log => {
      if (!log.date) return;
      const key = String(log.date).split("T")[0];
      deathsByDate[key] = (deathsByDate[key] || 0) + Number(log.count || 0);
    });

    const dailyDeaths = dayList.map(d => {
      const key = d.toISOString().split("T")[0];
      const deaths = deathsByDate[key] || 0;
      return {
        date: key,
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        deaths
      };
    });
    setDailyMortalityData(dailyDeaths);

    setStats({
      batches: batches || 0,
      vaccines: (vaccineData || []).length,
      listings: listings || 0,
      posts: posts || 0,
      tasks: tasks || 0
    });

    setRecentTasks(taskData || []);
    setLoading(false);
  }

  const statCards = [
    { title: "Active Batches", value: stats.batches, icon: Egg, color: "#edf9f1", iconColor: "#22c55e", path: "/my-farm" },
    { title: "Pending Vaccines", value: stats.vaccines, icon: Syringe, color: "#fff7e6", iconColor: "#f59e0b", path: "/my-farm" },
    { title: "Active Listings", value: stats.listings, icon: ShoppingBag, color: "#fff0eb", iconColor: "#f97316", path: "/marketplace" },
    { title: "Community Posts", value: stats.posts, icon: Users, color: "#edf5ff", iconColor: "#3b82f6", path: "/community" },
  ];

  const quickActions = [
    { icon: <ShoppingBag size={20} color="#f97316" />, label: "List Product", path: "/marketplace", bg: "#fff0eb" },
    { icon: <Egg size={20} color="#22c55e" />, label: "Add Batch", path: "/my-farm", bg: "#edf9f1" },
    { icon: <Users size={20} color="#3b82f6" />, label: "Community", path: "/community", bg: "#edf5ff" },
    { icon: <MessageCircle size={20} color="#8b5cf6" />, label: "Messages", path: "/community-chat", bg: "#f3f0ff" },
  ];

  const greetingHour = new Date().getHours();
  const greeting = greetingHour < 12 ? "Good morning"
    : greetingHour < 17 ? "Good afternoon" : "Good evening";

  const dailyMax = Math.max(
    ...dailyFinanceData.map(d => Math.max(d.sales, d.expenses)),
    1
  );
  const yAxisMax = Math.max(Math.ceil(dailyMax / 1500) * 1500, 1500);
  const yTicks = [];
  for (let t = 0; t <= yAxisMax; t += yAxisMax / 4) yTicks.push(Math.round(t));

  const survivalChartData = mortalityData.map(b => ({
    name: b.batch_name,
    survival: Number(b.survivalRate)
  }));

  const deathsMax = Math.max(...dailyMortalityData.map(d => d.deaths), 1);
  const deathsYMax = Math.max(Math.ceil(deathsMax / 4) * 4, 4);
  const deathsYTicks = [];
  for (let t = 0; t <= deathsYMax; t += deathsYMax / 4) deathsYTicks.push(Math.round(t));

  return (
    <div>

      {/* ── OVERDUE VACCINE ALERTS ── */}
      {overdueVaccines
        .filter(v => !dismissedAlerts.includes(v.id))
        .map(vaccine => (
          <div key={vaccine.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px", borderRadius: "12px",
            background: "#fef2f2", border: "1px solid #fecaca",
            marginBottom: "10px", gap: "12px", flexWrap: "wrap"
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1, minWidth: "220px" }}>
              <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <span style={{ fontSize: "var(--fs-body, 14px)", color: "#991b1b", fontWeight: "700" }}>
                  {overdueVaccines.filter(v => !dismissedAlerts.includes(v.id)).length} vaccination
                  {overdueVaccines.filter(v => !dismissedAlerts.includes(v.id)).length > 1 ? "s are" : " is"} overdue!{" "}
                </span>
                <span style={{ fontSize: "var(--fs-body, 14px)", color: "#7f1d1d" }}>
                  Go to your farm to mark them done.
                </span>
                <div style={{ fontSize: "var(--fs-small, 12px)", color: "#ef4444", marginTop: "2px" }}>
                  💉 {vaccine.vaccine_name}
                  {vaccine.farm_batches?.batch_name && ` — ${vaccine.farm_batches.batch_name}`}
                  {" "}· Due: {vaccine.scheduled_date}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button
                onClick={() => navigate("/my-farm")}
                style={{
                  padding: "6px 14px", background: "none",
                  border: "1px solid #fca5a5", borderRadius: "8px",
                  color: "#ef4444", fontWeight: "600", fontSize: "var(--fs-tiny, 12px)", cursor: "pointer"
                }}
              >
                View Farm
              </button>
              <button
                onClick={() => setDismissedAlerts(prev => [...prev, vaccine.id])}
                style={{
                  width: "28px", height: "28px", borderRadius: "6px",
                  border: "none", background: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}
              >
                <X size={16} color="#ef4444" />
              </button>
            </div>
          </div>
        ))}

      {/* ── HEADER ── */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: "28px",
        flexWrap: "wrap", gap: "16px"
      }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "var(--fs-display, 36px)", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
            Dashboard
          </h1>
          <p style={{ marginTop: "6px", color: "#6b7280", fontSize: "var(--fs-greeting, 16px)" }}>
            {greeting}, {profile?.full_name || "Farmer"} 👋 Welcome back to Farmers Connect
          </p>
        </div>
        <button
          onClick={() => navigate("/my-farm")}
          style={{
            height: "48px", padding: "0 22px", border: "none",
            borderRadius: "14px",
            background: "linear-gradient(135deg,#22c55e,#16a34a)",
            color: "white", fontWeight: "700", cursor: "pointer",
            fontSize: "var(--fs-btn, 14px)", boxShadow: "0 8px 24px rgba(34,197,94,0.3)",
            display: "flex", alignItems: "center", gap: "8px"
          }}
        >
          <Plus size={18} /> Add Batch
        </button>
      </div>

      {/* ── STAT CARDS ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
        gap: "18px", marginBottom: "24px"
      }}>
        {statCards.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.title}
              onClick={() => navigate(item.path)}
              style={{
                background: "white", borderRadius: "24px", padding: "22px",
                boxShadow: "0 4px 20px rgba(15,23,42,0.05)",
                border: "1px solid rgba(226,232,240,0.8)",
                cursor: "pointer", transition: "all 0.2s ease"
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow = "0 10px 30px rgba(15,23,42,0.1)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 20px rgba(15,23,42,0.05)";
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{
                  width: "64px", height: "64px", borderRadius: "20px",
                  background: item.color, display: "flex",
                  alignItems: "center", justifyContent: "center"
                }}>
                  <Icon size={28} color={item.iconColor} />
                </div>
                <ArrowUpRight size={18} color="#d1d5db" />
              </div>
              <div style={{ marginTop: "20px" }}>
                <div style={{ fontSize: "var(--fs-stat, 34px)", fontWeight: "800", color: "#111827" }}>
                  {loading ? "—" : item.value}
                </div>
                <div style={{ marginTop: "4px", color: "#6b7280", fontSize: "var(--fs-label, 14px)", fontWeight: "500" }}>
                  {item.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── MORTALITY & SURVIVAL ── */}
      {mortalityData.length > 0 && (
        <div style={{
          background: "#fff", borderRadius: "24px", padding: "24px",
          border: "1px solid rgba(226,232,240,0.8)",
          boxShadow: "0 4px 20px rgba(15,23,42,0.05)", marginBottom: "18px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
            <TrendingDown size={20} color="#ef4444" />
            <h2 style={{ margin: 0, fontSize: "var(--fs-section, 20px)", fontWeight: "700", color: "#111827" }}>
              Mortality & Survival
            </h2>
          </div>

          <p style={{
            fontSize: "var(--fs-upper, 11px)", color: "#9ca3af", fontWeight: "700",
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px"
          }}>
            BATCH SURVIVAL RATE
          </p>
          <div style={{ width: "100%", height: `${Math.max(survivalChartData.length * 60, 120)}px`, marginBottom: "28px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart
                data={survivalChartData}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 10, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} stroke="#f0f0f0" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={v => `${v}%`}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "#374151", fontWeight: 600 }}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  formatter={v => [`${v}%`, "Survival rate"]}
                  contentStyle={{ borderRadius: "10px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                />
                <Bar dataKey="survival" fill="#16a34a" radius={[0, 6, 6, 0]} barSize={22} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>

          <p style={{
            fontSize: "var(--fs-upper, 11px)", color: "#9ca3af", fontWeight: "700",
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "14px"
          }}>
            DAILY DEATHS (LAST 14 DAYS)
          </p>
          {dailyMortalityData.length === 0 || loading ? (
            <div style={{
              height: "220px", display: "flex", alignItems: "center",
              justifyContent: "center", color: "#9ca3af", fontSize: "var(--fs-small, 13px)"
            }}>
              {loading ? "Loading chart..." : "No mortality logged in the last 14 days."}
            </div>
          ) : (
            <div style={{ width: "100%", height: "220px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyMortalityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#f0f0f0" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={{ stroke: "#e5e7eb" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, deathsYMax]}
                    ticks={deathsYTicks}
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip content={<DailyDeathsTooltip />} />
                  <Bar dataKey="deaths" name="Deaths" fill="#f87171" radius={[3, 3, 0, 0]} barSize={14} />
                  <Line
                    dataKey="deaths"
                    name="Trend"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#ef4444", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── SALES & PROFIT (LAST 14 DAYS OVERVIEW) ── */}
      <div style={{
        background: "#fff", borderRadius: "24px", padding: "24px",
        border: "1px solid rgba(226,232,240,0.8)",
        boxShadow: "0 4px 20px rgba(15,23,42,0.05)", marginBottom: "18px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "#f0fdf4", display: "flex",
            alignItems: "center", justifyContent: "center"
          }}>
            <Wallet size={20} color="#16a34a" />
          </div>
          <h2 style={{ margin: 0, fontSize: "var(--fs-section, 20px)", fontWeight: "700", color: "#111827" }}>
            Sales & Profit
          </h2>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: "16px", marginBottom: "24px"
        }}>
          <div style={{
            background: "#f0fdf4", border: "1px solid #dcfce7",
            borderRadius: "16px", padding: "16px 18px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#16a34a" }}>
              <DollarSign size={16} />
              <span style={{ fontSize: "var(--fs-small, 13px)", fontWeight: "600" }}>Revenue</span>
            </div>
            <div style={{ marginTop: "6px", fontSize: "var(--fs-pill, 24px)", fontWeight: "800", color: "#16a34a" }}>
              KES {periodTotals.revenue.toLocaleString()}
            </div>
          </div>

          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca",
            borderRadius: "16px", padding: "16px 18px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#ef4444" }}>
              <TrendingDown size={16} />
              <span style={{ fontSize: "var(--fs-small, 13px)", fontWeight: "600" }}>Expenses</span>
            </div>
            <div style={{ marginTop: "6px", fontSize: "var(--fs-pill, 24px)", fontWeight: "800", color: "#ef4444" }}>
              KES {periodTotals.expenses.toLocaleString()}
            </div>
          </div>

          <div style={{
            background: periodTotals.profit >= 0 ? "#f0fdf4" : "#fef2f2",
            border: `1px solid ${periodTotals.profit >= 0 ? "#dcfce7" : "#fecaca"}`,
            borderRadius: "16px", padding: "16px 18px"
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: "6px",
              color: periodTotals.profit >= 0 ? "#16a34a" : "#ef4444"
            }}>
              <TrendingUp size={16} />
              <span style={{ fontSize: "var(--fs-small, 13px)", fontWeight: "600" }}>Profit</span>
            </div>
            <div style={{
              marginTop: "6px", fontSize: "var(--fs-pill, 24px)", fontWeight: "800",
              color: periodTotals.profit >= 0 ? "#16a34a" : "#ef4444"
            }}>
              KES {periodTotals.profit.toLocaleString()}
            </div>
          </div>
        </div>

        <p style={{
          fontSize: "var(--fs-upper, 11px)", fontWeight: "700", color: "#9ca3af",
          textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px"
        }}>
          LAST 14 DAYS
        </p>

        {dailyFinanceData.length === 0 || loading ? (
          <div style={{
            height: "260px", display: "flex", alignItems: "center",
            justifyContent: "center", color: "#9ca3af", fontSize: "var(--fs-small, 13px)"
          }}>
            {loading ? "Loading chart..." : "No activity in the last 14 days."}
          </div>
        ) : (
          <div style={{ width: "100%", height: "260px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyFinanceData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#f0f0f0" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={{ stroke: "#e5e7eb" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yAxisMax]}
                  ticks={yTicks}
                  tickFormatter={v => `$${v}`}
                  tick={{ fontSize: 11, fill: "#9ca3af" }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                />
                <Tooltip content={<DailyFinanceTooltip />} />
                <Bar dataKey="sales" name="Sales" fill="#22c55e" radius={[3, 3, 0, 0]} barSize={14} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[3, 3, 0, 0]} barSize={14} />
                <Line
                  dataKey="profit"
                  name="Profit"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={{ display: "flex", gap: "20px", marginTop: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "12px", height: "12px", background: "#22c55e", borderRadius: "2px" }} />
            <span style={{ fontSize: "var(--fs-tiny, 12px)", color: "#6b7280", fontWeight: "500" }}>Sales</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "12px", height: "12px", background: "#ef4444", borderRadius: "2px" }} />
            <span style={{ fontSize: "var(--fs-tiny, 12px)", color: "#6b7280", fontWeight: "500" }}>Expenses</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "16px", height: "2px", background: "#f97316" }} />
            <span style={{ fontSize: "var(--fs-tiny, 12px)", color: "#6b7280", fontWeight: "500" }}>Profit</span>
          </div>
        </div>
      </div>

      {/* ── CONTENT GRID ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 1fr",
        gap: "18px"
      }}
      className="fc-dashboard-grid"
      >

        {/* PENDING TASKS */}
        <div style={{
          background: "white", borderRadius: "28px", padding: "28px",
          minHeight: "300px", border: "1px solid rgba(226,232,240,0.8)",
          boxShadow: "0 4px 20px rgba(15,23,42,0.05)"
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "10px"
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "var(--fs-section, 20px)", fontWeight: "700", color: "#111827" }}>
                Pending Tasks
              </h2>
              <p style={{ marginTop: "4px", color: "#9ca3af", fontSize: "var(--fs-small, 13px)" }}>
                {stats.tasks} task{stats.tasks !== 1 ? "s" : ""} remaining
              </p>
            </div>
            <button
              onClick={() => navigate("/tasks")}
              style={{
                border: "none", background: "#f4f7fb", borderRadius: "12px",
                padding: "8px 16px", fontWeight: "600", cursor: "pointer",
                fontSize: "var(--fs-small, 13px)", color: "#374151"
              }}
            >
              View All
            </button>
          </div>

          {recentTasks.length === 0 ? (
            <div style={{
              height: "180px", display: "flex", flexDirection: "column",
              justifyContent: "center", alignItems: "center"
            }}>
              <CheckCircle2 size={56} color="#22c55e" />
              <h3 style={{ marginTop: "14px", marginBottom: "6px", fontSize: "var(--fs-h3, 16px)", color: "#111827" }}>
                All tasks completed!
              </h3>
              <p style={{ color: "#9ca3af", fontSize: "var(--fs-body, 14px)" }}>Your farm is fully up to date.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentTasks.map(task => (
                <div key={task.id} style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "12px 14px", borderRadius: "14px",
                  background: "#f9fafb", border: "1px solid #f0f0f0"
                }}>
                  <div style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    background: task.priority === "high" ? "#ef4444"
                      : task.priority === "medium" ? "#f59e0b" : "#22c55e",
                    flexShrink: 0
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: "600", fontSize: "var(--fs-body, 14px)", color: "#111827" }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: "var(--fs-tiny, 12px)", color: "#9ca3af", marginTop: "2px" }}>
                      Due: {task.due_date || "No due date"}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate("/tasks")}
                    style={{
                      padding: "4px 10px", borderRadius: "6px",
                      border: "1px solid #e5e7eb", background: "white",
                      fontSize: "var(--fs-tiny, 11px)", cursor: "pointer", fontWeight: "600", color: "#374151"
                    }}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>

          {/* QUICK ACTIONS */}
          <div style={{
            background: "white", borderRadius: "28px", padding: "24px",
            border: "1px solid rgba(226,232,240,0.8)",
            boxShadow: "0 4px 20px rgba(15,23,42,0.05)"
          }}>
            <h2 style={{ marginTop: 0, marginBottom: "18px", fontSize: "var(--fs-h3, 18px)", fontWeight: "700", color: "#111827" }}>
              Quick Actions
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {quickActions.map(({ icon, label, path, bg }) => (
                <button
                  key={label}
                  onClick={() => navigate(path)}
                  style={{
                    height: "80px", borderRadius: "18px",
                    border: "1px solid rgba(226,232,240,0.8)",
                    background: bg || "#fff",
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    gap: "8px", cursor: "pointer", transition: "all 0.2s"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {icon}
                  <span style={{ fontSize: "var(--fs-tiny, 12px)", fontWeight: "600", color: "#374151" }}>
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* OVERDUE VACCINATIONS */}
          {overdueVaccines.length > 0 && (
            <div style={{
              background: "#fff", borderRadius: "24px", padding: "20px",
              border: "1px solid rgba(226,232,240,0.8)",
              boxShadow: "0 4px 20px rgba(15,23,42,0.05)"
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "14px"
              }}>
                <h3 style={{ margin: 0, fontSize: "var(--fs-h3, 15px)", fontWeight: "700", color: "#111827" }}>
                  Overdue Vaccinations
                </h3>
                <button
                  onClick={() => navigate("/my-farm")}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: "var(--fs-tiny, 12px)", color: "#6b7280", fontWeight: "600"
                  }}
                >
                  View All
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {overdueVaccines.slice(0, 3).map(v => (
                  <div key={v.id} style={{
                    padding: "10px 12px", borderRadius: "10px",
                    background: "#fef2f2", border: "1px solid #fecaca",
                    display: "flex", alignItems: "center", gap: "10px"
                  }}>
                    <Syringe size={14} color="#ef4444" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "var(--fs-small, 13px)", fontWeight: "600", color: "#991b1b" }}>
                        {v.vaccine_name}
                      </p>
                      <p style={{ margin: 0, fontSize: "var(--fs-tiny, 11px)", color: "#ef4444" }}>
                        {v.farm_batches?.batch_name} · {v.scheduled_date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* UPCOMING VACCINATIONS (if no overdue) */}
          {overdueVaccines.length === 0 && (
            <div style={{
              background: "#fff", borderRadius: "24px", padding: "20px",
              border: "1px solid rgba(226,232,240,0.8)",
              boxShadow: "0 4px 20px rgba(15,23,42,0.05)"
            }}>
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "14px"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Syringe size={16} color="#22c55e" />
                  <h3 style={{ margin: 0, fontSize: "var(--fs-h3, 15px)", fontWeight: "700", color: "#111827" }}>
                    Upcoming Vaccinations
                  </h3>
                </div>
                <button
                  onClick={() => navigate("/my-farm")}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: "var(--fs-tiny, 12px)", color: "#6b7280", fontWeight: "600"
                  }}
                >
                  View All
                </button>
              </div>
              <div style={{
                textAlign: "center", padding: "20px",
                background: "#f0fdf4", borderRadius: "12px"
              }}>
                <CheckCircle2 size={32} color="#22c55e" style={{ marginBottom: "8px" }} />
                <p style={{ margin: 0, fontSize: "var(--fs-small, 13px)", color: "#16a34a", fontWeight: "600" }}>
                  All vaccinations up to date!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}