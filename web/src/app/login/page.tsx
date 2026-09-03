"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppDispatch } from "@/store/hooks";
import { login } from "@/store/authSlice";
import { authService } from "@/lib/auth-service";
import { ApiError } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck } from "lucide-react";

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

      // Automatically route by role without exposing any role selection in the UI
      if (res.user.role === "super_admin") {
        router.push("/super-admin");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Invalid email or password. Please check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 md:p-10 bg-background text-foreground">
      {/* Top right theme toggle matching AbleSpace */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="flex w-full max-w-sm flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-xs">
            C
          </div>
          <div className="space-y-0.5">
            <h1 className="text-xl font-bold tracking-tight">ClinicConnect</h1>
            <p className="text-xs text-muted-foreground">
              Healthcare &amp; Clinic Management Platform
            </p>
          </div>
        </div>

        {/* Authentication Card matching AbleSpace */}
        <Card className="shadow-none border-border">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-base font-semibold leading-none">
              Sign in to your account
            </CardTitle>
            <CardDescription className="text-xs mt-1.5">
              Enter your email and password to access your dashboard
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="grid gap-3.5">
              <div className="grid gap-1.5">
                <Label htmlFor="email" className="text-xs font-medium">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@clinic.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium">
                    Password
                  </Label>
                </div>
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
                <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2.5 text-xs text-destructive">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="w-full text-xs font-medium h-8 mt-1 cursor-pointer"
              >
                {loading ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Reassuring Security Footer */}
        <div className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          <span>Encrypted healthcare communications &amp; OPD system</span>
        </div>
      </div>
    </div>
  );
}
