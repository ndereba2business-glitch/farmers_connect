import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Clock, ImagePlus, MapPin, Phone, ShieldAlert, Store, Trash2, Truck } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useSupplier } from "../components/supplier/supplierContext";
import { CATEGORIES, CATEGORY_LABELS, initialsOf } from "../components/supplier/supplierFormat";
import { KENYA_COUNTIES } from "../components/supplier/kenyaCounties";
import { IMAGE_ACCEPT, removeImageByUrl, uploadImage, validateImage } from "../lib/imageUpload";
import { firstError, maxLength, required, validatePhone } from "../components/supplier/formValidation";
import "../components/supplier/SupplierForms.css";

const STATUS = {
  verified: {
    tone: "green", icon: BadgeCheck, title: "Verified supplier",
    text: "Your profile has been approved. Farmers see a verified badge next to your business name."
  },
  pending: {
    tone: "amber", icon: Clock, title: "Waiting for review",
    text: "An admin checks every new supplier before the verified badge appears. You can keep editing your profile and listing products meanwhile."
  },
  rejected: {
    tone: "red", icon: ShieldAlert, title: "Not approved",
    text: "Your profile wasn't approved. Update your details, or contact support if you think this is a mistake."
  },
  suspended: {
    tone: "red", icon: ShieldAlert, title: "Suspended",
    text: "Your supplier account is suspended. Contact support to restore it."
  },
  new: {
    tone: "neutral", icon: Store, title: "Not submitted yet",
    text: "Fill in your details and submit. An admin will review your profile before you get the verified badge."
  }
};

// 2547XXXXXXXX (how Supabase stores phone logins) -> 07XXXXXXXX
function localPhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.startsWith("254") && digits.length === 12 ? `0${digits.slice(3)}` : digits;
}

function VerificationStatus({ status }) {
  const meta = STATUS[status] || STATUS.new;
  const Icon = meta.icon;
  return (
    <section className="sf-card sf-status" aria-labelledby="sf-status-title">
      <span className={`sf-status-icon sf-tone-${meta.tone}`}><Icon size={22} aria-hidden="true" /></span>
      <div>
        <h2 id="sf-status-title">{meta.title}</h2>
        <p>{meta.text}</p>
      </div>
    </section>
  );
}

function ProfilePreview({ form, logoSrc, isVerified }) {
  return (
    <section className="sf-card sf-preview" aria-label="How farmers see your profile">
      <span className="sf-preview-label">How farmers see you</span>
      <div className="sf-preview-card">
        <span className="sf-logo" aria-hidden="true">
          {logoSrc ? <img src={logoSrc} alt="" /> : initialsOf(form.business_name || "Your business")}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="sf-preview-name">
            {form.business_name.trim() || "Your business name"}
            {isVerified && (
              <span className="sf-verified"><BadgeCheck size={14} aria-hidden="true" /> Verified</span>
            )}
          </div>
          <ul className="sf-meta">
            {form.county.trim() && (
              <li><MapPin size={14} aria-hidden="true" /> {[form.location_details.trim(), form.county.trim()].filter(Boolean).join(", ")}</li>
            )}
            {form.phone.trim() && <li><Phone size={14} aria-hidden="true" /> {form.phone.trim()}</li>}
            {form.operating_hours.trim() && <li><Clock size={14} aria-hidden="true" /> {form.operating_hours.trim()}</li>}
            {form.delivery_available && <li><Truck size={14} aria-hidden="true" /> Delivers</li>}
          </ul>
          {form.product_categories.length > 0 && (
            <div className="sf-tags">
              {form.product_categories.map(c => <span key={c} className="sf-tag">{CATEGORY_LABELS[c] || c}</span>)}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ProfileForm({ profile }) {
  const { user } = useAuth();
  const toast = useToast();
  const { refreshProfile } = useSupplier();

  const [form, setForm] = useState(() => ({
    business_name: profile?.business_name || "",
    description: profile?.description || "",
    phone: profile?.phone || localPhone(user?.phone),
    whatsapp_number: profile?.whatsapp_number || "",
    county: profile?.county || "",
    location_details: profile?.location_details || "",
    product_categories: profile?.product_categories || [],
    operating_hours: profile?.operating_hours || "",
    delivery_available: !!profile?.delivery_available
  }));
  const [savedLogoUrl, setSavedLogoUrl] = useState(profile?.logo_url || null);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [status, setStatus] = useState(profile?.verification_status || null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileRef = useRef(null);

  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  function set(key, value) {
    setForm(prev => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors(prev => ({ ...prev, [key]: "" }));
  }

  function toggleCategory(value) {
    const next = form.product_categories.includes(value)
      ? form.product_categories.filter(c => c !== value)
      : [...form.product_categories, value];
    set("product_categories", next);
  }

  function pickLogo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = validateImage(file);
    if (problem) {
      setErrors(prev => ({ ...prev, logo: problem }));
      return;
    }
    setErrors(prev => ({ ...prev, logo: "" }));
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoRemoved(false);
  }

  function removeLogo() {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoRemoved(true);
  }

  function validate() {
    const next = {
      business_name: required(form.business_name, "Enter your business name.") || maxLength(form.business_name, 100, "Business name"),
      phone: validatePhone(form.phone, { required: true }),
      whatsapp_number: validatePhone(form.whatsapp_number),
      county: required(form.county, "Enter the county you operate in."),
      location_details: maxLength(form.location_details, 120, "Location details"),
      product_categories: form.product_categories.length === 0 ? "Choose at least one thing you supply." : "",
      operating_hours: maxLength(form.operating_hours, 120, "Operating hours"),
      description: maxLength(form.description, 1000, "Description")
    };
    setErrors(prev => ({ ...prev, ...next }));
    return next;
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaveError("");
    const next = validate();
    const bad = firstError(next);
    if (bad) {
      document.getElementById(`sp-${bad}`)?.focus();
      return;
    }

    setSaving(true);
    let uploadedUrl = null;
    try {
      if (logoFile) uploadedUrl = await uploadImage(user.id, logoFile, "logo");
    } catch (err) {
      setSaving(false);
      setSaveError("Your logo didn't upload: " + (err.message || "check your connection") + ". Your details are still here, so try again.");
      return;
    }

    const logoUrl = uploadedUrl || (logoRemoved ? null : savedLogoUrl);

    // verification_status is never sent: new rows start as pending and only an
    // admin can change it (enforced by database triggers).
    const { data, error } = await supabase
      .from("supplier_profiles")
      .upsert({
        user_id: user.id,
        business_name: form.business_name.trim(),
        description: form.description.trim() || null,
        phone: form.phone.trim(),
        whatsapp_number: form.whatsapp_number.trim() || null,
        county: form.county.trim(),
        location_details: form.location_details.trim() || null,
        product_categories: form.product_categories,
        operating_hours: form.operating_hours.trim() || null,
        delivery_available: form.delivery_available,
        logo_url: logoUrl
      }, { onConflict: "user_id" })
      .select("verification_status, logo_url")
      .single();

    setSaving(false);

    if (error) {
      if (uploadedUrl) removeImageByUrl(uploadedUrl, user.id);
      setSaveError("Your profile didn't save: " + error.message + ". Your changes are still here, so try again.");
      return;
    }

    if (savedLogoUrl && savedLogoUrl !== data.logo_url) removeImageByUrl(savedLogoUrl, user.id);
    setSavedLogoUrl(data.logo_url);
    setLogoFile(null);
    setLogoPreview(null);
    setLogoRemoved(false);
    const wasNew = !status;
    setStatus(data.verification_status);
    refreshProfile();
    toast.success(wasNew ? "Profile submitted. An admin will review it." : "Profile saved.");
  }

  const logoSrc = logoPreview || (logoRemoved ? null : savedLogoUrl);
  const err = (key) => errors[key] ? <span className="sf-error" id={`sp-${key}-err`}>{errors[key]}</span> : null;
  const aria = (key) => ({ "aria-invalid": errors[key] ? "true" : undefined, "aria-describedby": errors[key] ? `sp-${key}-err` : undefined });

  return (
    <>
      <VerificationStatus status={status || "new"} />
      <ProfilePreview form={form} logoSrc={logoSrc} isVerified={status === "verified"} />

      <form className="sf-card" onSubmit={handleSave} noValidate>
        <div className="sf-section">
          <h2 className="sf-section-title">Business</h2>

          <div className="sf-field">
            <label className="sf-label" htmlFor="sp-business_name">Business name <span className="sf-req">*</span></label>
            <input id="sp-business_name" className="sf-input" autoComplete="organization"
              value={form.business_name} onChange={e => set("business_name", e.target.value)} {...aria("business_name")} />
            {err("business_name")}
          </div>

          <div className="sf-field">
            <span className="sf-label">Logo or photo <span className="sf-opt">(optional)</span></span>
            <div className="sf-image">
              <span className="sf-image-preview">
                {logoSrc ? <img src={logoSrc} alt="Your logo" /> : <ImagePlus size={24} aria-hidden="true" />}
              </span>
              <div className="sf-image-actions">
                <label className="sf-btn sf-btn--ghost sf-btn--sm" htmlFor="sp-logo">
                  <ImagePlus size={16} aria-hidden="true" /> {logoSrc ? "Change" : "Add logo"}
                </label>
                <input id="sp-logo" ref={fileRef} className="sf-file" type="file" accept={IMAGE_ACCEPT} onChange={pickLogo} />
                {logoSrc && (
                  <button type="button" className="sf-btn sf-btn--danger sf-btn--sm" onClick={removeLogo}>
                    <Trash2 size={16} aria-hidden="true" /> Remove
                  </button>
                )}
              </div>
            </div>
            <span className="sf-hint">A clear logo or shop photo builds trust. JPG, PNG or WebP; it's resized before upload.</span>
            {err("logo")}
          </div>

          <div className="sf-field">
            <label className="sf-label" htmlFor="sp-description">About your business <span className="sf-opt">(optional)</span></label>
            <textarea id="sp-description" className="sf-input" maxLength={1000} placeholder="What you sell, how long you've been in business, brands you stock..."
              value={form.description} onChange={e => set("description", e.target.value)} {...aria("description")} />
            {err("description")}
          </div>
        </div>

        <div className="sf-section">
          <h2 className="sf-section-title">What you supply <span className="sf-req">*</span></h2>
          <p className="sf-section-sub">Farmers use these to find you in the supplier directory.</p>
          <fieldset className="sf-chips" id="sp-product_categories" tabIndex={-1} aria-describedby={errors.product_categories ? "sp-product_categories-err" : undefined}>
            <legend className="sf-sr">Product categories</legend>
            {CATEGORIES.map(c => (
              <label key={c.value} className="sf-chip">
                <input type="checkbox" checked={form.product_categories.includes(c.value)} onChange={() => toggleCategory(c.value)} />
                <span>{c.label}</span>
              </label>
            ))}
          </fieldset>
          {err("product_categories")}
        </div>

        <div className="sf-section">
          <h2 className="sf-section-title">Contact and location</h2>
          <div className="sf-row sf-row--2">
            <div className="sf-field">
              <label className="sf-label" htmlFor="sp-phone">Phone number <span className="sf-req">*</span></label>
              <input id="sp-phone" className="sf-input" type="tel" inputMode="tel" autoComplete="tel" placeholder="0712 345 678"
                value={form.phone} onChange={e => set("phone", e.target.value)} {...aria("phone")} />
              {err("phone")}
            </div>
            <div className="sf-field">
              <label className="sf-label" htmlFor="sp-whatsapp_number">WhatsApp number <span className="sf-opt">(optional)</span></label>
              <input id="sp-whatsapp_number" className="sf-input" type="tel" inputMode="tel" placeholder="If different from your phone"
                value={form.whatsapp_number} onChange={e => set("whatsapp_number", e.target.value)} {...aria("whatsapp_number")} />
              {err("whatsapp_number")}
            </div>
          </div>
          <div className="sf-row sf-row--2">
            <div className="sf-field">
              <label className="sf-label" htmlFor="sp-county">County <span className="sf-req">*</span></label>
              <input id="sp-county" className="sf-input" list="sp-counties" autoComplete="address-level1" placeholder="e.g. Kiambu"
                value={form.county} onChange={e => set("county", e.target.value)} {...aria("county")} />
              <datalist id="sp-counties">{KENYA_COUNTIES.map(c => <option key={c} value={c} />)}</datalist>
              {err("county")}
            </div>
            <div className="sf-field">
              <label className="sf-label" htmlFor="sp-location_details">Town or market <span className="sf-opt">(optional)</span></label>
              <input id="sp-location_details" className="sf-input" maxLength={120} placeholder="e.g. Limuru town, near the stage"
                value={form.location_details} onChange={e => set("location_details", e.target.value)} {...aria("location_details")} />
              {err("location_details")}
            </div>
          </div>
          <div className="sf-field">
            <label className="sf-label" htmlFor="sp-operating_hours">Operating hours <span className="sf-opt">(optional)</span></label>
            <input id="sp-operating_hours" className="sf-input" maxLength={120} placeholder="e.g. Mon-Sat 8am-6pm"
              value={form.operating_hours} onChange={e => set("operating_hours", e.target.value)} {...aria("operating_hours")} />
            {err("operating_hours")}
          </div>
          <label className="sf-toggle">
            <input type="checkbox" checked={form.delivery_available} onChange={e => set("delivery_available", e.target.checked)} />
            I can deliver to farmers
          </label>
        </div>

        {saveError && <div role="alert" className="sf-banner sf-banner--error" style={{ marginTop: 20 }}>{saveError}</div>}

        <div className="sf-actions" style={{ marginTop: 20 }}>
          <button type="submit" className="sf-btn sf-btn--primary" disabled={saving}>
            {saving ? "Saving..." : status ? "Save changes" : "Submit for review"}
          </button>
        </div>
      </form>
    </>
  );
}

export default function SupplierProfileSetup() {
  const { profile, profileLoading, profileError, retryProfile } = useSupplier();

  return (
    <div className="sf-page">
      <header className="sf-head">
        <div>
          <h1>Supplier profile</h1>
          <p>Your business details, as farmers see them in the supplier directory and on your products.</p>
        </div>
      </header>

      {profileLoading ? (
        <div className="sf-card" aria-busy="true"><p className="sf-hint">Loading your profile...</p></div>
      ) : profileError ? (
        <div role="alert" className="sf-banner sf-banner--error">
          <span>{profileError}</span>
          <button className="sf-btn sf-btn--ghost sf-btn--sm" onClick={retryProfile}>Try again</button>
        </div>
      ) : (
        <ProfileForm key={profile?.id || "new"} profile={profile} />
      )}
    </div>
  );
}
