"use client";

import dynamic from "next/dynamic";

import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";

const DynamicUserResetPassword = dynamic(
  () =>
    import("@/components/auth/reset-password-form").then(
      (module) => module.ResetPasswordForm,
    ),
  {
    loading: () => <AuthFormSkeleton fields={2} />,
  },
);

export function UserResetPasswordLoader() {
  return <DynamicUserResetPassword />;
}
