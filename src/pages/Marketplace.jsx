import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { createNotification } from "../lib/notifications";
import {
  Search, Plus, MapPin, ShoppingBag,
  ChevronDown, X, ShoppingCart
} from "lucide-react";

const CATEGORIES = [
  { value: "all", label: "All Categories" },
  { value: "chickens", label: "🐔 Chickens" },
  { value: "eggs", label: "🥚 Eggs" },
  { value: "feeds", label: "🌾 Feeds" },
  { value: "equipment", label: "🔧 Equipment" },
  { value: "medicine", label: "💊 Medicine" },
  { value: "other", label: "📦 Other" },
];

const UNITS = [
  { value: "per_bird", label: "Per Bird" },
  { value: "per_tray", label: "Per Tray" },
  { value: "per_kg", label: "Per KG" },
  { value: "per_bag", label: "Per Bag" },
  { value: "per_piece", label: "Per Piece" },
  { value: "per_lot", label: "Per Lot" },
];

const UNIT_LABELS = {
  per_bird: "/bird", per_tray: "/tray", per_kg: "/kg",
  per_bag: "/bag", per_piece: "/piece", per_lot: "/lot"
};

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box",
  background: "#fff", color: "#111827"
};

const labelStyle = {
  display: "block", fontSize: "13px", fontWeight: "600",
  color: "#374151", marginBottom: "6px"
};

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [view, setView] = useState("list");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showVerifiedOnly, setShowVerifiedOnly] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentUserPhone, setCurrentUserPhone] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    customer_name: "", county: "", phone: ""
  });
  const [form, setForm] = useState({
    product_name: "", category: "", supplier_name: "",
    county: "", price: "", stock: "", unit: "per_bird",
    description: "", imageFile: null, imagePreview: null, 
    seller_phone: ""

  });

  // -----------------------------
  // LOAD CURRENT USER & PROFILE PHONE
  // -----------------------------
  useEffect(() => {
    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        const email = data.user.email || "";
        // Grab phone from Supabase auth profile or metadata fallback
        const phone = data.user.phone || data.user.user_metadata?.phone || ""; 
      
        setCurrentUserEmail(email);
        setCurrentUserPhone(phone);

        // 🟢 This auto-fills the form state instantly when the page loads!
        setForm(prev => ({ ...prev, seller_phone: phone }));
      }
    }
    loadUser();
  }, []);
  // -----------------------------
  // FETCH PRODUCTS
  // -----------------------------
  async function fetchProducts() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });
    setProducts(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchProducts();
    const channel = supabase
      .channel("products-live")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "products" },
        fetchProducts
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // -----------------------------
  // ADD PRODUCT
  // -----------------------------
  async function handleAddProduct(e) {
    e.preventDefault();
    if (!form.product_name || !form.category || !form.price) return;
    setSubmitting(true);

    let imageUrl = "";

    if (form.imageFile) {
      const fileExt = form.imageFile.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("marketplace-images")
        .upload(fileName, form.imageFile);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("marketplace-images")
          .getPublicUrl(fileName);
        imageUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from("products").insert([{
      product_name: form.product_name,
      category: form.category,
      supplier_name: form.supplier_name || currentUserEmail,
      user_email: currentUserEmail,
      county: form.county,
      price: Number(form.price),
      stock: Number(form.stock) || 0,
      unit: form.unit || "per_bird",
      image_url: imageUrl || "",
      description: form.description || "",
      // 🟢 Uses the form text field, falls back to profile phone, or stays blank
      seller_phone: form.seller_phone || currentUserPhone || "",
      is_verified: false,
      sold_out: false
    }]);

    if (error) {
      console.error("Product insert error:", error.message);
      alert("Failed to list product: " + error.message);
      setSubmitting(false);
      return;
    }

    if (currentUserEmail) {
      await createNotification({
        userEmail: currentUserEmail,
        type: "marketplace",
        title: "Product Listed 🛒",
        message: `"${form.product_name}" is now live on the marketplace.`,
        link: "/marketplace"
      });
    }

    setForm({
      product_name: "", category: "", supplier_name: "",
      county: "", price: "", stock: "", unit: "per_bird",
      description: "", imageFile: null, imagePreview: null,
      seller_phone: ""
    });
    setSubmitting(false);
    setView("list");
    fetchProducts();
  }

  // -----------------------------
  // CART
  // -----------------------------
  function addToCart(product) {
    setCart(prev => [...prev, product]);
  }

  function removeFromCart(index) {
    setCart(prev => prev.filter((_, i) => i !== index));
  }

  const total = cart.reduce((sum, item) => sum + Number(item.price), 0);

// -----------------------------
// CONTACT SELLER
// -----------------------------
function handleContactSeller(product) {
  // ✅ Check if seller has a phone number
  // We'll use the product's seller phone if available,
  // otherwise prompt the buyer to ask in community chat
  
  const sellerPhone = product.seller_phone || product.phone || null;

  if (sellerPhone) {
    // ✅ Format phone to international format
    // Remove spaces, dashes, brackets
    let phone = sellerPhone.replace(/[\s\-\(\)]/g, "");

    // Convert Kenyan 07XX to +2547XX
    if (phone.startsWith("0")) {
      phone = "+254" + phone.slice(1);
    }

    // Remove + for WhatsApp link
    phone = phone.replace("+", "");

    // ✅ Pre-written message
    const message = encodeURIComponent(
      `Hello! I saw your listing on Farmers Connect.\n\n` +
      `Product: *${product.product_name}*\n` +
      `Price: KES ${Number(product.price).toLocaleString()}${product.unit ? " " + (product.unit.replace("_", "/")) : ""}\n` +
      `Location: ${product.county || "Kenya"}\n\n` +
      `I'm interested in buying. Is it still available?`
    );

    // ✅ Open WhatsApp
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");

  } else {
    // ✅ No phone number — show a helpful alert
    alert(
      `The seller hasn't added a WhatsApp number yet.\n\n` +
      `You can find them in the Community Chat and message them there.`
    );
  }
}

  // -----------------------------
  // CHECKOUT
  // -----------------------------
  async function handleCheckout() {
    if (!checkoutForm.customer_name || !checkoutForm.county || !checkoutForm.phone) {
      alert("Fill all delivery fields");
      return;
    }
    setPaymentLoading(true);

    for (const item of cart) {
      const platformFee = item.price * 0.05;
      const supplierEarnings = item.price - platformFee;
      await supabase.from("orders").insert([{
        product_name: item.product_name,
        customer_name: checkoutForm.customer_name,
        county: checkoutForm.county,
        quantity: 1,
        total_price: item.price,
        platform_fee: platformFee,
        supplier_earnings: supplierEarnings,
        status: "pending",
        delivery_status: "pending"
      }]);
    }

    if (currentUserEmail) {
      await createNotification({
        userEmail: currentUserEmail,
        type: "marketplace",
        title: "Order Placed ✅",
        message: `${cart.length} item(s) totalling KES ${total.toLocaleString()} ordered. M-Pesa request sent to ${checkoutForm.phone}.`,
        link: "/orders"
      });
    }

    setCart([]);
    setCheckoutForm({ customer_name: "", county: "", phone: "" });
    setPaymentLoading(false);
    setView("list");
    alert(`M-Pesa request sent to ${checkoutForm.phone}`);
  }

  // -----------------------------
  // FILTERS
  // -----------------------------
  const filtered = products.filter(p => {
    const matchSearch = !search ||
      p.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase());
    const matchCategory = category === "all" || p.category === category;
    const matchVerified = showVerifiedOnly ? p.is_verified : true;
    return matchSearch && matchCategory && matchVerified;
  });

  const selectedCategoryLabel = CATEGORIES.find(c => c.value === category)?.label || "All Categories";

  return (
    <div>

      {/* ======================== LIST VIEW ======================== */}
      {view === "list" && (
        <div>
          {/* HEADER */}
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", marginBottom: "24px"
          }}>
            <div>
              <h1 style={{
                margin: 0, fontSize: "36px", fontWeight: "800",
                color: "#111827", letterSpacing: "-1px"
              }}>
                Marketplace
              </h1>
              <p style={{ marginTop: "6px", color: "#6b7280", fontSize: "15px" }}>
                Browse poultry products from local farmers
              </p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setView("add")}
                style={{
                  height: "44px", padding: "0 20px", border: "none",
                  borderRadius: "12px",
                  background: "linear-gradient(135deg,#22c55e,#16a34a)",
                  color: "white", fontWeight: "700", cursor: "pointer",
                  fontSize: "14px", display: "flex", alignItems: "center",
                  gap: "8px", boxShadow: "0 6px 20px rgba(34,197,94,0.3)"
                }}
              >
                <Plus size={18} /> List Product
              </button>
            </div>
          </div>

          {/* FILTERS */}
          <div style={{
            display: "flex", gap: "12px",
            marginBottom: "24px", flexWrap: "wrap"
          }}>
            <div style={{ flex: 1, minWidth: "200px", position: "relative" }}>
              <Search size={16} style={{
                position: "absolute", left: "14px",
                top: "50%", transform: "translateY(-50%)", color: "#9ca3af"
              }} />
              <input
                placeholder="Search products..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ ...inputStyle, paddingLeft: "40px" }}
              />
            </div>

            <div style={{ position: "relative" }}>
              <button
                onClick={() => setCategoryOpen(!categoryOpen)}
                style={{
                  height: "44px", padding: "0 16px", borderRadius: "10px",
                  border: "1.5px solid #e5e7eb", background: "#fff",
                  cursor: "pointer", fontSize: "14px", color: "#374151",
                  display: "flex", alignItems: "center", gap: "8px",
                  fontWeight: "500", minWidth: "180px",
                  justifyContent: "space-between"
                }}
              >
                {selectedCategoryLabel}
                <ChevronDown size={16} color="#9ca3af" />
              </button>
              {categoryOpen && (
                <div style={{
                  position: "absolute", top: "50px", left: 0,
                  background: "#fff", borderRadius: "14px",
                  boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                  border: "1px solid #f0f0f0", zIndex: 999,
                  minWidth: "200px", overflow: "hidden"
                }}>
                  {CATEGORIES.map(cat => (
                    <div
                      key={cat.value}
                      onClick={() => { setCategory(cat.value); setCategoryOpen(false); }}
                      style={{
                        padding: "11px 16px", cursor: "pointer",
                        fontSize: "14px",
                        color: category === cat.value ? "#22c55e" : "#374151",
                        fontWeight: category === cat.value ? "600" : "400",
                        background: category === cat.value ? "#f0fdf4" : "#fff",
                        display: "flex", justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      {cat.label}
                      {category === cat.value && <span>✓</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowVerifiedOnly(!showVerifiedOnly)}
              style={{
                height: "44px", padding: "0 16px", borderRadius: "10px",
                border: `1.5px solid ${showVerifiedOnly ? "#22c55e" : "#e5e7eb"}`,
                background: showVerifiedOnly ? "#f0fdf4" : "#fff",
                color: showVerifiedOnly ? "#22c55e" : "#6b7280",
                cursor: "pointer", fontSize: "14px", fontWeight: "600"
              }}
            >
              ✔ Verified Only
            </button>
          </div>

          {/* LOADING SKELETONS */}
          {loading && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "20px"
            }}>
              {[1,2,3,4,5,6].map(i => (
                <div key={i} style={{
                  borderRadius: "16px", overflow: "hidden",
                  border: "1px solid #f0f0f0", background: "#fff"
                }}>
                  <div style={{ height: "200px", background: "#f3f4f6" }} />
                  <div style={{ padding: "16px" }}>
                    <div style={{
                      height: "16px", background: "#f3f4f6",
                      borderRadius: "6px", marginBottom: "10px", width: "75%"
                    }} />
                    <div style={{
                      height: "20px", background: "#f3f4f6",
                      borderRadius: "6px", width: "40%"
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* EMPTY STATE */}
          {!loading && filtered.length === 0 && (
            <div style={{
              textAlign: "center", padding: "80px 20px",
              background: "#fff", borderRadius: "24px",
              border: "1px solid #f0f0f0"
            }}>
              <ShoppingBag size={64} color="#e5e7eb"
                style={{ marginBottom: "16px" }} />
              <h3 style={{
                fontSize: "18px", fontWeight: "700",
                color: "#111827", margin: "0 0 8px"
              }}>
                No products found
              </h3>
              <p style={{
                color: "#9ca3af", fontSize: "14px", marginBottom: "20px"
              }}>
                Try a different search or be the first to list!
              </p>
              <button
                onClick={() => setView("add")}
                style={{
                  padding: "12px 24px", background: "#22c55e",
                  color: "#fff", border: "none", borderRadius: "12px",
                  fontWeight: "700", fontSize: "14px", cursor: "pointer"
                }}
              >
                List Your Product
              </button>
            </div>
          )}

          {/* PRODUCT GRID */}
          {!loading && filtered.length > 0 && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "20px"
            }}>
              {filtered.map(p => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onAddToCart={addToCart}
                  onContactSeller={handleContactSeller}
                  currentUserEmail={currentUserEmail}
                  onProductUpdated={fetchProducts}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ======================== ADD PRODUCT ======================== */}
      {view === "add" && (
        <div style={{ maxWidth: "680px" }}>
          <div style={{
            display: "flex", alignItems: "center",
            gap: "16px", marginBottom: "28px"
          }}>
            <button
              onClick={() => setView("list")}
              style={{
                width: "38px", height: "38px", borderRadius: "10px",
                border: "1.5px solid #e5e7eb", background: "#fff",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center"
              }}
            >
              <X size={18} color="#374151" />
            </button>
            <div>
              <h1 style={{
                margin: 0, fontSize: "28px",
                fontWeight: "800", color: "#111827"
              }}>
                List a Product
              </h1>
              <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
                Share your poultry products with buyers
              </p>
            </div>
          </div>

          <div style={{
            background: "#fff", borderRadius: "20px",
            border: "1px solid #e5e7eb", padding: "28px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.04)"
          }}>
            <form onSubmit={handleAddProduct}>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Product Title</label>
                <input
                  placeholder="e.g., Fresh Farm Eggs"
                  value={form.product_name}
                  onChange={e => setForm({ ...form, product_name: e.target.value })}
                  required style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm({ ...form, category: e.target.value })}
                  required
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="">Select category</option>
                  {CATEGORIES.filter(c => c.value !== "all").map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: "16px", marginBottom: "20px"
              }}>
                <div>
                  <label style={labelStyle}>Price (KES)</label>
                  <input
                    type="number" placeholder="0.00"
                    value={form.price}
                    onChange={e => setForm({ ...form, price: e.target.value })}
                    required style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Unit</label>
                  <select
                    value={form.unit}
                    onChange={e => setForm({ ...form, unit: e.target.value })}
                    style={{ ...inputStyle, appearance: "none" }}
                  >
                    {UNITS.map(u => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: "16px", marginBottom: "20px"
              }}>
                <div>
                  <label style={labelStyle}>Quantity Available</label>
                  <input
                    type="number" placeholder="Optional"
                    value={form.stock}
                    onChange={e => setForm({ ...form, stock: e.target.value })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Location</label>
                  <input
                    placeholder="e.g., Nairobi, Kenya"
                    value={form.county}
                    onChange={e => setForm({ ...form, county: e.target.value })}
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Supplier / Your Name</label>
                <input
                  placeholder="Your name or business name"
                  value={form.supplier_name}
                  onChange={e => setForm({ ...form, supplier_name: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>
                  WhatsApp Number
                  <span style={{ color: "#22c55e", fontSize: "11px", fontWeight: "500", marginLeft: "6px" }}>
                    (Buyers will contact you here)
                  </span>
                </label>
                <input
                  placeholder="e.g. 0712345678"
                  value={form.seller_phone}
                  onChange={e => setForm({ ...form, seller_phone: e.target.value })}
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={labelStyle}>Description</label>
                <textarea
                  placeholder="Describe your product..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  style={{ ...inputStyle, minHeight: "100px", resize: "vertical" }}
                />
              </div>

              {/* IMAGE UPLOAD */}
              <div style={{ marginBottom: "28px" }}>
                <label style={labelStyle}>Product Image (optional)</label>
                <div
                  onClick={() => document.getElementById("product-image-upload").click()}
                  style={{
                    border: "2px dashed #d1fae5", borderRadius: "12px",
                    padding: "24px", textAlign: "center", cursor: "pointer",
                    background: form.imagePreview ? "#f0fdf4" : "#fafafa",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#22c55e"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#d1fae5"}
                >
                  {form.imagePreview ? (
                    <div style={{ position: "relative", display: "inline-block" }}>
                      <img
                        src={form.imagePreview}
                        alt="Preview"
                        style={{
                          maxHeight: "160px", maxWidth: "100%",
                          borderRadius: "10px", objectFit: "cover"
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setForm({ ...form, imageFile: null, imagePreview: null });
                        }}
                        style={{
                          position: "absolute", top: "-8px", right: "-8px",
                          width: "24px", height: "24px", borderRadius: "50%",
                          background: "#ef4444", color: "#fff", border: "none",
                          cursor: "pointer", fontWeight: "700", fontSize: "14px",
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: "32px", marginBottom: "8px" }}>📷</div>
                      <div style={{
                        fontWeight: "600", color: "#374151", fontSize: "14px"
                      }}>
                        Click to upload image
                      </div>
                      <div style={{
                        color: "#9ca3af", fontSize: "12px", marginTop: "4px"
                      }}>
                        PNG, JPG or WEBP — max 5MB
                      </div>
                    </div>
                  )}
                </div>
                <input
                  id="product-image-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      alert("Image must be under 5MB");
                      return;
                    }
                    const preview = URL.createObjectURL(file);
                    setForm({ ...form, imageFile: file, imagePreview: preview });
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  width: "100%", padding: "14px",
                  background: submitting
                    ? "#86efac"
                    : "linear-gradient(135deg,#22c55e,#16a34a)",
                  color: "#fff", border: "none", borderRadius: "12px",
                  fontWeight: "700", fontSize: "15px",
                  cursor: submitting ? "not-allowed" : "pointer",
                  boxShadow: "0 6px 20px rgba(34,197,94,0.25)"
                }}
              >
                {submitting ? "Listing product..." : "List Product"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ======================== CART ======================== */}
      {view === "cart" && (
        <div style={{ maxWidth: "560px" }}>
          <div style={{
            display: "flex", alignItems: "center",
            gap: "16px", marginBottom: "28px"
          }}>
            <button
              onClick={() => setView("list")}
              style={{
                width: "38px", height: "38px", borderRadius: "10px",
                border: "1.5px solid #e5e7eb", background: "#fff",
                cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center"
              }}
            >
              <X size={18} color="#374151" />
            </button>
            <div>
              <h1 style={{
                margin: 0, fontSize: "28px",
                fontWeight: "800", color: "#111827"
              }}>
                Your Cart
              </h1>
              <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: "14px" }}>
                {cart.length} item{cart.length !== 1 ? "s" : ""} in your cart
              </p>
            </div>
          </div>

          {cart.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "60px 20px",
              background: "#fff", borderRadius: "20px",
              border: "1px solid #f0f0f0"
            }}>
              <ShoppingCart size={48} color="#e5e7eb"
                style={{ marginBottom: "12px" }} />
              <h3 style={{ margin: "0 0 8px", color: "#111827" }}>
                Your cart is empty
              </h3>
              <p style={{ color: "#9ca3af", fontSize: "14px" }}>
                Add products from the marketplace
              </p>
              <button
                onClick={() => setView("list")}
                style={{
                  marginTop: "16px", padding: "10px 20px",
                  background: "#22c55e", color: "#fff",
                  border: "none", borderRadius: "10px",
                  cursor: "pointer", fontWeight: "600"
                }}
              >
                Browse Products
              </button>
            </div>
          ) : (
            <div>
              <div style={{
                background: "#fff", borderRadius: "20px",
                border: "1px solid #e5e7eb",
                overflow: "hidden", marginBottom: "20px"
              }}>
                {cart.map((item, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center",
                    gap: "14px", padding: "16px 20px",
                    borderBottom: i < cart.length - 1
                      ? "1px solid #f3f4f6" : "none"
                  }}>
                    <div style={{
                      width: "50px", height: "50px", borderRadius: "12px",
                      background: "#f3f4f6", overflow: "hidden", flexShrink: 0
                    }}>
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.product_name}
                          style={{
                            width: "100%", height: "100%", objectFit: "cover"
                          }}
                        />
                      ) : (
                        <div style={{
                          width: "100%", height: "100%",
                          display: "flex", alignItems: "center",
                          justifyContent: "center"
                        }}>
                          <ShoppingBag size={20} color="#d1d5db" />
                        </div>
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: "600", fontSize: "14px", color: "#111827"
                      }}>
                        {item.product_name}
                      </div>
                      <div style={{
                        fontSize: "13px", color: "#6b7280", marginTop: "2px"
                      }}>
                        {item.county}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontWeight: "700", color: "#22c55e", fontSize: "15px"
                      }}>
                        KES {Number(item.price).toLocaleString()}
                      </div>
                      <button
                        onClick={() => removeFromCart(i)}
                        style={{
                          background: "none", border: "none",
                          cursor: "pointer", color: "#ef4444",
                          fontSize: "12px", marginTop: "4px"
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", padding: "16px 20px",
                background: "#f0fdf4", borderRadius: "14px",
                marginBottom: "24px"
              }}>
                <span style={{ fontWeight: "600", fontSize: "15px" }}>Total</span>
                <span style={{
                  fontWeight: "800", fontSize: "20px", color: "#22c55e"
                }}>
                  KES {total.toLocaleString()}
                </span>
              </div>

              <div style={{
                background: "#fff", borderRadius: "20px",
                border: "1px solid #e5e7eb",
                padding: "24px", marginBottom: "16px"
              }}>
                <h3 style={{
                  margin: "0 0 18px", fontSize: "16px",
                  fontWeight: "700", color: "#111827"
                }}>
                  Delivery Details
                </h3>
                {[
                  { placeholder: "Your full name", key: "customer_name", label: "Full Name" },
                  { placeholder: "Your county", key: "county", label: "County" },
                  { placeholder: "e.g., 0712345678", key: "phone", label: "M-Pesa Phone Number" }
                ].map(({ placeholder, key, label }) => (
                  <div key={key} style={{ marginBottom: "14px" }}>
                    <label style={labelStyle}>{label}</label>
                    <input
                      placeholder={placeholder}
                      value={checkoutForm[key]}
                      onChange={e => setCheckoutForm({
                        ...checkoutForm, [key]: e.target.value
                      })}
                      style={inputStyle}
                    />
                  </div>
                ))}
              </div>

              <button
                onClick={handleCheckout}
                disabled={paymentLoading}
                style={{
                  width: "100%", padding: "14px",
                  background: paymentLoading
                    ? "#86efac"
                    : "linear-gradient(135deg,#22c55e,#16a34a)",
                  color: "#fff", border: "none", borderRadius: "12px",
                  fontWeight: "700", fontSize: "15px",
                  cursor: paymentLoading ? "not-allowed" : "pointer",
                  boxShadow: "0 6px 20px rgba(34,197,94,0.25)"
                }}
              >
                {paymentLoading ? "Processing..." : "Checkout via M-Pesa"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ======================== PRODUCT CARD ========================
function ProductCard({ product, onAddToCart, onContactSeller, currentUserEmail, onProductUpdated }) {
  const [hovered, setHovered] = useState(false);
  const [showSellerPanel, setShowSellerPanel] = useState(false);
  const [newStock, setNewStock] = useState(product.stock || 0);
  const [updating, setUpdating] = useState(false);

  const isSeller = currentUserEmail && (
    product.user_email === currentUserEmail ||
    product.supplier_name === currentUserEmail
  );

  const categoryLabel = {
    chickens: "🐔 Chickens", eggs: "🥚 Eggs",
    feeds: "🌾 Feeds", equipment: "🔧 Equipment",
    medicine: "💊 Medicine", other: "📦 Other"
  }[product.category] || product.category;

  async function handleUpdateStock() {
    setUpdating(true);
    await supabase
      .from("products")
      .update({ stock: Number(newStock), sold_out: false })
      .eq("id", product.id);
    setUpdating(false);
    onProductUpdated();
  }

  async function handleSoldOut() {
    setUpdating(true);
    await supabase
      .from("products")
      .update({ stock: 0, sold_out: true })
      .eq("id", product.id);
    setUpdating(false);
    onProductUpdated();
  }

  async function handleRemove() {
    if (!window.confirm(
      `Remove "${product.product_name}" from the marketplace?`
    )) return;
    setUpdating(true);
    await supabase.from("products").delete().eq("id", product.id);
    setUpdating(false);
    onProductUpdated();
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#fff", borderRadius: "18px",
        border: `1px solid ${product.sold_out ? "#fecaca" : "#f0f0f0"}`,
        overflow: "hidden",
        boxShadow: hovered
          ? "0 16px 40px rgba(0,0,0,0.1)"
          : "0 2px 10px rgba(0,0,0,0.04)",
        transition: "all 0.25s ease",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        opacity: product.sold_out ? 0.85 : 1
      }}
    >
      {/* IMAGE */}
      <div style={{ position: "relative", paddingTop: "75%", background: "#f9fafb" }}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.product_name}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%", objectFit: "cover",
              transition: "transform 0.4s ease",
              transform: hovered ? "scale(1.05)" : "scale(1)"
            }}
          />
        ) : (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <ShoppingBag size={40} color="#e5e7eb" />
          </div>
        )}

        {/* CATEGORY BADGE */}
        <div style={{
          position: "absolute", top: "12px", left: "12px",
          background: "rgba(255,255,255,0.92)", borderRadius: "20px",
          padding: "4px 10px", fontSize: "12px", fontWeight: "600",
          color: "#374151", backdropFilter: "blur(8px)"
        }}>
          {categoryLabel}
        </div>

        {/* SOLD OUT OVERLAY */}
        {product.sold_out && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <span style={{
              background: "#ef4444", color: "#fff", fontWeight: "800",
              fontSize: "14px", padding: "8px 20px", borderRadius: "20px"
            }}>
              SOLD OUT
            </span>
          </div>
        )}

        {/* VERIFIED BADGE */}
        {product.is_verified && (
          <div style={{
            position: "absolute", top: "12px", right: "12px",
            background: "#22c55e", borderRadius: "20px",
            padding: "4px 10px", fontSize: "11px",
            fontWeight: "700", color: "#fff"
          }}>
            ✔ Verified
          </div>
        )}

        {/* SELLER DOT */}
        {isSeller && !product.is_verified && (
          <div style={{
            position: "absolute", top: "14px", right: "14px",
            width: "10px", height: "10px", borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 0 3px rgba(34,197,94,0.3)"
          }} />
        )}
      </div>

      {/* CONTENT */}
      <div style={{ padding: "16px" }}>
        <h3 style={{
          margin: "0 0 8px", fontSize: "15px", fontWeight: "700",
          color: "#111827", whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis"
        }}>
          {product.product_name}
        </h3>

        <div style={{
          display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: "8px"
        }}>
          <span style={{ fontSize: "18px", fontWeight: "800", color: "#22c55e" }}>
            KES {Number(product.price).toLocaleString()}
            <span style={{ fontSize: "12px", fontWeight: "400", color: "#9ca3af" }}>
              {UNIT_LABELS[product.unit] || ""}
            </span>
          </span>
          {product.stock > 0 && !product.sold_out && (
            <span style={{
              fontSize: "12px", fontWeight: "600",
              background: "#fef3c7", color: "#d97706",
              padding: "3px 10px", borderRadius: "20px"
            }}>
              {product.stock} available
            </span>
          )}
        </div>

        {product.county && (
          <div style={{
            display: "flex", alignItems: "center", gap: "4px",
            fontSize: "12px", color: "#9ca3af", marginBottom: "4px"
          }}>
            <MapPin size={12} />
            {product.county}
          </div>
        )}

        <p style={{ fontSize: "12px", color: "#9ca3af", margin: "0 0 14px" }}>
          by {product.supplier_name || "Farmer"}
        </p>

{/* BUYER BUTTON */}
{!isSeller && (
  <button
    onClick={() => !product.sold_out && onContactSeller(product)}
    disabled={!!product.sold_out}
    style={{
      width: "100%", padding: "10px",
      background: product.sold_out
        ? "#f3f4f6"
        : hovered ? "#22c55e" : "#f0fdf4",
      color: product.sold_out
        ? "#9ca3af"
        : hovered ? "#fff" : "#22c55e",
      border: product.sold_out
        ? "1.5px solid #e5e7eb"
        : "1.5px solid #22c55e",
      borderRadius: "10px", fontWeight: "700",
      fontSize: "13px",
      cursor: product.sold_out ? "not-allowed" : "pointer",
      transition: "all 0.2s"
    }}
  >
    {product.sold_out ? "Sold Out" : "💬 Contact Seller"}
  </button>
)}
        {/* SELLER CONTROLS */}
        {isSeller && (
          <div>
            <button
              onClick={() => setShowSellerPanel(!showSellerPanel)}
              style={{
                width: "100%", padding: "10px",
                background: showSellerPanel ? "#1e3a2e" : "#0f2318",
                color: "#22c55e", border: "1.5px solid #22c55e",
                borderRadius: "10px", fontWeight: "700",
                fontSize: "12px", cursor: "pointer",
                letterSpacing: "0.05em", transition: "all 0.2s"
              }}
            >
              {showSellerPanel ? "▲ SELLER CONTROLS" : "▼ SELLER CONTROLS"}
            </button>

            {showSellerPanel && (
              <div style={{
                marginTop: "12px", background: "#f9fafb",
                border: "1px solid #e5e7eb",
                borderRadius: "12px", padding: "14px"
              }}>
                {/* UPDATE STOCK */}
                <div style={{ marginBottom: "12px" }}>
                  <label style={{
                    fontSize: "11px", fontWeight: "600",
                    color: "#6b7280", textTransform: "uppercase",
                    letterSpacing: "0.05em", display: "block",
                    marginBottom: "6px"
                  }}>
                    Update Stock
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="number"
                      value={newStock}
                      onChange={e => setNewStock(e.target.value)}
                      style={{
                        flex: 1, padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1.5px solid #e5e7eb",
                        fontSize: "14px", outline: "none"
                      }}
                    />
                    <button
                      onClick={handleUpdateStock}
                      disabled={updating}
                      style={{
                        padding: "8px 14px", background: "#fff",
                        border: "1.5px solid #e5e7eb",
                        borderRadius: "8px", cursor: "pointer",
                        fontWeight: "600", fontSize: "13px", color: "#374151"
                      }}
                    >
                      ✏️ Save
                    </button>
                  </div>
                </div>

                <div style={{
                  height: "1px", background: "#e5e7eb", marginBottom: "12px"
                }} />

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={handleSoldOut}
                    disabled={updating || product.sold_out}
                    style={{
                      flex: 1, padding: "8px", background: "#fff",
                      border: "1.5px solid #f59e0b", borderRadius: "8px",
                      cursor: "pointer", fontWeight: "600",
                      fontSize: "12px", color: "#d97706",
                      display: "flex", alignItems: "center",
                      justifyContent: "center", gap: "6px"
                    }}
                  >
                    📦 {product.sold_out ? "Sold Out" : "Mark Sold Out"}
                  </button>
                  <button
                    onClick={handleRemove}
                    disabled={updating}
                    style={{
                      flex: 1, padding: "8px", background: "#fff",
                      border: "1.5px solid #ef4444", borderRadius: "8px",
                      cursor: "pointer", fontWeight: "600",
                      fontSize: "12px", color: "#ef4444",
                      display: "flex", alignItems: "center",
                      justifyContent: "center", gap: "6px"
                    }}
                  >
                    🗑️ Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}