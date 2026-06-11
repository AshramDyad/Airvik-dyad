#!/usr/bin/env node
/**
 * Accessibility audit (WCAG 2.0/2.1/2.2 A + AA) using axe-core in a real Chromium page.
 *
 * Usage:
 *   node .claude/skills/frontend-qa/scripts/audit-a11y.mjs <url> [<url> ...]
 *   npm run audit:a11y -- http://localhost:3000/admin/owner-overview
 *
 * Env:
 *   E2E_BASE_URL   base URL to resolve relative paths against (default http://localhost:3000)
 *   A11Y_TAGS      comma list of axe tags (default wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa)
 *
 * Output: human-readable summary on stderr, machine-readable JSON on stdout.
 * Exit code: 1 if any "critical" or "serious" violations are found, else 0.
 */
import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const TAGS = (process.env.A11Y_TAGS ?? "wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa")
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);

const targets = process.argv.slice(2);
if (targets.length === 0) targets.push("/admin/owner-overview");

const resolve = (u) => (u.startsWith("http") ? u : new URL(u, BASE).href);

const browser = await chromium.launch();
// @axe-core/playwright requires a page created from an explicit context.
// Reuse a saved auth session for gated/admin routes when STORAGE_STATE is set.
const context = await browser.newContext(
  process.env.STORAGE_STATE ? { storageState: process.env.STORAGE_STATE } : {},
);
const results = [];
let blocking = 0;

for (const target of targets) {
  const url = resolve(target);
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });
    const axe = await new AxeBuilder({ page }).withTags(TAGS).analyze();

    const violations = axe.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      helpUrl: v.helpUrl,
      nodes: v.nodes.length,
      targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
    }));

    const counts = violations.reduce((acc, v) => {
      acc[v.impact ?? "unknown"] = (acc[v.impact ?? "unknown"] ?? 0) + 1;
      return acc;
    }, {});
    blocking += (counts.critical ?? 0) + (counts.serious ?? 0);

    results.push({ url, counts, violations });

    process.stderr.write(`\n# a11y ${url}\n`);
    process.stderr.write(`  totals: ${JSON.stringify(counts)}\n`);
    for (const v of violations) {
      process.stderr.write(
        `  [${(v.impact ?? "?").toUpperCase()}] ${v.id} — ${v.help} (${v.nodes} node(s))\n` +
          `      e.g. ${v.targets[0] ?? "n/a"}  ·  ${v.helpUrl}\n`,
      );
    }
    if (violations.length === 0) process.stderr.write("  ✓ no violations\n");
  } catch (err) {
    results.push({ url, error: String(err) });
    process.stderr.write(`\n# a11y ${url}\n  ERROR: ${err}\n`);
  } finally {
    await page.close();
  }
}

await browser.close();
process.stdout.write(JSON.stringify({ base: BASE, tags: TAGS, results }, null, 2) + "\n");
process.exit(blocking > 0 ? 1 : 0);
