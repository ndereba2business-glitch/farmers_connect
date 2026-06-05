import React from "react";
import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div className="space-y-8">

      {/* HERO SECTION */}
      <div className="bg-gradient-to-r from-green-600 to-green-500 rounded-3xl p-8 text-white shadow-lg">

        <div className="max-w-2xl">

          <h1 className="text-4xl font-bold leading-tight">
            Welcome to Farmers Connect
          </h1>

          <p className="mt-4 text-green-50 text-lg">
            Connect with verified poultry vets, manage appointments,
            and access trusted suppliers across Kenya.
          </p>

          <div className="flex flex-wrap gap-4 mt-6">

            <Link to="/app/ask-vet">
              <button className="bg-white text-green-700 px-5 py-3 rounded-xl font-medium hover:scale-105 transition">
                Ask a Vet
              </button>
            </Link>

            <Link to="/app/appointments">
              <button className="bg-green-700 text-white px-5 py-3 rounded-xl font-medium hover:scale-105 transition">
                My Appointments
              </button>
            </Link>

          </div>

        </div>

      </div>

      {/* STATS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

        {/* CARD */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border hover:shadow-md transition">

          <p className="text-gray-500 text-sm">
            Total Appointments
          </p>

          <h2 className="text-4xl font-bold mt-3 text-gray-800">
            12
          </h2>

          <p className="text-green-600 text-sm mt-2">
            +4 this week
          </p>

        </div>

        {/* CARD */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border hover:shadow-md transition">

          <p className="text-gray-500 text-sm">
            Verified Vets
          </p>

          <h2 className="text-4xl font-bold mt-3 text-gray-800">
            38
          </h2>

          <p className="text-green-600 text-sm mt-2">
            Across Kenya
          </p>

        </div>

        {/* CARD */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border hover:shadow-md transition">

          <p className="text-gray-500 text-sm">
            Emergency Requests
          </p>

          <h2 className="text-4xl font-bold mt-3 text-gray-800">
            2
          </h2>

          <p className="text-yellow-600 text-sm mt-2">
            Needs attention
          </p>

        </div>

      </div>

      {/* QUICK ACTIONS */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border">

        <div className="flex items-center justify-between flex-wrap gap-4">

          <div>

            <h2 className="text-2xl font-bold text-gray-800">
              Quick Actions
            </h2>

            <p className="text-gray-500 mt-1">
              Access important platform features quickly
            </p>

          </div>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">

          <Link to="/app/ask-vet">
            <div className="border rounded-2xl p-5 hover:bg-green-50 hover:border-green-200 transition cursor-pointer">

              <h3 className="font-semibold text-lg">
                Ask a Vet
              </h3>

              <p className="text-gray-500 text-sm mt-2">
                Consult verified poultry veterinarians
              </p>

            </div>
          </Link>

          <Link to="/app/appointments">
            <div className="border rounded-2xl p-5 hover:bg-green-50 hover:border-green-200 transition cursor-pointer">

              <h3 className="font-semibold text-lg">
                Manage Appointments
              </h3>

              <p className="text-gray-500 text-sm mt-2">
                View and manage your bookings
              </p>

            </div>
          </Link>

          <Link to="/app/suppliers">
            <div className="border rounded-2xl p-5 hover:bg-green-50 hover:border-green-200 transition cursor-pointer">

              <h3 className="font-semibold text-lg">
                Trusted Suppliers
              </h3>

              <p className="text-gray-500 text-sm mt-2">
                Find verified feed & medication suppliers
              </p>

            </div>
          </Link>

        </div>

      </div>

      {/* RECENT ACTIVITY */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border">

        <h2 className="text-2xl font-bold text-gray-800">
          Recent Activity
        </h2>

        <div className="space-y-4 mt-6">

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50">

            <div className="w-3 h-3 bg-green-500 rounded-full mt-2"></div>

            <div>
              <p className="font-medium">
                Appointment booked with Dr. James Mwangi
              </p>

              <p className="text-gray-500 text-sm mt-1">
                Today • Nairobi County
              </p>
            </div>

          </div>

          <div className="flex items-start gap-4 p-4 rounded-2xl bg-gray-50">

            <div className="w-3 h-3 bg-yellow-500 rounded-full mt-2"></div>

            <div>
              <p className="font-medium">
                Emergency poultry consultation requested
              </p>

              <p className="text-gray-500 text-sm mt-1">
                Yesterday • Kiambu County
              </p>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}