"use client";

import * as React from "react";
import { Download, Eye, Link2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BROCHURE_PDF_PATH = "/sahajanand-wellness-brochure.pdf";

export function BrochureDownloadCard() {
  const [copied, setCopied] = React.useState(false);

  const handleCopyLink = async () => {
    try {
      const pdfUrl = `${window.location.origin}${BROCHURE_PDF_PATH}`;
      await navigator.clipboard.writeText(pdfUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleView = () => {
    window.open(BROCHURE_PDF_PATH, "_blank");
  };

  return (
    <div className="rounded-2xl border border-border/40 bg-white p-8 shadow-lg max-w-sm w-full space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Download className="h-8 w-8 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">
            Sahajanand Wellness Brochure
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            PDF · Room &amp; Amenity Guide
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Button onClick={handleView} variant="outline" className="w-full">
          <Eye />
          View Brochure
        </Button>
        <Button asChild className="w-full">
          <a
            href={BROCHURE_PDF_PATH}
            download="Sahajanand-Wellness-Brochure.pdf"
          >
            <Download />
            Download Brochure
          </a>
        </Button>
        <Button variant="outline" className="w-full" onClick={handleCopyLink}>
          {copied ? <Check /> : <Link2 />}
          {copied ? "Link Copied!" : "Copy Share Link"}
        </Button>
      </div>
    </div>
  );
}
