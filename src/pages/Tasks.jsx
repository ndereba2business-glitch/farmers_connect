import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { createNotification } from "../lib/notifications";
import { CheckSquare, Plus, Trash2, Clock, Wheat, Pill, Brush, Syringe, Wrench, Stethoscope, ClipboardList
} from "lucide-react";

const PRIORITIES = [
  { value: "high", label: "High", color: "var(--fc-fg-red500)", bg: "var(--fc-bg-red50)" },
  { value: "medium", label: "Medium", color: "var(--fc-fg-amber500)", bg: "var(--fc-bg-amber50)" },
  { value: "low", label: "Low", color: "var(--fc-fg-green700)", bg: "var(--fc-bg-green50)" },
];

const CATEGORIES = [
  { value: "Feeding", icon: Wheat },
  { value: "Health", icon: Pill },
  { value: "Cleaning", icon: Brush },
  { value: "Vaccination", icon: Syringe },
  { value: "Equipment", icon: Wrench },
  { value: "Vet Visit", icon: Stethoscope },
  { value: "Other", icon: ClipboardList },
];

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: "12px",
  border: "1.5px solid var(--fc-line-gray200)", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "var(--fc-bg-gray0)"
};

const labelStyle = {
  display: "block", fontSize: "12px", fontWeight: "600",
  color: "var(--fc-fg-gray500)", marginBottom: "5px", textTransform: "uppercase",
  letterSpacing: "0.05em"
};

export default function Tasks() {
  const { userEmail } = useAuth();
  const toast = useToast();
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
    const { error } = await supabase.from("farm_tasks").insert([{
      user_email: userEmail,
      title: form.title,
      description: form.description,
      due_date: form.due_date || null,
      priority: form.priority,
      category: form.category,
      completed: false
    }]);
    // keep the form filled in, and no "task added" notice for a task that is not there
    if (error) { toast.error("The task was not saved. Check your connection and try again."); return; }

    await createNotification({
      userEmail,
      type: "task",
      title: "New Task Added",
      message: `"${form.title}" has been added to your farm tasks.`,
      link: "/tasks"
    });

    setForm({ title: "", due_date: "", priority: "medium", category: "Other", description: "" });
    setShowForm(false);
    fetchTasks();
  }

  async function toggleTask(task) {
    const completed = !task.completed;
    const { error } = await supabase.from("farm_tasks").update({ completed }).eq("id", task.id);
    if (error) { toast.error("That task was not updated. Check your connection and try again."); fetchTasks(); return; }
    if (completed) {
      await createNotification({
        userEmail, type: "task",
        title: "Task Completed",
        message: `You completed "${task.title}". Great work!`,
        link: "/tasks"
      });
    }
    fetchTasks();
  }

  async function deleteTask(id) {
    const { error } = await supabase.from("farm_tasks").delete().eq("id", id);
    if (error) toast.error("That task was not deleted. Check your connection and try again.");
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

  function categoryIcon(category) {
    const Icon = CATEGORIES.find(c => c.value === category)?.icon || ClipboardList;
    return <Icon size={18} color="var(--fc-fg-gray600)" aria-hidden="true" />;
  }

  return (
    <div style={{ maxWidth: "800px" }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <CheckSquare size={28} color="var(--fc-fg-green700)" />
          <div>
            <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "700", color: "var(--fc-fg-gray900)", letterSpacing: "-1px" }}>
              Farm Tasks
            </h1>
            <p style={{ margin: "4px 0 0", color: "var(--fc-fg-gray500)", fontSize: "14px" }}>
              Track daily and upcoming farm tasks.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          style={{
            height: "44px", padding: "0 20px", border: "none",
            borderRadius: "12px",
            background: "#15803d",
            color: "white", fontWeight: "700", cursor: "pointer",
            fontSize: "14px", display: "flex", alignItems: "center",
            gap: "8px", boxShadow: "none"
          }}
        >
          <Plus size={18} /> Add Task
        </button>
      </div>

      {/* STAT CARDS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "20px" }}>
        {[
          { label: "Pending", value: pending.length, color: "var(--fc-fg-green700)" },
          { label: "Overdue", value: overdue.length, color: "var(--fc-fg-red500)" },
          { label: "Due Today", value: dueToday.length, color: "var(--fc-fg-amber500)" },
        ].map(item => (
          <div key={item.label} style={{
            background: "var(--fc-bg-gray0)", borderRadius: "16px",
            border: "1px solid var(--fc-line-gray200)", padding: "20px",
            textAlign: "center",
            boxShadow: "var(--fc-shadow-card)"
          }}>
            <div style={{ fontSize: "32px", fontWeight: "700", color: item.color }}>
              {item.value}
            </div>
            <div style={{ fontSize: "13px", color: "var(--fc-fg-gray500)", marginTop: "4px", fontWeight: "500" }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* ADD TASK FORM */}
      {showForm && (
        <div style={{
          background: "var(--fc-bg-gray0)", borderRadius: "16px",
          border: "1px solid var(--fc-line-gray200)", padding: "20px",
          marginBottom: "20px", boxShadow: "var(--fc-shadow-card)"
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
                  <option key={c.value} value={c.value}>{c.value}</option>
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
                background: "#15803d",
                color: "var(--fc-fg-gray0)", border: "none", borderRadius: "12px",
                fontWeight: "700", fontSize: "14px", cursor: "pointer"
              }}
            >
              Add Task
            </button>
            <button
              onClick={() => setShowForm(false)}
              style={{
                padding: "12px 20px", background: "var(--fc-bg-gray50)",
                border: "1px solid var(--fc-line-gray200)", borderRadius: "12px",
                cursor: "pointer", fontWeight: "600", fontSize: "14px", color: "var(--fc-fg-gray700)"
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* TABS */}
      <div style={{
        display: "flex", background: "var(--fc-bg-gray100)",
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
            className="fc-tap"
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: "9px",
              borderRadius: "8px", border: "none",
              cursor: "pointer", fontWeight: "600", fontSize: "13px",
              background: activeTab === tab.key ? "var(--fc-bg-gray0)" : "transparent",
              color: activeTab === tab.key ? "var(--fc-fg-gray900)" : "var(--fc-fg-gray400)",
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
        background: "var(--fc-bg-gray0)", borderRadius: "16px",
        border: "1px solid var(--fc-line-gray200)",
        overflow: "hidden"
      }}>
        {displayTasks.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <CheckSquare size={40} color="var(--fc-fg-gray200)" style={{ marginBottom: "12px" }} />
            <p style={{ color: "var(--fc-fg-gray400)", fontSize: "15px" }}>
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
                  borderBottom: i < displayTasks.length - 1 ? "1px solid var(--fc-line-gray100)" : "none",
                  background: isOverdue ? "var(--fc-bg-red51)" : "var(--fc-bg-gray0)"
                }}
              >
                {/* CHECKBOX */}
                <button
                  onClick={() => toggleTask(task)}
                  aria-label={task.completed ? `Mark "${task.title}" as not done` : `Mark "${task.title}" as done`}
                  aria-pressed={Boolean(task.completed)}
                  style={{
                    width: "22px", height: "22px", borderRadius: "50%",
                    border: `2px solid ${task.completed ? "var(--fc-line-green700)" : "var(--fc-line-gray300)"}`,
                    background: task.completed ? "#15803d" : "var(--fc-bg-gray0)",
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
                  {categoryIcon(task.category)}
                </span>

                {/* TASK INFO */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: "600", fontSize: "14px",
                    color: task.completed ? "var(--fc-fg-gray400)" : "var(--fc-fg-gray900)",
                    textDecoration: task.completed ? "line-through" : "none",
                    marginBottom: "4px"
                  }}>
                    {task.title}
                  </div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{
                      fontSize: "11px", fontWeight: "700",
                      padding: "2px 8px", borderRadius: "16px",
                      background: priority.bg, color: priority.color
                    }}>
                      {priority.label}
                    </span>
                    {task.due_date && (
                      <span style={{
                        display: "flex", alignItems: "center", gap: "4px",
                        fontSize: "12px",
                        color: isOverdue ? "var(--fc-fg-red500)" : isDueToday ? "var(--fc-fg-amber500)" : "var(--fc-fg-gray400)",
                        fontWeight: isOverdue || isDueToday ? "600" : "400"
                      }}>
                        <Clock size={11} />
                        {isOverdue ? "Overdue · " : isDueToday ? "Today · " : ""}
                        {task.due_date}
                      </span>
                    )}
                    {task.description && (
                      <span style={{ fontSize: "12px", color: "var(--fc-fg-gray400)" }}>
                        {task.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* DELETE */}
                <button
                  onClick={() => deleteTask(task.id)}
                  aria-label={`Delete task "${task.title}"`}
                  className="fc-tap"
                  style={{
                    width: "32px", height: "32px", borderRadius: "8px",
                    border: "none", background: "none",
                    cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    color: "var(--fc-fg-gray300)", flexShrink: 0
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "var(--fc-fg-red500)"}
                  onMouseLeave={e => e.currentTarget.style.color = "var(--fc-fg-gray300)"}
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