"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Eye, Download, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";

const BROCHURE_PDF_PATH = "/sahajanand-wellness-brochure.pdf";

const BrochureViewerDialog = dynamic(
  () =>
    import("./brochure-viewer-dialog").then(
      (module) => module.BrochureViewerDialog,
    ),
  { ssr: false },
);

export function BrochureSection() {
  const [viewerOpen, setViewerOpen] = React.useState(false);

  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-orange-50/70 to-transparent">
      <div className="container mx-auto px-4">
        <div className="mx-auto">
          <div className="rounded-2xl px-4 text-center space-y-3">
            {/* Icon */}
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/15">
              <BookOpen className="h-7 w-7 text-primary" />
            </div>

            {/* Label */}
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">
              Room &amp; Amenity Guide
            </p>

            {/* Title */}
            <h2 className="text-2xl md:text-3xl font-serif font-semibold text-foreground">
              Sahajanand Wellness Brochure
            </h2>

            {/* Description */}
            <p className="text-lg max-w-3xl mx-auto text-muted-foreground leading-relaxed">
              View or download our brochure to explore all room types,
              amenities, and spiritual programs available during your stay at
              the ashram.
            </p>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-8">
              <Button
                variant="outline"
                size="lg"
                className="border-primary/30 hover:bg-primary/5 hover:border-primary/50"
                onClick={() => setViewerOpen(true)}
              >
                <Eye />
                View Brochure
              </Button>
              <Button size="lg" asChild>
                <a
                  href={BROCHURE_PDF_PATH}
                  download="sahajanand-wellness-brochure.pdf"
                >
                  <Download />
                  Download Brochure
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {viewerOpen && (
        <BrochureViewerDialog
          open={viewerOpen}
          onOpenChange={setViewerOpen}
          pdfPath={BROCHURE_PDF_PATH}
        />
      )}
    </section>
  );
}
