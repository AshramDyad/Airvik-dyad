import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility specs (WCAG 2.x A + AA) via axe-core.
 *
 * Routes default to the public home page. Override with a comma-separated E2E_ROUTES,
 * e.g. E2E_ROUTES="/,/admin/owner-overview". Authenticated routes require a stored
 * auth state (see playwright.config.ts `use.storageState`) or they'll redirect to login.
 */
const ROUTES = (process.env.E2E_ROUTES ?? "/").split(",").map((r) => r.trim()).filter(Boolean);
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

for (const route of ROUTES) {
  test(`a11y: ${route} has no critical/serious violations`, async ({ page }) => {
    await page.goto(route, { waitUntil: "networkidle" });

    const { violations } = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
    const blocking = violations.filter((v) => v.impact === "critical" || v.impact === "serious");

    if (blocking.length) {
      console.log(
        `\naxe violations on ${route}:\n` +
          blocking.map((v) => `  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`).join("\n"),
      );
    }
    expect(blocking, `critical/serious a11y violations on ${route}`).toEqual([]);
  });
}
