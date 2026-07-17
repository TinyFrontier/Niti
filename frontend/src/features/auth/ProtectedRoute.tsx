import { Navigate, Outlet } from "react-router-dom";
import { tokenStorage } from "@/shared/api/client";

export function ProtectedRoute() {
  if (!tokenStorage.get()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
