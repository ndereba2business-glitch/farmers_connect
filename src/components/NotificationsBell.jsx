import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { badgeText, categoryColour, timeAgo } from "../lib/notificationHelpers";
import "./NotificationsBell.css";

const COLUMNS = "id, type, category, title, message, link, read, created_at";
const SYNCED_KEY = "fc_reminders_synced";

// Reminders (vaccinations due, visits tomorrow...) are worked out by the
// database when the app is opened. Once per day per browser tab session is
// enough; the function itself is safe to call more often.
function remindersDueForSync(userEmail) {
  const stamp = `${userEmail}:${new Date().toDateString()}`;
  try {
    if (sessionStorage.getItem(SYNCED_KEY) === stamp) return false;
    sessionStorage.setItem(SYNCED_KEY, stamp);
  } catch { /* storage unavailable: sync every time */ }
  return true;
}

export default function NotificationsBell({ userEmail }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  // What was unread when the panel was opened stays highlighted while it
  // is open, even though opening marks everything as read.
  const [freshIds, setFreshIds] = useState([]);
  const rootRef = useRef(null);

  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!userEmail) return undefined;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("notifications")
        .select(COLUMNS)
        .eq("user_email", userEmail)
        .is("cleared_at", null)
        .order("created_at", { ascending: false })
        .limit(30);
      if (cancelled) return;
      if (error) console.error("NotificationsBell: load failed —", error.message);
      else setNotifications(data || []);
    }

    async function start() {
      if (remindersDueForSync(userEmail)) {
        const { error } = await supabase.rpc("sync_my_reminders");
        if (error) console.error("NotificationsBell: reminder sync failed —", error.message);
      }
      if (!cancelled) load();
    }

    start();

    const channel = supabase
      .channel(`notifications-${userEmail}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_email=eq.${userEmail}` },
        load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userEmail]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setFreshIds(notifications.filter(n => !n.read).map(n => n.id));
    setOpen(true);
    if (!unread) return;
    setNotifications(current => current.map(n => ({ ...n, read: true })));
    const { error } = await supabase.from("notifications")
      .update({ read: true }).eq("user_email", userEmail).eq("read", false);
    if (error) console.error("NotificationsBell: marking read failed —", error.message);
  }

  function openNotification(notification) {
    setOpen(false);
    if (notification.link) navigate(notification.link);
  }

  async function clearAll() {
    const before = notifications;
    setNotifications([]);
    // hidden, not deleted: the database uses these rows to avoid announcing
    // the same thing twice
    const { error } = await supabase.from("notifications")
      .update({ cleared_at: new Date().toISOString(), read: true })
      .eq("user_email", userEmail).is("cleared_at", null);
    if (error) {
      console.error("NotificationsBell: clearing failed —", error.message);
      setNotifications(before);
    }
  }

  const count = badgeText(unread);

  return (
    <div className="nb-root" ref={rootRef}>
      <button
        className="nb-btn"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} new` : "Notifications"}
      >
        <Bell size={22} aria-hidden="true" />
        {count && <span className="nb-count" aria-hidden="true">{count}</span>}
      </button>

      {open && (
        <div className="nb-panel" role="dialog" aria-label="Notifications">
          <div className="nb-head">
            <h2>Notifications</h2>
            {notifications.length > 0 && (
              <button className="nb-link nb-link--danger" onClick={clearAll}>Clear all</button>
            )}
          </div>

          <div className="nb-list">
            {notifications.length === 0 ? (
              <p className="nb-empty">You're all caught up. Reminders and replies will appear here.</p>
            ) : notifications.map(n => (
              <button
                key={n.id}
                className={`nb-item${freshIds.includes(n.id) ? " nb-item--new" : ""}`}
                onClick={() => openNotification(n)}
              >
                <span className="nb-dot" style={{ background: categoryColour(n.category) }} aria-hidden="true" />
                <span className="nb-item-body">
                  <span className="nb-item-title">{n.title}</span>
                  {n.message && <span className="nb-item-text">{n.message}</span>}
                  <span className="nb-item-time">{timeAgo(n.created_at)}{freshIds.includes(n.id) ? " · new" : ""}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="nb-foot">
            <Link className="nb-link" to="/profile#notifications" onClick={() => setOpen(false)}>
              Choose which notifications you get
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
