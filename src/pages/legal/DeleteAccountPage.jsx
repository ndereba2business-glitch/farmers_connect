import { useState } from "react";
import { Link } from "react-router-dom";
import LegalLayout from "./LegalLayout";
import DeleteAccountSection from "../../components/DeleteAccountSection";
import { useAuth } from "../../context/AuthContext";
import { APP_NAME, CONTACT_EMAIL, operatorName } from "../../config/legal";
import { DELETED_ITEMS, KEPT_ITEMS, requestErrorMessage, sendAccountRequest } from "../../lib/account";
import { POLICIES_PUBLISHED } from "../../config/features";
import "../../components/Account.css";

// For people who cannot sign in. It writes one request that an admin
// reads; nothing is deleted until the admin has confirmed with the person
// that the account is theirs.
function RequestForm() {
  const [kind, setKind] = useState("delete_account");
  const [identity, setIdentity] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!identity.trim()) {
      setError(requestErrorMessage("bad_identity"));
      return;
    }
    setBusy(true);
    setError("");
    const result = await sendAccountRequest({ kind, identity, message, website });
    setBusy(false);
    if (!result.ok) {
      setError(requestErrorMessage(result.code));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="lg-done" role="status">
        <strong>Your request has been received.</strong> We will contact you on the email address or phone number you gave to
        confirm the account is yours before anything is deleted. If you do not hear from us, send the request again.
      </div>
    );
  }

  return (
    <form className="lg-form" onSubmit={submit} noValidate>
      <label className="ac-field" htmlFor="rq-kind">
        <span>What do you need?</span>
        <select id="rq-kind" className="ac-input" value={kind} onChange={e => setKind(e.target.value)} disabled={busy}>
          <option value="delete_account">Delete my account and my data</option>
          <option value="privacy">A question or request about my data</option>
        </select>
      </label>
      <label className="ac-field" htmlFor="rq-identity">
        <span>The email address or phone number your account uses</span>
        <input
          id="rq-identity" className="ac-input" value={identity} onChange={e => setIdentity(e.target.value)}
          autoComplete="username" inputMode="email" disabled={busy} required
        />
      </label>
      <label className="ac-field" htmlFor="rq-message">
        <span>Anything we should know (optional)</span>
        <textarea
          id="rq-message" className="ac-input" value={message} onChange={e => setMessage(e.target.value)}
          maxLength={1000} disabled={busy}
        />
      </label>
      {/* people never see this field; scripts fill it in and are ignored */}
      <label className="lg-trap" aria-hidden="true">
        Website
        <input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
      </label>
      {error && <p role="alert" className="lg-error">{error}</p>}
      <button type="submit" className="fc-btn fc-btn--primary" disabled={busy}>
        {busy ? "Sending..." : "Send request"}
      </button>
    </form>
  );
}

// The public address for deleting a Farmers Connect account, as Google
// Play requires: it works without the app installed, it says what is
// deleted and what is kept, and it offers a route for someone who cannot
// sign in.
export default function DeleteAccountPage() {
  const { user } = useAuth();

  return (
    <LegalLayout title={`Delete your ${APP_NAME} account`}>
      <p className="lg-lead">
        You can delete your {APP_NAME} account and the data in it at any time. {APP_NAME} is provided by {operatorName()}.
        Deletion is permanent and takes effect straight away.
      </p>

      <h2 id="signed-in">1. Delete it yourself</h2>
      {user ? (
        <>
          <p>You are signed in. Use the button below, or open <strong>Profile</strong> in the app and choose <strong>Delete my account</strong>.</p>
          <DeleteAccountSection headingLevel={3} />
        </>
      ) : (
        <>
          <ol>
            <li>Sign in to {APP_NAME}.</li>
            <li>Open <strong>Profile</strong> in the menu (it is called <strong>Account</strong> for suppliers), or come back to this page.</li>
            <li>Choose <strong>Delete my account</strong>, type DELETE, and enter your password.</li>
          </ol>
          <div className="lg-actions">
            <Link to="/login?next=/delete-account" className="fc-btn fc-btn--primary">Sign in to delete my account</Link>
          </div>
          <p>Your account is deleted as soon as you confirm. You do not have to wait for anyone.</p>
        </>
      )}

      <h2 id="request">2. If you cannot sign in</h2>
      <p>
        If you have forgotten your password or no longer have the phone, send this form
        {CONTACT_EMAIL ? <> or write to <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></> : null}. An administrator will
        contact you on that email address or phone number to confirm the account is yours, and will then delete it for you.
        This form is also the way to ask any question about your data.
      </p>
      <RequestForm />

      <h2 id="what">3. What is deleted</h2>
      <ul>{DELETED_ITEMS.map(item => <li key={item}>{item}</li>)}</ul>

      <h2 id="kept">4. What is kept, and why</h2>
      <ul>{KEPT_ITEMS.map(item => <li key={item}>{item}</li>)}</ul>
      <p>
        Copies held in our hosting providers' backups and logs are removed on those providers' own schedules. Nothing else is
        retained.{POLICIES_PUBLISHED && <> The full detail is in the <Link to="/privacy#deletion">Privacy Policy</Link>.</>}
      </p>

      <h2 id="part">5. Deleting only some of your data</h2>
      <p>
        You do not have to delete your account to remove things. In the app you can delete a batch and its records, a gallery
        photo, a marketplace listing, a community message you wrote, and your whole conversation with Clucky.
      </p>
    </LegalLayout>
  );
}
