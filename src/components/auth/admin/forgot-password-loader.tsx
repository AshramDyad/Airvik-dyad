"use client";

import dynamic from "next/dynamic";

import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";

const DynamicAdminForgotPassword = dynamic(
  () =>
    import("@/components/auth/admin/forgot-password-form").then(
      (module) => module.AdminForgotPasswordForm,
    ),
  {
    loading: () => <AuthFormSkeleton fields={1} variant="split" />,
  },
);

export function AdminForgotPasswordLoader() {
  return <DynamicAdminForgotPassword />;
}
