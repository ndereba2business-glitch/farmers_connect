import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { Bell } from "lucide-react";

export default function NotificationsBell({ userEmail }) {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function fetchNotifications() {
    if (!userEmail) return;
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_email", userEmail)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!error && data) setNotifications(data);
  }

  async function markAllRead() {
    if (!userEmail) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_email", userEmail)
      .eq("read", false);
    fetchNotifications();
  }

  async function markOneRead(id) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    fetchNotifications();
  }

  async function clearAll() {
    if (!userEmail) return;
    await supabase.from("notifications").delete().eq("user_email", userEmail);
    setNotifications([]);
  }

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_email=eq.${userEmail}`,
        },
        () => fetchNotifications()
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [userEmail]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function timeAgo(timestamp) {
    const diff = Math.floor((Date.now() - new Date(timestamp)) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  const typeColors = {
    task: "#f59e0b",
    chat: "#3b82f6",
    marketplace: "#10b981",
    vet: "#ef4444",
    community: "#8b5cf6",
    general: "#6b7280",
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell Button */}
      <button
        onClick={() => { setOpen(!open); if (!open) markAllRead(); }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          position: "relative",
          padding: "8px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Bell size={24} color="#fff" />
        {unreadCount > 0 && (
          <span style={{
            position: "absolute",
            top: "2px",
            right: "2px",
            background: "#ef4444",
            color: "#fff",
            borderRadius: "50%",
            width: "18px",
            height: "18px",
            fontSize: "11px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute",
          right: 0,
          top: "44px",
          width: "320px",
          background: "#fff",
          borderRadius: "12px",
          boxShadow: "0 8px 30px rgba(0,0,0,0.15)",
          zIndex: 9999,
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "14px 16px",
            borderBottom: "1px solid #f0f0f0",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ fontWeight: "700", fontSize: "15px", color: "#1a1a1a" }}>
              Notifications {unreadCount > 0 && `(${unreadCount})`}
            </span>
            <button
              onClick={clearAll}
              style={{
                background: "none",
                border: "none",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              Clear All
            </button>
          </div>

          {/* List */}
          <div style={{ maxHeight: "360px", overflowY: "auto" }}>
            {notifications.length === 0 ? (
              <div style={{
                padding: "32px 16px",
                textAlign: "center",
                color: "#9ca3af",
                fontSize: "14px",
              }}>
                🔔 No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markOneRead(n.id)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #f9f9f9",
                    cursor: "pointer",
                    background: n.read ? "#fff" : "#f0f7ff",
                    transition: "background 0.2s",
                    display: "flex",
                    gap: "10px",
                    alignItems: "flex-start",
                  }}
                >
                  <div style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: typeColors[n.type] || typeColors.general,
                    marginTop: "6px",
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: n.read ? "500" : "700",
                      fontSize: "13px",
                      color: "#1a1a1a",
                      marginBottom: "2px",
                    }}>
                      {n.title}
                    </div>
                    <div style={{ fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
                      {n.message}
                    </div>
                    <div style={{ fontSize: "11px", color: "#9ca3af" }}>
                      {timeAgo(n.created_at)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}