import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import "./Dashboard.css";
import {
  Egg, Syringe, ShoppingBag, Users,
  Plus, Stethoscope, CheckCircle2,
  AlertTriangle, X, TrendingUp, TrendingDown
} from "lucide-react";
import {
  ComposedChart, BarChart as RechartsBarChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";


function DailyFinanceTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{
      background: "var(--fc-surface)", borderRadius: "12px", padding: "10px 14px",
      border: "1px solid var(--fc-line-gray200)", boxShadow: "0 6px 20px rgba(15,23,42,0.12)"
    }}>
      <p style={{ margin: 0, fontSize: "var(--fs-small, 12px)", fontWeight: "700", color: "var(--fc-fg-gray900)" }}>{label}</p>
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
      background: "var(--fc-surface)", borderRadius: "12px", padding: "10px 14px",
      border: "1px solid var(--fc-line-gray200)", boxShadow: "0 6px 20px rgba(15,23,42,0.12)"
    }}>
      <p style={{ margin: 0, fontSize: "var(--fs-small, 13px)", fontWeight: "700", color: "var(--fc-fg-gray801)" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "4px 0 0", fontSize: "var(--fs-small, 12px)", color: "var(--fc-fg-red500)", fontWeight: "600" }}>
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
      { data: salesData, error: salesError }
    ] = await Promise.all([
      supabase.from("farm_batches").select("*", { count: "exact", head: true })
        .eq("user_email", userEmail).eq("status", "active"),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("community_chat").select("id", { count: "exact", head: true }).is("removed_at", null),
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
        .eq("user_id", userId)
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
    { title: "Active batches", value: stats.batches, icon: Egg, path: "/my-farm" },
    { title: "Vaccines due", value: stats.vaccines, icon: Syringe, path: "/my-farm" },
    { title: "Marketplace listings", value: stats.listings, icon: ShoppingBag, path: "/marketplace" },
    { title: "Community messages", value: stats.posts, icon: Users, path: "/community" },
  ];

  const quickActions = [
    { icon: Egg, label: "Add a batch", path: "/my-farm" },
    { icon: Stethoscope, label: "Ask a vet", path: "/bookings" },
    { icon: ShoppingBag, label: "Marketplace", path: "/marketplace" },
    { icon: Users, label: "Community", path: "/community" },
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
            background: "var(--fc-bg-red50)", border: "1px solid var(--fc-line-red200)",
            marginBottom: "10px", gap: "12px", flexWrap: "wrap"
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1, minWidth: "220px" }}>
              <AlertTriangle size={18} color="var(--fc-fg-red700)" aria-hidden="true" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <span style={{ fontSize: "var(--fs-body, 14px)", color: "var(--fc-fg-red800)", fontWeight: "700" }}>
                  {overdueVaccines.filter(v => !dismissedAlerts.includes(v.id)).length} vaccination
                  {overdueVaccines.filter(v => !dismissedAlerts.includes(v.id)).length > 1 ? "s are" : " is"} overdue.{" "}
                </span>
                <span style={{ fontSize: "var(--fs-body, 14px)", color: "var(--fc-fg-red900)" }}>
                  Go to your farm to mark them done.
                </span>
                <div style={{ fontSize: "var(--fs-small, 12px)", color: "var(--fc-fg-red800)", marginTop: "2px" }}>
                  <Syringe size={14} aria-hidden="true" /> {vaccine.vaccine_name}
                  {vaccine.farm_batches?.batch_name && ` — ${vaccine.farm_batches.batch_name}`}
                  {" "}· Due: {vaccine.scheduled_date}
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button
                onClick={() => navigate("/my-farm")}
                className="fc-tap"
                style={{
                  padding: "6px 14px", background: "var(--fc-bg-gray0)",
                  border: "1px solid var(--fc-line-red200)", borderRadius: "8px",
                  color: "var(--fc-fg-red700)", fontWeight: "600", fontSize: "13px", cursor: "pointer"
                }}
              >
                View Farm
              </button>
              <button
                onClick={() => setDismissedAlerts(prev => [...prev, vaccine.id])}
                aria-label="Dismiss this reminder"
                className="fc-tap"
                style={{
                  width: "28px", height: "28px", borderRadius: "8px",
                  border: "none", background: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center"
                }}
              >
                <X size={16} color="var(--fc-fg-red700)" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}

      {/* ── HEADER ── */}
      <div className="db-head">
        <div>
          <h1 className="fc-page-title">Dashboard</h1>
          <p className="fc-page-sub">{greeting}, {profile?.full_name || "Farmer"}</p>
        </div>
        <button type="button" className="fc-btn fc-btn--primary" onClick={() => navigate("/my-farm")}>
          <Plus size={18} aria-hidden="true" /> Add Batch
        </button>
      </div>

      {/* ── FIGURES ── */}
      <div className="fc-stats db-block">
        {statCards.map(item => {
          const Icon = item.icon;
          return (
            <button key={item.title} type="button" className="fc-stat" onClick={() => navigate(item.path)}>
              <span className="fc-stat-label"><Icon size={16} aria-hidden="true" /> {item.title}</span>
              <span className="fc-stat-value">{loading ? "—" : item.value}</span>
            </button>
          );
        })}
      </div>

      {/* ── MORTALITY & SURVIVAL ── */}
      {mortalityData.length > 0 && (
        <div className="fc-card db-block">
          <h2 className="db-section-title">Mortality and survival</h2>

          <p className="db-kicker">Survival rate by batch</p>
          <div style={{ width: "100%", height: `${Math.max(survivalChartData.length * 60, 120)}px`, marginBottom: "28px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsBarChart
                data={survivalChartData}
                layout="vertical"
                margin={{ top: 4, right: 20, left: 10, bottom: 4 }}
              >
                <CartesianGrid horizontal={false} stroke="var(--fc-line-gray101)" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                  tickFormatter={v => `${v}%`}
                  tick={{ fontSize: 11, fill: "var(--fc-fg-gray400)" }}
                  axisLine={{ stroke: "var(--fc-line-gray200)" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: "var(--fc-fg-gray700)", fontWeight: 600 }}
                  axisLine={{ stroke: "var(--fc-line-gray200)" }}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  formatter={v => [`${v}%`, "Survival rate"]}
                  contentStyle={{ borderRadius: "12px", border: "1px solid var(--fc-line-gray200)", fontSize: "12px" }}
                />
                <Bar dataKey="survival" fill="var(--fc-fg-green700)" radius={[0, 6, 6, 0]} barSize={22} />
              </RechartsBarChart>
            </ResponsiveContainer>
          </div>

          <p className="db-kicker">Deaths per day, last 14 days</p>
          {dailyMortalityData.length === 0 || loading ? (
            <div style={{
              height: "220px", display: "flex", alignItems: "center",
              justifyContent: "center", color: "var(--fc-fg-gray400)", fontSize: "var(--fs-small, 13px)"
            }}>
              {loading ? "Loading chart..." : "No mortality logged in the last 14 days."}
            </div>
          ) : (
            <div style={{ width: "100%", height: "220px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyMortalityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="var(--fc-line-gray101)" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "var(--fc-fg-gray400)" }}
                    axisLine={{ stroke: "var(--fc-line-gray200)" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, deathsYMax]}
                    ticks={deathsYTicks}
                    tick={{ fontSize: 11, fill: "var(--fc-fg-gray400)" }}
                    axisLine={false}
                    tickLine={false}
                    width={30}
                  />
                  <Tooltip content={<DailyDeathsTooltip />} />
                  <Bar dataKey="deaths" name="Deaths" fill="var(--fc-bg-red300)" radius={[3, 3, 0, 0]} barSize={14} />
                  <Line
                    dataKey="deaths"
                    name="Trend"
                    stroke="var(--fc-fg-red700)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--fc-fg-red700)", strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── SALES & PROFIT (LAST 14 DAYS OVERVIEW) ── */}
      <div className="fc-card db-block">
        <h2 className="db-section-title">Sales and profit</h2>

        <div className="fc-stats db-money">
          <div className="fc-stat fc-stat--static">
            <span className="fc-stat-label">Revenue</span>
            <span className="fc-stat-value">KES {periodTotals.revenue.toLocaleString()}</span>
          </div>
          <div className="fc-stat fc-stat--static">
            <span className="fc-stat-label">Expenses</span>
            <span className="fc-stat-value">KES {periodTotals.expenses.toLocaleString()}</span>
          </div>
          <div className={`fc-stat fc-stat--static${periodTotals.profit < 0 ? " fc-stat--danger" : ""}`}>
            <span className="fc-stat-label">
              {periodTotals.profit < 0 ? <TrendingDown size={16} aria-hidden="true" /> : <TrendingUp size={16} aria-hidden="true" />}
              {periodTotals.profit < 0 ? "Loss" : "Profit"}
            </span>
            <span className="fc-stat-value">KES {Math.abs(periodTotals.profit).toLocaleString()}</span>
          </div>
        </div>

        <p className="db-kicker">Per day, last 14 days (KES)</p>

        {dailyFinanceData.length === 0 || loading ? (
          <div style={{
            height: "260px", display: "flex", alignItems: "center",
            justifyContent: "center", color: "var(--fc-fg-gray400)", fontSize: "var(--fs-small, 13px)"
          }}>
            {loading ? "Loading chart..." : "No activity in the last 14 days."}
          </div>
        ) : (
          <div style={{ width: "100%", height: "260px" }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dailyFinanceData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--fc-line-gray101)" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: "var(--fc-fg-gray400)" }}
                  axisLine={{ stroke: "var(--fc-line-gray200)" }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, yAxisMax]}
                  ticks={yTicks}
                  tickFormatter={v => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : v)}
                  tick={{ fontSize: 11, fill: "var(--fc-fg-gray400)" }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip content={<DailyFinanceTooltip />} />
                <Bar dataKey="sales" name="Sales" fill="var(--fc-fg-green700)" radius={[3, 3, 0, 0]} barSize={14} />
                <Bar dataKey="expenses" name="Expenses" fill="var(--fc-fg-gray400)" radius={[3, 3, 0, 0]} barSize={14} />
                <Line
                  dataKey="profit"
                  name="Profit"
                  stroke="var(--fc-fg-gray900)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--fc-fg-gray900)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}

        <div style={{ display: "flex", gap: "20px", marginTop: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "12px", height: "12px", background: "#15803d", borderRadius: "2px" }} />
            <span style={{ fontSize: "var(--fs-tiny, 12px)", color: "var(--fc-fg-gray500)", fontWeight: "500" }}>Sales</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "12px", height: "12px", background: "var(--fc-bg-gray400)", borderRadius: "2px" }} />
            <span style={{ fontSize: "var(--fs-tiny, 12px)", color: "var(--fc-fg-gray500)", fontWeight: "500" }}>Expenses</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "16px", height: "2px", background: "var(--fc-bg-gray900)" }} />
            <span style={{ fontSize: "var(--fs-tiny, 12px)", color: "var(--fc-fg-gray500)", fontWeight: "500" }}>Profit</span>
          </div>
        </div>
      </div>

      {/* ── CONTENT GRID ──
          Columns live in Dashboard.css: an inline gridTemplateColumns
          here would override its single-column rule for phones. */}
      <div className="fc-dashboard-grid">

        {/* PENDING TASKS */}
        <div className="fc-card">
          <div className="db-card-head">
            <div>
              <h2 className="db-section-title" style={{ marginBottom: 0 }}>Tasks to do</h2>
              <p className="fc-page-sub" style={{ fontSize: "13px" }}>
                {stats.tasks} task{stats.tasks !== 1 ? "s" : ""} remaining
              </p>
            </div>
            <button type="button" className="fc-btn fc-btn--secondary" onClick={() => navigate("/tasks")}>
              View all
            </button>
          </div>

          {recentTasks.length === 0 ? (
            <div style={{
              padding: "28px 8px", display: "flex", flexDirection: "column",
              justifyContent: "center", alignItems: "center", textAlign: "center"
            }}>
              <CheckCircle2 size={24} color="var(--fc-fg-green700)" aria-hidden="true" />
              <h3 style={{ marginTop: "10px", marginBottom: "4px", fontSize: "15px", fontWeight: "600", color: "var(--fc-fg-gray900)" }}>
                No tasks waiting
              </h3>
              <p style={{ margin: 0, color: "var(--fc-fg-gray500)", fontSize: "14px" }}>Add one from the Tasks page when something needs doing.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentTasks.map(task => (
                <div key={task.id} style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "10px 0", borderTop: "1px solid var(--fc-line-gray100)"
                }}>
                  <div style={{
                    width: "8px", height: "8px", borderRadius: "50%",
                    background: task.priority === "high" ? "#ef4444"
                      : task.priority === "medium" ? "#f59e0b" : "var(--fc-bg-gray400)",
                    flexShrink: 0
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: "600", fontSize: "var(--fs-body, 14px)", color: "var(--fc-fg-gray900)" }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--fc-fg-gray500)", marginTop: "2px" }}>
                      {task.due_date ? `Due ${task.due_date}` : "No due date"}
                    </div>
                  </div>
                  <button
                    onClick={() => navigate("/tasks")}
                    className="fc-tap"
                    style={{
                      padding: "4px 12px", borderRadius: "8px",
                      border: "1px solid var(--fc-line-gray200)", background: "var(--fc-surface)",
                      fontSize: "13px", cursor: "pointer", fontWeight: "600", color: "var(--fc-fg-gray700)"
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
          <div className="fc-card">
            <h2 className="db-card-title">Quick actions</h2>
            <div className="fc-quick">
              {quickActions.map(({ icon: Icon, label, path }) => (
                <button key={label} type="button" className="fc-quick-btn" onClick={() => navigate(path)}>
                  <Icon size={20} aria-hidden="true" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* OVERDUE VACCINATIONS */}
          {overdueVaccines.length > 0 && (
            <div className="fc-card">
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "14px"
              }}>
                <h2 className="db-card-title" style={{ margin: 0 }}>Overdue vaccinations</h2>
                <button
                  onClick={() => navigate("/my-farm")}
                  className="fc-tap"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: "13px", color: "var(--fc-fg-green700)", fontWeight: "600"
                  }}
                >
                  View all
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {overdueVaccines.slice(0, 3).map(v => (
                  <div key={v.id} style={{
                    padding: "10px 12px", borderRadius: "12px",
                    background: "var(--fc-bg-red50)", border: "1px solid var(--fc-line-red200)",
                    display: "flex", alignItems: "center", gap: "10px"
                  }}>
                    <Syringe size={16} color="var(--fc-fg-red700)" aria-hidden="true" />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: "var(--fs-small, 13px)", fontWeight: "600", color: "var(--fc-fg-red800)" }}>
                        {v.vaccine_name}
                      </p>
                      <p style={{ margin: 0, fontSize: "12px", color: "var(--fc-fg-red800)" }}>
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
            <div className="fc-card">
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "14px"
              }}>
                <h2 className="db-card-title" style={{ margin: 0 }}>Vaccinations</h2>
                <button
                  onClick={() => navigate("/my-farm")}
                  className="fc-tap"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: "13px", color: "var(--fc-fg-green700)", fontWeight: "600"
                  }}
                >
                  View all
                </button>
              </div>
              <p style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--fc-fg-gray700)" }}>
                <CheckCircle2 size={18} color="var(--fc-fg-green700)" aria-hidden="true" /> Nothing overdue. All vaccinations are up to date.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}