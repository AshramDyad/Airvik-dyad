import { requirePageFeature } from "@/lib/server/page-auth";

import { CreatePaymentClient } from "./create-payment-client";

export const metadata = {
  title: "Create Payment | Admin",
};

export default async function CreatePaymentPage() {
  await requirePageFeature("payments");

  return <CreatePaymentClient />;
}
