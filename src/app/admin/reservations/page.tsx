"use client";

import * as React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { differenceInDays, parseISO } from "date-fns";
import { columns, ReservationWithDetails } from "./components/columns";
import { DataTable } from "./components/data-table";
import { useDataContext } from "@/context/data-context";
import type { FolioItem, ReservationStatus } from "@/data/types";
import {
  calculateReservationTaxAmount,
  calculateReservationFinancials,
  resolveReservationTaxConfig,
} from "@/lib/reservations/calculate-financials";
import { shouldShowReservationFinancials } from "@/lib/reservations/status";
import { PermissionGate } from "@/components/admin/permission-gate";

function sumAdditionalCharges(folioItems: FolioItem[] = []) {
  return folioItems
    .filter(
      (item) =>
        item.amount > 0 &&
        item.externalMetadata?.type !== "payment" &&
        !item.externalReference?.startsWith("payment-")
    )
    .reduce((sum, item) => sum + item.amount, 0);
}

function getReservationDisplayAmount(
  reservation: ReservationWithDetails,
  property: { tax_enabled?: boolean | null; tax_percentage?: number | null }
) {
  const taxes = calculateReservationTaxAmount(reservation, property);
  const additionalCharges = sumAdditionalCharges(reservation.folio ?? []);
  return reservation.totalAmount + taxes + additionalCharges;
}

function getReservationPaidAndBalance(
  reservation: ReservationWithDetails,
  property: { tax_enabled?: boolean | null; tax_percentage?: number | null }
): { paidAmount: number; remainingBalance: number } {
  const taxConfig = resolveReservationTaxConfig(reservation, property);
  const financials = calculateReservationFinancials(reservation, taxConfig);
  return {
    paidAmount: financials.totalPaid,
    remainingBalance: financials.balance,
  };
}

export default function ReservationsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const {
    isRefreshing,
    isReservationsInitialLoading,
    refreshReservations,
    loadReservationsPage,
    bookings,
    reservationsTotalCount,
    reservationStatusCounts,
    updateReservationStatus,
    updateBookingReservationStatus,
    property,
  } = useDataContext();

  const pageIndex = Number(searchParams?.get("page") ?? "0");
  const pageSize = Number(searchParams?.get("limit") ?? "10");
  const searchQuery = searchParams?.get("q") ?? "";
  const activeStatus = (searchParams?.get("status") as ReservationStatus | null) ?? null;

  const updateQueryParams = React.useCallback(
    (params: Record<string, string | number | null>) => {
      const current = new URLSearchParams(Array.from(searchParams?.entries() ?? []));

      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === "" || value === 0 && key === "page") {
          current.delete(key);
        } else {
          current.set(key, String(value));
        }
      });

      const search = current.toString();
      const query = search ? `?${search}` : "";

      router.push(`${pathname}${query}`);
    },
    [searchParams, router, pathname]
  );

  React.useEffect(() => {
    loadReservationsPage({
      limit: pageSize,
      offset: pageIndex * pageSize,
      query: searchQuery,
      statuses: activeStatus ? [activeStatus] : undefined,
    });
  }, [loadReservationsPage, pageIndex, pageSize, searchQuery, activeStatus]);

  const handlePageChange = (index: number) => {
    updateQueryParams({ page: index });
  };

  const handlePageSizeChange = (size: number) => {
    updateQueryParams({ limit: size, page: 0 });
  };

  const handleSearch = (query: string) => {
    updateQueryParams({ q: query, page: 0 });
  };

  const handleStatusChange = (status: ReservationStatus | null) => {
    updateQueryParams({ status, page: 0 });
  };

  const groupedReservations = React.useMemo(() => {
    return bookings.map((booking) => {
      const detailedBooking: ReservationWithDetails = { ...booking } as unknown as ReservationWithDetails;

      // Calculate nights for each row
      const calculateNights = (res: { checkInDate: string; checkOutDate: string }) =>
        differenceInDays(parseISO(res.checkOutDate), parseISO(res.checkInDate));

      detailedBooking.nights = calculateNights(detailedBooking);

      if (booking.subRows && booking.subRows.length > 0) {
        detailedBooking.subRows = (booking.subRows as unknown as ReservationWithDetails[]).map((sub: ReservationWithDetails) => {
          const subWithDetails = { ...sub } as unknown as ReservationWithDetails;
          subWithDetails.nights = calculateNights(sub);
          if (shouldShowReservationFinancials(sub.status)) {
            subWithDetails.displayAmount = getReservationDisplayAmount(subWithDetails, property);
            const { paidAmount, remainingBalance } = getReservationPaidAndBalance(subWithDetails, property);
            subWithDetails.paidAmount = paidAmount;
            subWithDetails.remainingBalance = remainingBalance;
          } else {
            subWithDetails.displayAmount = 0;
            subWithDetails.paidAmount = 0;
            subWithDetails.remainingBalance = 0;
          }
          return subWithDetails;
        });

        // Top level amount is always the sum of subRows
        if (detailedBooking.subRows && detailedBooking.subRows.length > 0) {
          detailedBooking.displayAmount = detailedBooking.subRows.reduce((sum, sub) => sum + (sub.displayAmount || 0), 0);
          detailedBooking.paidAmount = detailedBooking.subRows.reduce((sum, sub) => sum + (sub.paidAmount ?? 0), 0);
          detailedBooking.remainingBalance = detailedBooking.subRows.reduce((sum, sub) => sum + (sub.remainingBalance ?? 0), 0);
        } else {
          detailedBooking.displayAmount = shouldShowReservationFinancials(detailedBooking.status)
            ? getReservationDisplayAmount(detailedBooking, property)
            : 0;
          detailedBooking.paidAmount = 0;
          detailedBooking.remainingBalance = 0;
        }
      } else {
        if (shouldShowReservationFinancials(detailedBooking.status)) {
          detailedBooking.displayAmount = getReservationDisplayAmount(detailedBooking, property);
          const { paidAmount, remainingBalance } = getReservationPaidAndBalance(detailedBooking, property);
          detailedBooking.paidAmount = paidAmount;
          detailedBooking.remainingBalance = remainingBalance;
        } else {
          detailedBooking.displayAmount = 0;
          detailedBooking.paidAmount = 0;
          detailedBooking.remainingBalance = 0;
        }
      }

      return detailedBooking;
    });
  }, [bookings, property]);

  const handleCancelReservation = async (bookingId: string) => {
    await updateBookingReservationStatus(bookingId, "Cancelled");
    toast.success("All rooms in this booking have been cancelled.");
  };

  const handleCheckInReservation = (reservationId: string) => {
    updateReservationStatus(reservationId, "Checked-in");
    toast.success("Guest checked-in successfully.");
  };

  const handleCheckOutReservation = (reservationId: string) => {
    updateReservationStatus(reservationId, "Checked-out");
    toast.success("Guest checked-out successfully.");
  };

  return (
    <PermissionGate feature="reservations">
      <div className="h-full">
        <DataTable
          columns={columns}
          data={groupedReservations}
          totalCount={reservationsTotalCount}
          isLoading={isReservationsInitialLoading}
          isRefreshing={isRefreshing}
          onRefresh={refreshReservations}
          onCancelReservation={handleCancelReservation}
          onCheckInReservation={handleCheckInReservation}
          onCheckOutReservation={handleCheckOutReservation}
          activeStatus={activeStatus}
          onStatusChange={handleStatusChange}
          statusCounts={reservationStatusCounts}
          pagination={{
            pageIndex,
            pageSize,
            onPageChange: handlePageChange,
            onPageSizeChange: handlePageSizeChange,
          }}
          onSearch={handleSearch}
        />
      </div>
    </PermissionGate>
  );
}
