"use client";

import { useEffect, useState, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setClinics,
  toggleReminder,
  toggleAlerts,
  toggleStatus,
  addClinic,
} from "@/store/clinicsSlice";
import { clinicsService } from "@/lib/clinics-service";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader } from "@/components/page-header";
import {
  Building2,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Search,
  Plus,
  Copy,
  Download,
  Printer,
  Ban,
  RotateCcw,
  Check,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import type { Clinic } from "@/types/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function SuperAdminPage() {
  const dispatch = useAppDispatch();
  const clinics = useAppSelector((state) => state.clinics.items);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "suspended">("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedQrClinic, setSelectedQrClinic] = useState<Clinic | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [savingClinic, setSavingClinic] = useState(false);

  // Form State for Onboarding
  const [formData, setFormData] = useState({
    name: "",
    whatsappPhoneNumberId: "",
    whatsappDisplayNumber: "",
    doctorName: "",
    specialization: "",
  });

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
    dispatch(toggleReminder(clinic.id));

    try {
      await clinicsService.updateSettings(clinic.id, {
        remindersEnabled: nextState,
      });
      toast.success(
        `24h Reminders ${nextState ? "enabled" : "disabled"} for ${clinic.name}`
      );
    } catch {
      dispatch(toggleReminder(clinic.id));
      toast.error("Failed to update reminder settings");
    }
  };

  const handleToggleAlerts = async (clinic: Clinic) => {
    const nextState = !clinic.notificationsEnabled;
    dispatch(toggleAlerts(clinic.id));

    try {
      await clinicsService.updateSettings(clinic.id, {
        notificationsEnabled: nextState,
      });
      toast.success(
        `Doctor alerts ${nextState ? "enabled" : "disabled"} for ${clinic.name}`
      );
    } catch {
      dispatch(toggleAlerts(clinic.id));
      toast.error("Failed to update alert settings");
    }
  };

  const handleToggleSuspend = async (clinic: Clinic) => {
    const isSuspending = clinic.status === "active";
    const nextStatus = isSuspending ? "suspended" : "active";

    if (
      confirm(
        isSuspending
          ? `Suspend ${clinic.name}?`
          : `Reactivate ${clinic.name}?`
      )
    ) {
      dispatch(toggleStatus(clinic.id));

      try {
        await clinicsService.updateStatus(clinic.id, nextStatus);
        if (isSuspending) {
          toast.warning(`${clinic.name} access suspended.`);
        } else {
          toast.success(`${clinic.name} access reactivated.`);
        }
      } catch {
        dispatch(toggleStatus(clinic.id));
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

  const visibleClinics = useMemo(() => {
    return clinics.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.whatsappDisplayNumber.includes(searchQuery) ||
        (c.doctorName && c.doctorName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        filterStatus === "all" ? true : c.status === filterStatus;

      return matchesSearch && matchesStatus;
    });
  }, [clinics, searchQuery, filterStatus]);

  const activeCount = clinics.filter((c) => c.status === "active").length;
  const suspendedCount = clinics.filter((c) => c.status === "suspended").length;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success("Click-to-Chat deep link copied to clipboard!");
  };

  return (
    <DashboardShell>
      {/* Page Header */}
      <PageHeader>
        <div className="flex flex-1 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">Platform</span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="text-muted-foreground text-xs font-normal">Clinics Directory</span>
            <Badge variant="secondary" className="text-[10px] uppercase font-bold ml-2">
              Super Admin
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clinics, doctors…"
                className="h-8 w-44 sm:w-60 pl-8 text-xs"
              />
            </div>

            <Button
              size="sm"
              className="h-8 gap-1 text-xs font-medium"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="size-3.5" />
              <span>Add Clinic</span>
            </Button>
          </div>
        </div>
      </PageHeader>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="shadow-none border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Partner Clinics</CardTitle>
              <Building2 className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold tracking-tight">{clinics.length}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Registered tenants</p>
            </CardContent>
          </Card>

          <Card className="shadow-none border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Active Clinics</CardTitle>
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
                {activeCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Accepting WhatsApp bookings</p>
            </CardContent>
          </Card>

          <Card className="shadow-none border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-amber-600 dark:text-amber-400">Suspended</CardTitle>
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold tracking-tight text-amber-600 dark:text-amber-400">
                {suspendedCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Access halted</p>
            </CardContent>
          </Card>

          <Card className="shadow-none border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">WhatsApp API</CardTitle>
              <div className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold tracking-tight text-foreground">Active</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Meta Graph API v21.0</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/30 w-fit">
          <Button
            variant={filterStatus === "all" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs px-3 font-medium"
            onClick={() => setFilterStatus("all")}
          >
            All ({clinics.length})
          </Button>
          <Button
            variant={filterStatus === "active" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs px-3 font-medium"
            onClick={() => setFilterStatus("active")}
          >
            Active ({activeCount})
          </Button>
          <Button
            variant={filterStatus === "suspended" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs px-3 font-medium"
            onClick={() => setFilterStatus("suspended")}
          >
            Suspended ({suspendedCount})
          </Button>
        </div>

        {/* Clinics Table matching AbleSpace */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ) : visibleClinics.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <Building2 className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <h3 className="font-semibold text-sm">No Clinics Found</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {searchQuery ? "No clinics match your search query." : "Click '+ Add Clinic' to onboard your first partner clinic."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/40 border-b border-border">
                  <TableHead className="font-semibold text-xs min-w-[200px]">Clinic &amp; Location</TableHead>
                  <TableHead className="font-semibold text-xs min-w-[180px]">Primary Doctor</TableHead>
                  <TableHead className="font-semibold text-xs">WhatsApp Number</TableHead>
                  <TableHead className="font-semibold text-xs text-center w-32">24h Reminders</TableHead>
                  <TableHead className="font-semibold text-xs text-center w-32">Doctor Alerts</TableHead>
                  <TableHead className="font-semibold text-xs w-24">Status</TableHead>
                  <TableHead className="font-semibold text-xs text-right w-44">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleClinics.map((clinic) => {
                  const isActive = clinic.status === "active";

                  return (
                    <TableRow key={clinic.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-8 rounded-lg border border-border">
                            <AvatarFallback className="text-[11px] font-semibold bg-muted text-foreground rounded-lg">
                              {clinic.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-semibold text-xs text-foreground">{clinic.name}</span>
                            <span className="text-[11px] text-muted-foreground">ID: {clinic.id.slice(0, 8)}…</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-foreground">{clinic.doctorName}</span>
                          <span className="text-[11px] text-muted-foreground">{clinic.specialization}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">
                        {clinic.whatsappDisplayNumber}
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={clinic.remindersEnabled}
                          onClick={() => handleToggleReminder(clinic)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            clinic.remindersEnabled ? "bg-primary" : "bg-input"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              clinic.remindersEnabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </TableCell>
                      <TableCell className="text-center">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={clinic.notificationsEnabled}
                          onClick={() => handleToggleAlerts(clinic)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            clinic.notificationsEnabled ? "bg-primary" : "bg-input"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                              clinic.notificationsEnabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </TableCell>
                      <TableCell>
                        {isActive ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-medium">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-medium">
                            Suspended
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs px-2 gap-1"
                            onClick={() => setSelectedQrClinic(clinic)}
                          >
                            <QrCode className="size-3" />
                            <span>QR</span>
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-7 text-xs px-2 ${
                              isActive ? "text-muted-foreground hover:text-destructive" : "text-emerald-600 hover:text-emerald-700"
                            }`}
                            onClick={() => handleToggleSuspend(clinic)}
                          >
                            {isActive ? (
                              <>
                                <Ban className="size-3 mr-1" />
                                Suspend
                              </>
                            ) : (
                              <>
                                <RotateCcw className="size-3 mr-1" />
                                Reactivate
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Onboard New Clinic Modal Dialog (AbleSpace style) */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveClinic}>
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Onboard New Clinic</DialogTitle>
              <DialogDescription className="text-xs">
                Register a healthcare tenant and configure its WhatsApp bot.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3.5 py-4">
              <div className="grid gap-1.5">
                <Label htmlFor="clinic-name" className="text-xs">Clinic Name</Label>
                <Input
                  id="clinic-name"
                  required
                  placeholder="e.g. Brahmaputra Heart & Care"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="grid gap-1.5">
                  <Label htmlFor="doc-name" className="text-xs">Doctor Name</Label>
                  <Input
                    id="doc-name"
                    required
                    placeholder="Dr. Dipankar Sarma"
                    value={formData.doctorName}
                    onChange={(e) => setFormData({ ...formData, doctorName: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="specialization" className="text-xs">Specialization</Label>
                  <Input
                    id="specialization"
                    placeholder="Cardiologist"
                    value={formData.specialization}
                    onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="wa-display" className="text-xs">WhatsApp Display Number</Label>
                <Input
                  id="wa-display"
                  required
                  placeholder="+91 98765 43210"
                  value={formData.whatsappDisplayNumber}
                  onChange={(e) => setFormData({ ...formData, whatsappDisplayNumber: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Patients will chat with this phone number</span>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="wa-id" className="text-xs">WhatsApp Phone Number ID (Meta)</Label>
                <Input
                  id="wa-id"
                  required
                  placeholder="109283746592817"
                  value={formData.whatsappPhoneNumberId}
                  onChange={(e) => setFormData({ ...formData, whatsappPhoneNumberId: e.target.value })}
                  className="h-8 text-xs font-mono"
                />
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-2.5 flex items-start gap-2">
                <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
                <p className="text-[11px] text-muted-foreground leading-snug">
                  <strong className="text-foreground font-medium">Automatic Provisioning:</strong> Creates the clinic admin login (<code className="font-mono text-[10px]">admin@clinic.com</code> / <code className="font-mono text-[10px]">Password@123</code>) and generates WhatsApp QR standees.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={savingClinic}
                className="h-8 text-xs font-medium"
              >
                {savingClinic ? "Registering…" : "Register & Activate Clinic"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR & Standee Modal Dialog */}
      {selectedQrClinic && (
        <Dialog open={!!selectedQrClinic} onOpenChange={() => setSelectedQrClinic(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">{selectedQrClinic.name} — QR Code</DialogTitle>
              <DialogDescription className="text-xs">
                Scan with WhatsApp to test or download high-resolution marketing assets.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center justify-center p-4">
              <div className="p-3 bg-white rounded-xl border border-border shadow-xs">
                <img
                  src={`http://127.0.0.1:3000/qr/${selectedQrClinic.id}/image`}
                  alt="WhatsApp QR Code"
                  className="w-48 h-48 object-contain"
                />
              </div>

              <div className="mt-3 text-center">
                <p className="text-xs font-semibold text-foreground">{selectedQrClinic.doctorName}</p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {selectedQrClinic.whatsappDisplayNumber}
                </p>
              </div>
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 gap-1"
                onClick={() => copyToClipboard(selectedQrClinic.waMeUrl ?? "")}
              >
                {copiedLink ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}

                Copy Link
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs flex-1 gap-1"
                asChild
              >
                <a
                  href={`http://127.0.0.1:3000/api/admin/tenants/${selectedQrClinic.id}/qr/download?format=png`}
                  download
                >
                  <Download className="size-3.5" />
                  Download PNG
                </a>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardShell>
  );
}
