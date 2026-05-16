"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PermissionGate } from "@/components/admin/permission-gate";
import { Button } from "@/components/ui/button";
import type { Guest } from "@/data/types";
import { useGuestsPage } from "@/hooks/use-guests-page";
import { columns } from "./columns";
import { GuestsDataTable } from "./data-table";
import { GuestFormDialog } from "./guest-form-dialog";

const DEFAULT_PAGE_SIZE = 25;

const parsePositiveNumber = (
  value: string | null | undefined,
  fallback: number,
) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parsePageIndex = (value: string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

export function GuestsPanel() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const intent = searchParams?.get("intent") ?? null;
  const redirectParam =
    searchParams?.get("redirect") ?? "/admin/reservations/new";
  const safeRedirect = redirectParam.startsWith("/")
    ? redirectParam
    : "/admin/reservations/new";
  const isReservationFlow = intent === "create-for-reservation";
  const pageIndex = parsePageIndex(searchParams?.get("page"));
  const pageSize = parsePositiveNumber(
    searchParams?.get("limit"),
    DEFAULT_PAGE_SIZE,
  );
  const searchQuery = searchParams?.get("q") ?? "";
  const {
    guests: guestRows,
    totalCount,
    isLoading,
    reload,
  } = useGuestsPage({
    limit: pageSize,
    offset: pageIndex * pageSize,
    query: searchQuery,
  });

  const updateQueryParams = React.useCallback(
    (params: Record<string, string | number | null>) => {
      const current = new URLSearchParams(
        Array.from(searchParams?.entries() ?? []),
      );

      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === "" || (value === 0 && key === "page")) {
          current.delete(key);
        } else {
          current.set(key, String(value));
        }
      });

      const search = current.toString();
      router.push(`${pathname}${search ? `?${search}` : ""}`);
    },
    [pathname, router, searchParams],
  );

  const handleGuestCreated = (guest: Guest) => {
    router.replace(`${safeRedirect}?guestId=${guest.id}`);
  };

  return (
    <PermissionGate feature="guests">
      <div className="space-y-6">
      {isReservationFlow && (
        <Alert>
          <AlertTitle>Creating a guest for a reservation</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              Complete this guest profile and you&apos;ll return to the
              reservation form with the guest pre-selected.
            </p>
            <GuestFormDialog defaultOpen onGuestCreated={handleGuestCreated}>
              <Button size="sm" variant="outline">
                Open guest form
              </Button>
            </GuestFormDialog>
          </AlertDescription>
        </Alert>
      )}
      <GuestsDataTable
        columns={columns}
        data={guestRows}
        totalCount={totalCount}
        isLoading={isLoading}
        pageIndex={pageIndex}
        pageSize={pageSize}
        searchQuery={searchQuery}
        onSearch={(query) => updateQueryParams({ q: query, page: 0 })}
        onPageChange={(page) => updateQueryParams({ page })}
        onPageSizeChange={(limit) => updateQueryParams({ limit, page: 0 })}
        onDataChanged={reload}
      />
      </div>
    </PermissionGate>
  );
}
