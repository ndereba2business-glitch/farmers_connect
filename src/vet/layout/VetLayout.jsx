import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useState } from "react";
import {
  Stethoscope, Search, Wifi, MessageCircle, Bell, User,
  ChevronRight, Crown, Moon, ArrowLeft, LogOut, Menu, X
} from "lucide-react";
import { VET_NAV } from "./vetNavConfig";
import "./VetLayout.css";

export default function VetLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { profile, userEmail, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const vetName = profile?.full_name
    ? `Dr. ${profile.full_name}`
    : "Dr. Vet";

  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "short", day: "numeric"
  });

  return (
    <div className="vw-layout">

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="vw-backdrop" />
      )}

      <aside className={`vw-sidebar ${sidebarOpen ? "vw-sidebar--open" : ""}`}>

        {/* BRAND */}
        <div className="vw-sidebar-header">
          <div className="vw-brand">
            <div className="vw-logo-icon">
              <Stethoscope size={22} color="#fff" />
            </div>
            <div>
              <div className="vw-logo-line1">Farmers</div>
              <div className="vw-logo-line2">Vet Workspace</div>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="vw-close-btn"
            aria-label="Close menu"
          >
            <X size={16} />
          </button>
        </div>

        {/* SCROLLABLE NAV */}
        <nav className="vw-nav">
          {VET_NAV.map((item) => {
            const Icon = item.icon;
            const active = location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className="vw-nav-link-wrap"
              >
                <div className={`vw-nav-link ${active ? "vw-nav-link--active" : ""}`}>
                  <div className="vw-nav-link-left">
                    <Icon size={19} className="vw-nav-icon" />
                    <span className="vw-nav-label">{item.name}</span>
                  </div>
                  {active && <ChevronRight size={15} className="vw-nav-chevron" />}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* PINNED WORKSPACE FOOTER */}
        <div className="vw-footer">
          <p className="vw-footer-label">Workspace</p>

          <div className="vw-workspace-card">
            <div className="vw-workspace-icon">
              <Stethoscope size={16} color="#fff" />
            </div>
            <div>
              <div className="vw-workspace-name">Veterinarian</div>
              <div className="vw-workspace-current">✓ Current</div>
            </div>
          </div>

          <button className="vw-footer-row" disabled>
            <span className="vw-footer-row-left">
              <Crown size={16} />
              Switch Workspace
            </span>
            <span className="vw-premium-badge">Premium</span>
          </button>

          {/* TODO: wire up real theme state in a later chat */}
          <button className="vw-footer-row" disabled>
            <span className="vw-footer-row-left">
              <Moon size={16} />
              Dark Mode
            </span>
          </button>

          <Link to="/" className="vw-footer-row vw-back-link">
            <span className="vw-footer-row-left">
              <ArrowLeft size={16} />
              Back to Farmers Connect
            </span>
          </Link>

          <button onClick={handleLogout} className="vw-signout-btn">
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN AREA */}
      <div className="vw-app-wrapper">

        <header className="vw-topbar">
          <button
            onClick={() => setSidebarOpen(true)}
            className="vw-hamburger-btn"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div className="vw-search-wrap">
            <Search size={16} className="vw-search-icon" />
            <input placeholder="Search farmers..." className="vw-search-input" />
          </div>

          <div className="vw-topbar-right">
            <div className="vw-online-pill">
              <Wifi size={14} />
              Online
            </div>
            <button className="vw-icon-btn" aria-label="Messages">
              <MessageCircle size={19} />
            </button>
            <button className="vw-icon-btn" aria-label="Notifications">
              <Bell size={19} />
              <span className="vw-notif-dot" />
            </button>
            <div className="vw-user-block">
              <div className="vw-avatar">
                <User size={18} color="#fff" />
              </div>
              <div className="vw-user-text">
                <div className="vw-user-name">{vetName}</div>
                <div className="vw-user-date">{today}</div>
              </div>
            </div>
          </div>
        </header>

        <main className="vw-main">
          <div className="vw-main-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}