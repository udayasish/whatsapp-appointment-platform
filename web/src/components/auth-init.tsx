"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { login, logout } from "@/store/authSlice";
import { authService } from "@/lib/auth-service";

/**
 * Mounted once in layout.tsx.
 * Calls GET /api/admin/auth/me on initial load to check if there's a valid
 * admin_token cookie — if so, hydrates Redux auth state with the user.
 */
export default function AuthInit() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    authService
      .me()
      .then((res) => {
        dispatch(login({ userData: res.user }));
      })
      .catch(() => {
        // No valid cookie — user needs to log in
        dispatch(logout());
      });
  }, [dispatch]);

  return null;
}
