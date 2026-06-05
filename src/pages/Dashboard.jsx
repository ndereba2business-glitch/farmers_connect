import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabase } from "../lib/supabaseClient";
import UserGuideModal from "../components/UserGuideModal";
import {
  Egg, Syringe, ShoppingBag, Users,
  ArrowUpRight, Plus, MessageCircle,
  CheckCircle2, DollarSign, AlertTriangle, X
} from "lucide-react";

export default function Dashboard() {
  const { profile, userEmail } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({ batches: 0, vaccines: 0, listings: 0, posts: 0, tasks: 0, profit: 0 });
  const [recentTasks, setRecentTasks] = useState([]);
  const [overdueVaccines, setOverdueVaccines] = useState([]);
  const [batchCosts, setBatchCosts] = useState([]);
  const [mortalityData, setMortalityData] = useState([]);
  const [activeBatches, setActiveBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);

  useEffect(() => {
    async function loadDashboard() {
      if (!userEmail) return;
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];

      const [
        { count: batches },
        { count: listings },
        { count: posts },
        { count: tasks },
        { data: taskData },
        { data: vaccineData },
        { data: batchData },
        { data: mortalityLogs },
        { data: expenseData }
      ] = await Promise.all([
        supabase.from("farm_batches").select("*", { count: "exact", head: true }).eq("user_email", userEmail).eq("status", "active"),
        supabase.from("products").select("*", { count: "exact", head: true }),
        supabase.from("community_posts").select("*", { count: "exact", head: true }),
        supabase.from("farm_tasks").select("*", { count: "exact", head: true }).eq("user_email", userEmail).eq("completed", false),
        supabase.from("farm_tasks").select("*").eq("user_email", userEmail).eq("completed", false).order("due_date", { ascending: true }).limit(4),
        supabase.from("vaccination_tasks").select("*, farm_batches(batch_name)").eq("user_email", userEmail).eq("completed", false).lt("scheduled_date", today),
        supabase.from("farm_batches").select("*").eq("user_email", userEmail).eq("status", "active"),
        supabase.from("mortality_logs").select("*").eq("user_email", userEmail),
        supabase.from("batch_expenses").select("*").eq("user_email", userEmail)
      ]);

      // OVERDUE VACCINES
      setOverdueVaccines(vaccineData || []);

      // ACTIVE BATCHES
      setActiveBatches(batchData || []);

      // BATCH COST SUMMARY
      const costs = (batchData || []).map(batch => {
        const batchExpenses = (expenseData || []).filter(e => e.batch_id === batch.id);
        const total = batchExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
        const byCategory = {};
        batchExpenses.forEach(e => {
          byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
        });
        const aliveCount = batch.current_count || batch.quantity;
        return {
          batch_name: batch.batch_name,
          total,
          aliveCount,
          costPerBird: aliveCount > 0 ? (total / aliveCount).toFixed(2) : 0,
          byCategory
        };
      });
      setBatchCosts(costs);

      // MORTALITY DATA
      const mortalityByBatch = (batchData || []).map(batch => {
        const logs = (mortalityLogs || []).filter(m => m.batch_id === batch.id);
        const totalDeaths = logs.reduce((sum, m) => sum + Number(m.count), 0);
        const aliveCount = batch.current_count || batch.quantity;
        const totalCount = batch.quantity;
        const survivalRate = totalCount > 0 ? (((totalCount - totalDeaths) / totalCount) * 100).toFixed(1) : 100;
        return { batch_name: batch.batch_name, totalDeaths, aliveCount, survivalRate, totalCount };
      });
      setMortalityData(mortalityByBatch);

      // PENDING VACCINES COUNT
      const pendingVaccines = (vaccineData || []).length;

      setStats({
        batches: batches || 0,
        vaccines: pendingVaccines,
        listings: listings || 0,
        posts: posts || 0,
        tasks: tasks || 0,
        profit: 0
      });

      setRecentTasks(taskData || []);
      setLoading(false);
    }

    loadDashboard();
  }, [userEmail]);

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
  const greeting = greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";
  const totalBatchCost = batchCosts.reduce((sum, b) => sum + b.total, 0);

  return (
    <div>
      <UserGuideModal />

      {/* ======================== OVERDUE VACCINE ALERTS ======================== */}
      {overdueVaccines.filter(v => !dismissedAlerts.includes(v.id)).map(vaccine => (
        <div key={vaccine.id} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 16px", borderRadius: "12px",
          background: "#fef2f2", border: "1px solid #fecaca",
          marginBottom: "10px", gap: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", flex: 1 }}>
            <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <span style={{ fontSize: "14px", color: "#991b1b", fontWeight: "700" }}>
                Vaccination overdue!{" "}
              </span>
              <span style={{ fontSize: "14px", color: "#7f1d1d" }}>
                Go to your farm to mark it done.
              </span>
              <div style={{ fontSize: "12px", color: "#ef4444", marginTop: "2px" }}>
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
                color: "#ef4444", fontWeight: "600",
                fontSize: "12px", cursor: "pointer"
              }}
            >
              View Farm
            </button>
            <button
              onClick={() => setDismissedAlerts(prev => [...prev, vaccine.id])}
              style={{
                width: "28px", height: "28px", borderRadius: "6px",
                border: "none", background: "none",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center"
              }}
            >
              <X size={16} color="#ef4444" />
            </button>
          </div>
        </div>
      ))}

      {/* ======================== HEADER ======================== */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "36px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
            Dashboard
          </h1>
          <p style={{ marginTop: "6px", color: "#6b7280", fontSize: "16px" }}>
            {greeting}, {profile?.full_name || "Farmer"} 👋 Welcome back to Farmers Connect
          </p>
        </div>
        <button
          onClick={() => navigate("/my-farm")}
          style={{
            height: "48px", padding: "0 22px", border: "none",
            borderRadius: "14px",
            background: "linear-gradient(135deg,#22c55e,#16a34a)",
            color: "white", fontWeight: "700", cursor: "pointer", fontSize: "14px",
            boxShadow: "0 8px 24px rgba(34,197,94,0.3)",
            display: "flex", alignItems: "center", gap: "8px"
          }}
        >
          <Plus size={18} /> Add Batch
        </button>
      </div>

      {/* ======================== STAT CARDS ======================== */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "18px", marginBottom: "24px" }}>
        {statCards.map((item) => {
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
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 10px 30px rgba(15,23,42,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(15,23,42,0.05)"; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: item.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={28} color={item.iconColor} />
                </div>
                <ArrowUpRight size={18} color="#d1d5db" />
              </div>
              <div style={{ marginTop: "20px" }}>
                <div style={{ fontSize: "34px", fontWeight: "800", color: "#111827" }}>
                  {loading ? "—" : item.value}
                </div>
                <div style={{ marginTop: "4px", color: "#6b7280", fontSize: "14px", fontWeight: "500" }}>
                  {item.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ======================== MORTALITY & SURVIVAL ======================== */}
      {mortalityData.length > 0 && (
        <div style={{
          background: "#fff", borderRadius: "24px", padding: "24px",
          border: "1px solid rgba(226,232,240,0.8)",
          boxShadow: "0 4px 20px rgba(15,23,42,0.05)", marginBottom: "18px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
            <span style={{ fontSize: "18px" }}>📉</span>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>
              Mortality & Survival
            </h2>
          </div>

          <p style={{ fontSize: "12px", color: "#9ca3af", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
            BATCH SURVIVAL RATE
          </p>

          {mortalityData.map((batch, i) => (
            <div key={i} style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "13px", color: "#374151", fontWeight: "600" }}>{batch.batch_name}</span>
                <span style={{ fontSize: "13px", color: "#22c55e", fontWeight: "700" }}>{batch.survivalRate}%</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ flex: 1, height: "12px", background: "#f3f4f6", borderRadius: "20px", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${batch.survivalRate}%`,
                    background: Number(batch.survivalRate) > 90
                      ? "linear-gradient(135deg,#22c55e,#16a34a)"
                      : Number(batch.survivalRate) > 75
                      ? "linear-gradient(135deg,#f59e0b,#d97706)"
                      : "linear-gradient(135deg,#ef4444,#dc2626)",
                    borderRadius: "20px", transition: "width 0.5s ease"
                  }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "6px" }}>
                <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                  {batch.aliveCount} alive
                </span>
                {batch.totalDeaths > 0 && (
                  <span style={{ fontSize: "12px", color: "#ef4444" }}>
                    {batch.totalDeaths} deaths
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ======================== BATCH COST SUMMARY ======================== */}
      {batchCosts.length > 0 && (
        <div style={{
          background: "#fff", borderRadius: "24px", padding: "24px",
          border: "1px solid rgba(226,232,240,0.8)",
          boxShadow: "0 4px 20px rgba(15,23,42,0.05)", marginBottom: "18px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "18px" }}>📊</span>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "700", color: "#111827" }}>
                Batch Cost Summary
              </h2>
            </div>
            <button
              onClick={() => navigate("/my-farm")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "13px", color: "#6b7280", fontWeight: "600"
              }}
            >
              View Farm
            </button>
          </div>

          {batchCosts.map((batch, i) => (
            <div key={i} style={{
              padding: "16px", borderRadius: "14px",
              border: "1px solid #f0f0f0", background: "#fafafa",
              marginBottom: "12px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                <div>
                  <p style={{ margin: 0, fontWeight: "700", fontSize: "15px", color: "#111827" }}>
                    {batch.batch_name}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#9ca3af" }}>
                    {batch.aliveCount} birds
                  </p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ margin: 0, fontWeight: "800", fontSize: "18px", color: "#111827" }}>
                    KES {batch.total.toLocaleString()}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#22c55e", fontWeight: "600" }}>
                    KES {batch.costPerBird}/bird
                  </p>
                </div>
              </div>

              {/* COST BAR */}
              {Object.keys(batch.byCategory).length > 0 && (
                <div>
                  <div style={{ height: "8px", borderRadius: "20px", overflow: "hidden", display: "flex", marginBottom: "8px" }}>
                    {Object.entries(batch.byCategory).map(([cat, amt], idx) => {
                      const pct = batch.total > 0 ? (amt / batch.total) * 100 : 0;
                      const colors = ["#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4", "#84cc16"];
                      return (
                        <div key={cat} style={{
                          width: `${pct}%`, background: colors[idx % colors.length],
                          height: "100%"
                        }} />
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {Object.entries(batch.byCategory).map(([cat, amt], idx) => {
                      const colors = ["#f59e0b", "#22c55e", "#3b82f6", "#ef4444", "#8b5cf6", "#f97316", "#06b6d4", "#84cc16"];
                      return (
                        <span key={cat} style={{
                          fontSize: "11px", fontWeight: "600",
                          padding: "3px 8px", borderRadius: "20px",
                          background: colors[idx % colors.length] + "20",
                          color: colors[idx % colors.length]
                        }}>
                          {cat}: KES {Number(amt).toLocaleString()}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {batch.total === 0 && (
                <p style={{ margin: 0, fontSize: "13px", color: "#9ca3af" }}>
                  No expenses logged yet. Log expenses in My Farm to see cost analysis.
                </p>
              )}
            </div>
          ))}

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "14px 16px", background: "#f9fafb",
            borderRadius: "12px", borderTop: "none"
          }}>
            <span style={{ fontSize: "14px", color: "#6b7280" }}>Total across all active batches</span>
            <span style={{ fontSize: "20px", fontWeight: "800", color: "#111827" }}>
              KES {totalBatchCost.toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* ======================== CONTENT GRID ======================== */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "18px" }}>

        {/* PENDING TASKS */}
        <div style={{
          background: "white", borderRadius: "28px", padding: "28px",
          minHeight: "300px", border: "1px solid rgba(226,232,240,0.8)",
          boxShadow: "0 4px 20px rgba(15,23,42,0.05)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "700", color: "#111827" }}>Pending Tasks</h2>
              <p style={{ marginTop: "4px", color: "#9ca3af", fontSize: "13px" }}>
                {stats.tasks} task{stats.tasks !== 1 ? "s" : ""} remaining
              </p>
            </div>
            <button
              onClick={() => navigate("/tasks")}
              style={{
                border: "none", background: "#f4f7fb", borderRadius: "12px",
                padding: "8px 16px", fontWeight: "600", cursor: "pointer",
                fontSize: "13px", color: "#374151"
              }}
            >
              View All
            </button>
          </div>

          {recentTasks.length === 0 ? (
            <div style={{ height: "180px", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
              <CheckCircle2 size={56} color="#22c55e" />
              <h3 style={{ marginTop: "14px", marginBottom: "6px", fontSize: "16px", color: "#111827" }}>All tasks completed!</h3>
              <p style={{ color: "#9ca3af", fontSize: "14px" }}>Your farm is fully up to date.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {recentTasks.map((task) => (
                <div key={task.id} style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "12px 14px", borderRadius: "14px",
                  background: "#f9fafb", border: "1px solid #f0f0f0"
                }}>
                  <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#22c55e", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: "600", fontSize: "14px", color: "#111827" }}>{task.title}</div>
                    <div style={{ fontSize: "12px", color: "#9ca3af", marginTop: "2px" }}>Due: {task.due_date}</div>
                  </div>
                  <button
                    onClick={() => navigate("/tasks")}
                    style={{
                      padding: "4px 10px", borderRadius: "6px",
                      border: "1px solid #e5e7eb", background: "white",
                      fontSize: "11px", cursor: "pointer", fontWeight: "600", color: "#374151"
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
            <h2 style={{ marginTop: 0, marginBottom: "18px", fontSize: "18px", fontWeight: "700", color: "#111827" }}>
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
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  {icon}
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#374151" }}>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* UPCOMING VACCINATIONS */}
          {overdueVaccines.length > 0 && (
            <div style={{
              background: "#fff", borderRadius: "24px", padding: "20px",
              border: "1px solid rgba(226,232,240,0.8)",
              boxShadow: "0 4px 20px rgba(15,23,42,0.05)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#111827" }}>
                  Overdue Vaccinations
                </h3>
                <button
                  onClick={() => navigate("/my-farm")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#6b7280", fontWeight: "600" }}
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
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "#991b1b" }}>{v.vaccine_name}</p>
                      <p style={{ margin: 0, fontSize: "11px", color: "#ef4444" }}>
                        {v.farm_batches?.batch_name} · {v.scheduled_date}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}