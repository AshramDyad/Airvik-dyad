import type { Metadata } from "next";

import { requirePageFeature } from "@/lib/server/page-auth";
import { SettlementsClient } from "./settlements-client";

export const metadata: Metadata = {
  title: "Settlements | Admin",
};

export default async function AdminPaymentSettlementsPage() {
  await requirePageFeature("ownerOverview");

  return <SettlementsClient />;
}
