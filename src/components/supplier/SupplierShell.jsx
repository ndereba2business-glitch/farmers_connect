import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Inbox, Package, ShoppingBag, Store, Wallet, UserCircle,
  Menu, X, LogOut
} from "lucide-react";
import { IN_APP_ORDERING } from "../../config/features";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import NotificationsBell from "../NotificationsBell";
import { SupplierContext } from "./supplierContext";
import { VERIFICATION_META, initialsOf } from "./supplierFormat";
import "./SupplierShell.css";

const ORDERS_LINK = { to: "/supplier-orders", label: "Order requests", icon: Inbox, badge: true };

const NAV = [
  { to: "/supplier", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/supplier/products", label: "Products", icon: Package },
  ...(IN_APP_ORDERING ? [ORDERS_LINK] : []),
  { to: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { to: "/supplier-profile", label: "Supplier profile", icon: Store },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/profile", label: "Account", icon: UserCircle }
];

const BOTTOM_NAV = [
  { to: "/supplier", label: "Home", icon: LayoutDashboard, end: true },
  { to: "/supplier/products", label: "Products", icon: Package },
  IN_APP_ORDERING
    ? { ...ORDERS_LINK, label: "Requests" }
    : { to: "/marketplace", label: "Market", icon: ShoppingBag },
  { to: "/supplier-profile", label: "Profile", icon: Store }
];

const TITLES = [
  ["/supplier/products/new", "Add product"],
  ["/supplier/products/", "Edit product"],
  ["/supplier/products", "Products"],
  ["/supplier-orders", "Order requests"],
  ["/supplier-profile", "Supplier profile"],
  ["/supplier", "Dashboard"],
  ["/marketplace", "Marketplace"],
  ["/wallet", "Wallet"],
  ["/profile", "Account"],
  ["/suppliers", "Supplier directory"]
];

function titleFor(pathname) {
  // match whole path segments, so "/suppliers" doesn't match "/supplier"
  return TITLES.find(([prefix]) =>
    pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`)
  )?.[1] || "Farmers Connect";
}

const PROFILE_COLUMNS =
  "id, business_name, verification_status, supplier_type, product_categories, county, location_details, " +
  "phone, whatsapp_number, description, delivery_available, operating_hours, logo_url";

function Badge({ count }) {
  if (!count) return null;
  return (
    <span className="ss-badge" aria-label={`${count} waiting`}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

export default function SupplierShell() {
  const { user, userEmail, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");
  const [pendingCount, setPendingCount] = useState(0);
  const [reload, setReload] = useState(0);

  const refreshProfile = useCallback(() => setReload(n => n + 1), []);
  const retryProfile = useCallback(() => {
    setProfileError("");
    setProfileLoading(true);
    setReload(n => n + 1);
  }, []);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    async function load() {
      const { data, error } = await supabase
        .from("supplier_profiles")
        .select(PROFILE_COLUMNS)
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        setProfileError("We couldn't load your supplier account. Check your connection and try again.");
      } else {
        setProfile(data || null);
        setProfileError("");
      }
      setProfileLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user, reload]);

  const profileId = profile?.id;

  useEffect(() => {
    if (!profileId || !IN_APP_ORDERING) return undefined;
    let cancelled = false;

    async function loadCount() {
      const { count } = await supabase
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", profileId)
        .eq("status", "pending");
      if (!cancelled) setPendingCount(count || 0);
    }

    loadCount();
    return () => { cancelled = true; };
  }, [profileId, reload]);

  useEffect(() => {
    if (!profileId || !IN_APP_ORDERING) return undefined;
    const channel = supabase
      .channel(`supplier-shell-${profileId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `supplier_id=eq.${profileId}` },
        refreshProfile
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [profileId, refreshProfile]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const contextValue = useMemo(
    () => ({ profile, profileLoading, profileError, pendingCount, refreshProfile, retryProfile }),
    [profile, profileLoading, profileError, pendingCount, refreshProfile, retryProfile]
  );

  const title = titleFor(location.pathname);
  const displayName = profile?.business_name || userEmail || "Supplier";
  const status = profile ? VERIFICATION_META[profile.verification_status] : null;

  function renderLink(item, { onNavigate } = {}) {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.end}
        onClick={onNavigate}
        className={({ isActive }) => `ss-link${isActive ? " ss-link--active" : ""}`}
      >
        <Icon size={20} aria-hidden="true" />
        <span className="ss-link-label">{item.label}</span>
        {item.badge && <Badge count={pendingCount} />}
      </NavLink>
    );
  }

  return (
    <SupplierContext.Provider value={contextValue}>
      <div className="ss-root">
        {drawerOpen && <div className="ss-backdrop" onClick={() => setDrawerOpen(false)} aria-hidden="true" />}

        <aside className={`ss-sidebar${drawerOpen ? " ss-sidebar--open" : ""}`} aria-label="Supplier navigation">
          <div className="ss-sidebar-head">
            <div className="ss-brand">
              <span className="ss-brand-mark" aria-hidden="true">🐔</span>
              <span className="ss-brand-text">
                Farmers <b>Connect</b>
              </span>
            </div>
            <button className="ss-icon-btn ss-close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
              <X size={20} />
            </button>
          </div>

          <nav className="ss-nav">
            {NAV.map(item => renderLink(item, { onNavigate: () => setDrawerOpen(false) }))}
          </nav>

          <div className="ss-sidebar-foot">
            <div className="ss-user">
              <span className="ss-avatar" aria-hidden="true">{initialsOf(displayName)}</span>
              <span className="ss-user-text">
                <span className="ss-user-name">{displayName}</span>
                <span className="ss-user-sub">{userEmail}</span>
              </span>
            </div>
            <button className="ss-signout" onClick={handleLogout}>
              <LogOut size={18} aria-hidden="true" /> Sign out
            </button>
          </div>
        </aside>

        <div className="ss-body">
          <header className="ss-topbar">
            <button className="ss-icon-btn ss-menu" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
              <Menu size={22} />
            </button>
            <span className="ss-topbar-title">{title}</span>
            <div className="ss-topbar-right">
              {status && (
                <span className={`ss-status ss-status--${status.tone}`}>
                  <span className="ss-status-dot" aria-hidden="true" />
                  {status.label}
                </span>
              )}
              <div className="ss-bell">
                <NotificationsBell userEmail={userEmail} />
              </div>
            </div>
          </header>

          <main className="ss-main">
            <div className="ss-main-inner">
              <Outlet />
            </div>
          </main>
        </div>

        <nav className="ss-bottomnav" aria-label="Quick navigation">
          {BOTTOM_NAV.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `ss-tab${isActive ? " ss-tab--active" : ""}`}
              >
                <span className="ss-tab-icon">
                  <Icon size={22} aria-hidden="true" />
                  {item.badge && <Badge count={pendingCount} />}
                </span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>
    </SupplierContext.Provider>
  );
}
