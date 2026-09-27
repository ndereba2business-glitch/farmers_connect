import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Clock, Eye, EyeOff, MapPin, Package, Pencil, Plus, RefreshCw, Search, Store } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../context/ToastContext";
import { useSupplier } from "../components/supplier/supplierContext";
import { needsCheck, productStatus, useSupplierProducts } from "../components/supplier/useSupplierProducts";
import { CATEGORIES, CATEGORY_LABELS, parseDbDate } from "../components/supplier/supplierFormat";
import {
  AVAILABILITY, AVAILABILITY_OPTIONS, STALE_DAYS, freshness, minOrderText, priceText, unitSuffix
} from "../lib/productListing";
import "../components/supplier/SupplierForms.css";
import "./SupplierProducts.css";

const updatedAt = (p) => freshness(p).date || 0;

const SORTS = {
  newest: { label: "Newest first", fn: (a, b) => (parseDbDate(b.created_at) || 0) - (parseDbDate(a.created_at) || 0) },
  stalest: { label: "Least recently updated", fn: (a, b) => updatedAt(a) - updatedAt(b) },
  name: { label: "Name A-Z", fn: (a, b) => a.product_name.localeCompare(b.product_name) },
  priceLow: { label: "Price: low to high", fn: (a, b) => Number(a.price) - Number(b.price) },
  priceHigh: { label: "Price: high to low", fn: (a, b) => Number(b.price) - Number(a.price) }
};

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  ...Object.entries(AVAILABILITY).map(([value, meta]) => ({ value, label: meta.label })),
  { value: "inactive", label: "Inactive (hidden)" },
  { value: "stale", label: "Needs a check" }
];

const matchesStatus = (p, status) =>
  status === "all" || (status === "stale" ? needsCheck(p) : productStatus(p).key === status);

function ProductCard({ product, busy, onToggleActive, onAvailability, onConfirm }) {
  const status = productStatus(product);
  const fresh = freshness(product);
  const stale = needsCheck(product);
  const place = [product.location_details, product.county].filter(Boolean).join(", ");
  const minOrder = minOrderText(product);

  return (
    <li className={`spl-card${product.is_active ? "" : " spl-card--inactive"}`}>
      <div className="spl-media">
        {product.image_url
          ? <img src={product.image_url} alt="" loading="lazy" />
          : <Package size={32} aria-hidden="true" />}
        <span className={`spl-status sf-tone-${status.tone}`}>{status.label}</span>
      </div>
      <div className="spl-body">
        <span className="spl-cat">{CATEGORY_LABELS[product.category] || product.category}</span>
        <h3 className="spl-name">{product.product_name}</h3>
        <div className="spl-price">
          {priceText(product)}<span>{unitSuffix(product.unit)}</span>
        </div>
        <ul className="spl-meta">
          {minOrder && <li>{minOrder}</li>}
          {product.stock > 0 && <li>{product.stock} available</li>}
          {place && <li><MapPin size={13} aria-hidden="true" /> {place}</li>}
          <li className={stale ? "spl-stale-text" : undefined}><Clock size={13} aria-hidden="true" /> {fresh.label}</li>
        </ul>
      </div>

      {stale && (
        <div className="spl-check">
          <span>Farmers see this hasn't been updated in {STALE_DAYS}+ days. Is it still accurate?</span>
          <button type="button" className="sf-btn sf-btn--primary sf-btn--sm" disabled={busy} onClick={() => onConfirm(product)}>
            <RefreshCw size={15} aria-hidden="true" /> Yes, still accurate
          </button>
        </div>
      )}

      <div className="spl-actions">
        {product.is_active && (
          <label className="spl-avail">
            <span className="sf-sr">Availability of {product.product_name}</span>
            <select className="sf-input" value={status.key} disabled={busy}
              onChange={e => onAvailability(product, e.target.value)}>
              {AVAILABILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        <Link to={`/supplier/products/${product.id}/edit`} className="sf-btn sf-btn--ghost sf-btn--sm">
          <Pencil size={15} aria-hidden="true" /> Edit
        </Link>
        <button type="button" className="sf-btn sf-btn--ghost sf-btn--sm" disabled={busy} onClick={() => onToggleActive(product)}>
          {product.is_active
            ? <><EyeOff size={15} aria-hidden="true" /> Deactivate</>
            : <><Eye size={15} aria-hidden="true" /> Activate</>}
        </button>
      </div>
    </li>
  );
}

function ListSkeleton() {
  return (
    <ul className="spl-grid" aria-hidden="true">
      {[0, 1, 2].map(i => (
        <li key={i} className="spl-card">
          <div className="spl-media spl-skel" />
          <div className="spl-body">
            <div className="spl-skel spl-skel--line" style={{ width: "40%" }} />
            <div className="spl-skel spl-skel--line" style={{ width: "75%", height: 16 }} />
            <div className="spl-skel spl-skel--line" style={{ width: "50%" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function SupplierProducts() {
  const toast = useToast();
  const { profile, profileLoading, profileError, retryProfile } = useSupplier();
  const data = useSupplierProducts(profile?.id);
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState(() =>
    STATUS_FILTERS.some(f => f.value === searchParams.get("status")) ? searchParams.get("status") : "all");
  const [sort, setSort] = useState("newest");
  const [busyId, setBusyId] = useState(null);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.products
      .filter(p => category === "all" || p.category === category)
      .filter(p => matchesStatus(p, status))
      .filter(p => !q || p.product_name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q))
      .sort(SORTS[sort].fn);
  }, [data.products, search, category, status, sort]);

  const filtered = search.trim() || category !== "all" || status !== "all";

  // Every quick change is scoped to this supplier on top of RLS, and the
  // database stamps updated_at itself.
  async function saveChange(product, changes, successMessage) {
    setBusyId(product.id);
    const { data: rows, error } = await supabase
      .from("products")
      .update(changes)
      .eq("id", product.id)
      .eq("supplier_id", profile.id)
      .select("id");
    setBusyId(null);
    if (error || !rows?.length) {
      toast.error(error ? "That change didn't save: " + error.message : "That change didn't save. Refresh and try again.");
      return;
    }
    toast.success(successMessage);
    data.refresh();
  }

  function toggleActive(product) {
    saveChange(product, { is_active: !product.is_active }, product.is_active
      ? `"${product.product_name}" is hidden from farmers.`
      : `"${product.product_name}" is visible to farmers again.`);
  }

  function changeAvailability(product, availability) {
    saveChange(product, { availability }, `"${product.product_name}" is now ${AVAILABILITY[availability].label.toLowerCase()}.`);
  }

  // Any new value works: the database replaces it with its own clock.
  function confirmStillAccurate(product) {
    saveChange(product, { updated_at: new Date().toISOString() }, `Thanks. "${product.product_name}" now shows as updated today.`);
  }

  function clearFilters() {
    setSearch("");
    setCategory("all");
    setStatus("all");
  }

  const header = (
    <header className="sf-head">
      <div>
        <h1>Products</h1>
        <p>
          {profile && !data.loading && !data.error
            ? `${data.products.length} product${data.products.length === 1 ? "" : "s"}. Farmers see active ones and contact you by phone or WhatsApp.`
            : "Everything you list for farmers."}
        </p>
      </div>
      {profile && (
        <Link to="/supplier/products/new" className="sf-btn sf-btn--primary">
          <Plus size={16} aria-hidden="true" /> Add product
        </Link>
      )}
    </header>
  );

  if (profileLoading) {
    return <div className="sf-page spl-page">{header}<ListSkeleton /></div>;
  }

  if (profileError) {
    return (
      <div className="sf-page spl-page">
        {header}
        <div role="alert" className="sf-banner sf-banner--error">
          <span>{profileError}</span>
          <button className="sf-btn sf-btn--ghost sf-btn--sm" onClick={retryProfile}>Try again</button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="sf-page spl-page">
        {header}
        <div className="sf-card spl-empty">
          <Store size={40} aria-hidden="true" />
          <h2>Set up your supplier profile first</h2>
          <p>Your products are shown with your business name and contact details, so farmers know who they're buying from.</p>
          <Link to="/supplier-profile" className="sf-btn sf-btn--primary">Set up profile</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="sf-page spl-page">
      {header}

      {data.products.length > 0 && (
        <div className="spl-toolbar" role="search">
          <label className="spl-search">
            <Search size={18} aria-hidden="true" />
            <span className="sf-sr">Search products</span>
            <input className="sf-input" type="search" placeholder="Search your products..." value={search} onChange={e => setSearch(e.target.value)} />
          </label>
          <label className="spl-select">
            <span className="sf-sr">Category</span>
            <select className="sf-input" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="spl-select">
            <span className="sf-sr">Status</span>
            <select className="sf-input" value={status} onChange={e => setStatus(e.target.value)}>
              {STATUS_FILTERS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </label>
          <label className="spl-select">
            <span className="sf-sr">Sort</span>
            <select className="sf-input" value={sort} onChange={e => setSort(e.target.value)}>
              {Object.entries(SORTS).map(([key, s]) => <option key={key} value={key}>{s.label}</option>)}
            </select>
          </label>
        </div>
      )}

      {data.error ? (
        <div role="alert" className="sf-banner sf-banner--error">
          <span>{data.error}</span>
          <button className="sf-btn sf-btn--ghost sf-btn--sm" onClick={data.retry}>Try again</button>
        </div>
      ) : data.loading ? (
        <ListSkeleton />
      ) : data.products.length === 0 ? (
        <div className="sf-card spl-empty">
          <Package size={40} aria-hidden="true" />
          <h2>No products yet</h2>
          <p>Add feeds, chicks, equipment or anything else you sell. Farmers will see it in the marketplace and can call or WhatsApp you.</p>
          <Link to="/supplier/products/new" className="sf-btn sf-btn--primary">
            <Plus size={16} aria-hidden="true" /> Add your first product
          </Link>
        </div>
      ) : shown.length === 0 ? (
        <div className="sf-card spl-empty">
          <Search size={36} aria-hidden="true" />
          <h2>No products match</h2>
          <p>Try a different search, or clear the filters.</p>
          {filtered && <button className="sf-btn sf-btn--ghost" onClick={clearFilters}>Clear filters</button>}
        </div>
      ) : (
        <>
          {filtered && <p className="spl-count" aria-live="polite">Showing {shown.length} of {data.products.length}</p>}
          <ul className="spl-grid">
            {shown.map(p => (
              <ProductCard key={p.id} product={p} busy={busyId === p.id} onToggleActive={toggleActive}
                onAvailability={changeAvailability} onConfirm={confirmStillAccurate} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
