import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import React, { Suspense, lazy } from 'react';

// PAGES — lazy-loaded so each route ships its own chunk instead of one
// multi-megabyte bundle for the whole app.
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Bookings = lazy(() => import("./pages/Bookings"));
const VetDashboard = lazy(() => import("./pages/VetDashboard"));
const VetProfileSetup = lazy(() => import("./pages/VetProfileSetup"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Suppliers = lazy(() => import("./pages/Suppliers"));
const Marketplace = lazy(() => import("./pages/Marketplace"));
const Orders = lazy(() => import("./pages/Orders"));
const Analytics = lazy(() => import("./pages/Analytics"));
const ChatSupport = lazy(() => import("./pages/ChatSupport"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const RevenueDashboard = lazy(() => import("./pages/RevenueDashboard"));
const Wallet = lazy(() => import("./pages/Wallet"));
const SupplierOrders = lazy(() => import("./pages/SupplierOrders"));
const SupplierDashboard = lazy(() => import("./pages/SupplierDashboard"));
const SupplierProfileSetup = lazy(() => import("./pages/SupplierProfileSetup"));
const SupplierProducts = lazy(() => import("./pages/SupplierProducts"));
const SupplierProductForm = lazy(() => import("./pages/SupplierProductForm"));
const CluckyAI = lazy(() => import("./pages/CluckyAI"));
const MyFarm = lazy(() => import("./pages/MyFarm"));
const Profile = lazy(() => import("./pages/Profile"));
const FarmGallery = lazy(() => import("./pages/FarmGallery"));
const VerificationRequests = lazy(() => import("./pages/VerificationRequests"));
const Community = lazy(() => import("./pages/Community"));
const CommunityChat = lazy(() => import("./pages/CommunityChat"));
const Finance = lazy(() => import("./pages/Finance"));
const Tasks = lazy(() => import("./pages/Tasks"));
const FeedCalculator = lazy(() => import("./pages/FeedCalculator"));
const MyFarmers = lazy(() => import("./pages/MyFarmers"));
const Appointments = lazy(() => import("./pages/Appointments"));
const LandingPage = lazy(() => import("./pages/LandingPage"));

// COMPONENTS
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

function LoadingScreen({ label }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        background: "#f0fdf4",
        gap: "12px"
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "4px solid #dcfce7",
          borderTop: "4px solid #15803d",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }}
      />

      <p
        style={{
          color: "#666",
          fontSize: "14px"
        }}
      >
        {label}
      </p>

      <style>
        {`
          @keyframes spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
}

function AppRoutes() {
  const { user, role, loading } = useAuth();

  // =========================
  // LOADING SCREEN
  // =========================
  if (loading) {
    return <LoadingScreen label="Loading Farmers Connect..." />;
  }

  return (
    <>
      {/* TOP NOTIFICATION BAR */}


      {/* ROUTES */}
      <Suspense fallback={<LoadingScreen label="Loading..." />}>
      <Routes>

        {/* =========================
            PUBLIC ROUTES
        ========================= */}
        <Route path="/login" element={<Login />} />

        <Route path="/signup" element={<Signup />} />


        {/* Old standalone verification forms wrote to tables that never
            existed. Vets and suppliers now get verified through their
            profile pages (admin approves), so these URLs just point there. */}
        <Route
          path="/vet-verification"
          element={<Navigate to={!user ? "/signup" : role === "vet" ? "/vet-profile" : "/"} replace />}
        />

        <Route
          path="/supplier-verification"
          element={<Navigate to={!user ? "/signup" : role === "supplier" ? "/supplier-profile" : "/"} replace />}
        />

        {/* =========================
            ROOT
            Logged out: public landing page (no redirect to /login).
            Logged in: same Dashboard-behind-Layout as before, same URL.
        ========================= */}
        <Route
          path="/"
          element={user ? <Layout /> : <LandingPage />}
        >
          {user && (
            <Route
              index
              element={role === "supplier" ? <Navigate to="/supplier" replace /> : <Dashboard />}
            />
          )}
        </Route>

        {/* =========================
            PROTECTED ROUTES
        ========================= */}

        <Route
          element={
            user
              ? <Layout />
              : <Navigate to="/login" replace />
          }
        >

          {/* FARM */}
          <Route path="/my-farm" element={<MyFarm />} />

          <Route path="/tasks" element={<Tasks />} />

          <Route path="/finance" element={<Finance />} />

          <Route path="/analytics" element={<Analytics />} />

          {/* PROFILE */}
          <Route path="/profile" element={<Profile />} />

          <Route path="/gallery" element={<FarmGallery />} />

          {/* MARKETPLACE */}
          <Route path="/marketplace" element={<Marketplace />} />

          <Route path="/orders" element={<Orders />} />

          <Route path="/suppliers" element={<Suppliers />} />

          <Route path="/wallet" element={<Wallet />} />

          <Route path="/feed-calculator" element={<FeedCalculator />} />

          {/* COMMUNITY */}
          <Route path="/community" element={<Community />} />

          <Route
            path="/community-chat"
            element={<CommunityChat />}
          />

          {/* BOOKINGS */}
          <Route path="/bookings" element={<Bookings />} />

          {/* AI */}
          <Route path="/clucky" element={<CluckyAI />} />

          {/* CHAT */}
          <Route path="/chat" element={<ChatSupport />} />

          {/* VERIFICATIONS */}
          <Route
            path="/verifications"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <VerificationRequests />
              </ProtectedRoute>
            }
          />

          {/* =========================
              VET ROUTES
          ========================= */}

          <Route
            path="/vet"
            element={
              <ProtectedRoute allowedRoles={["vet"]}>
                <VetDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/vet-profile"
            element={
              <ProtectedRoute allowedRoles={["vet"]}>
                <VetProfileSetup />
              </ProtectedRoute>
            }
          />

          <Route
            path="/vet/farmers"
            element={
              <ProtectedRoute allowedRoles={["vet"]}>
                <MyFarmers />
              </ProtectedRoute>
            }
          />

          <Route
            path="/appointments"
            element={
              <ProtectedRoute allowedRoles={["vet"]}>
                <Appointments />
              </ProtectedRoute>
            }
          />

          {/* =========================
              SUPPLIER ROUTES
          ========================= */}

          <Route
            path="/supplier"
            element={
              <ProtectedRoute allowedRoles={["supplier"]}>
                <SupplierDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/supplier/products"
            element={
              <ProtectedRoute allowedRoles={["supplier"]}>
                <SupplierProducts />
              </ProtectedRoute>
            }
          />

          <Route
            path="/supplier/products/new"
            element={
              <ProtectedRoute allowedRoles={["supplier"]}>
                <SupplierProductForm />
              </ProtectedRoute>
            }
          />

          <Route
            path="/supplier/products/:id/edit"
            element={
              <ProtectedRoute allowedRoles={["supplier"]}>
                <SupplierProductForm />
              </ProtectedRoute>
            }
          />

          <Route
            path="/supplier-profile"
            element={
              <ProtectedRoute allowedRoles={["supplier"]}>
                <SupplierProfileSetup />
              </ProtectedRoute>
            }
          />

          <Route
            path="/supplier-orders"
            element={
              <ProtectedRoute allowedRoles={["supplier"]}>
                <SupplierOrders />
              </ProtectedRoute>
            }
          />

          {/* =========================
              ADMIN ROUTES
          ========================= */}

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/revenue"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <RevenueDashboard />
              </ProtectedRoute>
            }
          />

        </Route>

        {/* FALLBACK */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppRoutes />
      </ToastProvider>
    </AuthProvider>
  );
}