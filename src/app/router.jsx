import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import AppLayout from "../layouts/AppLayout";

import Login from "../pages/public/Login";
import Signup from "../pages/public/Signup";

import Dashboard from "../pages/app/Dashboard";
import AskVet from "../pages/app/AskVet";

import Profile from "../pages/app/Profile";
import MyAppointments from "../components/askvet/MyAppointments";

import ProtectedRoute from "../components/auth/ProtectedRoute";

function AppRouter() {
  return (
    <BrowserRouter>

      <Routes>

        {/* ROOT */}
        <Route
          path="/"
          element={<Navigate to="/login" />}
        />

        {/* PUBLIC */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* PROTECTED APP */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >

          <Route
            path="dashboard"
            element={<Dashboard />}
          />

          <Route
            path="ask-vet"
            element={<AskVet />}
          />

          <Route
            path="appointments"
            element={<MyAppointments />}
          />

          <Route
            path="profile"
            element={<Profile />}
          />

          <Route
            path="suppliers"
            element={
              <div className="bg-white p-6 rounded-2xl border">
                Suppliers page coming soon
              </div>
            }
          />

        </Route>

      </Routes>

    </BrowserRouter>
  );
}

export default AppRouter;