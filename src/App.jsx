import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import React from 'react';

// PAGES
import Dashboard from "./pages/Dashboard";
import Bookings from "./pages/Bookings";
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

// VET WORKSPACE
import VetLayout from "./vet/layout/VetLayout";
import VetDashboard from "./vet/pages/VetDashboard";
import VetPlaceholderPage from "./vet/pages/VetPlaceholderPage";

// COMPONENTS
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";


function AppRoutes() {
  const { user, loading } = useAuth();

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
        <p style={{ color: "#666", fontSize: "14px" }}>
          Loading Farmers Connect...
        </p>
        <style>
          {`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  return (
    <Routes>

      {/* =========================
          PUBLIC ROUTES
      ========================= */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/vet-verification" element={<VetVerification />} />
      <Route path="/supplier-verification" element={<SupplierVerification />} />

      {/* =========================
          FARMER / SHARED ROUTES
      ========================= */}
      <Route
        element={user ? <Layout /> : <Navigate to="/login" replace />}
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/my-farm" element={<MyFarm />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/gallery" element={<FarmGallery />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/wallet" element={<Wallet />} />
        <Route path="/feed-calculator" element={<FeedCalculator />} />
        <Route path="/community" element={<Community />} />
        <Route path="/community-chat" element={<CommunityChat />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/clucky" element={<CluckyAI />} />
        <Route path="/chat" element={<ChatSupport />} />
        <Route path="/verifications" element={<VerificationRequests />} />

        {/* SUPPLIER ROUTES */}
        <Route
          path="/supplier-orders"
          element={
            <ProtectedRoute allowedRoles={["supplier"]}>
              <SupplierOrders />
            </ProtectedRoute>
          }
        />

        {/* ADMIN ROUTES */}
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

      {/* =========================
          VET WORKSPACE (isolated shell)
      ========================= */}
      <Route
        path="/vet"
        element={
          <ProtectedRoute allowedRoles={["vet"]}>
            <VetLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<VetDashboard />} />
        <Route path="appointments" element={
          <VetPlaceholderPage title="Appointments" description="Manage your farmer visit schedule." />
        } />
        <Route path="emergency" element={
          <VetPlaceholderPage title="Emergency Requests" description="Urgent cases needing your response." />
        } />
        <Route path="farmers" element={
          <VetPlaceholderPage title="My Farmers" description="Farmers under your care." />
        } />
        <Route path="records" element={
          <VetPlaceholderPage title="Medical Records" description="Diagnosis history and flock records." />
        } />
        <Route path="prescriptions" element={
          <VetPlaceholderPage title="Prescriptions" description="Prescriptions you've issued." />
        } />
        <Route path="vaccinations" element={
          <VetPlaceholderPage title="Vaccination Programs" description="Vaccination schedules you manage." />
        } />
        <Route path="disease-reports" element={
          <VetPlaceholderPage title="Disease Reports" description="Suspected and confirmed disease cases." />
        } />
        <Route path="messages" element={
          <VetPlaceholderPage title="Messages" description="Conversations with your farmers." />
        } />
        <Route path="calendar" element={
          <VetPlaceholderPage title="Calendar" description="Your full booking calendar." />
        } />
        <Route path="payments" element={
          <VetPlaceholderPage title="Payments & Earnings" description="Consultation fees and monthly earnings." />
        } />
        <Route path="analytics" element={
          <VetPlaceholderPage title="Analytics" description="Your performance and caseload insights." />
        } />
        <Route path="profile" element={
          <VetPlaceholderPage title="Profile & Availability" description="Your professional profile and availability." />
        } />
        <Route path="settings" element={
          <VetPlaceholderPage title="Settings" description="Vet workspace preferences." />
        } />
      </Route>

      {/* FALLBACK */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}