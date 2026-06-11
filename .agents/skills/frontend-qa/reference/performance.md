# Performance audit & optimization

## How to run

- **Lighthouse:** `npm run audit:lh -- <url>` (desktop) or `... -- <url> --mobile`. Prints
  category scores + Core Web Vitals + the top time-saving opportunities, and writes a full
  HTML/JSON report to `.frontend-qa/lighthouse/`. Exits non-zero if performance < `LH_MIN_PERF`
  (default 0.5).
- **Bundle size:** `npm run audit:bundle` (= `ANALYZE=true next build`) opens a treemap of the
  client/server bundles via `@next/bundle-analyzer`. Use it to find oversized dependencies.

> Lighthouse is a **lab** measurement on your machine — treat scores as relative/diagnostic,
> not as the field Core Web Vitals Google reports. Use it to find regressions and opportunities.
>
> **Audit a production build, not `npm run dev`.** The dev server is unminified and compiles
> on demand, so it reports wildly inflated LCP/TBT and low perf scores (e.g. LCP ~20s, perf ~35)
> that say nothing about production. For real numbers: `npm run build && npm run start`, then
> point the audit at that server. Use dev-mode runs only for a11y/best-practices/SEO and for
> spotting *relative* regressions.

## Core Web Vitals thresholds

| Metric | Good | Needs work | Poor | Measures |
| --- | --- | --- | --- | --- |
| **LCP** (Largest Contentful Paint) | ≤ 2.5s | ≤ 4.0s | > 4.0s | Loading |
| **INP** (Interaction to Next Paint) | ≤ 200ms | ≤ 500ms | > 500ms | Responsiveness |
| **CLS** (Cumulative Layout Shift) | ≤ 0.1 | ≤ 0.25 | > 0.25 | Visual stability |

Lighthouse reports **TBT** (Total Blocking Time) as a lab proxy for INP, plus FCP and Speed Index.

## Common wins (Next.js 15 / React 19, this app)

**LCP**
- Use `next/image` with `width`/`height` and `priority` on the hero/above-the-fold image.
  (Note: this project sets `images.unoptimized: true` — revisit if image LCP is poor.)
- `next/font` for self-hosted fonts (avoid layout-shifting webfont swaps).
- Keep the LCP element in the initial server-rendered HTML; avoid client-only fetch waterfalls.

**CLS**
- Always reserve space: explicit image dimensions, fixed-height skeletons, no content injected
  above existing content. Charts (recharts) and async data are common CLS sources here.

**TBT / INP (JS weight)**
- `dynamic(() => import(...), { ssr: false })` for heavy, below-the-fold client components
  (charts, editors — this app uses recharts, tiptap, jspdf, embla).
- Push work to Server Components; keep `"use client"` boundaries small.
- Tree-shake imports (import specific functions, not whole libraries).

**Bundle**
- Run `audit:bundle` and look for heavyweight deps pulled into the client bundle (e.g. `jspdf`,
  `jspdf-autotable`, `razorpay`, charting). Lazy-load or move server-side where possible.

## Workflow

1. Audit (desktop + `--mobile`); record the scores and the single biggest opportunity.
2. Apply one targeted fix (follow `performance` and `vercel-react-best-practices`).
3. Re-run the same audit; report before → after. Don't batch many changes before measuring.
