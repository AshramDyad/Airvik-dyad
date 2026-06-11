import { test, expect } from "@playwright/test";

/**
 * Responsive specs: no horizontal overflow at the standard breakpoints.
 *
 * Runs per Playwright project (desktop / tablet / mobile from playwright.config.ts) and also
 * sweeps explicit widths within each run. Override routes with E2E_ROUTES (comma-separated).
 */
const ROUTES = (process.env.E2E_ROUTES ?? "/").split(",").map((r) => r.trim()).filter(Boolean);
const WIDTHS = [375, 768, 1280, 1440];

for (const route of ROUTES) {
  for (const width of WIDTHS) {
    test(`responsive: ${route} @ ${width}px has no horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route, { waitUntil: "networkidle" });

      const { docW, winW } = await page.evaluate(() => ({
        docW: document.documentElement.scrollWidth,
        winW: window.innerWidth,
      }));

      expect(docW, `${route} overflows at ${width}px (doc ${docW} > win ${winW})`).toBeLessThanOrEqual(winW + 1);
    });
  }
}
