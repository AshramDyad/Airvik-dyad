import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "About Our Ashram",
  description:
    "Sahajanand Wellness is a registered religious trust and affordable ashram on the banks of the Ganges at Muni Ki Reti, Rishikesh. Since 2002 we have offered dharmshala stays, yoga, daily Ganga Aarti and community seva for pilgrims and travellers.",
  path: "/about-us",
});

export default function AboutUsLayout({ children }: { children: ReactNode }) {
  return children;
}
