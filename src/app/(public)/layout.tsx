import * as React from "react";
import { Header } from "@/components/marketing/layout/Header";
import { Footer } from "@/components/marketing/layout/Footer";
import { ScrollToTopButton } from "@/components/marketing/layout/ScrollToTopButton";
import { getCachedPublicPropertyLocation } from "@/lib/server/public-property";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const propertyLocation = await getCachedPublicPropertyLocation();

  return (
    <>
      <Header propertyLocation={propertyLocation} />
      <main className="flex-1">{children}</main>
      <Footer propertyLocation={propertyLocation} />
      <ScrollToTopButton />
    </>
  );
}
