import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useBlockedMembers } from "../lib/safety";
import "./Account.css";

// The members this person has blocked, with a way back. Shown on the
// profile page only when there is someone on the list.
export default function BlockedMembers() {
  const { userEmail } = useAuth();
  const toast = useToast();
  const { rows, unblock } = useBlockedMembers(userEmail);
  const [busy, setBusy] = useState("");

  if (rows.length === 0) return null;

  async function release(row) {
    if (busy) return;
    setBusy(row.blocked);
    const done = await unblock(row.blocked);
    setBusy("");
    if (!done) {
      toast.error("That didn't save. Check your connection and try again.");
      return;
    }
    toast.success(`${row.blocked_name || "That member"} is unblocked. You will see their messages and listings again.`);
  }

  return (
    <section className="fc-card ac-blocked" aria-labelledby="ac-blocked-title">
      <h2 id="ac-blocked-title" className="ac-title">Blocked members</h2>
      <p className="ac-text">You don't see community messages or marketplace listings from these members. They are not told.</p>
      <ul className="ac-list">
        {rows.map(row => (
          <li key={row.blocked} className="ac-blocked-row">
            <span>{row.blocked_name || "A member"}</span>
            <button type="button" className="fc-btn fc-btn--secondary" disabled={busy === row.blocked} onClick={() => release(row)}>
              {busy === row.blocked ? "Unblocking..." : "Unblock"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
