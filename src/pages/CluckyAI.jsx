import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bird, RotateCcw, Send } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useFillHeight } from "../lib/useFillHeight";
import {
  MAX_QUESTION_LENGTH, SUGGESTIONS, applyEvent, cluckyErrorMessage, createEventParser, startingAnswer
} from "../lib/clucky";
import "./Clucky.css";

// The answer comes from the "clucky" edge function, which holds the AI
// key. The browser only ever sends the question and its own sign-in token.
const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/clucky`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function CluckyAI() {
  const { userEmail, profile } = useAuth();
  const toast = useToast();
  const firstName = (profile?.full_name || "").trim().split(/\s+/)[0];

  const [messages, setMessages] = useState([]);       // oldest first
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [input, setInput] = useState("");
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);

  const pageRef = useRef(null);
  const listRef = useRef(null);
  const contentRef = useRef(null);
  const inputRef = useRef(null);
  const requestRef = useRef(null);
  const nearBottom = useRef(true);

  useFillHeight(pageRef);

  useEffect(() => {
    if (!userEmail) return undefined;
    let cancelled = false;

    async function load() {
      const { data, error: loadFailure } = await supabase
        .from("clucky_messages")
        .select("id, role, content, created_at")
        .eq("user_email", userEmail)
        .order("created_at", { ascending: false })
        .limit(60);
      if (cancelled) return;
      setLoading(false);
      if (loadFailure) {
        console.error("Clucky: loading the conversation failed —", loadFailure.message);
        setLoadError(true);
        return;
      }
      setLoadError(false);
      setMessages((data || []).reverse());
    }

    load();
    return () => { cancelled = true; };
  }, [userEmail, attempt]);

  // Leaving the page drops the connection. The function notices, finishes
  // the answer anyway, saves it, and sends a notification instead.
  useEffect(() => () => requestRef.current?.abort(), []);

  // Follow the answer as it grows, unless the person has scrolled up.
  useEffect(() => {
    const list = listRef.current;
    const content = contentRef.current;
    if (!list || !content || !window.ResizeObserver) return undefined;
    const observer = new ResizeObserver(() => {
      if (nearBottom.current) list.scrollTop = list.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  function onListScroll() {
    const list = listRef.current;
    nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  }

  async function ask(text) {
    const question = text.trim();
    if (!question || asking) return;
    if (question.length > MAX_QUESTION_LENGTH) {
      setError(cluckyErrorMessage("too_long"));
      return;
    }

    setError("");
    setAsking(true);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "";
    nearBottom.current = true;

    const stamp = Date.now();
    const questionId = `local-question-${stamp}`;
    const answerId = `local-answer-${stamp}`;
    setMessages(current => [
      ...current,
      { id: questionId, role: "user", content: question },
      { id: answerId, role: "assistant", content: "", pending: true }
    ]);

    // Nothing was answered: take the pair back out and put the question
    // back in the box so it isn't lost.
    const giveUp = (code, details) => {
      setMessages(current => current.filter(m => m.id !== questionId && m.id !== answerId));
      setInput(question);
      setError(cluckyErrorMessage(code, details));
      setAsking(false);
    };

    const controller = new AbortController();
    requestRef.current = controller;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(FUNCTION_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${session?.access_token || ""}`
        },
        body: JSON.stringify({ message: question })
      });

      if (!response.ok || !response.body) {
        const problem = await response.json().catch(() => ({}));
        giveUp(response.status === 401 ? "not_signed_in" : problem.code || "failed", problem);
        return;
      }

      let answer = startingAnswer();
      const parser = createEventParser(event => {
        answer = applyEvent(answer, event);
        const text = answer.text;
        setMessages(current => current.map(m => (m.id === answerId ? { ...m, content: text, pending: !text } : m)));
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parser.push(decoder.decode(value, { stream: true }));
      }
      parser.finish();

      if (answer.status === "error" || !answer.text) {
        giveUp(answer.code || "failed");
        return;
      }

      // "done" never arrived: the connection dropped partway. Keep what
      // came through, and say it may be incomplete.
      const cutShort = answer.status !== "done";
      setMessages(current => current.map(m => (m.id === answerId
        ? { ...m, content: answer.text, pending: false, truncated: answer.truncated, cutShort }
        : m)));
      setAsking(false);
    } catch (failure) {
      if (controller.signal.aborted) return; // the person left the page
      console.error("Clucky: asking failed —", failure.message);
      giveUp(navigator.onLine === false ? "offline" : "failed");
    }
  }

  function onKeyDown(e) {
    // On a phone Enter makes a new line and the button sends; with a real
    // keyboard Enter sends and Shift+Enter breaks the line.
    const touch = window.matchMedia?.("(pointer: coarse)").matches;
    if (e.key === "Enter" && !e.shiftKey && !touch) {
      e.preventDefault();
      ask(input);
    }
  }

  async function clearConversation() {
    setConfirmClear(false);
    const { error: clearFailure } = await supabase.from("clucky_messages").delete().eq("user_email", userEmail);
    if (clearFailure) {
      toast.error("The conversation couldn't be cleared. Check your connection and try again.");
      return;
    }
    setMessages([]);
    setError("");
  }

  const tooLong = input.length > MAX_QUESTION_LENGTH;

  return (
    <div className="ck-page" ref={pageRef}>
      <header className="ck-head">
        <span className="ck-head-icon" aria-hidden="true"><Bird size={22} /></span>
        <div className="ck-head-text">
          <h1 className="ck-head-title">Clucky AI</h1>
          <p className="ck-head-sub">Your poultry assistant</p>
        </div>
        {messages.length > 0 && !asking && (
          <button className="ck-head-btn" onClick={() => setConfirmClear(true)}>
            <RotateCcw size={16} aria-hidden="true" /> New chat
          </button>
        )}
      </header>

      {confirmClear && (
        <div className="ck-confirm" role="alertdialog" aria-label="Start a new chat">
          <span>Start a new chat? This clears your conversation with Clucky.</span>
          <button className="ck-head-btn" onClick={clearConversation}>Yes, clear it</button>
          <button className="ck-head-btn" onClick={() => setConfirmClear(false)}>Keep it</button>
        </div>
      )}

      <div className="ck-list" ref={listRef} onScroll={onListScroll}>
        <div className="ck-list-inner" ref={contentRef} aria-live="polite">
          {loading && <p className="ck-status">Loading your conversation...</p>}

          {!loading && loadError && (
            <div className="ck-status" role="alert">
              We couldn't load your conversation. Check your connection and try again.
              <button onClick={() => { setLoading(true); setLoadError(false); setAttempt(n => n + 1); }}>Try again</button>
            </div>
          )}

          {!loading && !loadError && messages.length === 0 && (
            <div className="ck-welcome">
              <span className="ck-welcome-icon" aria-hidden="true"><Bird size={28} /></span>
              <h2>{firstName ? `Hello ${firstName}, I'm Clucky` : "Hello, I'm Clucky"}</h2>
              <p>
                Ask me anything about your chickens: health, vaccines, feeding, eggs, housing or costs.
                I know the batches you've recorded in My Farm, so my answers fit your birds.
              </p>
              <div className="ck-suggestions">
                {SUGGESTIONS.map(suggestion => (
                  <button key={suggestion} className="ck-suggestion" onClick={() => ask(suggestion)}>
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(message => (
            <div key={message.id} className={`ck-row${message.role === "user" ? " ck-row--me" : ""}`}>
              <div className="ck-bubble">
                {message.pending ? (
                  <span className="ck-thinking">
                    <span className="ck-dots" aria-hidden="true"><i /><i /><i /></span>
                    Clucky is thinking
                  </span>
                ) : message.content}
                {message.truncated && (
                  <span className="ck-note">That answer was cut off for length. Ask Clucky to continue.</span>
                )}
                {message.cutShort && (
                  <span className="ck-note">The connection dropped, so this answer may be incomplete. Ask again to get the rest.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {(error || tooLong) && (
        <div className="ck-error" role="alert">
          {tooLong
            ? `That's ${(input.length - MAX_QUESTION_LENGTH).toLocaleString()} characters too long. Shorten your question.`
            : error}
        </div>
      )}

      <div className="ck-composer">
        <textarea
          ref={inputRef}
          className="ck-input"
          rows={1}
          aria-label="Ask Clucky a question"
          placeholder="Ask about your chickens"
          value={input}
          onChange={e => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 130)}px`;
          }}
          onKeyDown={onKeyDown}
        />
        <button
          className="ck-send"
          onClick={() => ask(input)}
          disabled={asking || tooLong || !input.trim()}
          aria-label={asking ? "Clucky is answering" : "Send question"}
        >
          <Send size={20} />
        </button>
      </div>

      <p className="ck-foot">
        AI answers can be wrong. Sick birds? <Link to="/bookings">Ask a vet</Link>
      </p>
    </div>
  );
}
