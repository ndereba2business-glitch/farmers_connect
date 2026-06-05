import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { createNotification } from "../lib/notifications";

export default function Community() {
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState({});
  const [content, setContent] = useState("");
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [commentInputs, setCommentInputs] = useState({});
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [currentUserName, setCurrentUserName] = useState("");

  // =========================
  // GET CURRENT USER ON LOAD
  // =========================
  useEffect(() => {
    async function loadUser() {
      const { data: userData } = await supabase.auth.getUser();
      const email = userData?.user?.email || "";
      setCurrentUserEmail(email);

      if (email) {
        const { data: profile } = await supabase
          .from("farmer_profiles")
          .select("full_name")
          .eq("user_email", email)
          .single();

        setCurrentUserName(profile?.full_name || "Farmer");
      }
    }
    loadUser();
    fetchPosts();
  }, []);

  // =========================
  // FETCH POSTS
  // =========================
  async function fetchPosts() {
    const { data } = await supabase
      .from("community_posts")
      .select("*")
      .order("created_at", { ascending: false });

    setPosts(data || []);
    fetchComments();
  }

  // =========================
  // FETCH COMMENTS
  // =========================
  async function fetchComments() {
    const { data } = await supabase
      .from("community_comments")
      .select("*")
      .order("created_at", { ascending: true });

    const grouped = {};
    (data || []).forEach((comment) => {
      if (!grouped[comment.post_id]) {
        grouped[comment.post_id] = [];
      }
      grouped[comment.post_id].push(comment);
    });

    setComments(grouped);
  }

  // =========================
  // CREATE POST
  // =========================
  async function createPost() {
    if (!content.trim()) return;

    try {
      setUploading(true);

      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user.email;

      const { data: profile } = await supabase
        .from("farmer_profiles")
        .select("*")
        .eq("user_email", email)
        .single();

      let imageUrl = "";

      if (image) {
        const fileName = Date.now() + "-" + image.name;
        const { error } = await supabase.storage
          .from("community-posts")
          .upload(fileName, image);

        if (!error) {
          const { data } = supabase.storage
            .from("community-posts")
            .getPublicUrl(fileName);
          imageUrl = data.publicUrl;
        }
      }

      await supabase.from("community_posts").insert([
        {
          user_email: email,
          user_name: profile?.full_name || "Farmer",
          user_avatar: profile?.avatar_url || "",
          content,
          image_url: imageUrl
        }
      ]);

      await createNotification({
        userEmail: email,
        type: "community",
        title: "Post Published 📝",
        message: `Your post "${content.slice(0, 40)}..." is now live in the community.`,
        link: "/community"
      });

      setContent("");
      setImage(null);
      fetchPosts();

    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  }

  // =========================
  // LIKE & COMMENT FUNCTIONS
  // =========================
  async function likePost(post) {
    await supabase
      .from("community_posts")
      .update({ likes: (post.likes || 0) + 1 })
      .eq("id", post.id);

    if (post.user_email !== currentUserEmail) {
      await createNotification({
        userEmail: post.user_email,
        type: "community",
        title: "Someone liked your post ❤️",
        message: `${currentUserName} liked your post "${post.content.slice(0, 40)}..."`,
        link: "/community"
      });
    }
    fetchPosts();
  }

  async function addComment(postId) {
    const text = commentInputs[postId];
    if (!text?.trim()) return;

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user.email;

    const { data: profile } = await supabase
      .from("farmer_profiles")
      .select("*")
      .eq("user_email", email)
      .single();

    await supabase.from("community_comments").insert([
      {
        post_id: postId,
        user_email: email,
        user_name: profile?.full_name || "Farmer",
        content: text
      }
    ]);

    const post = posts.find((p) => p.id === postId);
    if (post && post.user_email !== currentUserEmail) {
      await createNotification({
        userEmail: post.user_email,
        type: "community",
        title: "New comment on your post 💬",
        message: `${profile?.full_name || "A farmer"} commented: "${text.slice(0, 50)}..."`,
        link: "/community"
      });
    }

    setCommentInputs({ ...commentInputs, [postId]: "" });
    fetchComments();
  }

  return (
    <div style={{ padding: "32px", minHeight: "100vh", backgroundColor: "#f9fafb", fontFamily: "sans-serif" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        
        {/* HEADER SECTION */}
        <h1 style={{ color: "#111827", fontSize: "28px", fontWeight: "700", marginBottom: "8px" }}>
          Community
        </h1>
        <p style={{ color: "#6b7280", fontSize: "16px", marginBottom: "24px" }}>
          Share experiences and learn from fellow farmers
        </p>

        {/* CREATE POST CARD */}
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "12px",
          padding: "20px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          marginBottom: "40px"
        }}>
          <textarea
            placeholder="Share something with the community..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            style={{
              width: "100%",
              minHeight: "80px",
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: "15px",
              fontFamily: "inherit",
              color: "#374151"
            }}
          />

          <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "16px 0" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", gap: "20px", color: "#6b7280" }}>
              {/* Image Icon */}
              <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => setImage(e.target.files[0])}
                />
              </label>

              {/* Alert Icon */}
              <button style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "14px" }}>
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Stock Out Alert
              </button>
            </div>

            <button 
              onClick={createPost}
              disabled={uploading || !content.trim()}
              style={{
                backgroundColor: "#82ca9c",
                color: "#ffffff",
                padding: "8px 24px",
                borderRadius: "8px",
                border: "none",
                fontWeight: "600",
                cursor: (uploading || !content.trim()) ? "not-allowed" : "pointer",
                opacity: (uploading || !content.trim()) ? 0.7 : 1
              }}
            >
              {uploading ? "Posting..." : "Post"}
            </button>
          </div>
          {image && <p style={{ fontSize: "12px", color: "#10b981", marginTop: "10px" }}>Image attached: {image.name}</p>}
        </div>

        {/* POSTS LIST */}
        {posts.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9ca3af", marginTop: "60px", fontSize: "16px" }}>
            No posts yet. Be the first to share!
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} style={{
              backgroundColor: "#ffffff",
              borderRadius: "12px",
              padding: "20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              marginBottom: "20px"
            }}>
              {/* Post Content Header */}
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                {post.user_avatar ? (
                  <img src={post.user_avatar} alt="avatar" style={{ width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#e5e7eb" }} />
                )}
                <div>
                  <h3 style={{ margin: 0, fontSize: "15px", color: "#111827" }}>{post.user_name}</h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>
                    {new Date(post.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <p style={{ color: "#374151", fontSize: "15px", lineHeight: "1.5" }}>{post.content}</p>

              {post.image_url && (
                <img src={post.image_url} alt="post" style={{ width: "100%", marginTop: "16px", borderRadius: "8px", objectFit: "cover", maxHeight: "400px" }} />
              )}

              {/* Interactions */}
              <div style={{ marginTop: "16px", display: "flex", gap: "16px" }}>
                <button onClick={() => likePost(post)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                  ❤️ {post.likes || 0}
                </button>
              </div>

              {/* Comments Section */}
              <div style={{ marginTop: "20px", background: "#f9fafb", padding: "16px", borderRadius: "8px" }}>
                {(comments[post.id] || []).map((comment) => (
                  <div key={comment.id} style={{ marginBottom: "12px" }}>
                    <strong style={{ fontSize: "13px", color: "#111827" }}>{comment.user_name}</strong>
                    <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#4b5563" }}>{comment.content}</p>
                  </div>
                ))}

                <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                  <input
                    placeholder="Write a comment..."
                    value={commentInputs[post.id] || ""}
                    onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: "20px", border: "1px solid #d1d5db", outline: "none", fontSize: "14px" }}
                  />
                  <button onClick={() => addComment(post.id)} style={{ background: "#82ca9c", color: "white", border: "none", borderRadius: "20px", padding: "0 16px", cursor: "pointer" }}>
                    Send
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}