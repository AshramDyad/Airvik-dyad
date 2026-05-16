"use client";

import * as React from "react";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

interface BrochureCopyLinkButtonProps {
  pdfPath: string;
}

export function BrochureCopyLinkButton({
  pdfPath,
}: BrochureCopyLinkButtonProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopyLink = async () => {
    try {
      const pdfUrl = `${window.location.origin}${pdfPath}`;
      await navigator.clipboard.writeText(pdfUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  return (
    <Button variant="outline" className="w-full" onClick={handleCopyLink}>
      {copied ? <Check /> : <Link2 />}
      {copied ? "Link Copied!" : "Copy Share Link"}
    </Button>
  );
}
