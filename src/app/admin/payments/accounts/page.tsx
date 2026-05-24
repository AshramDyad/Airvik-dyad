import type { Metadata } from "next";

import { requirePageFeature } from "@/lib/server/page-auth";
import { AccountsClient } from "./accounts-client";

export const metadata: Metadata = {
  title: "Accounts | Admin",
};

export default async function AdminPaymentAccountsPage() {
  await requirePageFeature("payments");

  return <AccountsClient />;
}
