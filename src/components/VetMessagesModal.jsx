import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import FarmerPicker from "./FarmerPicker";
import { X, Send, ArrowLeft, MessageSquarePlus } from "lucide-react";

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "#fff", color: "#111827"
};

// VetDashboard.jsx's "Message Farmer" quick action. Reuses
// CommunityChat.jsx's proven Realtime pattern (subscribe, refetch the
// whole thread on any change — simple and fine at this message volume)
// but scoped to a single vet-farmer pair instead of one global room.
export default function VetMessagesModal({ onClose }) {
  const { user, userEmail } = useAuth();
  const toast = useToast();

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [activeFarmer, setActiveFarmer] = useState(null); // { user_email, full_name }
  const [startingNew, setStartingNew] = useState(false);
  const [newFarmer, setNewFarmer] = useState(null);

  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { loadConversations(); }, []);

  async function loadConversations() {
    setLoadingConversations(true);
    const { data, error } = await supabase
      .from("vet_farmer_messages")
      .select("farmer_email, message, created_at")
      .eq("vet_email", userEmail)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("VetMessagesModal: failed to load conversations —", error.message);
      setLoadingConversations(false);
      return;
    }
    const latestByFarmer = new Map();
    (data || []).forEach(m => {
      if (!latestByFarmer.has(m.farmer_email)) latestByFarmer.set(m.farmer_email, m);
    });
    setConversations(Array.from(latestByFarmer.values()));
    setLoadingConversations(false);
  }

  async function fetchMessages(farmerEmail) {
    const { data, error } = await supabase
      .from("vet_farmer_messages")
      .select("*")
      .eq("vet_email", userEmail)
      .eq("farmer_email", farmerEmail)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("VetMessagesModal: failed to load messages —", error.message);
      return;
    }
    setMessages(data || []);
  }

  function openConversation(farmerEmail) {
    setActiveFarmer({ user_email: farmerEmail });
    setStartingNew(false);
    setLoadingMessages(true);
    fetchMessages(farmerEmail).finally(() => setLoadingMessages(false));
  }

  function startNewConversation() {
    if (!newFarmer) return;
    setActiveFarmer(newFarmer);
    setStartingNew(false);
    setNewFarmer(null);
    setMessages([]);
  }

  // Realtime — refetch the active thread on any change, same pattern as
  // CommunityChat.jsx.
  useEffect(() => {
    if (!activeFarmer) return;
    const channel = supabase
      .channel(`vet-farmer-messages-${userEmail}-${activeFarmer.user_email}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "vet_farmer_messages", filter: `vet_email=eq.${userEmail}` },
        () => fetchMessages(activeFarmer.user_email)
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [activeFarmer, userEmail]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim() || !activeFarmer || sending) return;
    setSending(true);
    const { error } = await supabase.from("vet_farmer_messages").insert([{
      vet_id: user?.id || null,
      vet_email: userEmail,
      farmer_email: activeFarmer.user_email,
      sender_email: userEmail,
      message: draft.trim(),
    }]);
    setSending(false);
    if (error) { toast.error("Failed to send: " + error.message); return; }
    setDraft("");
    loadConversations();
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px"
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: "20px", width: "100%", maxWidth: "480px",
          height: "min(640px, 85vh)", display: "flex", flexDirection: "column", overflow: "hidden"
        }}
      >
        {/* HEADER */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px", borderBottom: "1px solid #f0f0f0", flexShrink: 0
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {(activeFarmer || startingNew) && (
              <button
                onClick={() => { setActiveFarmer(null); setStartingNew(false); setNewFarmer(null); }}
                aria-label="Back to conversations"
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>
              {activeFarmer ? (activeFarmer.full_name || activeFarmer.user_email) : "Messages"}
            </h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {!activeFarmer && !startingNew && (
              <button
                onClick={() => setStartingNew(true)}
                aria-label="New conversation"
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#16a34a" }}
              >
                <MessageSquarePlus size={20} />
              </button>
            )}
            <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer" }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {/* BODY */}
        {startingNew ? (
          <div style={{ padding: "20px", flex: 1, overflowY: "auto" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#6b7280", marginBottom: "8px" }}>
              Start a conversation with
            </label>
            <FarmerPicker value={newFarmer} onChange={setNewFarmer} />
            <button
              onClick={startNewConversation}
              disabled={!newFarmer}
              style={{
                marginTop: "16px", width: "100%", padding: "12px",
                background: newFarmer ? "linear-gradient(135deg,#22c55e,#16a34a)" : "#e5e7eb",
                color: "#fff", border: "none", borderRadius: "10px",
                fontWeight: "700", fontSize: "14px", cursor: newFarmer ? "pointer" : "not-allowed"
              }}
            >
              Start Conversation
            </button>
          </div>
        ) : activeFarmer ? (
          <>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: "10px" }}>
              {loadingMessages ? (
                <p style={{ fontSize: "13px", color: "#9ca3af" }}>Loading...</p>
              ) : messages.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#9ca3af", textAlign: "center", marginTop: "20px" }}>
                  No messages yet — say hello.
                </p>
              ) : (
                messages.map(m => {
                  const isMine = m.sender_email === userEmail;
                  return (
                    <div key={m.id} style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "75%", padding: "9px 13px", borderRadius: "14px",
                        background: isMine ? "#16a34a" : "#f3f4f6",
                        color: isMine ? "#fff" : "#111827", fontSize: "13px"
                      }}>
                        {m.message}
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
            <form onSubmit={sendMessage} style={{
              display: "flex", gap: "8px", padding: "14px 20px",
              borderTop: "1px solid #f0f0f0", flexShrink: 0
            }}>
              <input
                placeholder="Type a message..."
                value={draft}
                onChange={e => setDraft(e.target.value)}
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={!draft.trim() || sending}
                aria-label="Send message"
                style={{
                  flexShrink: 0, width: "42px", height: "42px", borderRadius: "10px",
                  border: "none", background: "#16a34a", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: draft.trim() ? "pointer" : "not-allowed", opacity: draft.trim() ? 1 : 0.6
                }}
              >
                <Send size={17} />
              </button>
            </form>
          </>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px" }}>
            {loadingConversations ? (
              <p style={{ fontSize: "13px", color: "#9ca3af" }}>Loading...</p>
            ) : conversations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 10px" }}>
                <p style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "12px" }}>
                  No conversations yet.
                </p>
                <button
                  onClick={() => setStartingNew(true)}
                  style={{
                    padding: "9px 18px", background: "#f0fdf4", color: "#16a34a",
                    border: "1px solid #bbf7d0", borderRadius: "10px",
                    fontWeight: "700", fontSize: "13px", cursor: "pointer"
                  }}
                >
                  Message a Farmer
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {conversations.map(c => (
                  <div
                    key={c.farmer_email}
                    onClick={() => openConversation(c.farmer_email)}
                    style={{
                      padding: "12px 10px", borderRadius: "12px", cursor: "pointer",
                      borderBottom: "1px solid #f9fafb"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <p style={{ margin: "0 0 3px", fontWeight: "700", fontSize: "13px", color: "#111827" }}>
                      {c.farmer_email}
                    </p>
                    <p style={{
                      margin: 0, fontSize: "12px", color: "#9ca3af",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>
                      {c.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
