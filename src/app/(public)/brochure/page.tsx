import type { Metadata } from "next";
import { BrochureDownloadCard } from "@/components/public/brochure-download-card";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = buildMetadata({
  title: "Brochure",
  description:
    "Download the Sahajanand Wellness Ashram brochure. Discover affordable rooms, amenities and spiritual programs, and plan your stay on the banks of the Ganges in Rishikesh.",
  path: "/brochure",
});

export default function BrochurePage() {
  return (
    <section className="bg-muted/20 py-16 sm:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-2xl text-center space-y-4">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Brochure
          </p>
          <h1 className="text-4xl font-serif font-semibold text-foreground sm:text-5xl">
            Sahajanand Wellness Ashram
          </h1>
          <p className="text-lg text-muted-foreground">
            Download our brochure to explore rooms, amenities, and spiritual
            programs at the ashram in Rishikesh.
          </p>
        </div>
        <div className="mt-12 flex justify-center">
          <BrochureDownloadCard />
        </div>
      </div>
    </section>
  );
}
