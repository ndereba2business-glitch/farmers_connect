import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import React from 'react';

// PAGES
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
import VetDashboard from "./pages/VetDashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Suppliers from "./pages/Suppliers";
import Marketplace from "./pages/Marketplace";
import Orders from "./pages/Orders";
import Analytics from "./pages/Analytics";
import ChatSupport from "./pages/ChatSupport";
import VetVerification from "./pages/VetVerification";
import SupplierVerification from "./pages/SupplierVerification";
import AdminDashboard from "./pages/AdminDashboard";
import RevenueDashboard from "./pages/RevenueDashboard";
import Wallet from "./pages/Wallet";
import SupplierOrders from "./pages/SupplierOrders";
import CluckyAI from "./pages/CluckyAI";
import MyFarm from "./pages/MyFarm";
import Profile from "./pages/Profile";
import FarmGallery from "./pages/FarmGallery";
import VerificationRequests from "./pages/VerificationRequests";
import Community from "./pages/Community";
import CommunityChat from "./pages/CommunityChat";
import Finance from "./pages/Finance";
import Tasks from "./pages/Tasks";
import FeedCalculator from "./pages/FeedCalculator";

// COMPONENTS
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";



function AppRoutes() {
  const { user, userEmail, loading } = useAuth();

  // =========================
  // LOADING SCREEN
  // =========================
  if (loading) {
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
          Loading Farmers Connect...
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

  return (
    <>
      {/* TOP NOTIFICATION BAR */}
      

      {/* ROUTES */}
      <Routes>

        {/* =========================
            PUBLIC ROUTES
        ========================= */}
        <Route path="/login" element={<Login />} />

        <Route path="/signup" element={<Signup />} />


        <Route
          path="/vet-verification"
          element={<VetVerification />}
        />

        <Route
          path="/supplier-verification"
          element={<SupplierVerification />}
        />

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

          {/* DASHBOARD */}
          <Route path="/" element={<Dashboard />} />

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
            element={<VerificationRequests />}
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

          {/* =========================
              SUPPLIER ROUTES
          ========================= */}

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
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}