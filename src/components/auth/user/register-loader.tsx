"use client";

import dynamic from "next/dynamic";

import { AuthFormSkeleton } from "@/components/auth/auth-form-skeleton";

const DynamicUserRegister = dynamic(
  () =>
    import("@/components/auth/register-form").then(
      (module) => module.RegisterForm,
    ),
  {
    loading: () => <AuthFormSkeleton fields={4} />,
  },
);

export function UserRegisterLoader() {
  return <DynamicUserRegister />;
}
