import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Clock, MapPin, MessageCircle, Phone, RefreshCw, Search, Store, Truck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { CATEGORIES, CATEGORY_LABELS, initialsOf } from "./supplier/supplierFormat";
import { AVAILABILITY, freshness, priceText, unitSuffix } from "../lib/productListing";
import { recordContact, supplierMessage, telHref, whatsappHref } from "../lib/contactSupplier";
import "./SupplierDirectory.css";

const SUPPLIER_COLUMNS =
  "id, business_name, product_categories, county, location_details, operating_hours, logo_url, phone, whatsapp_number, description, delivery_available";
const PRODUCT_COLUMNS =
  "id, supplier_id, product_name, category, price, price_max, unit, availability, sold_out, created_at, updated_at";
const PRODUCTS_SHOWN = 3;
const LOAD_ERROR = "We couldn't load suppliers. Check your connection and try again.";

const availabilityOf = (p) =>
  AVAILABILITY[p.availability] ? p.availability : (p.sold_out ? "out_of_stock" : "in_stock");

// What a supplier sells, for the filter: the categories they chose on
// their profile plus the categories of what they have actually listed.
function categoriesOf(supplier, products) {
  return new Set([...(supplier.product_categories || []), ...products.map(p => p.category)].filter(Boolean));
}

function SupplierCard({ supplier, products, category, query }) {
  // Listings that match the chosen category or the search come first.
  const relevant = products.filter(p =>
    (category === "all" || p.category === category) &&
    (!query || p.product_name?.toLowerCase().includes(query)));
  const listed = (relevant.length ? relevant : products).slice(0, PRODUCTS_SHOWN);
  const more = products.length - listed.length;
  const place = [supplier.location_details, supplier.county].filter(Boolean).join(", ");
  const whatsapp = whatsappHref(supplier.whatsapp_number || supplier.phone, supplierMessage(supplier));

  return (
    <li className="fc-card sd-card">
      <div className="sd-head">
        <span className="sd-logo" aria-hidden="true">
          {supplier.logo_url
            ? <img src={supplier.logo_url} alt="" loading="lazy" width="48" height="48" />
            : initialsOf(supplier.business_name)}
        </span>
        <div className="sd-title">
          <h3>{supplier.business_name}</h3>
          <span className="fc-tag fc-tag--success"><BadgeCheck size={14} aria-hidden="true" /> Verified</span>
        </div>
      </div>

      {(supplier.product_categories || []).length > 0 && (
        <ul className="sd-cats" aria-label="What they sell">
          {supplier.product_categories.map(c => <li key={c} className="fc-tag">{CATEGORY_LABELS[c] || c}</li>)}
        </ul>
      )}

      <ul className="sd-facts">
        {place && <li><MapPin size={14} aria-hidden="true" /> {place}</li>}
        {supplier.operating_hours && <li><Clock size={14} aria-hidden="true" /> {supplier.operating_hours}</li>}
        {supplier.delivery_available && <li><Truck size={14} aria-hidden="true" /> Delivers</li>}
      </ul>

      {supplier.description && <p className="sd-about">{supplier.description}</p>}

      {listed.length > 0 ? (
        <div className="sd-products">
          <h4>Listed now</h4>
          <ul>
            {listed.map(p => {
              const availability = availabilityOf(p);
              const fresh = freshness(p);
              return (
                <li key={p.id}>
                  <span className="sd-product-name">{p.product_name}</span>
                  <span className="sd-product-price">{priceText(p)}{unitSuffix(p.unit)}</span>
                  <span className="sd-product-note">
                    {AVAILABILITY[availability].label}
                    {fresh.label ? ` · ${fresh.label}` : ""}
                    {fresh.stale ? " · confirm it is still available" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          {more > 0 && (
            <Link to="/marketplace" className="sd-more">
              {more} more listing{more === 1 ? "" : "s"} in the Marketplace
            </Link>
          )}
        </div>
      ) : (
        <p className="sd-none">No products listed yet. Ask them what they have in stock.</p>
      )}

      <div className="sd-contact">
        {telHref(supplier.phone) && (
          <a href={telHref(supplier.phone)} className="fc-btn fc-btn--secondary"
            onClick={() => recordContact({ supplierId: supplier.id, channel: "call" })}
            aria-label={`Call ${supplier.business_name}`}>
            <Phone size={16} aria-hidden="true" /> Call
          </a>
        )}
        {/* the profile form treats WhatsApp as "if different from your phone" */}
        {whatsapp && (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="fc-btn fc-btn--primary"
            onClick={() => recordContact({ supplierId: supplier.id, channel: "whatsapp" })}
            aria-label={`WhatsApp ${supplier.business_name}`}>
            <MessageCircle size={16} aria-hidden="true" /> WhatsApp
          </a>
        )}
        {!telHref(supplier.phone) && !whatsapp && (
          <p className="sd-none">This supplier has not added a phone number yet.</p>
        )}
      </div>
    </li>
  );
}

// The suppliers the Farmers Connect team has approved, with what each one
// currently lists, straight from the same tables the supplier dashboard
// writes to. Used by the Suppliers page and by the Suppliers tab of Ask
// Vet. Contact is by phone or WhatsApp only; nothing is ordered or paid
// for here, and the list is never ranked or "recommended".
export default function SupplierDirectory({ intro }) {
  const [state, setState] = useState({ loading: true, error: "", suppliers: [], products: [] });
  const [reload, setReload] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: suppliers, error } = await supabase
        .from("supplier_profiles")
        .select(SUPPLIER_COLUMNS)
        .eq("verification_status", "verified")
        .order("business_name", { ascending: true })
        .limit(200);
      if (cancelled) return;
      if (error) {
        setState(prev => ({ ...prev, loading: false, error: LOAD_ERROR }));
        return;
      }

      // Their live listings. A failure here still shows the suppliers:
      // being able to call one matters more than seeing a price list.
      let products = [];
      const ids = (suppliers || []).map(s => s.id);
      if (ids.length) {
        const { data } = await supabase
          .from("products")
          .select(PRODUCT_COLUMNS)
          .in("supplier_id", ids)
          .eq("is_active", true)
          .order("updated_at", { ascending: false })
          .limit(500);
        if (cancelled) return;
        products = data || [];
      }
      setState({ loading: false, error: "", suppliers: suppliers || [], products });
    }

    load();
    return () => { cancelled = true; };
  }, [reload]);

  // A supplier may have changed a price or run out since this was opened:
  // fetch again whenever the farmer comes back to the app.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === "visible") setReload(n => n + 1);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const bySupplier = useMemo(() => {
    const map = new Map();
    for (const p of state.products) {
      if (!map.has(p.supplier_id)) map.set(p.supplier_id, []);
      map.get(p.supplier_id).push(p);
    }
    return map;
  }, [state.products]);

  const query = search.trim().toLowerCase();
  const shown = state.suppliers.filter(s => {
    const products = bySupplier.get(s.id) || [];
    if (category !== "all" && !categoriesOf(s, products).has(category)) return false;
    if (!query) return true;
    return [s.business_name, s.county, s.location_details, s.description].some(v => v?.toLowerCase().includes(query))
      || products.some(p => p.product_name?.toLowerCase().includes(query));
  });

  function retry() {
    setState(prev => ({ ...prev, loading: true, error: "" }));
    setReload(n => n + 1);
  }

  function clearFilters() {
    setSearch("");
    setCategory("all");
  }

  return (
    <section className="sd-root" aria-label="Verified suppliers">
      {intro && <p className="sd-intro">{intro}</p>}

      <div className="sd-tools" role="search">
        <label className="sd-search">
          <Search size={18} aria-hidden="true" />
          <span className="sd-sr">Search suppliers and products</span>
          <input
            type="search"
            placeholder="Search a supplier, product or county"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </label>
        <div className="sd-filter" role="group" aria-label="Filter by what they sell">
          {[{ value: "all", label: "All" }, ...CATEGORIES].map(c => (
            <button
              key={c.value}
              type="button"
              className={`sd-chip${category === c.value ? " sd-chip--on" : ""}`}
              aria-pressed={category === c.value}
              onClick={() => setCategory(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {state.error ? (
        <div role="alert" className="sd-error">
          <span>{state.error}</span>
          <button type="button" className="fc-btn fc-btn--secondary" onClick={retry}>
            <RefreshCw size={16} aria-hidden="true" /> Try again
          </button>
        </div>
      ) : state.loading ? (
        <ul className="sd-grid" aria-hidden="true">
          {[0, 1, 2].map(i => (
            <li key={i} className="fc-card sd-card sd-skeleton">
              <span /><span /><span />
            </li>
          ))}
        </ul>
      ) : state.suppliers.length === 0 ? (
        <div className="fc-card sd-empty">
          <Store size={24} aria-hidden="true" />
          <h3>No verified suppliers yet</h3>
          <p>Suppliers appear here once our team has approved them. Until then, the Marketplace shows what other farmers and sellers have listed.</p>
          <Link to="/marketplace" className="fc-btn fc-btn--secondary">Open the Marketplace</Link>
        </div>
      ) : shown.length === 0 ? (
        <div className="fc-card sd-empty">
          <Search size={24} aria-hidden="true" />
          <h3>No suppliers match</h3>
          <p>Try another word, or look in every category.</p>
          <button type="button" className="fc-btn fc-btn--secondary" onClick={clearFilters}>Clear search and filter</button>
        </div>
      ) : (
        <>
          <p className="sd-count" aria-live="polite">
            {shown.length} supplier{shown.length === 1 ? "" : "s"}
            {shown.length !== state.suppliers.length ? ` of ${state.suppliers.length}` : ""}, in alphabetical order
          </p>
          <ul className="sd-grid">
            {shown.map(s => (
              <SupplierCard key={s.id} supplier={s} products={bySupplier.get(s.id) || []} category={category} query={query} />
            ))}
          </ul>
        </>
      )}

      <p className="sd-note">
        <BadgeCheck size={14} aria-hidden="true" /> Verified means our team reviewed and approved the supplier's profile.
        It is not a guarantee of prices or product quality. Agree the price, delivery and payment with the supplier
        yourself; Farmers Connect does not take orders or payments.
      </p>
    </section>
  );
}
