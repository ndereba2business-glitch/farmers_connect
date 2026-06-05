import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);

  // -----------------------------
  // FETCH INITIAL NOTIFICATIONS
  // -----------------------------
  async function fetchNotifications() {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return;

    setNotifications(data || []);
  }

  // -----------------------------
  // REALTIME LISTENER
  // -----------------------------
  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("notifications-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications"
        },
        () => {
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div style={{ padding: "10px" }}>
      <h3>Notifications</h3>

      {notifications.length === 0 ? (
        <p>No notifications</p>
      ) : (
        notifications.map((n) => (
          <div
            key={n.id}
            style={{
              border: "1px solid #ddd",
              padding: "10px",
              marginBottom: "8px",
              borderRadius: "8px",
              background:
                n.type === "emergency"
                  ? "#ffe5e5"
                  : "#f5f5f5"
            }}
          >
            <b>{n.title}</b>
            <p>{n.message}</p>
          </div>
        ))
      )}
    </div>
  );
}