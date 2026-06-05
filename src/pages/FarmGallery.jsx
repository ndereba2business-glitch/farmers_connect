import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { Camera, X, Trash2, Upload } from "lucide-react";

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "#fff"
};

const labelStyle = {
  display: "block", fontSize: "12px", fontWeight: "600",
  color: "#6b7280", marginBottom: "5px"
};

export default function FarmGallery() {
  const { userEmail } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [batches, setBatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTag, setActiveTag] = useState("All");
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    caption: "",
    date_taken: new Date().toISOString().split("T")[0],
    batch_id: "",
    tags: "",
    imageFile: null,
    imagePreview: null
  });

  async function fetchPhotos() {
    if (!userEmail) return;
    const { data, error: fetchError } = await supabase
      .from("farm_gallery")
      .select("*")
      .eq("user_email", userEmail)
      .order("date_taken", { ascending: false });

    if (fetchError) {
      console.error("Fetch error:", fetchError.message);
      return;
    }
    setPhotos(data || []);
  }

  async function fetchBatches() {
    if (!userEmail) return;
    const { data } = await supabase
      .from("farm_batches")
      .select("id, batch_name")
      .eq("user_email", userEmail);
    setBatches(data || []);
  }

  useEffect(() => {
    fetchPhotos();
    fetchBatches();
  }, [userEmail]);

  async function handleSavePhoto(e) {
    e.preventDefault();
    setError("");
    if (!form.imageFile) { setError("Please select a photo"); return; }
    setUploading(true);

    try {
      // ✅ STEP 1 — Upload to storage
      const fileExt = form.imageFile.name.split(".").pop();
      const fileName = `${userEmail.replace("@", "_")}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("farm-gallery")
        .upload(fileName, form.imageFile, { upsert: true });

      if (uploadError) {
        setError("Upload failed: " + uploadError.message);
        setUploading(false);
        return;
      }

      // ✅ STEP 2 — Get public URL
      const { data: urlData } = supabase.storage
        .from("farm-gallery")
        .getPublicUrl(fileName);

      const imageUrl = urlData.publicUrl;

      // ✅ STEP 3 — Save to farm_gallery table
      const selectedBatch = batches.find(b => b.id === form.batch_id);

      const { error: insertError } = await supabase
        .from("farm_gallery")
        .insert([{
          user_email: userEmail,
          image_url: imageUrl,
          caption: form.caption || "",
          date_taken: form.date_taken,
          batch_id: form.batch_id || null,
          batch_name: selectedBatch?.batch_name || null,
          tags: form.tags || ""
        }]);

      if (insertError) {
        setError("Failed to save photo: " + insertError.message);
        setUploading(false);
        return;
      }

      // ✅ SUCCESS — reset and refresh
      setForm({
        caption: "",
        date_taken: new Date().toISOString().split("T")[0],
        batch_id: "",
        tags: "",
        imageFile: null,
        imagePreview: null
      });
      setShowForm(false);
      setUploading(false);
      fetchPhotos();

    } catch (err) {
      setError("Something went wrong: " + err.message);
      setUploading(false);
    }
  }

  async function deletePhoto(photo) {
    if (!window.confirm("Delete this photo?")) return;

    // Delete from storage
    const fileName = photo.image_url.split("/").pop();
    await supabase.storage.from("farm-gallery").remove([fileName]);

    // Delete from table
    await supabase.from("farm_gallery").delete().eq("id", photo.id);
    setSelectedPhoto(null);
    fetchPhotos();
  }

  // Get all unique tags
  const allTags = ["All", ...new Set(
    photos.flatMap(p => (p.tags || "")
      .split(",")
      .map(t => t.trim())
      .filter(Boolean)
    )
  )];

  const filteredPhotos = activeTag === "All"
    ? photos
    : photos.filter(p =>
        (p.tags || "").split(",").map(t => t.trim()).includes(activeTag)
      );

  // Group by month
  const grouped = {};
  filteredPhotos.forEach(photo => {
    const date = new Date(photo.date_taken);
    const key = date.toLocaleString("default", { month: "long", year: "numeric" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(photo);
  });

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Camera size={28} color="#22c55e" />
          <h1 style={{ margin: 0, fontSize: "32px", fontWeight: "800", color: "#111827", letterSpacing: "-1px" }}>
            Farm Gallery
          </h1>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          style={{
            height: "44px", padding: "0 20px", border: "none",
            borderRadius: "12px",
            background: "linear-gradient(135deg,#22c55e,#16a34a)",
            color: "white", fontWeight: "700", cursor: "pointer",
            fontSize: "14px", display: "flex", alignItems: "center",
            gap: "8px", boxShadow: "0 6px 20px rgba(34,197,94,0.3)"
          }}
        >
          <Camera size={16} /> Add Photo
        </button>
      </div>
      <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "24px" }}>
        {photos.length} photo{photos.length !== 1 ? "s" : ""} • Your farm visual reference
      </p>

      {/* ADD PHOTO FORM */}
      {showForm && (
        <div style={{
          background: "#fff", borderRadius: "20px",
          border: "1px solid #e5e7eb", padding: "24px",
          marginBottom: "24px", boxShadow: "0 4px 20px rgba(0,0,0,0.06)"
        }}>
          <form onSubmit={handleSavePhoto}>

            {/* UPLOAD ZONE */}
            <div
              onClick={() => document.getElementById("gallery-upload").click()}
              style={{
                border: "2px dashed #d1fae5", borderRadius: "14px",
                padding: "32px", textAlign: "center", cursor: "pointer",
                background: form.imagePreview ? "#f0fdf4" : "#fafafa",
                marginBottom: "16px", transition: "all 0.2s"
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#22c55e"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#d1fae5"}
            >
              {form.imagePreview ? (
                <div style={{ position: "relative", display: "inline-block" }}>
                  <img
                    src={form.imagePreview} alt="preview"
                    style={{ maxHeight: "200px", maxWidth: "100%", borderRadius: "10px", objectFit: "cover" }}
                  />
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setForm({ ...form, imageFile: null, imagePreview: null });
                    }}
                    style={{
                      position: "absolute", top: "-8px", right: "-8px",
                      width: "24px", height: "24px", borderRadius: "50%",
                      background: "#ef4444", color: "#fff", border: "none",
                      cursor: "pointer", display: "flex",
                      alignItems: "center", justifyContent: "center"
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div>
                  <Upload size={32} color="#9ca3af" style={{ marginBottom: "10px" }} />
                  <p style={{ margin: "0 0 4px", fontWeight: "600", color: "#374151", fontSize: "14px" }}>
                    Tap to select a photo from your device
                  </p>
                  <p style={{ margin: 0, color: "#9ca3af", fontSize: "12px" }}>
                    JPG, PNG, HEIC — max 5MB
                  </p>
                </div>
              )}
            </div>

            <input
              id="gallery-upload"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={e => {
                const file = e.target.files[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  setError("Image must be under 5MB");
                  return;
                }
                setForm({
                  ...form,
                  imageFile: file,
                  imagePreview: URL.createObjectURL(file)
                });
              }}
            />

            {/* CAPTION */}
            <input
              placeholder="Caption (optional)"
              value={form.caption}
              onChange={e => setForm({ ...form, caption: e.target.value })}
              style={{ ...inputStyle, marginBottom: "12px" }}
            />

            {/* DATE + BATCH */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={labelStyle}>Date Taken</label>
                <input
                  type="date"
                  value={form.date_taken}
                  onChange={e => setForm({ ...form, date_taken: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Batch (optional)</label>
                <select
                  value={form.batch_id}
                  onChange={e => setForm({ ...form, batch_id: e.target.value })}
                  style={{ ...inputStyle, appearance: "none" }}
                >
                  <option value="">No batch</option>
                  {batches.map(b => (
                    <option key={b.id} value={b.id}>{b.batch_name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* TAGS */}
            <div style={{ marginBottom: "16px" }}>
              <label style={labelStyle}>Tags (comma-separated)</label>
              <input
                placeholder="e.g. day-1, disease, new chicks, broiler"
                value={form.tags}
                onChange={e => setForm({ ...form, tags: e.target.value })}
                style={inputStyle}
              />
            </div>

            {/* ERROR */}
            {error && (
              <div style={{
                background: "#fef2f2", border: "1px solid #fecaca",
                color: "#dc2626", padding: "10px 14px",
                borderRadius: "8px", fontSize: "13px", marginBottom: "14px"
              }}>
                ⚠️ {error}
              </div>
            )}

            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="submit"
                disabled={uploading}
                style={{
                  flex: 1, padding: "12px",
                  background: uploading
                    ? "#86efac"
                    : "linear-gradient(135deg,#22c55e,#16a34a)",
                  color: "#fff", border: "none", borderRadius: "10px",
                  fontWeight: "700", fontSize: "14px",
                  cursor: uploading ? "not-allowed" : "pointer"
                }}
              >
                {uploading ? "Uploading..." : "Save Photo"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(""); }}
                style={{
                  padding: "12px 20px", background: "#f9fafb",
                  border: "1px solid #e5e7eb", borderRadius: "10px",
                  cursor: "pointer", fontWeight: "600", fontSize: "14px", color: "#374151"
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAG FILTERS */}
      {allTags.length > 1 && (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "20px" }}>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              style={{
                padding: "6px 14px", borderRadius: "20px",
                border: "none", cursor: "pointer",
                fontWeight: "600", fontSize: "13px",
                background: activeTag === tag ? "#22c55e" : "#f3f4f6",
                color: activeTag === tag ? "#fff" : "#374151",
                transition: "all 0.2s"
              }}
            >
              {tag !== "All" && "🏷 "}{tag}
            </button>
          ))}
        </div>
      )}

      {/* EMPTY STATE */}
      {Object.keys(grouped).length === 0 && (
        <div style={{
          textAlign: "center", padding: "80px 20px",
          background: "#fff", borderRadius: "20px", border: "1px solid #f0f0f0"
        }}>
          <Camera size={56} color="#e5e7eb" style={{ marginBottom: "16px" }} />
          <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#111827", margin: "0 0 8px" }}>
            No photos yet
          </h3>
          <p style={{ color: "#9ca3af", fontSize: "14px", marginBottom: "20px" }}>
            Add your first farm photo to start your visual diary
          </p>
          <button
            onClick={() => setShowForm(true)}
            style={{
              padding: "12px 24px", background: "#22c55e",
              color: "#fff", border: "none", borderRadius: "12px",
              fontWeight: "700", cursor: "pointer"
            }}
          >
            Add Your First Photo
          </button>
        </div>
      )}

      {/* PHOTO GRID */}
      {Object.entries(grouped).map(([month, monthPhotos]) => (
        <div key={month} style={{ marginBottom: "28px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: "700", color: "#6b7280", marginBottom: "12px" }}>
            {month} ({monthPhotos.length})
          </h3>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "12px"
          }}>
            {monthPhotos.map(photo => (
              <div
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                style={{
                  borderRadius: "16px", overflow: "hidden",
                  background: "#fff", border: "1px solid #f0f0f0",
                  boxShadow: "0 2px 10px rgba(0,0,0,0.06)",
                  cursor: "pointer"
                }}
              >
                <div style={{ paddingTop: "75%", position: "relative", background: "#f3f4f6" }}>
                  <img
                    src={photo.image_url}
                    alt={photo.caption || "Farm photo"}
                    style={{
                      position: "absolute", inset: 0,
                      width: "100%", height: "100%", objectFit: "cover"
                    }}
                  />
                  {photo.caption && (
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      background: "linear-gradient(transparent, rgba(0,0,0,0.6))",
                      padding: "20px 10px 8px",
                      color: "#fff", fontSize: "12px", fontWeight: "600"
                    }}>
                      {photo.caption}
                    </div>
                  )}
                </div>
                {photo.tags && (
                  <div style={{ padding: "8px 10px", display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {photo.tags.split(",").map(t => t.trim()).filter(Boolean).slice(0, 3).map(tag => (
                      <span key={tag} style={{
                        fontSize: "10px", fontWeight: "600",
                        padding: "2px 6px", borderRadius: "10px",
                        background: "#f0fdf4", color: "#16a34a"
                      }}>
                        🏷 {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* LIGHTBOX */}
      {selectedPhoto && (
        <div
          onClick={() => setSelectedPhoto(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex", alignItems: "center",
            justifyContent: "center", zIndex: 9999, padding: "20px"
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: "20px",
              maxWidth: "680px", width: "100%", overflow: "hidden"
            }}
          >
            <img
              src={selectedPhoto.image_url}
              alt={selectedPhoto.caption}
              style={{ width: "100%", maxHeight: "480px", objectFit: "cover" }}
            />
            <div style={{
              padding: "16px 20px",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start"
            }}>
              <div>
                {selectedPhoto.caption && (
                  <p style={{ margin: "0 0 4px", fontWeight: "700", fontSize: "15px", color: "#111827" }}>
                    {selectedPhoto.caption}
                  </p>
                )}
                <p style={{ margin: 0, fontSize: "12px", color: "#9ca3af" }}>
                  {selectedPhoto.date_taken}
                  {selectedPhoto.batch_name && ` · ${selectedPhoto.batch_name}`}
                </p>
                {selectedPhoto.tags && (
                  <div style={{ display: "flex", gap: "4px", marginTop: "8px", flexWrap: "wrap" }}>
                    {selectedPhoto.tags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                      <span key={tag} style={{
                        fontSize: "11px", fontWeight: "600",
                        padding: "2px 8px", borderRadius: "10px",
                        background: "#f0fdf4", color: "#16a34a"
                      }}>
                        🏷 {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => deletePhoto(selectedPhoto)}
                  style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    border: "1px solid #fee2e2", background: "#fff",
                    cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center"
                  }}
                >
                  <Trash2 size={16} color="#ef4444" />
                </button>
                <button
                  onClick={() => setSelectedPhoto(null)}
                  style={{
                    width: "36px", height: "36px", borderRadius: "10px",
                    border: "1px solid #e5e7eb", background: "#fff",
                    cursor: "pointer", display: "flex",
                    alignItems: "center", justifyContent: "center"
                  }}
                >
                  <X size={16} color="#374151" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}