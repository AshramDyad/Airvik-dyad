'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
const SiteProviders = dynamic(() => import('./site-providers'));
export function RouteProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === '/bhojan/scan') return <>{children}</>;
  return <SiteProviders>{children}</SiteProviders>;
}
