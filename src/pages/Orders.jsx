import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Orders() {
  const [orders, setOrders] = useState([]);

  // -----------------------------
  // FETCH ORDERS
  // -----------------------------
  async function fetchOrders() {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      return;
    }

    setOrders(data || []);
  }

  // -----------------------------
  // REALTIME
  // -----------------------------
  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("orders-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders"
        },
        () => {
          fetchOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // -----------------------------
  // UPDATE ORDER STATUS
  // -----------------------------
  async function updateStatus(id, status) {
    const { error } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", id);

    if (error) {
      console.error(error.message);
      return;
    }

    fetchOrders();
  }

  // -----------------------------
  // STATUS COLORS
  // -----------------------------
  function getStatusColor(status) {
    switch (status) {
      case "pending":
        return "orange";

      case "processing":
        return "blue";

      case "delivered":
        return "green";

      case "cancelled":
        return "red";

      default:
        return "gray";
    }
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Orders Management</h1>

      {orders.length === 0 ? (
        <p>No orders available.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "15px"
          }}
        >
          {orders.map((o) => (
            <div
              key={o.id}
              style={{
                border: "1px solid #ccc",
                borderRadius: "10px",
                padding: "15px"
              }}
            >
              <h3>{o.product_name}</h3>

              <p>
                <b>Customer:</b> {o.customer_name}
              </p>

              <p>
                <b>County:</b> {o.county}
              </p>

              <p>
                <b>Quantity:</b> {o.quantity}
              </p>

              <p>
                <b>Total:</b> KES {o.total_price}
              </p>

              <p>
                <b>Status:</b>{" "}
                <span
                  style={{
                    color: getStatusColor(o.status),
                    fontWeight: "bold"
                  }}
                >
                  {o.status}
                </span>
              </p>

              <div
                style={{
                  display: "flex",
                  gap: "10px",
                  flexWrap: "wrap",
                  marginTop: "10px"
                }}
              >
                <button
                  onClick={() =>
                    updateStatus(
                      o.id,
                      "processing"
                    )
                  }
                >
                  Processing
                </button>

                <button
                  onClick={() =>
                    updateStatus(
                      o.id,
                      "delivered"
                    )
                  }
                >
                  Delivered
                </button>

                <button
                  onClick={() =>
                    updateStatus(
                      o.id,
                      "cancelled"
                    )
                  }
                >
                  Cancel
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}