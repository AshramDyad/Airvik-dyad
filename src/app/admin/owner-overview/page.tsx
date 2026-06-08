import type { Metadata } from "next";

import { requirePageFeature } from "@/lib/server/page-auth";
import { OwnerOverviewClient } from "./owner-overview-client";

export const metadata: Metadata = {
  title: "Owner Overview | Admin",
};

export default async function OwnerOverviewPage() {
  await requirePageFeature("ownerOverview");
  return <OwnerOverviewClient />;
}
