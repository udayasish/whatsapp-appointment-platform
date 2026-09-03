// web/src/lib/auth-service.ts
import { apiFetch } from "./api";
import type { User } from "@/types/api";

interface LoginResponse {
  ok: boolean;
  user: User;
}

interface MeResponse {
  user: User;
}

export const authService = {
  /**
   * POST /api/admin/auth/login
   * Sends credentials to Express; on success the backend sets the httpOnly "admin_token" cookie.
   */
  login: (email: string, password: string) =>
    apiFetch<LoginResponse>("/api/admin/auth/login", {
      method: "POST",
      body: { email, password },
      credentials: "include",
    }),

  /**
   * POST /api/admin/auth/logout
   * Clears the httpOnly admin_token cookie on the Express side.
   */
  logout: () =>
    apiFetch<{ ok: boolean }>("/api/admin/auth/logout", {
      method: "POST",
      credentials: "include",
    }),

  /**
   * GET /api/admin/auth/me
   * Returns the currently logged-in admin user using the existing httpOnly cookie.
   * Used on every page load to restore Redux auth state.
   */
  me: () =>
    apiFetch<MeResponse>("/api/admin/auth/me", {
      credentials: "include",
    }),
};
