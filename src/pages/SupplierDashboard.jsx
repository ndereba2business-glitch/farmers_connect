import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Store, Plus } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useSupplier } from "../components/supplier/supplierContext";
import { useSupplierDashboardData } from "../components/supplier/useSupplierDashboardData";
import { buildActivity, computeOverview } from "../components/supplier/dashboardData";
import {
  ActivityFeed, ListSkeleton, OrderSummary, OverviewCards, ProductList,
  ProfileSkeleton, ProfileSummary, QuickActions, StatsSkeleton
} from "../components/supplier/DashboardWidgets";
import "./SupplierDashboard.css";

function ErrorBanner({ message, onRetry }) {
  return (
    <div role="alert" className="sd-banner sd-banner--error">
      <span>{message}</span>
      {onRetry && (
        <button className="sd-btn sd-btn--ghost sd-btn--sm" onClick={onRetry}>Try again</button>
      )}
    </div>
  );
}

export default function SupplierDashboard() {
  const { profile, profileLoading, profileError, retryProfile } = useSupplier();
  const data = useSupplierDashboardData(profile?.id);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");

  const overview = useMemo(() => computeOverview(data.products, data.orders), [data.products, data.orders]);
  const activity = useMemo(() => buildActivity(data.products, data.orders), [data.products, data.orders]);

  async function toggleSoldOut(product) {
    setBusyId(product.id);
    setActionError("");
    const { error } = await supabase
      .from("products")
      .update({ sold_out: !product.sold_out })
      .eq("id", product.id);
    setBusyId(null);

    if (error) {
      setActionError("That change didn't save: " + error.message);
      return;
    }
    data.refresh();
  }

  if (profileLoading) {
    return (
      <div className="sd-page" aria-busy="true" aria-live="polite">
        <span className="sd-sr">Loading your dashboard</span>
        <ProfileSkeleton />
        <StatsSkeleton />
        <div className="sd-grid">
          <div className="sd-card"><ListSkeleton /></div>
          <div className="sd-card"><ListSkeleton /></div>
        </div>
      </div>
    );
  }

  if (profileError) {
    return (
      <div className="sd-page">
        <ErrorBanner message={profileError} onRetry={retryProfile} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="sd-page">
        <section className="sd-card sd-empty sd-empty--hero">
          <Store size={44} aria-hidden="true" />
          <h1>Set up your supplier profile</h1>
          <p>
            Tell farmers who you are and what you supply. Once an admin verifies your
            profile, your products can be ordered and requests appear on this dashboard.
          </p>
          <Link to="/supplier-profile" className="sd-btn sd-btn--primary">Set up supplier profile</Link>
        </section>
      </div>
    );
  }

  const isVerified = profile.verification_status === "verified";

  return (
    <div className="sd-page">
      <header className="sd-header">
        <div>
          <h1>Dashboard</h1>
          <p>Welcome back, {profile.business_name}. Here's how your listings and order requests are doing.</p>
        </div>
        <Link to="/marketplace" className="sd-btn sd-btn--primary">
          <Plus size={16} aria-hidden="true" /> List a product
        </Link>
      </header>

      {!isVerified && (
        <div role="status" className="sd-banner sd-banner--warn">
          Your profile is <b>{profile.verification_status}</b>. Farmers can only order from verified
          suppliers, so no requests will arrive until an admin approves it.
        </div>
      )}

      {actionError && <ErrorBanner message={actionError} />}

      <ProfileSummary profile={profile} />

      {data.error ? (
        <ErrorBanner message={data.error} onRetry={data.retry} />
      ) : data.loading ? (
        <>
          <StatsSkeleton />
          <div className="sd-grid" aria-hidden="true">
            <div className="sd-card"><ListSkeleton /></div>
            <div className="sd-card"><ListSkeleton /></div>
          </div>
        </>
      ) : (
        <>
          <OverviewCards overview={overview} />
          <OrderSummary overview={overview} />
          <QuickActions pendingCount={overview.pendingRequests} />
          <div className="sd-grid">
            <ProductList products={data.products} busyId={busyId} onToggle={toggleSoldOut} />
            <ActivityFeed events={activity} />
          </div>
        </>
      )}
    </div>
  );
}
