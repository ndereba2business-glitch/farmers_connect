import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Ban, Copy, CornerUpLeft, Flag, Image as ImageIcon, Info, Reply, Send, Trash2, Users, X, ZoomIn } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useFillHeight } from "../lib/useFillHeight";
import { IMAGE_ACCEPT, removeImageByUrl, uploadImage, validateImage } from "../lib/imageUpload";
import {
  BADGE_LABELS, GROUP_RULES, MESSAGE_MAX_LENGTH, QUICK_EMOJIS,
  applyMyReaction, buildTimeline, nameColour, removedText, sendErrorMessage, summariseReactions, timeLabel
} from "../lib/community";
import "./Community.css";

const COLUMNS =
  "id, user_email, user_name, message, image_url, sender_badge, created_at, " +
  "reply_to_id, reply_to_user, reply_to_message, removed_at, removed_by";
const WITH_REACTIONS = `${COLUMNS}, reactions:message_reactions(user_email, emoji)`;
const PAGE_SIZE = 40;
const REPORT_REASONS = ["Not about poultry", "Insulting or abusive", "Spam or a scam", "Something else"];

function Sheet({ title, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus();
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cm-overlay" onClick={onClose}>
      <div
        className="cm-sheet" role="dialog" aria-modal="true" aria-label={title}
        tabIndex={-1} ref={ref} onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export default function Community() {
  const { user, userEmail, profile, isAdmin } = useAuth();
  const toast = useToast();
  const displayName = profile?.full_name || "Farmer";

  const [messages, setMessages] = useState([]);       // oldest first
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);            // bumped by "Try again"
  const [hasEarlier, setHasEarlier] = useState(false);
  const [loadingEarlier, setLoadingEarlier] = useState(false);
  const [mutedUntil, setMutedUntil] = useState(null);

  const [input, setInput] = useState("");
  const [photo, setPhoto] = useState(null);           // { file, preview }
  const [replyingTo, setReplyingTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const [activeId, setActiveId] = useState(null);     // message whose action sheet is open
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [reporting, setReporting] = useState(null);   // message being reported
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [reportNote, setReportNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState(null);
  const [flashId, setFlashId] = useState(null);

  const pageRef = useRef(null);
  const listRef = useRef(null);
  const contentRef = useRef(null);
  const contentHeight = useRef(0);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const nearBottom = useRef(true);
  const restoreFrom = useRef(null);                   // scroll height before older messages were added
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useFillHeight(pageRef);

  // ---------- keeping the list up to date ----------

  const mergeMessages = useCallback((incoming) => {
    setMessages(current => {
      const byId = new Map(current.map(m => [m.id, m]));
      for (const m of incoming) {
        const known = byId.get(m.id);
        // realtime rows don't carry reactions; keep the ones already loaded
        byId.set(m.id, { ...known, ...m, reactions: m.reactions ?? known?.reactions ?? [] });
      }
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const patchMessage = useCallback((id, changes) => {
    setMessages(current => current.map(m => (m.id === id ? { ...m, ...changes } : m)));
  }, []);

  // Anything sent while this phone was offline or the tab was in the
  // background, plus reaction changes on the messages already shown.
  const catchUp = useCallback(async () => {
    const loaded = messagesRef.current;
    if (!loaded.length) return;
    const { data, error } = await supabase
      .from("community_chat")
      .select(WITH_REACTIONS)
      .gte("created_at", loaded[0].created_at)
      .order("created_at", { ascending: true })
      .limit(500);
    if (!error && data) mergeMessages(data);
  }, [mergeMessages]);

  useEffect(() => {
    if (!userEmail) return undefined;
    let cancelled = false;
    let reactionTimer = null;

    async function loadLatest() {
      const { data, error } = await supabase
        .from("community_chat")
        .select(WITH_REACTIONS)
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (cancelled) return;
      setLoading(false);
      if (error) {
        console.error("Community: loading messages failed —", error.message);
        setLoadError(true);
        return;
      }
      setLoadError(false);
      setHasEarlier((data || []).length === PAGE_SIZE);
      nearBottom.current = true;
      mergeMessages(data || []);
    }

    loadLatest();

    supabase.from("community_mutes").select("muted_until").eq("user_email", userEmail).maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data && new Date(data.muted_until) > new Date()) setMutedUntil(data.muted_until);
      });

    const channel = supabase
      .channel("community-group")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "community_chat" },
        payload => mergeMessages([payload.new]))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "community_chat" },
        payload => mergeMessages([payload.new.removed_at ? { ...payload.new, reactions: [] } : payload.new]))
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        // A removed reaction arrives without its message id, so reload the
        // reactions for what's on screen; batched in case several land together.
        clearTimeout(reactionTimer);
        reactionTimer = setTimeout(catchUp, 400);
      })
      .subscribe();

    function onVisible() {
      if (document.visibilityState === "visible") catchUp();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", catchUp);

    return () => {
      cancelled = true;
      clearTimeout(reactionTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", catchUp);
      supabase.removeChannel(channel);
    };
  }, [userEmail, attempt, catchUp, mergeMessages]);

  async function loadEarlier() {
    if (!messages.length || loadingEarlier) return;
    setLoadingEarlier(true);
    const { data, error } = await supabase
      .from("community_chat")
      .select(WITH_REACTIONS)
      .lt("created_at", messages[0].created_at)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);
    setLoadingEarlier(false);
    if (error) {
      toast.error("Earlier messages didn't load. Check your connection and try again.");
      return;
    }
    setHasEarlier((data || []).length === PAGE_SIZE);
    restoreFrom.current = listRef.current?.scrollHeight ?? null;
    mergeMessages(data || []);
  }

  // Stay at the newest message unless the person has scrolled up to read,
  // and keep their place when older messages are added above.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (restoreFrom.current !== null) {
      list.scrollTop += list.scrollHeight - restoreFrom.current;
      restoreFrom.current = null;
    } else if (nearBottom.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages]);

  // Photos finish loading after the list is first drawn and make it
  // taller. Watching the content's height keeps the newest message in
  // view when that happens, without fighting someone who has scrolled up.
  useEffect(() => {
    const list = listRef.current;
    const content = contentRef.current;
    if (!list || !content || !window.ResizeObserver) return undefined;
    const observer = new ResizeObserver(() => {
      contentHeight.current = content.offsetHeight;
      if (nearBottom.current && restoreFrom.current === null) list.scrollTop = list.scrollHeight;
    });
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  function onListScroll() {
    const list = listRef.current;
    // If the content has grown since it was last measured, this scroll
    // position is stale; the observer above is about to correct it.
    if (contentRef.current && contentRef.current.offsetHeight !== contentHeight.current) return;
    nearBottom.current = list.scrollHeight - list.scrollTop - list.clientHeight < 120;
  }

  // ---------- sending ----------

  function choosePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = validateImage(file);
    if (problem) {
      setSendError(problem);
      return;
    }
    setSendError("");
    setPhoto(current => {
      if (current) URL.revokeObjectURL(current.preview);
      return { file, preview: URL.createObjectURL(file) };
    });
  }

  function clearPhoto() {
    setPhoto(current => {
      if (current) URL.revokeObjectURL(current.preview);
      return null;
    });
  }

  async function send() {
    const text = input.trim();
    if ((!text && !photo) || sending) return;
    setSending(true);
    setSendError("");

    let imageUrl = null;
    if (photo) {
      try {
        imageUrl = await uploadImage(user.id, photo.file, "chat", "community-posts");
      } catch {
        setSendError("Your photo didn't upload. Check your connection and try again; your message is still here.");
        setSending(false);
        return;
      }
    }

    const { data, error } = await supabase
      .from("community_chat")
      .insert([{
        user_email: userEmail,
        user_name: displayName,
        message: text,
        image_url: imageUrl,
        reply_to_id: replyingTo?.id || null
      }])
      .select(COLUMNS)
      .single();

    setSending(false);
    if (error) {
      if (imageUrl) removeImageByUrl(imageUrl, user.id);
      setSendError(sendErrorMessage(error));
      return;
    }

    nearBottom.current = true;
    mergeMessages([{ ...data, reactions: [] }]);
    setInput("");
    setReplyingTo(null);
    clearPhoto();
    if (inputRef.current) inputRef.current.style.height = "";
    inputRef.current?.focus();
  }

  function onInputKeyDown(e) {
    // On a phone, Enter makes a new line (the send button sends), as in
    // chat apps; with a real keyboard, Enter sends and Shift+Enter breaks.
    const touch = window.matchMedia?.("(pointer: coarse)").matches;
    if (e.key === "Enter" && !e.shiftKey && !touch) {
      e.preventDefault();
      send();
    }
  }

  // ---------- actions on a message ----------

  const active = useMemo(() => messages.find(m => m.id === activeId) || null, [messages, activeId]);

  const closeSheet = useCallback(() => {
    setActiveId(null);
    setConfirmRemove(false);
  }, []);

  async function react(message, emoji) {
    const before = message.reactions || [];
    const { reactions, action } = applyMyReaction(before, userEmail, emoji);
    patchMessage(message.id, { reactions });
    closeSheet();

    const { error } = action === "remove"
      ? await supabase.from("message_reactions").delete().eq("message_id", message.id).eq("user_email", userEmail)
      : await supabase.from("message_reactions").upsert(
          { message_id: message.id, user_email: userEmail, user_name: displayName, emoji },
          { onConflict: "message_id,user_email" }
        );

    if (error) {
      patchMessage(message.id, { reactions: before });
      toast.error("Your reaction didn't save. Check your connection and try again.");
    }
  }

  function startReply(message) {
    setReplyingTo(message);
    closeSheet();
    inputRef.current?.focus();
  }

  async function copyText(message) {
    closeSheet();
    try {
      await navigator.clipboard.writeText(message.message);
      toast.success("Message copied.");
    } catch {
      toast.error("Couldn't copy on this phone.");
    }
  }

  async function removeMessage(message) {
    setBusy(true);
    const { error } = await supabase.rpc("community_remove_message", { p_message_id: message.id });
    setBusy(false);
    if (error) {
      toast.error("That message couldn't be removed. Check your connection and try again.");
      return;
    }
    const mine = message.user_email === userEmail;
    if (mine && message.image_url) removeImageByUrl(message.image_url, user.id);
    patchMessage(message.id, {
      message: "", image_url: null, reactions: [],
      removed_at: new Date().toISOString(), removed_by: mine ? "author" : "admin"
    });
    setMessages(current => current.map(m => (m.reply_to_id === message.id ? { ...m, reply_to_message: null } : m)));
    closeSheet();
  }

  async function pauseSender(message, hours) {
    setBusy(true);
    const { error } = await supabase.from("community_mutes").upsert({
      user_email: message.user_email,
      muted_until: new Date(Date.now() + hours * 3600000).toISOString(),
      reason: "Paused by an admin from the community chat",
      muted_by: userEmail
    }, { onConflict: "user_email" });
    setBusy(false);
    if (error) {
      toast.error("That member couldn't be paused. Check your connection and try again.");
      return;
    }
    toast.success(`${message.user_name} can't post for ${hours === 24 ? "24 hours" : `${hours / 24} days`}.`);
    closeSheet();
  }

  function startReport(message) {
    closeSheet();
    setReportReason(REPORT_REASONS[0]);
    setReportNote("");
    setReporting(message);
  }

  async function sendReport() {
    setBusy(true);
    const reason = reportNote.trim() ? `${reportReason}: ${reportNote.trim()}` : reportReason;
    const { error } = await supabase.from("community_reports").insert([{
      message_id: reporting.id, reporter: userEmail, reason: reason.slice(0, 300)
    }]);
    setBusy(false);
    // 23505 = this member already reported this message
    if (error && error.code !== "23505") {
      toast.error("Your report didn't send. Check your connection and try again.");
      return;
    }
    toast.success(error ? "You've already reported this message. An admin will review it." : "Thanks. An admin will review this message.");
    setReporting(null);
  }

  function jumpTo(messageId) {
    const el = document.getElementById(`cm-msg-${messageId}`);
    if (!el) {
      toast.info("That message is further up. Tap \"Load earlier messages\" to find it.");
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    setFlashId(messageId);
    setTimeout(() => setFlashId(current => (current === messageId ? null : current)), 1500);
  }

  // ---------- drawing ----------

  const timeline = useMemo(() => buildTimeline(messages), [messages]);
  const tooLong = input.length > MESSAGE_MAX_LENGTH;

  function renderMessage({ message, showSender }) {
    const mine = message.user_email === userEmail;
    const rowClass = `cm-row${mine ? " cm-row--mine" : ""}${showSender ? " cm-row--first" : ""}`;
    const colour = nameColour(message.user_email);

    const avatar = !mine && (
      <span
        className={`cm-avatar${showSender ? "" : " cm-avatar--gap"}`}
        style={{ background: colour }} aria-hidden="true"
      >
        {(message.user_name || "F").charAt(0).toUpperCase()}
      </span>
    );

    if (message.removed_at) {
      return (
        <div key={message.id} id={`cm-msg-${message.id}`} className={rowClass}>
          {avatar}
          <div className="cm-stack">
            <div className="cm-bubble cm-bubble--removed">
              <Ban size={14} aria-hidden="true" /> {removedText(message, userEmail)}
              <span className="cm-time">{timeLabel(message.created_at)}</span>
            </div>
          </div>
        </div>
      );
    }

    const reactions = summariseReactions(message.reactions, userEmail);
    const summary = message.message || "Photo";

    return (
      <div key={message.id} id={`cm-msg-${message.id}`} className={rowClass}>
        {avatar}
        <div className="cm-stack">
          <button
            className={`cm-bubble${flashId === message.id ? " cm-bubble--flash" : ""}`}
            onClick={() => setActiveId(message.id)}
            aria-haspopup="dialog"
            aria-label={`${mine ? "Your message" : `Message from ${message.user_name}`}: ${summary.slice(0, 80)}. Open actions`}
          >
            {!mine && showSender && (
              <span className="cm-name" style={{ color: colour }}>
                {message.user_name}
                {message.sender_badge && (
                  <span className={`cm-badge cm-badge--${message.sender_badge}`}>
                    {BADGE_LABELS[message.sender_badge]}
                  </span>
                )}
              </span>
            )}
            {message.reply_to_id && (
              <span className="cm-quote" style={{ display: "block" }}>
                <b>{message.reply_to_user || "Message"}</b>
                <span>{message.reply_to_message || "Message removed"}</span>
              </span>
            )}
            {message.image_url && (
              <img className="cm-photo" src={message.image_url} alt="Photo shared in the group" decoding="async" />
            )}
            {message.message && <span className="cm-text" style={{ display: "block" }}>{message.message}</span>}
            <span className="cm-time">{timeLabel(message.created_at)}</span>
          </button>

          {reactions.length > 0 && (
            <div className="cm-reactions">
              {reactions.map(r => (
                <button
                  key={r.emoji}
                  className={`cm-reaction${r.mine ? " cm-reaction--mine" : ""}`}
                  onClick={() => react(message, r.emoji)}
                  aria-pressed={r.mine}
                  aria-label={`${r.emoji} ${r.count} ${r.count === 1 ? "reaction" : "reactions"}${r.mine ? ", including yours. Tap to remove" : ". Tap to react the same"}`}
                >
                  <span>{r.emoji} {r.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const myReaction = active ? (active.reactions || []).find(r => r.user_email === userEmail)?.emoji : null;
  const activeIsMine = active?.user_email === userEmail;

  return (
    <div className="cm-page" ref={pageRef}>
      <header className="cm-head">
        <span className="cm-head-icon" aria-hidden="true"><Users size={20} /></span>
        <div className="cm-head-text">
          <h1 className="cm-head-title">Farmers Community</h1>
          <p className="cm-head-sub">Poultry farming only</p>
        </div>
        <button className="cm-icon-btn" onClick={() => setShowRules(true)} aria-label="Group rules">
          <Info size={20} />
        </button>
      </header>

      <div className="cm-list" ref={listRef} onScroll={onListScroll}>
        <div className="cm-list-inner" ref={contentRef}>
        {loading && <p className="cm-status">Loading messages...</p>}

        {!loading && loadError && (
          <div className="cm-status" role="alert">
            <p>We couldn't load the group. Check your connection and try again.</p>
            <button className="cm-retry" onClick={() => { setLoading(true); setLoadError(false); setAttempt(n => n + 1); }}>Try again</button>
          </div>
        )}

        {!loading && !loadError && (
          <>
            {hasEarlier ? (
              <button className="cm-earlier" onClick={loadEarlier} disabled={loadingEarlier}>
                {loadingEarlier ? "Loading..." : "Load earlier messages"}
              </button>
            ) : (
              <p className="cm-notice">
                This group is for poultry farming only. Be respectful, and report anything that doesn't belong.
              </p>
            )}

            {messages.length === 0 && (
              <p className="cm-status">No messages yet. Say hello and tell the group what birds you keep.</p>
            )}

            {timeline.map(item => (
              item.kind === "day"
                ? <div key={item.key} className="cm-day">{item.label}</div>
                : renderMessage(item)
            ))}
          </>
        )}
        </div>
      </div>

      {sendError && <div className="cm-error" role="alert">{sendError}</div>}

      {replyingTo && (
        <div className="cm-context">
          <Reply size={16} color="#166534" aria-hidden="true" />
          <div className="cm-context-text">
            <b>Replying to {replyingTo.user_email === userEmail ? "yourself" : replyingTo.user_name}</b>
            <span>{replyingTo.message || "Photo"}</span>
          </div>
          <button className="cm-icon-btn" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
            <X size={18} />
          </button>
        </div>
      )}

      {photo && (
        <div className="cm-context">
          <img src={photo.preview} alt="" />
          <div className="cm-context-text">
            <b>Photo attached</b>
            <span>Add a few words about it, then send.</span>
          </div>
          <button className="cm-icon-btn" onClick={clearPhoto} aria-label="Remove photo">
            <X size={18} />
          </button>
        </div>
      )}

      {mutedUntil ? (
        <div className="cm-muted" role="status">
          An admin has paused your posting in this group until{" "}
          {new Date(mutedUntil).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}.
          You can still read the group.
        </div>
      ) : (
        <div className="cm-composer">
          <input ref={fileRef} type="file" accept={IMAGE_ACCEPT} hidden onChange={choosePhoto} />
          <button className="cm-icon-btn" onClick={() => fileRef.current?.click()} aria-label="Add a photo">
            <ImageIcon size={22} />
          </button>
          <textarea
            ref={inputRef}
            className="cm-input"
            rows={1}
            aria-label="Message"
            placeholder={replyingTo ? "Type your reply" : "Message the group"}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyDown={onInputKeyDown}
          />
          <button
            className="cm-send"
            onClick={send}
            disabled={sending || tooLong || (!input.trim() && !photo)}
            aria-label={sending ? "Sending" : "Send message"}
          >
            <Send size={20} />
          </button>
        </div>
      )}

      {tooLong && (
        <div className="cm-error" role="alert">
          That's {input.length - MESSAGE_MAX_LENGTH} characters too long. Shorten it or split it into two messages.
        </div>
      )}

      {/* ---------- message actions ---------- */}
      {active && !active.removed_at && (
        <Sheet title="Message actions" onClose={closeSheet}>
          <p className="cm-sheet-preview">
            <b>{activeIsMine ? "You" : active.user_name}:</b> {active.message || "Photo"}
          </p>

          {confirmRemove ? (
            <>
              <h2>Remove this message for everyone?</h2>
              <button className="cm-primary cm-primary--danger" onClick={() => removeMessage(active)} disabled={busy}>
                {busy ? "Removing..." : "Yes, remove it"}
              </button>
              <button className="cm-action cm-action--cancel" onClick={() => setConfirmRemove(false)}>Keep it</button>
            </>
          ) : (
            <>
              <div className="cm-emoji-row">
                {QUICK_EMOJIS.map(emoji => (
                  <button
                    key={emoji}
                    className={`cm-emoji${myReaction === emoji ? " cm-emoji--mine" : ""}`}
                    onClick={() => react(active, emoji)}
                    aria-pressed={myReaction === emoji}
                    aria-label={myReaction === emoji ? `Remove your ${emoji} reaction` : `React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <button className="cm-action" onClick={() => startReply(active)}>
                <Reply size={18} aria-hidden="true" /> Reply
              </button>
              {active.reply_to_id && (
                <button className="cm-action" onClick={() => { const target = active.reply_to_id; closeSheet(); jumpTo(target); }}>
                  <CornerUpLeft size={18} aria-hidden="true" /> Go to the message this replies to
                </button>
              )}
              {active.image_url && (
                <button className="cm-action" onClick={() => { setViewingPhoto(active.image_url); closeSheet(); }}>
                  <ZoomIn size={18} aria-hidden="true" /> View photo
                </button>
              )}
              {active.message && (
                <button className="cm-action" onClick={() => copyText(active)}>
                  <Copy size={18} aria-hidden="true" /> Copy text
                </button>
              )}
              {!activeIsMine && (
                <button className="cm-action" onClick={() => startReport(active)}>
                  <Flag size={18} aria-hidden="true" /> Report to admins
                </button>
              )}
              {(activeIsMine || isAdmin) && (
                <button className="cm-action cm-action--danger" onClick={() => setConfirmRemove(true)}>
                  <Trash2 size={18} aria-hidden="true" /> {activeIsMine ? "Delete for everyone" : "Remove message (admin)"}
                </button>
              )}
              {isAdmin && !activeIsMine && (
                <>
                  <button className="cm-action cm-action--danger" onClick={() => pauseSender(active, 24)} disabled={busy}>
                    <Ban size={18} aria-hidden="true" /> Stop {active.user_name} posting for 24 hours
                  </button>
                  <button className="cm-action cm-action--danger" onClick={() => pauseSender(active, 168)} disabled={busy}>
                    <Ban size={18} aria-hidden="true" /> Stop {active.user_name} posting for 7 days
                  </button>
                </>
              )}
              <button className="cm-action cm-action--cancel" onClick={closeSheet}>Cancel</button>
            </>
          )}
        </Sheet>
      )}

      {/* ---------- report ---------- */}
      {reporting && (
        <Sheet title="Report message" onClose={() => setReporting(null)}>
          <h2>Report this message</h2>
          <p className="cm-sheet-preview"><b>{reporting.user_name}:</b> {reporting.message || "Photo"}</p>
          <span className="cm-field-label" id="cm-reason-label">What's wrong with it?</span>
          <div className="cm-chips" role="group" aria-labelledby="cm-reason-label">
            {REPORT_REASONS.map(reason => (
              <button
                key={reason}
                className={`cm-chip${reportReason === reason ? " cm-chip--on" : ""}`}
                aria-pressed={reportReason === reason}
                onClick={() => setReportReason(reason)}
              >
                {reason}
              </button>
            ))}
          </div>
          <label className="cm-field-label" htmlFor="cm-report-note">Anything to add? (optional)</label>
          <textarea
            id="cm-report-note" className="cm-reason" maxLength={200}
            value={reportNote} onChange={e => setReportNote(e.target.value)}
          />
          <button className="cm-primary" onClick={sendReport} disabled={busy}>
            {busy ? "Sending..." : "Send report"}
          </button>
          <button className="cm-action cm-action--cancel" onClick={() => setReporting(null)}>Cancel</button>
        </Sheet>
      )}

      {/* ---------- rules ---------- */}
      {showRules && (
        <Sheet title="Group rules" onClose={() => setShowRules(false)}>
          <h2>Group rules</h2>
          <ol className="cm-rules">
            {GROUP_RULES.map(rule => <li key={rule}>{rule}</li>)}
          </ol>
          <button className="cm-primary" onClick={() => setShowRules(false)}>Got it</button>
        </Sheet>
      )}

      {viewingPhoto && (
        <div className="cm-viewer" role="dialog" aria-modal="true" aria-label="Photo" onClick={() => setViewingPhoto(null)}>
          <img src={viewingPhoto} alt="Photo shared in the group" />
          <button className="cm-icon-btn" onClick={() => setViewingPhoto(null)} aria-label="Close photo" autoFocus>
            <X size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
