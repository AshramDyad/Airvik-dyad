import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const guestDetailDir = join(process.cwd(), "src/app/admin/guests/[id]");

describe("admin guest detail code splitting", () => {
  it("keeps the route page as a server shell around the client guest workflow", () => {
    const pageSource = readFileSync(join(guestDetailDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(guestDetailDir, "guest-details-client-loader.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("GuestDetailsClientLoader");
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("@/context/data-context");
    expect(pageSource).not.toContain("@/hooks/use-guest-reservations");
    expect(pageSource).not.toContain("@/components/ui/table");
    expect(pageSource).not.toContain("@/lib/countries");
    expect(loaderSource).toContain("const DynamicGuestDetailsClient = dynamic");
    expect(loaderSource).toContain("./guest-details-client");
  });

  it("uses a route-backed single guest profile instead of global guests data", () => {
    const clientSource = readFileSync(
      join(guestDetailDir, "guest-details-client.tsx"),
      "utf8",
    );

    expect(clientSource).toContain("useGuestProfile");
    expect(clientSource).not.toContain("guests,");
    expect(clientSource).not.toContain(".find((g) => g.id === guestIdFromParams)");
  });

  it("uses route-backed reservation room numbers instead of global room rows", () => {
    const clientSource = readFileSync(
      join(guestDetailDir, "guest-details-client.tsx"),
      "utf8",
    );

    expect(clientSource).toContain("useGuestReservations");
    expect(clientSource).toContain("roomNumber");
    expect(clientSource).not.toContain("rooms } = useDataContext");
    expect(clientSource).not.toContain("rooms ??");
  });
});
