import { useState } from "react";
import { Trash2 } from "lucide-react";
import { supabase } from "../lib/supabaseClient";
import { useToast } from "../context/ToastContext";
import { priceText, unitSuffix } from "../lib/productListing";
import ConfirmDialog from "./ConfirmDialog";
import "./AdminListings.css";

function statusOf(product) {
  if (!product.is_active) return { label: "Hidden by seller", tone: "" };
  if (product.sold_out) return { label: "Out of stock", tone: " fc-tag--warning" };
  return { label: "Live", tone: " fc-tag--success" };
}

// Every marketplace listing, for the admin, with the one moderation action
// there is: taking a listing down. The database decides who may do that
// (products_admin_delete), and tells the seller when it happens.
export default function AdminListings({ products, onChanged }) {
  const toast = useToast();
  const [target, setTarget] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    if (busy || !target) return;
    setBusy(true);
    setError("");
    const { data, error: failure } = await supabase.from("products").delete().eq("id", target.id).select("id");
    setBusy(false);
    if (failure) {
      setError("The listing wasn't removed. Check your connection and try again.");
      return;
    }
    if (!data?.length) {
      setError("The listing wasn't removed. It may already be gone, or this account is not an administrator.");
      return;
    }
    toast.success(`"${target.product_name}" was removed from the marketplace.`);
    setTarget(null);
    onChanged();
  }

  if (products.length === 0) {
    return <p className="fc-card al-empty">No listings yet.</p>;
  }

  return (
    <>
      <ul className="al-list">
        {products.map(product => {
          const status = statusOf(product);
          const seller = product.supplier_name || product.user_email;
          return (
            <li key={product.id} className="fc-card al-row">
              <div className="al-main">
                <h3 className="al-name">{product.product_name || "Untitled listing"}</h3>
                <p className="al-meta">
                  {product.category || "No category"} · {priceText(product)}{unitSuffix(product.unit)}
                  {product.county ? ` · ${product.county}` : ""}
                </p>
                <p className="al-meta">
                  {seller ? `Listed by ${seller}` : "No owner recorded: only an admin can remove this listing"}
                </p>
              </div>
              <span className={`fc-tag${status.tone}`}>{status.label}</span>
              <button
                type="button"
                className="fc-btn fc-btn--danger al-remove"
                onClick={() => { setError(""); setTarget(product); }}
                aria-label={`Remove the listing ${product.product_name || ""}`}
              >
                <Trash2 size={16} aria-hidden="true" /> Remove
              </button>
            </li>
          );
        })}
      </ul>

      {target && (
        <ConfirmDialog
          title={`Remove "${target.product_name}"?`}
          confirmLabel="Remove listing"
          busyLabel="Removing..."
          cancelLabel="Keep listing"
          danger
          icon={Trash2}
          busy={busy}
          error={error}
          onCancel={() => setTarget(null)}
          onConfirm={remove}
        >
          <p>This deletes the listing for everyone and cannot be undone. Use it for listings that break the marketplace rules.</p>
          <p>The seller gets a notification that an administrator removed it.</p>
        </ConfirmDialog>
      )}
    </>
  );
}
