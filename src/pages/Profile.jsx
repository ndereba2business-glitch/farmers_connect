import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import {
  Edit2, Save, LogOut, Camera, Trash2,
  MapPin, Phone, ShoppingBag, Star, Loader2, PlayCircle
} from "lucide-react";

const COUNTRY_CODES = [
  { label: "KE +254", value: "+254" },
  { label: "US +1", value: "+1" },
  { label: "NG +234", value: "+234" },
  { label: "GH +233", value: "+233" },
  { label: "ZA +27", value: "+27" },
  { label: "TZ +255", value: "+255" },
  { label: "ET +251", value: "+251" },
  { label: "UG +256", value: "+256" },
  { label: "GB +44", value: "+44" },
  { label: "IN +91", value: "+91" },
];

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

export default function Profile() {
  const { user, userEmail, logout, replayOnboarding } = useAuth();
  const navigate = useNavigate();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [replayingTour, setReplayingTour] = useState(false);
  const [activeTab, setActiveTab] = useState("listings");
  const [myListings, setMyListings] = useState([]);
  const [profileData, setProfileData] = useState({
    full_name: "",
    farm_name: "",
    county: "",
    phone: "",
    bio: "",
    country_code: "+254",
    avatar_url: ""
  });

  // ========================
  // LOAD PROFILE
  // ========================
  useEffect(() => {
    async function loadProfile() {
      if (!userEmail) return;

      const { data } = await supabase
        .from("farmer_profiles")
        .select("*")
        .eq("user_email", userEmail)
        .maybeSingle();

      if (data) {
        setProfileData({
          full_name: data.full_name || "",
          farm_name: data.farm_name || "",
          county: data.county || "",
          phone: data.phone || "",
          bio: data.bio || "",
          country_code: data.country_code || "+254",
          avatar_url: data.avatar_url || ""
        });
      }

      // Load my marketplace listings
      const { data: listings } = await supabase
        .from("products")
        .select("*")
        .eq("user_email", userEmail)
        .order("created_at", { ascending: false });

      setMyListings(listings || []);
    }

    loadProfile();
  }, [userEmail]);

  // ========================
  // SAVE PROFILE
  // ========================
  async function handleSave() {
    if (!userEmail) return;
    setSaving(true);

    // ✅ First check if profile exists
    const { data: existing } = await supabase
      .from("farmer_profiles")
      .select("id")
      .eq("user_email", userEmail)
      .maybeSingle();

    let error;

    if (existing) {
      // ✅ Profile exists — UPDATE it
      const { error: updateError } = await supabase
        .from("farmer_profiles")
        .update({
          full_name: profileData.full_name,
          farm_name: profileData.farm_name,
          county: profileData.county,
          phone: profileData.phone,
          bio: profileData.bio,
          country_code: profileData.country_code,
          avatar_url: profileData.avatar_url
        })
        .eq("user_email", userEmail);
      error = updateError;
    } else {
      // ✅ No profile yet — INSERT one
      const { error: insertError } = await supabase
        .from("farmer_profiles")
        .insert([{
          user_email: userEmail,
          full_name: profileData.full_name,
          farm_name: profileData.farm_name,
          county: profileData.county,
          phone: profileData.phone,
          bio: profileData.bio,
          country_code: profileData.country_code,
          avatar_url: profileData.avatar_url
        }]);
      error = insertError;
    }

    if (error) {
      console.error("Save error:", error.message);
      alert("Failed to save profile: " + error.message);
    } else {
      setEditing(false);
    }

    setSaving(false);
  }

  // ========================
  // UPLOAD AVATAR
  // ========================
  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Image must be under 5MB");
      return;
    }

    setUploadingPhoto(true);

    const fileExt = file.name.split(".").pop();
    const fileName = `${userEmail}-${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      const avatarUrl = urlData.publicUrl;

      await supabase
        .from("farmer_profiles")
        .upsert({
          user_email: userEmail,
          avatar_url: avatarUrl
        }, { onConflict: "user_email" });

      setProfileData(prev => ({ ...prev, avatar_url: avatarUrl }));
    }

    setUploadingPhoto(false);
  }

  // ========================
  // LOGOUT
  // ========================
  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  // ========================
  // REPLAY ONBOARDING TOUR
  // ========================
  async function handleReplayTour() {
    setReplayingTour(true);
    await replayOnboarding();
    setReplayingTour(false);
  }

  // ========================
  // DELETE ACCOUNT
  // ========================
  async function handleDeleteAccount() {
    if (!userEmail) return;
    await supabase.from("farmer_profiles").delete().eq("user_email", userEmail);
    await supabase.from("farm_tasks").delete().eq("user_email", userEmail);
    await supabase.from("farm_finances").delete().eq("user_email", userEmail);
    await supabase.from("community_posts").delete().eq("user_email", userEmail);
    await supabase.auth.signOut();
    navigate("/login");
  }

  const initials = (profileData.full_name || userEmail || "F").charAt(0).toUpperCase();

  return (
    <div style={{ maxWidth: "780px", margin: "0 auto" }}>

      {/* ======================== PROFILE HEADER CARD ======================== */}
      <div style={{
        background: "#fff", borderRadius: "24px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
        overflow: "hidden", marginBottom: "20px"
      }}>

        {/* GRADIENT BANNER */}
        <div style={{
          height: "96px",
          background: "linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(234,220,170,0.3) 100%)"
        }} />

        {/* PROFILE INFO */}
        <div style={{ padding: "0 28px 28px" }}>
          <div style={{
            display: "flex", alignItems: "flex-end",
            justifyContent: "space-between", marginTop: "-40px",
            flexWrap: "wrap", gap: "12px"
          }}>
            {/* AVATAR */}
            <div style={{ position: "relative", display: "inline-block" }}>
              <div style={{
                width: "80px", height: "80px", borderRadius: "18px",
                border: "4px solid #fff", overflow: "hidden",
                background: "#dcfce7", display: "flex",
                alignItems: "center", justifyContent: "center",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
              }}>
                {profileData.avatar_url ? (
                  <img
                    src={profileData.avatar_url}
                    alt="avatar"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{
                    fontSize: "28px", fontWeight: "800", color: "#16a34a"
                  }}>
                    {initials}
                  </span>
                )}
              </div>

              {/* CAMERA OVERLAY */}
              <label style={{
                position: "absolute", inset: 0,
                borderRadius: "18px",
                background: "rgba(0,0,0,0.4)",
                display: "flex", alignItems: "center",
                justifyContent: "center", cursor: "pointer",
                opacity: 0, transition: "opacity 0.2s"
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = 1}
                onMouseLeave={e => e.currentTarget.style.opacity = 0}
              >
                {uploadingPhoto
                  ? <Loader2 size={18} color="#fff" />
                  : <Camera size={18} color="#fff" />
                }
                <input
                  type="file" accept="image/*"
                  style={{ display: "none" }}
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>

            {/* NAME + EMAIL */}
            <div style={{ flex: 1, paddingTop: "44px" }}>
              <h1 style={{
                margin: 0, fontSize: "22px", fontWeight: "800", color: "#111827"
              }}>
                {profileData.full_name || "Farmer"}
              </h1>
              <p style={{ margin: "2px 0 0", fontSize: "14px", color: "#6b7280" }}>
                {userEmail}
              </p>
              <div style={{
                display: "flex", gap: "12px", marginTop: "8px", flexWrap: "wrap"
              }}>
                {profileData.farm_name && (
                  <span style={{
                    background: "#f0fdf4", color: "#16a34a",
                    fontSize: "12px", fontWeight: "600",
                    padding: "3px 10px", borderRadius: "20px",
                    border: "1px solid #dcfce7"
                  }}>
                    {profileData.farm_name}
                  </span>
                )}
                {profileData.county && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: "4px",
                    fontSize: "12px", color: "#9ca3af"
                  }}>
                    <MapPin size={12} /> {profileData.county}
                  </span>
                )}
                {profileData.phone && (
                  <span style={{
                    display: "flex", alignItems: "center", gap: "4px",
                    fontSize: "12px", color: "#9ca3af"
                  }}>
                    <Phone size={12} />
                    {profileData.country_code} {profileData.phone}
                  </span>
                )}
              </div>
            </div>

            {/* EDIT + REPLAY TOUR + LOGOUT BUTTONS */}
            <div style={{
              display: "flex", gap: "8px",
              paddingTop: "44px", flexWrap: "wrap"
            }}>
              <button
                onClick={() => setEditing(!editing)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", borderRadius: "10px",
                  border: "1.5px solid #e5e7eb", background: "#fff",
                  cursor: "pointer", fontWeight: "600",
                  fontSize: "13px", color: "#374151"
                }}
              >
                <Edit2 size={14} />
                {editing ? "Cancel" : "Edit"}
              </button>
              <button
                onClick={handleReplayTour}
                disabled={replayingTour}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", borderRadius: "10px",
                  border: "1.5px solid #dcfce7", background: "#f0fdf4",
                  cursor: replayingTour ? "not-allowed" : "pointer",
                  fontWeight: "600", fontSize: "13px", color: "#16a34a",
                  opacity: replayingTour ? 0.7 : 1
                }}
              >
                <PlayCircle size={14} />
                {replayingTour ? "Loading..." : "Replay Tour"}
              </button>
              <button
                onClick={handleLogout}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "8px 16px", borderRadius: "10px",
                  border: "1.5px solid #e5e7eb", background: "#fff",
                  cursor: "pointer", fontWeight: "600",
                  fontSize: "13px", color: "#374151"
                }}
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          </div>

          {/* BIO */}
          {profileData.bio && !editing && (
            <p style={{
              marginTop: "16px", fontSize: "14px",
              color: "#6b7280", lineHeight: "1.6"
            }}>
              {profileData.bio}
            </p>
          )}

          {/* ======================== EDIT FORM ======================== */}
          {editing && (
            <div style={{
              marginTop: "24px", background: "#f9fafb",
              borderRadius: "16px", padding: "24px",
              border: "1px solid #f0f0f0"
            }}>

              {/* FULL NAME + FARM NAME */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: "16px", marginBottom: "16px"
              }}>
                <div>
                  <label style={labelStyle}>Full Name</label>
                  <input
                    placeholder="Your full name"
                    value={profileData.full_name}
                    onChange={e => setProfileData({
                      ...profileData, full_name: e.target.value
                    })}
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Farm Name</label>
                  <input
                    placeholder="My Poultry Farm"
                    value={profileData.farm_name}
                    onChange={e => setProfileData({
                      ...profileData, farm_name: e.target.value
                    })}
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* COUNTY + LOCATION */}
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>Location</label>
                <input
                  placeholder="e.g. Nairobi, Kenya"
                  value={profileData.county}
                  onChange={e => setProfileData({
                    ...profileData, county: e.target.value
                  })}
                  style={inputStyle}
                />
              </div>

              {/* PHONE */}
              <div style={{ marginBottom: "16px" }}>
                <label style={labelStyle}>
                  Phone Number
                  <span style={{ color: "#ef4444", marginLeft: "4px" }}>*</span>
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <select
                    value={profileData.country_code}
                    onChange={e => setProfileData({
                      ...profileData, country_code: e.target.value
                    })}
                    style={{
                      ...inputStyle, width: "130px",
                      flexShrink: 0, appearance: "none"
                    }}
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    placeholder="712345678"
                    value={profileData.phone}
                    onChange={e => setProfileData({
                      ...profileData, phone: e.target.value
                    })}
                    style={inputStyle}
                  />
                </div>
                <p style={{
                  fontSize: "12px", color: "#9ca3af", marginTop: "6px"
                }}>
                  Required for order notifications and seller contact
                </p>
              </div>

              {/* BIO */}
              <div style={{ marginBottom: "24px" }}>
                <label style={labelStyle}>Bio</label>
                <textarea
                  placeholder="Tell us about your farm..."
                  value={profileData.bio}
                  onChange={e => setProfileData({
                    ...profileData, bio: e.target.value
                  })}
                  style={{
                    ...inputStyle, minHeight: "100px", resize: "vertical"
                  }}
                />
              </div>

              {/* SAVE + DELETE */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", flexWrap: "wrap", gap: "12px"
              }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "12px 24px",
                    background: saving
                      ? "#86efac"
                      : "linear-gradient(135deg,#22c55e,#16a34a)",
                    color: "#fff", border: "none", borderRadius: "12px",
                    fontWeight: "700", fontSize: "14px",
                    cursor: saving ? "not-allowed" : "pointer",
                    boxShadow: "0 4px 16px rgba(34,197,94,0.25)"
                  }}
                >
                  {saving
                    ? <Loader2 size={16} />
                    : <Save size={16} />
                  }
                  {saving ? "Saving..." : "Save Profile"}
                </button>

                {/* DELETE ACCOUNT */}
                {!deleteConfirm ? (
                  <button
                    onClick={() => setDeleteConfirm(true)}
                    style={{
                      display: "flex", alignItems: "center", gap: "6px",
                      padding: "10px 16px", background: "none",
                      border: "none", cursor: "pointer",
                      color: "#ef4444", fontSize: "13px", fontWeight: "600"
                    }}
                  >
                    <Trash2 size={14} />
                    Delete Account
                  </button>
                ) : (
                  <div style={{
                    display: "flex", gap: "8px", alignItems: "center"
                  }}>
                    <span style={{
                      fontSize: "13px", color: "#ef4444", fontWeight: "600"
                    }}>
                      Are you sure?
                    </span>
                    <button
                      onClick={handleDeleteAccount}
                      style={{
                        padding: "8px 14px", background: "#ef4444",
                        color: "#fff", border: "none", borderRadius: "8px",
                        cursor: "pointer", fontWeight: "700", fontSize: "13px"
                      }}
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(false)}
                      style={{
                        padding: "8px 14px", background: "#f3f4f6",
                        color: "#374151", border: "none", borderRadius: "8px",
                        cursor: "pointer", fontWeight: "600", fontSize: "13px"
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ======================== TABS ======================== */}
      <div style={{
        background: "#fff", borderRadius: "24px",
        border: "1px solid #e5e7eb",
        boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
        overflow: "hidden"
      }}>

        {/* TAB BUTTONS */}
        <div style={{
          display: "flex", gap: "4px", padding: "16px 20px",
          borderBottom: "1px solid #f0f0f0"
        }}>
          {[
            { key: "listings", label: `My Listings (${myListings.length})` },
            { key: "reviews", label: "Reviews (0)" }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                padding: "8px 18px", borderRadius: "20px",
                border: `1.5px solid ${activeTab === tab.key ? "#111827" : "#e5e7eb"}`,
                background: activeTab === tab.key ? "#111827" : "#fff",
                color: activeTab === tab.key ? "#fff" : "#6b7280",
                fontWeight: "600", fontSize: "13px", cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB CONTENT */}
        <div style={{ padding: "24px" }}>

          {/* MY LISTINGS */}
          {activeTab === "listings" && (
            <div>
              {myListings.length === 0 ? (
                <div style={{
                  textAlign: "center", padding: "48px 20px"
                }}>
                  <ShoppingBag size={48} color="#e5e7eb"
                    style={{ marginBottom: "12px" }} />
                  <p style={{ color: "#9ca3af", fontSize: "15px" }}>
                    No listings yet.
                  </p>
                </div>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                  gap: "16px"
                }}>
                  {myListings.map(product => (
                    <div key={product.id} style={{
                      display: "flex", alignItems: "center",
                      gap: "14px", padding: "14px 16px",
                      borderRadius: "16px",
                      border: "1px solid #f0f0f0",
                      background: "#fafafa"
                    }}>
                      <div style={{
                        width: "56px", height: "56px",
                        borderRadius: "12px", overflow: "hidden",
                        background: "#f3f4f6", flexShrink: 0
                      }}>
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.product_name}
                            style={{
                              width: "100%", height: "100%",
                              objectFit: "cover"
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
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{
                          margin: 0, fontWeight: "600", fontSize: "14px",
                          color: "#111827", whiteSpace: "nowrap",
                          overflow: "hidden", textOverflow: "ellipsis"
                        }}>
                          {product.product_name}
                        </p>
                        <p style={{
                          margin: "2px 0 0", fontWeight: "700",
                          fontSize: "14px", color: "#22c55e"
                        }}>
                          KES {Number(product.price).toLocaleString()}
                        </p>
                      </div>
                      <span style={{
                        fontSize: "11px", fontWeight: "600",
                        padding: "3px 8px", borderRadius: "20px",
                        background: product.sold_out ? "#fee2e2" : "#dcfce7",
                        color: product.sold_out ? "#ef4444" : "#16a34a"
                      }}>
                        {product.sold_out ? "Sold Out" : "Active"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* REVIEWS */}
          {activeTab === "reviews" && (
            <div style={{
              textAlign: "center", padding: "48px 20px"
            }}>
              <Star size={48} color="#e5e7eb"
                style={{ marginBottom: "12px" }} />
              <p style={{ color: "#9ca3af", fontSize: "15px" }}>
                No reviews yet.
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}