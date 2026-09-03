"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setQueue,
  markDone,
  markNoShow,
  setSelectedDate,
} from "@/store/queueSlice";
import { queueService } from "@/lib/queue-service";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader } from "@/components/page-header";
import {
  CheckCircle2,
  Clock,
  UserX,
  Copy,
  Printer,
  Search,
  MoreHorizontal,
  QrCode,
  Calendar,
  Check,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function ClinicDashboardPage() {
  const dispatch = useAppDispatch();
  const userData = useAppSelector((state) => state.auth.userData);
  const queue = useAppSelector((state) => state.queue.items);
  const selectedDate = useAppSelector((state) => state.queue.selectedDate);

  const [loadingQueue, setLoadingQueue] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const tenantId = userData?.tenantId || "100000000000001";
  const clinicName = userData?.name ? `${userData.name.replace(" Admin", "")}` : "Sunrise Clinic";

  const getDateString = (dateKey: string) => {
    const d = new Date();
    if (dateKey === "tomorrow") {
      d.setDate(d.getDate() + 1);
    } else if (dateKey === "day3") {
      d.setDate(d.getDate() + 2);
    }
    return d.toISOString().split("T")[0];
  };

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
    dispatch(markDone(id));
    toast.success(`Token #${token} marked as Completed ✓`);

    try {
      await queueService.updateStatus(id, "completed");
    } catch {
      toast.error("Failed to update status on server");
    }
  };

  const handleMarkNoShow = async (id: string, token: number) => {
    dispatch(markNoShow(id));
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

  const visibleQueue = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return queue;
    return queue.filter(
      (item) =>
        item.patientName.toLowerCase().includes(q) ||
        item.tokenNumber.toString().includes(q) ||
        item.patientPhone.includes(q)
    );
  }, [queue, searchQuery]);

  const totalCount = queue.length;
  const completedCount = queue.filter((q) => q.status === "completed").length;
  const waitingCount = queue.filter((q) => q.status === "booked").length;
  const noShowCount = queue.filter((q) => q.status === "noshow").length;

  const waMeLink = "https://wa.me/919876543210?text=Hi";

  return (
    <DashboardShell>
      {/* Page Header matching AbleSpace */}
      <PageHeader>
        <div className="flex flex-1 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{clinicName}</span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="text-muted-foreground text-xs font-normal">Live OPD Queue</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 ml-2">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient, token, phone…"
                className="h-8 w-44 sm:w-60 pl-8 text-xs"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => copyToClipboard(waMeLink)}
            >
              {copiedLink ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              <span className="hidden sm:inline">WhatsApp Link</span>
            </Button>

            <Button variant="outline" size="sm" asChild className="h-8 gap-1 text-xs">
              <Link href="/dashboard/qr">
                <QrCode className="size-3.5" />
                <span className="hidden sm:inline">Standee &amp; QR</span>
              </Link>
            </Button>
          </div>
        </div>
      </PageHeader>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col gap-5 p-4 sm:p-6">
        {/* Metric Summary Cards matching AbleSpace */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="shadow-none border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Booked</CardTitle>
              <Clock className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold tracking-tight">{totalCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Scheduled for today</p>
            </CardContent>
          </Card>

          <Card className="shadow-none border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-amber-600 dark:text-amber-400">Waiting</CardTitle>
              <div className="size-2 rounded-full bg-amber-500" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold tracking-tight text-amber-600 dark:text-amber-400">
                {waitingCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Currently in queue</p>
            </CardContent>
          </Card>

          <Card className="shadow-none border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Completed</CardTitle>
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400">
                {completedCount}
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Consultations done</p>
            </CardContent>
          </Card>

          <Card className="shadow-none border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground">No-Show</CardTitle>
              <UserX className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-2xl font-semibold tracking-tight">{noShowCount}</div>
              <p className="text-[11px] text-muted-foreground mt-0.5">Did not attend</p>
            </CardContent>
          </Card>
        </div>

        {/* Date Tabs & Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-border p-1 bg-muted/30">
            <Button
              variant={selectedDate === "today" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3 font-medium"
              onClick={() => dispatch(setSelectedDate("today"))}
            >
              Today
            </Button>
            <Button
              variant={selectedDate === "tomorrow" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3 font-medium"
              onClick={() => dispatch(setSelectedDate("tomorrow"))}
            >
              Tomorrow
            </Button>
            <Button
              variant={selectedDate === "day3" ? "secondary" : "ghost"}
              size="sm"
              className="h-7 text-xs px-3 font-medium"
              onClick={() => dispatch(setSelectedDate("day3"))}
            >
              Day 3
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              Print List
            </Button>
          </div>
        </div>

        {/* High-Density Patient Queue Table matching AbleSpace */}
        {loadingQueue ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
            <Skeleton className="h-12 w-full rounded-md" />
          </div>
        ) : visibleQueue.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <Clock className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <h3 className="font-semibold text-sm">No Appointments Scheduled</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              No patients booked for this date yet. Share your clinic WhatsApp link or print the QR standee to receive bookings.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent bg-muted/40 border-b border-border">
                  <TableHead className="w-16 font-semibold text-xs">Token</TableHead>
                  <TableHead className="font-semibold text-xs min-w-[180px]">Patient Details</TableHead>
                  <TableHead className="font-semibold text-xs">Contact</TableHead>
                  <TableHead className="font-semibold text-xs">Time Slot</TableHead>
                  <TableHead className="font-semibold text-xs min-w-[200px]">Complaint / Symptoms</TableHead>
                  <TableHead className="font-semibold text-xs w-28">Status</TableHead>
                  <TableHead className="font-semibold text-xs text-right w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleQueue.map((patient) => {
                  const isDone = patient.status === "completed";
                  const isNoShow = patient.status === "noshow";

                  return (
                    <TableRow key={patient.id} className="border-b border-border hover:bg-muted/40 transition-colors">
                      <TableCell className="font-mono font-semibold text-sm">
                        #{patient.tokenNumber}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-7 rounded-full border border-border">
                            <AvatarFallback className="text-[10px] font-semibold bg-muted text-foreground">
                              {patient.patientName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-medium text-xs text-foreground">{patient.patientName}</span>
                            <span className="text-[11px] text-muted-foreground">{patient.patientAge} years</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">
                        {patient.patientPhone}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="size-3 text-muted-foreground" />
                          {patient.timeSlot}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-xs">
                        {patient.complaint}
                      </TableCell>
                      <TableCell>
                        {isDone ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 text-[10px] font-medium">
                            Completed ✓
                          </Badge>
                        ) : isNoShow ? (
                          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px] font-medium">
                            No-Show
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 text-[10px] font-medium">
                            Waiting
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!isDone && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs px-2.5 border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                              onClick={() => handleMarkDone(patient.id, patient.tokenNumber)}
                            >
                              Done
                            </Button>
                          )}
                          {!isDone && !isNoShow && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2 text-muted-foreground hover:text-destructive"
                              onClick={() => handleMarkNoShow(patient.id, patient.tokenNumber)}
                            >
                              No-Show
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="size-7 text-muted-foreground">
                                <MoreHorizontal className="size-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="text-xs">
                              <DropdownMenuItem onClick={() => handleMarkDone(patient.id, patient.tokenNumber)}>
                                Mark as Completed
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleMarkNoShow(patient.id, patient.tokenNumber)}>
                                Mark as No-Show
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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
    </DashboardShell>
  );
}
