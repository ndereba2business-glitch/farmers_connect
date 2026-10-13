// Reporting things to the admins and blocking other members.
//
// Reports about community MESSAGES go to community_reports (see
// Community.jsx); everything else, a listing, an answer from Clucky, a
// member, goes to content_reports through reportContent(). Blocks live in
// user_blocks. The database decides who may write what: a report or a
// block can only be made in the signed-in person's own name.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabaseClient";

export const LISTING_REASONS = ["Scam or misleading", "Illegal or unsafe product", "Not about poultry", "Insulting or abusive", "Something else"];
export const ANSWER_REASONS = ["Wrong or dangerous advice", "Offensive or inappropriate", "Something else"];
export const MEMBER_REASONS = ["Harassment or abuse", "Scam or fraud", "Pretending to be someone else", "Something else"];

// Resolves to { ok: true, already } or { ok: false }. `already` is true
// when this person had reported the same thing before (unique rule 23505).
export async function reportContent({ kind, targetId, summary, reason, reporter }) {
  const { error } = await supabase.from("content_reports").insert([{
    kind,
    target_id: String(targetId).slice(0, 320),
    target_summary: summary ? String(summary).slice(0, 600) : null,
    reason: String(reason).slice(0, 300),
    reporter
  }]);
  if (error && error.code !== "23505") return { ok: false };
  return { ok: true, already: Boolean(error) };
}

// The members this person has blocked: a Set of identities for hiding
// their content, the rows for listing them, and block / unblock. A failed
// load hides nothing rather than everything.
export function useBlockedMembers(userEmail) {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!userEmail) return undefined;
    let cancelled = false;
    supabase.from("user_blocks").select("blocked, blocked_name, created_at").eq("blocker", userEmail).limit(500)
      .then(({ data }) => { if (!cancelled) setRows(data || []); });
    return () => { cancelled = true; };
  }, [userEmail]);

  const blocked = useMemo(() => new Set(rows.map(r => r.blocked)), [rows]);

  const block = useCallback(async (identity, name) => {
    if (!userEmail || !identity || identity === userEmail) return false;
    const row = { blocker: userEmail, blocked: identity, blocked_name: (name || "").slice(0, 60) || null };
    const { error } = await supabase.from("user_blocks").insert([row]);
    if (error && error.code !== "23505") return false;
    setRows(current => current.some(r => r.blocked === identity) ? current : [...current, { ...row, created_at: new Date().toISOString() }]);
    return true;
  }, [userEmail]);

  const unblock = useCallback(async (identity) => {
    if (!userEmail) return false;
    const { error } = await supabase.from("user_blocks").delete().eq("blocker", userEmail).eq("blocked", identity);
    if (error) return false;
    setRows(current => current.filter(r => r.blocked !== identity));
    return true;
  }, [userEmail]);

  return { blocked, rows, block, unblock };
}
