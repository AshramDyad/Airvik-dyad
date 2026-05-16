"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface BrochureViewerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfPath: string;
}

export function BrochureViewerDialog({
  open,
  onOpenChange,
  pdfPath,
}: BrochureViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-3 shrink-0">
          <DialogTitle>Sahajanand Wellness Brochure</DialogTitle>
          <DialogDescription>
            Browse the full brochure below. Close this window when you are done.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 px-6 pb-6 min-h-0">
          <iframe
            src={pdfPath}
            className="w-full h-full rounded-xl border border-border/40"
            title="Sahajanand Wellness Brochure"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
