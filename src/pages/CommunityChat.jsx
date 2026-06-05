import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { Send, X, Reply, Smile } from "lucide-react";

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "🙏", "🔥"];

export default function CommunityChat() {
  const { userEmail, profile } = useAuth();
  const [messages, setMessages] = useState([]);
  const [reactions, setReactions] = useState({});
  const [input, setInput] = useState("");
  const [replyingTo, setReplyingTo] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [showEmojiPickerFor, setShowEmojiPickerFor] = useState(null);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const userName = profile?.full_name || userEmail?.split("@")[0] || "Farmer";

  // ========================
  // FETCH MESSAGES
  // ========================
  async function fetchMessages() {
    const { data } = await supabase
      .from("community_chat")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(100);
    setMessages(data || []);
  }

  // ========================
  // FETCH REACTIONS
  // ========================
  async function fetchReactions() {
    const { data } = await supabase
      .from("message_reactions")
      .select("*");

    // Group reactions by message_id
    // { messageId: { "👍": [{ user_email, user_name }], "❤️": [...] } }
    const grouped = {};
    (data || []).forEach(r => {
      if (!grouped[r.message_id]) grouped[r.message_id] = {};
      if (!grouped[r.message_id][r.emoji]) grouped[r.message_id][r.emoji] = [];
      grouped[r.message_id][r.emoji].push(r);
    });
    setReactions(grouped);
  }

  useEffect(() => {
    fetchMessages();
    fetchReactions();

    // ✅ Realtime subscription for both tables
    const msgChannel = supabase
      .channel("community-chat-main")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "community_chat" },
        fetchMessages
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "message_reactions" },
        fetchReactions
      )
      .subscribe();

    return () => supabase.removeChannel(msgChannel);
  }, []);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ========================
  // SEND MESSAGE
  // ========================
  async function sendMessage() {
    if (!input.trim() || sending) return;
    setSending(true);

    await supabase.from("community_chat").insert([{
      user_email: userEmail,
      user_name: userName,
      message: input.trim(),
      // ✅ Attach reply data if replying
      reply_to_id: replyingTo?.id || null,
      reply_to_message: replyingTo?.message || null,
      reply_to_user: replyingTo?.user_name || null
    }]);

    setInput("");
    setReplyingTo(null); // ✅ Clear the clipboard
    setSending(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ========================
  // TOGGLE REACTION
  // ========================
  async function toggleReaction(messageId, emoji) {
    if (!userEmail) return;

    const messageReactions = reactions[messageId] || {};
    const emojiReactions = messageReactions[emoji] || [];
    const alreadyReacted = emojiReactions.some(r => r.user_email === userEmail);

    if (alreadyReacted) {
      // ✅ Remove reaction (toggle off)
      await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", messageId)
        .eq("user_email", userEmail)
        .eq("emoji", emoji);
    } else {
      // ✅ Add reaction (toggle on)
      await supabase.from("message_reactions").insert([{
        message_id: messageId,
        user_email: userEmail,
        user_name: userName,
        emoji
      }]);
    }

    setShowEmojiPickerFor(null);
    fetchReactions();
  }

  // ========================
  // SCROLL TO ORIGINAL
  // ========================
  function scrollToMessage(messageId) {
    const el = document.getElementById(`msg-${messageId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.style.background = "#f0fdf4";
      setTimeout(() => { el.style.background = ""; }, 1500);
    }
  }

  const isMe = (email) => email === userEmail;

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "calc(100vh - 120px)", maxWidth: "800px"
    }}>

      {/* ======================== HEADER ======================== */}
      <div style={{
        background: "#fff", borderRadius: "16px 16px 0 0",
        border: "1px solid #e5e7eb", borderBottom: "none",
        padding: "16px 20px",
        display: "flex", alignItems: "center", gap: "12px"
      }}>
        <div style={{
          width: "40px", height: "40px", borderRadius: "50%",
          background: "linear-gradient(135deg,#22c55e,#16a34a)",
          display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: "18px"
        }}>
          🌍
        </div>
        <div>
          <p style={{ margin: 0, fontWeight: "700", fontSize: "15px", color: "#111827" }}>
            Farmers Community Chat
          </p>
          <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
            {messages.length} messages
          </p>
        </div>
      </div>

      {/* ======================== MESSAGES ======================== */}
      <div style={{
        flex: 1, overflowY: "auto",
        padding: "16px 20px",
        background: "#f9fafb",
        border: "1px solid #e5e7eb",
        borderTop: "none", borderBottom: "none",
        display: "flex", flexDirection: "column", gap: "4px"
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
            No messages yet. Say hello 👋
          </div>
        )}

        {messages.map((msg) => {
          const mine = isMe(msg.user_email);
          const msgReactions = reactions[msg.id] || {};
          const hasReactions = Object.keys(msgReactions).length > 0;

          return (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              style={{
                display: "flex",
                justifyContent: mine ? "flex-end" : "flex-start",
                marginBottom: hasReactions ? "20px" : "4px",
                position: "relative",
                transition: "background 0.3s ease",
                borderRadius: "10px", padding: "4px"
              }}
              onMouseEnter={() => setHoveredMessageId(msg.id)}
              onMouseLeave={() => {
                setHoveredMessageId(null);
                setShowEmojiPickerFor(null);
              }}
            >
              {/* AVATAR (other users only) */}
              {!mine && (
                <div style={{
                  width: "32px", height: "32px", borderRadius: "50%",
                  background: "#dcfce7", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: "13px", fontWeight: "700", color: "#16a34a",
                  flexShrink: 0, marginRight: "8px", marginTop: "4px"
                }}>
                  {(msg.user_name || "F").charAt(0).toUpperCase()}
                </div>
              )}

              <div style={{ maxWidth: "70%", position: "relative" }}>

                {/* SENDER NAME (other users only) */}
                {!mine && (
                  <p style={{
                    margin: "0 0 3px 4px", fontSize: "12px",
                    fontWeight: "600", color: "#16a34a"
                  }}>
                    {msg.user_name}
                  </p>
                )}

                {/* ✅ REPLY PREVIEW inside the bubble */}
                {msg.reply_to_id && (
                  <div
                    onClick={() => scrollToMessage(msg.reply_to_id)}
                    style={{
                      background: mine ? "rgba(0,0,0,0.15)" : "#f0fdf4",
                      borderLeft: "3px solid #22c55e",
                      borderRadius: "8px 8px 0 0",
                      padding: "6px 10px",
                      cursor: "pointer",
                      marginBottom: "2px"
                    }}
                  >
                    <p style={{
                      margin: "0 0 2px", fontSize: "11px", fontWeight: "700",
                      color: mine ? "rgba(255,255,255,0.8)" : "#16a34a"
                    }}>
                      {msg.reply_to_user}
                    </p>
                    <p style={{
                      margin: 0, fontSize: "12px",
                      color: mine ? "rgba(255,255,255,0.7)" : "#6b7280",
                      whiteSpace: "nowrap", overflow: "hidden",
                      textOverflow: "ellipsis", maxWidth: "220px"
                    }}>
                      {msg.reply_to_message}
                    </p>
                  </div>
                )}

                {/* MESSAGE BUBBLE */}
                <div style={{
                  padding: "10px 14px",
                  borderRadius: msg.reply_to_id
                    ? "0 8px 8px 8px"
                    : mine ? "18px 4px 18px 18px" : "4px 18px 18px 18px",
                  background: mine
                    ? "linear-gradient(135deg,#22c55e,#16a34a)"
                    : "#fff",
                  color: mine ? "#fff" : "#111827",
                  border: mine ? "none" : "1px solid #e5e7eb",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  fontSize: "14px", lineHeight: "1.5",
                  wordBreak: "break-word"
                }}>
                  {msg.message}
                  <span style={{
                    display: "block", fontSize: "10px", marginTop: "4px",
                    color: mine ? "rgba(255,255,255,0.6)" : "#9ca3af",
                    textAlign: "right"
                  }}>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </span>
                </div>

                {/* ✅ REACTION PILLS below the bubble */}
                {hasReactions && (
                  <div style={{
                    display: "flex", flexWrap: "wrap", gap: "4px",
                    marginTop: "4px",
                    justifyContent: mine ? "flex-end" : "flex-start"
                  }}>
                    {Object.entries(msgReactions).map(([emoji, reactors]) => {
                      const iReacted = reactors.some(r => r.user_email === userEmail);
                      return (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(msg.id, emoji)}
                          title={reactors.map(r => r.user_name).join(", ")}
                          style={{
                            display: "flex", alignItems: "center", gap: "4px",
                            padding: "3px 8px", borderRadius: "20px",
                            border: `1.5px solid ${iReacted ? "#22c55e" : "#e5e7eb"}`,
                            background: iReacted ? "#f0fdf4" : "#fff",
                            cursor: "pointer", fontSize: "13px",
                            fontWeight: "600",
                            color: iReacted ? "#16a34a" : "#374151"
                          }}
                        >
                          {emoji} {reactors.length}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* ✅ HOVER ACTIONS — Reply + Emoji buttons */}
                {hoveredMessageId === msg.id && (
                  <div style={{
                    position: "absolute",
                    top: "-32px",
                    right: mine ? "0" : "auto",
                    left: mine ? "auto" : "0",
                    display: "flex", gap: "4px",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "20px",
                    padding: "4px 8px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    zIndex: 10
                  }}>
                    {/* EMOJI PICKER TRIGGER */}
                    <button
                      onClick={() => setShowEmojiPickerFor(
                        showEmojiPickerFor === msg.id ? null : msg.id
                      )}
                      style={{
                        background: "none", border: "none",
                        cursor: "pointer", fontSize: "16px",
                        padding: "2px 4px", borderRadius: "6px"
                      }}
                      title="React"
                    >
                      😊
                    </button>

                    {/* REPLY BUTTON */}
                    <button
                      onClick={() => {
                        setReplyingTo({
                          id: msg.id,
                          message: msg.message,
                          user_name: msg.user_name
                        });
                        inputRef.current?.focus();
                      }}
                      style={{
                        background: "none", border: "none",
                        cursor: "pointer", padding: "2px 4px",
                        borderRadius: "6px",
                        display: "flex", alignItems: "center", gap: "4px",
                        fontSize: "12px", fontWeight: "600", color: "#374151"
                      }}
                      title="Reply"
                    >
                      <Reply size={14} /> Reply
                    </button>
                  </div>
                )}

                {/* ✅ EMOJI PICKER POPUP */}
                {showEmojiPickerFor === msg.id && (
                  <div style={{
                    position: "absolute",
                    top: "-70px",
                    right: mine ? "0" : "auto",
                    left: mine ? "auto" : "0",
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "16px",
                    padding: "8px 12px",
                    display: "flex", gap: "8px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                    zIndex: 20
                  }}>
                    {QUICK_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => toggleReaction(msg.id, emoji)}
                        style={{
                          background: "none", border: "none",
                          cursor: "pointer", fontSize: "22px",
                          transition: "transform 0.1s",
                          borderRadius: "8px", padding: "4px"
                        }}
                        onMouseEnter={e => e.currentTarget.style.transform = "scale(1.3)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* ======================== REPLY PREVIEW BAR ======================== */}
      {replyingTo && (
        <div style={{
          background: "#f0fdf4",
          border: "1px solid #dcfce7",
          borderTop: "none",
          padding: "10px 16px",
          display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: "12px"
        }}>
          <div style={{
            borderLeft: "3px solid #22c55e",
            paddingLeft: "10px", flex: 1, overflow: "hidden"
          }}>
            <p style={{ margin: "0 0 2px", fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>
              Replying to {replyingTo.user_name}
            </p>
            <p style={{
              margin: 0, fontSize: "13px", color: "#6b7280",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
            }}>
              {replyingTo.message}
            </p>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#9ca3af", flexShrink: 0
            }}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* ======================== INPUT AREA ======================== */}
      <div style={{
        background: "#fff",
        border: "1px solid #e5e7eb",
        borderTop: replyingTo ? "none" : "1px solid #e5e7eb",
        borderRadius: replyingTo ? "0 0 16px 16px" : "0 0 16px 16px",
        padding: "14px 16px",
        display: "flex", gap: "10px", alignItems: "flex-end"
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={replyingTo ? `Reply to ${replyingTo.user_name}...` : "Type a message..."}
          rows={1}
          style={{
            flex: 1, padding: "10px 14px",
            borderRadius: "22px", border: "1.5px solid #e5e7eb",
            fontSize: "14px", outline: "none", resize: "none",
            lineHeight: "1.5", fontFamily: "inherit",
            background: "#f9fafb", boxSizing: "border-box"
          }}
          onInput={e => {
            // Auto-resize textarea
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || sending}
          style={{
            width: "44px", height: "44px", borderRadius: "50%",
            border: "none",
            background: !input.trim() || sending
              ? "#e5e7eb"
              : "linear-gradient(135deg,#22c55e,#16a34a)",
            cursor: !input.trim() || sending ? "not-allowed" : "pointer",
            display: "flex", alignItems: "center",
            justifyContent: "center", flexShrink: 0,
            boxShadow: input.trim() ? "0 4px 12px rgba(34,197,94,0.3)" : "none",
            transition: "all 0.2s"
          }}
        >
          <Send size={18} color={!input.trim() ? "#9ca3af" : "#fff"} />
        </button>
      </div>
    </div>
  );
}