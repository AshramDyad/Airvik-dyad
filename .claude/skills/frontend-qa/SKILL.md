---
name: frontend-qa
description: "Autonomously test, debug, and improve the running frontend with a real browser. Drives the Playwright MCP plus Lighthouse / axe-core scripts to check responsive layouts, capture console & network errors, audit accessibility (WCAG) and performance (Core Web Vitals), then report and apply prioritized fixes. Triggers on: 'test the UI', 'debug the frontend', 'check responsive', 'is this mobile friendly', 'accessibility audit', 'a11y', 'WCAG', 'performance audit', 'Core Web Vitals', 'Lighthouse', 'why is the page broken', 'check console errors', 'visual check', 'optimize the page'."
metadata:
  author: airvik
  version: "1.0.0"
  argument-hint: <route-or-url>
---

# Frontend QA

Autonomous loop for inspecting and improving the **running** app in a real browser.
The persistent artifacts are the captured evidence (screenshots, console/network logs,
audit JSON) and the fixes you apply — not the browser session.

This is for **the app's own UI** (`http://localhost:3000`). It is NOT for automating
external websites.

## Tools this skill uses

- **Playwright MCP** (`mcp__playwright__*`) — primary, interactive engine: `browser_navigate`,
  `browser_snapshot`, `browser_take_screenshot`, `browser_resize`, `browser_click`,
  `browser_console_messages`, `browser_network_requests`, `browser_evaluate`. Configured in
  the project's `.mcp.json`.
- **Audit scripts** (batch, deterministic, file-output):
  - `npm run audit:responsive -- <url>` — breakpoint sweep + overflow / tap-target flags
  - `npm run audit:a11y -- <url>` — axe-core WCAG 2.2 AA violations
  - `npm run audit:lh -- <url>` — Lighthouse perf/a11y/best-practices/SEO + Core Web Vitals
  - `npm run audit:bundle` — `@next/bundle-analyzer` treemap (`ANALYZE=true next build`)

Prefer **MCP** for interactive exploration and root-causing; prefer **scripts** for
repeatable, full-coverage audits and before/after comparison.

## The loop

1. **Ensure the server is up.** Target `http://localhost:3000`. Check with a quick MCP
   navigate; if it fails, start `npm run dev` in the background and wait for the port. The
   audit scripts and `playwright.config.ts` auto-start/reuse the dev server, so they work
   either way.
2. **Capture baseline.** MCP: `browser_navigate` to the route → `browser_snapshot` (the
   accessibility tree is cheaper and more semantic than a screenshot) → `browser_console_messages`
   → `browser_network_requests`. Note any errors or failed requests up front.
3. **Responsive sweep.** Run `audit:responsive` (or MCP `browser_resize` at 375 / 768 / 1280 / 1440).
   See `reference/responsive.md`.
4. **Accessibility.** Run `audit:a11y`. Triage critical/serious first. See `reference/accessibility.md`.
5. **Performance.** Run `audit:lh` (add `--mobile` for the mobile profile) and, for bundle weight,
   `audit:bundle`. See `reference/performance.md`.
6. **Diagnose.** Tie symptoms to causes: console/page errors and 4xx/5xx requests usually
   explain visual breakage. See `reference/debugging.md`.
7. **Report** a prioritized, actionable list (see format below).
8. **Fix & re-verify.** Apply safe, in-scope fixes, then re-run the relevant audit to confirm
   the metric/violation actually moved. Don't claim a fix without re-running.

## Authenticated routes (IMPORTANT)

Admin pages — including `/admin/owner-overview` — are gated and **redirect to `/login`**
when there's no session. By default the audits hit the public route they're given, so an
unauthenticated run against an admin URL silently audits the login page instead. To QA an
admin route you must give the browser a logged-in session:

- **MCP path (easiest, interactive):** `browser_navigate` to `/login`, log in via
  `browser_type` / `browser_click` (or ask the user to log in in the opened browser), then
  navigate to the admin route in the same session and run your inspection.
- **Script / e2e path (repeatable):** capture a Playwright `storageState` once and reuse it:
  1. Log in once and save state to `.frontend-qa/auth.json` (e.g. script a login that calls
     `context.storageState({ path: ".frontend-qa/auth.json" })`).
  2. Point the audit scripts at it with `STORAGE_STATE=.frontend-qa/auth.json` (the scripts
     load it when set) and pass the admin URL.
  3. For specs, add `use: { storageState: ".frontend-qa/auth.json" }` (or a `setup` project)
     in `playwright.config.ts`, then run with `E2E_ROUTES="/admin/owner-overview"`.

Never commit `auth.json` (it lives under the git-ignored `.frontend-qa/`). If you skip this,
say so in the report — don't imply an admin page was covered when only `/login` was audited.

## Scope rules

- Default to read-only investigation. Apply code changes only when the user asked you to
  fix/improve, and keep them minimal and reviewable.
- Re-run the specific audit after each fix; report the before → after delta.
- Never weaken a check to make it pass (e.g. don't disable an axe rule to hide a real failure).
  Surface trade-offs instead.

## When fixing, defer to the repo's specialist skills

Don't duplicate their guidance — read and follow them:
- `fixing-accessibility` — concrete ARIA / focus / contrast fixes
- `web-design-guidelines` — UX & interface-quality review
- `tailwind-design-system` — responsive utility patterns
- `vercel-react-best-practices` / `nextjs-app-router-patterns` — perf & rendering fixes
- `fixing-motion-performance` — animation jank
- `performance` — load-time optimization playbook
- `shadcn-ui` — component-level patterns (this app is shadcn + Radix + Tailwind)

## Report format

```
## Frontend QA — <route>  (<viewport/profile>)
### Blocking        # broken UI, console errors, failed requests, critical a11y
- <symptom> → <root cause> → <fix>  (file:line)
### Responsive      # per breakpoint: overflow, tap targets, layout breaks
### Accessibility   # axe critical/serious, then moderate
### Performance     # LCP / CLS / TBT(INP) / bundle, with the biggest opportunity first
### Evidence        # screenshot paths + audit JSON locations
```

## Reference files (load as needed)

- `reference/debugging.md` — console / page errors, network failures, root-causing via MCP
- `reference/responsive.md` — breakpoints, common bugs, the resize+screenshot loop
- `reference/accessibility.md` — axe-core usage, WCAG 2.2 AA, triage
- `reference/performance.md` — Lighthouse, Core Web Vitals thresholds, Next.js wins
