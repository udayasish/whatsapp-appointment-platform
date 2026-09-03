"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setClinics,
  toggleReminder,
  toggleAlerts,
  toggleStatus,
  addClinic,
} from "@/store/clinicsSlice";
import { clinicsService } from "@/lib/clinics-service";
import { Navbar } from "@/components/navbar";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  CalendarDays,
  QrCode,
  Search,
  X,
  Copy,
  Download,
  Printer,
  Ban,
  RotateCcw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { Clinic } from "@/types/api";

export default function SuperAdminPage() {
  const dispatch = useAppDispatch();
  const clinics = useAppSelector((state) => state.clinics.items);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedQrClinic, setSelectedQrClinic] = useState<Clinic | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [savingClinic, setSavingClinic] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    whatsappPhoneNumberId: "",
    whatsappDisplayNumber: "",
    doctorName: "",
    specialization: "",
  });

  // Fetch real clinics from Node.js backend on mount
  useEffect(() => {
    clinicsService
      .list()
      .then((data) => {
        if (data && Array.isArray(data)) {
          dispatch(setClinics(data));
        }
      })
      .catch((err) => {
        console.error("Failed to load clinics:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [dispatch]);

  const handleToggleReminder = async (clinic: Clinic) => {
    const nextState = !clinic.remindersEnabled;
    dispatch(toggleReminder(clinic.id)); // optimistic update

    try {
      await clinicsService.updateSettings(clinic.id, {
        remindersEnabled: nextState,
      });
      toast.success(
        `24h Reminders ${nextState ? "enabled" : "disabled"} for ${clinic.name}`
      );
    } catch {
      dispatch(toggleReminder(clinic.id)); // rollback
      toast.error("Failed to update reminder settings");
    }
  };

  const handleToggleAlerts = async (clinic: Clinic) => {
    const nextState = !clinic.notificationsEnabled;
    dispatch(toggleAlerts(clinic.id)); // optimistic update

    try {
      await clinicsService.updateSettings(clinic.id, {
        notificationsEnabled: nextState,
      });
      toast.success(
        `Doctor alerts ${nextState ? "enabled" : "disabled"} for ${clinic.name}`
      );
    } catch {
      dispatch(toggleAlerts(clinic.id)); // rollback
      toast.error("Failed to update alert settings");
    }
  };

  const handleToggleSuspend = async (clinic: Clinic) => {
    const isSuspending = clinic.status === "active";
    const nextStatus = isSuspending ? "suspended" : "active";

    if (
      confirm(
        isSuspending
          ? `Are you sure you want to suspend access for ${clinic.name}? WhatsApp appointments will be disabled.`
          : `Reactivate access for ${clinic.name}?`
      )
    ) {
      dispatch(toggleStatus(clinic.id)); // optimistic update

      try {
        await clinicsService.updateStatus(clinic.id, nextStatus);
        if (isSuspending) {
          toast.warning(`${clinic.name} access suspended.`);
        } else {
          toast.success(`${clinic.name} access reactivated.`);
        }
      } catch {
        dispatch(toggleStatus(clinic.id)); // rollback
        toast.error("Failed to update clinic status");
      }
    }
  };

  const handleSaveClinic = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingClinic(true);

    try {
      const created = await clinicsService.create(formData);
      dispatch(addClinic(created));
      setIsAddModalOpen(false);
      setFormData({
        name: "",
        whatsappPhoneNumberId: "",
        whatsappDisplayNumber: "",
        doctorName: "",
        specialization: "",
      });
      toast.success(`${created.name} registered and activated successfully!`);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : "Failed to register clinic";
      toast.error(errorMsg);
    } finally {
      setSavingClinic(false);
    }
  };

  const filteredClinics = clinics.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.whatsappDisplayNumber.includes(searchQuery)
  );

  const activeCount = clinics.filter((c) => c.status === "active").length;
  const suspendedCount = clinics.filter((c) => c.status === "suspended").length;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success("Click-to-Chat deep link copied to clipboard!");
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors">
      <Navbar
        role="super_admin"
        onAddClinicClick={() => setIsAddModalOpen(true)}
      />

      <main className="max-w-6xl w-full mx-auto p-6 space-y-6 flex-1">
        {/* Metric Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <span>Active Clinics</span>
              <Building2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white flex items-baseline gap-2.5">
              <span>{activeCount}</span>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 border border-emerald-200 dark:border-emerald-800 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                100% Operational
              </span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <span>Suspended / Revoked</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-white">
              {suspendedCount}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs transition-colors">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              <span>Total Bookable Slots</span>
              <CalendarDays className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            </div>
            <div className="text-3xl font-bold text-teal-700 dark:text-teal-400">
              568
            </div>
          </div>
        </div>

        {/* Registered Clinics Table */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden transition-colors">
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white text-base tracking-tight">
                Registered Clinics
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage WhatsApp connectivity, automated reminders and access controls
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clinic or phone..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-teal-700 dark:focus:ring-teal-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>

          <div className="overflow-x-auto">
            {loading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                <span className="text-xs">Loading clinics from database...</span>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50/75 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                    <th className="py-3 px-6">Clinic &amp; WhatsApp</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">24h Reminders</th>
                    <th className="py-3 px-4 text-center">Doctor Alerts</th>
                    <th className="py-3 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {filteredClinics.map((clinic) => (
                    <tr
                      key={clinic.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-4 px-6">
                        <div className="font-semibold text-slate-900 dark:text-white text-sm">
                          {clinic.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5 font-mono">
                          <span
                            className={`inline-block w-1.5 h-1.5 rounded-full ${
                              clinic.status === "active"
                                ? "bg-emerald-500"
                                : "bg-amber-500"
                            }`}
                          />
                          <span>{clinic.whatsappDisplayNumber}</span>
                          <span className="text-slate-300 dark:text-slate-600">
                            •
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">
                            ID: {clinic.whatsappPhoneNumberId}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4">
                        {clinic.status === "active" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <label className="switch inline-block">
                          <input
                            type="checkbox"
                            checked={clinic.remindersEnabled}
                            onChange={() => handleToggleReminder(clinic)}
                          />
                          <span className="slider" />
                        </label>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <label className="switch inline-block">
                          <input
                            type="checkbox"
                            checked={clinic.notificationsEnabled}
                            onChange={() => handleToggleAlerts(clinic)}
                          />
                          <span className="slider" />
                        </label>
                      </td>
                      <td className="py-4 px-6 text-right space-x-2">
                        <button
                          onClick={() => setSelectedQrClinic(clinic)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-50 dark:bg-teal-950/80 text-teal-800 dark:text-teal-200 hover:bg-teal-100 dark:hover:bg-teal-900 border border-teal-200 dark:border-teal-800 transition cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>View QR</span>
                        </button>
                        <button
                          onClick={() => handleToggleSuspend(clinic)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                            clinic.status === "active"
                              ? "text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border-slate-200 dark:border-slate-700"
                              : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800"
                          }`}
                        >
                          {clinic.status === "active" ? (
                            <>
                              <Ban className="w-3.5 h-3.5" />
                              <span>Suspend</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reactivate</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>

      {/* MODAL: ADD NEW CLINIC */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 modal-blur z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                  Add New Clinic
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Connect a new WhatsApp number and clinic doctor profile
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveClinic} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Clinic Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Apex Health Clinic"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-700 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Meta Phone Number ID
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1209654505573202"
                    value={formData.whatsappPhoneNumberId}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        whatsappPhoneNumberId: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm font-mono focus:ring-2 focus:ring-teal-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    WhatsApp Display Number
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. +91 70020 59544"
                    value={formData.whatsappDisplayNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        whatsappDisplayNumber: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-700 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Doctor Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Rajesh Sharma"
                    value={formData.doctorName}
                    onChange={(e) =>
                      setFormData({ ...formData, doctorName: e.target.value })
                    }
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-700 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Specialization
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. General Physician"
                    value={formData.specialization}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        specialization: e.target.value,
                      })
                    }
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-teal-700 outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingClinic}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white transition shadow-xs cursor-pointer flex items-center gap-1"
                >
                  {savingClinic && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save &amp; Activate Clinic</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: VIEW QR */}
      {selectedQrClinic && (
        <div className="fixed inset-0 bg-slate-950/60 modal-blur z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl max-w-lg w-full p-6 transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {selectedQrClinic.name} — WhatsApp QR
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {selectedQrClinic.whatsappDisplayNumber}
                </p>
              </div>
              <button
                onClick={() => setSelectedQrClinic(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col items-center space-y-4 py-2">
              <div className="w-48 h-48 bg-white p-2 rounded-2xl border-2 border-dashed border-teal-300 dark:border-teal-700 flex items-center justify-center shadow-xs">
                <img
                  src={`/qr/${selectedQrClinic.id}/image?size=400`}
                  alt="Clinic QR Code"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="w-full space-y-1.5">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Direct Click-to-Chat Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={`https://wa.me/${selectedQrClinic.whatsappDisplayNumber.replace(/[^0-9]/g, "")}?text=Hi`}
                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs text-slate-700 dark:text-slate-300 outline-none"
                  />
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `https://wa.me/${selectedQrClinic.whatsappDisplayNumber.replace(/[^0-9]/g, "")}?text=Hi`
                      )
                    }
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-teal-600 dark:hover:bg-teal-700 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>{copiedLink ? "Copied!" : "Copy"}</span>
                  </button>
                </div>
              </div>

              <div className="w-full pt-2 flex flex-wrap gap-2 justify-center">
                <a
                  href={`/qr/${selectedQrClinic.id}/download?format=png`}
                  download
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>PNG</span>
                </a>
                <a
                  href={`/qr/${selectedQrClinic.id}/download?format=svg`}
                  download
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1 border border-slate-200 dark:border-slate-700 transition"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>SVG</span>
                </a>
                <a
                  href={`/qr/${selectedQrClinic.id}/poster`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-teal-700 hover:bg-teal-800 dark:bg-teal-600 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition shadow-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Standee</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
