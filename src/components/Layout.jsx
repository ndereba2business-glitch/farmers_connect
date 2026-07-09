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
import "./Layout.css";

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
    <div className="fc-layout">

      {/* MOBILE BACKDROP OVERLAY */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fc-backdrop"
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fc-sidebar ${sidebarOpen ? "fc-sidebar--open" : ""}`}>

        <div className="fc-sidebar-header">
          <div className="fc-brand">
            <div className="fc-logo-icon">🐔</div>
            <div>
              <div className="fc-logo-line1">Farmers</div>
              <div className="fc-logo-line2">Connect</div>
            </div>
          </div>

          <button
            onClick={() => setSidebarOpen(false)}
            className="fc-close-btn"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        <div className="fc-role-badge-wrap">
          <span className="fc-role-badge">{role || "farmer"}</span>
        </div>

        <nav className="fc-nav">
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
                className="fc-nav-link-wrap"
              >
                <div className={`fc-nav-link ${active ? "fc-nav-link--active" : ""}`}>
                  <div className="fc-nav-link-left">
                    <Icon size={20} className="fc-nav-icon" />
                    <span className="fc-nav-label">{item.name}</span>
                  </div>
                  {active && <ChevronRight size={16} className="fc-nav-chevron" />}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="fc-sidebar-footer">
          <div className="fc-user-card">
            <div className="fc-avatar">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" />
              ) : initials}
            </div>
            <div className="fc-user-info">
              <div className="fc-user-name">{profile?.full_name || "Farmer"}</div>
              <div className="fc-user-email">{userEmail}</div>
            </div>
          </div>

          <button onClick={handleLogout} className="fc-signout-btn">
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* APP WRAPPER */}
      <div className="fc-app-wrapper">

        <header className="fc-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            className="fc-hamburger-btn"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="fc-topbar-spacer" />

          <div className="fc-topbar-right">
            <NotificationsBell userEmail={userEmail} />
          </div>
        </header>

        <main className="fc-main">
          <div className="fc-main-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}