import React, { useState } from "react";
import {
  Link,
  Outlet,
  useLocation,
} from "react-router-dom";

export default function AppLayout() {
  const location = useLocation();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    {
      label: "Dashboard",
      path: "/app/dashboard",
    },
    {
      label: "Ask Vet",
      path: "/app/ask-vet",
    },
    {
      label: "Appointments",
      path: "/app/appointments",
    },
    {
      label: "Suppliers",
      path: "/app/suppliers",
    },
    {
      label: "Profile",
      path: "/app/profile",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">

      {/* MOBILE OVERLAY */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`
          fixed md:static z-50 top-0 left-0 h-full
          w-64 bg-white border-r
          transform transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          flex flex-col
        `}
      >

        {/* LOGO */}
        <div className="p-6 border-b">

          <h1 className="text-2xl font-bold text-green-700">
            Farmers Connect
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            Poultry Support Platform
          </p>

        </div>

        {/* NAVIGATION */}
        <nav className="flex-1 p-4 space-y-2">

          {navItems.map((item) => {
            const active =
              location.pathname === item.path;

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`
                  block px-4 py-3 rounded-lg transition
                  ${
                    active
                      ? "bg-green-600 text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }
                `}
              >
                {item.label}
              </Link>
            );
          })}

        </nav>

      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col">

        {/* TOP NAVBAR */}
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between">

          {/* MOBILE MENU BUTTON */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="md:hidden text-2xl"
          >
            ☰
          </button>

          {/* PAGE TITLE */}
          <h1 className="text-xl font-bold text-green-700">
            Farmers Connect
          </h1>

          {/* USER */}
          <div className="text-sm text-gray-500">
            Poultry Care Platform
          </div>

        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>

      </div>

    </div>
  );
}