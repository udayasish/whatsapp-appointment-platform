"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { useAppDispatch } from "@/store/hooks";
import { login } from "@/store/authSlice";
import { ThemeToggle } from "@/components/theme-toggle";
import { Lock, Mail, ArrowRight, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AdminRole } from "@/types/api";

export default function LoginPage() {
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (res?.error || !res?.ok) {
        setErrorMsg("Invalid email or password. Please check your credentials.");
        toast.error("Invalid email or password");
        setLoading(false);
        return;
      }

      // Retrieve session to check user role
      const session = await getSession();
      const user = session?.user as {
        id?: string;
        email?: string;
        name?: string;
        role?: AdminRole;
        tenantId?: string | null;
      };

      if (user) {
        dispatch(
          login({
            userData: {
              id: user.id || "user-id",
              email: user.email || email,
              name: user.name || "User",
              role: user.role || "clinic_admin",
              tenantId: user.tenantId || null,
              status: "active",
            },
          })
        );

        toast.success(`Welcome back, ${user.name || "User"}!`);

        if (user.role === "super_admin") {
          router.push("/super-admin");
        } else {
          router.push("/dashboard");
        }
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      console.error("Login error:", err);
      setErrorMsg("An unexpected error occurred. Please try again.");
      toast.error("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 transition-colors p-4">
      {/* Top Bar */}
      <div className="flex justify-between items-center max-w-5xl w-full mx-auto py-2">
        <div className="flex items-center space-x-2 font-bold text-slate-900 dark:text-white tracking-tight">
          <div className="w-7 h-7 bg-teal-700 dark:bg-teal-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-xs">
            🏥
          </div>
          <span>ClinicConnect</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Main Authentication Card */}
      <div className="max-w-md w-full mx-auto my-auto py-8">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none p-8 transition-colors">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 rounded-2xl mx-auto flex items-center justify-center mb-3.5 shadow-xs">
              <span className="text-2xl">🏥</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Sign In
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Enter your credentials to access the clinic or platform dashboard
            </p>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@clinic.com"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-700 dark:focus:ring-teal-500 outline-none transition"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-700 dark:focus:ring-teal-500 outline-none transition"
                />
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg text-sm transition shadow-xs flex items-center justify-center gap-2 mt-2 cursor-pointer disabled:opacity-70"
            >
              {loading ? "Verifying..." : "Sign In"}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>

          {/* Seeded Credentials Helper Note */}
          <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Default Database Accounts (Password: Password@123)</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl space-y-1 font-mono text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <div>
                <strong className="text-purple-600 dark:text-purple-400">Super Admin:</strong> superadmin@clinicconnect.com
              </div>
              <div>
                <strong className="text-teal-600 dark:text-teal-400">Clinic Admin:</strong> admin@sunriseclinic.com
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-600 py-2">
        ClinicConnect &copy; {new Date().getFullYear()} — Multi-tenant WhatsApp OPD Platform
      </div>
    </div>
  );
}
