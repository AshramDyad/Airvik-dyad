"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import Link from "next/link";
import Image from "@/components/ui/cloudflare-image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, CalendarCheck, LineChart } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { signOutUser } from "@/context/session-context";
import { getUserProfile } from "@/lib/api";
import { ADMIN_SHELL_ROLES } from "@/constants/roles";
import { getAdminLandingPath } from "@/lib/auth/landing";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

interface UserMetadataWithRole {
  role_name?: string;
}

interface ProfileWithRoles {
  roles?: {
    name?: string | null;
  } | null;
}

function isNetworkError(error: { message?: string }): boolean {
  const msg = error.message?.toLowerCase() ?? "";
  return (
    msg.includes("failed to fetch") ||
    msg.includes("timed out") ||
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("aborted")
  );
}

export function AdminLoginForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: values.email, password: values.password });
      if (error) {
        if (isNetworkError(error)) {
          toast.error("Connection error", {
            description:
              "Unable to reach the server. Please check your firewall or antivirus settings, try a different browser, or contact support.",
          });
        } else {
          toast.error("Login failed", { description: error.message });
        }
        setIsLoading(false);
        return;
      }

      let roleName: string | null = null;
      const user = data.user ?? (await supabase.auth.getUser()).data.user;
      const metaRole =
        (user?.user_metadata as UserMetadataWithRole | undefined)?.role_name ??
        null;
      roleName = typeof metaRole === "string" ? metaRole : null;
      if (!roleName && user?.id) {
        try {
          const { data: profile } = await getUserProfile(user.id);
          const profileRoles = (profile as ProfileWithRoles | null | undefined)
            ?.roles;
          const profileRoleName =
            profileRoles && typeof profileRoles.name === "string"
              ? profileRoles.name
              : null;
          roleName = profileRoleName ?? roleName;
        } catch {}
      }

      const isAdminRole = ADMIN_SHELL_ROLES.some((adminRole) => adminRole === roleName);

      if (!roleName || !isAdminRole) {
        await signOutUser();
        toast.error("Admins only", { description: "Use the guest portal at /login." });
        setIsLoading(false);
        return;
      }

      toast.success("Welcome back", { description: "Redirecting to Admin..." });
      router.push(getAdminLandingPath(roleName));
    } catch {
      toast.error("Connection error", {
        description:
          "The request timed out. Please check your internet connection, disable any VPN/proxy, or try a different browser.",
      });
    }
    setIsLoading(false);
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] gap-8 lg:gap-0 overflow-hidden">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-gradient-to-br from-orange-400/30 to-rose-400/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-amber-400/30 to-orange-400/30 blur-3xl" />
      </div>

      {/* Brand / Visual side */}
      <section className="relative flex w-full items-center justify-center bg-gradient-to-br from-amber-50 via-orange-50 to-rose-50 dark:from-amber-950/20 dark:via-orange-950/10 dark:to-rose-950/10 px-6 py-10 sm:px-10 lg:px-12">
        <div className="relative z-10 mx-auto w-full max-w-2xl text-left">
          <div className="mb-6 inline-flex items-center justify-center rounded-full bg-white/80 px-4 py-2 shadow-sm ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10">
            <Image src="/apexture-logo.svg" alt="Apexture logo" width={120} height={32} className="h-8 w-auto md:h-10" />
          </div>
          <h2 className="text-4xl font-serif font-semibold leading-tight text-orange-900 sm:text-5xl dark:text-white">
            Hotel Management System
          </h2>
          <p className="mt-4 max-w-2xl text-base text-neutral-700 sm:text-lg dark:text-neutral-200">
            Securely orchestrate reservations, rates, and on-site teams from one console built for fast-moving hospitality leaders.
          </p>
          <ul className="mt-6 space-y-4 text-sm sm:text-base text-neutral-800 dark:text-neutral-100">
            <li className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium">Granular staff roles</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">Approve only the actions each desk or department needs.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <CalendarCheck className="mt-0.5 h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium">Live stay grid</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">Automate scheduling, room turns, and housekeeping handoffs.</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <LineChart className="mt-0.5 h-5 w-5 text-orange-600" />
              <div>
                <p className="font-medium">Revenue-grade analytics</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-300">Track pacing, ADR, and channel mix in real time.</p>
              </div>
            </li>
          </ul>
        </div>
        <div className="pointer-events-none absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle_at_20%_20%,#000_2px,transparent_2px)] bg-[length:20px_20px]" />
      </section>

      {/* Form side */}
      <div className="flex w-full items-center justify-center px-6 pb-12 sm:px-10 lg:px-12 lg:pb-0">
        <Card className="w-full max-w-lg rounded-2xl bg-white/85 shadow-2xl backdrop-blur-md ring-1 ring-black/5 dark:bg-neutral-900/60 dark:ring-white/10">
          <CardHeader className="text-left pb-2">
            <CardTitle className="text-3xl font-serif">Admin Sign in</CardTitle>
            <CardDescription>Sign in with your Apexture credentials to open the control room.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input className="h-11" placeholder="admin@hotel.com" {...field} type="email" autoComplete="email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input className="h-11" placeholder="••••••••" {...field} type="password" autoComplete="current-password" />
                      </FormControl>
                      <div className="mt-2 text-right">
                        <Link href="/admin/forget-password" className="text-sm font-medium text-primary underline underline-offset-4">
                          Forgot password?
                        </Link>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="h-11 w-full bg-orange-500 hover:bg-orange-600 text-white shadow-lg shadow-orange-500/20" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Sign in"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
