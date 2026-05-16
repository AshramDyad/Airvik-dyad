"use client";

import dynamic from "next/dynamic";

import { Skeleton } from "@/components/ui/skeleton";

const DynamicAdminLoginForm = dynamic(
  () =>
    import("@/components/auth/admin/login-form").then(
      (module) => module.AdminLoginForm,
    ),
  {
    loading: () => <AdminLoginSkeleton />,
  },
);

export function AdminLoginLoader() {
  return <DynamicAdminLoginForm />;
}

function AdminLoginSkeleton() {
  return (
    <div className="relative flex min-h-screen w-full flex-col gap-8 overflow-hidden lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-0">
      <section className="flex w-full items-center justify-center bg-muted/30 px-6 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          <Skeleton className="h-12 w-40 rounded-full" />
          <Skeleton className="h-24 w-full max-w-lg rounded-lg" />
          <div className="space-y-4">
            <Skeleton className="h-16 w-full max-w-xl rounded-lg" />
            <Skeleton className="h-16 w-full max-w-xl rounded-lg" />
            <Skeleton className="h-16 w-full max-w-xl rounded-lg" />
          </div>
        </div>
      </section>
      <div className="flex w-full items-center justify-center px-6 pb-12 sm:px-10 lg:px-12 lg:pb-0">
        <div className="w-full max-w-lg rounded-2xl border border-border/50 bg-card text-foreground">
          <div className="flex flex-col gap-2 px-6 py-5 space-y-3">
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-5 w-full max-w-sm" />
          </div>
          <div className="px-6 pb-6 pt-0 space-y-6">
            <Skeleton className="h-20 rounded-md" />
            <Skeleton className="h-20 rounded-md" />
            <Skeleton className="h-11 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}
