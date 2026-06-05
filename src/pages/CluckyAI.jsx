import React, {
  useState,
  useEffect,
  useRef
} from "react";

import { supabase } from "../lib/supabaseClient";

import {
  Send,
  Loader2,
  RefreshCw
} from "lucide-react";

const SUGGESTIONS = [
  "Best vaccination schedule for broilers?",
  "Why are my chickens dying suddenly?",
  "Best feed for fast broiler growth?",
  "How do I improve egg production?",
  "Signs of Newcastle disease?"
];

function MessageBubble({ message }) {

  const isUser =
    message.role === "user";

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser
          ? "flex-end"
          : "flex-start",
        marginBottom: "15px"
      }}
    >

      <div
        style={{
          maxWidth: "80%",
          padding: "12px",
          borderRadius: "15px",
          background: isUser
            ? "#16a34a"
            : "#ffffff",
          color: isUser
            ? "white"
            : "black",
          border: isUser
            ? "none"
            : "1px solid #ddd"
        }}
      >

        <p style={{ whiteSpace: "pre-line" }}>
          {message.content}
        </p>

      </div>
    </div>
  );
}

export default function CluckyAI() {

  const [messages, setMessages] =
    useState([]);

  const [input, setInput] =
    useState("");

  const [sending, setSending] =
    useState(false);

  const [profile, setProfile] =
    useState(null);

  const [farmData, setFarmData] =
    useState([]);

  const messagesEndRef =
    useRef(null);

  // =========================
  // LOAD PROFILE
  // =========================
  async function loadProfile() {

    const { data: userData } =
      await supabase.auth.getUser();

    if (!userData?.user) return;

    const email =
      userData.user.email;

    const { data } =
      await supabase
        .from("farmer_profiles")
        .select("*")
        .eq("user_email", email)
        .single();

    setProfile(data);
  }

  // =========================
  // LOAD FARM DATA
  // =========================
  async function loadFarmData() {

    const { data: userData } =
      await supabase.auth.getUser();

    if (!userData?.user) return;

    const email =
      userData.user.email;

    const { data } =
      await supabase
        .from("farm_batches")
        .select("*")
        .eq("user_email", email);

    setFarmData(data || []);
  }

  // =========================
  // INITIALIZE
  // =========================
  useEffect(() => {

    loadProfile();

    loadFarmData();

    setMessages([
      {
        role: "assistant",
        content:
`👋 Hello farmer!

I'm Clucky AI 🐔

Ask me anything about:
• poultry diseases
• vaccinations
• feed planning
• mortality reduction
• egg production
• farm management`
      }
    ]);

  }, []);

  // =========================
  // AUTO SCROLL
  // =========================
  useEffect(() => {

    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth"
    });

  }, [messages]);

  // =========================
  // AI RESPONSE
  // =========================
  function generateResponse(text) {

    const lower =
      text.toLowerCase();

    // MORTALITY
    if (
      lower.includes("mortality") ||
      lower.includes("dying")
    ) {

      const totalMortality =
        farmData.reduce(
          (sum, batch) =>
            sum +
            (batch.mortality || 0),
          0
        );

      if (totalMortality > 20) {

        return `
⚠ High mortality detected.

Possible causes:
• Newcastle disease
• poor ventilation
• contaminated feed
• dirty water

Recommendations:
• isolate sick birds
• improve sanitation
• contact a vet
• review vaccinations
`;
      }

      return `
✅ Mortality appears manageable.

Recommendations:
• maintain hygiene
• continue vaccinations
• monitor feed quality
`;
    }

    // FEED
    if (
      lower.includes("feed") ||
      lower.includes("growth")
    ) {

      return `
🌽 Feed Recommendations

Broilers:
• Starter mash (0–14 days)
• Grower mash (15–28 days)
• Finisher mash (29+ days)

Tips:
• ensure clean water
• feed consistently
• buy quality feed
`;
    }

    // VACCINATION
    if (
      lower.includes("vaccination") ||
      lower.includes("vaccine")
    ) {

      return `
💉 Poultry Vaccination Schedule

Day 1:
• Marek's Disease

Day 7:
• Newcastle Disease

Day 14:
• Gumboro

Day 21:
• Newcastle Booster
`;
    }

    // EGGS
    if (
      lower.includes("egg")
    ) {

      return `
🥚 Egg Production Tips

• use layer mash
• provide calcium
• maintain lighting
• reduce stress
• ensure clean water
`;
    }

    // FARM ANALYSIS
    if (
      lower.includes("analyze") ||
      lower.includes("farm")
    ) {

      const totalBirds =
        farmData.reduce(
          (sum, batch) =>
            sum +
            (batch.current_count || 0),
          0
        );

      const totalMortality =
        farmData.reduce(
          (sum, batch) =>
            sum +
            (batch.mortality || 0),
          0
        );

      return `
📊 Farm Analysis

Farmer:
${profile?.full_name || "Farmer"}

County:
${profile?.county || "Unknown"}

Current Birds:
${totalBirds}

Total Mortality:
${totalMortality}

Recommendations:
• monitor feed expenses
• improve ventilation
• maintain vaccinations
`;
    }

    // DEFAULT
    return `
🐔 Clucky AI

I can help with:
• poultry diseases
• vaccinations
• feed planning
• mortality reduction
• egg production
• farm analytics

Ask a more specific poultry farming question.
`;
  }

  // =========================
  // SEND MESSAGE
  // =========================
  async function sendMessage(text) {

    if (
      !text.trim() ||
      sending
    ) return;

    const userMessage = {
      role: "user",
      content: text
    };

    setMessages((prev) => [
      ...prev,
      userMessage
    ]);

    setInput("");

    setSending(true);

    setTimeout(() => {

      const aiReply =
        generateResponse(text);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: aiReply
        }
      ]);

      setSending(false);

    }, 1000);
  }

  // =========================
  // ENTER KEY
  // =========================
  function handleKeyDown(e) {

    if (
      e.key === "Enter" &&
      !e.shiftKey
    ) {

      e.preventDefault();

      sendMessage(input);
    }
  }

  // =========================
  // RESET CHAT
  // =========================
  function resetConversation() {

    setMessages([
      {
        role: "assistant",
        content:
`👋 Conversation reset.

How can I help your farm today?`
      }
    ]);
  }

  return (
    <div
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "20px",
        height: "100vh",
        display: "flex",
        flexDirection: "column"
      }}
    >

      {/* HEADER */}
      <div
        style={{
          display: "flex",
          justifyContent:
            "space-between",
          alignItems: "center",
          marginBottom: "20px"
        }}
      >

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px"
          }}
        >

          <div
            style={{
              width: "60px",
              height: "60px",
              borderRadius: "15px",
              background: "#dcfce7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "30px"
            }}
          >
            🐔
          </div>

          <div>
            <h1>
              Clucky AI
            </h1>

            <p>
              Poultry Farming Assistant
            </p>
          </div>

        </div>

        <button
          onClick={
            resetConversation
          }

          style={{
            padding:
              "10px 15px",
            borderRadius: "10px",
            border:
              "1px solid #ddd",
            cursor: "pointer",
            background: "white"
          }}
        >

          <RefreshCw
            size={16}
          />

        </button>

      </div>

      {/* CHAT AREA */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          border:
            "1px solid #ddd",
          borderRadius: "15px",
          padding: "20px",
          background: "#f9fafb"
        }}
      >

        {/* SUGGESTIONS */}
        {messages.length <= 1 && (

          <div
            style={{
              marginBottom:
                "20px"
            }}
          >

            {SUGGESTIONS.map((s) => (

              <button
                key={s}

                onClick={() =>
                  sendMessage(s)
                }

                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  marginBottom: "10px",
                  padding: "12px",
                  borderRadius: "12px",
                  border:
                    "1px solid #ddd",
                  cursor: "pointer",
                  background: "white"
                }}
              >
                {s}
              </button>

            ))}

          </div>
        )}

        {/* MESSAGES */}
        {messages.map(
          (msg, i) => (

            <MessageBubble
              key={i}
              message={msg}
            />

          )
        )}

        {/* LOADING */}
        {sending && (

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px"
            }}
          >

            <Loader2
              className="animate-spin"
              size={20}
            />

            <p>
              Clucky is thinking...
            </p>

          </div>
        )}

        <div ref={messagesEndRef} />

      </div>

      {/* INPUT */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginTop: "15px"
        }}
      >

        <input
          type="text"

          placeholder="Ask Clucky about poultry farming..."

          value={input}

          onChange={(e) =>
            setInput(
              e.target.value
            )
          }

          onKeyDown={
            handleKeyDown
          }

          disabled={sending}

          style={{
            flex: 1,
            padding: "15px",
            borderRadius: "12px",
            border:
              "1px solid #ccc"
          }}
        />

        <button
          onClick={() =>
            sendMessage(input)
          }

          disabled={
            !input.trim() ||
            sending
          }

          style={{
            padding:
              "15px 20px",
            borderRadius: "12px",
            background:
              "#16a34a",
            color: "white",
            border: "none",
            cursor: "pointer"
          }}
        >

          <Send size={18} />

        </button>

      </div>

    </div>
  );
}