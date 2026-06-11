#!/usr/bin/env node
/**
 * Responsive sweep: loads a route at standard breakpoints, screenshots each, and
 * flags the two most common responsive bugs — horizontal overflow and undersized
 * tap targets (< 24x24 CSS px per WCAG 2.2 SC 2.5.8; 44px is the comfortable target).
 *
 * Usage:
 *   node .claude/skills/frontend-qa/scripts/check-responsive.mjs <url>
 *   npm run audit:responsive -- http://localhost:3000/admin/owner-overview
 *
 * Env:
 *   E2E_BASE_URL    base URL for relative paths (default http://localhost:3000)
 *   SHOT_DIR        screenshot output dir (default .frontend-qa/responsive)
 *
 * Output: per-breakpoint findings on stderr; JSON on stdout.
 * Exit code: 1 if any breakpoint has horizontal overflow, else 0.
 */
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SHOT_DIR = process.env.SHOT_DIR ?? ".frontend-qa/responsive";

const BREAKPOINTS = [
  { name: "mobile", width: 375, height: 667 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
  { name: "wide", width: 1440, height: 900 },
];

const target = process.argv[2] ?? "/admin/owner-overview";
const url = target.startsWith("http") ? target : new URL(target, BASE).href;
const slug = url.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);

mkdirSync(SHOT_DIR, { recursive: true });
const browser = await chromium.launch();
// Reuse a saved auth session for gated/admin routes when STORAGE_STATE is set.
const context = await browser.newContext(
  process.env.STORAGE_STATE ? { storageState: process.env.STORAGE_STATE } : {},
);
const findings = [];
let overflowSeen = false;

for (const bp of BREAKPOINTS) {
  const page = await context.newPage();
  await page.setViewportSize({ width: bp.width, height: bp.height });
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 });

    const probe = await page.evaluate(() => {
      const docW = document.documentElement.scrollWidth;
      const winW = window.innerWidth;
      const overflowX = docW > winW + 1;

      // Elements that spill past the viewport's right edge.
      const offenders = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.right > winW + 1) {
          offenders.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className && typeof el.className === "string" ? el.className : "").slice(0, 60),
            right: Math.round(r.right),
          });
        }
        if (offenders.length >= 8) break;
      }

      // Interactive controls smaller than the 24px WCAG 2.2 minimum.
      const smallTargets = [];
      for (const el of document.querySelectorAll('a, button, [role="button"], input, select, textarea')) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24)) {
          smallTargets.push({
            tag: el.tagName.toLowerCase(),
            text: (el.textContent ?? "").trim().slice(0, 30),
            size: `${Math.round(r.width)}x${Math.round(r.height)}`,
          });
        }
        if (smallTargets.length >= 10) break;
      }

      return { docW, winW, overflowX, offenders, smallTargets };
    });

    const shot = join(SHOT_DIR, `${slug}__${bp.name}.png`);
    await page.screenshot({ path: shot, fullPage: true });
    if (probe.overflowX) overflowSeen = true;

    findings.push({ breakpoint: bp.name, width: bp.width, ...probe, screenshot: shot });

    process.stderr.write(`\n# ${bp.name} (${bp.width}px) ${url}\n`);
    process.stderr.write(
      `  horizontal overflow: ${probe.overflowX ? `YES (doc ${probe.docW} > win ${probe.winW})` : "no"}\n`,
    );
    if (probe.offenders.length)
      process.stderr.write(`  overflow offenders: ${probe.offenders.map((o) => `${o.tag}.${o.cls}`).join(", ")}\n`);
    if (probe.smallTargets.length)
      process.stderr.write(`  small tap targets (<24px): ${probe.smallTargets.length} — e.g. ${probe.smallTargets.slice(0, 3).map((t) => `${t.tag}"${t.text}"(${t.size})`).join(", ")}\n`);
    process.stderr.write(`  screenshot: ${shot}\n`);
  } catch (err) {
    findings.push({ breakpoint: bp.name, error: String(err) });
    process.stderr.write(`\n# ${bp.name} ERROR: ${err}\n`);
  } finally {
    await page.close();
  }
}

await browser.close();
process.stdout.write(JSON.stringify({ url, findings }, null, 2) + "\n");
process.exit(overflowSeen ? 1 : 0);
