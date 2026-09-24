import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Store, Plus } from "lucide-react";
import { useSupplier } from "../components/supplier/supplierContext";
import { useSupplierProducts } from "../components/supplier/useSupplierProducts";
import { buildActivity, computeOverview } from "../components/supplier/dashboardData";
import {
  ActivityFeed, ListSkeleton, OrderSummary, OverviewCards, ProductList,
  ProfileSkeleton, ProfileSummary, QuickActions, StatsSkeleton
} from "../components/supplier/DashboardWidgets";
import { IN_APP_ORDERING } from "../config/features";
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
  const data = useSupplierProducts(profile?.id);

  const overview = useMemo(() => computeOverview(data.products, data.orders), [data.products, data.orders]);
  const activity = useMemo(() => buildActivity(data.products, data.orders), [data.products, data.orders]);

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
            Tell farmers who you are and what you supply. Once your profile is set up you can
            list products, and farmers can find you and call or WhatsApp you directly.
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
          <p>Welcome back, {profile.business_name}. Here's how your products are doing.</p>
        </div>
        <Link to="/supplier/products/new" className="sd-btn sd-btn--primary">
          <Plus size={16} aria-hidden="true" /> Add a product
        </Link>
      </header>

      {!isVerified && (
        <div role="status" className="sd-banner sd-banner--warn">
          {profile.verification_status === "pending"
            ? "Your profile is waiting for admin review. Your products are listed, but the verified badge only appears once you're approved."
            : <>Your profile is <b>{profile.verification_status}</b>. Check your supplier profile for details.</>}
        </div>
      )}

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
          {IN_APP_ORDERING && <OrderSummary overview={overview} />}
          <QuickActions pendingCount={overview.pendingRequests} />
          <div className="sd-grid">
            <ProductList products={data.products} />
            <ActivityFeed events={activity} />
          </div>
        </>
      )}
    </div>
  );
}
