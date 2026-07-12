/**
 * Central SEO / brand configuration — single source of truth for metadata,
 * structured data (JSON-LD), sitemap, robots and llms.txt.
 *
 * Keep NAP (Name, Address, Phone) identical here, in Google Business Profile,
 * and across every citation to preserve local-SEO consistency.
 */

export const SITE_URL = "https://www.swaminarayan.yoga";

/** Brand / organization identity */
export const SITE = {
  /** Legal / primary name */
  name: "Sahajanand Wellness",
  /** Common short name used in titles */
  shortName: "Sahajanand Ashram",
  /** Alternate names people search for */
  alternateNames: [
    "Sahajanand Ashram",
    "Sahajanand Wellness Ashram",
    "Rishikesh Dham",
    "Swaminarayan Ashram Rishikesh",
  ],
  legalName: "Sahajanand Wellness (Registered Religious Trust)",
  url: SITE_URL,
  /** Title suffix applied to every page via the metadata template (kept short to avoid SERP truncation) */
  titleSuffix: "Sahajanand Wellness",
  description:
    "Sahajanand Wellness is an affordable spiritual ashram and dharmshala on the banks of the Ganges at Muni Ki Reti, Rishikesh. Simple, budget-friendly stays with daily yoga, meditation, Ganga Aarti, langar and Vedic classes for pilgrims and travellers.",
  email: "ashram@swaminarayan.yoga",
  /** First phone is primary; all appear in schema */
  phones: ["+918511151708", "+919411109999", "+919319825050"] as const,
  primaryPhone: "+918511151708",
  foundingYear: "2002",
  priceRange: "₹",
  /** Default social share image (see public/og-image.png) */
  ogImage: "/og-image.png",
} as const;

/** Physical address (must match GBP + citations exactly) */
export const ADDRESS = {
  streetAddress: "Gali No.13, Shisham Jhadi, Muni Ki Reti, Near Ganga Kinare",
  addressLocality: "Rishikesh",
  addressRegion: "Uttarakhand",
  postalCode: "249201",
  addressCountry: "IN",
  /** Human-readable single line */
  full: "Gali No.13, Shisham Jhadi, Muni Ki Reti, Near Ganga Kinare, Rishikesh, Uttarakhand 249201, India",
} as const;

/** Geo coordinates (from Google Maps place) */
export const GEO = {
  latitude: 30.1114061,
  longitude: 78.307545,
} as const;

/** Social / sameAs profiles */
export const SOCIAL_PROFILES = [
  "https://facebook.com/Rishikeshdhamofficial",
  "https://instagram.com/rishikeshdhamofficial",
  "https://www.youtube.com/@rishikeshdham",
  "https://x.com/Rishikeshdham",
  "https://www.threads.net/@rishikeshdhamofficial",
  "https://linkedin.com/company/rishikeshdham",
] as const;

/**
 * Keyword strategy — target intent: "best affordable ashram and hotel in Rishikesh".
 * Used to inform (not stuff) titles, descriptions and body copy.
 */
export const KEYWORDS = {
  primary: [
    "affordable ashram in Rishikesh",
    "ashram in Rishikesh",
    "budget ashram Rishikesh",
    "dharmshala in Rishikesh",
    "ashram stay Rishikesh",
    "yoga ashram Rishikesh",
  ],
  secondary: [
    "ashram near Ganga Rishikesh",
    "Muni Ki Reti ashram",
    "dharamshala near Ram Jhula",
    "spiritual retreat Rishikesh",
    "budget hotel in Rishikesh",
    "Ganga Aarti Rishikesh",
  ],
  longTail: [
    "best affordable ashram and hotel in Rishikesh",
    "affordable ashram stay in Rishikesh near Ganga",
    "budget dharmshala in Muni Ki Reti Rishikesh",
    "ashram with daily Ganga aarti in Rishikesh",
    "cheap ashram accommodation in Rishikesh for pilgrims",
    "peaceful ashram stay on the banks of the Ganges Rishikesh",
    "yoga and meditation ashram stay in Rishikesh",
    "family dharmshala rooms in Rishikesh near Ganga",
  ],
} as const;

/** Flat keyword list for the metadata `keywords` field */
export const ALL_KEYWORDS: string[] = [
  ...KEYWORDS.primary,
  ...KEYWORDS.secondary,
  ...KEYWORDS.longTail,
];

/** Public routes that belong in the sitemap (static set; blog/shop appended dynamically) */
export const STATIC_PUBLIC_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency:
    | "always"
    | "hourly"
    | "daily"
    | "weekly"
    | "monthly"
    | "yearly"
    | "never";
}> = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/book", priority: 0.9, changeFrequency: "weekly" },
  { path: "/shop", priority: 0.8, changeFrequency: "weekly" },
  { path: "/amenities", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about-us", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about-rishikesh", priority: 0.7, changeFrequency: "monthly" },
  { path: "/ashram-glimpse", priority: 0.6, changeFrequency: "monthly" },
  { path: "/journey", priority: 0.6, changeFrequency: "monthly" },
  { path: "/sunil-bhagat", priority: 0.6, changeFrequency: "monthly" },
  { path: "/events", priority: 0.6, changeFrequency: "weekly" },
  { path: "/blog", priority: 0.6, changeFrequency: "weekly" },
  { path: "/brochure", priority: 0.5, changeFrequency: "yearly" },
  { path: "/donate", priority: 0.6, changeFrequency: "monthly" },
  { path: "/feedback", priority: 0.4, changeFrequency: "yearly" },
  // /privacy-policy is intentionally omitted — it is noindex.
];

/** Build an absolute URL from a path */
export function absoluteUrl(path = "/"): string {
  return new URL(path, SITE_URL).toString();
}
