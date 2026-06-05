import { Outlet, NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Stethoscope,
  LogOut,
  Menu,
  X
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { useState } from "react";

export default function MainLayout() {
  const { logout } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
      isActive
        ? "bg-green-600 text-white"
        : "text-gray-700 hover:bg-green-100"
    }`;

  return (
    <div className="min-h-screen flex bg-gray-100">

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
          w-64 bg-white shadow-lg p-4 flex flex-col
          transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
        `}
      >

        {/* TOP */}
        <div className="flex items-center justify-between mb-8">

          <div>
            <h1 className="text-2xl font-bold text-green-700">
              Farmers Connect
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              Smart Poultry Platform
            </p>
          </div>

          {/* CLOSE BUTTON MOBILE */}
          <button
            className="md:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X />
          </button>

        </div>

        {/* NAVIGATION */}
        <nav className="flex flex-col gap-2">

          <NavLink
            to="/app/dashboard"
            className={navClass}
            onClick={() => setSidebarOpen(false)}
          >
            <LayoutDashboard size={20} />
            Dashboard
          </NavLink>

          <NavLink
            to="/app/ask-vet"
            className={navClass}
            onClick={() => setSidebarOpen(false)}
          >
            <Stethoscope size={20} />
            Ask Vet
          </NavLink>

        </nav>

        {/* LOGOUT */}
        <div className="mt-auto">
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg transition-all"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>

      </aside>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col">

        {/* MOBILE TOPBAR */}
        <header className="md:hidden bg-white shadow-sm px-4 py-3 flex items-center justify-between">

          <button onClick={() => setSidebarOpen(true)}>
            <Menu />
          </button>

          <h1 className="font-bold text-green-700">
            Farmers Connect
          </h1>

          <div />
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto">
          <Outlet />
        </main>

      </div>

    </div>
  );
}