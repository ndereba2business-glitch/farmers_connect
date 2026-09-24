import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { IN_APP_ORDERING } from "../../config/features";

const LOAD_ERROR = "We couldn't load your products. Check your connection and try again.";

export const PRODUCT_COLUMNS =
  "id, product_name, category, description, price, unit, stock, sold_out, is_active, " +
  "image_url, county, location_details, seller_phone, created_at";

// This supplier's products (and, when in-app ordering is on, their order
// requests). Row-level security already limits both to the supplier; the
// filters make the intent explicit and keep the queries index-friendly.
export function useSupplierProducts(profileId) {
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
          .select(PRODUCT_COLUMNS)
          .eq("supplier_id", profileId)
          .order("created_at", { ascending: false })
          .limit(500),
        IN_APP_ORDERING
          ? supabase
              .from("orders")
              .select("id, product_name, quantity, customer_name, status, delivery_status, supplier_earnings, created_at")
              .eq("supplier_id", profileId)
              .order("created_at", { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [], error: null })
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
    if (!profileId || !IN_APP_ORDERING) return undefined;
    const channel = supabase
      .channel(`supplier-orders-${profileId}`)
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

// active   = visible to farmers and in stock
// soldOut  = visible to farmers, marked sold out
// inactive = hidden from farmers by the supplier
export function productStatus(p) {
  if (!p.is_active) return { key: "inactive", label: "Inactive", tone: "neutral" };
  if (p.sold_out) return { key: "soldOut", label: "Out of stock", tone: "amber" };
  return { key: "active", label: "Active", tone: "green" };
}
