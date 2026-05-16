"use client";

import dynamic from "next/dynamic";

interface BrochureCopyLinkButtonLoaderProps {
  pdfPath: string;
}

const DynamicBrochureCopyLinkButton = dynamic(
  () =>
    import("./brochure-copy-link-button").then(
      (module) => module.BrochureCopyLinkButton,
    ),
  {
    loading: () => (
      <button
        type="button"
        className="inline-flex h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-border/60 px-5 text-sm font-medium text-foreground opacity-50 shadow-sm"
        disabled
      >
        Copy Share Link
      </button>
    ),
  },
);

export function BrochureCopyLinkButtonLoader({
  pdfPath,
}: BrochureCopyLinkButtonLoaderProps) {
  return <DynamicBrochureCopyLinkButton pdfPath={pdfPath} />;
}
