# Accessibility audit (axe-core)

Automated checks catch ~30–50% of WCAG issues — the rule-based ones. They do **not** replace
keyboard and screen-reader testing, but they reliably catch the highest-volume failures.

## How to run

- **Batch:** `npm run audit:a11y -- <url>` — runs axe-core against the live page with tags
  `wcag2a,wcag2aa,wcag21a,wcag21aa,wcag22aa`. Prints violations grouped by impact and exits
  non-zero if any **critical** or **serious** violations exist. Override tags with `A11Y_TAGS`.
- **In a spec:** `e2e/a11y.spec.ts` uses `@axe-core/playwright`'s `AxeBuilder({ page }).analyze()`.
- **Interactive (MCP):** use `browser_snapshot` (the accessibility tree) to eyeball roles,
  names, and structure; `browser_evaluate` can run `axe.run()` if axe is injected.

## Triage order

1. **critical** — blocks a task for assistive-tech users (e.g. button with no accessible name,
   form field with no label, image with no alt). Fix first.
2. **serious** — major barrier (e.g. insufficient color contrast, bad heading order).
3. **moderate / minor** — fix opportunistically.

## Highest-frequency rules and their fixes

| Rule id | Meaning | Fix |
| --- | --- | --- |
| `color-contrast` | Text < 4.5:1 (3:1 for large) | Adjust Tailwind color tokens; check muted-foreground on cards |
| `button-name` / `link-name` | Control has no accessible name | Add visible text, `aria-label`, or `sr-only` text (icon-only buttons!) |
| `label` | Input not associated with a label | `<Label htmlFor>` / wrap, or `aria-label` |
| `image-alt` | `<img>` missing alt | Add `alt`; empty `alt=""` for decorative |
| `aria-*` invalid | Wrong/!allowed ARIA | Remove or correct; prefer native semantics |
| `heading-order` | Skipped heading level | Use sequential `h1→h2→h3` |
| `region` / `landmark` | Content outside landmarks | Wrap in `main`/`nav`/`header` |

This app uses **shadcn/ui + Radix**, which are accessible by default — most violations come
from **icon-only buttons without labels**, **custom color tokens failing contrast**, and
**missing form labels**. Watch those first.

## Fixing

Defer to the repo's `fixing-accessibility` skill for concrete ARIA/focus/contrast patterns.
After a fix, re-run `audit:a11y` for that route and confirm the violation count dropped — never
disable a rule to make the audit pass.
