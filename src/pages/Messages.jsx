import { useEffect, useState } from "react";
// Import your actual conversation components or logic here when ready

export default function Messages() {
  const [conversations, setConversations] = useState([]);

  return (
    <div style={{ 
      padding: "24px", 
      height: "100vh", 
      backgroundColor: "#f9fafb", 
      fontFamily: "sans-serif",
      display: "flex",
      gap: "24px"
    }}>
      
      {/* LEFT PANE - Conversations List */}
      <div style={{
        width: "350px",
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        padding: "24px"
      }}>
        <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#111827", margin: "0 0 24px 0" }}>
          Messages
        </h2>

        {/* Empty State for Left Pane */}
        {conversations.length === 0 && (
          <div style={{ margin: "auto", textAlign: "center", color: "#9ca3af" }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: "0 auto 12px auto", opacity: 0.5 }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p style={{ margin: 0, fontSize: "15px" }}>No conversations yet</p>
          </div>
        )}
      </div>

      {/* RIGHT PANE - Chat Window Area */}
      <div style={{
        flex: 1,
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px"
      }}>
        
        {/* Empty State for Right Pane */}
        <div style={{ textAlign: "center", color: "#9ca3af" }}>
          <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin: "0 auto 16px auto", opacity: 0.5 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p style={{ margin: 0, fontSize: "16px" }}>Select a conversation to start chatting</p>
        </div>

      </div>

    </div>
  );
}