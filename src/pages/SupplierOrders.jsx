import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SupplierOrders() {
  const [orders, setOrders] = useState([]);

  async function fetchOrders() {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    setOrders(data || []);
  }

  useEffect(() => {
    fetchOrders();
  }, []);

  async function updateStatus(id, status) {
    await supabase
      .from("orders")
      .update({ delivery_status: status })
      .eq("id", id);

    fetchOrders();
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Supplier Orders</h1>

      {orders.map((o) => (
        <div
          key={o.id}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px"
          }}
        >
          <h3>{o.product_name}</h3>

          <p>Customer: {o.customer_name}</p>
          <p>County: {o.county}</p>
          <p>Status: {o.delivery_status}</p>

          <button
            onClick={() =>
              updateStatus(o.id, "processing")
            }
          >
            Processing
          </button>

          <button
            onClick={() =>
              updateStatus(o.id, "shipped")
            }
          >
            Shipped
          </button>

          <button
            onClick={() =>
              updateStatus(o.id, "delivered")
            }
          >
            Delivered
          </button>
        </div>
      ))}
    </div>
  );
}