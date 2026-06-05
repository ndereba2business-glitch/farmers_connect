import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ChatSupport() {
  const [messages, setMessages] = useState([]);

  const [form, setForm] = useState({
    sender: "",
    message: ""
  });

  // -----------------------------
  // FETCH MESSAGES
  // -----------------------------
  async function fetchMessages() {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("created_at", { ascending: true });

    if (error) {
      console.error(error.message);
      return;
    }

    setMessages(data || []);
  }

  // -----------------------------
  // REALTIME CHAT
  // -----------------------------
  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel("chat-live")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages"
        },
        (payload) => {
          setMessages((prev) => [
            ...prev,
            payload.new
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // -----------------------------
  // SEND MESSAGE
  // -----------------------------
  async function sendMessage() {
    if (!form.sender || !form.message) {
      alert("Fill all fields");
      return;
    }

    const { error } = await supabase
      .from("messages")
      .insert([
        {
          sender: form.sender,
          message: form.message
        }
      ]);

    if (error) {
      console.error(error.message);
      return;
    }

    setForm({
      sender: form.sender,
      message: ""
    });
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Farmer Support Chat</h1>

      {/* CHAT BOX */}
      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "10px",
          padding: "15px",
          height: "400px",
          overflowY: "auto",
          marginBottom: "20px",
          background: "#f9f9f9"
        }}
      >
        {messages.length === 0 ? (
          <p>No messages yet.</p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                marginBottom: "15px",
                padding: "10px",
                background: "white",
                borderRadius: "8px"
              }}
            >
              <strong>
                {msg.sender}
              </strong>

              <p>{msg.message}</p>

              <small>
                {new Date(
                  msg.created_at
                ).toLocaleString()}
              </small>
            </div>
          ))
        )}
      </div>

      {/* CHAT INPUT */}
      <input
        placeholder="Your Name"
        value={form.sender}
        onChange={(e) =>
          setForm({
            ...form,
            sender: e.target.value
          })
        }
      />

      <br /><br />

      <textarea
        placeholder="Type message..."
        rows="4"
        value={form.message}
        onChange={(e) =>
          setForm({
            ...form,
            message: e.target.value
          })
        }
        style={{
          width: "100%",
          padding: "10px"
        }}
      />

      <br /><br />

      <button onClick={sendMessage}>
        Send Message
      </button>
    </div>
  );
}