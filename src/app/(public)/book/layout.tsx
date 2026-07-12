import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Book an Affordable Ashram Stay in Rishikesh",
  description:
    "Book simple, budget-friendly ashram and dharmshala rooms at Sahajanand Wellness on the banks of the Ganges in Muni Ki Reti, Rishikesh. Check availability and reserve a peaceful stay with daily yoga, meditation and Ganga Aarti.",
  path: "/book",
});

export default function BookLayout({ children }: { children: ReactNode }) {
  return children;
}
