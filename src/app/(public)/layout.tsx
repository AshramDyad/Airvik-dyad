import * as React from "react";
import { Header } from "@/components/marketing/layout/Header";
import { Footer } from "@/components/marketing/layout/Footer";
import { ScrollToTopButton } from "@/components/marketing/layout/ScrollToTopButton";
import { getServerSupabaseClient } from "@/lib/server/supabase";
import type { Property } from "@/data/types";
import { JsonLd } from "@/components/seo/json-ld";
import { siteGraph } from "@/lib/seo/structured-data";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await getServerSupabaseClient();
  const { data } = await supabase
    .from("properties")
    .select("address, google_maps_url")
    .limit(1)
    .maybeSingle();

  const propertyLocation: Pick<Property, "address" | "google_maps_url"> = {
    address: data?.address?.trim() ?? "",
    google_maps_url: data?.google_maps_url?.trim() ?? "",
  };

  return (
    <>
      <JsonLd data={siteGraph()} />
      <Header propertyLocation={propertyLocation} />
      <main className="flex-1">{children}</main>
      <Footer propertyLocation={propertyLocation} />
      <ScrollToTopButton />
    </>
  );
}
