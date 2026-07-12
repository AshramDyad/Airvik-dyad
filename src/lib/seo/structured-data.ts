/**
 * Schema.org JSON-LD builders. Keep all structured data here so NAP/geo stays
 * consistent with src/config/site.ts. Rendered via <JsonLd /> (see
 * src/components/seo/json-ld.tsx). No FAQPage / HowTo (deprecated / retired).
 */
import {
  SITE,
  SITE_URL,
  ADDRESS,
  GEO,
  SOCIAL_PROFILES,
  absoluteUrl,
} from "@/config/site";

const ORG_ID = `${SITE_URL}/#organization`;
const LODGING_ID = `${SITE_URL}/#lodging`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const postalAddress = {
  "@type": "PostalAddress",
  streetAddress: ADDRESS.streetAddress,
  addressLocality: ADDRESS.addressLocality,
  addressRegion: ADDRESS.addressRegion,
  postalCode: ADDRESS.postalCode,
  addressCountry: ADDRESS.addressCountry,
};

const geoCoordinates = {
  "@type": "GeoCoordinates",
  latitude: GEO.latitude,
  longitude: GEO.longitude,
};

/** Organization — brand identity + sameAs profiles */
export function organizationSchema() {
  return {
    "@type": ["Organization", "NGO"],
    "@id": ORG_ID,
    name: SITE.name,
    legalName: SITE.legalName,
    alternateName: SITE.alternateNames,
    url: SITE_URL,
    logo: absoluteUrl("/logo.png"),
    image: absoluteUrl(SITE.ogImage),
    email: SITE.email,
    telephone: SITE.primaryPhone,
    foundingDate: SITE.foundingYear,
    address: postalAddress,
    sameAs: [...SOCIAL_PROFILES],
  };
}

/** LodgingBusiness — the affordable ashram / dharmshala stay (local money entity) */
export function lodgingBusinessSchema() {
  return {
    "@type": ["LodgingBusiness", "LocalBusiness"],
    "@id": LODGING_ID,
    name: SITE.name,
    alternateName: SITE.alternateNames,
    description: SITE.description,
    url: SITE_URL,
    image: [
      absoluteUrl("/home-img.png"),
      absoluteUrl("/rishikesh-ahsram.jpeg"),
      absoluteUrl(SITE.ogImage),
    ],
    logo: absoluteUrl("/logo.png"),
    telephone: SITE.primaryPhone,
    email: SITE.email,
    priceRange: SITE.priceRange,
    currenciesAccepted: "INR",
    address: postalAddress,
    geo: geoCoordinates,
    hasMap: `https://www.google.com/maps?q=${GEO.latitude},${GEO.longitude}`,
    parentOrganization: { "@id": ORG_ID },
    sameAs: [...SOCIAL_PROFILES],
    amenityFeature: [
      { "@type": "LocationFeatureSpecification", name: "Daily Yoga & Meditation", value: true },
      { "@type": "LocationFeatureSpecification", name: "Daily Ganga Aarti", value: true },
      { "@type": "LocationFeatureSpecification", name: "Vegetarian Meals (Annakshetra / Langar)", value: true },
      { "@type": "LocationFeatureSpecification", name: "On the banks of the Ganges", value: true },
      { "@type": "LocationFeatureSpecification", name: "Free Wi‑Fi", value: true },
    ],
    knowsLanguage: ["en", "hi"],
    areaServed: { "@type": "City", name: "Rishikesh" },
  };
}

/** WebSite (no SearchAction — the site has no site-wide search endpoint) */
export function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: SITE_URL,
    name: SITE.name,
    description: SITE.description,
    inLanguage: "en-IN",
    publisher: { "@id": ORG_ID },
  };
}

/** The site-wide @graph rendered on every public page */
export function siteGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [organizationSchema(), lodgingBusinessSchema(), websiteSchema()],
  };
}

/** BreadcrumbList helper */
export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** Product schema for shop items */
export function productSchema(product: {
  name: string;
  description?: string;
  image?: string;
  price?: number | string;
  currency?: string;
  availability?: "InStock" | "OutOfStock" | "PreOrder";
  url: string;
  sku?: string;
}) {
  const offer =
    product.price != null
      ? {
          offers: {
            "@type": "Offer",
            price: String(product.price),
            priceCurrency: product.currency ?? "INR",
            availability: `https://schema.org/${product.availability ?? "InStock"}`,
            url: absoluteUrl(product.url),
            seller: { "@id": ORG_ID },
          },
        }
      : {};
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    image: product.image ? absoluteUrl(product.image) : undefined,
    sku: product.sku,
    brand: { "@type": "Brand", name: SITE.name },
    ...offer,
  };
}

/** BlogPosting / Article schema */
export function blogPostingSchema(post: {
  title: string;
  description?: string;
  image?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    image: post.image ? absoluteUrl(post.image) : absoluteUrl(SITE.ogImage),
    datePublished: post.datePublished,
    dateModified: post.dateModified ?? post.datePublished,
    author: { "@type": "Organization", name: post.authorName ?? SITE.name, "@id": ORG_ID },
    publisher: { "@id": ORG_ID },
    mainEntityOfPage: absoluteUrl(post.url),
  };
}
