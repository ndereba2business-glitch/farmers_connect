import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";

export default function VetDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);

  // -----------------------------
  // FETCH BOOKINGS (VET ONLY)
  // -----------------------------
  async function fetchBookings() {
    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      return;
    }

    setBookings(data || []);
  }

  useEffect(() => {
    fetchBookings();
  }, []);

  // -----------------------------
  // ASSIGN STATUS
  // -----------------------------
  async function updateStatus(id, status) {
    const { error } = await supabase
      .from("bookings")
      .update({
        status,
        assigned_vet: user?.email
      })
      .eq("id", id);

    if (error) {
      console.error(error.message);
      return;
    }

    fetchBookings();
  }

  return (
    <div style={{ padding: "20px" }}>
      <h1>Vet Dashboard</h1>

      <p>
        Logged in as: {user?.email}
      </p>

      {bookings.length === 0 ? (
        <p>No bookings yet.</p>
      ) : (
        bookings.map((b) => (
          <div
            key={b.id}
            style={{
              border: "1px solid #ccc",
              padding: "15px",
              marginBottom: "10px",
              borderRadius: "10px"
            }}
          >
            <h3>{b.service_type}</h3>

            <p>
              Farmer: {b.farmer_name}
            </p>

            <p>
              County: {b.county}
            </p>

            <p>
              Contact: {b.contact}
            </p>

            <p>
              Status: {b.status}
            </p>

            <button
              onClick={() =>
                updateStatus(b.id, "accepted")
              }
            >
              Accept
            </button>

            <button
              onClick={() =>
                updateStatus(b.id, "completed")
              }
            >
              Mark Completed
            </button>
          </div>
        ))
      )}
    </div>
  );
}