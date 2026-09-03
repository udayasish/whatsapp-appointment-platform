"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { useAppDispatch } from "@/store/hooks";
import { logout } from "@/store/authSlice";
import { ThemeToggle } from "./theme-toggle";
import { LogOut, QrCode, Plus } from "lucide-react";

interface NavbarProps {
  role: "super_admin" | "clinic_admin";
  clinicName?: string;
  doctorSubtitle?: string;
  onAddClinicClick?: () => void;
}

export function Navbar({
  role,
  clinicName = "Sunrise Clinic",
  doctorSubtitle = "Dr. Asha Verma (General Physician)",
  onAddClinicClick,
}: NavbarProps) {
  const dispatch = useAppDispatch();

  const handleSignOut = async () => {
    dispatch(logout());
    await signOut({ callbackUrl: "/login" });
  };

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20 transition-colors">
      {/* Brand & Context */}
      <div className="flex items-center space-x-3.5">
        <div className="w-9 h-9 bg-teal-700 dark:bg-teal-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-xs">
          {role === "super_admin" ? "C" : "🏥"}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <Link
              href={role === "super_admin" ? "/super-admin" : "/dashboard"}
              className="font-bold text-slate-900 dark:text-white text-base tracking-tight hover:opacity-90"
            >
              {role === "super_admin" ? "ClinicConnect" : clinicName}
            </Link>
            {role === "super_admin" ? (
              <span className="bg-purple-50 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Super Admin
              </span>
            ) : (
              <span className="bg-teal-50 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Clinic Admin
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {role === "super_admin"
              ? "Platform Management & Clinic Controls"
              : doctorSubtitle}
          </p>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {role === "super_admin" && onAddClinicClick && (
          <button
            onClick={onAddClinicClick}
            className="bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white font-semibold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Clinic</span>
          </button>
        )}

        {role === "clinic_admin" && (
          <Link
            href="/dashboard/qr"
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold px-3.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition border border-slate-200 dark:border-slate-700"
          >
            <QrCode className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>QR &amp; Standee</span>
          </Link>
        )}

        <div className="h-5 w-[1px] bg-slate-200 dark:bg-slate-800 mx-1"></div>

        <ThemeToggle />

        <button
          onClick={handleSignOut}
          className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-xs font-medium px-2 py-1 flex items-center gap-1 transition cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sign Out</span>
        </button>
      </div>
    </header>
  );
}
