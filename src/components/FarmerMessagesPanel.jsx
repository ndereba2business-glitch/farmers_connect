import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ArrowLeft, Send, MessageSquarePlus } from "lucide-react";

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "#fff", color: "#111827"
};

// Farmer-side counterpart to VetMessagesModal.jsx — same
// vet_farmer_messages table and Realtime pattern (refetch the active
// thread on any change), just from the other end of the conversation and
// rendered inline as a Bookings.jsx tab panel instead of a modal overlay.
export default function FarmerMessagesPanel() {
  const { userEmail } = useAuth();
  const toast = useToast();

  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [verifiedVets, setVerifiedVets] = useState([]);
  const [startingNew, setStartingNew] = useState(false);
  const [newVetEmail, setNewVetEmail] = useState("");

  const [activeVetEmail, setActiveVetEmail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    loadConversations();
    loadVerifiedVets();
  }, [userEmail]);

  async function loadConversations() {
    if (!userEmail) return;
    setLoadingConversations(true);
    const { data, error } = await supabase
      .from("vet_farmer_messages")
      .select("vet_email, message, created_at")
      .eq("farmer_email", userEmail)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("FarmerMessagesPanel: failed to load conversations —", error.message);
      setLoadingConversations(false);
      return;
    }
    const latestByVet = new Map();
    (data || []).forEach(m => {
      if (!latestByVet.has(m.vet_email)) latestByVet.set(m.vet_email, m);
    });
    setConversations(Array.from(latestByVet.values()));
    setLoadingConversations(false);
  }

  async function loadVerifiedVets() {
    const { data, error } = await supabase
      .from("vet_profiles")
      .select("user_id, email, full_name")
      .eq("verification_status", "verified")
      .not("email", "is", null)
      .order("full_name", { ascending: true });
    if (error) {
      console.error("FarmerMessagesPanel: failed to load vets —", error.message);
      return;
    }
    setVerifiedVets(data || []);
  }

  async function fetchMessages(vetEmail) {
    const { data, error } = await supabase
      .from("vet_farmer_messages")
      .select("*")
      .eq("farmer_email", userEmail)
      .eq("vet_email", vetEmail)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("FarmerMessagesPanel: failed to load messages —", error.message);
      return;
    }
    setMessages(data || []);
  }

  function openConversation(vetEmail) {
    setActiveVetEmail(vetEmail);
    setStartingNew(false);
    setLoadingMessages(true);
    fetchMessages(vetEmail).finally(() => setLoadingMessages(false));
  }

  function startNewConversation() {
    if (!newVetEmail) return;
    setActiveVetEmail(newVetEmail);
    setStartingNew(false);
    setNewVetEmail("");
    setMessages([]);
  }

  useEffect(() => {
    if (!activeVetEmail || !userEmail) return;
    const channel = supabase
      .channel(`farmer-vet-messages-${userEmail}-${activeVetEmail}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "vet_farmer_messages", filter: `farmer_email=eq.${userEmail}` },
        () => fetchMessages(activeVetEmail)
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [activeVetEmail, userEmail]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!draft.trim() || !activeVetEmail || sending) return;
    setSending(true);
    const { error } = await supabase.from("vet_farmer_messages").insert([{
      vet_email: activeVetEmail,
      farmer_email: userEmail,
      sender_email: userEmail,
      message: draft.trim(),
    }]);
    setSending(false);
    if (error) { toast.error("Failed to send: " + error.message); return; }
    setDraft("");
    loadConversations();
  }

  const activeVetName = verifiedVets.find(v => v.email === activeVetEmail)?.full_name;

  return (
    <div style={{
      background: "#fff", borderRadius: "20px", border: "1px solid #e5e7eb",
      height: "min(600px, 75vh)", display: "flex", flexDirection: "column", overflow: "hidden"
    }}>
      {/* HEADER */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 18px", borderBottom: "1px solid #f0f0f0", flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {(activeVetEmail || startingNew) && (
            <button
              onClick={() => { setActiveVetEmail(null); setStartingNew(false); setNewVetEmail(""); }}
              aria-label="Back to conversations"
              style={{ background: "none", border: "none", cursor: "pointer", display: "flex" }}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#111827" }}>
            {activeVetEmail ? (activeVetName || activeVetEmail) : "Messages"}
          </h3>
        </div>
        {!activeVetEmail && !startingNew && (
          <button
            onClick={() => setStartingNew(true)}
            aria-label="New conversation"
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", color: "#16a34a" }}
          >
            <MessageSquarePlus size={20} />
          </button>
        )}
      </div>

      {/* BODY */}
      {startingNew ? (
        <div style={{ padding: "18px", flex: 1, overflowY: "auto" }}>
          <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "#6b7280", marginBottom: "8px" }}>
            Start a conversation with
          </label>
          <select
            value={newVetEmail}
            onChange={e => setNewVetEmail(e.target.value)}
            style={{ ...inputStyle, appearance: "none" }}
          >
            <option value="">Select a vet...</option>
            {verifiedVets.map(v => (
              <option key={v.email} value={v.email}>{v.full_name || v.email}</option>
            ))}
          </select>
          {verifiedVets.length === 0 && (
            <p style={{ margin: "8px 0 0", fontSize: "12px", color: "#9ca3af" }}>
              No verified vets available yet.
            </p>
          )}
          <button
            onClick={startNewConversation}
            disabled={!newVetEmail}
            style={{
              marginTop: "16px", width: "100%", padding: "12px",
              background: newVetEmail ? "linear-gradient(135deg,#22c55e,#16a34a)" : "#e5e7eb",
              color: "#fff", border: "none", borderRadius: "10px",
              fontWeight: "700", fontSize: "14px", cursor: newVetEmail ? "pointer" : "not-allowed"
            }}
          >
            Start Conversation
          </button>
        </div>
      ) : activeVetEmail ? (
        <>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px", display: "flex", flexDirection: "column", gap: "10px" }}>
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
            display: "flex", gap: "8px", padding: "12px 18px",
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
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 18px" }}>
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
                Message a Vet
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {conversations.map(c => {
                const vetName = verifiedVets.find(v => v.email === c.vet_email)?.full_name;
                return (
                  <div
                    key={c.vet_email}
                    onClick={() => openConversation(c.vet_email)}
                    style={{ padding: "12px 10px", borderRadius: "12px", cursor: "pointer", borderBottom: "1px solid #f9fafb" }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f9fafb"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <p style={{ margin: "0 0 3px", fontWeight: "700", fontSize: "13px", color: "#111827" }}>
                      {vetName || c.vet_email}
                    </p>
                    <p style={{
                      margin: 0, fontSize: "12px", color: "#9ca3af",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
                    }}>
                      {c.message}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
