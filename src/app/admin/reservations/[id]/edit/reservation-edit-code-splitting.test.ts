import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pagePath = join(
  process.cwd(),
  "src/app/admin/reservations/[id]/edit/page.tsx",
);
const loaderPath = join(
  process.cwd(),
  "src/app/admin/reservations/[id]/edit/reservation-edit-client-loader.tsx",
);
const clientPath = join(
  process.cwd(),
  "src/app/admin/reservations/[id]/edit/reservation-edit-client.tsx",
);

describe("admin reservation edit code splitting", () => {
  it("keeps the route page as a server shell around the client edit workflow", () => {
    const pageSource = readFileSync(pagePath, "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(pageSource).toContain("ReservationEditClientLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("@/context/data-context");
    expect(pageSource).not.toContain("useParams");
    expect(loaderSource).toContain("const DynamicReservationEditClient = dynamic");
    expect(loaderSource).toContain("./reservation-edit-client");
  });

  it("defers the reservation edit form out of the initial edit page chunk", () => {
    const pageSource = readFileSync(clientPath, "utf8");

    expect(pageSource).toContain("dynamic(");
    expect(pageSource).toContain(
      "@/app/admin/reservations/components/reservation-edit-form",
    );
    expect(pageSource).not.toContain(
      'import { ReservationEditForm } from "@/app/admin/reservations/components/reservation-edit-form"',
    );
  });
});
