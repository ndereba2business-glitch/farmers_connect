import React, { useState } from "react";
import { DataService } from "../../api/dataService";

export default function BookAppointment({ vet, onClose }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!date || !reason) return;

    setLoading(true);

    try {
      await DataService.createAppointment({
        vet_id: vet.id,
        vet_name: vet.full_name,
        date,
        reason,
        status: "pending"
      });

      alert("Appointment booked successfully!");
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to book appointment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-white space-y-3">

      <h2 className="text-lg font-bold">
        Book Appointment with {vet.full_name}
      </h2>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full p-2 border rounded-md"
      />

      <textarea
        placeholder="Describe your issue..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className="w-full p-2 border rounded-md"
      />

      <button
        onClick={handleSubmit}
        disabled={loading}
        className="w-full bg-green-600 text-white py-2 rounded-md"
      >
        {loading ? "Booking..." : "Book Appointment"}
      </button>

    </div>
  );
}