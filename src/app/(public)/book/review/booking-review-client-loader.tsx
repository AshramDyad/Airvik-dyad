"use client";

import dynamic from "next/dynamic";

import { BookingReviewSkeleton } from "@/components/public/booking-review-skeleton";

const DynamicBookingReviewClient = dynamic(
  () =>
    import("./booking-review-client").then(
      (module) => module.BookingReviewClient,
    ),
  {
    loading: () => <BookingReviewSkeleton />,
  },
);

export function BookingReviewClientLoader() {
  return <DynamicBookingReviewClient />;
}
