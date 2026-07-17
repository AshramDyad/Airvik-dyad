import type { Metadata } from "next";
import { SITE, SITE_URL, ALL_KEYWORDS, absoluteUrl } from "@/config/site";
import { absoluteMediaUrl } from "@/lib/cloudflare-images";

type BuildMetadataArgs = {
  /** Page title WITHOUT the brand suffix (template adds it). Omit for the homepage default. */
  title?: string;
  description: string;
  /** Absolute path, e.g. "/book". Used for canonical + OG url. */
  path: string;
  /** Override social image (absolute path under /public or full URL). */
  image?: string;
  keywords?: string[];
  /** Set true on thin/utility pages you don't want indexed. */
  noindex?: boolean;
};

/**
 * Build a consistent Metadata object with canonical URL, Open Graph and Twitter
 * card data. Titles flow through the root layout's title template, so pass the
 * short page title only (e.g. "Book an Ashram Stay").
 */
export function buildMetadata({
  title,
  description,
  path,
  image = SITE.ogImage,
  keywords = ALL_KEYWORDS,
  noindex = false,
}: BuildMetadataArgs): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = absoluteMediaUrl(image);

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    robots: noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      siteName: SITE.name,
      title: title ? `${title} | ${SITE.titleSuffix}` : `${SITE.shortName} | Rishikesh`,
      description,
      url,
      locale: "en_IN",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: title ? `${title} | ${SITE.titleSuffix}` : `${SITE.shortName} | Rishikesh`,
      description,
      images: [imageUrl],
    },
  };
}

/** Re-export for convenience */
export { SITE_URL };
