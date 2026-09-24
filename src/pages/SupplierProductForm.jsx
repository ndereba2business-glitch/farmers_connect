import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ImagePlus, PackageX, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useSupplier } from "../components/supplier/supplierContext";
import { PRODUCT_COLUMNS } from "../components/supplier/useSupplierProducts";
import { CATEGORIES, UNITS } from "../components/supplier/supplierFormat";
import { KENYA_COUNTIES } from "../components/supplier/kenyaCounties";
import { IMAGE_ACCEPT, removeImageByUrl, uploadImage, validateImage } from "../components/supplier/imageUpload";
import {
  firstError, maxLength, required, validatePhone, validatePrice, validateStock
} from "../components/supplier/formValidation";
import "../components/supplier/SupplierForms.css";

function ConfirmDelete({ name, busy, onCancel, onConfirm }) {
  const cancelRef = useRef(null);

  useEffect(() => {
    cancelRef.current?.focus();
    function onKey(e) { if (e.key === "Escape" && !busy) onCancel(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  return (
    <div className="sf-dialog-backdrop" onClick={() => !busy && onCancel()}>
      <div className="sf-dialog" role="alertdialog" aria-modal="true" aria-labelledby="del-title" aria-describedby="del-text"
        onClick={e => e.stopPropagation()}>
        <h2 id="del-title">Delete "{name}"?</h2>
        <p id="del-text">
          This removes the product and its photo for good. If you might sell it again, deactivate it instead.
          It stays saved but farmers won't see it.
        </p>
        <div className="sf-dialog-actions">
          <button ref={cancelRef} type="button" className="sf-btn sf-btn--ghost" disabled={busy} onClick={onCancel}>Keep product</button>
          <button type="button" className="sf-btn sf-btn--danger-solid" disabled={busy} onClick={onConfirm}>
            <Trash2 size={16} aria-hidden="true" /> {busy ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductForm({ profile, product }) {
  const isEdit = !!product;
  const { user, userEmail } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState(() => ({
    product_name: product?.product_name || "",
    category: product?.category || profile.product_categories?.[0] || "",
    description: product?.description || "",
    price: product ? String(product.price ?? "") : "",
    unit: product?.unit || "",
    stock: product?.stock > 0 ? String(product.stock) : "",
    county: product?.county ?? profile.county ?? "",
    location_details: product?.location_details ?? profile.location_details ?? "",
    seller_phone: product?.seller_phone || profile.whatsapp_number || profile.phone || "",
    is_active: product ? product.is_active : true,
    sold_out: product ? !!product.sold_out : false
  }));
  const [savedImage, setSavedImage] = useState(product?.image_url || null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => () => { if (imagePreview) URL.revokeObjectURL(imagePreview); }, [imagePreview]);

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: "" }));
  }

  function pickImage(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = validateImage(file);
    if (problem) {
      setErrors(prev => ({ ...prev, image: problem }));
      return;
    }
    setErrors(prev => ({ ...prev, image: "" }));
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageRemoved(false);
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setImageRemoved(true);
  }

  function validate() {
    const next = {
      product_name: required(form.product_name, "Enter the product name.") || maxLength(form.product_name, 120, "Product name"),
      category: required(form.category, "Choose a category."),
      description: maxLength(form.description, 2000, "Description"),
      price: validatePrice(form.price),
      unit: required(form.unit, "Choose how the price is counted."),
      stock: validateStock(form.stock),
      county: required(form.county, "Enter the county you supply from."),
      location_details: maxLength(form.location_details, 120, "Location details"),
      seller_phone: validatePhone(form.seller_phone, { required: true })
    };
    setErrors(prev => ({ ...prev, ...next }));
    return next;
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaveError("");
    const bad = firstError(validate());
    if (bad) {
      document.getElementById(`pf-${bad}`)?.focus();
      return;
    }

    setSaving(true);
    let uploadedUrl = null;
    try {
      if (imageFile) uploadedUrl = await uploadImage(user.id, imageFile, "product");
    } catch (err) {
      setSaving(false);
      setSaveError("The photo didn't upload: " + (err.message || "check your connection") + ". Your details are still here, so try again.");
      return;
    }

    const imageUrl = uploadedUrl || (imageRemoved ? "" : savedImage || "");
    const fields = {
      product_name: form.product_name.trim(),
      category: form.category,
      description: form.description.trim(),
      price: Number(form.price),
      unit: form.unit,
      stock: form.stock.trim() ? Number(form.stock) : 0,
      county: form.county.trim(),
      location_details: form.location_details.trim() || null,
      seller_phone: form.seller_phone.trim(),
      image_url: imageUrl,
      supplier_name: profile.business_name
    };

    const request = isEdit
      ? supabase.from("products")
          .update({ ...fields, is_active: form.is_active, sold_out: form.sold_out })
          .eq("id", product.id)
          .eq("supplier_id", profile.id)
          .select("id")
      : supabase.from("products")
          .insert({ ...fields, supplier_id: profile.id, user_email: userEmail, is_active: true, sold_out: false })
          .select("id");

    const { data, error } = await request;
    setSaving(false);

    if (error || !data?.length) {
      if (uploadedUrl) removeImageByUrl(uploadedUrl, user.id);
      setSaveError(
        (error ? "The product didn't save: " + error.message : "The product couldn't be found. It may have been deleted.") +
        " Your changes are still here, so try again."
      );
      return;
    }

    if (savedImage && savedImage !== imageUrl) removeImageByUrl(savedImage, user.id);
    setSavedImage(imageUrl || null);
    toast.success(isEdit ? "Product updated." : `"${fields.product_name}" is now listed.`);
    navigate("/supplier/products");
  }

  async function handleDelete() {
    setDeleting(true);
    const { data, error } = await supabase
      .from("products")
      .delete()
      .eq("id", product.id)
      .eq("supplier_id", profile.id)
      .select("id");
    setDeleting(false);

    if (error || !data?.length) {
      setConfirming(false);
      setSaveError(error ? "The product wasn't deleted: " + error.message : "The product couldn't be deleted. It may already be gone.");
      return;
    }
    removeImageByUrl(product.image_url, user.id);
    toast.success(`"${product.product_name}" was deleted.`);
    navigate("/supplier/products");
  }

  const imageSrc = imagePreview || (imageRemoved ? null : savedImage);
  const err = (key) => errors[key] ? <span className="sf-error" id={`pf-${key}-err`}>{errors[key]}</span> : null;
  const aria = (key) => ({ "aria-invalid": errors[key] ? "true" : undefined, "aria-describedby": errors[key] ? `pf-${key}-err` : undefined });

  return (
    <>
      <form className="sf-card" onSubmit={handleSave} noValidate>
        <div className="sf-section">
          <h2 className="sf-section-title">Product</h2>

          <div className="sf-field">
            <label className="sf-label" htmlFor="pf-product_name">Product name <span className="sf-req">*</span></label>
            <input id="pf-product_name" className="sf-input" maxLength={120} placeholder="e.g. Broiler starter feed, 50 kg"
              value={form.product_name} onChange={e => set("product_name", e.target.value)} {...aria("product_name")} />
            {err("product_name")}
          </div>

          <div className="sf-field">
            <label className="sf-label" htmlFor="pf-category">Category <span className="sf-req">*</span></label>
            <select id="pf-category" className="sf-input" value={form.category} onChange={e => set("category", e.target.value)} {...aria("category")}>
              <option value="">Choose a category</option>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {err("category")}
          </div>

          <div className="sf-field">
            <label className="sf-label" htmlFor="pf-description">Description <span className="sf-opt">(optional)</span></label>
            <textarea id="pf-description" className="sf-input" maxLength={2000}
              placeholder="Brand, bag size, age of chicks, what it's for..."
              value={form.description} onChange={e => set("description", e.target.value)} {...aria("description")} />
            {err("description")}
          </div>

          <div className="sf-field">
            <span className="sf-label">Photo <span className="sf-opt">(optional, but it builds trust)</span></span>
            <div className="sf-image">
              <span className="sf-image-preview sf-image-preview--wide">
                {imageSrc ? <img src={imageSrc} alt="Product" /> : <ImagePlus size={28} aria-hidden="true" />}
              </span>
              <div className="sf-image-actions">
                <label className="sf-btn sf-btn--ghost sf-btn--sm" htmlFor="pf-image">
                  <ImagePlus size={16} aria-hidden="true" /> {imageSrc ? "Change photo" : "Add photo"}
                </label>
                <input id="pf-image" className="sf-file" type="file" accept={IMAGE_ACCEPT} onChange={pickImage} />
                {imageSrc && (
                  <button type="button" className="sf-btn sf-btn--danger sf-btn--sm" onClick={removeImage}>
                    <Trash2 size={16} aria-hidden="true" /> Remove
                  </button>
                )}
              </div>
            </div>
            <span className="sf-hint">JPG, PNG or WebP. Photos are resized before upload to save data.</span>
            {err("image")}
          </div>
        </div>

        <div className="sf-section">
          <h2 className="sf-section-title">Price and stock</h2>
          <div className="sf-row sf-row--2">
            <div className="sf-field">
              <label className="sf-label" htmlFor="pf-price">Price <span className="sf-req">*</span></label>
              <div className="sf-prefix">
                <span aria-hidden="true">KES</span>
                <input id="pf-price" className="sf-input" inputMode="decimal" placeholder="3200"
                  value={form.price} onChange={e => set("price", e.target.value)} {...aria("price")} />
              </div>
              {err("price")}
            </div>
            <div className="sf-field">
              <label className="sf-label" htmlFor="pf-unit">Price is <span className="sf-req">*</span></label>
              <select id="pf-unit" className="sf-input" value={form.unit} onChange={e => set("unit", e.target.value)} {...aria("unit")}>
                <option value="">Choose a unit</option>
                {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
              {err("unit")}
            </div>
          </div>
          <div className="sf-field">
            <label className="sf-label" htmlFor="pf-stock">Quantity available <span className="sf-opt">(optional)</span></label>
            <input id="pf-stock" className="sf-input" inputMode="numeric" placeholder="e.g. 40"
              value={form.stock} onChange={e => set("stock", e.target.value)} {...aria("stock")} />
            <span className="sf-hint">Leave empty if you'd rather not say. Farmers can ask you.</span>
            {err("stock")}
          </div>
        </div>

        <div className="sf-section">
          <h2 className="sf-section-title">Where and how farmers reach you</h2>
          <div className="sf-row sf-row--2">
            <div className="sf-field">
              <label className="sf-label" htmlFor="pf-county">County <span className="sf-req">*</span></label>
              <input id="pf-county" className="sf-input" list="pf-counties" placeholder="e.g. Kiambu"
                value={form.county} onChange={e => set("county", e.target.value)} {...aria("county")} />
              <datalist id="pf-counties">{KENYA_COUNTIES.map(c => <option key={c} value={c} />)}</datalist>
              {err("county")}
            </div>
            <div className="sf-field">
              <label className="sf-label" htmlFor="pf-location_details">Town or market <span className="sf-opt">(optional)</span></label>
              <input id="pf-location_details" className="sf-input" maxLength={120} placeholder="e.g. Limuru town"
                value={form.location_details} onChange={e => set("location_details", e.target.value)} {...aria("location_details")} />
              {err("location_details")}
            </div>
          </div>
          <div className="sf-field">
            <label className="sf-label" htmlFor="pf-seller_phone">Contact phone <span className="sf-req">*</span></label>
            <input id="pf-seller_phone" className="sf-input" type="tel" inputMode="tel" placeholder="0712 345 678"
              value={form.seller_phone} onChange={e => set("seller_phone", e.target.value)} {...aria("seller_phone")} />
            <span className="sf-hint">Farmers use this number to call or WhatsApp you about this product.</span>
            {err("seller_phone")}
          </div>
        </div>

        {isEdit && (
          <div className="sf-section">
            <h2 className="sf-section-title">Status</h2>
            <label className="sf-toggle">
              <input type="checkbox" checked={form.is_active} onChange={e => set("is_active", e.target.checked)} />
              <span>Active: farmers can see this product</span>
            </label>
            <label className="sf-toggle">
              <input type="checkbox" checked={form.sold_out} onChange={e => set("sold_out", e.target.checked)} />
              <span>Out of stock: still shown, marked sold out</span>
            </label>
          </div>
        )}

        {saveError && <div role="alert" className="sf-banner sf-banner--error" style={{ marginTop: 20 }}>{saveError}</div>}

        <div className="sf-actions" style={{ marginTop: 20 }}>
          <Link to="/supplier/products" className="sf-btn sf-btn--ghost">Cancel</Link>
          <button type="submit" className="sf-btn sf-btn--primary" disabled={saving}>
            {saving ? "Saving..." : isEdit ? "Save changes" : "Add product"}
          </button>
        </div>
      </form>

      {isEdit && (
        <section className="sf-card" aria-labelledby="pf-danger">
          <div className="sf-section">
            <h2 id="pf-danger" className="sf-section-title">Delete product</h2>
            <p className="sf-hint" style={{ margin: 0, fontSize: "0.88rem" }}>
              Permanently removes this product. To hide it for now, untick "Active" above instead.
            </p>
            <div>
              <button type="button" className="sf-btn sf-btn--danger" onClick={() => setConfirming(true)}>
                <Trash2 size={16} aria-hidden="true" /> Delete product
              </button>
            </div>
          </div>
        </section>
      )}

      {confirming && (
        <ConfirmDelete name={product.product_name} busy={deleting} onCancel={() => setConfirming(false)} onConfirm={handleDelete} />
      )}
    </>
  );
}

export default function SupplierProductForm() {
  const { id } = useParams();
  const { profile, profileLoading, profileError, retryProfile } = useSupplier();
  const [loaded, setLoaded] = useState({ id: null, product: null, error: "" });
  const [reload, setReload] = useState(0);

  const profileId = profile?.id;

  useEffect(() => {
    if (!id || !profileId) return undefined;
    let cancelled = false;

    async function load() {
      // Scoped to this supplier: someone else's product id simply isn't found.
      const { data, error } = await supabase
        .from("products")
        .select(PRODUCT_COLUMNS)
        .eq("id", id)
        .eq("supplier_id", profileId)
        .maybeSingle();
      if (cancelled) return;
      setLoaded({
        id,
        product: data || null,
        error: error ? "We couldn't load this product. Check your connection and try again." : ""
      });
    }

    load();
    return () => { cancelled = true; };
  }, [id, profileId, reload]);

  const heading = (
    <header className="sf-head">
      <div>
        <Link to="/supplier/products" className="sf-back"><ArrowLeft size={16} aria-hidden="true" /> Products</Link>
        <h1>{id ? "Edit product" : "Add product"}</h1>
        <p>{id ? "Update the price, details, photo or status." : "Farmers will see this in the marketplace and can call or WhatsApp you."}</p>
      </div>
    </header>
  );

  const waiting = profileLoading || (id && profileId && loaded.id !== id);

  let body;
  if (waiting) {
    body = <div className="sf-card" aria-busy="true"><p className="sf-hint">Loading...</p></div>;
  } else if (profileError) {
    body = (
      <div role="alert" className="sf-banner sf-banner--error">
        <span>{profileError}</span>
        <button className="sf-btn sf-btn--ghost sf-btn--sm" onClick={retryProfile}>Try again</button>
      </div>
    );
  } else if (!profile) {
    body = (
      <div className="sf-banner sf-banner--warn">
        <span>Set up your supplier profile before adding products.</span>
        <Link to="/supplier-profile" className="sf-btn sf-btn--ghost sf-btn--sm">Set up profile</Link>
      </div>
    );
  } else if (id && loaded.error) {
    body = (
      <div role="alert" className="sf-banner sf-banner--error">
        <span>{loaded.error}</span>
        <button className="sf-btn sf-btn--ghost sf-btn--sm" onClick={() => { setLoaded({ id: null, product: null, error: "" }); setReload(n => n + 1); }}>
          Try again
        </button>
      </div>
    );
  } else if (id && !loaded.product) {
    body = (
      <div className="sf-card" style={{ display: "grid", justifyItems: "center", gap: 10, textAlign: "center", padding: "36px 20px" }}>
        <PackageX size={40} aria-hidden="true" style={{ color: "var(--ss-muted)" }} />
        <h2 style={{ margin: 0, fontSize: "1.15rem" }}>Product not found</h2>
        <p className="sf-hint" style={{ margin: 0, fontSize: "0.92rem" }}>It may have been deleted, or it isn't one of your products.</p>
        <Link to="/supplier/products" className="sf-btn sf-btn--primary">Back to products</Link>
      </div>
    );
  } else {
    body = <ProductForm key={id || "new"} profile={profile} product={id ? loaded.product : null} />;
  }

  return <div className="sf-page">{heading}{body}</div>;
}
