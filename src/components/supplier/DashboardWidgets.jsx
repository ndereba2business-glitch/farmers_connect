import { Link } from "react-router-dom";
import {
  Package, Check, TriangleAlert, Inbox, Plus, Pencil, Search, Truck,
  MapPin, Phone, ArrowRight, ShoppingBag, Clock
} from "lucide-react";
import {
  TYPE_LABELS, UNIT_LABELS, VERIFICATION_META, formatKes, initialsOf, timeAgo
} from "./supplierFormat";

/* ------------------------------------------------------------ skeletons */
export function ProfileSkeleton() {
  return (
    <div className="sd-card sd-skel-card" aria-hidden="true">
      <div className="sd-skel sd-skel--circle" />
      <div className="sd-skel-lines">
        <div className="sd-skel sd-skel--line" style={{ width: "45%" }} />
        <div className="sd-skel sd-skel--line" style={{ width: "70%" }} />
      </div>
    </div>
  );
}

export function StatsSkeleton() {
  return (
    <ul className="sd-stats" aria-hidden="true">
      {[0, 1, 2, 3].map(i => (
        <li key={i} className="sd-stat">
          <div className="sd-skel sd-skel--icon" />
          <div className="sd-skel sd-skel--value" />
          <div className="sd-skel sd-skel--line" style={{ width: "60%" }} />
        </li>
      ))}
    </ul>
  );
}

export function ListSkeleton({ rows = 3 }) {
  return (
    <div className="sd-list" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="sd-row">
          <div className="sd-skel sd-skel--thumb" />
          <div className="sd-skel-lines">
            <div className="sd-skel sd-skel--line" style={{ width: "55%" }} />
            <div className="sd-skel sd-skel--line" style={{ width: "35%" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------- profile card */
export function ProfileSummary({ profile }) {
  const status = VERIFICATION_META[profile.verification_status] || VERIFICATION_META.pending;
  const isVerified = profile.verification_status === "verified";

  return (
    <section className="sd-card sd-profile" aria-label="Supplier profile summary">
      <div className="sd-profile-main">
        <span className="sd-avatar" aria-hidden="true">{initialsOf(profile.business_name)}</span>
        <div className="sd-profile-text">
          <div className="sd-profile-name">
            <h2>{profile.business_name}</h2>
            <span className={`sd-chip sd-tone-${status.tone}`}>{status.label}</span>
          </div>
          <ul className="sd-meta">
            {profile.supplier_type && <li>{TYPE_LABELS[profile.supplier_type] || profile.supplier_type}</li>}
            {profile.county && <li><MapPin size={14} aria-hidden="true" /> {profile.county}</li>}
            {profile.phone && <li><Phone size={14} aria-hidden="true" /> {profile.phone}</li>}
            {profile.delivery_available && <li><Truck size={14} aria-hidden="true" /> Delivers</li>}
          </ul>
          {profile.description && <p className="sd-profile-desc">{profile.description}</p>}
        </div>
      </div>
      <div className="sd-profile-actions">
        <Link to="/supplier-profile" className="sd-btn sd-btn--ghost">
          <Pencil size={16} aria-hidden="true" /> Edit profile
        </Link>
        {isVerified && (
          <Link to="/suppliers" className="sd-btn sd-btn--ghost">
            <Search size={16} aria-hidden="true" /> See how farmers find you
          </Link>
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------- overview */
function StatCard({ icon: Icon, label, value, hint, tone, to }) {
  const body = (
    <>
      <span className={`sd-stat-icon sd-tone-${tone}`}><Icon size={20} aria-hidden="true" /></span>
      <span className="sd-stat-value">{value}</span>
      <span className="sd-stat-label">{label}</span>
      {hint && <span className="sd-stat-hint">{hint}</span>}
    </>
  );
  return (
    <li>
      {to
        ? <Link to={to} className="sd-stat sd-stat--link">{body}</Link>
        : <div className="sd-stat">{body}</div>}
    </li>
  );
}

export function OverviewCards({ overview }) {
  return (
    <ul className="sd-stats" aria-label="Overview">
      <StatCard icon={Package} tone="neutral" label="Total products" value={overview.totalProducts} to="/marketplace" />
      <StatCard icon={Check} tone="green" label="Active products" value={overview.activeProducts} hint="Not marked sold out" />
      <StatCard icon={TriangleAlert} tone={overview.outOfStock > 0 ? "amber" : "neutral"} label="Out of stock" value={overview.outOfStock} hint="Marked sold out" />
      <StatCard icon={Inbox} tone={overview.pendingRequests > 0 ? "blue" : "neutral"} label="Pending requests" value={overview.pendingRequests} hint="Waiting for you" to="/supplier-orders" />
    </ul>
  );
}

export function OrderSummary({ overview }) {
  return (
    <dl className="sd-summary" aria-label="Order summary">
      <div><dt>In progress</dt><dd>{overview.inProgress}</dd></div>
      <div><dt>Delivered</dt><dd>{overview.delivered}</dd></div>
      <div><dt>Earned from delivered</dt><dd>{formatKes(overview.earned)}</dd></div>
    </dl>
  );
}

/* --------------------------------------------------------- quick actions */
export function QuickActions({ pendingCount }) {
  const actions = [
    { to: "/marketplace", icon: Plus, label: "List a product", hint: "Add something to sell" },
    { to: "/supplier-orders", icon: Inbox, label: "Order requests", hint: pendingCount > 0 ? `${pendingCount} waiting` : "Review and confirm" },
    { to: "/supplier-profile", icon: Pencil, label: "Edit profile", hint: "Update your details" },
    { to: "/marketplace", icon: ShoppingBag, label: "Browse marketplace", hint: "See what others list" }
  ];
  return (
    <section aria-labelledby="sd-actions-title">
      <h2 id="sd-actions-title" className="sd-section-title">Quick actions</h2>
      <ul className="sd-actions">
        {actions.map(a => {
          const Icon = a.icon;
          return (
            <li key={a.label}>
              <Link to={a.to} className="sd-action">
                <span className="sd-action-icon"><Icon size={20} aria-hidden="true" /></span>
                <span className="sd-action-text">
                  <span className="sd-action-label">{a.label}</span>
                  <span className="sd-action-hint">{a.hint}</span>
                </span>
                <ArrowRight size={16} className="sd-action-arrow" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* -------------------------------------------------------------- activity */
export function ActivityFeed({ events }) {
  return (
    <section className="sd-card" aria-labelledby="sd-activity-title">
      <h2 id="sd-activity-title" className="sd-section-title">Recent activity</h2>
      {events.length === 0 ? (
        <div className="sd-empty sd-empty--compact">
          <Clock size={28} aria-hidden="true" />
          <p>Nothing yet. Listings you add and order requests you receive will show up here.</p>
        </div>
      ) : (
        <ol className="sd-feed">
          {events.map(e => (
            <li key={e.id} className="sd-feed-item">
              <span className={`sd-feed-icon sd-tone-${e.kind === "product" ? "green" : "blue"}`}>
                {e.kind === "product" ? <Package size={16} aria-hidden="true" /> : <Inbox size={16} aria-hidden="true" />}
              </span>
              <div className="sd-feed-text">
                <span className="sd-feed-title">{e.title}</span>
                <span className="sd-feed-sub">
                  {e.detail}
                  {e.status && <span className={`sd-chip sd-tone-${e.status.tone}`}>{e.status.label}</span>}
                </span>
              </div>
              <time className="sd-feed-time" dateTime={e.at.toISOString()}>{timeAgo(e.at)}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* -------------------------------------------------------------- products */
export function ProductList({ products, busyId, onToggle }) {
  const shown = products.slice(0, 6);

  return (
    <section className="sd-card" aria-labelledby="sd-products-title">
      <div className="sd-section-head">
        <h2 id="sd-products-title" className="sd-section-title">Your products</h2>
        {products.length > 0 && (
          <Link to="/marketplace" className="sd-link">Manage listings</Link>
        )}
      </div>

      {products.length === 0 ? (
        <div className="sd-empty">
          <Package size={36} aria-hidden="true" />
          <h3>No products listed yet</h3>
          <p>List your first product so farmers can find and order it.</p>
          <Link to="/marketplace" className="sd-btn sd-btn--primary">
            <Plus size={16} aria-hidden="true" /> List a product
          </Link>
        </div>
      ) : (
        <ul className="sd-list">
          {shown.map(p => (
            <li key={p.id} className="sd-row">
              <span className="sd-thumb" aria-hidden="true">
                {p.image_url
                  ? <img src={p.image_url} alt="" loading="lazy" />
                  : <Package size={20} />}
              </span>
              <div className="sd-row-text">
                <span className="sd-row-title">{p.product_name}</span>
                <span className="sd-row-sub">
                  {formatKes(p.price)}{UNIT_LABELS[p.unit] || ""}
                  {p.stock > 0 ? ` · ${p.stock} in stock` : ""}
                </span>
              </div>
              <span className={`sd-chip sd-tone-${p.sold_out ? "amber" : "green"}`}>
                {p.sold_out ? "Sold out" : "Available"}
              </span>
              <button
                className="sd-btn sd-btn--ghost sd-btn--sm"
                disabled={busyId === p.id}
                onClick={() => onToggle(p)}
              >
                {p.sold_out ? "Mark available" : "Mark sold out"}
              </button>
            </li>
          ))}
        </ul>
      )}
      {products.length > shown.length && (
        <p className="sd-more">Showing {shown.length} of {products.length} products.</p>
      )}
    </section>
  );
}
