import { useEffect, useState } from "react";
import { Ban, CheckCircle2, Trash2, X } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import "./CommunityModeration.css";

const REPORT_COLUMNS =
  "id, reason, reporter, created_at, " +
  "message:community_chat(id, user_email, user_name, message, image_url, created_at, removed_at)";

const when = (value) =>
  new Date(value).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// Several members can report the same message; the admin decides once.
function groupByMessage(reports) {
  const groups = new Map();
  for (const report of reports) {
    if (!report.message) continue;
    const group = groups.get(report.message.id) || { message: report.message, reports: [] };
    group.reports.push(report);
    groups.set(report.message.id, group);
  }
  return [...groups.values()];
}

// The admin dashboard's Community tab: reported messages, members who are
// paused, and the words the group refuses. Every action here is also
// enforced by row-level security, so it only works for a real admin.
export default function CommunityModeration({ onOpenCount }) {
  const { userEmail } = useAuth();
  const toast = useToast();

  const [reports, setReports] = useState([]);
  const [mutes, setMutes] = useState([]);
  const [terms, setTerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState(null);
  const [newTerm, setNewTerm] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [reportResult, muteResult, termResult] = await Promise.all([
        supabase.from("community_reports").select(REPORT_COLUMNS)
          .eq("status", "open").order("created_at", { ascending: false }).limit(200),
        supabase.from("community_mutes").select("user_email, muted_until, reason")
          .gt("muted_until", new Date().toISOString()).order("muted_until", { ascending: true }),
        supabase.from("community_blocked_terms").select("term, kind").order("term", { ascending: true })
      ]);
      if (cancelled) return;
      setLoading(false);
      if (reportResult.error || muteResult.error || termResult.error) {
        console.error("CommunityModeration: load failed —",
          (reportResult.error || muteResult.error || termResult.error).message);
        setLoadError(true);
        return;
      }
      setLoadError(false);
      setReports(reportResult.data || []);
      setMutes(muteResult.data || []);
      setTerms(termResult.data || []);
    }

    load();
    return () => { cancelled = true; };
  }, [attempt]);

  const groups = groupByMessage(reports);
  const openCount = groups.length;
  useEffect(() => { onOpenCount?.(openCount); }, [openCount, onOpenCount]);

  const dropMessage = (messageId) => setReports(current => current.filter(r => r.message?.id !== messageId));

  async function removeMessage(message) {
    setBusyId(message.id);
    const { error } = await supabase.rpc("community_remove_message", { p_message_id: message.id });
    setBusyId(null);
    if (error) {
      toast.error("That message couldn't be removed. Check your connection and try again.");
      return;
    }
    dropMessage(message.id);
    toast.success("Message removed from the group.");
  }

  async function keepMessage(message) {
    setBusyId(message.id);
    const { error } = await supabase.from("community_reports")
      .update({ status: "dismissed", resolved_at: new Date().toISOString() })
      .eq("message_id", message.id).eq("status", "open");
    setBusyId(null);
    if (error) {
      toast.error("That couldn't be saved. Check your connection and try again.");
      return;
    }
    dropMessage(message.id);
    toast.success("Message kept. The reports are closed.");
  }

  async function pause(message, hours) {
    setBusyId(message.id);
    const mute = {
      user_email: message.user_email,
      muted_until: new Date(Date.now() + hours * 3600000).toISOString(),
      reason: "Paused by an admin after a report",
      muted_by: userEmail
    };
    const { error } = await supabase.from("community_mutes").upsert(mute, { onConflict: "user_email" });
    setBusyId(null);
    if (error) {
      toast.error("That member couldn't be paused. Check your connection and try again.");
      return;
    }
    setMutes(current => [...current.filter(m => m.user_email !== mute.user_email), mute]);
    toast.success(`${message.user_name} can't post for ${hours === 24 ? "24 hours" : "7 days"}.`);
  }

  async function unpause(mute) {
    setBusyId(mute.user_email);
    const { error } = await supabase.from("community_mutes").delete().eq("user_email", mute.user_email);
    setBusyId(null);
    if (error) {
      toast.error("That couldn't be saved. Check your connection and try again.");
      return;
    }
    setMutes(current => current.filter(m => m.user_email !== mute.user_email));
  }

  async function addTerm(e) {
    e.preventDefault();
    const term = newTerm.trim().toLowerCase();
    if (term.length < 2) return;
    if (terms.some(t => t.term === term)) {
      setNewTerm("");
      return;
    }
    const { error } = await supabase.from("community_blocked_terms").insert([{ term, kind: "off_topic" }]);
    if (error) {
      toast.error("That word couldn't be added. Use 2 to 60 characters and try again.");
      return;
    }
    setTerms(current => [...current, { term, kind: "off_topic" }].sort((a, b) => a.term.localeCompare(b.term)));
    setNewTerm("");
  }

  async function removeTerm(term) {
    const { error } = await supabase.from("community_blocked_terms").delete().eq("term", term);
    if (error) {
      toast.error("That word couldn't be removed. Check your connection and try again.");
      return;
    }
    setTerms(current => current.filter(t => t.term !== term));
  }

  if (loading) return <div className="md-empty">Loading the community review queue...</div>;

  if (loadError) {
    return (
      <div className="md-empty" role="alert">
        We couldn't load the review queue. Check your connection and try again.
        <button className="md-btn" onClick={() => { setLoading(true); setAttempt(n => n + 1); }}>Try again</button>
      </div>
    );
  }

  return (
    <div className="md-wrap">
      <section className="md-section">
        <h2>Reported messages ({groups.length})</h2>
        {groups.length === 0 ? (
          <div className="md-empty">
            <CheckCircle2 size={28} color="#16a34a" aria-hidden="true" />
            Nothing waiting. Members' reports appear here.
          </div>
        ) : groups.map(({ message, reports: filed }) => (
          <article key={message.id} className="md-card">
            <p className="md-meta">{message.user_name} · {message.user_email} · {when(message.created_at)}</p>
            <p className="md-message">{message.message || "(photo only)"}</p>
            {message.image_url && <img className="md-photo" src={message.image_url} alt="Photo in the reported message" loading="lazy" />}
            <ul className="md-reasons">
              {filed.map(r => <li key={r.id}><b>{r.reason}</b> — {r.reporter}, {when(r.created_at)}</li>)}
            </ul>
            <div className="md-actions">
              <button className="md-btn md-btn--danger" onClick={() => removeMessage(message)} disabled={busyId === message.id}>
                <Trash2 size={16} aria-hidden="true" /> Remove message
              </button>
              <button className="md-btn" onClick={() => keepMessage(message)} disabled={busyId === message.id}>
                <CheckCircle2 size={16} aria-hidden="true" /> Keep it
              </button>
              <button className="md-btn" onClick={() => pause(message, 24)} disabled={busyId === message.id}>
                <Ban size={16} aria-hidden="true" /> Pause sender 24 hours
              </button>
              <button className="md-btn" onClick={() => pause(message, 168)} disabled={busyId === message.id}>
                <Ban size={16} aria-hidden="true" /> Pause sender 7 days
              </button>
            </div>
          </article>
        ))}
      </section>

      <section className="md-section">
        <h2>Paused members ({mutes.length})</h2>
        {mutes.length === 0 ? (
          <div className="md-empty">Nobody is paused.</div>
        ) : mutes.map(mute => (
          <div key={mute.user_email} className="md-row">
            <div style={{ minWidth: 0 }}>
              <p className="md-row-title">{mute.user_email}</p>
              <p className="md-meta">Can post again {when(mute.muted_until)}</p>
            </div>
            <button className="md-btn" onClick={() => unpause(mute)} disabled={busyId === mute.user_email}>
              Let them post now
            </button>
          </div>
        ))}
      </section>

      <section className="md-section">
        <h2>Blocked words ({terms.length})</h2>
        <p className="md-meta">
          A message containing any of these as a whole word is refused. Avoid words with honest poultry uses.
        </p>
        <form className="md-add" onSubmit={addTerm}>
          <label className="md-visually-hidden" htmlFor="md-new-term">Word or phrase to block</label>
          <input
            id="md-new-term" value={newTerm} maxLength={60}
            placeholder="Word or phrase to block" onChange={e => setNewTerm(e.target.value)}
          />
          <button className="md-btn md-btn--primary" type="submit" disabled={newTerm.trim().length < 2}>Add</button>
        </form>
        <div className="md-terms">
          {terms.map(t => (
            <span key={t.term} className="md-term">
              {t.term}
              <button onClick={() => removeTerm(t.term)} aria-label={`Stop blocking "${t.term}"`}>
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
