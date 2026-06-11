#!/usr/bin/env node
/**
 * Lighthouse audit (performance, accessibility, best-practices, SEO) + Core Web Vitals.
 *
 * Usage:
 *   node .claude/skills/frontend-qa/scripts/audit-lighthouse.mjs <url> [--mobile]
 *   npm run audit:lh -- http://localhost:3000/admin/owner-overview
 *
 * Env:
 *   E2E_BASE_URL   base URL for relative paths (default http://localhost:3000)
 *   LH_OUT         dir for the full JSON+HTML report (default .frontend-qa/lighthouse)
 *
 * Flags:
 *   --mobile       emulate a mobile device (default is desktop)
 *
 * Output: scores + key metrics + top opportunities on stderr; summary JSON on stdout.
 * Exit code: 1 if the performance score is below LH_MIN_PERF (default 0.5), else 0.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const OUT = process.env.LH_OUT ?? ".frontend-qa/lighthouse";
const MIN_PERF = Number(process.env.LH_MIN_PERF ?? 0.5);

const args = process.argv.slice(2);
const mobile = args.includes("--mobile");
const target = args.find((a) => !a.startsWith("--")) ?? "/admin/owner-overview";
const url = target.startsWith("http") ? target : new URL(target, BASE).href;

const chrome = await chromeLauncher.launch({
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-gpu"],
});

try {
  const { lhr, report } = await lighthouse(
    url,
    { logLevel: "error", output: ["json", "html"], port: chrome.port },
    {
      extends: "lighthouse:default",
      settings: {
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        formFactor: mobile ? "mobile" : "desktop",
        screenEmulation: mobile
          ? { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false }
          : { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false },
      },
    },
  );

  mkdirSync(OUT, { recursive: true });
  const slug = url.replace(/[^a-z0-9]+/gi, "_").slice(0, 80);
  writeFileSync(join(OUT, `${slug}.json`), report[0]);
  writeFileSync(join(OUT, `${slug}.html`), report[1]);

  const scores = Object.fromEntries(
    Object.entries(lhr.categories).map(([k, v]) => [k, v.score == null ? null : Math.round(v.score * 100)]),
  );
  const metric = (id) => lhr.audits[id]?.displayValue ?? lhr.audits[id]?.numericValue;
  const vitals = {
    LCP: metric("largest-contentful-paint"),
    CLS: metric("cumulative-layout-shift"),
    TBT: metric("total-blocking-time"),
    FCP: metric("first-contentful-paint"),
    SpeedIndex: metric("speed-index"),
  };
  const opportunities = Object.values(lhr.audits)
    .filter((a) => a.details?.type === "opportunity" && (a.numericValue ?? 0) > 0)
    .sort((a, b) => (b.numericValue ?? 0) - (a.numericValue ?? 0))
    .slice(0, 8)
    .map((a) => ({ id: a.id, title: a.title, savingsMs: Math.round(a.numericValue ?? 0) }));

  process.stderr.write(`\n# lighthouse (${mobile ? "mobile" : "desktop"}) ${url}\n`);
  process.stderr.write(`  scores:  ${JSON.stringify(scores)}\n`);
  process.stderr.write(`  vitals:  ${JSON.stringify(vitals)}\n`);
  if (opportunities.length) {
    process.stderr.write(`  top opportunities:\n`);
    for (const o of opportunities) process.stderr.write(`    - ${o.title} (~${o.savingsMs}ms) [${o.id}]\n`);
  }
  process.stderr.write(`  full report: ${join(OUT, slug + ".html")}\n`);

  process.stdout.write(JSON.stringify({ url, mobile, scores, vitals, opportunities }, null, 2) + "\n");
  process.exit((scores.performance ?? 100) / 100 < MIN_PERF ? 1 : 0);
} finally {
  await chrome.kill();
}
