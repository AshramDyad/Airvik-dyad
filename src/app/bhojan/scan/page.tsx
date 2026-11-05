import type { Metadata } from 'next';
import Scanner from './scanner';
export const metadata: Metadata = {
  title: 'Bhojan scanner', manifest: '/bhojan/manifest.webmanifest', robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Bhojan scanner', statusBarStyle: 'black-translucent' },
  icons: { apple: '/bhojan/icon-180.png' },
};
export default function ScannerPage() { return <Scanner />; }
