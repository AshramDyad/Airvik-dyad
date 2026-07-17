import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { SITE, SITE_URL, ALL_KEYWORDS } from "@/config/site";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/context/session-context";
import { AuthProvider } from "@/context/auth-context";
import { DataProvider } from "@/context/data-context";
import { StickyBookingButton } from "@/components/sticky-booking-button";
import { absoluteMediaUrl } from "@/lib/cloudflare-images";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-serif",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    // Homepage default (the `/` route is a client component and inherits this).
    default:
      "Affordable Ashram & Hotel in Rishikesh | Sahajanand Wellness, Muni Ki Reti",
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
      "Affordable Ashram & Hotel in Rishikesh | Sahajanand Wellness, Muni Ki Reti",
    description:
      "Budget-friendly ashram & dharmshala stays on the banks of the Ganges in Rishikesh. Daily yoga, meditation, Ganga Aarti and vegetarian meals.",
    url: SITE_URL,
    locale: "en_IN",
    images: [{ url: absoluteMediaUrl(SITE.ogImage), width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Affordable Ashram & Hotel in Rishikesh | Sahajanand Wellness",
    description:
      "Budget-friendly ashram & dharmshala stays on the banks of the Ganges in Rishikesh. Daily yoga, meditation & Ganga Aarti.",
    images: [absoluteMediaUrl(SITE.ogImage)],
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
        className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <SessionProvider>
            <AuthProvider>
              <DataProvider>
                {children}
                <StickyBookingButton />
                <Toaster position="top-right" />
              </DataProvider>
            </AuthProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
