import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const guestsDir = join(process.cwd(), "src/app/admin/guests");
const componentsDir = join(guestsDir, "components");

describe("admin guests index egress", () => {
  it("uses a paginated route-backed hook instead of global guests data", () => {
    const panelSource = readFileSync(
      join(componentsDir, "guests-panel.tsx"),
      "utf8",
    );

    expect(panelSource).toContain("useGuestsPage");
    expect(panelSource).not.toContain("const { guests } = useDataContext()");
    expect(panelSource).not.toContain("data={guests}");
  });

  it("keeps guest search and pagination server-controlled", () => {
    const tableSource = readFileSync(
      join(componentsDir, "data-table.tsx"),
      "utf8",
    );

    expect(tableSource).toContain("manualPagination: true");
    expect(tableSource).toContain("onSearch");
    expect(tableSource).not.toContain("getFilteredRowModel");
    expect(tableSource).not.toContain("getPaginationRowModel");
  });
});
