import type { Metadata } from "next";
import { Inter, Source_Serif_4, JetBrains_Mono } from "next/font/google";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/counter.css";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/context/session-context";
import { AuthProvider } from "@/context/auth-context";
import { DataProvider } from "@/context/data-context";
import { StickyBookingButton } from "@/components/sticky-booking-button";

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
  title: "Sahajanand Ashram | Rishikesh",
  description:
    "A spiritual ashram in Rishikesh dedicated to religious, educational, and health-related activities. Experience tranquility and spiritual rejuvenation.",
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
        className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable} font-sans antialiased`}
        suppressHydrationWarning
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
