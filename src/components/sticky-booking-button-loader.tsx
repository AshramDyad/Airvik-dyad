"use client";

import dynamic from "next/dynamic";

const DynamicStickyBookingButton = dynamic(
  () =>
    import("./sticky-booking-button").then(
      (module) => module.StickyBookingButton,
    ),
  { ssr: false },
);

export function StickyBookingButtonLoader() {
  return <DynamicStickyBookingButton />;
}
