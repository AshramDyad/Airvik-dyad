import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootLayoutPath = join(process.cwd(), "src/app/layout.tsx");
const loaderPath = join(
  process.cwd(),
  "src/components/sticky-booking-button-loader.tsx",
);
const stickyButtonPath = join(
  process.cwd(),
  "src/components/sticky-booking-button.tsx",
);

describe("sticky booking button code splitting", () => {
  it("keeps the root layout from directly importing the sticky booking widget", () => {
    const layoutSource = readFileSync(rootLayoutPath, "utf8");
    const loaderSource = readFileSync(loaderPath, "utf8");

    expect(layoutSource).toContain("StickyBookingButtonLoader");
    expect(layoutSource).not.toContain(
      'import { StickyBookingButton } from "@/components/sticky-booking-button"',
    );
    expect(loaderSource).toContain("dynamic(");
    expect(loaderSource).toContain("./sticky-booking-button");
  });

  it("uses deferred room preview data instead of global room type context", () => {
    const stickySource = readFileSync(stickyButtonPath, "utf8");

    expect(stickySource).toContain("useRoomTypePreview");
    expect(stickySource).toContain("isOpen && !isAdminRoute");
    expect(stickySource).not.toContain("@/context/data-context");
    expect(stickySource).not.toContain("useDataContext");
  });
});
