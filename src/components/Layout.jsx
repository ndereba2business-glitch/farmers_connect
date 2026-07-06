import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import NotificationsBell from "./NotificationsBell";
import { useState } from "react";
import {
  LayoutDashboard, ShoppingBag, Egg, Stethoscope,
  Users, MessageCircle, Shield, Wallet,
  BarChart3, ClipboardList, UserCircle, ChevronRight,
  Bot, Image, CheckSquare, LogOut,
  Package, Calculator, Menu, X
} from "lucide-react";

const FARMER_NAV = [
  { name: "Dashboard", path: "/", icon: LayoutDashboard },
  { name: "Marketplace", path: "/marketplace", icon: ShoppingBag },
  { name: "My Farm", path: "/my-farm", icon: Egg },
  { name: "Ask Vet", path: "/bookings", icon: Stethoscope },
  { name: "Community", path: "/community", icon: Users },
  { name: "Messages", path: "/community-chat", icon: MessageCircle },
  { name: "Clucky AI", path: "/clucky", icon: Bot },
  { name: "Feed Calculator", path: "/feed-calculator", icon: Calculator },
  { name: "Tasks", path: "/tasks", icon: CheckSquare },
  { name: "Gallery", path: "/gallery", icon: Image },
  { name: "Profile", path: "/profile", icon: UserCircle },
  { name: "Admin Panel", path: "/admin", icon: Shield },
];

const VET_NAV = [
  { name: "Vet Dashboard", path: "/vet", icon: Stethoscope },
  { name: "Community", path: "/community", icon: Users },
  { name: "Profile", path: "/profile", icon: UserCircle },
];

const SUPPLIER_NAV = [
  { name: "My Orders", path: "/supplier-orders", icon: Package },
  { name: "Marketplace", path: "/marketplace", icon: ShoppingBag },
  { name: "Wallet", path: "/wallet", icon: Wallet },
  { name: "Profile", path: "/profile", icon: UserCircle },
];

const ADMIN_NAV = [
  { name: "Admin Panel", path: "/admin", icon: Shield },
  { name: "Revenue", path: "/revenue", icon: BarChart3 },
  { name: "Verifications", path: "/verifications", icon: ClipboardList },
  { name: "Marketplace", path: "/marketplace", icon: ShoppingBag },
  { name: "Community", path: "/community", icon: Users },
];

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, userEmail, profile, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const navItems =
    role === "admin" ? ADMIN_NAV :
    role === "vet" ? VET_NAV :
    role === "supplier" ? SUPPLIER_NAV :
    FARMER_NAV;

  const initials = (profile?.full_name || userEmail || "U")
    .charAt(0).toUpperCase();

  return (
    <div className="flex bg-[#faf9f6] min-h-screen font-sans antialiased selection:bg-emerald-500 selection:text-white">

      {/* ====== MOBILE BACKDROP OVERLAY ====== */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden transition-opacity duration-300"
        />
      )}

      {/* ====== RESPONSIVE SIDEBAR ====== */}
      {/* Off-screen drawer on mobile/tablet (-translate-x-full) | Stationary dock on desktop (lg:translate-x-0 lg:relative) */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-[270px] p-[22px_18px] flex flex-col 
        bg-gradient-to-b from-[#031510] via-[#061d16] to-[#03120d] 
        border-r border-white/[0.04] overflow-y-auto transition-transform duration-300 ease-in-out
        lg:translate-x-0 lg:relative lg:z-0
        ${sidebarOpen ? "translate-x-0 shadow-[4px_0_32px_rgba(0,0,0,0.4)]" : "-translate-x-full shadow-none"}
      `}>

        {/* HEADER ROW */}
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3.5 pl-1.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center text-2xl shadow-[0_10px_25px_rgba(34,197,94,0.35)] shrink-0">
              🐔
            </div>
            <div>
              <div className="text-white text-[17px] font-extrabold tracking-tight leading-none">
                Farmers
              </div>
              <div className="text-[#22c55e] text-e[16px] font-bold mt-1 leading-none">
                Connect
              </div>
            </div>
          </div>

          {/* CLOSE BUTTON - Hidden completely on laptop/desktop layouts */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-all duration-200 shrink-0"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* ROLE BADGE */}
        <div className="pl-1.5 mb-4">
          <span className="inline-block bg-emerald-500/10 text-[#22c55e] text-[11px] font-semibold px-3 py-1 rounded-full capitalize tracking-wider border border-emerald-500/20">
            {role || "farmer"}
          </span>
        </div>

        {/* NAVIGATION LINKS */}
        <div className="flex flex-col gap-1 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className="no-underline group"
              >
                <div className={`
                  h-[54px] rounded-[18px] px-[18px] flex items-center justify-between transition-all duration-200 ease-in-out
                  ${active 
                    ? "bg-gradient-to-r from-[#2cc56f] to-[#18a957] text-white shadow-[0_14px_35px_rgba(34,197,94,0.22)]" 
                    : "text-[#9aa4a0] hover:bg-white/[0.03] hover:text-white"}
                `}>
                  <div className="flex items-center gap-3.5">
                    <Icon size={20} className={`transition-colors duration-200 ${active ? "text-white" : "text-[#9aa4a0] group-hover:text-white"}`} />
                    <span className={`text-[15px] ${active ? "font-700 text-white" : "font-500"}`}>
                      {item.name}
                    </span>
                  </div>
                  {active && <ChevronRight size={16} className="text-white" />}
                </div>
              </Link>
            );
          })}
        </div>

        {/* USER PROFILE CARD + DISCONNECT FIELD */}
        <div className="mt-5">
          <div className="bg-white/[0.04] border border-white/[0.06] rounded-[22px] p-3.5 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#22c55e] to-[#16a34a] flex items-center justify-center text-white font-bold text-base shrink-0 overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : initials}
              </div>
              <div className="overflow-hidden">
                <div className="text-white font-semibold text-sm truncate">
                  {profile?.full_name || "Farmer"}
                </div>
                <div className="text-[#8a9490] text-[11px] truncate mt-0.5">
                  {userEmail}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-[18px] py-3 rounded-xl border-none bg-transparent text-white/40 hover:bg-red-500/10 hover:text-red-500 transition-all duration-200 font-medium text-sm text-left cursor-pointer"
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ====== VIEWPORT APP WRAPPER ====== */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">

        {/* TOP COMPACT NAVIGATION HEADER */}
        <header className="h-16 bg-white border-b border-[#e9eef2] flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shrink-0">
          
          {/* HAMBURGER TRIGGER - Hidden automatically on desktop layouts */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center justify-center p-2 rounded-xl bg-none border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          {/* Right-aligned spacing balancer if no text brand element is present on desktop header line */}
          <div className="hidden lg:block" />

          {/* ALERTS AND COMMUNICATIONS MODULE */}
          <div className="flex items-center gap-3">
            <NotificationsBell userEmail={userEmail} />
          </div>
        </header>

        {/* ====== CORE APPLICATION VIEWS OUTPUT ====== */}
        {/* Responsive padding: small screens get compact safe-padding (p-4), desktop monitors expand up (lg:p-8) */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto bg-[#faf9f6]">
          <div className="max-w-7xl mx-auto w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}