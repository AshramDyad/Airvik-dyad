import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Devotional Shop",
  description:
    "Shop devotional items, spiritual books and handmade goods from Sahajanand Wellness Ashram, Rishikesh. Every purchase supports the ashram's daily seva and community services.",
  path: "/shop",
});

export default function ShopLayout({ children }: { children: ReactNode }) {
  return children;
}
