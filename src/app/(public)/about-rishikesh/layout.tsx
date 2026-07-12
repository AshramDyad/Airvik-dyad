import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "About Rishikesh — Yoga Capital of the World",
  description:
    "Discover Rishikesh, the yoga capital of the world on the banks of the Ganges — its temples, ghats, Ram Jhula and evening Ganga Aarti. Plan your visit and stay at the affordable Sahajanand Wellness ashram in Muni Ki Reti.",
  path: "/about-rishikesh",
});

export default function AboutRishikeshLayout({ children }: { children: ReactNode }) {
  return children;
}
