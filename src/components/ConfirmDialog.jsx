import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

// A question the person has to answer before something that cannot be
// undone. Replaces window.confirm(), which several in-app browsers (the
// ones that open a link from WhatsApp or Facebook) silently answer "no".
//
// The dialog stays open while `busy`, shows `error` inside itself so a
// failed attempt can be retried without starting over, and gives focus
// back to whatever opened it when it closes. It is drawn directly under
// <body>: a card with a CSS transform would otherwise trap a fixed box
// inside itself.
export default function ConfirmDialog({
  title, children, confirmLabel = "Confirm", busyLabel = "Working...", cancelLabel = "Cancel",
  danger = false, busy = false, error = "", icon: Icon, onConfirm, onCancel
}) {
  const id = useId();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    cancelRef.current?.focus();
    return () => { if (opener instanceof HTMLElement) opener.focus(); };
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && !busy) { onCancel(); return; }
      if (e.key !== "Tab") return;
      // keep the keyboard inside the dialog
      const stops = dialogRef.current?.querySelectorAll("button:not([disabled])");
      if (!stops?.length) return;
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return createPortal(
    <div className="fc-dialog-backdrop" onClick={() => !busy && onCancel()}>
      <div
        ref={dialogRef}
        className="fc-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        onClick={e => e.stopPropagation()}
      >
        <h2 id={`${id}-title`}>{title}</h2>
        <div id={`${id}-text`} className="fc-dialog-text">{children}</div>
        {error && <p role="alert" className="fc-dialog-error">{error}</p>}
        <div className="fc-dialog-actions">
          <button ref={cancelRef} type="button" className="fc-btn fc-btn--secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`fc-btn ${danger ? "fc-btn--danger-solid" : "fc-btn--primary"}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {Icon && <Icon size={16} aria-hidden="true" />} {busy ? busyLabel : error ? "Try again" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
