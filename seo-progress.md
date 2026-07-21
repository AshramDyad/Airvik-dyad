# SEO Progress — swaminarayan.yoga (Sahajanand Wellness Ashram)

> **Goal:** Rank the site in Rishikesh for *"best affordable ashram and hotel"* and become
> citable by LLM chat assistants (ChatGPT, Perplexity, Google AI Overviews) for
> affordable-ashram / dharmshala queries in Rishikesh.
>
> This repo (`Airvik-dyad`, Next.js App Router on Vercel) **is** the source of
> https://www.swaminarayan.yoga. All SEO fixes below are real code in this repo.

**Last updated:** 2026-07-21 · **Branch:** `seo/on-site-foundation` → growth program starting on a new branch

> **2026-07-21 update:** First GSC data is in and a full 6-agent research pass produced a
> phased growth program. See the **"2026-07-21 — GSC baseline + growth program"** section
> near the bottom and the full plan at `~/.claude/plans/prancy-dancing-octopus.md`.
> **Note:** the GA4 wiring described in section D below was *never committed and has been lost* —
> it is being redone as the first step of the new program.

---

## TL;DR

Phase 1 (on-site technical + on-page foundation) is **DONE and verified against a
production build**. What remains for actual ranking is largely **off-site** (Google
Business Profile, citations, reviews) plus **real content** and **analytics-driven
iteration** — none of which is code in this repo. See "What's next".

---

## ✅ What was done (Phase 1 — on-site foundation)

### 1. Single source of truth
- **`src/config/site.ts`** — canonical URL, brand names, full NAP, geo coords, socials,
  keyword clusters, and the static sitemap route list. **Change SEO facts here, not in
  individual pages.**
  - NAP: `Gali No.13, Shisham Jhadi, Muni Ki Reti, Near Ganga Kinare, Rishikesh, Uttarakhand 249201`
  - Geo: `30.1114061, 78.307545` · Primary phone `+91 85111 51708` · `ashram@swaminarayan.yoga`

### 2. Metadata (titles, descriptions, canonicals, OG/Twitter)
- **`src/app/layout.tsx`** — `metadataBase`, homepage default title, title **template**
  (`%s | Sahajanand Wellness`), default description, keywords, robots directives, and
  default Open Graph + Twitter cards.
- **`src/lib/seo/metadata.ts`** — `buildMetadata()` helper → consistent canonical + OG +
  Twitter for every page. **Use this for any new page.**
- **Per-page metadata added to every public route.** Client-component pages
  (home, book, shop, about-us, about-rishikesh, ashram-glimpse, journey, sunil-bhagat)
  can't `export const metadata`, so each got a tiny co-located server `layout.tsx`.
  Server pages (amenities, blog, events, donate, brochure, feedback, privacy-policy)
  export `metadata` directly via `buildMetadata()`.
  - Before: every page shared the same title `Sahajanand Ashram | Rishikesh`.
  - After: unique, keyword-targeted, ~55–65 char titles + self-referencing canonicals.
  - `privacy-policy` is `noindex` (and excluded from the sitemap).
- **Blog post pages** (`blog/[slug]`) use dynamic `generateMetadata()`.

### 3. Structured data (JSON-LD)
- **`src/lib/seo/structured-data.ts`** + **`src/components/seo/json-ld.tsx`**.
- Site-wide `@graph` rendered server-side on every public page (via `(public)/layout.tsx`):
  - `Organization` / `NGO` (brand + `sameAs` social profiles)
  - `LodgingBusiness` / `LocalBusiness` (NAP, geo, amenities, price range `₹`, `hasMap`)
  - `WebSite`
- `BlogPosting` schema on individual blog posts.
- Helpers exist for `Product` and `BreadcrumbList` (not yet wired — see next steps).
- **Deliberately NO `FAQPage`** (Google retired FAQ rich results May 2026) and **no `HowTo`** (deprecated).

### 4. Crawl / discovery
- **`src/app/robots.ts`** — allow all; disallow `/admin`, `/api`, `/profile`, auth pages;
  points to sitemap. (Previously robots.txt returned 404.)
- **`src/app/sitemap.ts`** — 15 static public routes + dynamic published blog posts
  (defensive: DB failure won't break it). (Previously sitemap.xml returned 404.)

### 5. LLM / AI-chat visibility
- **`public/llms.txt`** — concise, structured brand facts + NAP + offerings + key URLs,
  written so assistants cite us for "affordable ashram / dharmshala / hotel in Rishikesh".
- **`public/llms-full.txt`** — fuller version with a Q&A block.

### 6. Social share image
- **`public/og-image.png`** (1200×630) — generated from the ashram hero photo. All OG/Twitter
  references resolve to it. *(This is a plain photo crop — a branded/text version is a nice upgrade.)*

### 7. On-page copy (light)
- Homepage hero sub-tagline changed to *"Affordable Ashram Stay on the Banks of the Ganges,
  Rishikesh"* (was a generic slogan). **This was intentionally light** — see next steps for
  the deeper content work still needed.

### Verification done
- `pnpm build` passes. Started the production server and confirmed via curl:
  unique titles/canonicals/OG per page, `robots.txt`, `sitemap.xml` (16 URLs), `llms.txt`
  (200 text/plain), full JSON-LD graph in initial HTML, `og-image.png` reachable (200).
- `tsc --noEmit`: no errors in any touched file (13 pre-existing errors are all in unrelated
  `*.test.ts(x)` files).
- **Not yet validated with Google's own tools** — see next step #1.

---

## 🔜 What's next (in priority order)

### A. Validate & submit (do first, quick)
1. **Validate JSON-LD** with Google **Rich Results Test** + Schema.org validator on the live
   URLs after deploy. (Local curl proves the tags exist, not that Google accepts them.)
   The user's `claude-seo` plugin has a **`seo-schema`** skill for this, and **`seo-geo`**
   for llms.txt citability — run those against the deployed site.
2. **Google Search Console**: verify the property, submit `sitemap.xml`, request indexing for
   `/`, `/book`, `/about-rishikesh`.
3. **Bing Webmaster Tools**: same (feeds Copilot / some LLM answers).

### B. Off-site — THE actual local-ranking lever (not code; owner action)
> On-site SEO is *necessary but not sufficient*. Local hotel/ashram queries are won by these:
4. **Google Business Profile**: claim + fully optimize (category *Ashram* / *Guest house*,
   photos, hours, description, booking link). This is the single biggest driver for the map
   pack and "near me" queries.
5. **NAP consistency**: the site shows **3 phone numbers**. Pick ONE primary and make it
   identical across the site, GBP, and every citation/directory (JustDial, MakeMyTrip,
   TripAdvisor, Booking.com, euttaranchal, yatradham, etc.).
6. **Reviews**: actively collect Google reviews (volume + recency + responses strongly
   influence local rank).

### C. Content (code + copy in this repo)
7. **Real blog content**: current posts look like demos (`another-post`). Publish substantive,
   keyword-targeted articles: *"Affordable ashram stay in Rishikesh"*, *"Best time to visit
   Rishikesh"*, *"Ganga Aarti timings & guide"*, *"Yoga & meditation at our ashram"*. Each new
   post already gets metadata + BlogPosting schema automatically.
8. **Deepen on-page copy** on `/book`, `/about-rishikesh`, `/amenities` with target keywords
   (see `KEYWORDS` in `site.ts`). Phase 1 only touched the hero line.
9. **Wire `Product` + `BreadcrumbList` schema** (helpers already in `structured-data.ts`) on
   `/shop` if/when products get on-domain detail pages (currently they link out).
10. **Branded OG image**: replace the photo-crop `og-image.png` with a designed 1200×630 card
    (logo + "Affordable Ashram Stay in Rishikesh"), or add a dynamic `opengraph-image.tsx`.

### D. Analytics — so future iteration is data-driven (planned integration)
> Not yet installed. Once these are in, a future agent can read real data and improve pages
> instead of guessing.
11. **Google Analytics 4** — add via `@next/third-parties/google` (`<GoogleAnalytics gaId>`) in
    `src/app/layout.tsx`, gated behind a consent/env var. Track: page views, `book` funnel,
    outbound `tel:`/booking clicks, donations.
12. **Google Search Console API** — the plugin's **`seo-google`** skill can pull impressions,
    clicks, CTR, and average position **per page/query**. This is the feedback loop:
    - Pages with impressions but low CTR → rewrite the title/description in their `metadata`.
    - Queries ranking position 5–15 → strengthen that page's content / internal links.
    - Pages with no impressions → indexing or relevance problem.
13. **PageSpeed / CrUX** — re-run once there's real traffic (CrUX had insufficient field data at
    audit time; keyless PSI was quota-limited). Plugin skill: **`seo-technical`** / `seo-google`.
14. **How the next agent should use the data**: pull GSC query+page data → find the
    highest-impression / lowest-CTR and highest-position-gain opportunities → edit that page's
    `buildMetadata()` call and/or body copy → redeploy → compare in the next GSC pull. Log each
    iteration back into this file.

---

## Reference: keyword strategy
Defined in `src/config/site.ts` → `KEYWORDS`.
- **Primary:** affordable ashram in Rishikesh · ashram in Rishikesh · budget ashram Rishikesh ·
  dharmshala in Rishikesh · ashram stay Rishikesh · yoga ashram Rishikesh
- **Long-tail:** best affordable ashram and hotel in Rishikesh · affordable ashram stay near
  Ganga · budget dharmshala in Muni Ki Reti · ashram with daily Ganga aarti · cheap ashram
  accommodation for pilgrims · yoga & meditation ashram stay Rishikesh

## Conventions for the next agent
- **All SEO facts live in `src/config/site.ts`.** Don't hardcode NAP/URLs in pages.
- **Every new page**: `export const metadata = buildMetadata({ title, description, path })`
  (or a co-located server `layout.tsx` if the page is `"use client"`).
- **New structured data**: add a builder in `src/lib/seo/structured-data.ts`, render with `<JsonLd>`.
- **No FAQPage / HowTo schema.** Titles ≤ ~60 chars where possible.
- Keep this file updated: append an "Iteration log" entry each time you change SEO based on data.

---

## 2026-07-21 — GSC baseline + growth program (6-agent research pass)

**First GSC export** (`~/Downloads/swaminarayan.yoga-Performance-on-Search-2026-07-21.xlsx`,
Jul 11–19, a 9-day day-zero baseline): **216 clicks · 3,391 impr · 6.4% CTR · pos 9.0**,
~97% India / ~92% mobile. Branded is won (89% of clicks); non-branded is the whole growth gap
(49% of impressions, 11% of clicks, stuck on page 2). Full baseline saved to agent memory
`gsc-baseline-jul-2026.md`.

**Already fixed:** non-www → www is now a **308 permanent redirect** (Vercel platform-level,
verified on the wire). Index consolidation expected over 2–4 weeks.

### Owner-confirmed decisions (thread through everything)
- **Brand naming = FOREGROUND the Ashram name.** Titles/H1s/schema lead with
  **"Shree Swaminarayan Ashram Rishikesh"** (the name with 1,303+ JustDial reviews);
  "Sahajanand Wellness" stays as the trust/legal name (`legalName` + schema `name`, but the
  Ashram name goes FIRST in `alternateName` and in visible titles/H1s). `titleSuffix` in
  `site.ts` changes accordingly.
- **Domains:** `swaminarayanyoga.com` = OURS, ranks for "swaminarayan ashram rishikesh" →
  **301-redirect to `www.swaminarayan.yoga`** (at its host/registrar). `sunilbhagat.com` = OURS
  (founder) → **sameAs only, no redirect**. `shreeswaminarayanashramrishikesh.com` = **FAKE /
  impersonation** (copies our /about-us title) → owner files a Google spam/impersonation report +
  trademark takedown; we do not link it.

### Real bugs found (code)
- **`/book/rooms/[id]`** is `"use client"` → inherits `/book`'s metadata: every room URL ships a
  **duplicate title/description + a canonical pointing at `/book`** while marked indexable →
  explains the pos 25–41 room pages. Fix = server-component wrapper with `generateMetadata` +
  server-side room fetch (copy the `blog/[slug]` pattern) + `HotelRoom`/`Offer` JSON-LD.
- **`/rooms`** → `next.config.ts` 307-redirects it into `/admin/rooms` (robots-blocked login
  wall). Indexed showing duplicate homepage copy, 308 impr / **0 clicks** / pos 7.5. Fix =
  remove that redirect, **301 `/rooms` → `/book`**.
- **Fake `4.8 (127 reviews)`** hardcoded in `RoomDetailsClientPage.tsx` — remove (integrity).

### Phased plan (by ROI) — full detail in `~/.claude/plans/prancy-dancing-octopus.md`
- **Phase 1 (technical + CTR + schema):** redo GA4 (C0); fix `/book/rooms/[id]` (C1) + room
  schema; security headers; remove `images.unoptimized`; narrow middleware; ISR; fix `/rooms`
  (C3); CTR title/meta rewrites (foreground Ashram name, price/numeral anchors); wire
  `BreadcrumbList` (P0), `ImageObject` + `/sitemap-images.xml` (targets the "photos" query),
  `Event` on `/events`, `Product` on `/shop`. **Do NOT** add `AggregateRating` on our own
  `LodgingBusiness` (out-of-policy) — the review-star win comes via GBP.
- **Phase 2 (content):** SERP-overlap shows 3 separate spaces. Build `/dharamshala-in-rishikesh`
  (fastest win, pos 4→1-3), pillar `/ashram-stay-in-rishikesh` (6 cluster-B queries on one page),
  blog `ganga-aarti-timings-rishikesh`, then spokes. Add "dharamshala" spelling to `KEYWORDS`.
- **Phase 3 (local):** entity/name split is the #1 zero-click driver — GBP category "Ashram",
  merge duplicate listings, dispute the Yappe wrong-address listing, reconcile NAP, review-gen
  flow (QR + post-stay WhatsApp/email), citation sync (protect JustDial's 1,303 reviews).
- **Phase 4 (GEO):** on-site AI-readiness already good; the unlock is **off-site brand mentions**
  (currently zero — no Wikidata/Reddit/listicle presence). Robots need no change. Founder
  `Person` schema. **Hindi deferred** (validated: ranks pos 1.5–2.8, 0 clicks, no Hindi content).

## Iteration log
- **2026-07-12** — Phase 1 on-site foundation implemented & verified (this document). Off-site,
  content, and analytics work still pending.
- **2026-07-21** — First GSC baseline captured; 6 domain-expert research agents run; phased
  growth program written and approved (see section above + plan file). Execution started with
  Step 0 (baseline/docs) and Phase 1 first slice.
