import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function RevenueDashboard() {
  const [stats, setStats] = useState({
    totalRevenue: 0,
    platformEarnings: 0,
    supplierPayouts: 0,
    totalOrders: 0
  });

  async function fetchRevenue() {
    const { data } = await supabase
      .from("orders")
      .select("*");

    const orders = data || [];

    const totalRevenue = orders.reduce(
      (sum, o) => sum + Number(o.total_price),
      0
    );

    const platformEarnings = orders.reduce(
      (sum, o) => sum + Number(o.platform_fee || 0),
      0
    );

    const supplierPayouts = orders.reduce(
      (sum, o) => sum + Number(o.supplier_earnings || 0),
      0
    );

    setStats({
      totalRevenue,
      platformEarnings,
      supplierPayouts,
      totalOrders: orders.length
    });
  }

  useEffect(() => {
    fetchRevenue();
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h1>Revenue Dashboard</h1>

      <h2>Total Orders: {stats.totalOrders}</h2>

      <h2>
        Total Revenue: KES {stats.totalRevenue}
      </h2>

      <h2>
        Platform Earnings: KES{" "}
        {stats.platformEarnings}
      </h2>

      <h2>
        Supplier Payouts: KES{" "}
        {stats.supplierPayouts}
      </h2>
    </div>
  );
}