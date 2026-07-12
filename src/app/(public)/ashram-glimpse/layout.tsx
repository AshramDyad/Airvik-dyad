import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Ashram Photo Gallery",
  description:
    "A visual glimpse of Sahajanand Wellness ashram in Rishikesh — our rooms, ghat, daily Ganga Aarti, gaushala and serene surroundings on the banks of the Ganges at Muni Ki Reti.",
  path: "/ashram-glimpse",
});

export default function AshramGlimpseLayout({ children }: { children: ReactNode }) {
  return children;
}
