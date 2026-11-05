'use client';
import type { ReactNode } from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { SessionProvider } from '@/context/session-context';
import { AuthProvider } from '@/context/auth-context';
import { DataProvider } from '@/context/data-context';
import { StickyBookingButton } from '@/components/sticky-booking-button';
import { Toaster } from '@/components/ui/sonner';
import { GoogleAnalytics } from '@next/third-parties/google';
export default function SiteProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
    <SessionProvider><AuthProvider><DataProvider>{children}<StickyBookingButton /><Toaster position="top-right" /></DataProvider></AuthProvider></SessionProvider>
    {process.env.NEXT_PUBLIC_GA_ID ? <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} /> : null}
  </ThemeProvider>;
}
