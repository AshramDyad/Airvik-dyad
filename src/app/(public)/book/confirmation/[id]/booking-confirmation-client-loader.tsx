"use client";

import dynamic from "next/dynamic";

const DynamicBookingConfirmationClient = dynamic(
  () =>
    import("./booking-confirmation-client").then(
      (module) => module.BookingConfirmationClient,
    ),
  {
    loading: () => <BookingConfirmationLoading />,
  },
);

export function BookingConfirmationClientLoader() {
  return <DynamicBookingConfirmationClient />;
}

function BookingConfirmationLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
        <p className="mt-4 text-muted-foreground">
          Loading your reservation...
        </p>
      </div>
    </div>
  );
}
