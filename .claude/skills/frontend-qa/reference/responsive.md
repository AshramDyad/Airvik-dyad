# Responsive testing

## Breakpoints to sweep

| Name | Width | Represents |
| --- | --- | --- |
| mobile | 375 | small phones (iPhone SE / mini) |
| tablet | 768 | iPad portrait |
| desktop | 1280 | common laptop |
| wide | 1440 | large desktop |

These align with Tailwind's `sm`/`md`/`lg`/`xl` thinking. Add 414 (large phone) or 1024
(tablet landscape) when a layout changes near those edges.

## How to run

- **Batch:** `npm run audit:responsive -- <url>` — loads each breakpoint, writes a full-page
  screenshot to `.frontend-qa/responsive/`, and flags horizontal overflow + undersized tap
  targets. Exits non-zero if any breakpoint overflows.
- **Interactive (MCP):** `browser_resize` to each width → `browser_take_screenshot` →
  `browser_evaluate` to probe (`document.documentElement.scrollWidth > window.innerWidth`).

## What to check at each breakpoint

1. **No horizontal scroll.** `scrollWidth > innerWidth` means something is too wide — the
   most common responsive bug. Find the offending node (the script lists nodes whose right
   edge exceeds the viewport).
2. **Tap targets.** Interactive controls should be ≥ 24×24 CSS px (WCAG 2.2 SC 2.5.8); aim for
   ~44px on touch. The script lists controls below 24px.
3. **Readability.** Body text not shrunk below ~14px; line length not absurd on wide screens.
4. **Layout integrity.** Flex/grid wraps cleanly; nothing clipped or overlapping; images scale
   within their container; tables/charts (this app uses recharts + @tanstack/react-table) have
   a mobile strategy (scroll container or stacked layout).
5. **Sticky/fixed elements** (headers, dialogs, popovers) don't cover content on short viewports.
6. **`<meta name="viewport">`** present with `width=device-width, initial-scale=1` (Next.js
   adds this by default via the `viewport` export — confirm it isn't overridden).

## Common root causes of overflow

- Fixed pixel widths (`w-[800px]`) instead of fluid/`max-w-*`.
- Unwrapped long strings / URLs → add `break-words` / `truncate`.
- Negative margins or absolute elements extending past the container.
- Wide tables/grids without an `overflow-x-auto` wrapper.
- Images without `max-width: 100%` (use `next/image` or `max-w-full h-auto`).

Fixes belong in Tailwind utilities — follow `tailwind-design-system` and confirm the fix by
re-running the sweep at the failing breakpoint.
