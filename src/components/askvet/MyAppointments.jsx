import React, { useEffect, useState } from "react";
import { DataService } from "../../api/dataService";

export default function MyAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // TEMP USER (replace with auth later)
  const userId = "current-user";

  useEffect(() => {
    const loadAppointments = async () => {
      try {
        const data = await DataService.getAppointments(userId);
        setAppointments(data || []);
      } catch (err) {
        console.error("Failed to load appointments:", err);
      } finally {
        setLoading(false);
      }
    };

    loadAppointments();
  }, []);

  if (loading) {
    return (
      <div className="p-4 text-gray-500">
        Loading your appointments...
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* HEADER */}
      <div className="p-4 border rounded-lg bg-white">
        <h1 className="text-xl font-bold text-green-700">
          My Appointments
        </h1>
        <p className="text-gray-500 text-sm">
          Manage your vet bookings and consultation history
        </p>
      </div>

      {/* LIST */}
      <div className="space-y-3">

        {appointments.length === 0 ? (
          <div className="p-4 border rounded-lg bg-white">
            <p className="text-gray-500">
              No appointments found
            </p>
          </div>
        ) : (
          appointments.map((app) => (
            <div
              key={app.id}
              className="p-4 border rounded-lg bg-white space-y-1"
            >

              <div className="flex justify-between items-center">
                <h2 className="font-semibold">
                  {app.vet_name || "Unknown Vet"}
                </h2>

                <span
                  className={`text-xs px-2 py-1 rounded ${
                    app.status === "pending"
                      ? "bg-yellow-100 text-yellow-700"
                      : app.status === "confirmed"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {app.status || "pending"}
                </span>
              </div>

              <p className="text-gray-600 text-sm">
                Date: {app.date}
              </p>

              <p className="text-gray-500 text-sm">
                Reason: {app.reason}
              </p>

            </div>
          ))
        )}

      </div>
    </div>
  );
}