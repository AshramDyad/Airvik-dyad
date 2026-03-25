"use client";

import * as React from "react";
import { Eye, Download, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const BROCHURE_PDF_PATH = "/sahajanand-wellness-brochure.pdf";

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
                  download="Sahajanand-Wellness-Brochure.pdf"
                >
                  <Download />
                  Download Brochure
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Viewer Modal */}
      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
            <DialogTitle>Sahajanand Wellness Brochure</DialogTitle>
            <DialogDescription>
              Browse the full brochure below. Close this window when you are
              done.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 px-6 pb-6 min-h-0">
            <iframe
              src={BROCHURE_PDF_PATH}
              className="w-full h-full rounded-xl border border-border/40"
              title="Sahajanand Wellness Brochure"
            />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
