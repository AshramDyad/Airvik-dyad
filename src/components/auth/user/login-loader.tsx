"use client";

import dynamic from "next/dynamic";

import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";

const DynamicUserLogin = dynamic(
  () =>
    import("@/components/auth/user/login-form").then(
      (module) => module.UserLoginForm,
    ),
  {
    loading: () => <AuthFormSkeleton fields={2} />,
  },
);

export function UserLoginLoader() {
  return <DynamicUserLogin />;
}
