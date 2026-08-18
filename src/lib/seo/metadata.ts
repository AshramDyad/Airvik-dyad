import type { Metadata } from "next";
import { SITE, SITE_URL, ALL_KEYWORDS, absoluteUrl } from "@/config/site";

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
  openGraphType?: "website" | "article";
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
};

export const getPostSeoValues = (post: {
  title: string;
  excerpt?: string;
  seo_title?: string;
  meta_description?: string;
}) => ({
  title: post.seo_title || post.title,
  description:
    post.meta_description ||
    post.excerpt ||
    `Read "${post.title}" — a story from Sahajanand Wellness ashram in Rishikesh.`,
});

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
  openGraphType = "website",
  publishedTime,
  modifiedTime,
  authors,
}: BuildMetadataArgs): Metadata {
  const url = absoluteUrl(path);
  const imageUrl = image.startsWith("http") ? image : absoluteUrl(image);

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    robots: noindex
      ? { index: false, follow: true }
      : { index: true, follow: true },
    openGraph: {
      type: openGraphType,
      siteName: SITE.name,
      title: title ? `${title} | ${SITE.titleSuffix}` : SITE.shortName,
      description,
      url,
      locale: "en_IN",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: SITE.name }],
      ...(openGraphType === "article"
        ? {
            publishedTime,
            modifiedTime,
            authors,
          }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: title ? `${title} | ${SITE.titleSuffix}` : SITE.shortName,
      description,
      images: [imageUrl],
    },
  };
}

/** Re-export for convenience */
export { SITE_URL };
