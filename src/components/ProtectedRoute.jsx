import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth();

  // ✅ Still loading — don't redirect yet
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0fdf4",
        flexDirection: "column",
        gap: "12px"
      }}>
        <div style={{
          width: "40px",
          height: "40px",
          border: "4px solid #dcfce7",
          borderTop: "4px solid #15803d",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite"
        }} />
        <p style={{ color: "#6b7280", fontSize: "14px" }}>Loading...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ✅ Not logged in — send to login
  if (!user) return <Navigate to="/login" replace />;

  // ✅ Wrong role — send to their correct home
  if (allowedRoles && !allowedRoles.includes(role)) {
    if (role === "vet") return <Navigate to="/vet" replace />;
    if (role === "supplier") return <Navigate to="/supplier-orders" replace />;
    if (role === "admin") return <Navigate to="/admin" replace />;
    return <Navigate to="/" replace />;
  }

  return children;
}