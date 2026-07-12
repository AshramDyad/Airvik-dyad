import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Our Journey",
  description:
    "The story of Sahajanand Wellness — from its founding in 2002 to a thriving spiritual ashram and dharmshala serving pilgrims and seekers on the banks of the Ganges in Rishikesh.",
  path: "/journey",
});

export default function JourneyLayout({ children }: { children: ReactNode }) {
  return children;
}
