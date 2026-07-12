import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Sunil Bhagat — Guiding Spirit of the Ashram",
  description:
    "Meet Sunil Bhagat, the guiding light behind Sahajanand Wellness ashram in Rishikesh, and his vision of seva, yoga and devotion on the banks of the Ganges.",
  path: "/sunil-bhagat",
});

export default function SunilBhagatLayout({ children }: { children: ReactNode }) {
  return children;
}
