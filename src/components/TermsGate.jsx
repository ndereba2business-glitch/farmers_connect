import { useId, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { APP_NAME, MINIMUM_AGE, TERMS_VERSION } from "../config/legal";
import { POLICIES_PUBLISHED } from "../config/features";
import "./Account.css";

// Asks a signed-in person to accept the Terms and Community Rules before
// they use the app, once per version. New accounts accept on the sign-up
// form; this catches everyone who joined before the terms existed, people
// who sign up with Google (that journey skips the form), and everyone
// again when TERMS_VERSION changes. Mounted by both layout shells.
export default function TermsGate() {
  const id = useId();
  const { profile, userEmail, logout, acceptTerms } = useAuth();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Nobody is asked to accept documents the owner has not yet published.
  if (!POLICIES_PUBLISHED) return null;
  // Until the profile has loaded there is nothing to judge by, and a
  // profile that could not be read must not lock anyone out.
  if (!profile || !userEmail) return null;
  if (profile.terms_accepted_at && profile.terms_version === TERMS_VERSION) return null;

  async function accept() {
    if (busy || !agreed) return;
    setBusy(true);
    setError("");
    const acceptedAt = new Date().toISOString();
    const { data, error: failure } = await supabase
      .from("farmer_profiles")
      .update({ terms_accepted_at: acceptedAt, terms_version: TERMS_VERSION })
      .eq("user_email", userEmail)
      .select("id");
    setBusy(false);
    if (failure || !data?.length) {
      setError("That didn't save. Check your connection and try again.");
      return;
    }
    acceptTerms(acceptedAt, TERMS_VERSION);
  }

  return createPortal(
    <div className="fc-dialog-backdrop">
      <div className="fc-dialog" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`}>
        <h2 id={`${id}-title`}>{profile.terms_accepted_at ? "Our terms have changed" : `Before you continue with ${APP_NAME}`}</h2>
        <div className="fc-dialog-text">
          <p>Please read and accept these. In short:</p>
        </div>
        <ul className="ac-terms-list">
          <li>Keep the community and marketplace about poultry farming, honest and respectful. No scams, insults, adult content or betting and loan adverts.</li>
          <li>You can report or block anything that does not belong, and administrators can remove content and pause accounts.</li>
          <li>Clucky is an AI assistant, not a vet. It can be wrong.</li>
          <li>You can delete your account and your data at any time from your profile.</li>
        </ul>
        <label className="ac-check">
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} disabled={busy} />
          <span>
            I am {MINIMUM_AGE} or older, and I agree to the{" "}
            <Link to="/terms" target="_blank" rel="noopener">Terms and Community Rules</Link> and have read the{" "}
            <Link to="/privacy" target="_blank" rel="noopener">Privacy Policy</Link>.
          </span>
        </label>
        {error && <p role="alert" className="fc-dialog-error">{error}</p>}
        <div className="fc-dialog-actions">
          <button type="button" className="fc-btn fc-btn--secondary" disabled={busy} onClick={logout}>Sign out</button>
          <button type="button" className="fc-btn fc-btn--primary" disabled={busy || !agreed} onClick={accept}>
            {busy ? "Saving..." : "Agree and continue"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
