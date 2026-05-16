"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/context/auth-context";

export function ProfileClient() {
  const router = useRouter();
  const { authUser, currentUser, isLoading } = useAuthContext();

  React.useEffect(() => {
    if (!isLoading && !authUser) {
      router.replace("/login");
    }
  }, [authUser, isLoading, router]);

  if (isLoading || !authUser) {
    return <div className="mx-auto max-w-2xl p-8">Loading...</div>;
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-serif mb-4">Your Profile</h1>
      <div className="space-y-2 text-sm">
        <p><span className="font-medium">Name:</span> {currentUser?.name || ""}</p>
        <p><span className="font-medium">Email:</span> {authUser.email}</p>
      </div>
    </div>
  );
}
