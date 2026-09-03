"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/hooks";
import { login } from "@/store/authSlice";
import { authService } from "@/lib/auth-service";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await authService.login(email, password);
      dispatch(login({ userData: res.user }));

      if (res.user.role === "super_admin") {
        router.push("/super-admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Invalid email or password. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-6 md:p-10 bg-background">
      <div className="flex w-full max-w-sm flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg">
            C
          </div>
          <h1 className="text-xl font-bold tracking-tight">ClinicConnect</h1>
          <p className="text-xs text-muted-foreground">
            WhatsApp Healthcare &amp; OPD Platform
          </p>
        </div>

        {/* Login Card matching AbleSpace */}
        <Card className="shadow-none border-border">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-lg font-semibold leading-none">
              Sign in to your account
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Enter your credentials to manage your clinic
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-3.5">
              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-xs">Email</Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="admin@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="password" className="text-xs">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              {error && (
                <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2 text-xs text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="w-full text-xs font-medium h-8 mt-1"
              >
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Credentials hints for local testing */}
        <div className="rounded-lg border border-dashed border-border p-3 bg-muted/20 text-center">
          <p className="text-[11px] font-medium text-foreground">Demo Credentials:</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Super Admin: <code className="font-mono">superadmin@clinicconnect.com</code>
          </p>
          <p className="text-[10px] text-muted-foreground">
            Clinic Admin: <code className="font-mono">admin@sunriseclinic.com</code>
          </p>
          <p className="text-[10px] text-muted-foreground">
            Password: <code className="font-mono">Password@123</code>
          </p>
        </div>
      </div>
    </div>
  );
}
