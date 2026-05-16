"use client";

import dynamic from "next/dynamic";

import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";

const DynamicUserForgotPassword = dynamic(
  () =>
    import("@/components/auth/user/forgot-password-form").then(
      (module) => module.UserForgotPasswordForm,
    ),
  {
    loading: () => <AuthFormSkeleton fields={1} />,
  },
);

export function UserForgotPasswordLoader() {
  return <DynamicUserForgotPassword />;
}
