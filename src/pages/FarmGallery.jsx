import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { IMAGE_ACCEPT, removeImageByUrl, uploadImage, validateImage } from "../lib/imageUpload";
import { Camera, X, Trash2, Upload, ChevronLeft, ChevronRight, AlertTriangle, Tag
} from "lucide-react";
import "./FarmGallery.css";

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: "10px",
  border: "1.5px solid #e5e7eb", fontSize: "14px",
  outline: "none", boxSizing: "border-box", background: "#fff"
};

const labelStyle = {
  display: "block", fontSize: "12px", fontWeight: "600",
  color: "#6b7280", marginBottom: "5px"
};

const tagsOf = (photo) => (photo.tags || "").split(",").map(t => t.trim()).filter(Boolean);

function formatDay(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export default function FarmGallery() {
  const { user, userEmail } = useAuth();
  const [photos, setPhotos] = useState([]);
  const [batches, setBatches] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTag, setActiveTag] = useState("All");
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [error, setError] = useState("");
  const touchStartX = useRef(0);
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
    setLoadError(false);
    const { data, error: fetchError } = await supabase
      .from("farm_gallery")
      .select("id, image_url, caption, date_taken, batch_name, tags")
      .eq("user_email", userEmail)
      .order("date_taken", { ascending: false });

    setLoading(false);
    if (fetchError) {
      console.error("Fetch error:", fetchError.message);
      setLoadError(true);
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

    const problem = validateImage(form.imageFile);
    if (problem) { setError(problem); setUploading(false); return; }

    try {
      // STEP 1 — Upload (shrunk first) into the user's own folder, the
      // only place the farm-gallery bucket accepts writes
      let imageUrl;
      try {
        imageUrl = await uploadImage(user.id, form.imageFile, "photo", "farm-gallery");
      } catch (uploadError) {
        setError("Upload failed: " + (uploadError.message || "check your connection"));
        setUploading(false);
        return;
      }

      // STEP 3 — Save to farm_gallery table
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
        removeImageByUrl(imageUrl, user.id);
        setError("Failed to save photo: " + insertError.message);
        setUploading(false);
        return;
      }

      // SUCCESS — reset and refresh
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

    // Delete the record first; the file is cleaned up best effort (photos
    // uploaded before the own-folder rule can't be removed from here).
    const { error: deleteError } = await supabase.from("farm_gallery").delete().eq("id", photo.id);
    if (deleteError) {
      alert("Couldn't delete the photo: " + deleteError.message);
      return;
    }
    removeImageByUrl(photo.image_url, user.id);
    setSelectedId(null);
    fetchPhotos();
  }

  const allTags = ["All", ...new Set(photos.flatMap(tagsOf))];

  const filteredPhotos = activeTag === "All"
    ? photos
    : photos.filter(p => tagsOf(p).includes(activeTag));

  // Newest first, grouped by month, in the order the photos arrive.
  const months = [];
  filteredPhotos.forEach(photo => {
    const label = new Date(photo.date_taken).toLocaleString("default", { month: "long", year: "numeric" });
    const last = months[months.length - 1];
    if (last && last.label === label) last.items.push(photo);
    else months.push({ label, items: [photo] });
  });

  // The viewer walks the same list the grid shows.
  const selectedIndex = filteredPhotos.findIndex(p => p.id === selectedId);
  const selected = selectedIndex >= 0 ? filteredPhotos[selectedIndex] : null;

  function step(by) {
    const next = filteredPhotos[selectedIndex + by];
    if (next) setSelectedId(next.id);
  }

  // The key listener is attached once per opening; the ref lets it call
  // the latest step() without being re-attached on every render.
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; });

  const viewerOpen = Boolean(selected);
  useEffect(() => {
    if (!viewerOpen) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setSelectedId(null);
      if (e.key === "ArrowLeft") stepRef.current(-1);
      if (e.key === "ArrowRight") stepRef.current(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewerOpen]);

  return (
    <div>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <Camera size={26} color="#22c55e" style={{ flexShrink: 0 }} />
          <h1 style={{ margin: 0, fontSize: "var(--fs-display, 28px)", fontWeight: "800", color: "#111827", letterSpacing: "-0.5px", whiteSpace: "nowrap" }}>
            Farm Gallery
          </h1>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          style={{
            height: "44px", padding: "0 16px", border: "none",
            borderRadius: "12px",
            background: "linear-gradient(135deg,#22c55e,#16a34a)",
            color: "white", fontWeight: "700", cursor: "pointer",
            fontSize: "14px", display: "flex", alignItems: "center",
            gap: "8px", boxShadow: "0 6px 20px rgba(34,197,94,0.3)",
            whiteSpace: "nowrap", flexShrink: 0
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
                    aria-label="Remove selected photo"
                    onClick={e => {
                      e.stopPropagation();
                      setForm({ ...form, imageFile: null, imagePreview: null });
                    }}
                    style={{
                      position: "absolute", top: "-14px", right: "-14px",
                      width: "44px", height: "44px", borderRadius: "50%",
                      background: "#ef4444", color: "#fff", border: "none",
                      cursor: "pointer", display: "flex",
                      alignItems: "center", justifyContent: "center"
                    }}
                  >
                    <X size={18} />
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
              accept={IMAGE_ACCEPT}
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
              aria-label="Caption (optional)"
              placeholder="Caption (optional)"
              value={form.caption}
              onChange={e => setForm({ ...form, caption: e.target.value })}
              style={{ ...inputStyle, marginBottom: "12px" }}
            />

            {/* DATE + BATCH */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: "12px", marginBottom: "12px" }}>
              <div>
                <label style={labelStyle} htmlFor="fg-date">Date Taken</label>
                <input
                  id="fg-date"
                  type="date"
                  value={form.date_taken}
                  onChange={e => setForm({ ...form, date_taken: e.target.value })}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="fg-batch">Batch (optional)</label>
                <select
                  id="fg-batch"
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
              <label style={labelStyle} htmlFor="fg-tags">Tags (comma-separated)</label>
              <input
                id="fg-tags"
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
                <AlertTriangle size={14} aria-hidden="true" /> {error}
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
        <div className="fg-tags">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              aria-pressed={activeTag === tag}
              className={`fg-tag fc-tap${activeTag === tag ? " fg-tag--active" : ""}`}
            >
              {tag !== "All" && ""}{tag}
            </button>
          ))}
        </div>
      )}

      {/* LOADING / ERROR */}
      {loading && <div className="fg-status">Loading your photos...</div>}

      {!loading && loadError && (
        <div className="fg-status" role="alert">
          We couldn't load your photos. Check your connection and try again.
          <button onClick={fetchPhotos}>Try again</button>
        </div>
      )}

      {/* EMPTY STATE */}
      {!loading && !loadError && filteredPhotos.length === 0 && (
        <div style={{
          textAlign: "center", padding: "80px 20px",
          background: "#fff", borderRadius: "20px", border: "1px solid #f0f0f0"
        }}>
          <Camera size={56} color="#e5e7eb" style={{ marginBottom: "16px" }} />
          <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#111827", margin: "0 0 8px" }}>
            No photos yet
          </h3>
          <p style={{ color: "#6b7280", fontSize: "14px", marginBottom: "20px" }}>
            Add your first farm photo to start your visual diary
          </p>
          <button
            onClick={() => setShowForm(true)}
            style={{
              minHeight: "44px", padding: "12px 24px", background: "#16a34a",
              color: "#fff", border: "none", borderRadius: "12px",
              fontWeight: "700", cursor: "pointer"
            }}
          >
            Add Your First Photo
          </button>
        </div>
      )}

      {/* PHOTO GRID, grouped by month */}
      {months.map(({ label, items }) => (
        <section key={label} className="fg-month">
          <h2 className="fg-month-title">
            {label} <span className="fg-month-count">· {items.length}</span>
          </h2>
          <div className="fg-grid">
            {items.map(photo => (
              <button
                key={photo.id}
                className="fg-tile"
                onClick={() => setSelectedId(photo.id)}
                aria-label={`Open photo${photo.caption ? `: ${photo.caption}` : ""}, ${formatDay(photo.date_taken)}`}
              >
                <img src={photo.image_url} alt="" loading="lazy" decoding="async" />
                {photo.caption && <span className="fg-tile-note" aria-hidden="true" />}
              </button>
            ))}
          </div>
        </section>
      ))}

      {/* FULL-SCREEN VIEWER */}
      {selected && (
        <div className="fg-viewer" role="dialog" aria-modal="true" aria-label="Photo viewer">
          <div className="fg-viewer-bar">
            <span className="fg-viewer-count">{selectedIndex + 1} of {filteredPhotos.length}</span>
            <div className="fg-viewer-actions">
              <button className="fg-icon-btn" onClick={() => deletePhoto(selected)} aria-label="Delete photo">
                <Trash2 size={18} />
              </button>
              <button className="fg-icon-btn" onClick={() => setSelectedId(null)} aria-label="Close" autoFocus>
                <X size={20} />
              </button>
            </div>
          </div>

          <div
            className="fg-viewer-stage"
            onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
            onTouchEnd={e => {
              const moved = e.changedTouches[0].clientX - touchStartX.current;
              if (Math.abs(moved) > 50) step(moved < 0 ? 1 : -1);
            }}
          >
            <img src={selected.image_url} alt={selected.caption || "Farm photo"} />
            <button
              className="fg-icon-btn fg-nav fg-nav--prev"
              onClick={() => step(-1)}
              disabled={selectedIndex === 0}
              aria-label="Previous photo"
            >
              <ChevronLeft size={22} />
            </button>
            <button
              className="fg-icon-btn fg-nav fg-nav--next"
              onClick={() => step(1)}
              disabled={selectedIndex === filteredPhotos.length - 1}
              aria-label="Next photo"
            >
              <ChevronRight size={22} />
            </button>
          </div>

          <div className="fg-viewer-info">
            {selected.caption && <p className="fg-viewer-caption">{selected.caption}</p>}
            {formatDay(selected.date_taken)}
            {selected.batch_name && ` · ${selected.batch_name}`}
            {tagsOf(selected).length > 0 && (
              <div className="fg-viewer-tags">
                {tagsOf(selected).map(tag => <span key={tag}><Tag size={14} aria-hidden="true" /> {tag}</span>)}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
