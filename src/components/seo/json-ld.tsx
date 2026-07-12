import * as React from "react";

/**
 * Renders a JSON-LD <script> tag. Server component — the structured data is in
 * the initial HTML so search engines and AI crawlers read it without executing JS.
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // Data is built from trusted, static config — safe to inline.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
