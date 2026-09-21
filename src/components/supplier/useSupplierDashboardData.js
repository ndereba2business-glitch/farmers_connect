import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const LOAD_ERROR = "We couldn't load your dashboard data. Check your connection and try again.";

// Loads this supplier's products and order requests. Row-level security
// already limits both to the supplier; the filters make the intent explicit
// and keep the queries index-friendly.
export function useSupplierDashboardData(profileId) {
  const [state, setState] = useState({ loading: true, error: "", products: [], orders: [] });
  const [reload, setReload] = useState(0);
  const refresh = useCallback(() => setReload(n => n + 1), []);

  const retry = useCallback(() => {
    setState(prev => ({ ...prev, loading: true, error: "" }));
    setReload(n => n + 1);
  }, []);

  useEffect(() => {
    if (!profileId) return undefined;
    let cancelled = false;

    async function load() {
      const [productsRes, ordersRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, product_name, price, stock, sold_out, image_url, unit, category, created_at")
          .eq("supplier_id", profileId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("orders")
          .select("id, product_name, quantity, customer_name, status, delivery_status, supplier_earnings, created_at")
          .eq("supplier_id", profileId)
          .order("created_at", { ascending: false })
          .limit(500)
      ]);

      if (cancelled) return;
      if (productsRes.error || ordersRes.error) {
        setState(prev => ({ ...prev, loading: false, error: LOAD_ERROR }));
        return;
      }
      setState({
        loading: false,
        error: "",
        products: productsRes.data || [],
        orders: ordersRes.data || []
      });
    }

    load();
    return () => { cancelled = true; };
  }, [profileId, reload]);

  useEffect(() => {
    if (!profileId) return undefined;
    const channel = supabase
      .channel(`supplier-dashboard-${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `supplier_id=eq.${profileId}` },
        refresh
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profileId, refresh]);

  return { ...state, refresh, retry };
}
