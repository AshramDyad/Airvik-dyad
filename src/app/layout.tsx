import type { Metadata } from "next";
import { SITE, SITE_URL, ALL_KEYWORDS } from "@/config/site";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "./globals.css";
import { RouteProviders } from "@/components/route-providers";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    // Homepage default (the `/` route is a client component and inherits this).
    // Foregrounds the searched brand "Shree Swaminarayan Ashram Rishikesh".
    default:
      "Shree Swaminarayan Ashram Rishikesh | Budget Ganga-Side Stay",
    // Every child page that sets a short title gets the brand suffix appended.
    template: `%s | ${SITE.titleSuffix}`,
  },
  description:
    "Sahajanand Wellness — an affordable ashram and dharmshala on the banks of the Ganges at Muni Ki Reti, Rishikesh. Budget-friendly, peaceful stays with daily yoga, meditation, Ganga Aarti and vegetarian meals for pilgrims and travellers.",
  keywords: ALL_KEYWORDS,
  applicationName: SITE.name,
  authors: [{ name: SITE.name, url: SITE_URL }],
  creator: SITE.name,
  publisher: SITE.name,
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    title:
      "Shree Swaminarayan Ashram Rishikesh | Budget Ganga-Side Stay",
    description:
      "Budget-friendly ashram & dharamshala stays on the banks of the Ganges in Rishikesh. Daily yoga, meditation, Ganga Aarti and vegetarian meals.",
    url: SITE_URL,
    locale: "en_IN",
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Shree Swaminarayan Ashram Rishikesh | Budget Ganga-Side Stay",
    description:
      "Budget-friendly ashram & dharamshala stays on the banks of the Ganges in Rishikesh. Daily yoga, meditation & Ganga Aarti.",
    images: [SITE.ogImage],
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className="font-sans antialiased"
      >
        <RouteProviders>{children}</RouteProviders>
      </body>
    </html>
  );
}
