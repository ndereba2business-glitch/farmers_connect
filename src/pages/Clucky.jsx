import { useState } from "react";

export default function Clucky() {
  const [question, setQuestion] = useState("");

  const [messages, setMessages] = useState([
    {
      sender: "Clucky",
      text: "Hey farmer 👋 I’m Clucky, your poultry assistant. Ask me anything."
    }
  ]);

  function generateReply(input) {
    const q = input.toLowerCase();

    if (q.includes("cough") || q.includes("sneezing")) {
      return "Possible respiratory infection. Isolate affected birds and improve ventilation.";
    }

    if (q.includes("not eating") || q.includes("weak")) {
      return "This may be stress, worms, or infection. Ensure clean water and balanced feed.";
    }

    if (q.includes("eggs")) {
      return "Egg drop can be caused by poor nutrition, stress, or lighting issues.";
    }

    if (q.includes("broiler")) {
      return "Broilers need high protein feed and controlled temperature for fast growth.";
    }

    if (q.includes("layer")) {
      return "Layers require calcium-rich feed for strong egg production.";
    }

    return "Clucky here 🐔 I recommend consulting a vet for a more precise diagnosis.";
  }

  function sendQuestion() {
    if (!question) return;

    const userMsg = {
      sender: "Farmer",
      text: question
    };

    const cluckyMsg = {
      sender: "Clucky",
      text: generateReply(question)
    };

    setMessages((prev) => [...prev, userMsg, cluckyMsg]);

    setQuestion("");
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Clucky AI Assistant 🐔</h1>

      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "10px",
          padding: "15px",
          height: "450px",
          overflowY: "auto",
          background: "#f9f9f9",
          marginBottom: "20px"
        }}
      >
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              marginBottom: "15px",
              textAlign:
                msg.sender === "Farmer"
                  ? "right"
                  : "left"
            }}
          >
            <div
              style={{
                display: "inline-block",
                background:
                  msg.sender === "Farmer"
                    ? "#d1e7dd"
                    : "#ffffff",
                padding: "10px",
                borderRadius: "10px",
                maxWidth: "80%"
              }}
            >
              <strong>{msg.sender}</strong>
              <p>{msg.text}</p>
            </div>
          </div>
        ))}
      </div>

      <textarea
        rows="4"
        placeholder="Ask Clucky..."
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        style={{ width: "100%", padding: "10px" }}
      />

      <br /><br />

      <button onClick={sendQuestion}>
        Ask Clucky
      </button>
    </div>
  );
}