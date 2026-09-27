import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export const CONTACT_WINDOW_DAYS = 30;

// Counts of farmers who tapped Call or WhatsApp on this supplier's
// products (or directory entry) in the last 30 days. The database only
// ever returns counts, never who the farmers were.
export function useContactSummary(profileId) {
  const [state, setState] = useState({ loading: true, error: false, byProduct: {}, directory: null, totals: null });

  useEffect(() => {
    if (!profileId) return undefined;
    let cancelled = false;

    supabase.rpc("supplier_contact_summary", { p_days: CONTACT_WINDOW_DAYS }).then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        setState({ loading: false, error: true, byProduct: {}, directory: null, totals: null });
        return;
      }
      const rows = data || [];
      const byProduct = {};
      let directory = null;
      const totals = { contacts: 0, whatsapp: 0, calls: 0 };
      for (const row of rows) {
        const entry = { farmers: Number(row.farmers), whatsapp: Number(row.whatsapp), calls: Number(row.calls) };
        if (row.product_id) byProduct[row.product_id] = entry;
        else directory = entry;
        totals.contacts += entry.farmers;
        totals.whatsapp += entry.whatsapp;
        totals.calls += entry.calls;
      }
      setState({ loading: false, error: false, byProduct, directory, totals });
    });

    return () => { cancelled = true; };
  }, [profileId]);

  return state;
}

export function contactsLabel(count) {
  if (!count) return "No farmer contacts yet";
  return `${count} farmer${count === 1 ? "" : "s"} contacted you`;
}
