import { useCallback, useEffect, useState } from "react";
import { Check, RefreshCw, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { deleteAccountFor, deleteErrorMessage } from "../lib/account";
import ConfirmDialog from "./ConfirmDialog";
import "./Account.css";

const REQUEST_LABEL = { delete_account: "Delete account", privacy: "Privacy question" };
const REPORT_LABEL = { listing: "Listing", clucky_answer: "Clucky answer", member: "Member" };
const when = (value) => new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Admin > Requests: what people sent from the public deletion page, and
// reports about listings, Clucky answers and members. (Reports about
// community messages are on the Community tab, where the message is.)
// Every action here is checked again by the database or the edge function.
export default function AdminRequests({ onCount }) {
  const { userEmail } = useAuth();
  const toast = useToast();
  const [state, setState] = useState({ loading: true, error: false, requests: [], reports: [] });
  const [reload, setReload] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const refresh = useCallback(() => setReload(n => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [requests, reports] = await Promise.all([
        supabase.from("account_requests").select("id, kind, identity, message, status, created_at")
          .eq("status", "open").order("created_at", { ascending: true }).limit(100),
        supabase.from("content_reports").select("id, kind, target_id, target_summary, reporter, reason, status, created_at")
          .eq("status", "open").order("created_at", { ascending: true }).limit(100)
      ]);
      if (cancelled) return;
      if (requests.error || reports.error) {
        setState(prev => ({ ...prev, loading: false, error: true }));
        return;
      }
      setState({ loading: false, error: false, requests: requests.data || [], reports: reports.data || [] });
      onCount?.((requests.data || []).length + (reports.data || []).length);
    }
    load();
    return () => { cancelled = true; };
  }, [reload, onCount]);

  async function resolve(table, row, status, message) {
    if (busyId) return;
    setBusyId(row.id);
    const { data, error } = await supabase.from(table)
      .update({ status, resolved_at: new Date().toISOString(), resolved_by: userEmail })
      .eq("id", row.id).select("id");
    setBusyId(null);
    if (error || !data?.length) {
      toast.error("That didn't save. Check your connection and try again.");
      return;
    }
    toast.success(message);
    refresh();
  }

  async function removeListing(report) {
    if (busyId) return;
    setBusyId(report.id);
    const { data, error } = await supabase.from("products").delete().eq("id", report.target_id).select("id");
    setBusyId(null);
    if (error) {
      toast.error("The listing wasn't removed. Check your connection and try again.");
      return;
    }
    await resolve("content_reports", report, "actioned",
      data?.length ? "Listing removed. Its seller has been notified." : "That listing was already gone; the report is closed.");
  }

  async function deleteAccount() {
    if (deleteBusy || !deleting) return;
    setDeleteBusy(true);
    setDeleteError("");
    const result = await deleteAccountFor(deleting.identity);
    setDeleteBusy(false);
    if (!result.ok) {
      setDeleteError(deleteErrorMessage(result.code));
      return;
    }
    toast.success("The account and its data have been deleted.");
    setDeleting(null);
    refresh();
  }

  if (state.loading) return <p className="fc-card ac-empty">Loading requests...</p>;
  if (state.error) {
    return (
      <div className="fc-card ac-empty" role="alert">
        <p>We couldn't load requests. Check your connection.</p>
        <button type="button" className="fc-btn fc-btn--secondary" onClick={refresh}>
          <RefreshCw size={16} aria-hidden="true" /> Try again
        </button>
      </div>
    );
  }

  return (
    <div className="ac-requests">
      <section aria-labelledby="ac-req-title">
        <h2 id="ac-req-title">Account requests ({state.requests.length})</h2>
        <p className="ac-requests-note">
          Sent from the public "Delete your account" page by people who cannot sign in. Anyone can type any email address
          into that form, so contact the person on that address or number and confirm the account is theirs before deleting it.
        </p>
        {state.requests.length === 0 ? <p className="fc-card ac-empty">No open requests.</p> : (
          <ul className="ac-list">
            {state.requests.map(request => (
              <li key={request.id} className="fc-card ac-row">
                <div className="ac-row-head">
                  <span className={`fc-tag${request.kind === "delete_account" ? " fc-tag--danger" : " fc-tag--info"}`}>{REQUEST_LABEL[request.kind]}</span>
                  <strong>{request.identity}</strong>
                  <span className="ac-row-meta">{when(request.created_at)}</span>
                </div>
                {request.message && <p className="ac-row-text">{request.message}</p>}
                <div className="ac-row-actions">
                  {request.kind === "delete_account" && (
                    <button type="button" className="fc-btn fc-btn--danger" disabled={busyId === request.id}
                      onClick={() => { setDeleteError(""); setDeleting(request); }}>
                      <Trash2 size={16} aria-hidden="true" /> Delete this account
                    </button>
                  )}
                  <button type="button" className="fc-btn fc-btn--secondary" disabled={busyId === request.id}
                    onClick={() => resolve("account_requests", request, "done", "Request marked as done.")}>
                    <Check size={16} aria-hidden="true" /> Mark as done
                  </button>
                  <button type="button" className="fc-btn fc-btn--secondary" disabled={busyId === request.id}
                    onClick={() => resolve("account_requests", request, "rejected", "Request closed without action.")}>
                    <X size={16} aria-hidden="true" /> Close, no action
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="ac-rep-title">
        <h2 id="ac-rep-title">Reports ({state.reports.length})</h2>
        <p className="ac-requests-note">
          About marketplace listings, Clucky's answers and members. Reports about community messages are on the Community tab.
        </p>
        {state.reports.length === 0 ? <p className="fc-card ac-empty">No open reports.</p> : (
          <ul className="ac-list">
            {state.reports.map(report => (
              <li key={report.id} className="fc-card ac-row">
                <div className="ac-row-head">
                  <span className="fc-tag fc-tag--warning">{REPORT_LABEL[report.kind]}</span>
                  <strong>{report.kind === "member" ? report.target_id : (report.target_summary || "No preview saved")}</strong>
                  <span className="ac-row-meta">{when(report.created_at)} · reported by {report.reporter}</span>
                </div>
                <p className="ac-row-text">Reason: {report.reason}</p>
                <div className="ac-row-actions">
                  {report.kind === "listing" && (
                    <button type="button" className="fc-btn fc-btn--danger" disabled={busyId === report.id} onClick={() => removeListing(report)}>
                      <Trash2 size={16} aria-hidden="true" /> Remove the listing
                    </button>
                  )}
                  <button type="button" className="fc-btn fc-btn--secondary" disabled={busyId === report.id}
                    onClick={() => resolve("content_reports", report, "actioned", "Report closed as dealt with.")}>
                    <Check size={16} aria-hidden="true" /> Dealt with
                  </button>
                  <button type="button" className="fc-btn fc-btn--secondary" disabled={busyId === report.id}
                    onClick={() => resolve("content_reports", report, "dismissed", "Report dismissed.")}>
                    <X size={16} aria-hidden="true" /> Dismiss
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {deleting && (
        <ConfirmDialog
          title={`Delete the account for ${deleting.identity}?`}
          confirmLabel="Delete account"
          busyLabel="Deleting..."
          cancelLabel="Not yet"
          danger
          icon={Trash2}
          busy={deleteBusy}
          error={deleteError}
          onCancel={() => setDeleting(null)}
          onConfirm={deleteAccount}
        >
          <p>This permanently deletes that person's login, records, listings, messages and photos. It cannot be undone.</p>
          <p>Only continue if you have confirmed with them, on this email address or phone number, that the account is theirs.</p>
        </ConfirmDialog>
      )}
    </div>
  );
}
