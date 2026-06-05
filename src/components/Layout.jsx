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
    <div style={{
      display: "flex",
      background: "#faf9f6",
      minHeight: "100vh",
      fontFamily: "'Segoe UI', sans-serif"
    }}>

      {/* ====== OVERLAY (shown whenever sidebar is open) ====== */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 98,
            backdropFilter: "blur(2px)",
            WebkitBackdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* ====== SIDEBAR — hidden off-screen, slides in when open ====== */}
      <aside style={{
        width: "270px",
        background: "linear-gradient(180deg,#031510 0%,#061d16 55%,#03120d 100%)",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        padding: "22px 18px",
        display: "flex",
        flexDirection: "column",
        borderRight: "1px solid rgba(255,255,255,0.04)",
        overflowY: "auto",
        zIndex: 100,
        /* KEY CHANGE: always translate off-screen, only slide in when open */
        transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: sidebarOpen ? "4px 0 32px rgba(0,0,0,0.4)" : "none",
      }}>

        {/* HEADER ROW: Brand + Close Button */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "28px",
        }}>
          {/* BRAND */}
          <div style={{ display: "flex", alignItems: "center", gap: "14px", paddingLeft: "6px" }}>
            <div style={{
              width: "48px", height: "48px", borderRadius: "16px",
              background: "linear-gradient(135deg,#22c55e,#16a34a)",
              display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: "24px",
              boxShadow: "0 10px 25px rgba(34,197,94,0.35)", flexShrink: 0
            }}>
              🐔
            </div>
            <div>
              <div style={{ color: "white", fontSize: "17px", fontWeight: "800", letterSpacing: "-0.4px" }}>
                Farmers
              </div>
              <div style={{ color: "#22c55e", fontSize: "16px", fontWeight: "700", marginTop: "1px" }}>
                Connect
              </div>
            </div>
          </div>

          {/* CLOSE BUTTON */}
          <button
            onClick={() => setSidebarOpen(false)}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              width: "36px", height: "36px",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              color: "rgba(255,255,255,0.6)",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "rgba(239,68,68,0.15)";
              e.currentTarget.style.color = "#ef4444";
              e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              e.currentTarget.style.color = "rgba(255,255,255,0.6)";
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* ROLE BADGE */}
        <div style={{ paddingLeft: "6px", marginBottom: "16px" }}>
          <span style={{
            display: "inline-block",
            background: "rgba(34,197,94,0.12)",
            color: "#22c55e", fontSize: "11px", fontWeight: "600",
            padding: "4px 12px", borderRadius: "20px",
            textTransform: "capitalize", letterSpacing: "0.05em",
            border: "1px solid rgba(34,197,94,0.2)"
          }}>
            {role || "farmer"}
          </span>
        </div>

        {/* NAVIGATION */}
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", flex: 1 }}>
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
                style={{ textDecoration: "none" }}
              >
                <div style={{
                  height: "54px", borderRadius: "18px", padding: "0 18px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  transition: "all 0.2s ease",
                  background: active ? "linear-gradient(135deg,#2cc56f,#18a957)" : "transparent",
                  color: active ? "white" : "#9aa4a0",
                  boxShadow: active ? "0 14px 35px rgba(34,197,94,0.22)" : "none"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <Icon size={20} />
                    <span style={{ fontSize: "15px", fontWeight: active ? "700" : "500" }}>
                      {item.name}
                    </span>
                  </div>
                  {active && <ChevronRight size={16} />}
                </div>
              </Link>
            );
          })}
        </div>

        {/* USER CARD + LOGOUT */}
        <div style={{ marginTop: "20px" }}>
          <div style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "22px", padding: "14px 16px", marginBottom: "8px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{
                width: "44px", height: "44px", borderRadius: "50%",
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: "700", fontSize: "16px", flexShrink: 0
              }}>
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar"
                    style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
                ) : initials}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{
                  color: "white", fontWeight: "600", fontSize: "13px",
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
                }}>
                  {profile?.full_name || "Farmer"}
                </div>
                <div style={{ color: "#8a9490", fontSize: "11px", marginTop: "2px" }}>
                  {userEmail}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              width: "100%", display: "flex", alignItems: "center",
              gap: "10px", padding: "12px 18px", borderRadius: "14px",
              border: "none", background: "transparent",
              color: "rgba(255,255,255,0.4)", cursor: "pointer",
              fontSize: "14px", fontWeight: "500", transition: "all 0.2s"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(239,68,68,0.1)";
              e.currentTarget.style.color = "#ef4444";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "rgba(255,255,255,0.4)";
            }}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ====== MAIN AREA — always takes full width since sidebar is overlaid ====== */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", width: "100%" }}>

        {/* TOP BAR */}
        <header style={{
          height: "64px",
          background: "#fff",
          borderBottom: "1px solid #e9eef2",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 20px",
          position: "sticky",
          top: 0,
          zIndex: 99,
        }}>
          {/* HAMBURGER MENU ICON — always visible */}
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: "none",
              border: "1px solid #e5e7eb",
              borderRadius: "10px",
              cursor: "pointer",
              padding: "8px 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#374151",
              transition: "all 0.2s",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = "#f3f4f6";
              e.currentTarget.style.borderColor = "#d1d5db";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = "none";
              e.currentTarget.style.borderColor = "#e5e7eb";
            }}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          {/* RIGHT SIDE */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <NotificationsBell userEmail={userEmail} />
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main style={{ flex: 1, padding: "28px", overflowY: "auto", background: "#faf9f6" }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
