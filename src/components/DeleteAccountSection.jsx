import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";
import { Trash2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { CONFIRM_WORD, DELETED_ITEMS, KEPT_ITEMS, deleteErrorMessage, deleteMyAccount, hasPassword } from "../lib/account";
import { POLICIES_PUBLISHED } from "../config/features";
import "./Account.css";

// The form that actually deletes the account: the word DELETE, and the
// password for accounts that have one. Kept open on failure so the person
// can correct and retry; nothing has been removed until it says so.
function DeleteDialog({ onClose, onDeleted }) {
  const id = useId();
  const { user } = useAuth();
  const withPassword = hasPassword(user);
  const [word, setWord] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const firstField = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    firstField.current?.focus();
    function onKey(e) { if (e.key === "Escape" && !busy) onClose(); }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [busy, onClose]);

  const ready = word.trim() === CONFIRM_WORD && (!withPassword || password.length > 0);

  async function submit(e) {
    e.preventDefault();
    if (busy || !ready) return;
    setBusy(true);
    setError("");
    const result = await deleteMyAccount({ password: withPassword ? password : "" });
    if (!result.ok) {
      setBusy(false);
      setError(deleteErrorMessage(result.code));
      return;
    }
    onDeleted();
  }

  return createPortal(
    <div className="fc-dialog-backdrop" onClick={() => !busy && onClose()}>
      <form
        className="fc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        noValidate
      >
        <h2 id={`${id}-title`}>Delete your account for good?</h2>
        <div className="fc-dialog-text">
          <p>This cannot be undone. Your records, listings, messages and photos are deleted now, not hidden, and nobody can bring them back.</p>
        </div>

        <label className="ac-field" htmlFor={`${id}-word`}>
          <span>Type {CONFIRM_WORD} to confirm</span>
          <input
            ref={firstField}
            id={`${id}-word`}
            className="ac-input"
            value={word}
            onChange={e => setWord(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck="false"
            disabled={busy}
          />
        </label>

        {withPassword ? (
          <label className="ac-field" htmlFor={`${id}-password`}>
            <span>Your password</span>
            <input
              id={`${id}-password`}
              className="ac-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={busy}
            />
          </label>
        ) : (
          <p className="ac-hint">
            You sign in with Google, so there is no password to check. If you signed in more than ten minutes ago,
            sign out, sign in again, and come straight back here.
          </p>
        )}

        {error && <p role="alert" className="fc-dialog-error">{error}</p>}

        <div className="fc-dialog-actions">
          <button type="button" className="fc-btn fc-btn--secondary" disabled={busy} onClick={onClose}>Keep my account</button>
          <button type="submit" className="fc-btn fc-btn--danger-solid" disabled={busy || !ready}>
            <Trash2 size={16} aria-hidden="true" /> {busy ? "Deleting..." : "Delete my account"}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

// "Delete my account", shown on every role's profile page and on the
// public /delete-account page. It says what goes and what stays before
// asking for anything.
export default function DeleteAccountSection({ headingLevel = 2 }) {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const Heading = `h${headingLevel}`;

  // The goodbye page clears this browser's session once it is on screen
  // (see AccountDeleted.jsx for why it is not done here).
  function finished() {
    navigate("/account-deleted", { replace: true, state: { deleted: true } });
  }

  if (!user) return null;

  return (
    <section className="fc-card ac-delete" id="delete-account" aria-labelledby="ac-delete-title">
      <Heading id="ac-delete-title" className="ac-title">Delete my account</Heading>
      <p className="ac-text">
        Deleting your account removes it and your data permanently. It is not a pause: you would have to sign up again and start from nothing.
      </p>

      <details className="ac-details">
        <summary>What is deleted, and what stays</summary>
        <h3>Deleted straight away</h3>
        <ul>{DELETED_ITEMS.map(item => <li key={item}>{item}</li>)}</ul>
        <h3>Kept</h3>
        <ul>{KEPT_ITEMS.map(item => <li key={item}>{item}</li>)}</ul>
        {POLICIES_PUBLISHED && <p>More detail is in the <Link to="/privacy#deletion">Privacy Policy</Link>.</p>}
      </details>

      {role === "admin" ? (
        <p className="ac-hint">This is an administrator account. It is removed by the project owner, not from here.</p>
      ) : (
        <button type="button" className="fc-btn fc-btn--danger ac-open" onClick={() => setOpen(true)}>
          <Trash2 size={16} aria-hidden="true" /> Delete my account
        </button>
      )}

      {open && <DeleteDialog onClose={() => setOpen(false)} onDeleted={finished} />}
    </section>
  );
}
