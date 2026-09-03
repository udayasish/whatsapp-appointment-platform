"use client";

import { useState } from "react";
import Link from "next/link";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHeader } from "@/components/page-header";
import {
  ArrowLeft,
  Copy,
  Download,
  Printer,
  Smartphone,
  Check,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function ClinicQrPage() {
  const [copiedLink, setCopiedLink] = useState(false);
  const deepLink = "https://wa.me/919876543210?text=Hi";

  const copyToClipboard = () => {
    navigator.clipboard.writeText(deepLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success("Click-to-Chat deep link copied to clipboard!");
  };

  return (
    <DashboardShell>
      <PageHeader>
        <div className="flex flex-1 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="size-7">
              <Link href="/dashboard">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <span className="font-semibold text-sm">Sunrise Clinic</span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="text-muted-foreground text-xs font-normal">QR Code &amp; Reception Standee</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={copyToClipboard}
            >
              {copiedLink ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              <span>Copy Link</span>
            </Button>

            <Button
              size="sm"
              className="h-8 gap-1 text-xs font-medium"
              onClick={() => window.print()}
            >
              <Printer className="size-3.5" />
              <span>Print Poster</span>
            </Button>
          </div>
        </div>
      </PageHeader>

      <div className="flex min-w-0 flex-1 flex-col gap-6 p-4 sm:p-6 max-w-4xl mx-auto w-full">
        {/* Main Standee Showcase Card matching AbleSpace */}
        <Card className="shadow-none border-border">
          <CardContent className="p-6 sm:p-8 flex flex-col md:flex-row items-center gap-8">
            {/* QR Frame */}
            <div className="w-64 flex flex-col items-center justify-center p-6 bg-muted/40 rounded-xl border border-dashed border-border shrink-0 text-center">
              <div className="size-48 bg-white p-2 rounded-lg border border-border flex items-center justify-center shadow-xs">
                <img
                  src="http://127.0.0.1:3000/qr/100000000000001/image?size=500"
                  alt="WhatsApp QR"
                  className="size-full object-contain"
                />
              </div>

              <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                <Smartphone className="size-3.5" />
                <span>Scan with WhatsApp</span>
              </div>
            </div>

            {/* Standee Info & Actions */}
            <div className="flex-1 space-y-4">
              <div>
                <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                  Official OPD Booking QR
                </Badge>
                <h1 className="text-xl font-bold tracking-tight text-foreground mt-1.5">
                  Sunrise Clinic Standee
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Dr. Asha Verma (General Physician) • WhatsApp: <strong className="text-foreground font-mono">+91 98765 43210</strong>
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-muted-foreground">
                  Direct Click-to-Chat Deep Link
                </label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={deepLink}
                    className="h-8 font-mono text-xs"
                  />
                  <Button
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={copyToClipboard}
                  >
                    {copiedLink ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    <span>{copiedLink ? "Copied" : "Copy"}</span>
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  asChild
                >
                  <a
                    href="http://127.0.0.1:3000/api/admin/tenants/100000000000001/qr/download?format=png"
                    download
                  >
                    <Download className="size-3.5" />
                    <span>Download PNG</span>
                  </a>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  asChild
                >
                  <a
                    href="http://127.0.0.1:3000/api/admin/tenants/100000000000001/qr/download?format=svg"
                    download
                  >
                    <Download className="size-3.5" />
                    <span>Download SVG</span>
                  </a>
                </Button>

                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs gap-1"
                  onClick={() => window.print()}
                >
                  <Printer className="size-3.5" />
                  <span>Print Desk Poster</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3 Step Instructions Card matching AbleSpace */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-none border-border">
            <CardHeader className="p-4 pb-2">
              <div className="size-6 rounded-md bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center mb-1">
                1
              </div>
              <CardTitle className="text-xs font-semibold">Print &amp; Display</CardTitle>
              <CardDescription className="text-[11px]">
                Download high-res PNG or SVG and place acrylic standees on the reception table and waiting lounge.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="shadow-none border-border">
            <CardHeader className="p-4 pb-2">
              <div className="size-6 rounded-md bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center mb-1">
                2
              </div>
              <CardTitle className="text-xs font-semibold">Patient Scans QR</CardTitle>
              <CardDescription className="text-[11px]">
                Patients open their phone camera or WhatsApp scanner to immediately open the clinic chat.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="shadow-none border-border">
            <CardHeader className="p-4 pb-2">
              <div className="size-6 rounded-md bg-primary text-primary-foreground font-semibold text-xs flex items-center justify-center mb-1">
                3
              </div>
              <CardTitle className="text-xs font-semibold">Automatic Token</CardTitle>
              <CardDescription className="text-[11px]">
                The bot responds in 2 seconds, lets them choose a time slot, and assigns an OPD queue token.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
