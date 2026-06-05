import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Analytics() {
  const [stats, setStats] = useState({
    totalBookings: 0,
    emergencyCases: 0,
    totalOrders: 0,
    totalRevenue: 0,
    totalProducts: 0,
    totalSuppliers: 0
  });

  // -----------------------------
  // FETCH ANALYTICS
  // -----------------------------
  async function fetchAnalytics() {
    // BOOKINGS
    const { data: bookings } = await supabase
      .from("bookings")
      .select("*");

    // ORDERS
    const { data: orders } = await supabase
      .from("orders")
      .select("*");

    // PRODUCTS
    const { data: products } = await supabase
      .from("products")
      .select("*");

    // SUPPLIERS
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("*");

    const revenue =
      orders?.reduce(
        (sum, o) => sum + Number(o.total_price),
        0
      ) || 0;

    setStats({
      totalBookings: bookings?.length || 0,

      emergencyCases:
        bookings?.filter(
          (b) => b.emergency === true
        ).length || 0,

      totalOrders: orders?.length || 0,

      totalRevenue: revenue,

      totalProducts: products?.length || 0,

      totalSuppliers: suppliers?.length || 0
    });
  }

  // -----------------------------
  // REALTIME
  // -----------------------------
  useEffect(() => {
    fetchAnalytics();

    const bookingsChannel = supabase
      .channel("analytics-bookings")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "bookings"
        },
        fetchAnalytics
      )
      .subscribe();

    const ordersChannel = supabase
      .channel("analytics-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders"
        },
        fetchAnalytics
      )
      .subscribe();

    const productsChannel = supabase
      .channel("analytics-products")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "products"
        },
        fetchAnalytics
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsChannel);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(productsChannel);
    };
  }, []);

  // -----------------------------
  // CARD STYLE
  // -----------------------------
  const cardStyle = {
    border: "1px solid #ccc",
    borderRadius: "10px",
    padding: "20px",
    textAlign: "center"
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Platform Analytics</h1>

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "20px",
          marginTop: "20px"
        }}
      >
        <div style={cardStyle}>
          <h2>{stats.totalBookings}</h2>
          <p>Total Bookings</p>
        </div>

        <div style={cardStyle}>
          <h2>{stats.emergencyCases}</h2>
          <p>Emergency Cases</p>
        </div>

        <div style={cardStyle}>
          <h2>{stats.totalOrders}</h2>
          <p>Total Orders</p>
        </div>

        <div style={cardStyle}>
          <h2>KES {stats.totalRevenue}</h2>
          <p>Total Revenue</p>
        </div>

        <div style={cardStyle}>
          <h2>{stats.totalProducts}</h2>
          <p>Total Products</p>
        </div>

        <div style={cardStyle}>
          <h2>{stats.totalSuppliers}</h2>
          <p>Total Suppliers</p>
        </div>
      </div>
    </div>
  );
}