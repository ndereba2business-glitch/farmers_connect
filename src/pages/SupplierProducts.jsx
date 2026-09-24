import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, MapPin, Package, Pencil, Plus, Search, Store } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../context/ToastContext";
import { useSupplier } from "../components/supplier/supplierContext";
import { productStatus, useSupplierProducts } from "../components/supplier/useSupplierProducts";
import { CATEGORIES, CATEGORY_LABELS, UNIT_LABELS, formatKes, parseDbDate } from "../components/supplier/supplierFormat";
import "../components/supplier/SupplierForms.css";
import "./SupplierProducts.css";

const SORTS = {
  newest: { label: "Newest first", fn: (a, b) => (parseDbDate(b.created_at) || 0) - (parseDbDate(a.created_at) || 0) },
  oldest: { label: "Oldest first", fn: (a, b) => (parseDbDate(a.created_at) || 0) - (parseDbDate(b.created_at) || 0) },
  name: { label: "Name A-Z", fn: (a, b) => a.product_name.localeCompare(b.product_name) },
  priceLow: { label: "Price: low to high", fn: (a, b) => Number(a.price) - Number(b.price) },
  priceHigh: { label: "Price: high to low", fn: (a, b) => Number(b.price) - Number(a.price) }
};

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "soldOut", label: "Out of stock" },
  { value: "inactive", label: "Inactive" }
];

function ProductCard({ product, busy, onToggleActive }) {
  const status = productStatus(product);
  const place = [product.location_details, product.county].filter(Boolean).join(", ");

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
          {formatKes(product.price)}<span>{UNIT_LABELS[product.unit] || ""}</span>
        </div>
        <ul className="spl-meta">
          {product.stock > 0 && <li>{product.stock} in stock</li>}
          {place && <li><MapPin size={13} aria-hidden="true" /> {place}</li>}
        </ul>
      </div>
      <div className="spl-actions">
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
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("newest");
  const [busyId, setBusyId] = useState(null);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.products
      .filter(p => category === "all" || p.category === category)
      .filter(p => status === "all" || productStatus(p).key === status)
      .filter(p => !q || p.product_name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q))
      .sort(SORTS[sort].fn);
  }, [data.products, search, category, status, sort]);

  const filtered = search.trim() || category !== "all" || status !== "all";

  async function toggleActive(product) {
    setBusyId(product.id);
    const { error } = await supabase
      .from("products")
      .update({ is_active: !product.is_active })
      .eq("id", product.id)
      .eq("supplier_id", profile.id);
    setBusyId(null);
    if (error) {
      toast.error("That change didn't save: " + error.message);
      return;
    }
    toast.success(product.is_active
      ? `"${product.product_name}" is hidden from farmers.`
      : `"${product.product_name}" is visible to farmers again.`);
    data.refresh();
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
              <ProductCard key={p.id} product={p} busy={busyId === p.id} onToggleActive={toggleActive} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
