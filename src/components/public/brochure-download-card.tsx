import { Download, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrochureCopyLinkButtonLoader } from "./brochure-copy-link-button-loader";

const BROCHURE_PDF_PATH = "/sahajanand-wellness-brochure.pdf";

export function BrochureDownloadCard() {
  return (
    <div className="rounded-2xl border border-border/40 bg-white p-8 shadow-lg max-w-2xl w-full space-y-6">
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
        <Button variant="outline" className="w-full" asChild>
          <a
            href={BROCHURE_PDF_PATH}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Eye />
            View Brochure
          </a>
        </Button>
        <Button asChild className="w-full">
          <a
            href={BROCHURE_PDF_PATH}
            download="sahajanand-wellness-brochure.pdf"
          >
            <Download />
            Download Brochure
          </a>
        </Button>
        <BrochureCopyLinkButtonLoader pdfPath={BROCHURE_PDF_PATH} />
      </div>
    </div>
  );
}
