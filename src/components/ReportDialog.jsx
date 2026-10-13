import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Flag } from "lucide-react";
import "./Account.css";

// Asks why something is being reported, then hands the reason to onSubmit,
// which resolves to { ok, already }. Used for listings, Clucky's answers
// and members. Stays open on failure with what was typed, and closes
// itself only when the report has really been sent.
export default function ReportDialog({ title, preview, reasons, onSubmit, onClose, onSent }) {
  const id = useId();
  const [reason, setReason] = useState(reasons[0]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstChip = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    firstChip.current?.focus();
    function onKey(e) { if (e.key === "Escape" && !busy) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [busy, onClose]);

  async function send(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const result = await onSubmit(note.trim() ? `${reason}: ${note.trim()}` : reason);
    setBusy(false);
    if (!result?.ok) {
      setError("Your report didn't send. Check your connection and try again.");
      return;
    }
    onSent(result.already);
  }

  return createPortal(
    <div className="fc-dialog-backdrop" onClick={() => !busy && onClose()}>
      <form className="fc-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} onClick={e => e.stopPropagation()} onSubmit={send}>
        <h2 id={`${id}-title`}>{title}</h2>
        {preview && <p className="ac-report-preview">{preview}</p>}

        <fieldset className="ac-reasons">
          <legend>What is wrong with it?</legend>
          {reasons.map((option, index) => (
            <button
              key={option}
              ref={index === 0 ? firstChip : undefined}
              type="button"
              className={`ac-chip${reason === option ? " ac-chip--on" : ""}`}
              aria-pressed={reason === option}
              disabled={busy}
              onClick={() => setReason(option)}
            >
              {option}
            </button>
          ))}
        </fieldset>

        <label className="ac-field" htmlFor={`${id}-note`}>
          <span>Anything to add? (optional)</span>
          <textarea id={`${id}-note`} className="ac-input" maxLength={200} value={note} onChange={e => setNote(e.target.value)} disabled={busy} />
        </label>

        <p className="ac-hint">Reports go to the administrators. The person you report is not told who reported them.</p>
        {error && <p role="alert" className="fc-dialog-error">{error}</p>}

        <div className="fc-dialog-actions">
          <button type="button" className="fc-btn fc-btn--secondary" disabled={busy} onClick={onClose}>Cancel</button>
          <button type="submit" className="fc-btn fc-btn--primary" disabled={busy}>
            <Flag size={16} aria-hidden="true" /> {busy ? "Sending..." : "Send report"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}
