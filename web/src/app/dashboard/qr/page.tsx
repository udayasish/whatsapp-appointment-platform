"use client";

import { useState } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import {
  ArrowLeft,
  Copy,
  Download,
  Printer,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

export default function ClinicQrPage() {
  const [copiedLink, setCopiedLink] = useState(false);
  const deepLink = "https://wa.me/15550001111?text=Hi";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(deepLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success("Click-to-Chat deep link copied to clipboard!");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
      <Navbar
        role="clinic_admin"
        clinicName="Sunrise Clinic"
        doctorSubtitle="Dr. Asha Verma (General Physician) • WhatsApp: +1 (555) 000-1111"
      />

      <main className="max-w-4xl w-full mx-auto p-6 space-y-6 flex-1">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/dashboard"
            className="text-xs font-semibold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Today's Live Queue</span>
          </Link>
        </div>

        {/* Standee & Marketing Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 flex flex-col md:flex-row items-center gap-8 transition-colors">
          {/* Left Frame: Large QR */}
          <div className="w-72 bg-slate-50 dark:bg-slate-800/80 p-6 rounded-3xl border-2 border-dashed border-teal-300 dark:border-teal-700 text-center shadow-xs shrink-0 flex flex-col items-center">
            <div className="w-56 h-56 bg-white p-2 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-center shadow-xs">
              <img
                src="/qr/100000000000001/image?size=500"
                alt="Clinic WhatsApp QR"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="mt-4 inline-flex items-center gap-1.5 bg-emerald-500 text-white font-bold text-xs px-3.5 py-1 rounded-full shadow-xs">
              <Smartphone className="w-3.5 h-3.5" />
              <span>Scan with WhatsApp</span>
            </div>
          </div>

          {/* Right Content */}
          <div className="flex-1 space-y-5">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800">
                Official WhatsApp Booking QR
              </span>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-2 tracking-tight">
                Sunrise Clinic
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                WhatsApp Booking Number:{" "}
                <strong className="text-slate-900 dark:text-white font-mono">
                  +1 (555) 000-1111
                </strong>
              </p>
            </div>

            {/* Click-to-Chat Box */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Direct Click-to-Chat Deep Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={deepLink}
                  className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 outline-none"
                />
                <button
                  onClick={copyToClipboard}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition shadow-xs cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2.5">
              <a
                href="/api/admin/tenants/100000000000001/qr/download?format=png"
                download
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG</span>
              </a>

              <a
                href="/api/admin/tenants/100000000000001/qr/download?format=svg"
                download
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 border border-slate-200 dark:border-slate-700"
              >
                <Download className="w-4 h-4" />
                <span>Download SVG Vector</span>
              </a>

              <a
                href="/qr/100000000000001/poster"
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>Print Counter Standee (A4)</span>
              </a>
            </div>
          </div>
        </div>

        {/* 3 Step Instruction Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 transition-colors">
            <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center border border-teal-200 dark:border-teal-800">
              1
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              Place at Reception Desk
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Print the A4 countertop poster or embed the high-res PNG on your clinic reception standee.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 transition-colors">
            <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center border border-teal-200 dark:border-teal-800">
              2
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              Patient Scans &amp; Sends "Hi"
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Scanning opens WhatsApp directly with "Hi" pre-filled. The automated OPD bot guides booking in 30 seconds.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2 transition-colors">
            <div className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 font-bold text-xs flex items-center justify-center border border-teal-200 dark:border-teal-800">
              3
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
              Instant Queue Sync
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Booked patients receive their token number and appear live on your Clinic Dashboard queue!
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
