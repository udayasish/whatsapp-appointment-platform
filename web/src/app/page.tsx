import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShieldCheck, UserCheck, ArrowRight, Sparkles } from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50 dark:bg-slate-950 transition-colors p-6">
      {/* Top Navbar */}
      <div className="flex justify-between items-center max-w-5xl w-full mx-auto py-2">
        <div className="flex items-center space-x-2.5 font-bold text-slate-900 dark:text-white tracking-tight">
          <div className="w-8 h-8 bg-teal-700 dark:bg-teal-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-xs">
            🏥
          </div>
          <span className="text-lg">ClinicConnect</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Hero Section */}
      <main className="max-w-3xl w-full mx-auto my-auto text-center space-y-8 py-12">
        <div className="inline-flex items-center gap-2 bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 text-xs font-semibold px-3.5 py-1.5 rounded-full shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>NextAuth Database Auth • Redux Toolkit • Tailwind CSS</span>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight">
            WhatsApp OPD &amp; Appointment <br className="hidden sm:inline" />
            <span className="text-teal-700 dark:text-teal-400">Management Platform</span>
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
            Lightweight, high-speed multi-tenant platform for clinics. Seamless WhatsApp booking, live patient queues, and instant QR standees.
          </p>
        </div>

        {/* Portals Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto text-left pt-4">
          {/* Super Admin */}
          <Link
            href="/login"
            className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 shadow-sm hover:shadow-md transition space-y-3"
          >
            <div className="w-10 h-10 bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300 rounded-xl flex items-center justify-center border border-purple-200 dark:border-purple-800">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Super Admin Portal</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Add clinics, manage 24h reminders, doctor alerts &amp; revoke access.
              </p>
            </div>
          </Link>

          {/* Clinic Admin */}
          <Link
            href="/login"
            className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-teal-500 dark:hover:border-teal-500 shadow-sm hover:shadow-md transition space-y-3"
          >
            <div className="w-10 h-10 bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 rounded-xl flex items-center justify-center border border-teal-200 dark:border-teal-800">
              <UserCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Clinic Admin Portal</span>
                <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-teal-600 group-hover:translate-x-0.5 transition" />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Live patient OPD queue, token actions &amp; counter standee hub.
              </p>
            </div>
          </Link>
        </div>

        <div className="pt-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white text-xs font-semibold shadow-xs transition"
          >
            <span>Proceed to Sign In</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-400 dark:text-slate-600 py-2">
        ClinicConnect &copy; {new Date().getFullYear()} — Built with Next.js &amp; Tailwind CSS
      </footer>
    </div>
  );
}
