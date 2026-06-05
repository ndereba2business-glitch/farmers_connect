import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { createNotification } from "../lib/notifications";
import { CheckSquare, Plus, Trash2, Clock, X } from "lucide-react";

const PRIORITIES = [
  { value: "high", label: "High", color: "#ef4444", bg: "#fef2f2" },
  { value: "medium", label: "Medium", color: "#f59e0b", bg: "#fffbeb" },
  { value: "low", label: "Low", color: "#22c55e", bg: "#f0fdf4" },
];

const CATEGORIES = [
  { value: "Feeding", emoji: "🌾" },
  { value: "Health", emoji: "💊" },
  { value: "Cleaning", emoji: "🧹" },
  { value: "Vaccination", emoji: "💉" },
  { value: "Equipment", emoji: "🔧" },
  { value: "Vet Visit", emoji: "🩺" },
  { value: "Other", emoji: "📋" },
];

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "#fff"
};

const labelStyle = {
  display: "block", fontSize: "12px", fontWeight: "600",
  color: "#6b7280", marginBottom: "5px", textTransform: "uppercase",
  letterSpacing: "0.05em"
};

export default function Tasks() {
  const { userEmail } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "", due_date: "", priority: "medium",
    category: "Other", description: ""
  });

  async function fetchTasks() {
    if (!userEmail) return;
    const { data } = await supabase
      .from("farm_tasks")
      .select("*")
      .eq("user_email", userEmail)
      .order("due_date", { ascending: true });
    setTasks(data || []);
  }

  useEffect(() => { fetchTasks(); }, [userEmail]);

  async function addTask() {
    if (!form.title) return;
    await supabase.from("farm_tasks").insert([{
      user_email: userEmail,
      title: form.title,
      description: form.description,
      due_date: form.due_date || null,
      priority: form.priority,
      category: form.category,
      completed: false
    }]);

    await createNotification({
      userEmail,
      type: "task",
      title: "New Task Added ✅",
      message: `"${form.title}" has been added to your farm tasks.`,
      link: "/tasks"
    });

    setForm({ title: "", due_date: "", priority: "medium", category: "Other", description: "" });
    setShowForm(false);
    fetchTasks();
  }

  async function toggleTask(task) {
    const completed = !task.completed;
    await supabase.from("farm_tasks").update({ completed }).eq("id", task.id);
    if (completed) {
      await createNotification({
        userEmail, type: "task",
        title: "Task Completed ✅",
        message: `You completed "${task.title}". Great work!`,
        link: "/tasks"
      });
    }
    fetchTasks();
  }

  async function deleteTask(id) {
    await supabase.from("farm_tasks").delete().eq("id", id);
    fetchTasks();
  }

  const today = new Date().toISOString().split("T")[0];
  const pending = tasks.filter(t => !t.completed);
  const overdue = tasks.filter(t => !t.completed && t.due_date && t.due_date < today);
  const dueToday = tasks.filter(t => !t.completed && t.due_date === today);
  const completed = tasks.filter(t => t.completed);

  const displayTasks = activeTab === "pending" ? pending
    : activeTab === "completed" ? completed
    : tasks;

  function getPriority(value) {
    return PRIORITIES.find(p => p.value === value) || PRIORITIES[1];
  }

  function getCategoryEmoji(cat) {
    return CATEGORIES.find(c => c.value === cat)?.emoji || "📋";
  }

  return (
    <div style={{ maxWidth: "800px" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <CheckSquare size={28} color="#22c55e" />
          <div>
            <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
              Farm Tasks
            </h1>
            <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
              Track daily and upcoming farm tasks.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            height: "44px", padding: "0 20px", border: "none",
            borderRadius: "12px",
            background: "linear-gradient(135deg,#22c55e,#16a34a)",
            color: "white", fontWeight: "700", cursor: "pointer",
            fontSize: "14px", display: "flex", alignItems: "center",
            gap: "8px", boxShadow: "0 6px 20px rgba(34,197,94,0.3)"
          }}
        >
          <Plus size={18} /> Add Task
        </button>
      </div>

      {/* STAT CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Pending", value: pending.length, color: "#22c55e" },
          { label: "Overdue", value: overdue.length, color: "#ef4444" },
          { label: "Due Today", value: dueToday.length, color: "#f59e0b" },
        ].map(item => (
          <div key={item.label} style={{
            background: "#fff", borderRadius: "16px",
            border: "1px solid #e5e7eb", padding: "20px",
            textAlign: "center",
            boxShadow: "0 2px 10px rgba(0,0,0,0.04)"
          }}>
            <div style={{ fontSize: "32px", fontWeight: "800", color: item.color }}>
              {item.value}
            </div>
            <div style={{ fontSize: "13px", color: "#6b7280", marginTop: "4px", fontWeight: "500" }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* ADD TASK FORM */}
      {showForm && (
        <div style={{
          background: "#fff", borderRadius: "16px",
          border: "1px solid #e5e7eb", padding: "20px",
          marginBottom: "20px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)"
        }}>
          <input
            placeholder="What needs to be done?"
            value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            style={{ ...inputStyle, marginBottom: "14px", fontSize: "15px" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
            <div>
              <label style={labelStyle}>Due Date (optional)</label>
              <input
                type="date" value={form.due_date}
                onChange={e => setForm({ ...form, due_date: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm({ ...form, priority: e.target.value })}
                style={{ ...inputStyle, appearance: "none" }}
              >
                {PRIORITIES.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>Category</label>
              <select
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
                style={{ ...inputStyle, appearance: "none" }}
              >
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.value}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Notes</label>
              <input
                placeholder="Optional notes"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={addTask}
              style={{
                flex: 1, padding: "12px",
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                color: "#fff", border: "none", borderRadius: "10px",
                fontWeight: "700", fontSize: "14px", cursor: "pointer"
              }}
            >
              Add Task
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: "12px 20px", background: "#f9fafb",
                border: "1px solid #e5e7eb", borderRadius: "10px",
                cursor: "pointer", fontWeight: "600", fontSize: "14px", color: "#374151"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{
        display: "flex", background: "#f3f4f6",
        borderRadius: "12px", padding: "4px",
        marginBottom: "16px"
      }}>
        {[
          { key: "pending", label: "Pending" },
          { key: "completed", label: "Completed" },
          { key: "all", label: "All" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: "9px",
              borderRadius: "9px", border: "none",
              cursor: "pointer", fontWeight: "600", fontSize: "13px",
              background: activeTab === tab.key ? "#fff" : "transparent",
              color: activeTab === tab.key ? "#111827" : "#9ca3af",
              boxShadow: activeTab === tab.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
              transition: "all 0.2s"
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TASK LIST */}
      <div style={{
        background: "#fff", borderRadius: "16px",
        border: "1px solid #e5e7eb",
        overflow: "hidden"
      }}>
        {displayTasks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <CheckSquare size={40} color="#e5e7eb" style={{ marginBottom: "12px" }} />
            <p style={{ color: "#9ca3af", fontSize: "15px" }}>
              {activeTab === "completed" ? "No completed tasks yet." : "No tasks here. Add one above!"}
            </p>
          </div>
        ) : (
          displayTasks.map((task, i) => {
            const priority = getPriority(task.priority);
            const isOverdue = !task.completed && task.due_date && task.due_date < today;
            const isDueToday = task.due_date === today;

            return (
              <div
                key={task.id}
                style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "16px 20px",
                  borderBottom: i < displayTasks.length - 1 ? "1px solid #f3f4f6" : "none",
                  background: isOverdue ? "#fef9f9" : "#fff"
                }}
              >
                {/* CHECKBOX */}
                <button
                  onClick={() => toggleTask(task)}
                  style={{
                    width: "22px", height: "22px", borderRadius: "50%",
                    border: `2px solid ${task.completed ? "#22c55e" : "#d1d5db"}`,
                    background: task.completed ? "#22c55e" : "#fff",
                    cursor: "pointer", flexShrink: 0, display: "flex",
                    alignItems: "center", justifyContent: "center"
                  }}
                >
                  {task.completed && (
                    <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
                      <path d="M1 4L4.5 7.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </button>

                {/* EMOJI */}
                <span style={{ fontSize: "18px", flexShrink: 0 }}>
                  {getCategoryEmoji(task.category)}
                </span>

                {/* TASK INFO */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: "600", fontSize: "14px",
                    color: task.completed ? "#9ca3af" : "#111827",
                    textDecoration: task.completed ? "line-through" : "none",
                    marginBottom: "4px"
                  }}>
                    {task.title}
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: "11px", fontWeight: "700",
                      padding: "2px 8px", borderRadius: "20px",
                      background: priority.bg, color: priority.color
                    }}>
                      {priority.label}
                    </span>
                    {task.due_date && (
                      <span style={{
                        display: "flex", alignItems: "center", gap: "4px",
                        fontSize: "12px",
                        color: isOverdue ? "#ef4444" : isDueToday ? "#f59e0b" : "#9ca3af",
                        fontWeight: isOverdue || isDueToday ? "600" : "400"
                      }}>
                        <Clock size={11} />
                        {isOverdue ? "Overdue · " : isDueToday ? "Today · " : ""}
                        {task.due_date}
                      </span>
                    )}
                    {task.description && (
                      <span style={{ fontSize: "12px", color: "#9ca3af" }}>
                        {task.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* DELETE */}
                <button
                  onClick={() => deleteTask(task.id)}
                  style={{
                    width: "32px", height: "32px", borderRadius: "8px",
                    border: "none", background: "none",
                    cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "#d1d5db", flexShrink: 0
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                  onMouseLeave={e => e.currentTarget.style.color = "#d1d5db"}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}