import React from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {

  // SIMPLE AUTH CHECK
  const user = localStorage.getItem("fc_user");

  // NOT LOGGED IN
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // LOGGED IN
  return children;
}