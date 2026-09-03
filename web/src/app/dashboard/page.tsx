"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setQueue,
  markDone,
  markNoShow,
  setSelectedDate,
} from "@/store/queueSlice";
import { queueService } from "@/lib/queue-service";
import { Navbar } from "@/components/navbar";
import {
  CheckCircle2,
  Clock,
  UserX,
  Copy,
  Download,
  Printer,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

export default function ClinicDashboardPage() {
  const dispatch = useAppDispatch();
  const userData = useAppSelector((state) => state.auth.userData);
  const queue = useAppSelector((state) => state.queue.items);
  const selectedDate = useAppSelector((state) => state.queue.selectedDate);

  const [loadingQueue, setLoadingQueue] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Tenant ID from Redux auth or default to Sunrise Clinic
  const tenantId = userData?.tenantId || "100000000000001";

  // Helper to compute date string
  const getDateString = (dateKey: string) => {
    const d = new Date();
    if (dateKey === "tomorrow") {
      d.setDate(d.getDate() + 1);
    } else if (dateKey === "day3") {
      d.setDate(d.getDate() + 2);
    }
    return d.toISOString().split("T")[0];
  };

  // Fetch live queue from backend API on mount / date change
  useEffect(() => {
    if (!tenantId) return;
    const dateStr = getDateString(selectedDate);

    setLoadingQueue(true);
    queueService
      .list(tenantId, dateStr)
      .then((data) => {
        if (data && Array.isArray(data) && data.length > 0) {
          dispatch(setQueue(data));
        }
      })
      .catch((err) => {
        console.error("Queue load info:", err);
      })
      .finally(() => {
        setLoadingQueue(false);
      });
  }, [tenantId, selectedDate, dispatch]);

  const handleMarkDone = async (id: string, token: number) => {
    dispatch(markDone(id)); // optimistic update
    toast.success(`Token #${token} marked as Completed ✓`);

    try {
      await queueService.updateStatus(id, "completed");
    } catch {
      toast.error("Failed to update status on server");
    }
  };

  const handleMarkNoShow = async (id: string, token: number) => {
    dispatch(markNoShow(id)); // optimistic update
    toast.warning(`Token #${token} marked as No-Show`);

    try {
      await queueService.updateStatus(id, "noshow");
    } catch {
      toast.error("Failed to update status on server");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success("Click-to-Chat deep link copied to clipboard!");
  };

  const totalCount = queue.length;
  const completedCount = queue.filter((q) => q.status === "completed").length;
  const waitingCount = queue.filter((q) => q.status === "booked").length;
  const noShowCount = queue.filter((q) => q.status === "noshow").length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
      <Navbar
        role="clinic_admin"
        clinicName={userData?.name ? `${userData.name.replace(" Admin", "")}` : "Sunrise Clinic"}
        doctorSubtitle="Dr. Asha Verma (General Physician) • WhatsApp: +1 (555) 000-1111"
      />

      <main className="max-w-6xl w-full mx-auto p-6 space-y-6 flex-1">
        {/* Schedule Date & Overview Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">
              Schedule:
            </span>
            <button
              onClick={() => dispatch(setSelectedDate("today"))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                selectedDate === "today"
                  ? "bg-teal-700 dark:bg-teal-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => dispatch(setSelectedDate("tomorrow"))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedDate === "tomorrow"
                  ? "bg-teal-700 dark:bg-teal-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              Tomorrow
            </button>
            <button
              onClick={() => dispatch(setSelectedDate("day3"))}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedDate === "day3"
                  ? "bg-teal-700 dark:bg-teal-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              }`}
            >
              Day 3
            </button>
          </div>

          <div className="flex items-center space-x-4 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>
              Total:{" "}
              <strong className="text-slate-900 dark:text-white">
                {totalCount} Booked
              </strong>
            </span>
            <span>•</span>
            <span className="text-emerald-700 dark:text-emerald-400">
              Done: <strong>{completedCount}</strong>
            </span>
            <span>•</span>
            <span className="text-blue-700 dark:text-blue-400">
              Waiting: <strong>{waitingCount}</strong>
            </span>
            {noShowCount > 0 && (
              <>
                <span>•</span>
                <span className="text-rose-600 dark:text-rose-400">
                  No-Show: <strong>{noShowCount}</strong>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Main Grid: Live Queue + Side Marketing Hub */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Live Patient Queue (2-cols) */}
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                  Today's Live Queue
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time WhatsApp OPD patient sequence
                </p>
              </div>
              <span className="text-[11px] bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-300 font-semibold px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-400" />
                Live Sync
              </span>
            </div>

            <div className="overflow-x-auto">
              {loadingQueue ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                  <span className="text-xs">Loading live appointments queue...</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <th className="py-3 px-5 w-16 text-center">Token</th>
                      <th className="py-3 px-4">Patient Name &amp; Age</th>
                      <th className="py-3 px-4">Time</th>
                      <th className="py-3 px-4">Chief Complaint</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-5 text-right">Quick Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {queue.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition ${
                          item.status === "booked" && item.tokenNumber === 2
                            ? "bg-teal-50/30 dark:bg-teal-950/20"
                            : ""
                        }`}
                      >
                        <td className="py-4 px-5 text-center">
                          <span
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs ${
                              item.status === "completed"
                                ? "bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300"
                                : item.status === "noshow"
                                ? "bg-slate-100 dark:bg-slate-800 text-slate-500"
                                : "bg-teal-700 dark:bg-teal-600 text-white shadow-xs"
                            }`}
                          >
                            #{item.tokenNumber}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-semibold text-slate-900 dark:text-white">
                          {item.patientName}
                          <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">
                            Age: {item.patientAge} • {item.patientPhone}
                          </span>
                        </td>
                        <td className="py-4 px-4 font-medium text-slate-900 dark:text-white text-xs">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{item.timeSlot}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-xs text-slate-600 dark:text-slate-300">
                          {item.complaint}
                        </td>
                        <td className="py-4 px-4">
                          {item.status === "completed" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              Completed ✓
                            </span>
                          )}
                          {item.status === "booked" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              Waiting
                            </span>
                          )}
                          {item.status === "noshow" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              No-Show
                            </span>
                          )}
                        </td>
                        <td className="py-4 px-5 text-right">
                          {item.status === "booked" ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() =>
                                  handleMarkDone(item.id, item.tokenNumber)
                                }
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-xs flex items-center gap-1 cursor-pointer"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Done</span>
                              </button>
                              <button
                                onClick={() =>
                                  handleMarkNoShow(item.id, item.tokenNumber)
                                }
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                              >
                                <UserX className="w-3 h-3" />
                                <span>No-Show</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-slate-500">
                              Closed
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Panel: WhatsApp QR & Standee Hub */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs p-6 flex flex-col justify-between space-y-6 transition-colors">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/80 px-2.5 py-1 rounded-full border border-teal-200 dark:border-teal-800">
                  Marketing &amp; QR Hub
                </span>
                <Link
                  href="/dashboard/qr"
                  className="text-xs text-teal-700 dark:text-teal-400 hover:underline font-semibold"
                >
                  Full View &rarr;
                </Link>
              </div>

              <div className="w-44 h-44 bg-white p-2 rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-700 mx-auto flex items-center justify-center shadow-xs mb-4">
                <img
                  src={`/qr/${tenantId}/image?size=400`}
                  alt="Clinic WhatsApp QR"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="text-center space-y-1 mb-4">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  Sunrise Clinic WhatsApp
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  +1 (555) 000-1111
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Deep Link
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value="https://wa.me/15550001111?text=Hi"
                    className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-[11px] text-slate-700 dark:text-slate-300 outline-none"
                  />
                  <button
                    onClick={() =>
                      copyToClipboard("https://wa.me/15550001111?text=Hi")
                    }
                    className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedLink ? "✓" : "Copy"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <a
                href={`/qr/${tenantId}/poster`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-2 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Counter Standee (A4)</span>
              </a>

              <div className="grid grid-cols-2 gap-2">
                <a
                  href={`/qr/${tenantId}/download?format=png`}
                  download
                  className="py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PNG</span>
                </a>
                <a
                  href={`/qr/${tenantId}/download?format=svg`}
                  download
                  className="py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg flex items-center justify-center gap-1 border border-slate-200 dark:border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>SVG</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
