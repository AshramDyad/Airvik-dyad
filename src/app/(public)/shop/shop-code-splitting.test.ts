import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const shopDir = join(process.cwd(), "src/app/(public)/shop");

describe("shop page code splitting", () => {
  it("keeps the route page as a server shell with the static hero", () => {
    const pageSource = readFileSync(join(shopDir, "page.tsx"), "utf8");
    const loaderSource = readFileSync(
      join(shopDir, "shop-catalog-client-loader.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("ShopCatalogClientLoader");
    expect(pageSource).toContain('src="/store.jpg"');
    expect(pageSource).not.toContain('"use client"');
    expect(pageSource).not.toContain("'use client'");
    expect(pageSource).not.toContain("useState");
    expect(pageSource).not.toContain("@/components/marketing/shop/ShopFiltersToolbar");
    expect(pageSource).not.toContain("@/components/marketing/shop/products");
    expect(loaderSource).toContain("const DynamicShopCatalogClient = dynamic");
    expect(loaderSource).toContain("./shop-catalog-client");
  });

  it("sizes the shop hero for viewport-width image variants", () => {
    const pageSource = readFileSync(join(shopDir, "page.tsx"), "utf8");

    expect(pageSource).toContain('sizes="100vw"');
  });

  it("keeps the interactive filter and catalog workflow in the client module", () => {
    const clientSource = readFileSync(
      join(shopDir, "shop-catalog-client.tsx"),
      "utf8",
    );

    expect(clientSource).toContain('"use client"');
    expect(clientSource).toContain("@/components/marketing/shop/ShopFiltersToolbar");
    expect(clientSource).toContain("@/components/marketing/shop/products");
    expect(clientSource).toContain("@/components/marketing/shop/ProductCard");
  });
});
