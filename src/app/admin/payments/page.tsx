import { requirePageFeature } from "@/lib/server/page-auth";

import { PaymentsClient } from "./payments-client";

export const metadata = {
  title: "Payments | Admin",
};

export default async function AdminPaymentsPage() {
  await requirePageFeature("payments");

  return <PaymentsClient />;
}
