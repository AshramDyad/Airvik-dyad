# Debugging the running frontend (via Playwright MCP)

Goal: turn a vague "the page is broken" into a concrete `symptom → root cause → fix`.

## 1. Capture the three evidence streams

After `browser_navigate` to the route:

- **Accessibility snapshot** — `browser_snapshot`. Structured, semantic, cheap. This is your
  primary "what is on the page" view. Use it before reaching for a screenshot.
- **Console** — `browser_console_messages`. Filter for `error` and `warning` first.
- **Network** — `browser_network_requests`. Scan for non-2xx/3xx statuses and long durations.

Take a `browser_take_screenshot` only when you need pixels (visual layout, canvas/SVG,
z-index/overlap issues) that the snapshot can't express.

## 2. Common signatures

| Symptom | Where to look | Typical cause |
| --- | --- | --- |
| Blank / partial render | console `error`, page error | Unhandled exception in a Client Component; hydration mismatch |
| "Text content does not match server-rendered HTML" | console | Hydration mismatch — non-deterministic render (Date, random, `window`), or RSC/client boundary misuse |
| Data missing / spinner stuck | network 4xx/5xx, console | Failed Supabase/API request; auth/RLS; bad query params |
| Layout jump after load | network (late images/fonts), CLS in Lighthouse | Missing image dimensions, late-loading content |
| Click does nothing | console, snapshot | Handler error, element covered by overlay, disabled state |
| CORS / mixed-content errors | network, console | Wrong origin, http asset on https page |

## 3. Root-causing with MCP

- Reproduce the interaction (`browser_click`, `browser_type`, `browser_select_option`) and
  re-read `browser_console_messages` / `browser_network_requests` to see what fired.
- Use `browser_evaluate` to inspect live state, e.g. computed styles, element boxes,
  `getComputedStyle`, presence of an offending node, or `document.documentElement.scrollWidth`.
- Inspect a specific failed request in detail (status, headers, response body) before guessing.

## 4. Tie evidence to code

- Hydration / "use client" issues → the route's Client Component (e.g.
  `src/app/admin/owner-overview/owner-overview-client.tsx`) and any non-deterministic values.
- Failed data requests → the server fetch / Supabase call feeding the page; check auth and
  query construction, not just the component.
- Always map a finding to a `file:line` before proposing a fix.

## 5. Confirm the fix

Re-navigate and re-capture console + network. A fix isn't done until the error is gone from
the live page — not just "the code looks right."
