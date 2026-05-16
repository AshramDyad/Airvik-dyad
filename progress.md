# Optimization Progress

## 2026-05-13 00:05 IST - Start/Resume

- Clock check: `Wed May 13 00:05:33 IST 2026`.
- Workspace state: clean Git status before changes; `node_modules` was missing.
- Installed dependencies with `pnpm install` so tests/build can run locally.
- Test setup found: Vitest + jsdom, `pnpm test`, `pnpm test:coverage`, existing tests only for reservation filters/status helpers.
- Current Supabase/data-call inventory pass:
  - App routes: 53 page/layout/route files under `src/app`.
  - Existing cache implementation found for reservations in `src/server/reservations/cache.ts` using `unstable_cache`.
  - High-risk egress patterns found: repeated `select("*")` in shared API/server modules, dynamic/no-store public reads, and public layout property fetch on every public page render.

## Research Notes

- Supabase egress is charged for data transmitted from Database, Auth, Storage, Edge Functions, Realtime, and Log Drains. Database egress is the data sent back when retrieving rows.
- Supabase recommends reducing selected fields/entries and reducing calls with optimized client code or caches.
- Supabase Storage cached egress is CDN-backed; browser cache and higher `cache-control` reduce repeat asset downloads.
- Next.js 15 guidance for this codebase: `unstable_cache` is intended for database queries/non-fetch async functions, supports `tags` and `revalidate`, and can be invalidated by `revalidateTag`/`revalidatePath`.
- Primary references:
  - https://supabase.com/docs/guides/platform/manage-your-usage/egress
  - https://supabase.com/docs/reference/javascript/select
  - https://supabase.com/docs/guides/storage/production/scaling
  - https://nextjs.org/docs/app/guides/caching-without-cache-components

## First Target Area

- Target: public and semi-public homepage data reads.
- Files under analysis:
  - `src/app/(public)/layout.tsx`
  - `src/app/api/reviews/route.ts`
  - `src/app/api/testimonials/route.ts`
  - `src/app/api/event-banner/active/route.ts`
  - `src/lib/server/reviews.ts`
  - `src/lib/server/events.ts`
  - `src/lib/reviews.ts`
  - `src/lib/event-banners.ts`
- Initial findings:
  - Public layout reads `properties.address, google_maps_url` for every public layout render with no persistent cache.
  - `/api/reviews` exports `dynamic = "force-dynamic"` and homepage client code fetches it with `cache: "no-store"`, so repeat homepage visits bypass browser/server caching.
  - `/api/event-banner/active` fetches `select("*")` for up to five active rows and filters dates in app code.
  - `getPublishedReviews` already limits columns and rows, but it is not cached.
  - `getHomepageBanner`/`getUpcomingEvents` in `src/lib/server/events.ts` still use `select("*")`.

## Test-First Plan For First Target

- Add unit tests around:
  - Review row mapping and published review query shape.
  - Event banner active-window logic, including one-sided date bounds.
  - Event banner API query shape and response cache headers.
  - Public property-location query normalization and cache wrapper.
- Run failing targeted tests before implementation when possible.
- Implement narrow changes:
  - Introduce cached server data helpers with explicit column selections and revalidation tags.
  - Replace force-dynamic/no-store public read path where freshness is not user-specific.
  - Add cache invalidation on review/event mutations.
- Re-run targeted tests, then broader `pnpm test`.

## 2026-05-13 00:13 IST - First Red Test Run

- Command: `pnpm vitest run src/lib/event-banners.test.ts src/lib/server/public-property.test.ts src/lib/server/reviews.test.ts src/lib/server/events.test.ts src/app/api/event-banner/active/route.test.ts`
- Result: failed as expected before implementation.
- Failures captured:
  - `isEventBannerActive` incorrectly returns active for future `startsAt` when `endsAt` is empty.
  - `isEventBannerActive` incorrectly returns active for expired `endsAt` when `startsAt` is empty.
  - `src/lib/server/public-property.ts` does not exist yet.
  - Review/event server modules do not yet export cache constants or configure tagged `unstable_cache`.
  - `/api/event-banner/active` still queries Supabase directly, so the test mock for `getHomepageBanner` is unused and there is no shared-cache response header.
- Harness issue found: Vitest could not resolve the `server-only` package for server modules. Added a Vitest-only alias to `src/test/server-only.ts`.

## 2026-05-13 00:19 IST - First Target Implemented

- Implemented cached public property location lookup in `src/lib/server/public-property.ts`.
- Public layout now uses `getCachedPublicPropertyLocation()` instead of querying Supabase directly on each render.
- Added shared cache/query constants in `src/lib/server/cache-config.ts`.
- `getPublishedReviews()` now goes through a tagged `unstable_cache`, clamps public limits to 20, and still selects only required testimonial columns.
- Review mutations now call `revalidateTag("reviews")` along with existing path revalidation.
- Fixed `isEventBannerActive()` so one-sided future/expired date bounds are respected.
- `getHomepageBanner()` now uses a minute-bucketed tagged cache, selects only required event columns, and reuses the shared active-window helper.
- Event mutations now call `revalidateTag("event-banners")`.
- `/api/event-banner/active` now delegates to `getHomepageBanner()` and returns shared-cache headers.
- `/api/reviews` no longer forces dynamic rendering and now returns shared/browser cache headers.
- Homepage review and banner client components no longer force `cache: "no-store"`.
- Command: `pnpm vitest run src/lib/event-banners.test.ts src/lib/server/public-property.test.ts src/lib/server/reviews.test.ts src/lib/server/events.test.ts src/app/api/event-banner/active/route.test.ts`
- Result: passed, 5 files / 13 tests.

## 2026-05-13 00:21 IST - Full Tests And Build Gate

- Command: `pnpm vitest run src/lib/event-banners.test.ts src/lib/server/public-property.test.ts src/lib/server/reviews.test.ts src/lib/server/events.test.ts src/app/api/event-banner/active/route.test.ts src/app/api/reviews/route.test.ts`
- Result: passed, 6 files / 14 tests.
- Command: `pnpm test`
- Result: passed, 8 files / 21 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 53 files / 148 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/book/review` dropped from about `294 kB` to `256 kB` first-load JS after deferring the country combobox/country-list path.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `pnpm test`
- Result: passed, 52 files / 147 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/book/rooms/[id]` dropped from about `365 kB` to `190 kB` first-load JS after deferring the amenity section and shared dynamic lucide icon resolver.
  - Overall room detail improvement this pass: about `432 kB` before the booking-panel split to about `190 kB` after booking-panel and amenity-icon deferrals.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.

## 2026-05-13 03:44 IST - Booking Review Country Payload Split Started

- Analysis:
  - `/book/review` builds at about `294 kB` first-load JS.
  - The page directly imports `CountryCombobox` and `@/lib/countries`, and `country-validation.ts` imports `../countries`; together these pull the heavy `countries-list` dataset into the initial review chunk.
- Added failing coverage requiring:
  - dynamic loading for `CountryCombobox`,
  - no direct `@/lib/countries` import from the review page,
  - no `../countries` import from the country validator module.
- Command: `pnpm vitest run 'src/app/(public)/book/review/book-review-code-splitting.test.ts'`
- Intended result: failed because the review page still owns the country combobox and heavy country-list imports.

## 2026-05-13 03:45 IST - Booking Review Country Payload Split

- Added `src/lib/country-config.ts` for lightweight phone/postal-code config without importing `countries-list`.
- Updated `country-validation.ts` so postal-code validation no longer imports the heavy country-list module.
- Updated `CountryCombobox` to pass the selected country metadata to `onChange`.
- Updated `/book/review` to:
  - dynamically import `CountryCombobox`,
  - import `getCountryPincodeConfig` from the lightweight config module,
  - remove direct `@/lib/countries` usage,
  - keep the phone code from form state and update it from the selected country.
- Command: `pnpm vitest run 'src/app/(public)/book/review/book-review-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 52 files / 146 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/book/rooms/[id]` dropped from about `432 kB` to `365 kB` first-load JS after deferring the booking panel stack.
  - The new `/api/room-types/[id]/inventory` route remains present.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.

## 2026-05-13 03:47 IST - Booking Review Room Dataset Egress Analysis

- Analysis:
  - `/book/review` still includes `rooms` in `PUBLIC_BOOKING_REVIEW_PLAN`, so the browser receives the public room dataset before booking submission.
  - The review page assigns concrete rooms in the browser via `assignAvailableRoomsForRoomTypes`, calls `validateBookingRequest` for candidates, then calls browser-side guest/reservation RPC wrappers.
  - The existing database RPCs are a good fit for a server route: `get_or_create_booking_guest` upserts the guest, `validate_booking_request` enforces booking restrictions, and `create_reservations_with_total` performs the final insert with an overlap precheck.
- Research:
  - Supabase JS RPC reference confirms `rpc(fn, args)` is the documented function-call path: https://supabase.com/docs/reference/javascript/rpc
  - Supabase JS select reference documents selecting explicit columns instead of default broad row fetches: https://supabase.com/docs/reference/javascript/select
  - Supabase JS insert reference notes inserted rows are not returned by default unless `.select()` is chained, which supports avoiding accidental mutation egress: https://supabase.com/docs/reference/javascript/insert
- Test-first plan:
  - Update the app-data plan test to require no `rooms` dataset on `/book/review`.
  - Add review source coverage requiring the page to post to `/api/bookings/public` instead of importing browser booking/RPC helpers.
  - Add route/helper coverage for a server public booking API that validates input, uses narrow candidate room/conflict selects, calls existing RPCs, and returns no-store responses.

## 2026-05-13 03:54 IST - Booking Review Room Dataset Red Tests

- Added failing coverage:
  - `src/hooks/app-data-load-plan.test.ts` now requires `/book/review` to omit the `rooms` dataset.
  - `src/app/(public)/book/review/book-review-code-splitting.test.ts` now requires submission through `/api/bookings/public` and forbids browser-side booking assignment/RPC imports.
  - `src/app/api/bookings/public/route.test.ts` defines the expected no-store public booking API behavior.
  - `src/lib/server/public-booking.test.ts` defines the expected narrow room/conflict query shape and booking RPC calls.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts 'src/app/(public)/book/review/book-review-code-splitting.test.ts' src/app/api/bookings/public/route.test.ts src/lib/server/public-booking.test.ts`
- Intended result: failed because the route/helper do not exist yet, `/book/review` still loads `rooms`, and the page still imports browser-side booking helpers.

## 2026-05-13 03:58 IST - Booking Review Server Booking API

- Added `src/lib/server/public-booking.ts`:
  - Loads property tax, selected room types, rate plans, seasonal prices, closures, and candidate rooms with explicit narrow column selections.
  - Filters candidate rooms by selected room types and bookable statuses on the server.
  - Loads overlapping reservation conflicts once with narrow reservation columns.
  - Calls existing `validate_booking_request`, `get_or_create_booking_guest`, and `create_reservations_with_total` RPCs from the server.
  - Returns only the created reservations and `confirmationReservationId` to the browser.
- Added `src/app/api/bookings/public/route.ts` with zod input validation, `Cache-Control: no-store`, and structured error responses for availability/rate/closure failures.
- Updated `/book/review`:
  - Removed browser imports for `getOrCreateGuestByEmail`, `assignAvailableRoomsForRoomTypes`, and `distributeGuestsAcrossRooms`.
  - Removed `rooms`, `addReservation`, and `validateBookingRequest` from the public review page data context usage.
  - Submits booking details to `/api/bookings/public`.
- Updated `PUBLIC_BOOKING_REVIEW_PLAN` to remove `rooms`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts 'src/app/(public)/book/review/book-review-code-splitting.test.ts' src/app/api/bookings/public/route.test.ts src/lib/server/public-booking.test.ts`
- Result: passed, 4 files / 43 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: initially failed one stale expectation in `src/hooks/use-app-data.load-plan.test.tsx` that still expected `getRooms()` on `/book/review`.
- Updated the hook load-plan test to expect the review route to skip `getRooms()`.
- Command: `pnpm vitest run src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 1 file / 10 tests.
- Command: `pnpm test`
- Result: passed, 55 files / 152 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/api/bookings/public` is present.
  - `/book/review` builds at about `255 kB` first-load JS while no longer loading the room dataset in the browser.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.

## 2026-05-13 04:03 IST - Booking Confirmation Egress Analysis

- Analysis:
  - `/book/confirmation/[id]` still uses `PUBLIC_BOOKING_CONFIRMATION_PLAN` with `rooms` and `roomTypes`, so the browser loads all public room and room-type rows for a single confirmation.
  - The page then performs separate browser Supabase reads through `getReservationById`, `getReservationsByBookingId`, and `getGuestById`.
  - The page only needs one reservation group, one guest, and room/room-type records for that reservation group to render the confirmation and invoice download.
- Test-first plan:
  - Update app-data plan and hook tests so confirmation routes load only property context data.
  - Add source coverage requiring `/book/confirmation/[id]` to fetch a route-backed confirmation payload and avoid browser-side Supabase API helpers.
  - Add server helper/route tests requiring narrow confirmation selects for reservation group, guest, rooms, and room types.

## 2026-05-13 04:03 IST - Booking Confirmation Red Tests

- Added failing coverage:
  - `src/hooks/app-data-load-plan.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx` require confirmation routes to skip global `rooms` and `roomTypes`.
  - `src/app/(public)/book/confirmation/[id]/booking-confirmation-egress.test.ts` requires a single `/api/bookings/confirmation/[id]` fetch and no browser Supabase helper imports.
  - `src/app/api/bookings/confirmation/[id]/route.test.ts` defines no-store route behavior.
  - `src/lib/server/booking-confirmation.test.ts` defines narrow reservation group, guest, room, and room type query behavior.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/(public)/book/confirmation/[id]/booking-confirmation-egress.test.ts' src/app/api/bookings/confirmation/\\[id\\]/route.test.ts src/lib/server/booking-confirmation.test.ts`
- Intended result: failed because the route/helper do not exist yet, the confirmation plan still includes `rooms`/`roomTypes`, and the page still imports browser-side Supabase helpers.

## 2026-05-13 04:05 IST - Booking Confirmation Route Payload

- Added `src/lib/server/booking-confirmation.ts`:
  - Loads the requested reservation row with narrow reservation/folio columns.
  - Loads only sibling reservations for the same `booking_id`.
  - Loads the one guest row, booked room rows, and booked room-type rows needed by the confirmation display and invoice button.
- Added `src/app/api/bookings/confirmation/[id]/route.ts` with `Cache-Control: no-store` and structured 400/404/500 responses.
- Updated `/book/confirmation/[id]`:
  - Removed browser-side `getReservationById`, `getReservationsByBookingId`, and `getGuestById` calls.
  - Fetches `/api/bookings/confirmation/[id]` once and renders from that route-backed payload.
  - Keeps `property` from context for property display/currency/tax formatting.
- Updated `PUBLIC_BOOKING_CONFIRMATION_PLAN` to load only `property`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/(public)/book/confirmation/[id]/booking-confirmation-egress.test.ts' src/app/api/bookings/confirmation/\\[id\\]/route.test.ts src/lib/server/booking-confirmation.test.ts`
- Result: passed, 5 files / 52 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 58 files / 156 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/api/bookings/confirmation/[id]` is present.
  - `/book/confirmation/[id]` builds at about `214 kB` first-load JS and no longer loads global room/room-type datasets.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.

## 2026-05-13 04:08 IST - Admin Reservation Creation Initial Audit

- Analysis:
  - `/admin/reservations/new` remains one of the heavier admin routes at about `292 kB` first-load JS.
  - Its load plan includes `property`, `guests`, `rooms`, `roomTypes`, `ratePlans`, `seasonalPrices`, and `dashboardReservations`.
  - The page currently computes room availability in the browser by scanning loaded `reservations` against selected dates and loaded `rooms`.
  - A safe next target is to replace the startup `dashboardReservations` dependency with a date-scoped availability/conflict API for the create-reservation form, then remove `dashboardReservations` from `ADMIN_RESERVATIONS_PLAN` for `/admin/reservations/new`.
- No code changes made for this target yet.

## 2026-05-13 04:08 IST - Admin Reservation Creation Conflict Query Research

- Clock check: `Wed May 13 04:08:17 IST 2026`.
- Supabase JS filter docs confirm filters should be chained after `select()`, and examples show chaining range filters like `.gte()` and `.lt()` for constrained reads: https://supabase.com/docs/reference/javascript/v1/using-filters
- Supabase JS select docs recommend explicit column selection and document count/head patterns for avoiding returned rows where row bodies are unnecessary: https://supabase.com/docs/reference/javascript/select
- Design decision:
  - Use an authenticated admin API that selects only `room_id` from overlapping reservations.
  - Filter conflicts with `status != Cancelled`, `status != No-show`, `check_in_date < checkOut`, and `check_out_date > checkIn`.
  - Return only de-duplicated conflicting room IDs to the browser; the form can combine those IDs with its already-loaded room metadata.

## 2026-05-13 04:10 IST - Admin Reservation Creation Red Tests

- Added failing coverage:
  - `src/hooks/app-data-load-plan.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx` require `/admin/reservations/new` to skip startup `dashboardReservations`.
  - `src/app/admin/reservations/new/reservation-create-egress.test.ts` requires the page to use `useAdminRoomConflicts` instead of scanning global `reservations`.
  - `src/hooks/use-admin-room-conflicts.test.tsx` defines the date-scoped conflict hook behavior.
  - `src/app/api/admin/availability/conflicts/route.test.ts` defines the authenticated no-store API behavior.
  - `src/lib/server/reservation-conflicts.test.ts` defines the narrow Supabase conflict query shape.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/new/reservation-create-egress.test.ts src/hooks/use-admin-room-conflicts.test.tsx src/app/api/admin/availability/conflicts/route.test.ts src/lib/server/reservation-conflicts.test.ts`
- Intended result: failed because the hook/helper/route do not exist yet, the load plan still includes `dashboardReservations`, and the page still imports/scans global reservations.

## 2026-05-13 04:12 IST - Admin Reservation Date-Scoped Conflicts

- Added `src/lib/server/reservation-conflicts.ts`:
  - Selects only `room_id` from overlapping reservations.
  - Excludes `Cancelled` and `No-show` rows.
  - Uses date-overlap filters `check_in_date < checkOut` and `check_out_date > checkIn`.
  - De-duplicates room IDs before returning.
- Added `src/app/api/admin/availability/conflicts/route.ts`:
  - Requires `reservationCreate` access.
  - Validates `checkIn`/`checkOut`.
  - Returns `{ data: { roomIds } }` with `Cache-Control: private, no-store`.
- Added `src/hooks/use-admin-room-conflicts.ts` for the create-reservation form to load conflict IDs only after both dates are selected.
- Updated `/admin/reservations/new`:
  - Removed `reservations` from `useDataContext()`.
  - Removed browser overlap scanning over global reservations.
  - Filters loaded rooms against the route-backed conflict ID set.
  - Shows an availability-checking state while conflict IDs are loading.
- Updated `ADMIN_RESERVATIONS_PLAN` to remove `dashboardReservations`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/new/reservation-create-egress.test.ts src/hooks/use-admin-room-conflicts.test.tsx src/app/api/admin/availability/conflicts/route.test.ts src/lib/server/reservation-conflicts.test.ts`
- Result: passed, 6 files / 55 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 62 files / 163 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/api/admin/availability/conflicts` is present.
  - `/admin/reservations/new` remains about `292 kB` first-load JS, but it no longer starts by fetching the dashboard reservation dataset.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.

## 2026-05-13 04:14 IST - Admin Reservation Detail/Edit Lookup Analysis

- Analysis:
  - `/admin/reservations/[id]` and `/admin/reservations/[id]/edit` both call `loadBookingDetails(reservationId)`.
  - After the `ADMIN_RESERVATIONS_PLAN` change, those routes no longer receive the dashboard reservation dataset at startup.
  - `loadBookingDetails()` still uses browser Supabase helpers: `getReservationById`, `getGuestById`, and `getReservationsByBookingId`.
  - A safer next optimization is one authenticated route-backed lookup that returns the booking sibling reservations plus the guest, preserving the page/component behavior while removing multiple browser Supabase reads.
- Research carried forward:
  - Supabase JS docs support explicit column selection and chaining filters after `select()`: https://supabase.com/docs/reference/javascript/select and https://supabase.com/docs/reference/javascript/v1/using-filters

## 2026-05-13 04:16 IST - Admin Reservation Lookup Red Tests

- Added failing coverage:
  - `src/lib/server/admin-reservation-booking.test.ts` defines narrow server-side lookup for reservation-id or booking-code input.
  - `src/app/api/admin/reservations/[id]/booking/route.test.ts` defines the authenticated no-store route behavior.
  - `src/hooks/use-app-data.load-plan.test.tsx` requires `loadBookingDetails()` to call the admin booking API and avoid browser Supabase helpers.
- Command: `pnpm vitest run src/lib/server/admin-reservation-booking.test.ts src/app/api/admin/reservations/\\[id\\]/booking/route.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Intended result: failed because the helper/route do not exist yet and `loadBookingDetails()` still calls browser Supabase helpers.

## 2026-05-13 04:18 IST - Admin Reservation Route-Backed Lookup

- Added `src/lib/server/admin-reservation-booking.ts`:
  - Supports both reservation UUIDs and booking codes.
  - Resolves UUIDs to `booking_id` server-side.
  - Loads booking sibling reservations with explicit reservation/folio columns.
  - Loads the booking guest with explicit guest columns.
- Added `src/app/api/admin/reservations/[id]/booking/route.ts`:
  - Requires `reservations` access.
  - Returns `Cache-Control: private, no-store`.
  - Handles missing IDs and not-found lookups.
- Updated `useAppData.loadBookingDetails()` to call the new admin booking API through `authorizedFetch` instead of browser Supabase helpers.
- Test insight:
  - The focused helper test exposed the old lookup UUID regex shape was incomplete (`8-4-4-12`); the new helper uses standard UUID shape (`8-4-4-4-12`).
- Command: `pnpm vitest run src/lib/server/admin-reservation-booking.test.ts src/app/api/admin/reservations/\\[id\\]/booking/route.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 3 files / 16 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 64 files / 168 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/api/admin/reservations/[id]/booking` is present.
  - `/admin/reservations/[id]` remains about `291 kB`, `/admin/reservations/[id]/edit` remains about `287 kB`; this pass optimizes lookup egress rather than the bundle.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.

## 2026-05-13 04:20 IST - Admin Reservation Detail Bundle Analysis

- Analysis:
  - `/admin/reservations/[id]` remains about `291 kB` first-load JS.
  - The page directly imports `BillingCard`, which imports add-charge and record-payment dialog form stacks.
  - The page directly imports `ReservationActivityTimeline`, which is only visible to manager roles and triggers its own activity-log fetch.
  - A safe bundle optimization is to dynamically import those panels from the detail page and keep core guest/stay/header content in the initial route chunk.
- Test-first plan:
  - Add a source-level code-splitting test requiring dynamic imports for `BillingCard` and `ReservationActivityTimeline`.
  - Ensure the page no longer has direct static imports for those components.

## 2026-05-13 04:20 IST - Admin Reservation Detail Red Test

- Added `src/app/admin/reservations/[id]/reservation-detail-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/reservations/\\[id\\]/reservation-detail-code-splitting.test.ts`
- Intended result: failed because the detail page still statically imports `BillingCard` and `ReservationActivityTimeline`.

## 2026-05-13 04:21 IST - Admin Reservation Detail Panel Split

- Updated `/admin/reservations/[id]` to dynamically import:
  - `./components/BillingCard`,
  - `./components/ReservationActivityTimeline`.
- Added compact skeleton fallbacks so the core reservation header, guest details, stay details, and linked rooms render independently of the billing/activity chunks.
- Command: `pnpm vitest run src/app/admin/reservations/\\[id\\]/reservation-detail-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 65 files / 169 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/reservations/[id]` first-load JS dropped from about `291 kB` to `240 kB`.
  - `/admin/reservations/[id]/edit` remains about `287 kB` and `/admin/reservations/new` remains about `292 kB`, so those are still useful bundle targets.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:23:45 IST 2026`.

## 2026-05-13 04:24 IST - Admin Reservation Edit Bundle Analysis

- Current build observation:
  - `/admin/reservations/[id]/edit` remains about `287 kB` first-load JS.
- Research refresh:
  - Current Next.js App Router lazy-loading docs say `next/dynamic` can defer Client Components and imported libraries, reducing initial JavaScript for a route.
  - Reference: https://nextjs.org/docs/app/guides/lazy-loading
- Analysis:
  - `src/app/admin/reservations/[id]/edit/page.tsx` statically imports `ReservationEditForm`.
  - `ReservationEditForm` pulls the edit workflow stack into the route module: `react-hook-form`, zod resolver, date-range picker, select/form UI, room pricing, seasonal pricing, and availability validation logic.
  - The edit page can render navigation, status, booking context, and a stable skeleton while the edit form chunk loads separately.
- Test-first plan:
  - Add a source-level test requiring the edit page to load `ReservationEditForm` through `next/dynamic`.
  - Remove the static form import from the page and keep a skeleton fallback matching the existing edit layout.

## 2026-05-13 04:25 IST - Admin Reservation Edit Form Split

- Added `src/app/admin/reservations/[id]/edit/reservation-edit-code-splitting.test.ts`.
- Command: `pnpm vitest run 'src/app/admin/reservations/[id]/edit/reservation-edit-code-splitting.test.ts'`
- Intended result: failed because the edit page still statically imported `ReservationEditForm`.
- Updated `/admin/reservations/[id]/edit` to dynamically import `ReservationEditForm`.
- Added a form-area skeleton fallback so the edit page shell can render independently while the form chunk loads.
- Command: `pnpm vitest run 'src/app/admin/reservations/[id]/edit/reservation-edit-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 66 files / 170 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/reservations/[id]/edit` first-load JS dropped from about `287 kB` to `193 kB`.
  - `/admin/reservations/new` remains about `292 kB`, so it is still the largest remaining reservation workflow bundle.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:26:38 IST 2026`.

## 2026-05-13 04:27 IST - Admin Reservation Creation Bundle Analysis

- Current build observation:
  - `/admin/reservations/new` remains about `292 kB` first-load JS.
- Analysis:
  - The create reservation workflow is implemented directly in `src/app/admin/reservations/new/page.tsx`.
  - That page currently pulls the full creation stack into the route module: `react-hook-form`, zod resolver, date-range picker, guest command/popover search, room selection, custom pricing, seasonal price calculation, and date-scoped conflict checks.
  - A low-risk split is to move the existing workflow into a route-local component and dynamically import it from the page with a skeleton fallback.
  - The existing egress test should keep covering the moved workflow file so the date-scoped conflict API remains locked.
- Test-first plan:
  - Add a source-level test requiring `/admin/reservations/new/page.tsx` to dynamically import the route-local workflow component.
  - Keep form/pricing/search libraries out of the initial page module.

## 2026-05-13 04:28 IST - Admin Reservation Creation Workflow Split

- Added `src/app/admin/reservations/new/reservation-create-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/reservations/new/reservation-create-code-splitting.test.ts`
- Intended result: failed because `page.tsx` still contained the full create workflow and imported the form/pricing/search stack directly.
- Moved the existing create workflow from `page.tsx` to `src/app/admin/reservations/new/create-reservation-form.tsx`.
- Replaced `page.tsx` with a small `next/dynamic` wrapper and a route-shell skeleton fallback.
- Updated `reservation-create-egress.test.ts` to keep checking the moved workflow file for the date-scoped conflict API.
- Command: `pnpm vitest run src/app/admin/reservations/new/reservation-create-code-splitting.test.ts src/app/admin/reservations/new/reservation-create-egress.test.ts`
- Result: passed, 2 files / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 67 files / 171 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/reservations/new` first-load JS dropped from about `292 kB` to `113 kB`.
  - Remaining large admin first-load routes include `/admin/manual-receipt` about `267 kB`, `/admin/manual-receipt/new` about `257 kB`, `/admin/feedback` about `242 kB`, `/admin/calendar` about `241 kB`, and `/admin/reports` about `241 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:29:31 IST 2026`.

## 2026-05-13 04:30 IST - Manual Receipt Bundle Analysis

- Current build observations:
  - `/admin/manual-receipt` is about `267 kB` first-load JS.
  - `/admin/manual-receipt/new` is about `257 kB` first-load JS.
- Analysis:
  - Both route modules currently contain their full workflows directly in `page.tsx`.
  - The receipt history page pulls edit form validation, table UI, dialogs, delete confirmation, receipt PDF actions, and authenticated receipt fetching into the initial page module.
  - The new receipt page pulls receipt form validation, select/radio form UI, PDF generation trigger logic, WhatsApp send flow, and authenticated receipt creation into the initial page module.
  - A low-risk bundle split is to move each existing workflow into a route-local component and dynamically import it from the corresponding page with a skeleton fallback.
- Test-first plan:
  - Add a source-level test requiring both manual receipt pages to use `next/dynamic`.
  - Keep form/table/dialog/PDF workflow imports out of the initial route page modules.

## 2026-05-13 04:31 IST - Manual Receipt Workflow Splits

- Added `src/app/admin/manual-receipt/manual-receipt-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/manual-receipt/manual-receipt-code-splitting.test.ts`
- Intended result: failed because both manual receipt pages still contained their full workflows directly.
- Moved the receipt history workflow to `src/app/admin/manual-receipt/manual-receipt-history.tsx`.
- Moved the new receipt workflow to `src/app/admin/manual-receipt/new/new-manual-receipt-form.tsx`.
- Replaced both route pages with small `next/dynamic` wrappers and route-shell skeleton fallbacks.
- Command: `pnpm vitest run src/app/admin/manual-receipt/manual-receipt-code-splitting.test.ts`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 68 files / 173 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/manual-receipt` first-load JS dropped from about `267 kB` to `113 kB`.
  - `/admin/manual-receipt/new` first-load JS dropped from about `257 kB` to `113 kB`.
  - Remaining high admin first-load routes include `/admin/feedback` about `242 kB`, `/admin/calendar` about `241 kB`, `/admin/reports` about `241 kB`, and `/admin/housekeeping` about `234 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:32:27 IST 2026`.

## 2026-05-13 04:33 IST - Admin Feedback Bundle Analysis

- Current build observation:
  - `/admin/feedback` is about `242 kB` first-load JS.
- Analysis:
  - The feedback page already uses a paginated `/api/admin/feedback` request, so the immediate low-risk target is route bundle size rather than startup data volume.
  - `src/app/admin/feedback/page.tsx` directly imports the full feedback workflow: table, dialog, date-range picker, popover/calendar, filters, query-param sync hooks, and authenticated fetch/update logic.
  - Moving the workflow into a route-local component and dynamically importing it from the page should reduce the initial route module while preserving the existing paginated API behavior.
- Test-first plan:
  - Add a source-level test requiring the feedback page to dynamically import the route-local workflow component.
  - Keep table/dialog/calendar/auth-fetch workflow imports out of the initial page module.

## 2026-05-13 04:33 IST - Admin Feedback Workflow Split

- Added `src/app/admin/feedback/feedback-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/feedback/feedback-code-splitting.test.ts`
- Intended result: failed because `page.tsx` still imported the full feedback workflow directly.
- Moved the feedback workflow to `src/app/admin/feedback/feedback-panel.tsx`.
- Replaced `page.tsx` with a small `next/dynamic` wrapper and feedback-shell skeleton fallback.
- Command: `pnpm vitest run src/app/admin/feedback/feedback-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 69 files / 174 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/feedback` first-load JS dropped from about `242 kB` to `113 kB`.
  - Remaining high admin first-load routes include `/admin/calendar` about `241 kB`, `/admin/reports` about `241 kB`, `/admin/housekeeping` about `234 kB`, `/admin/posts/[id]` and `/admin/posts/create` about `240 kB`, and `/admin/posts/categories` about `229 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:34:49 IST 2026`.

## 2026-05-13 04:35 IST - Admin Calendar Bundle Analysis

- Current build observation:
  - `/admin/calendar` is about `241 kB` first-load JS.
- Analysis:
  - The calendar route page is small but statically imports `AvailabilityCalendar`.
  - `AvailabilityCalendar` brings in month aggregation hooks, date-fns calendar calculations, table/tooltip/select UI, fullscreen controls, room-type row rendering, and a legacy reservation-grid fallback.
  - A low-risk split is to dynamically import `AvailabilityCalendar` at the page boundary while keeping the permission gate and skeleton in the route shell.
- Test-first plan:
  - Add a source-level test requiring the calendar page to load `AvailabilityCalendar` through `next/dynamic`.
  - Ensure the page no longer has a static shared calendar import.

## 2026-05-13 04:36 IST - Admin Calendar Dynamic Import

- Added `src/app/admin/calendar/calendar-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/calendar/calendar-code-splitting.test.ts`
- Intended result: failed because the calendar page still statically imported `AvailabilityCalendar`.
- Updated `/admin/calendar` to dynamically import `AvailabilityCalendar`.
- Added a calendar-shell skeleton fallback while preserving the route-level permission gate.
- Command: `pnpm vitest run src/app/admin/calendar/calendar-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 70 files / 175 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/calendar` first-load JS dropped from about `241 kB` to `176 kB`.
  - Remaining high admin first-load routes include `/admin/reports` about `241 kB`, `/admin/housekeeping` about `234 kB`, `/admin/posts/[id]` and `/admin/posts/create` about `240 kB`, `/admin/posts/categories` about `229 kB`, and `/admin/activity` about `225 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:37:23 IST 2026`.

## 2026-05-13 04:38 IST - Admin Reports Bundle Analysis

- Current build observation:
  - `/admin/reports` remains about `241 kB` first-load JS.
- Analysis:
  - The existing reports split already defers chart-heavy occupancy and revenue panels from `ReportsTabs`.
  - The reports page still statically imports `ReportsTabs`, and `ReportsTabs` statically imports the default bookings report with date pickers, popovers, authenticated export fetches, and report generation trigger logic.
  - A low-risk page-boundary split is to dynamically import `ReportsTabs` from the route shell.
- Test-first plan:
  - Extend the existing reports code-splitting test to require a dynamic `ReportsTabs` page import.
  - Keep the existing chart-heavy panel dynamic assertions.

## 2026-05-13 04:38 IST - Admin Reports Page Boundary Split

- Updated `src/app/admin/reports/reports-code-splitting.test.ts` to require dynamic import of `ReportsTabs` from the page.
- Command: `pnpm vitest run src/app/admin/reports/reports-code-splitting.test.ts`
- Intended result: failed because the reports page still statically imported `ReportsTabs`.
- Updated `/admin/reports` to dynamically import `ReportsTabs`.
- Added a report-tabs skeleton fallback while preserving the route-level permission gate and existing dynamic occupancy/revenue panels.
- Command: `pnpm vitest run src/app/admin/reports/reports-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 70 files / 175 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/reports` first-load JS dropped from about `241 kB` to `176 kB`.
  - Remaining high admin first-load routes include `/admin/housekeeping` about `234 kB`, `/admin/posts/[id]` and `/admin/posts/create` about `240 kB`, `/admin/posts/categories` about `229 kB`, `/admin/activity` about `225 kB`, and admin post/review/event create/edit routes around `220 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:40:15 IST 2026`.

## 2026-05-13 04:40 IST - Admin Housekeeping Bundle Analysis

- Current build observation:
  - `/admin/housekeeping` is about `234 kB` first-load JS.
- Analysis:
  - `src/app/admin/housekeeping/page.tsx` directly imports the housekeeping workflow.
  - The workflow includes room status cards, assignment/status dialogs, toggle controls, room/user data context usage, and room-status mutation logic.
  - A low-risk split is to move the workflow into a route-local panel and dynamically import it from the page while keeping the permission gate and grid skeleton in the shell.
- Test-first plan:
  - Add a source-level test requiring the housekeeping page to dynamically import the panel.
  - Keep the room-card/dialog/data-context workflow out of the initial route page module.

## 2026-05-13 04:41 IST - Admin Housekeeping Panel Split

- Added `src/app/admin/housekeeping/housekeeping-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/housekeeping/housekeeping-code-splitting.test.ts`
- Intended result: failed because the housekeeping page still imported the full workflow directly.
- Moved the housekeeping workflow to `src/app/admin/housekeeping/housekeeping-panel.tsx`.
- Replaced `page.tsx` with a small `next/dynamic` wrapper, route-level permission gate, and grid skeleton fallback.
- Command: `pnpm vitest run src/app/admin/housekeeping/housekeeping-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 71 files / 176 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/housekeeping` first-load JS dropped from about `234 kB` to `176 kB`.
  - Remaining high admin first-load routes include `/admin/posts/[id]` and `/admin/posts/create` about `240 kB`, `/admin/posts/categories` about `229 kB`, `/admin/activity` about `226 kB`, `/admin/events/[id]`, `/admin/events/create`, `/admin/reviews/[id]`, and `/admin/reviews/create` about `221 kB`, and `/admin/login` about `221 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:42:43 IST 2026`.

## 2026-05-13 04:43 IST - Admin Post Form Route Analysis

- Current build observations:
  - `/admin/posts/create` is about `240 kB` first-load JS.
  - `/admin/posts/[id]` is about `240 kB` first-load JS.
- Analysis:
  - Both routes are server pages that perform permission checks and fetch categories/post data.
  - Both routes statically import the client `PostForm`.
  - `PostForm` already defers the rich text editor, but it still pulls form validation, upload controls, select/checkbox UI, image preview logic, and post mutation helpers into the initial page client boundary.
  - A low-risk split is to keep the server pages as server pages, but replace the direct `PostForm` import with a tiny client `PostFormLoader` that dynamically imports `PostForm`.
- Test-first plan:
  - Add a source-level test requiring create/edit pages to use `PostFormLoader`.
  - Ensure the loader uses `next/dynamic` for `PostForm` and the pages no longer statically import `PostForm`.

## 2026-05-13 04:45 IST - Admin Post Form Route Split

- Added `src/app/admin/posts/post-form-route-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/posts/post-form-route-code-splitting.test.ts`
- Intended result: failed because `src/components/admin/posts/post-form-loader.tsx` did not exist yet and the create/edit pages still imported `PostForm` directly.
- Added `src/components/admin/posts/post-form-loader.tsx` with a `next/dynamic` boundary around `PostForm` and a form-shaped skeleton fallback.
- Updated `src/app/admin/posts/create/page.tsx` and `src/app/admin/posts/[id]/page.tsx` to render `PostFormLoader` instead of statically importing `PostForm`.
- Command: `pnpm vitest run src/app/admin/posts/post-form-route-code-splitting.test.ts src/components/admin/posts/post-form-code-splitting.test.ts`
- Result: passed, 2 files / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 72 files / 177 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/posts/create` first-load JS dropped from about `240 kB` to `113 kB`.
  - `/admin/posts/[id]` first-load JS dropped from about `240 kB` to `113 kB`.
  - Remaining high admin first-load routes include `/admin/posts/categories` about `229 kB`, `/admin/activity` about `226 kB`, `/admin/events/[id]`, `/admin/events/create`, `/admin/reviews/[id]`, `/admin/reviews/create`, and `/admin/login` about `221 kB`, plus `/admin/reservations/[id]` about `240 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:46:53 IST 2026`.

## 2026-05-13 04:47 IST - Admin Post Categories Route Analysis

- Current build observation:
  - `/admin/posts/categories` is about `229 kB` first-load JS.
- Web research:
  - Rechecked the current Next.js lazy-loading guide, last updated March 31, 2026: lazy loading reduces initial route JavaScript by deferring Client Components/libraries with `next/dynamic`.
  - The same guide still notes that when a Server Component dynamically imports a Client Component, automatic code splitting is not currently supported; this supports the route-local client loader pattern used in the previous pass.
  - Source: https://nextjs.org/docs/app/guides/lazy-loading
- Analysis:
  - `src/app/admin/posts/categories/page.tsx` is a server page that performs permission checks and fetches categories.
  - The page statically imports the client `CategoriesManager`.
  - `CategoriesManager` pulls form validation, React Hook Form, select/table UI, category mutations, and lucide action icons into the initial route boundary.
  - A low-risk split is to keep the server page/data fetch intact and introduce a small client `CategoriesManagerLoader` that dynamically imports `CategoriesManager`.
- Test-first plan:
  - Add a source-level test requiring the categories page to use `CategoriesManagerLoader`.
  - Ensure the loader uses `next/dynamic` for `CategoriesManager` and the page no longer statically imports `CategoriesManager`.

## 2026-05-13 04:47 IST - Admin Post Categories Red Test

- Added `src/app/admin/posts/categories/categories-route-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/posts/categories/categories-route-code-splitting.test.ts`
- Intended result: failed because `src/components/admin/posts/categories-manager-loader.tsx` did not exist yet and the categories page still statically imported `CategoriesManager`.

## 2026-05-13 04:48 IST - Admin Post Categories Route Split

- Added `src/components/admin/posts/categories-manager-loader.tsx` with a `next/dynamic` boundary around `CategoriesManager` and a categories-management skeleton fallback.
- Updated `src/app/admin/posts/categories/page.tsx` to render `CategoriesManagerLoader` instead of statically importing `CategoriesManager`.
- Command: `pnpm vitest run src/app/admin/posts/categories/categories-route-code-splitting.test.ts src/app/admin/posts/post-form-route-code-splitting.test.ts`
- Result: passed, 2 files / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 73 files / 178 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/posts/categories` first-load JS dropped from about `229 kB` to `114 kB`.
  - Post admin create/edit/category routes are now all about `114 kB` first-load JS after client workflow loader splits.
  - Remaining high first-load routes include `/admin/reservations/[id]` about `240 kB`, `/admin/activity` about `226 kB`, `/admin/events/[id]`, `/admin/events/create`, `/admin/reviews/[id]`, `/admin/reviews/create`, and `/admin/login` about `221 kB`, `/shop` about `235 kB`, and `/book` about `271 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:49:32 IST 2026`.

## 2026-05-13 04:50 IST - Admin Activity Route Analysis

- Current build observation:
  - `/admin/activity` is about `226 kB` first-load JS.
- Analysis:
  - `src/app/admin/activity/page.tsx` is currently a full client page.
  - It statically imports the activity filters, table, pagination, permission gate, auth context, activity-log hook, currency formatter, and activity formatting helpers into the route entry module.
  - The existing behavior can be preserved by moving the client workflow into a route-local `ActivityPanel` and turning `page.tsx` into a small server shell that renders a client `ActivityPanelLoader`.
  - This follows the same Next.js lazy-loading constraint noted earlier: keep the `next/dynamic` import inside a client loader rather than directly inside the server page.
- Test-first plan:
  - Add a source-level test requiring `page.tsx` to render `ActivityPanelLoader` and not import the activity-log hook/table UI directly.
  - Ensure the loader dynamically imports `./activity-panel`.

## 2026-05-13 04:50 IST - Admin Activity Red Test

- Added `src/app/admin/activity/activity-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/activity/activity-code-splitting.test.ts`
- Intended result: failed because `src/app/admin/activity/activity-panel-loader.tsx` did not exist yet and the activity route still contained the full client workflow in `page.tsx`.

## 2026-05-13 04:51 IST - Admin Activity Route Split

- Moved the existing activity-log workflow into `src/app/admin/activity/activity-panel.tsx`.
- Replaced `src/app/admin/activity/page.tsx` with a server shell that renders `ActivityPanelLoader`.
- Added `src/app/admin/activity/activity-panel-loader.tsx` with a `next/dynamic` boundary around `ActivityPanel` and card/table-shaped skeleton fallback.
- Command: `pnpm vitest run src/app/admin/activity/activity-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 74 files / 179 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/activity` first-load JS dropped from about `226 kB` to `114 kB`.
  - Remaining high first-load routes include `/admin/reservations/[id]` about `240 kB`, `/admin/events/[id]`, `/admin/events/create`, `/admin/reviews/[id]`, `/admin/reviews/create`, and `/admin/login` about `221 kB`, `/shop` about `235 kB`, and `/book` about `271 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:52:11 IST 2026`.

## 2026-05-13 04:52 IST - Admin Event Form Route Analysis

- Current build observations:
  - `/admin/events/create` is about `221 kB` first-load JS.
  - `/admin/events/[id]` is about `221 kB` first-load JS.
- Analysis:
  - Both routes are server pages that perform permission checks; the edit route also fetches a single event server-side.
  - Both routes statically import the client `EventForm`.
  - `EventForm` pulls React Hook Form, zod validation, image upload controls, switch/form UI, Next image preview, toast, and event mutations into the initial route boundary.
  - A low-risk split is to keep the server routes and data fetches intact, but replace the direct `EventForm` import with a small client `EventFormLoader` that dynamically imports `EventForm`.
- Test-first plan:
  - Add a source-level test requiring create/edit event pages to use `EventFormLoader`.
  - Ensure the loader uses `next/dynamic` for `EventForm` and pages no longer statically import `EventForm`.

## 2026-05-13 04:53 IST - Admin Event Form Red Test

- Added `src/app/admin/events/event-form-route-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/events/event-form-route-code-splitting.test.ts`
- Intended result: failed because `src/components/admin/events/event-form-loader.tsx` did not exist yet and event create/edit pages still imported `EventForm` directly.

## 2026-05-13 04:53 IST - Admin Event Form Route Split

- Added `src/components/admin/events/event-form-loader.tsx` with a `next/dynamic` boundary around `EventForm` and an event-form skeleton fallback.
- Updated `src/app/admin/events/create/page.tsx` and `src/app/admin/events/[id]/page.tsx` to render `EventFormLoader` instead of statically importing `EventForm`.
- Command: `pnpm vitest run src/app/admin/events/event-form-route-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 75 files / 180 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/events/create` first-load JS dropped from about `221 kB` to `114 kB`.
  - `/admin/events/[id]` first-load JS dropped from about `221 kB` to `114 kB`.
  - Remaining high first-load routes include `/admin/reservations/[id]` about `240 kB`, `/admin/reviews/[id]`, `/admin/reviews/create`, and `/admin/login` about `221 kB`, `/shop` about `235 kB`, and `/book` about `271 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:54:46 IST 2026`.

## 2026-05-13 04:55 IST - Admin Review Form Route Analysis

- Current build observations:
  - `/admin/reviews/create` is about `221 kB` first-load JS.
  - `/admin/reviews/[id]` is about `221 kB` first-load JS.
- Analysis:
  - Both routes are server pages that perform permission checks; the edit route also fetches a single review server-side.
  - Both routes statically import the client `ReviewForm`.
  - `ReviewForm` pulls React Hook Form, zod validation, image upload controls, switch/form UI, toast, router actions, and review mutations into the initial route boundary.
  - A low-risk split is to keep the server routes and data fetches intact, but replace the direct `ReviewForm` import with a small client `ReviewFormLoader` that dynamically imports `ReviewForm`.
- Test-first plan:
  - Add a source-level test requiring create/edit review pages to use `ReviewFormLoader`.
  - Ensure the loader uses `next/dynamic` for `ReviewForm` and pages no longer statically import `ReviewForm`.

## 2026-05-13 04:55 IST - Admin Review Form Red Test

- Added `src/app/admin/reviews/review-form-route-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/reviews/review-form-route-code-splitting.test.ts`
- Intended result: failed because `src/components/admin/reviews/review-form-loader.tsx` did not exist yet and review create/edit pages still imported `ReviewForm` directly.

## 2026-05-13 04:56 IST - Admin Review Form Route Split

- Added `src/components/admin/reviews/review-form-loader.tsx` with a `next/dynamic` boundary around `ReviewForm` and a review-form skeleton fallback.
- Updated `src/app/admin/reviews/create/page.tsx` and `src/app/admin/reviews/[id]/page.tsx` to render `ReviewFormLoader` instead of statically importing `ReviewForm`.
- Command: `pnpm vitest run src/app/admin/reviews/review-form-route-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 76 files / 181 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/reviews/create` first-load JS dropped from about `221 kB` to `114 kB`.
  - `/admin/reviews/[id]` first-load JS dropped from about `221 kB` to `114 kB`.
  - Remaining high first-load routes include `/admin/reservations/[id]` about `240 kB`, `/admin/login` about `221 kB`, `/admin/posts` about `219 kB`, `/admin/reviews` about `199 kB`, `/admin/reservations/[id]/edit` about `193 kB`, `/shop` about `235 kB`, and `/book` about `271 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 04:57:29 IST 2026`.

## 2026-05-13 04:58 IST - Admin Login Route Analysis

- Current build observation:
  - `/admin/login` is about `221 kB` first-load JS.
- Analysis:
  - `src/app/admin/login/page.tsx` is a server page, but it statically imports the client `AdminLogin` wrapper.
  - `AdminLogin` immediately imports `AdminLoginForm`.
  - `AdminLoginForm` pulls React Hook Form, zod validation, Supabase auth, role-profile lookup, sign-out handling, toast, router actions, Next image, and lucide icons into the initial route boundary.
  - A low-risk split is to keep the route as a small server page and replace the direct `AdminLogin` import with a client `AdminLoginLoader` that dynamically imports the existing login form.
- Test-first plan:
  - Add a source-level test requiring `/admin/login` to use `AdminLoginLoader`.
  - Ensure the loader uses `next/dynamic` for the admin login form and the page no longer statically imports `AdminLogin`.

## 2026-05-13 04:58 IST - Admin Login Red Test

- Added `src/app/admin/login/admin-login-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/login/admin-login-code-splitting.test.ts`
- Intended result: failed because `src/components/auth/admin/login-loader.tsx` did not exist yet and the admin login page still imported `AdminLogin` directly.

## 2026-05-13 04:59 IST - Admin Login Route Split

- Added `src/components/auth/admin/login-loader.tsx` with a `next/dynamic` boundary around `AdminLoginForm` and a login-page skeleton fallback.
- Updated `src/app/admin/login/page.tsx` to render `AdminLoginLoader` instead of statically importing `AdminLogin`.
- Command: `pnpm vitest run src/app/admin/login/admin-login-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 77 files / 182 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/login` first-load JS dropped from about `221 kB` to `114 kB`.
  - Remaining high first-load routes include `/admin/reservations/[id]` about `240 kB`, `/admin/posts` about `219 kB`, `/admin/reviews` about `199 kB`, `/admin/reservations/[id]/edit` about `193 kB`, `/admin/settings` about `184 kB`, `/shop` about `236 kB`, and `/book` about `271 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 05:00:19 IST 2026`.

## 2026-05-13 05:00 IST - Admin Posts Index Route Analysis

- Current build observation:
  - `/admin/posts` is about `219 kB` first-load JS.
- Analysis:
  - The route is a server page that already performs the post/category/count fetches server-side.
  - The page statically imports `PostsFilters` and `PostsTable`.
  - Those client components pull query-param routing, tabs/select UI, date formatting, delete mutation logic, badges, table UI, and lucide action icons into the initial route boundary.
  - A low-risk split is to keep the server data fetches in `page.tsx`, but pass the fetched payload into a client `PostsIndexLoader` that dynamically imports a small `PostsIndexPanel` containing `PostsFilters` and `PostsTable`.
- Test-first plan:
  - Add a source-level test requiring `page.tsx` to use `PostsIndexLoader`.
  - Ensure the loader uses `next/dynamic` for `./posts-index-panel` and the page no longer statically imports `PostsFilters` or `PostsTable`.

## 2026-05-13 05:01 IST - Admin Posts Index Red Test

- Added `src/app/admin/posts/posts-index-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/posts/posts-index-code-splitting.test.ts`
- Intended result: failed because `src/app/admin/posts/posts-index-loader.tsx` did not exist yet and the posts index page still imported `PostsFilters` and `PostsTable` directly.

## 2026-05-13 05:02 IST - Admin Posts Index Route Split

- Added `src/app/admin/posts/posts-index-panel.tsx` to hold the existing `PostsFilters` and `PostsTable` workflow.
- Added `src/app/admin/posts/posts-index-loader.tsx` with a `next/dynamic` boundary around `PostsIndexPanel` and a filter/table skeleton fallback.
- Updated `src/app/admin/posts/page.tsx` to keep the server data fetches but render `PostsIndexLoader` instead of statically importing `PostsFilters` and `PostsTable`.
- Command: `pnpm vitest run src/app/admin/posts/posts-index-code-splitting.test.ts src/app/admin/posts/post-form-route-code-splitting.test.ts src/app/admin/posts/categories/categories-route-code-splitting.test.ts`
- Result: passed, 3 files / 3 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 78 files / 183 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/posts` first-load JS dropped from about `219 kB` to `117 kB`.
  - Remaining high first-load routes include `/admin/reservations/[id]` about `240 kB`, `/admin/reviews` about `199 kB`, `/admin/reservations/[id]/edit` about `193 kB`, `/admin/settings` about `184 kB`, `/shop` about `236 kB`, and `/book` about `271 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 05:03:06 IST 2026`.

## 2026-05-13 05:03 IST - Admin Reviews Index Route Analysis

- Current build observation:
  - `/admin/reviews` is about `199 kB` first-load JS.
- Analysis:
  - The route is a server page that performs permission checks and fetches all reviews server-side.
  - The page statically imports the client `ReviewsTable`.
  - `ReviewsTable` pulls Next image rendering, auth context, switches, server mutations, toast, table UI, and lucide action icons into the initial route boundary.
  - A low-risk split is to keep the server data fetches in `page.tsx`, but pass reviews into a client `ReviewsTableLoader` that dynamically imports `ReviewsTable`.
- Test-first plan:
  - Add a source-level test requiring `page.tsx` to use `ReviewsTableLoader`.
  - Ensure the loader uses `next/dynamic` for `ReviewsTable` and the page no longer statically imports `ReviewsTable`.

## 2026-05-13 05:04 IST - Admin Reviews Index Red Test

- Added `src/app/admin/reviews/reviews-index-code-splitting.test.ts`.
- Command: `pnpm vitest run src/app/admin/reviews/reviews-index-code-splitting.test.ts`
- Intended result: failed because `src/components/admin/reviews/reviews-table-loader.tsx` did not exist yet and the reviews index page still imported `ReviewsTable` directly.

## 2026-05-13 05:04 IST - Admin Reviews Index Route Split

- Added `src/components/admin/reviews/reviews-table-loader.tsx` with a `next/dynamic` boundary around `ReviewsTable` and a table skeleton fallback.
- Updated `src/app/admin/reviews/page.tsx` to render `ReviewsTableLoader` instead of statically importing `ReviewsTable`.
- Command: `pnpm vitest run src/app/admin/reviews/reviews-index-code-splitting.test.ts src/app/admin/reviews/review-form-route-code-splitting.test.ts`
- Result: passed, 2 files / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 79 files / 184 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/reviews` first-load JS dropped from about `199 kB` to `117 kB`.
  - Remaining high first-load routes include `/admin/reservations/[id]` about `240 kB`, `/admin/reservations/[id]/edit` about `193 kB`, `/admin/settings` about `184 kB`, `/admin/calendar` and `/admin/reports` about `177 kB`, `/shop` about `236 kB`, and `/book` about `271 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 05:05:25 IST 2026`.

## 2026-05-13 05:06 IST - Admin Reservation Detail Residual Chunk Analysis

- Current build observation:
  - `/admin/reservations/[id]` remains about `240 kB` first-load JS after the earlier billing/activity split.
- Analysis:
  - The detail page is a client page because it resolves reservation lookup state from `useDataContext`.
  - `BillingCard` and `ReservationActivityTimeline` are already deferred.
  - The page still statically imports `ReservationHeader`, `GuestDetailsCard`, `StayDetailsCard`, and `LinkedReservationsCard`.
  - `ReservationHeader` pulls invoice download, WhatsApp send, cancel dialog, status mutations, toast, and multiple lucide icons into the initial route chunk.
  - `GuestDetailsCard` pulls the country lookup path into the initial route chunk.
  - `StayDetailsCard` and `LinkedReservationsCard` pull additional data-context/card/table/icon logic.
  - A low-risk split is to keep the route-level lookup/calculation logic in place and dynamically import the header and side cards alongside the existing deferred billing/activity panels.
- Test-first plan:
  - Extend the existing reservation detail code-splitting test to require dynamic imports for header and side cards.
  - Ensure the page no longer statically imports those presentation components.

## 2026-05-13 05:06 IST - Admin Reservation Detail Red Test

- Extended `src/app/admin/reservations/[id]/reservation-detail-code-splitting.test.ts` to require dynamic imports for `ReservationHeader`, `GuestDetailsCard`, `StayDetailsCard`, and `LinkedReservationsCard`.
- Command: `pnpm vitest run 'src/app/admin/reservations/[id]/reservation-detail-code-splitting.test.ts'`
- Intended result: failed because those presentation components were still statically imported by the reservation detail page.

## 2026-05-13 05:07 IST - Admin Reservation Detail Presentation Split

- Converted `ReservationHeader`, `GuestDetailsCard`, `StayDetailsCard`, and `LinkedReservationsCard` in `src/app/admin/reservations/[id]/page.tsx` to `next/dynamic` imports with route-shaped skeleton fallbacks.
- Kept the existing route lookup, booking aggregation, billing, and activity behavior intact.
- Command: `pnpm vitest run 'src/app/admin/reservations/[id]/reservation-detail-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 79 files / 184 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/reservations/[id]` first-load JS dropped from about `240 kB` to `190 kB`.
  - This confirms the static presentation imports were a meaningful part of the residual detail chunk, but the route remains high because the page entry itself is still a client component with data-context lookup and aggregation logic.
  - Next target for this route: move the client detail logic behind a route-level client loader and turn `page.tsx` into a server shell.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 05:08:44 IST 2026`.

## 2026-05-13 05:09 IST - Admin Reservation Detail Route Shell Red Test

- Extended `src/app/admin/reservations/[id]/reservation-detail-code-splitting.test.ts` to require:
  - `page.tsx` as a server shell,
  - a client `ReservationDetailsClientLoader`,
  - the existing detail workflow moved to `reservation-details-client.tsx`.
- Command: `pnpm vitest run 'src/app/admin/reservations/[id]/reservation-detail-code-splitting.test.ts'`
- Intended result: failed because the loader and client detail component did not exist yet.

## 2026-05-13 05:10 IST - Admin Reservation Detail Route Shell Split

- Moved the existing reservation detail client workflow to `src/app/admin/reservations/[id]/reservation-details-client.tsx`.
- Replaced `src/app/admin/reservations/[id]/page.tsx` with a server shell that renders `ReservationDetailsClientLoader`.
- Added `src/app/admin/reservations/[id]/reservation-details-client-loader.tsx` with a `next/dynamic` boundary and full-detail skeleton fallback.
- Command: `pnpm vitest run 'src/app/admin/reservations/[id]/reservation-detail-code-splitting.test.ts'`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 79 files / 185 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/reservations/[id]` first-load JS dropped from about `190 kB` to `114 kB` after moving the client detail workflow behind a route-level loader.
  - Combined reservation detail improvement across the last two passes: about `240 kB` to `114 kB`.
  - Remaining high first-load routes include `/admin/reservations/[id]/edit` about `193 kB`, `/admin/settings` about `184 kB`, `/admin/calendar` and `/admin/reports` about `177 kB`, `/admin/guests/[id]` about `196 kB`, `/shop` about `236 kB`, and `/book` about `271 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 05:11:11 IST 2026`.

## 2026-05-13 05:11 IST - Admin Reservation Edit Route Shell Analysis

- Current build observation:
  - `/admin/reservations/[id]/edit` is about `193 kB` first-load JS.
- Analysis:
  - The edit route is still a client page because it resolves reservation lookup state from `useDataContext`.
  - The edit form is already dynamically imported, but the route entry still pulls the client lookup shell, router/params hooks, date calculations, back-link UI, and icon/button/badge UI.
  - The same route-shell pattern used for reservation detail should reduce the first-load route chunk: move the existing client workflow to `reservation-edit-client.tsx`, add `ReservationEditClientLoader`, and make `page.tsx` a server shell.
- Test-first plan:
  - Extend the existing edit code-splitting test to require a server page shell and dynamic client loader.
  - Keep the existing assertion that the actual edit form stays dynamic inside the client workflow.

## 2026-05-13 05:12 IST - Admin Reservation Edit Route Shell Red Test

- Extended `src/app/admin/reservations/[id]/edit/reservation-edit-code-splitting.test.ts` to require:
  - `page.tsx` as a server shell,
  - a client `ReservationEditClientLoader`,
  - the existing edit workflow moved to `reservation-edit-client.tsx`.
- Command: `pnpm vitest run 'src/app/admin/reservations/[id]/edit/reservation-edit-code-splitting.test.ts'`
- Intended result: failed because the loader and client edit component did not exist yet.

## 2026-05-13 05:12 IST - Admin Reservation Edit Route Shell Split

- Moved the existing reservation edit client workflow to `src/app/admin/reservations/[id]/edit/reservation-edit-client.tsx`.
- Replaced `src/app/admin/reservations/[id]/edit/page.tsx` with a server shell that renders `ReservationEditClientLoader`.
- Added `src/app/admin/reservations/[id]/edit/reservation-edit-client-loader.tsx` with a `next/dynamic` boundary and edit-page skeleton fallback.
- Command: `pnpm vitest run 'src/app/admin/reservations/[id]/edit/reservation-edit-code-splitting.test.ts'`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 79 files / 186 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/reservations/[id]/edit` first-load JS dropped from about `193 kB` to `114 kB`.
  - Reservation detail and edit routes are now both in the small loader-backed range.
  - Remaining high first-load routes include `/admin/guests/[id]` about `197 kB`, `/admin/settings` about `184 kB`, several admin resource indexes about `176-177 kB`, `/shop` about `236 kB`, `/book` about `271 kB`, `/book/review` about `255 kB`, and public auth routes about `203-214 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 05:14:06 IST 2026`.

## 2026-05-13 05:14 IST - Admin Guest Detail Route Analysis

- Current build observation:
  - `/admin/guests/[id]` is about `197 kB` first-load JS.
- Analysis:
  - The guest detail route is a full client page because it reads guest and room state from `useDataContext`.
  - It statically imports card/table UI, `useGuestReservations`, and `getCountryByCode`.
  - The country lookup path is a known heavy dependency, and the table/reservation history workflow does not need to be in the initial route module.
  - A low-risk split is to move the existing client workflow to `guest-details-client.tsx`, add a client `GuestDetailsClientLoader`, and make `page.tsx` a server shell.
- Test-first plan:
  - Add a source-level test requiring `page.tsx` to be a server shell around `GuestDetailsClientLoader`.
  - Ensure the loader dynamically imports `guest-details-client` and the page no longer imports data context, guest reservation hooks, table UI, or country lookup directly.

## 2026-05-13 05:15 IST - Admin Guest Detail Red Test

- Added `src/app/admin/guests/[id]/guest-detail-code-splitting.test.ts`.
- Command: `pnpm vitest run 'src/app/admin/guests/[id]/guest-detail-code-splitting.test.ts'`
- Intended result: failed because `src/app/admin/guests/[id]/guest-details-client-loader.tsx` did not exist yet and the guest detail page still contained the full client workflow.

## 2026-05-13 05:15 IST - Admin Guest Detail Route Shell Split

- Moved the existing guest detail client workflow to `src/app/admin/guests/[id]/guest-details-client.tsx`.
- Replaced `src/app/admin/guests/[id]/page.tsx` with a server shell that renders `GuestDetailsClientLoader`.
- Added `src/app/admin/guests/[id]/guest-details-client-loader.tsx` with a `next/dynamic` boundary and guest-detail skeleton fallback.
- Command: `pnpm vitest run 'src/app/admin/guests/[id]/guest-detail-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 80 files / 187 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/guests/[id]` first-load JS dropped from about `197 kB` to `114 kB`.
  - Remaining high first-load routes include `/admin/settings` about `184 kB`, admin resource index shells about `176-177 kB`, `/shop` about `236 kB`, `/book` about `271 kB`, `/book/review` about `255 kB`, and public auth routes about `203-214 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 05:17:19 IST 2026`.

## 2026-05-13 05:17 IST - Admin Settings Route Shell Analysis

- Current build observation:
  - `/admin/settings` is about `184 kB` first-load JS.
- Analysis:
  - `SettingsTabs` already dynamically imports the heavy tab panels.
  - The route page is still a client component that statically imports `PermissionGate` and `SettingsTabs`, so the tabs shell and permission gate remain in the route entry chunk.
  - A low-risk split is to move the current client shell to `settings-client.tsx`, add a client `SettingsClientLoader`, and make `page.tsx` a server shell.
- Test-first plan:
  - Extend the settings code-splitting test to require `page.tsx` to be a server shell around `SettingsClientLoader`.
  - Keep the existing assertions that tab panels remain dynamically imported inside `settings-tabs.tsx`.

## 2026-05-13 05:18 IST - Admin Settings Route Shell Red Test

- Extended `src/app/admin/settings/settings-code-splitting.test.ts` to require:
  - `page.tsx` as a server shell,
  - a client `SettingsClientLoader`,
  - the existing settings shell moved to `settings-client.tsx`.
- Command: `pnpm vitest run src/app/admin/settings/settings-code-splitting.test.ts`
- Intended result: failed because the settings client and loader files did not exist yet.

## 2026-05-13 05:19 IST - Admin Settings Route Shell Split

- Moved the existing settings client shell to `src/app/admin/settings/settings-client.tsx`.
- Replaced `src/app/admin/settings/page.tsx` with a server shell that renders `SettingsClientLoader`.
- Added `src/app/admin/settings/settings-client-loader.tsx` with a `next/dynamic` boundary and settings skeleton fallback.
- Command: `pnpm vitest run src/app/admin/settings/settings-code-splitting.test.ts`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 80 files / 188 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/settings` first-load JS dropped from about `184 kB` to `114 kB`.
  - Remaining admin routes above the small loader-backed range are mostly shared admin shell/index pages around `176-177 kB`, plus `/admin/events` about `161 kB` and `/admin/donations` about `152 kB`.
  - Largest remaining public/user routes include `/book` about `271 kB`, `/book/review` about `255 kB`, `/shop` about `236 kB`, and public auth routes about `203-214 kB`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Command: `date`
- Result: `Wed May 13 05:20:30 IST 2026`.

## 2026-05-13 05:21 IST - Public Booking Route Shell Analysis

- Current build observation:
  - `/book` is about `271 kB` first-load JS.
- Analysis:
  - The booking page is currently a full client route.
  - It statically imports the booking widget, availability-search hook, data context, pricing helpers, date formatting, toast, brochure section, selection logic, and availability UI into the route entry chunk.
  - `RoomTypeCard` and `BookingSummary` are already dynamic, but the surrounding booking workflow remains in `page.tsx`.
  - A low-risk split is to move the existing client workflow to `booking-client.tsx`, add `BookingClientLoader`, and make `page.tsx` a server shell.
- Test-first plan:
  - Extend the existing booking code-splitting test to require `page.tsx` as a server shell around `BookingClientLoader`.
  - Keep the existing assertions that `RoomTypeCard` and `BookingSummary` stay dynamic inside the client workflow.

## 2026-05-13 05:21 IST - Public Booking Route Shell Red Test

- Extended `src/app/(public)/book/book-code-splitting.test.ts` to require:
  - `page.tsx` as a server shell,
  - a client `BookingClientLoader`,
  - the existing booking workflow moved to `booking-client.tsx`.
- Command: `pnpm vitest run 'src/app/(public)/book/book-code-splitting.test.ts'`
- Intended result: failed because the booking client and loader files did not exist yet.

## 2026-05-13 05:22 IST - Public Booking Route Shell Split

- Moved the existing booking client workflow to `src/app/(public)/book/booking-client.tsx`.
- Replaced `src/app/(public)/book/page.tsx` with a server shell that renders `BookingClientLoader`.
- Added `src/app/(public)/book/booking-client-loader.tsx` with a `next/dynamic` boundary and booking-page skeleton fallback.
- Command: `pnpm vitest run 'src/app/(public)/book/book-code-splitting.test.ts'`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 80 files / 189 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/book` first-load JS dropped from about `271 kB` to `114 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 05:24:42 IST 2026`.

## 2026-05-13 05:25 IST - Public Booking Review Route Shell Analysis

- Next target: `/book/review`, build first-load JS about `255 kB`.
- Findings:
  - `src/app/(public)/book/review/page.tsx` is still a full client page.
  - The route imports `react-hook-form`, `zod`, `date-fns`, pricing helpers, data context, booking UI, and the dynamic country combobox before the route boundary.
  - The existing country-combobox code-splitting test only protects the country list split; it does not yet require a server shell around the review workflow.
- Plan:
  - Extend the booking review code-splitting test to require `page.tsx` as a server shell, a client `BookingReviewClientLoader`, and the heavy workflow moved to `booking-review-client.tsx`.
  - Keep the egress assertions that booking submission uses `/api/bookings/public`.

## 2026-05-13 05:25 IST - Public Booking Review Route Shell Red Test

- Extended `src/app/(public)/book/review/book-review-code-splitting.test.ts` to require:
  - `page.tsx` as a server shell,
  - a client `BookingReviewClientLoader`,
  - the existing review workflow moved to `booking-review-client.tsx`,
  - the existing public booking API egress assertions in the moved client workflow.
- Command: `pnpm vitest run 'src/app/(public)/book/review/book-review-code-splitting.test.ts'`
- Intended result: failed because the booking review client and loader files do not exist yet.

## 2026-05-13 05:26 IST - Public Booking Review Route Shell Split

- Moved the existing review workflow to `src/app/(public)/book/review/booking-review-client.tsx`.
- Replaced `src/app/(public)/book/review/page.tsx` with a server shell that renders `BookingReviewClientLoader`.
- Added `src/app/(public)/book/review/booking-review-client-loader.tsx` with a `next/dynamic` boundary and existing booking review skeleton fallback.
- Command: `pnpm vitest run 'src/app/(public)/book/review/book-review-code-splitting.test.ts'`
- Result: passed, 1 file / 3 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 80 files / 190 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/book/review` first-load JS dropped from about `255 kB` to `115 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 05:27:47 IST 2026`.

## 2026-05-13 05:28 IST - Public Shop Route Shell Analysis

- Next target: `/shop`, build first-load JS about `236 kB`.
- Findings:
  - `src/app/(public)/shop/page.tsx` is a full client page even though the hero is static.
  - The route imports filter state, sheet/select/slider controls, the product dataset, product cards, and pagination into the route chunk.
  - The hero image can remain server-rendered while the interactive catalog/filter workflow moves behind a client loader.
- Plan:
  - Add a route code-splitting test requiring `page.tsx` to be a server shell with the static hero and `ShopCatalogClientLoader`.
  - Move the filter/grid/pagination state into `shop-catalog-client.tsx` and load it dynamically via a route-local loader with a catalog skeleton.

## 2026-05-13 05:28 IST - Public Shop Route Shell Red Test

- Added `src/app/(public)/shop/shop-code-splitting.test.ts` to require:
  - a server-rendered shop page with the `/store.jpg` hero still in `page.tsx`,
  - a dynamic `ShopCatalogClientLoader`,
  - the filter/product/pagination workflow moved to `shop-catalog-client.tsx`.
- Command: `pnpm vitest run 'src/app/(public)/shop/shop-code-splitting.test.ts'`
- Intended result: failed because the shop catalog client and loader files do not exist yet.

## 2026-05-13 05:30 IST - Public Shop Route Shell Split

- Replaced `src/app/(public)/shop/page.tsx` with a server page that keeps the static hero image and renders `ShopCatalogClientLoader` for the catalog section.
- Added `src/app/(public)/shop/shop-catalog-client.tsx` for the existing filter/sort/product-grid/pagination workflow.
- Added `src/app/(public)/shop/shop-catalog-client-loader.tsx` with a `next/dynamic` boundary and catalog skeleton fallback.
- Command: `pnpm vitest run 'src/app/(public)/shop/shop-code-splitting.test.ts'`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 81 files / 192 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/shop` first-load JS dropped from about `236 kB` to `120 kB` while keeping the hero image in the server-rendered page.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 05:32:29 IST 2026`.

## 2026-05-13 05:33 IST - Public Booking Confirmation Route Shell Analysis

- Next target: `/book/confirmation/[id]`, build first-load JS about `214 kB`.
- Findings:
  - `src/app/(public)/book/confirmation/[id]/page.tsx` is still a full client page.
  - The route imports `date-fns`, many `lucide-react` icons, toast/invoice UI, data context, currency formatting, and confirmation rendering before a route-level dynamic boundary.
  - Egress has already been reduced to a single `/api/bookings/confirmation/[id]` payload; this pass should preserve that behavior while reducing initial JS.
- Plan:
  - Extend the existing confirmation egress test to require `page.tsx` as a server shell and move the browser confirmation workflow to `booking-confirmation-client.tsx`.
  - Add a dynamic `BookingConfirmationClientLoader` with a lightweight loading fallback.

## 2026-05-13 05:33 IST - Public Booking Confirmation Route Shell Red Test

- Extended `src/app/(public)/book/confirmation/[id]/booking-confirmation-egress.test.ts` to require:
  - `page.tsx` as a server shell,
  - a dynamic `BookingConfirmationClientLoader`,
  - the existing single confirmation API fetch preserved in `booking-confirmation-client.tsx`.
- Command: `pnpm vitest run 'src/app/(public)/book/confirmation/[id]/booking-confirmation-egress.test.ts'`
- Intended result: failed because the booking confirmation client and loader files do not exist yet.

## 2026-05-13 05:34 IST - Public Booking Confirmation Route Shell Split

- Moved the existing confirmation workflow to `src/app/(public)/book/confirmation/[id]/booking-confirmation-client.tsx`.
- Replaced `src/app/(public)/book/confirmation/[id]/page.tsx` with a server shell that renders `BookingConfirmationClientLoader`.
- Added `src/app/(public)/book/confirmation/[id]/booking-confirmation-client-loader.tsx` with a `next/dynamic` boundary and lightweight loading fallback.
- Command: `pnpm vitest run 'src/app/(public)/book/confirmation/[id]/booking-confirmation-egress.test.ts'`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 81 files / 193 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/book/confirmation/[id]` first-load JS dropped from about `214 kB` to `106 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 05:35:28 IST 2026`.

## 2026-05-13 05:36 IST - Auth Route Form Loader Analysis

- Next targets: `/login` about `214 kB`, `/admin/forget-password` about `208 kB`, `/forgot-password` about `207 kB`, `/register` about `207 kB`, and `/resetpassword` about `204 kB`.
- Findings:
  - The auth pages are server pages but import client form wrappers directly.
  - The direct imports pull `react-hook-form`, `zod`, Supabase auth client code, toast, and auth form UI into the initial route chunk.
  - The existing `/admin/login` pass already proved the loader pattern for auth forms, dropping it to about `114 kB`.
- Plan:
  - Add failing route tests requiring user/admin auth pages to import dynamic loaders instead of direct client wrappers.
  - Add loaders for user login/register/forgot/reset and admin forgot-password forms, keeping the form implementations unchanged.

## 2026-05-13 05:37 IST - Auth Route Form Loader Red Test

- Added `src/app/(auth)/auth-code-splitting.test.ts` to require dynamic loaders for:
  - `/login`,
  - `/register`,
  - `/forgot-password`,
  - `/resetpassword`,
  - `/admin/forget-password`.
- Command: `pnpm vitest run 'src/app/(auth)/auth-code-splitting.test.ts'`
- Intended result: failed because the user/admin auth form loader files do not exist yet.

## 2026-05-13 05:39 IST - Auth Route Form Loader Split

- Added `src/components/auth/auth-form-skeleton.tsx` as a shared lightweight auth form fallback.
- Added dynamic loaders for:
  - `src/components/auth/user/login-loader.tsx`,
  - `src/components/auth/user/register-loader.tsx`,
  - `src/components/auth/user/forgot-password-loader.tsx`,
  - `src/components/auth/user/reset-password-loader.tsx`,
  - `src/components/auth/admin/forgot-password-loader.tsx`.
- Updated `/login`, `/register`, `/forgot-password`, `/resetpassword`, and `/admin/forget-password` pages to render the loaders instead of direct client form wrappers.
- Command: `pnpm vitest run 'src/app/(auth)/auth-code-splitting.test.ts'`
- Result: passed, 1 file / 5 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 82 files / 198 tests.
- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/login` first-load JS dropped from about `214 kB` to `115 kB`.
  - `/register` first-load JS dropped from about `207 kB` to `115 kB`.
  - `/forgot-password` first-load JS dropped from about `207 kB` to `115 kB`.
  - `/resetpassword` first-load JS dropped from about `204 kB` to `115 kB`.
  - `/admin/forget-password` first-load JS dropped from about `208 kB` to `115 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 05:40:29 IST 2026`.

## 2026-05-13 05:41 IST - Public Room Detail Route Shell Analysis

- Next target: `/book/rooms/[id]`, build first-load JS about `190 kB`.
- Findings:
  - `src/app/(public)/book/rooms/[id]/page.tsx` is still a full client page.
  - Inner components are already deferred, but the route still imports data context, client state, `useParams`, `lucide-react` icons, and the main room-detail render path before a route-level dynamic boundary.
- Plan:
  - Extend the existing room detail code-splitting test to require a server route shell plus `RoomDetailClientLoader`.
  - Move the existing client workflow to `room-detail-client.tsx` while preserving the existing dynamic inner splits.

## 2026-05-13 05:41 IST - Public Room Detail Route Shell Red Test

- Extended `src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts` to require:
  - `page.tsx` as a server shell,
  - a dynamic `RoomDetailClientLoader`,
  - the existing room detail workflow moved to `room-detail-client.tsx`,
  - the existing deferred booking panel, carousel, policy accordion, related room card, share dialog, and amenity icon assertions preserved.
- Command: `pnpm vitest run 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts'`
- Intended result: failed because the room detail client and loader files do not exist yet.

## 2026-05-13 05:42 IST - Public Room Detail Route Shell Split

- Moved the existing room detail workflow to `src/app/(public)/book/rooms/[id]/room-detail-client.tsx`.
- Replaced `src/app/(public)/book/rooms/[id]/page.tsx` with a server shell that renders `RoomDetailClientLoader`.
- Added `src/app/(public)/book/rooms/[id]/room-detail-client-loader.tsx` with a `next/dynamic` boundary and existing room detail skeleton fallback.
- Command: `pnpm vitest run 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts'`
- Result: passed, 1 file / 4 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 82 files / 199 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/book/rooms/[id]` first-load JS dropped from about `190 kB` to `115 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 05:43:16 IST 2026`.

## 2026-05-13 05:44 IST - Admin Management Index Route Shell Analysis

- Next targets: admin index pages still around `177 kB` first-load JS (`/admin/guests`, `/admin/rooms`, `/admin/room-types`, `/admin/rates`, `/admin/room-categories`, `/admin/reservations`).
- Findings:
  - These pages are still client route modules because they import `PermissionGate` directly and define `next/dynamic` panel imports in `page.tsx`.
  - Already-optimized admin pages use a server page that renders a small client loader, with `PermissionGate` inside the deferred panel module.
- Plan:
  - Extend the existing admin management code-splitting test to require server route shells plus route-local panel loaders.
  - Move permission gates from the route files into the deferred panel modules.

## 2026-05-13 05:45 IST - Admin Management Index Route Shell Red Test

- Extended `src/app/admin/admin-management-code-splitting.test.ts` to require server shells and dynamic panel loaders for:
  - guests,
  - rooms,
  - room types,
  - rates,
  - room categories,
  - reservations.
- Command: `pnpm vitest run 'src/app/admin/admin-management-code-splitting.test.ts'`
- Intended result: failed because the six panel loader files do not exist yet.

## 2026-05-13 05:48 IST - Admin Management Index Route Shell Split

- Replaced the following admin index pages with server shells:
  - `/admin/guests`,
  - `/admin/rooms`,
  - `/admin/room-types`,
  - `/admin/rates`,
  - `/admin/room-categories`,
  - `/admin/reservations`.
- Added dynamic panel loaders for all six routes.
- Moved each route's `PermissionGate` into the deferred panel module so route pages no longer import client auth/permission code directly.
- Command: `pnpm vitest run 'src/app/admin/admin-management-code-splitting.test.ts'`
- Result: passed, 1 file / 7 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 82 files / 205 tests.
- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/admin/guests` first-load JS dropped from about `177 kB` to `106 kB`.
  - `/admin/rooms` first-load JS dropped from about `177 kB` to `106 kB`.
  - `/admin/room-types` first-load JS dropped from about `177 kB` to `106 kB`.
  - `/admin/rates` first-load JS dropped from about `177 kB` to `106 kB`.
  - `/admin/room-categories` first-load JS dropped from about `177 kB` to `106 kB`.
  - `/admin/reservations` first-load JS dropped from about `177 kB` to `106 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 05:49:08 IST 2026`.

## 2026-05-13 05:50 IST - Admin Operational Route Shell Analysis

- Next targets: `/admin/dashboard`, `/admin/calendar`, `/admin/housekeeping`, and `/admin/reports`, all still about `177 kB` first-load JS.
- Findings:
  - These route files still import `PermissionGate` directly and define dynamic imports in the page module.
  - Dashboard, calendar, housekeeping, and reports already have deferred heavy panels/inner modules, so this pass should move only the route shell and permission boundary.
- Plan:
  - Extend their existing code-splitting tests to require server route shells plus dynamic panel loaders.
  - Move `PermissionGate` into the deferred panel modules and keep the existing inner dynamic imports.

## 2026-05-13 05:51 IST - Admin Operational Route Shell Red Test

- Extended focused tests for dashboard, calendar, housekeeping, and reports to require:
  - server route pages,
  - dynamic route-level loaders,
  - permission gates inside the deferred panel modules,
  - existing inner dynamic imports preserved.
- Command: `pnpm vitest run 'src/app/admin/dashboard/dashboard-code-splitting.test.ts' 'src/app/admin/calendar/calendar-code-splitting.test.ts' 'src/app/admin/housekeeping/housekeeping-code-splitting.test.ts' 'src/app/admin/reports/reports-code-splitting.test.ts'`
- Intended result: failed because the route-level panel loaders and calendar/reports panel files do not exist yet.

## 2026-05-13 05:55 IST - Admin Operational Route Shell Split

- Replaced `/admin/dashboard`, `/admin/calendar`, `/admin/housekeeping`, and `/admin/reports` pages with server shells.
- Added route-level dynamic panel loaders for all four routes.
- Moved `PermissionGate` into the deferred dashboard, calendar, housekeeping, and reports panel modules.
- Kept the existing inner dynamic imports for dashboard board dependencies, availability calendar, housekeeping workflow, and report charts.
- Command: `pnpm vitest run 'src/app/admin/dashboard/dashboard-code-splitting.test.ts' 'src/app/admin/calendar/calendar-code-splitting.test.ts' 'src/app/admin/housekeeping/housekeeping-code-splitting.test.ts' 'src/app/admin/reports/reports-code-splitting.test.ts'`
- Result: passed, 4 files / 8 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 82 files / 209 tests.
- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/admin/dashboard` first-load JS dropped from about `177 kB` to `106 kB`.
  - `/admin/calendar` first-load JS dropped from about `177 kB` to `106 kB`.
  - `/admin/housekeeping` first-load JS dropped from about `177 kB` to `106 kB`.
  - `/admin/reports` first-load JS dropped from about `177 kB` to `106 kB`.
  - `/admin` also dropped from about `177 kB` to `106 kB` because it now shares the lighter admin route shell chunk.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 05:56:28 IST 2026`.

## 2026-05-13 05:57 IST - Public Feedback Form Loader Analysis

- Next target: `/feedback`, build first-load JS about `176 kB`.
- Findings:
  - `src/app/(public)/feedback/page.tsx` is a server page with static copy and metadata, but it imports the client `FeedbackForm` directly.
  - The form pulls `react-hook-form`, `zod`, form UI, radio group, textarea, and feedback submission logic into the initial route chunk.
- Plan:
  - Add a route code-splitting test requiring the static page to render `FeedbackFormLoader`.
  - Add a dynamic loader for `FeedbackForm` with a form-shaped skeleton fallback.

## 2026-05-13 05:57 IST - Public Feedback Form Loader Red Test

- Added `src/app/(public)/feedback/feedback-code-splitting.test.ts` to require `FeedbackFormLoader` and keep the direct feedback form import out of the page module.
- Command: `pnpm vitest run 'src/app/(public)/feedback/feedback-code-splitting.test.ts'`
- Intended result: failed because `feedback-form-loader.tsx` does not exist yet.

## 2026-05-13 05:59 IST - Public Feedback Form Loader Split

- Added `src/components/feedback/feedback-form-loader.tsx` with a `next/dynamic` boundary and form-shaped skeleton fallback.
- Updated `src/app/(public)/feedback/page.tsx` to keep the static page copy server-rendered and load the feedback form through `FeedbackFormLoader`.
- Command: `pnpm vitest run 'src/app/(public)/feedback/feedback-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 83 files / 210 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/feedback` first-load JS dropped from about `176 kB` to `114 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:00:43 IST 2026`.

## 2026-05-13 06:02 IST - About Rishikesh Lower Section Split Analysis

- Next target: `/about-rishikesh`, build first-load JS about `172 kB`.
- Findings:
  - The route is a full client page importing the hero, attractions grid, and map sections.
  - The hero is first-viewport content with a priority image, so it should stay directly rendered instead of moving the entire page behind a loader.
  - The attractions grid and map are below the first viewport and can be deferred behind a route-local client loader.
- Plan:
  - Add a code-splitting test that keeps `RishikeshHeroSection` in the page shell and moves `KeyAttractionsSection` / `MapSection` to a deferred module.

## 2026-05-13 06:02 IST - About Rishikesh Lower Section Red Test

- Added `src/app/(public)/about-rishikesh/about-rishikesh-code-splitting.test.ts` to require:
  - no route-level `"use client"`,
  - hero retained in `page.tsx`,
  - lower sections loaded through `RishikeshSectionsLoader`.
- Command: `pnpm vitest run 'src/app/(public)/about-rishikesh/about-rishikesh-code-splitting.test.ts'`
- Intended result: failed because the lower-section loader and module do not exist yet.

## 2026-05-13 06:03 IST - About Rishikesh Lower Section Split

- Converted `src/app/(public)/about-rishikesh/page.tsx` to a server page that keeps `RishikeshHeroSection` directly rendered.
- Added `src/app/(public)/about-rishikesh/rishikesh-sections.tsx` for the lower attractions/map sections.
- Added `src/app/(public)/about-rishikesh/rishikesh-sections-loader.tsx` with a `next/dynamic` boundary and lower-page skeleton fallback.
- Command: `pnpm vitest run 'src/app/(public)/about-rishikesh/about-rishikesh-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 84 files / 211 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/about-rishikesh` first-load JS dropped from about `172 kB` to `162 kB` while keeping the priority hero directly rendered.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:05:46 IST 2026`.

## 2026-05-13 06:07 IST - Profile Route Shell Red Test

- Added `src/app/profile/profile-code-splitting.test.ts` to require the profile route page to become a server shell around a dynamic profile client.
- Command: `pnpm vitest run 'src/app/profile/profile-code-splitting.test.ts'`
- Intended result: failed because `profile-client-loader.tsx` and `profile-client.tsx` do not exist yet.

## 2026-05-13 06:09 IST - Profile Route Shell Split

- Moved the existing profile route client body to `src/app/profile/profile-client.tsx`.
- Replaced `src/app/profile/page.tsx` with a server shell that renders `ProfileClientLoader`.
- Added `src/app/profile/profile-client-loader.tsx` with a `next/dynamic` boundary and lightweight profile skeleton fallback.
- Command: `pnpm vitest run 'src/app/profile/profile-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 85 files / 212 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/profile` first-load JS dropped from about `166 kB` to `114 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:11:07 IST 2026`.

## 2026-05-13 06:12 IST - Journey Lower Section Red Test

- Added `src/app/(public)/journey/journey-code-splitting.test.ts` to require:
  - no route-level `"use client"`,
  - priority hero retained in `page.tsx`,
  - timeline and CTA moved behind `JourneySectionsLoader`.
- Command: `pnpm vitest run 'src/app/(public)/journey/journey-code-splitting.test.ts'`
- Intended result: failed because the lower-section loader and module do not exist yet.

## 2026-05-13 06:13 IST - Journey Lower Section Split

- Converted `src/app/(public)/journey/page.tsx` to a server page that keeps `JourneyHeroSection` directly rendered.
- Added `src/app/(public)/journey/journey-sections.tsx` for the timeline and CTA sections.
- Added `src/app/(public)/journey/journey-sections-loader.tsx` with a `next/dynamic` boundary and timeline-shaped skeleton fallback.
- Command: `pnpm vitest run 'src/app/(public)/journey/journey-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 86 files / 213 tests.
- Research refresh: checked the official Next.js Lazy Loading guide (last updated March 31, 2026). It still supports the current route pattern: keep the page/server shell light, put `next/dynamic` in a small client loader, and defer heavier client sections there.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/journey` first-load JS dropped from about `172 kB` to `157 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:16:50 IST 2026`.

## 2026-05-13 06:17 IST - About Us Route Analysis

- Current build observation: `/about-us` is about `163 kB` first-load JS.
- Analysis:
  - `src/app/(public)/about-us/page.tsx` is still a route-level client component.
  - It directly imports the hero, story, activities, and places-to-visit sections.
  - All four sections are client components using Framer Motion; the story/activities/places sections are below the hero and can be deferred without changing the page data contract.
  - Low-risk plan: keep `AboutHeroSection` in the route shell for above-the-fold content, move the lower sections into an `AboutUsSections` client module, and load it through a small `next/dynamic` client loader.

## 2026-05-13 06:17 IST - About Us Lower Section Red Test

- Added `src/app/(public)/about-us/about-us-code-splitting.test.ts` to require:
  - no route-level `"use client"`,
  - hero retained in `page.tsx`,
  - story, activities, and places-to-visit sections moved behind `AboutUsSectionsLoader`.
- Command: `pnpm vitest run 'src/app/(public)/about-us/about-us-code-splitting.test.ts'`
- Intended result: failed because `about-us-sections-loader.tsx` and `about-us-sections.tsx` do not exist yet.

## 2026-05-13 06:18 IST - About Us Lower Section Split

- Converted `src/app/(public)/about-us/page.tsx` to a server page that keeps `AboutHeroSection` directly rendered.
- Added `src/app/(public)/about-us/about-us-sections.tsx` for the story, activities, and places-to-visit sections.
- Added `src/app/(public)/about-us/about-us-sections-loader.tsx` with a `next/dynamic` boundary and page-section skeleton fallback.
- Command: `pnpm vitest run 'src/app/(public)/about-us/about-us-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 87 files / 214 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/about-us` first-load JS moved from about `163 kB` to `162 kB`; remaining weight is likely from the directly rendered `AboutHeroSection` client/Framer Motion path.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:19:49 IST 2026`.

## 2026-05-13 06:20 IST - Ashram Glimpse Route Analysis

- Current build observation: `/ashram-glimpse` is about `162 kB` first-load JS.
- Analysis:
  - `src/app/(public)/ashram-glimpse/page.tsx` is still a route-level client component.
  - The only route component, `GalleryPageSection`, statically imports `yet-another-react-lightbox`, its download/counter plugins, and lightbox toolbar icons before a visitor opens any image.
  - Official Next.js lazy-loading guidance supports both `next/dynamic` component splits and on-demand external-library loading. This route can use both patterns: a server page plus dynamic gallery section, and a nested dynamic lightbox chunk only mounted after an image is opened.
- Test-first plan:
  - Add source coverage requiring the page to become a server shell around `GalleryPageSectionLoader`.
  - Require `GalleryPageSection` to stop importing `yet-another-react-lightbox` directly and render a dynamically imported `GalleryLightbox` module instead.

## 2026-05-13 06:21 IST - Ashram Glimpse Red Test

- Added `src/app/(public)/ashram-glimpse/ashram-glimpse-code-splitting.test.ts` to require:
  - `page.tsx` to become a server shell around `GalleryPageSectionLoader`,
  - `GalleryPageSection` to dynamically import `GalleryLightbox`,
  - the lightbox package/plugins to move into `gallery-lightbox.tsx`.
- Command: `pnpm vitest run 'src/app/(public)/ashram-glimpse/ashram-glimpse-code-splitting.test.ts'`
- Intended result: failed because the route loader and `gallery-lightbox.tsx` do not exist yet.

## 2026-05-13 06:23 IST - Ashram Glimpse Route And Lightbox Split

- Converted `src/app/(public)/ashram-glimpse/page.tsx` to a server shell that renders `GalleryPageSectionLoader`.
- Added `src/app/(public)/ashram-glimpse/gallery-page-section-loader.tsx` with a `next/dynamic` boundary around `GalleryPageSection` and gallery-grid skeleton fallback.
- Added `src/components/marketing/gallery/gallery-lightbox.tsx` for the `yet-another-react-lightbox` package, plugins, download filename mapping, and toolbar icons.
- Updated `src/components/marketing/gallery/gallery-page-section.tsx` so the lightbox chunk is dynamically imported and only mounted while the viewer is open.
- Command: `pnpm vitest run 'src/app/(public)/ashram-glimpse/ashram-glimpse-code-splitting.test.ts'`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 88 files / 216 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/ashram-glimpse` first-load JS dropped from about `162 kB` to `114 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:24:17 IST 2026`.

## 2026-05-13 06:25 IST - Donate Route Analysis

- Current build observation: `/donate` is about `161 kB` first-load JS and has a large route payload.
- Analysis:
  - `src/app/(public)/donate/page.tsx` is already a server page and keeps the hero/stats server-rendered.
  - It directly imports and renders the client `DonationForm`, which pulls React Hook Form, zod resolver, validation, toast, receipt storage, and checkout script orchestration into the initial donation route.
  - It also directly renders `DonationFaqAccordion`, which pulls the client accordion primitives into the initial route.
  - Low-risk plan: keep donation stats and currency server-side, replace direct form/FAQ rendering with client loaders that dynamically import the existing components. The form loader must keep `id="donation-form"` in its fallback so the hero CTA anchor still works during loading.

## 2026-05-13 06:25 IST - Donate Route Red Test

- Added `src/app/(public)/donate/donate-code-splitting.test.ts` to require:
  - the page to use `DonationFormLoader` and `DonationFaqAccordionLoader`,
  - the form loader to dynamically import `DonationForm`,
  - the FAQ loader to dynamically import `DonationFaqAccordion`,
  - the form fallback to retain `id="donation-form"` for the hero CTA anchor.
- Command: `pnpm vitest run 'src/app/(public)/donate/donate-code-splitting.test.ts'`
- Intended result: failed because `donation-form-loader.tsx` does not exist yet.

## 2026-05-13 06:26 IST - Donate Form And FAQ Split

- Added `src/components/donations/donation-form-loader.tsx` with a `next/dynamic` boundary around `DonationForm` and a fallback that preserves `id="donation-form"`.
- Added `src/components/donations/faq-accordion-loader.tsx` with a `next/dynamic` boundary around `DonationFaqAccordion`.
- Updated `src/app/(public)/donate/page.tsx` to keep hero/stats/trust signals direct while rendering the form and FAQ through the loaders.
- Command: `pnpm vitest run 'src/app/(public)/donate/donate-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 89 files / 217 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/donate` first-load JS dropped from about `161 kB` to `115 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:27:36 IST 2026`.

## 2026-05-13 06:28 IST - Admin Events Index Analysis

- Current build observation: `/admin/events` is about `162 kB` first-load JS.
- Analysis:
  - `src/app/admin/events/page.tsx` is a server page that performs permission checks and fetches events server-side.
  - It directly imports the client `EventsTable`, which pulls date formatting, image cells, switches, tooltips, server actions, toast, and table UI into the route boundary.
  - Low-risk plan: keep permission/data fetch and header actions in the server page, move only the event table behind an `EventsTableLoader` dynamic client boundary.

## 2026-05-13 06:28 IST - Admin Events Index Red Test

- Added `src/app/admin/events/events-index-code-splitting.test.ts` to require the events index page to render `EventsTableLoader` instead of importing `EventsTable` directly.
- Command: `pnpm vitest run src/app/admin/events/events-index-code-splitting.test.ts`
- Intended result: failed because `src/components/admin/events/events-table-loader.tsx` does not exist yet.

## 2026-05-13 06:29 IST - Admin Events Index Table Split

- Added `src/components/admin/events/events-table-loader.tsx` with a `next/dynamic` boundary around `EventsTable` and a table-shaped skeleton fallback.
- Updated `src/app/admin/events/page.tsx` to render `EventsTableLoader` after the existing permission check and server-side `getAllEvents()` fetch.
- Command: `pnpm vitest run src/app/admin/events/events-index-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 90 files / 218 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/admin/events` first-load JS dropped from about `162 kB` to `118 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:30:32 IST 2026`.

## 2026-05-13 06:31 IST - Admin Donations Index Analysis

- Current build observation: `/admin/donations` is about `153 kB` first-load JS.
- Analysis:
  - `src/app/admin/donations/page.tsx` is a server page that performs permission checks, parses URL filters, and fetches stats/donations/currency server-side.
  - It keeps `DonationStatsGrid` server-rendered, which is desirable.
  - It directly imports the client `DonationFilters` and `DonationsTable`, pulling router state, select controls, date-fns, badges, and table UI into the route boundary.
  - Low-risk plan: keep stats/data fetching in the page and move filters plus table into a route-local `DonationsIndexPanel` loaded through a dynamic `DonationsIndexLoader`.

## 2026-05-13 06:31 IST - Admin Donations Index Red Test

- Added `src/app/admin/donations/donations-index-code-splitting.test.ts` to require filters/table to move behind a dynamic `DonationsIndexLoader` while keeping `DonationStatsGrid` directly rendered.
- Command: `pnpm vitest run src/app/admin/donations/donations-index-code-splitting.test.ts`
- Intended result: failed because `donations-index-loader.tsx` and `donations-index-panel.tsx` do not exist yet.

## 2026-05-13 06:32 IST - Admin Donations Index Panel Split

- Added `src/app/admin/donations/donations-index-panel.tsx` for `DonationFilters` and `DonationsTable`.
- Added `src/app/admin/donations/donations-index-loader.tsx` with a `next/dynamic` boundary and filter/table skeleton fallback.
- Updated `src/app/admin/donations/page.tsx` to keep stats direct while rendering filters/table through `DonationsIndexLoader`.
- Command: `pnpm vitest run src/app/admin/donations/donations-index-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 91 files / 219 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/admin/donations` first-load JS dropped from about `153 kB` to `114 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:33:18 IST 2026`.

## 2026-05-13 06:34 IST - Amenities Route Analysis

- Current build observation: `/amenities` is about `155 kB` first-load JS.
- Analysis:
  - `src/app/(public)/amenities/page.tsx` is a server page, but it directly imports lower client sections.
  - `AmenitiesHeroSection` is marked `"use client"` even though it only renders static image/text markup.
  - `EssentialAmenitiesGrid` and `DailyRhythmSection` use Framer Motion; `DailyRhythmSection` also imports multiple `react-icons` icons.
  - Low-risk plan: make the static hero a server component, keep it directly rendered for above-the-fold content, and move the lower amenities sections behind an `AmenitiesSectionsLoader` dynamic client boundary.

## 2026-05-13 06:34 IST - Amenities Route Red Test

- Added `src/app/(public)/amenities/amenities-code-splitting.test.ts` to require:
  - static `AmenitiesHeroSection` without `"use client"`,
  - lower amenities sections moved behind `AmenitiesSectionsLoader`,
  - deferred sections collected in `amenities-sections.tsx`.
- Command: `pnpm vitest run 'src/app/(public)/amenities/amenities-code-splitting.test.ts'`
- Intended result: failed because `amenities-sections-loader.tsx` and `amenities-sections.tsx` do not exist yet.

## 2026-05-13 06:35 IST - Amenities Route Split

- Removed the unnecessary `"use client"` directive from `src/components/marketing/amenities/HeroSection.tsx`.
- Added `src/app/(public)/amenities/amenities-sections.tsx` for the animated amenities grid and daily rhythm sections.
- Added `src/app/(public)/amenities/amenities-sections-loader.tsx` with a `next/dynamic` boundary and amenities-shaped skeleton fallback.
- Updated `src/app/(public)/amenities/page.tsx` to keep the static hero direct and render lower sections through `AmenitiesSectionsLoader`.
- Command: `pnpm vitest run 'src/app/(public)/amenities/amenities-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 92 files / 220 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/amenities` first-load JS dropped from about `155 kB` to `120 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:36:22 IST 2026`.

## 2026-05-13 06:37 IST - Sunil Bhagat Route Analysis

- Current build observation: `/sunil-bhagat` is about `157 kB` first-load JS.
- Analysis:
  - `src/app/(public)/sunil-bhagat/page.tsx` is still a route-level client component.
  - `SunilBhagatUnifiedSection` is the above-the-fold interactive tabbed profile and should remain directly rendered.
  - `SwamiSpeechSection` is lower on the page and includes Framer Motion, YouTube iframes, and icon imports; it can be moved behind a route-local dynamic loader without changing route data behavior.
  - Low-risk plan: convert the page to a server shell that keeps `SunilBhagatUnifiedSection` direct and defers the speech section through `SunilBhagatSectionsLoader`.

## 2026-05-13 06:37 IST - Sunil Bhagat Red Test

- Added `src/app/(public)/sunil-bhagat/sunil-bhagat-code-splitting.test.ts` to require:
  - no route-level `"use client"`,
  - direct `SunilBhagatUnifiedSection`,
  - deferred `SwamiSpeechSection` through `SunilBhagatSectionsLoader`.
- Command: `pnpm vitest run 'src/app/(public)/sunil-bhagat/sunil-bhagat-code-splitting.test.ts'`
- Intended result: failed because `sunil-bhagat-sections-loader.tsx` and `sunil-bhagat-sections.tsx` do not exist yet.

## 2026-05-13 06:38 IST - Sunil Bhagat Lower Section Split

- Converted `src/app/(public)/sunil-bhagat/page.tsx` to a server shell that keeps `SunilBhagatUnifiedSection` directly rendered.
- Added `src/app/(public)/sunil-bhagat/sunil-bhagat-sections.tsx` for `SwamiSpeechSection`.
- Added `src/app/(public)/sunil-bhagat/sunil-bhagat-sections-loader.tsx` with a `next/dynamic` boundary and teaching-video skeleton fallback.
- Command: `pnpm vitest run 'src/app/(public)/sunil-bhagat/sunil-bhagat-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 93 files / 221 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/sunil-bhagat` moved from about `157 kB` to `161 kB`; deferring only the lower speech section was a net regression because the direct tabbed profile still dominates the route and the loader added overhead.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:39:22 IST 2026`.

## 2026-05-13 06:40 IST - Sunil Bhagat Corrective Analysis

- Follow-up from build: lower-section-only deferral increased `/sunil-bhagat` first-load JS because the direct tabbed profile still owns the expensive Framer Motion/AnimatePresence path.
- Corrective plan:
  - Keep a static server-rendered intro in the route for visible content and basic SEO.
  - Move the interactive tabbed profile into `SunilBhagatProfileLoader`.
  - Keep the speech section behind the existing lower-section loader.
  - Update the test so the route shell no longer imports `SunilBhagatUnifiedSection` directly.

## 2026-05-13 06:40 IST - Sunil Bhagat Corrective Red Test

- Updated `src/app/(public)/sunil-bhagat/sunil-bhagat-code-splitting.test.ts` to require a static intro plus dynamic profile and speech loaders.
- Command: `pnpm vitest run 'src/app/(public)/sunil-bhagat/sunil-bhagat-code-splitting.test.ts'`
- Intended result: failed because `sunil-bhagat-profile-loader.tsx` and `sunil-bhagat-profile.tsx` do not exist yet.

## 2026-05-13 06:41 IST - Sunil Bhagat Corrective Profile Split

- Added `src/app/(public)/sunil-bhagat/sunil-bhagat-intro.tsx` for the static server-rendered intro copy.
- Added `src/app/(public)/sunil-bhagat/sunil-bhagat-profile.tsx` and `sunil-bhagat-profile-loader.tsx` to defer the interactive tabbed profile.
- Updated `SunilBhagatUnifiedSection` with `showIntro={false}` support so the dynamic profile chunk can reuse the tabbed content without duplicating the intro.
- Updated `src/app/(public)/sunil-bhagat/page.tsx` to render the static intro, dynamic profile loader, and existing dynamic speech loader.
- Command: `pnpm vitest run 'src/app/(public)/sunil-bhagat/sunil-bhagat-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 93 files / 221 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/sunil-bhagat` first-load JS dropped from the original about `157 kB` to `115 kB`; this also corrected the temporary lower-section-only regression to about `161 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:43:04 IST 2026`.

## 2026-05-13 06:44 IST - Journey Hero Analysis

- Current build observation after lower-section split: `/journey` is about `157 kB` first-load JS.
- Analysis:
  - `JourneyHeroSection` is still a client component solely for entrance animations.
  - The hero is otherwise static image/text content and already uses a priority image.
  - Framer Motion in the directly rendered hero now dominates the route first-load path; converting it to a server component should preserve content and remove the animation bundle from the shell.

## 2026-05-13 06:44 IST - Journey Hero Red Test

- Updated `src/app/(public)/journey/journey-code-splitting.test.ts` to require `JourneyHeroSection` to be server-rendered without Framer Motion.
- Command: `pnpm vitest run 'src/app/(public)/journey/journey-code-splitting.test.ts'`
- Intended result: failed because `JourneyHeroSection` still has `"use client"` and imports `framer-motion`.

## 2026-05-13 06:44 IST - Journey Hero Server Render

- Removed `"use client"` and Framer Motion from `src/components/marketing/journey/JourneyHeroSection.tsx`.
- Kept the same priority image, overlay, heading, and supporting copy as static server-rendered markup.
- Command: `pnpm vitest run 'src/app/(public)/journey/journey-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 93 files / 221 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/journey` first-load JS dropped from about `157 kB` to `120 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:45:38 IST 2026`.

## 2026-05-13 06:46 IST - About Rishikesh Hero Analysis

- Current build observation: `/about-rishikesh` is about `162 kB` first-load JS.
- Analysis:
  - Lower sections are already behind `RishikeshSectionsLoader`.
  - `RishikeshHeroSection` remains a direct client component solely for Framer Motion entrance animations.
  - The hero content is static image/text/links, so it can be server-rendered like the journey hero to remove the direct Framer path.

## 2026-05-13 06:46 IST - About Rishikesh Hero Red Test

- Updated `src/app/(public)/about-rishikesh/about-rishikesh-code-splitting.test.ts` to require `RishikeshHeroSection` to be server-rendered without Framer Motion.
- Command: `pnpm vitest run 'src/app/(public)/about-rishikesh/about-rishikesh-code-splitting.test.ts'`
- Intended result: failed because the hero still has `"use client"` and imports `framer-motion`.

## 2026-05-13 06:47 IST - About Rishikesh Hero Server Render

- Removed `"use client"` and Framer Motion from `src/components/marketing/about/rishikesh-hero-section.tsx`.
- Kept the same layout, copy, CTA, and priority image as static server-rendered markup.
- Command: `pnpm vitest run 'src/app/(public)/about-rishikesh/about-rishikesh-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 93 files / 221 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/about-rishikesh` first-load JS dropped from about `162 kB` to `123 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:49:06 IST 2026`.

## 2026-05-13 06:50 IST - About Us Hero Analysis

- Current build observation after lower-section split: `/about-us` is about `162 kB` first-load JS.
- Analysis:
  - Lower sections are already behind `AboutUsSectionsLoader`.
  - `AboutHeroSection` remains a direct client component solely for Framer Motion entrance animations.
  - The hero content is static image/text/CTA, so it can be server-rendered to remove the direct Framer path.

## 2026-05-13 06:50 IST - About Us Hero Red Test

- Updated `src/app/(public)/about-us/about-us-code-splitting.test.ts` to require `AboutHeroSection` to be server-rendered without Framer Motion.
- Command: `pnpm vitest run 'src/app/(public)/about-us/about-us-code-splitting.test.ts'`
- Intended result: failed because the hero still has `"use client"` and imports `framer-motion`.

## 2026-05-13 06:51 IST - About Us Hero Server Render

- Removed `"use client"` and Framer Motion from `src/components/marketing/about/about-hero-section.tsx`.
- Kept the same layout, copy, CTA, and image as static server-rendered markup.
- Command: `pnpm vitest run 'src/app/(public)/about-us/about-us-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 93 files / 221 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/about-us` first-load JS dropped from about `162 kB` to `123 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:52:13 IST 2026`.

## 2026-05-13 06:53 IST - Home Route Analysis

- Current build observation: `/` is about `165 kB` first-load JS.
- Analysis:
  - `src/app/(public)/page.tsx` is still a full client page because hero/features use Framer Motion.
  - Most lower sections are already dynamically imported, but the dynamic boundaries live inside the route-level client page.
  - `FeatureCard` is marked `"use client"` even though it renders static image/text/link markup.
  - The support actions require icon components, so those props should stay inside a deferred client module rather than being passed from a server page.
  - Low-risk plan: convert the home page to a server shell with static hero/features, move modal/lower sections/support actions into a route-local `HomeDeferredSectionsLoader`, and remove the unnecessary client directive from `FeatureCard`.

## 2026-05-13 06:54 IST - Home Route Red Test

- Updated `src/app/(public)/home-code-splitting.test.ts` to require:
  - no route-level `"use client"`,
  - no direct Framer Motion in the route page,
  - route-level `HomeDeferredSectionsLoader`,
  - deferred modal/lower sections/support actions in `home-deferred-sections.tsx`,
  - `FeatureCard` without `"use client"`.
- Command: `pnpm vitest run 'src/app/(public)/home-code-splitting.test.ts'`
- Intended result: failed because `home-deferred-sections-loader.tsx` and `home-deferred-sections.tsx` do not exist yet.

## 2026-05-13 06:56 IST - Home Route Server Shell Split

- Converted `src/app/(public)/page.tsx` from a route-level client component to a server shell.
- Removed route-level Framer Motion from the home hero and feature grid while keeping the same content, images, and layout.
- Added `src/app/(public)/home-deferred-sections.tsx` for the event banner modal, lower sections, and support actions.
- Added `src/app/(public)/home-deferred-sections-loader.tsx` with a `next/dynamic` boundary and home-section skeleton fallback.
- Removed the unnecessary `"use client"` directive from `src/components/marketing/home/FeatureCard.tsx`.
- Command: `pnpm vitest run 'src/app/(public)/home-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 93 files / 221 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/` first-load JS dropped from about `165 kB` to `123 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Resume verification command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Resume verification result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 06:58:13 IST 2026`.

## 2026-05-13 06:58 IST - Events Route Analysis

- Research refresh:
  - Official Next.js lazy-loading docs, last updated March 31, 2026, confirm lazy loading reduces the JavaScript needed for an initial route render by deferring Client Components and imported libraries.
  - The same docs note Server Components are automatically code split, and lazy loading applies to Client Components.
- Current build observation: `/events` is about `128 kB` first-load JS.
- Analysis:
  - `src/app/(public)/events/page.tsx` is already a server page that fetches event data on the server.
  - `src/components/marketing/events/EventCard.tsx` is marked `"use client"` even though it only renders static image, date, icon, card, and badge markup.
  - Removing the unnecessary client boundary should keep the event cards in the server-rendered tree and reduce route client JavaScript without changing event data fetching.
- Timestamp check: `Wed May 13 06:58:57 IST 2026`.

## 2026-05-13 06:59 IST - Events Route Red Test

- Added `src/app/(public)/events/events-code-splitting.test.ts` to require:
  - the events page remains a server route,
  - the server page still fetches upcoming events,
  - `EventCard` no longer carries a client directive or hook usage.
- Command: `pnpm vitest run 'src/app/(public)/events/events-code-splitting.test.ts'`
- Intended result: failed because `src/components/marketing/events/EventCard.tsx` still begins with `"use client"`.
- Timestamp check: `Wed May 13 06:59:28 IST 2026`.

## 2026-05-13 06:59 IST - Events Card Server Render

- Removed the unnecessary `"use client"` directive from `src/components/marketing/events/EventCard.tsx`.
- Command: `pnpm vitest run 'src/app/(public)/events/events-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Timestamp check: `Wed May 13 06:59:52 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 94 files / 222 tests.
- Timestamp check: `Wed May 13 07:00:22 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/events` first-load JS dropped from about `128 kB` to `111 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 07:01:13 IST 2026`.

## 2026-05-13 07:01 IST - Brochure Route Analysis

- Current build observation: `/brochure` is about `126 kB` first-load JS, now the largest remaining public static route.
- Analysis:
  - `src/app/(public)/brochure/page.tsx` is a server page, but it directly renders `BrochureDownloadCard`.
  - `src/components/public/brochure-download-card.tsx` is a client component only for the copy-share action; the view and download actions can be plain links in server markup.
  - The card currently imports `sonner`, React state, and all button icons in the initial brochure route chunk.
  - Low-risk plan: convert `BrochureDownloadCard` to a server component, keep view/download as static links, and defer the clipboard/toast behavior into a small client copy-button loader.
- Timestamp check: `Wed May 13 07:01:58 IST 2026`.

## 2026-05-13 07:02 IST - Brochure Route Red Test

- Added `src/components/public/brochure-download-card-code-splitting.test.ts` to require:
  - `BrochureDownloadCard` is server-rendered,
  - clipboard and toast code are not in the card,
  - the copy-share behavior moves behind `BrochureCopyLinkButtonLoader`.
- Command: `pnpm vitest run src/components/public/brochure-download-card-code-splitting.test.ts`
- Intended result: failed because `brochure-copy-link-button-loader.tsx` does not exist yet and the card is still a client component.
- Timestamp check: `Wed May 13 07:02:23 IST 2026`.

## 2026-05-13 07:03 IST - Brochure Copy Button Split

- Converted `src/components/public/brochure-download-card.tsx` to server-rendered markup.
- Kept brochure view/download actions as static links.
- Added `src/components/public/brochure-copy-link-button-loader.tsx` as the small client dynamic boundary.
- Added `src/components/public/brochure-copy-link-button.tsx` for clipboard and toast behavior.
- Command: `pnpm vitest run src/components/public/brochure-download-card-code-splitting.test.ts src/components/public/brochure-section-code-splitting.test.ts`
- Result: passed, 2 files / 2 tests.
- Timestamp check: `Wed May 13 07:03:11 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 95 files / 223 tests.
- Timestamp check: `Wed May 13 07:03:41 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/brochure` first-load JS dropped from about `126 kB` to `117 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 07:04:33 IST 2026`.

## 2026-05-13 07:05 IST - Static CTA Link Analysis

- Current build observation:
  - `/`, `/about-us`, and `/about-rishikesh` are about `123 kB` first-load JS.
  - The app build manifest shows these routes still load the `7236` chunk, which contains Next's client `<Link>` implementation.
- Analysis:
  - `AboutHeroSection` and `RishikeshHeroSection` use `next/link` only for same-page hash anchors.
  - `FeatureCard` is server-rendered but still imports `next/link` for a static home CTA.
  - These links do not need client-side prefetch/navigation code for initial render; plain anchors preserve the destinations and avoid shipping the Link runtime on these static routes.
- Timestamp check: `Wed May 13 07:05:55 IST 2026`.

## 2026-05-13 07:06 IST - Static CTA Link Red Test

- Updated the home, about-us, and about-rishikesh code-splitting tests to require static CTA/hash links without `next/link`.
- Command: `pnpm vitest run 'src/app/(public)/home-code-splitting.test.ts' 'src/app/(public)/about-us/about-us-code-splitting.test.ts' 'src/app/(public)/about-rishikesh/about-rishikesh-code-splitting.test.ts'`
- Intended result: failed because `FeatureCard`, `AboutHeroSection`, and `RishikeshHeroSection` still import `next/link`.
- Timestamp check: `Wed May 13 07:06:31 IST 2026`.

## 2026-05-13 07:07 IST - Static CTA Anchor Conversion

- Replaced same-page hash `next/link` usage in `AboutHeroSection` and `RishikeshHeroSection` with plain anchors.
- Replaced the static home feature CTA `next/link` usage in `FeatureCard` with a plain anchor.
- Removed now-unused home `FeatureCard` imports.
- Command: `pnpm vitest run 'src/app/(public)/home-code-splitting.test.ts' 'src/app/(public)/about-us/about-us-code-splitting.test.ts' 'src/app/(public)/about-rishikesh/about-rishikesh-code-splitting.test.ts'`
- Result: passed, 3 files / 3 tests.
- Timestamp check: `Wed May 13 07:07:06 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 95 files / 223 tests.
- Timestamp check: `Wed May 13 07:07:39 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/`, `/about-us`, and `/about-rishikesh` first-load JS each dropped from about `123 kB` to `120 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 07:08:28 IST 2026`.

## 2026-05-13 07:09 IST - Donation Success Route Analysis

- Current build observation: `/donate/success` is about `120 kB` first-load JS and still includes Next's client `<Link>` chunk.
- Analysis:
  - `src/app/(public)/donate/success/page.tsx` is a server page, but directly imports the client `DonationSuccessCard`.
  - `DonationSuccessCard` needs the browser only to read the donation receipt from client-side receipt storage.
  - The missing-reference state and the initial receipt-loading shell can be server-rendered.
  - Low-risk plan: add a route-local dynamic loader for `DonationSuccessCard`, keep property currency fetching on the server page, and replace static donation/home links with plain anchors.
- Timestamp check: `Wed May 13 07:09:07 IST 2026`.

## 2026-05-13 07:09 IST - Donation Success Red Test

- Added `src/app/(public)/donate/success/donate-success-code-splitting.test.ts` to require:
  - a server-rendered success route,
  - a route-local dynamic loader for the client receipt card,
  - no initial-route `next/link` usage in the page or success card.
- Command: `pnpm vitest run 'src/app/(public)/donate/success/donate-success-code-splitting.test.ts'`
- Intended result: failed because `donation-success-card-loader.tsx` does not exist yet.
- Timestamp check: `Wed May 13 07:09:37 IST 2026`.

## 2026-05-13 07:10 IST - Donation Success Card Loader

- Added `src/app/(public)/donate/success/donation-success-card-loader.tsx` to dynamically load the client receipt card.
- Updated `src/app/(public)/donate/success/page.tsx` to render the loader and use a plain missing-reference anchor.
- Replaced static `next/link` usage inside `src/components/donations/donation-success-card.tsx` with anchors.
- Command: `pnpm vitest run 'src/app/(public)/donate/success/donate-success-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Timestamp check: `Wed May 13 07:10:26 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 96 files / 224 tests.
- Timestamp check: `Wed May 13 07:11:01 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/donate/success` first-load JS dropped from about `120 kB` to `106 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 07:11:54 IST 2026`.

## 2026-05-13 07:13 IST - Skeleton Fallback Utility Analysis

- Current build observation: `/`, `/about-us`, `/about-rishikesh`, `/amenities`, `/journey`, and `/shop` are about `120 kB` first-load JS.
- Build-manifest analysis:
  - These routes include the `9637` chunk for image runtime and the `7831` chunk for shared UI utilities.
  - The dynamic section/catalog loaders in these routes import `Skeleton` only for loading placeholders.
  - `src/components/ui/skeleton.tsx` imports `cn()` from `@/lib/utils`, which brings class-merging utilities into every route that renders a skeleton fallback.
- Low-risk plan:
  - Keep the same skeleton element and default classes.
  - Remove the `cn()` dependency from `Skeleton` and concatenate its optional `className` directly.
  - This should avoid shipping the UI utility chunk on skeleton-only loading boundaries.
- Timestamp check: `Wed May 13 07:13:00 IST 2026`.

## 2026-05-13 07:13 IST - Skeleton Utility Red Test

- Added `src/components/ui/skeleton-code-splitting.test.ts` to require the lightweight `Skeleton` fallback to avoid importing `@/lib/utils` / `cn()`.
- Command: `pnpm vitest run src/components/ui/skeleton-code-splitting.test.ts`
- Intended result: failed because `Skeleton` still imports `cn` from `@/lib/utils`.
- Timestamp check: `Wed May 13 07:13:33 IST 2026`.

## 2026-05-13 07:14 IST - Skeleton Utility Chunk Removal

- Removed the `@/lib/utils` / `cn()` dependency from `src/components/ui/skeleton.tsx`.
- Kept the same default skeleton classes and appended optional caller `className` directly.
- Command: `pnpm vitest run src/components/ui/skeleton-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Timestamp check: `Wed May 13 07:14:03 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 97 files / 225 tests.
- Timestamp check: `Wed May 13 07:14:40 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/`, `/about-us`, `/about-rishikesh`, `/amenities`, `/journey`, and `/shop` first-load JS dropped from about `120 kB` to `112 kB`.
  - Skeleton-loader dependent routes also improved: `/ashram-glimpse`, `/book`, `/feedback`, `/profile`, and several admin index/detail routes dropped to roughly `106-110 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 07:15:40 IST 2026`.

## 2026-05-13 07:16 IST - Brochure Copy Loader Analysis

- Current build observation: `/brochure` is about `117 kB` first-load JS and still includes the `7831` shared UI utility chunk.
- Analysis:
  - The brochure page itself is server-rendered and has no images.
  - `BrochureCopyLinkButtonLoader` imports `Button` and `Link2` only for the transient dynamic-loading fallback.
  - The actual hydrated copy button can keep the shared Button/icon styling in the deferred chunk, but the initial loader fallback can be a plain disabled button with equivalent classes.
- Timestamp check: `Wed May 13 07:16:39 IST 2026`.

## 2026-05-13 07:17 IST - Brochure Copy Loader Red Test

- Updated `src/components/public/brochure-download-card-code-splitting.test.ts` to require the copy-link loader to avoid `Button` and `lucide-react` imports.
- Command: `pnpm vitest run src/components/public/brochure-download-card-code-splitting.test.ts`
- Intended result: failed because `BrochureCopyLinkButtonLoader` still imports `Button` from `@/components/ui/button`.
- Timestamp check: `Wed May 13 07:17:12 IST 2026`.

## 2026-05-13 07:17 IST - Brochure Copy Loader Fallback Trim

- Replaced the copy-link loader's `Button`/`Link2` loading fallback with a plain disabled button using equivalent utility classes.
- Kept the real copy button, icon, clipboard, and toast behavior in the deferred client chunk.
- Command: `pnpm vitest run src/components/public/brochure-download-card-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Timestamp check: `Wed May 13 07:17:41 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 97 files / 225 tests.
- Timestamp check: `Wed May 13 07:18:23 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/brochure` first-load JS dropped from about `117 kB` to `106 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 07:19:22 IST 2026`.

## 2026-05-13 07:19 IST - Room Detail Skeleton Analysis

- Current build observation: `/book/rooms/[id]` is about `116 kB` first-load JS and still includes the `7831` shared UI utility chunk.
- Analysis:
  - The route page is already a server shell around `RoomDetailClientLoader`.
  - `RoomDetailClientLoader` imports `RoomDetailsSkeleton` for its loading fallback.
  - `RoomDetailsSkeleton` imports `Card` and `CardContent`, which pull the card/cn utility stack into the initial dynamic route chunk only for placeholder containers.
  - Low-risk plan: keep the same skeleton layout but replace the placeholder-only Card wrappers with plain `div` markup.
- Timestamp check: `Wed May 13 07:19:50 IST 2026`.

## 2026-05-13 07:20 IST - Room Detail Skeleton Red Test

- Updated `src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts` to require `RoomDetailsSkeleton` to avoid shared Card utilities.
- Command: `pnpm vitest run 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts'`
- Intended result: failed because `RoomDetailsSkeleton` still imports `Card` and `CardContent`.
- Timestamp check: `Wed May 13 07:20:27 IST 2026`.

## 2026-05-13 07:21 IST - Room Detail Skeleton Card Trim

- Removed `Card` and `CardContent` imports from `src/components/public/room-details-skeleton.tsx`.
- Replaced placeholder-only Card wrappers with plain `div` containers using equivalent classes.
- Command: `pnpm vitest run 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts'`
- Result: passed, 1 file / 5 tests.
- Timestamp check: `Wed May 13 07:21:10 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 97 files / 226 tests.
- Timestamp check: `Wed May 13 07:21:57 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/book/rooms/[id]` first-load JS dropped from about `116 kB` to `107 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 07:23:05 IST 2026`.

## 2026-05-13 07:23 IST - Booking Review Skeleton Analysis

- Current build observation: `/book/review` is about `115 kB` first-load JS and includes the `7831` shared UI utility chunk.
- Analysis:
  - The route page is already a server shell around `BookingReviewClientLoader`.
  - `BookingReviewClientLoader` imports `BookingReviewSkeleton` for its loading fallback.
  - `BookingReviewSkeleton` imports `Card`, `CardContent`, and `CardHeader` only for placeholder boxes.
  - Low-risk plan: keep the same placeholder layout but replace the Card wrappers with plain `div` containers.
- Timestamp check: `Wed May 13 07:23:40 IST 2026`.

## 2026-05-13 07:24 IST - Booking Review Skeleton Red Test

- Updated `src/app/(public)/book/review/book-review-code-splitting.test.ts` to require `BookingReviewSkeleton` to avoid shared Card utilities.
- Command: `pnpm vitest run 'src/app/(public)/book/review/book-review-code-splitting.test.ts'`
- Intended result: failed because `BookingReviewSkeleton` still imports `Card`, `CardContent`, and `CardHeader`.
- Timestamp check: `Wed May 13 07:24:16 IST 2026`.

## 2026-05-13 07:25 IST - Booking Review Skeleton Card Trim

- Removed Card utility imports from `src/components/public/booking-review-skeleton.tsx`.
- Replaced placeholder Card/Header/Content wrappers with plain `div` containers using equivalent classes.
- Command: `pnpm vitest run 'src/app/(public)/book/review/book-review-code-splitting.test.ts'`
- Result: passed, 1 file / 4 tests.
- Timestamp check: `Wed May 13 07:25:31 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 97 files / 227 tests.
- Timestamp check: `Wed May 13 07:26:20 IST 2026`.
- Command: `pnpm build`
- Result: passed after Next retried several static pages that exceeded the 60s worker timeout on the first attempt.
- Build observation: `/book/review` first-load JS dropped from about `115 kB` to `107 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 08:52:30 IST 2026`.

## 2026-05-13 08:53 IST - Auth Skeleton Analysis

- Current build observation: `/login`, `/register`, `/forgot-password`, `/resetpassword`, `/admin/login`, and `/admin/forget-password` are about `115 kB` first-load JS.
- Build-manifest analysis: these routes include the `7831` shared UI utility chunk.
- Analysis:
  - User auth route loaders render `AuthFormSkeleton`, which imports Card utilities only for placeholder containers.
  - Admin forgot-password uses the same skeleton.
  - Admin login has a route-specific skeleton inside `admin/login-loader.tsx` that also imports Card utilities only for placeholders.
  - Low-risk plan: replace auth skeleton Card wrappers with equivalent plain `div` containers while leaving the actual deferred auth forms unchanged.
- Timestamp check: `Wed May 13 08:53:14 IST 2026`.

## 2026-05-13 08:53 IST - Auth Skeleton Red Test

- Updated auth code-splitting tests to require shared auth skeletons and the admin login loader skeleton to avoid shared Card utilities.
- Command: `pnpm vitest run 'src/app/(auth)/auth-code-splitting.test.ts' src/app/admin/login/admin-login-code-splitting.test.ts`
- Intended result: failed because `AuthFormSkeleton` and `AdminLoginLoader` still import Card utilities.
- Timestamp check: `Wed May 13 08:53:56 IST 2026`.

## 2026-05-13 16:56 IST - Auth Skeleton Card Trim

- Removed Card utility imports from `src/components/auth/auth-form-skeleton.tsx`.
- Replaced shared auth skeleton Card/Header/Content wrappers with plain `div` containers using equivalent classes.
- Removed Card utility imports from `src/components/auth/admin/login-loader.tsx`.
- Replaced the admin login skeleton Card/Header/Content wrappers with plain `div` containers using equivalent classes.
- Command: `pnpm vitest run 'src/app/(auth)/auth-code-splitting.test.ts' src/app/admin/login/admin-login-code-splitting.test.ts`
- Result: passed, 2 files / 7 tests.
- Timestamp check: `Wed May 13 16:56:56 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 97 files / 228 tests.
- Timestamp check: `Wed May 13 16:57:38 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/login`, `/register`, `/forgot-password`, `/resetpassword`, `/admin/login`, and `/admin/forget-password` first-load JS dropped from about `115 kB` to `107 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 16:58:31 IST 2026`.

## 2026-05-13 16:59 IST - Admin Activity Skeleton Analysis

- Current build observation: `/admin/activity` is about `115 kB` first-load JS and includes the `7831` shared UI utility chunk.
- Analysis:
  - The route page is already a server shell around `ActivityPanelLoader`.
  - `ActivityPanelLoader` imports Card utilities only for the loading fallback.
  - The real activity table/filter workflow remains behind the dynamic `activity-panel` import.
  - Low-risk plan: replace the fallback Card wrappers with plain containers using equivalent classes.
- Timestamp check: `Wed May 13 16:59:00 IST 2026`.

## 2026-05-13 16:59 IST - Admin Activity Skeleton Red Test

- Updated `src/app/admin/activity/activity-code-splitting.test.ts` to require the activity loader fallback to avoid shared Card utilities.
- Command: `pnpm vitest run src/app/admin/activity/activity-code-splitting.test.ts`
- Intended result: failed because `ActivityPanelLoader` still imports Card utilities for its skeleton.
- Timestamp check: `Wed May 13 16:59:34 IST 2026`.

## 2026-05-13 17:00 IST - Admin Activity Skeleton Card Trim

- Removed Card utility imports from `src/app/admin/activity/activity-panel-loader.tsx`.
- Replaced the activity loader skeleton Card/Header/Content wrappers with plain `div` containers using equivalent classes.
- Command: `pnpm vitest run src/app/admin/activity/activity-code-splitting.test.ts`
- Result: passed, 1 file / 1 test.
- Timestamp check: `Wed May 13 17:00:10 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 97 files / 228 tests.
- Timestamp check: `Wed May 13 17:00:46 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/admin/activity` first-load JS dropped from about `115 kB` to `107 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 17:01:35 IST 2026`.

## 2026-05-13 17:01 IST - Admin Event And Review Form Skeleton Analysis

- Current build observation: `/admin/events/create`, `/admin/events/[id]`, `/admin/reviews/create`, and `/admin/reviews/[id]` are about `115 kB` first-load JS and include the `7831` shared UI utility chunk.
- Analysis:
  - Event and review form routes are already server shells around dynamic form loaders.
  - `EventFormLoader` and `ReviewFormLoader` import Card utilities only for their loading fallbacks.
  - The real form code remains deferred behind dynamic imports.
  - Low-risk plan: replace skeleton-only Card wrappers with plain containers using equivalent classes in both loaders.
- Timestamp check: `Wed May 13 17:01:58 IST 2026`.

## 2026-05-13 17:02 IST - Admin Event And Review Form Red Test

- Updated event and review form route code-splitting tests to require their loaders to avoid shared Card utilities.
- Command: `pnpm vitest run src/app/admin/events/event-form-route-code-splitting.test.ts src/app/admin/reviews/review-form-route-code-splitting.test.ts`
- Intended result: failed because both form loaders still import Card utilities for skeleton fallbacks.
- Timestamp check: `Wed May 13 17:02:33 IST 2026`.

## 2026-05-13 17:03 IST - Admin Event And Review Form Skeleton Card Trim

- Removed Card utility imports from `src/components/admin/events/event-form-loader.tsx`.
- Removed Card utility imports from `src/components/admin/reviews/review-form-loader.tsx`.
- Replaced both form loader skeleton Card/Header/Content wrappers with plain `div` containers using equivalent classes.
- Command: `pnpm vitest run src/app/admin/events/event-form-route-code-splitting.test.ts src/app/admin/reviews/review-form-route-code-splitting.test.ts`
- Result: passed, 2 files / 2 tests.
- Timestamp check: `Wed May 13 17:03:21 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 97 files / 228 tests.
- Timestamp check: `Wed May 13 17:04:04 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/admin/events/create`, `/admin/events/[id]`, `/admin/reviews/create`, and `/admin/reviews/[id]` first-load JS dropped from about `115 kB` to `106 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 17:04:55 IST 2026`.

## 2026-05-13 17:05 IST - Blog Static Link Analysis

- Current build observation: `/blog` and `/blog/[slug]` are about `114 kB` first-load JS and include the Next client Link chunk.
- Analysis:
  - Both public blog pages are server-rendered/static.
  - Blog list cards use `next/link` only for static links to post detail pages.
  - Blog detail uses `next/link` only for a static backlink to `/blog`.
  - Plain anchors preserve navigation while avoiding the client Link runtime on these static content pages.
- Timestamp check: `Wed May 13 17:05:25 IST 2026`.

## 2026-05-13 17:06 IST - Blog Static Link Red Test

- Added `src/app/(public)/blog/blog-code-splitting.test.ts` to require static blog links without `next/link`.
- Command: `pnpm vitest run 'src/app/(public)/blog/blog-code-splitting.test.ts'`
- Intended result: failed because the blog list still imports `next/link`.
- Timestamp check: `Wed May 13 17:06:05 IST 2026`.

## 2026-05-13 17:06 IST - Blog Static Anchor Conversion

- Replaced blog list `next/link` card wrappers with plain anchors.
- Replaced the blog detail backlink `next/link` with a plain anchor.
- Command: `pnpm vitest run 'src/app/(public)/blog/blog-code-splitting.test.ts'`
- Result: passed, 1 file / 1 test.
- Timestamp check: `Wed May 13 17:06:58 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 98 files / 229 tests.
- Timestamp check: `Wed May 13 17:07:46 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/blog` and `/blog/[slug]` first-load JS dropped from about `114 kB` to `111 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 17:08:42 IST 2026`.

## 2026-05-13 17:09 IST - Admin Index Static Link Analysis

- Current build observation: `/admin/events`, `/admin/posts`, and `/admin/reviews` are about `110 kB` first-load JS and include the Next client Link chunk.
- Analysis:
  - These pages are server shells with dynamic table loaders.
  - Their route-level `next/link` usage is only for static "Add" action anchors.
  - The interactive table links remain inside deferred table chunks.
  - Low-risk plan: replace only the route-level Add action `next/link` components with plain anchors.
- Timestamp check: `Wed May 13 17:09:31 IST 2026`.

## 2026-05-13 17:10 IST - Admin Index Static Link Red Test

- Updated admin events, posts, and reviews index code-splitting tests to require route-level Add actions without `next/link`.
- Command: `pnpm vitest run src/app/admin/events/events-index-code-splitting.test.ts src/app/admin/posts/posts-index-code-splitting.test.ts src/app/admin/reviews/reviews-index-code-splitting.test.ts`
- Intended result: failed because all three route pages still import `next/link`.
- Timestamp check: `Wed May 13 17:10:19 IST 2026`.

## 2026-05-13 17:11 IST - Admin Index Static Anchor Conversion

- Replaced route-level Add action `next/link` usage with plain anchors in:
  - `src/app/admin/events/page.tsx`
  - `src/app/admin/posts/page.tsx`
  - `src/app/admin/reviews/page.tsx`
- Command: `pnpm vitest run src/app/admin/events/events-index-code-splitting.test.ts src/app/admin/posts/posts-index-code-splitting.test.ts src/app/admin/reviews/reviews-index-code-splitting.test.ts`
- Result: passed, 3 files / 3 tests.
- Timestamp check: `Wed May 13 17:11:06 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 98 files / 229 tests.
- Timestamp check: `Wed May 13 17:11:46 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/admin/events`, `/admin/posts`, and `/admin/reviews` first-load JS dropped from about `110 kB` to `106 kB`; the same build reports `/blog` and `/blog/[slug]` at `110 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 17:13:41 IST 2026`.

## 2026-05-13 17:14 IST - Donate Cancel Static Link Analysis

- Current build observation: `/donate/cancel` is about `109 kB` first-load JS.
- Analysis:
  - The route is a static server page with no dynamic data or image dependencies.
  - Its only route-level client dependency is `next/link` for the fixed `/donate` and `/` actions.
  - Plain anchors preserve the navigation behavior on this simple status page while avoiding the Link runtime in the route chunk.
- Timestamp check: `Wed May 13 17:14:38 IST 2026`.

## 2026-05-13 17:14 IST - Donate Cancel Static Link Red Test

- Updated `src/app/(public)/donate/donate-code-splitting.test.ts` to require the cancel page to avoid `next/link` while retaining `/donate` and `/` hrefs.
- Command: `pnpm vitest run 'src/app/(public)/donate/donate-code-splitting.test.ts'`
- Intended result: failed because `src/app/(public)/donate/cancel/page.tsx` still imports and renders `next/link`.
- Timestamp check: `Wed May 13 17:14:53 IST 2026`.

## 2026-05-13 17:16 IST - Donate Cancel Static Anchor Conversion

- Replaced the cancel page `next/link` actions with plain anchors for `/donate` and `/`.
- Command: `pnpm vitest run 'src/app/(public)/donate/donate-code-splitting.test.ts'`
- Result: passed, 1 file / 2 tests.
- Timestamp check: `Wed May 13 17:16:11 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Timestamp check: `Wed May 13 17:16:34 IST 2026`.
- Command: `pnpm test`
- Result: passed, 98 files / 230 tests.
- Timestamp check: `Wed May 13 17:16:41 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/donate/cancel` first-load JS dropped from about `109 kB` to the shared floor at `105 kB`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 17:18:12 IST 2026`.

## 2026-05-13 17:20 IST - Events Public Page Data and Image Analysis

- Current build observation: `/events` is about `110 kB` first-load JS and includes the `next/image` runtime.
- Research refresh:
  - Official Next.js Image docs, last updated January 15, 2026, say `sizes` should be used when an image uses `fill` or responsive CSS; without it, the browser assumes `100vw` and can download unnecessarily large images.
  - Official Next.js previous-model caching docs, last updated March 31, 2026, recommend `unstable_cache` for non-`fetch` database queries and note it supports `tags` plus `revalidate`.
- Analysis:
  - `src/app/(public)/events/page.tsx` uses a `fill` + `priority` featured event image without `sizes`, so the active event hero can over-fetch image bytes on desktop where it only occupies about half the grid.
  - `getHomepageBanner()` is already cached by minute with the event cache tag.
  - `getUpcomingEvents()` still performs an uncached Supabase read, despite using the same public event data and the same 60-second freshness model.
  - Low-risk plan: add a responsive `sizes` hint for the featured event hero and wrap upcoming-event reads in the same tagged, 60-second `unstable_cache` pattern, with a minute-bucket `now` parameter for deterministic caching and testing.
- Sources:
  - https://nextjs.org/docs/15/app/api-reference/components/image
  - https://nextjs.org/docs/app/guides/caching-without-cache-components
- Timestamp check: `Wed May 13 17:20:25 IST 2026`.

## 2026-05-13 17:22 IST - Events Public Page Red Tests

- Updated `src/app/(public)/events/events-code-splitting.test.ts` to require:
  - concurrent event data loading with `Promise.all`,
  - a responsive `sizes` hint for the featured event `fill` image,
  - the existing card image `sizes` hint.
- Updated `src/lib/server/events.test.ts` to require:
  - an `unstable_cache` wrapper for upcoming event reads using the event cache tag and 60-second revalidation,
  - deterministic minute-bucket querying for upcoming events.
- Command: `pnpm vitest run 'src/app/(public)/events/events-code-splitting.test.ts' src/lib/server/events.test.ts`
- Intended result: failed because the page still loads event data sequentially, the featured event image lacks `sizes`, `getUpcomingEvents()` is uncached, and upcoming events use the exact current timestamp rather than a minute-bucket argument.
- Timestamp check: `Wed May 13 17:22:23 IST 2026`.

## 2026-05-13 17:23 IST - Events Public Page Cache and Image Pass

- Wrapped `getUpcomingEvents()` in a tagged `unstable_cache` using `EVENT_BANNERS_CACHE_TAG` and `EVENTS_REVALIDATE_SECONDS`.
- Changed upcoming event filtering to use the same minute-bucket strategy as the homepage banner cache.
- Changed `/events` to load the active banner and upcoming events concurrently with `Promise.all`.
- Added `sizes="(max-width: 1024px) 100vw, 50vw"` to the featured event `fill` image to bound Supabase-hosted image bytes on desktop layouts.
- Command: `pnpm vitest run 'src/app/(public)/events/events-code-splitting.test.ts' src/lib/server/events.test.ts`
- Result: passed, 2 files / 6 tests.
- Timestamp check: `Wed May 13 17:23:06 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Timestamp check: `Wed May 13 17:23:23 IST 2026`.
- Command: `pnpm test`
- Result: passed, 98 files / 233 tests.
- Timestamp check: `Wed May 13 17:23:31 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/events` remains static with 1-minute revalidation and `110 kB` first-load JS; this pass targets Supabase query reuse, render latency, and image byte selection rather than JS route weight.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 17:24:46 IST 2026`.

## 2026-05-13 17:26 IST - Supabase Image Loader Analysis

- Research refresh:
  - Supabase Storage image transformation docs say transformed public URLs use `/storage/v1/render/image/public/...` with width and quality parameters; transformed images can be automatically served as WebP to reduce egress and speed up loads.
  - Supabase Storage production docs list resizing images and high cache-control as primary high-egress mitigations.
  - Next.js image config docs support a custom image loader through `images.loader = "custom"` and `images.loaderFile`.
- Analysis:
  - `next.config.ts` currently sets `images.unoptimized = true`, so route-level `sizes` hints help layout semantics but do not route Supabase images through resized transformation URLs.
  - Public blog, events, review, room, gallery, and admin image surfaces often store full Supabase public object URLs.
  - A conservative global custom loader can transform only Supabase public storage object URLs and leave local assets plus non-Supabase URLs untouched.
  - This should reduce Supabase storage egress for resized image variants without forcing every route to change stored image URLs.
- Sources:
  - https://supabase.com/docs/guides/storage/serving/image-transformations
  - https://supabase.com/docs/guides/storage/production/scaling
  - https://nextjs.org/docs/15/app/api-reference/config/next-config-js/images
- Timestamp check: `Wed May 13 17:26:20 IST 2026`.

## 2026-05-13 17:26 IST - Supabase Image Loader Red Test

- Added `src/lib/supabase-image-loader.test.ts` to require:
  - Supabase public storage object URLs are rewritten to `/storage/v1/render/image/public/...` transformation URLs with `width` and `quality`,
  - existing query parameters are preserved,
  - local assets and non-Supabase URLs remain unchanged,
  - `next.config.ts` uses the custom loader and no longer globally disables image optimization.
- Command: `pnpm vitest run src/lib/supabase-image-loader.test.ts`
- Intended result: failed because `supabase-image-loader.js` does not exist yet and `next.config.ts` still uses `images.unoptimized = true`.
- Timestamp check: `Wed May 13 17:26:57 IST 2026`.

## 2026-05-13 17:27 IST - Supabase Image Loader Implementation

- Added `supabase-image-loader.js`.
- The loader rewrites only Supabase public storage object URLs from `/storage/v1/object/public/...` to `/storage/v1/render/image/public/...` and appends `width` plus `quality`.
- Local assets and non-Supabase URLs are returned unchanged.
- Updated `next.config.ts` to use `images.loader = "custom"` and `images.loaderFile = "./supabase-image-loader.js"` instead of `images.unoptimized = true`.
- Command: `pnpm vitest run src/lib/supabase-image-loader.test.ts`
- Result: passed, 1 file / 4 tests.
- Timestamp check: `Wed May 13 17:27:26 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: failed because TypeScript inferred the JS loader `quality` parameter as required for the test call that intentionally relies on the default quality.
- Timestamp check: `Wed May 13 17:27:45 IST 2026`.
- Fix: added JSDoc to `supabase-image-loader.js` so `quality` is typed as optional.
- Command: `pnpm vitest run src/lib/supabase-image-loader.test.ts`
- Result: passed, 1 file / 4 tests.
- Timestamp check: `Wed May 13 17:28:11 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Timestamp check: `Wed May 13 17:28:18 IST 2026`.
- Command: `pnpm test`
- Result: passed, 99 files / 237 tests.
- Timestamp check: `Wed May 13 17:28:32 IST 2026`.
- Command: `pnpm build`
- Result: passed with existing Edge-runtime Supabase warnings from `src/lib/supabase/proxy.ts` import traces.
- Build observation:
  - Image routes gained a small route chunk cost from the custom loader, for example `/blog`, `/blog/[slug]`, and `/events` report `111 kB` first-load JS instead of `110 kB`.
  - The build output includes the custom loader logic and `/storage/v1/render/image/public/`, confirming Supabase public image URLs can be emitted through transformed render endpoints.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Verification command: `rg -n "render/image/public" .next -S --glob '!*.html' --glob '!*.rsc'`
- Result: found the compiled custom loader transformation path in built chunks.
- Timestamp check: `Wed May 13 17:30:04 IST 2026`.

## 2026-05-13 17:30 IST - Fill Image Sizes Audit

- Ran a source audit for `<Image fill />` usages without `sizes` across public route and marketing/public component files.
- Findings include missing `sizes` in:
  - `src/app/(public)/blog/page.tsx`
  - `src/app/(public)/blog/[slug]/page.tsx`
  - `src/app/(public)/shop/page.tsx`
  - `src/app/(public)/page.tsx`
  - several deferred marketing sections and booking-review client images.
- Next target: public blog images, because blog featured images are Supabase-hosted content and now benefit directly from the custom transformation loader.
- Timestamp check: `Wed May 13 17:30:40 IST 2026`.

## 2026-05-13 17:31 IST - Blog Image Sizes Red Test

- Updated `src/app/(public)/blog/blog-code-splitting.test.ts` to require responsive `sizes` hints for blog list thumbnails and blog detail featured images.
- Command: `pnpm vitest run 'src/app/(public)/blog/blog-code-splitting.test.ts'`
- Intended result: failed because both blog pages still render `fill` images without `sizes`.
- Timestamp check: `Wed May 13 17:31:22 IST 2026`.

## 2026-05-13 17:31 IST - Blog Image Sizes Pass

- Added grid-aware `sizes` to blog list featured images.
- Added a constrained-width `sizes` hint to blog detail featured images.
- Command: `pnpm vitest run 'src/app/(public)/blog/blog-code-splitting.test.ts'`
- Result: passed, 1 file / 2 tests.
- Timestamp check: `Wed May 13 17:31:46 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Timestamp check: `Wed May 13 17:32:05 IST 2026`.
- Command: `pnpm test`
- Result: passed, 99 files / 238 tests.
- Timestamp check: `Wed May 13 17:32:16 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/blog` and `/blog/[slug]` remain `111 kB` first-load JS; this pass improves transformed image candidate selection rather than JS route weight.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 17:33:23 IST 2026`.

## 2026-05-13 17:33 IST - Booking Review Image Sizes Analysis

- Analysis:
  - `src/app/(public)/book/review/booking-review-client.tsx` shows room photos from booking context data.
  - These URLs can be Supabase-hosted room images and now flow through the custom Supabase image loader.
  - The main booking summary image is a `fill` image in a responsive sidebar and lacks `sizes`.
  - Multi-room thumbnail buttons also use `fill` images at a fixed `140px` width and lack `sizes`.
- Plan: add targeted `sizes` hints to these two image surfaces and lock them in the existing booking review code-splitting test.
- Timestamp check: `Wed May 13 17:33:57 IST 2026`.

## 2026-05-13 17:34 IST - Booking Review Image Sizes Red Test

- Updated `src/app/(public)/book/review/book-review-code-splitting.test.ts` to require:
  - responsive `sizes` for the main booking summary room photo,
  - fixed `140px` `sizes` for multi-room thumbnails.
- Command: `pnpm vitest run 'src/app/(public)/book/review/book-review-code-splitting.test.ts'`
- Intended result: failed because both booking review `fill` room images still lack `sizes`.
- Timestamp check: `Wed May 13 17:34:16 IST 2026`.

## 2026-05-13 17:34 IST - Booking Review Image Sizes Pass

- Added `sizes="(max-width: 768px) 100vw, 40vw"` to the main booking summary room photo.
- Added `sizes="140px"` to multi-room thumbnail photos.
- Command: `pnpm vitest run 'src/app/(public)/book/review/book-review-code-splitting.test.ts'`
- Result: passed, 1 file / 5 tests.
- Timestamp check: `Wed May 13 17:34:40 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Timestamp check: `Wed May 13 17:34:56 IST 2026`.
- Command: `pnpm test`
- Result: passed, 99 files / 239 tests.
- Timestamp check: `Wed May 13 17:35:04 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/book/review` remains `107 kB` first-load JS; this pass improves transformed Supabase room image candidate selection rather than JS route weight.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 17:36:15 IST 2026`.

## 2026-05-13 17:37 IST - Room Detail Gallery Image Analysis

- Analysis:
  - `src/app/(public)/book/rooms/[id]/room-detail-client.tsx` renders the desktop room gallery with native `<img>` tags.
  - `src/app/(public)/book/rooms/[id]/components/room-photo-carousel.tsx` renders the mobile carousel with native `<img>` tags.
  - Room photos are likely Supabase-hosted room image URLs, so native `<img>` bypasses the custom Supabase transformation loader entirely.
  - These gallery surfaces are already behind the room detail client boundary, so converting them to `next/image` should optimize image egress without affecting the server route shell.
- Plan: convert the desktop grid and mobile carousel images to `next/image` with explicit `sizes`.
- Timestamp check: `Wed May 13 17:37:04 IST 2026`.

## 2026-05-13 17:37 IST - Room Detail Gallery Image Red Test

- Updated `src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts` to require:
  - `next/image` usage for desktop room gallery images,
  - no native `<img>` tags in the room detail client gallery,
  - `next/image` usage and `sizes="100vw"` in the mobile carousel component.
- Command: `pnpm vitest run 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts'`
- Intended result: failed because desktop and mobile room gallery photos still use native `<img>` tags.
- Timestamp check: `Wed May 13 17:37:36 IST 2026`.

## 2026-05-13 17:38 IST - Room Detail Gallery Image Pass

- Converted desktop room gallery photos in `room-detail-client.tsx` from native `<img>` tags to `next/image` with `sizes="(min-width: 768px) 50vw, 100vw"`.
- Converted mobile carousel photos in `room-photo-carousel.tsx` from native `<img>` tags to `next/image` with `sizes="100vw"`.
- Command: `pnpm vitest run 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts'`
- Result: passed, 1 file / 6 tests.
- Timestamp check: `Wed May 13 17:38:15 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Timestamp check: `Wed May 13 17:38:35 IST 2026`.
- Command: `pnpm test`
- Result: passed, 99 files / 240 tests.
- Timestamp check: `Wed May 13 17:38:44 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/book/rooms/[id]` remains `107 kB` first-load JS; this pass moves room gallery image requests through transformed image URLs rather than changing route JS weight.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: no broad selects found in the audited API/server paths.
- Timestamp check: `Wed May 13 17:39:55 IST 2026`.

## 2026-05-13 17:40 IST - Home Marketing Image Sizes Analysis

- Analysis:
  - The home route and deferred home marketing sections still have several `next/image` `fill` usages without `sizes`.
  - Relevant files include:
    - `src/app/(public)/page.tsx`
    - `src/components/marketing/home/FeatureCard.tsx`
    - `src/components/marketing/home/ActivityCard.tsx`
    - `src/components/marketing/home/GallerySection.tsx`
    - `src/components/marketing/home/RoomsShowcaseSection.tsx`
    - `src/components/marketing/home/ReviewSection.tsx`
    - `src/components/marketing/home/AccommodationCard.tsx`
  - Rooms and review image data can be Supabase-backed, while static local marketing images still benefit from correct responsive image markup.
- Plan: add targeted `sizes` hints for the home hero, feature/activity/accommodation cards, gallery grid, room showcase cards, and review avatars.
- Timestamp check: `Wed May 13 17:40:49 IST 2026`.

## 2026-05-13 17:41 IST - Home Marketing Image Sizes Red Test

- Updated `src/app/(public)/home-code-splitting.test.ts` to require `sizes` hints for the home hero, feature cards, activity cards, gallery grid images, room showcase cards, review avatars, and accommodation cards.
- Command: `pnpm vitest run 'src/app/(public)/home-code-splitting.test.ts'`
- Intended result: failed because those home route and deferred-section `fill` images still lack explicit `sizes`.
- Timestamp check: `Wed May 13 17:41:22 IST 2026`.

## 2026-05-13 03:39 IST - Room Detail Amenity Icon Split Started

- Analysis:
  - `src/components/shared/icon.tsx` imports `* as icons from "lucide-react"` to resolve arbitrary icon names.
  - The room detail page imports that dynamic icon resolver only for the amenity list, pulling the broad icon map into the initial room detail chunk.
- Added a failing code-splitting test requiring amenities to move behind `./components/room-amenities-section` and removing direct `Icon` / `IconName` imports from the page.
- Command: `pnpm vitest run 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts'`
- Intended result: failed because the page still renders amenities directly and imports the dynamic icon resolver.

## 2026-05-13 03:40 IST - Room Detail Amenity Icon Split

- Added `src/app/(public)/book/rooms/[id]/components/room-amenities-section.tsx`.
- Moved amenity grouping/rendering and the shared dynamic `Icon` resolver into that deferred route-local component.
- Updated `src/app/(public)/book/rooms/[id]/page.tsx` to dynamically import `RoomAmenitiesSection` and removed direct `Icon` / `IconName` imports from the initial page module.
- Command: `pnpm vitest run 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts'`
- Result: passed, 1 file / 3 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 52 files / 145 tests.
- Command: `pnpm build`
- Result: passed.
- Build observation:
  - New dynamic route `/api/room-types/[id]/inventory` is present.
  - `/book/rooms/[id]` remains about `432 kB` first-load JS; the improvement here is startup data egress by removing the full `rooms` dataset from the public room-detail load plan.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in the audited server/API paths.
- Command: `pnpm build`
- Result: passed.
- Build observations after admin load-plan pass:
  - Public ISR/SSG results remained intact (`/blog`, `/donate`, `/events`, etc.).
  - Admin routes still build successfully after narrowing their client-side startup datasets.
- Command: `date`
- Result: `Wed May 13 01:49:43 IST 2026`.

## 2026-05-13 01:51 IST - Reservations Index Startup Fetch Split

- Added failing tests to separate `/admin/reservations` from reservation workflow routes:
  - The index should load only property, guests, rooms, and room types at DataProvider startup.
  - The index should not perform the dashboard-reservations startup request or background full-reservations request; its page already calls `loadReservationsPage()` against the paginated API.
  - Create/detail/edit reservation routes keep the heavier reservation workflow plan.
- First command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- First result: failed as expected because `/admin/reservations` still used the broader reservation workflow plan.
- Implementation:
  - Added `ADMIN_RESERVATIONS_INDEX_PLAN`.
  - Ordered exact `/admin/reservations` matching before nested reservation routes.
  - Updated the reservations page refresh button to call the current paginated `loadReservationsPage()` query instead of global `refreshReservations()`, so the lighter startup plan does not clear the table on manual refresh.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 41 tests.
- Command: `date`
- Result: `Wed May 13 01:51:00 IST 2026`.
- Verification after the reservations index split:
  - Command: `pnpm test`
  - Result: passed, 23 files / 94 tests.
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm build`
  - Result: passed.
- Command: `date`
- Result: `Wed May 13 01:52:06 IST 2026`.

## 2026-05-13 01:55 IST - Public Booking Subroute Load-Plan Split

- Analysis:
  - `/book` and `/book/rooms/[id]` need the full public booking catalog plan because they render amenity-rich room cards and availability controls.
  - `/book/review` uses property, rooms, room types, rate plans, seasonal prices, and property closures, but does not render amenity records.
  - `/book/confirmation/[id]` fetches the reservation/guest directly and only needs property, rooms, room types, and rate plans for display/invoice context.
- Added failing tests:
  - `src/hooks/app-data-load-plan.test.ts` for review and confirmation subroute datasets.
  - `src/hooks/use-app-data.load-plan.test.tsx` for the actual skipped loader calls.
- First command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- First result: failed as expected because both routes still used `PUBLIC_BOOKING_PLAN`.
- Implementation:
  - Added `PUBLIC_BOOKING_REVIEW_PLAN`.
  - Added `PUBLIC_BOOKING_CONFIRMATION_PLAN`.
  - Ordered exact review and confirmation route matching before the general `/book*` plan.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 45 tests.
- Command: `date`
- Result: `Wed May 13 01:54:31 IST 2026`.
- Verification after the public booking subroute split:
  - Command: `pnpm test`
  - Result: passed, 23 files / 98 tests.
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm build`
  - Result: passed.
- Command: `date`
- Result: `Wed May 13 01:55:29 IST 2026`.

## 2026-05-13 01:32 IST - Admin Settings Startup Dataset Narrowed

- Analysis:
  - `/admin/settings` uses property, roles, users, amenities, rooms, room types, and property closures.
  - It does not need guests, sticky notes, housekeeping assignments, dashboard reservations, full reservations, rate plans, seasonal prices, room categories, or room-type amenity join rows during startup.
  - Header/sidebar still require the admin base property/roles data.
- Added tests:
  - `src/hooks/app-data-load-plan.test.ts` now requires a narrow settings plan.
  - `src/hooks/use-app-data.load-plan.test.tsx` now verifies `/admin/settings` does not call `getGuests()`, sticky notes, housekeeping, dashboard reservations, or background full reservations.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- First result: failed because settings still used the full admin plan.
- Implemented `ADMIN_SETTINGS_PLAN` in `src/hooks/app-data-load-plan.ts`.
- Updated the background full-reservations effect in `useAppData()` so it runs only when the active plan includes `dashboardReservations`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 9 tests.
- Command: `date`
- Result: `Wed May 13 01:32:54 IST 2026`.
- Command: `pnpm test`
- Result: passed, 22 files / 61 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm build`
- First result: failed because `src/lib/server/storage.ts` is a `"use server"` file and cannot export a non-async constant.
- Fix: moved `IMAGE_ASSET_CACHE_CONTROL_SECONDS` to `src/lib/server/storage-config.ts` and imported it from storage/tests.
- Command: `pnpm vitest run src/lib/server/storage.test.ts`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 01:34 IST - Post-Storage Build Fix And Admin Settings Plan

- Command: `pnpm build`
- First result: failed because `src/lib/server/storage.ts` is a `"use server"` file and cannot export a non-async constant.
- Fix: moved `IMAGE_ASSET_CACHE_CONTROL_SECONDS` to `src/lib/server/storage-config.ts` and imported it from storage/tests.
- Command: `pnpm vitest run src/lib/server/storage.test.ts`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Analysis:
  - `/admin/settings` uses property, roles, users, amenities, rooms, room types, and property closures.
  - It does not need guests, sticky notes, housekeeping assignments, dashboard reservations, full reservations, rate plans, seasonal prices, room categories, or room-type amenity join rows during startup.
  - Header/sidebar still require the admin base property/roles data.
- Added tests:
  - `src/hooks/app-data-load-plan.test.ts` now requires a narrow settings plan.
  - `src/hooks/use-app-data.load-plan.test.tsx` verifies `/admin/settings` does not call guest/sticky/housekeeping/dashboard/full-reservation loaders.
- First targeted result: failed because settings still used the full admin plan.
- Implemented `ADMIN_SETTINGS_PLAN` in `src/hooks/app-data-load-plan.ts`.
- Updated the background full-reservations effect in `useAppData()` so it runs only when the active plan includes `dashboardReservations`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 9 tests.
- Command: `date`
- Result: `Wed May 13 01:32:54 IST 2026`.
- Command: `pnpm test`
- Result: passed, 22 files / 61 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm build`
- Result: passed.
- Command: `date`
- Result: `Wed May 13 01:34:33 IST 2026`.

## 2026-05-13 01:36 IST - Public Donation Currency Cache Pass

- Analysis:
  - `getPropertyCurrency()` used the cookie-aware server Supabase client.
  - Public `/donate` and `/donate/success` call this helper, keeping otherwise public currency reads tied to request cookies.
  - `/donate` also reads public donation stats and should not hit Supabase on every request.
- Added `src/lib/server/property.test.ts` to require:
  - a cookie-free anon Supabase client,
  - exact `currency` selection,
  - a 1h property-currency cache policy.
- Command: `pnpm vitest run src/lib/server/property.test.ts`
- First result: failed because the helper did not create a public client.
- Updated `src/lib/server/property.ts`:
  - added `PROPERTY_CURRENCY_SELECT`,
  - added `PROPERTY_CURRENCY_CACHE_TAG`,
  - added `PROPERTY_CURRENCY_REVALIDATE_SECONDS`,
  - changed `getPropertyCurrency()` to a cached cookie-free public read with fallback to default currency.
- Updated `src/app/(public)/donate/page.tsx` with literal `revalidate = 300` so donation stats refresh via ISR instead of per-request dynamic rendering.
- Command: `pnpm vitest run src/lib/server/property.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `date`
- Result: `Wed May 13 01:36:48 IST 2026`.
- Command: `pnpm test`
- Result: passed, 23 files / 62 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm build`
- Result: passed.
- Build result:
  - `/donate` is now static with 5m revalidation.
  - `/donate/success` remains dynamic due search params, but its property currency helper is cached and cookie-free.
- Command: `date`
- Result: `Wed May 13 01:37:32 IST 2026`.

## 2026-05-13 01:38 IST - Public Static Root Provider No-Data Plan

- Analysis:
  - Most public static routes do not consume `property`, `roomTypes`, or any other `DataContext` data.
  - `/shop` still needs property currency through `useCurrencyFormatter()`.
  - Home and booking routes already have explicit room-preview/booking data plans.
- Updated tests first:
  - `/about-us` should use `mode: "none"` and no datasets.
  - `/shop` should keep the property-only plan.
  - The `useAppData()` hook should make no API calls on a logged-in `/about-us` route.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- First result: failed because `/about-us` still used the property-only plan and called `getProperty()`.
- Updated `src/hooks/app-data-load-plan.ts`:
  - fallback public routes now return `NONE_PLAN`,
  - `/shop` explicitly returns the property-only plan.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 10 tests.
- Command: `date`
- Result: `Wed May 13 01:38:56 IST 2026`.
- Command: `pnpm test`
- Result: passed, 23 files / 63 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm build`
- Result: passed.
- Command: `date`
- Result: `Wed May 13 01:39:43 IST 2026`.

## 2026-05-13 01:56 IST - Latest Verification Snapshot

- Additional route-load optimizations completed after the earlier snapshot:
  - Added route-specific admin DataProvider plans for chrome-only admin pages, rooms, room types, rates, room categories, guest index/detail, housekeeping, dashboard, calendar, reports, and reservation workflows.
  - Split `/admin/reservations` from reservation create/detail/edit so the index uses its paginated API instead of the dashboard-reservations startup fetch.
  - Updated the reservations index refresh action to reload the current paginated query instead of triggering a global app-data refresh.
  - Removed unnecessary admin chrome data dependencies: sidebar no longer reads `DataContext`, and header uses `AuthContext.userRole` instead of loading roles for display.
  - Split public booking review and confirmation routes from the full `/book*` public booking plan.
- Latest focused route-plan gate:
  - Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
  - Result: passed, 2 files / 45 tests.
- Latest full gates:
  - Command: `pnpm test`
  - Result: passed, 23 files / 98 tests.
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm build`
  - Result: passed.
- Latest broad select scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 01:56:01 IST 2026`.

## 2026-05-13 23:01 IST - Post Event Banner Remaining Client/API Fetch Surface Audit

- Command: `date`
- Result: `Wed May 13 23:01:08 IST 2026`.
- Command: `rg -n "fetch\\(\"/api|fetch\\('/api|authorizedFetch\\(\"/api|authorizedFetch\\('/api" src/app src/components src/hooks -S`
- Result: remaining client/API fetch surface identified for the next one-by-one passes.
- Public candidates:
  - `src/hooks/use-room-type-preview.ts:37` fetches `/api/room-types/preview`.
  - `src/hooks/use-booking-search-data.ts:46` fetches `/api/bookings/search-data`.
  - `src/hooks/use-room-type-availability-search.ts:71` fetches `/api/availability/search`.
  - `src/hooks/use-availability-search.tsx:76` fetches `/api/availability/search`.
  - Donation and feedback form POSTs are transactional and not primary cache/egress targets.
  - Booking review submit uses `/api/bookings/public`, which is transactional.
  - `/api/reviews` and `/api/event-banner/active` remain visible in client fetches but were just compacted and verified.
- Admin/local candidates:
  - Route-local admin fetches include already scoped startup/form-data/paginated operations and should be evaluated individually after higher-traffic public GET surfaces.
- Next target: inspect `/api/room-types/preview` because it is public, home-page adjacent, and likely high traffic.

## 2026-05-13 23:01 IST - Room Type Preview Egress Analysis And Research

- Command: `date`
- Result: `Wed May 13 23:01:43 IST 2026`.
- Web research:
  - Next.js caching docs confirm `unstable_cache` supports non-fetch/database work with `revalidate` and `tags`: https://nextjs.org/docs/app/building-your-application/data-fetching/caching
  - Supabase JavaScript docs confirm `select()` should be combined with filters/modifiers and supports explicit column selection, `in`, `order`, and `or` filters: https://supabase.com/docs/reference/javascript/v1
- Commands:
  - `sed -n '1,220p' src/hooks/use-room-type-preview.ts`
  - `sed -n '1,220p' src/app/api/room-types/preview/route.ts`
  - `sed -n '1,260p' src/lib/server/room-type-preview.ts`
  - `sed -n '1,260p' src/lib/server/room-type-preview.test.ts`
  - `sed -n '1,220p' src/app/api/room-types/preview/route.test.ts`
  - `rg -n "AnnaDaan|Sant Bhojan Donation|Brahmbhoj|VidhyaDan|room_types" . -S --glob '!node_modules' --glob '!.next'`
- Findings:
  - `/api/room-types/preview` already has public cache headers and uses `unstable_cache` for the Supabase-backed data function.
  - The response shape is compact and only includes `id`, `name`, `description`, `imageUrl`, and up to three mapped amenities per room type.
  - The current first Supabase query still selects description/photos/main image for every visible room type before selecting at most four preview rows.
  - Existing featured matching depends on normalized names that can include bracket suffixes, so an exact `.in("name", ...)` query would risk changing behavior.
  - Safer optimization: first read only lightweight candidate columns (`id`, `name`, `is_visible`) for all visible room types, choose the same selected IDs in memory, then fetch full preview fields only for the selected IDs.
- Next step: add a red test requiring the two-step query shape before changing `getRoomTypePreviews()`.

## 2026-05-13 23:03 IST - Room Type Preview Red Test

- Command: `date`
- Result: `Wed May 13 23:03:06 IST 2026`.
- Changed `src/lib/server/room-type-preview.test.ts` to require a lightweight room-type candidate query followed by a selected-ID preview details query.
- Command: `pnpm vitest run src/lib/server/room-type-preview.test.ts`
- Intended result: failed, 1 file / 1 test.
- Failure proved the current implementation still used the old single broad room-type preview query; the mocked lightweight candidate rows produced fallback images/descriptions and no amenities because no details query existed yet.

## 2026-05-13 23:03 IST - Room Type Preview Two-Step Query Implementation

- Updated `src/lib/server/room-type-preview.ts`.
- Added `PUBLIC_ROOM_TYPE_PREVIEW_CANDIDATE_SELECT_COLUMNS = "id, name, is_visible"`.
- Narrowed `PUBLIC_ROOM_TYPE_PREVIEW_SELECT_COLUMNS` to `id, name, description, photos, main_photo_url`.
- Changed `getRoomTypePreviews()` to:
  - fetch all visible room-type candidates with only lightweight selector columns,
  - preserve the existing featured-name/fallback selection logic,
  - fetch full preview fields only for the selected room-type IDs,
  - preserve selected preview order before amenity lookups.

## 2026-05-13 23:03 IST - Room Type Preview Focused Green Gate

- Command: `date`
- Result: `Wed May 13 23:03:47 IST 2026`.
- Command: `pnpm vitest run src/lib/server/room-type-preview.test.ts src/app/api/room-types/preview/route.test.ts src/hooks/use-room-type-preview.test.tsx`
- Result: passed, 3 files / 4 tests.

## 2026-05-13 23:04 IST - Room Type Preview Type Gate First Run

- Command: `date`
- Result: `Wed May 13 23:04:06 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: failed on a leftover test-green/source type predicate in `selectPreviewRows()`: the predicate still narrowed to the old full preview row type instead of the new lightweight candidate row type.
- Fix: changed the predicate to `row is RoomTypePreviewCandidateRow`.

## 2026-05-13 23:04 IST - Room Type Preview Type Gate

- Command: `date`
- Result: `Wed May 13 23:04:26 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 23:04 IST - Room Type Preview Full Test Gate

- Command: `date`
- Result: `Wed May 13 23:04:37 IST 2026`.
- Command: `pnpm test`
- Result: passed, 146 files / 347 tests.

## 2026-05-13 23:05 IST - Room Type Preview Build Gate

- Command: `date`
- Result: `Wed May 13 23:05:11 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/` remains static with 1h revalidation.
  - `/api/room-types/preview` remains a dynamic route handler with cache headers supplied by the route.

## 2026-05-13 23:05 IST - Room Type Preview Select Scan

- Command: `date`
- Result: `Wed May 13 23:05:53 IST 2026`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in the audited paths.

## 2026-05-13 23:06 IST - Booking Search Data Egress Analysis And Research

- Command: `date`
- Result: `Wed May 13 23:06:16 IST 2026`.
- Web research:
  - Next.js route-handler docs note route handlers are not cached by default and `GET` caching must be opted into or handled with cache headers/helper caching: https://nextjs.org/docs/app/getting-started/route-handlers
  - Next.js caching docs confirm `unstable_cache` with `revalidate` and tags is appropriate for cached database helper functions: https://nextjs.org/docs/app/building-your-application/data-fetching/caching
  - Supabase JavaScript docs confirm explicit `select`, filters, ordering, and limits should be used to bound payloads: https://supabase.com/docs/reference/javascript/v1/select
- Commands:
  - `sed -n '1,220p' src/hooks/use-booking-search-data.ts`
  - `sed -n '1,220p' src/app/api/bookings/search-data/route.ts`
  - `sed -n '1,260p' src/lib/server/booking-search.ts`
  - `sed -n '1,220p' src/lib/server/booking-search.test.ts`
  - `sed -n '1,180p' src/app/api/bookings/search-data/route.test.ts`
  - `sed -n '1,180p' src/hooks/use-booking-search-data.test.tsx`
  - `rg -n "PublicBookingSearchData|bookingSearchData|useBookingSearchData|roomTypes|propertyClosures|ratePlan|amenities" src/app/\\(public\\)/book src/components src/hooks src/lib/booking -S`
  - `sed -n '150,760p' 'src/app/(public)/book/booking-client.tsx'`
  - `sed -n '1,220p' src/components/public/booking-dialog.tsx`
  - `sed -n '1,180p' src/components/public/room-type-card.tsx`
  - `sed -n '1,140p' src/components/public/booking-summary.tsx`
  - `sed -n '1,220p' src/hooks/use-availability-search.tsx`
  - `sed -n '1,230p' src/components/reservations/date-range-picker.tsx`
- Findings:
  - `/api/bookings/search-data` already uses public cache headers and `getCachedPublicBookingSearchData()` via `unstable_cache`.
  - The endpoint already avoids broad seasonal price loading; seasonal prices are date-scoped through `/api/availability/search`.
  - The booking page and booking dialog only use `propertyClosures` as blocked date ranges for property-wide closures in `ReservationDateRangePicker`.
  - Room-specific closure behavior is already handled by `/api/availability/search` with date-overlap filtering, so sending room-specific closures in the cached search-data payload is unnecessary.
  - `PUBLIC_BOOKING_SEARCH_ROOM_TYPE_SELECT` includes `is_visible`, but the query already filters `.neq("is_visible", false)` and the public response can safely map returned rows to `isVisible: true`.
- Next step: add red tests requiring property-wide-only compact closure data and a narrower room-type select.

## 2026-05-13 23:08 IST - Booking Search Data Red Test

- Command: `date`
- Result: `Wed May 13 23:08:33 IST 2026`.
- Changed `src/lib/server/booking-search.test.ts` to require:
  - a narrower public room-type select without local-only occupancy/category/visibility fields,
  - property-wide closure filtering with `.is("room_type_id", null)`,
  - compact closure payload rows containing only `startDate` and `endDate`.
- Command: `pnpm vitest run src/lib/server/booking-search.test.ts`
- Intended result: failed, 1 file / 1 test.
- Failure proved the current `PUBLIC_BOOKING_SEARCH_ROOM_TYPE_SELECT` still included `min_occupancy`, `max_children`, `category_id`, and `is_visible`.

## 2026-05-13 23:09 IST - Booking Search Data Compact Payload Implementation

- Updated `src/lib/booking/search.ts`.
  - Added `PublicBookingClosure` with only `roomTypeId`, `startDate`, and `endDate`.
  - Changed `PublicBookingSearchData.propertyClosures` to the compact public closure shape.
- Updated `src/hooks/use-availability-search.tsx`.
  - Broadened the hook closure input/state to a minimal date-range closure shape so public search data no longer needs full `PropertyClosure` rows.
- Updated `src/lib/server/booking-search.ts`.
  - Narrowed `PUBLIC_BOOKING_SEARCH_ROOM_TYPE_SELECT` to `id, name, description, max_occupancy, bed_types, price, photos, main_photo_url`.
  - Mapped returned room types to `isVisible: true` because the query already filters hidden rows.
  - Narrowed `PUBLIC_BOOKING_SEARCH_CLOSURE_SELECT` to `start_date, end_date`.
  - Added `.is("room_type_id", null)` so cached booking search data only sends property-wide blocked dates; room-specific closure logic remains in `/api/availability/search`.

## 2026-05-13 23:09 IST - Booking Search Data Focused Green Gate

- Command: `date`
- Result: `Wed May 13 23:09:25 IST 2026`.
- Command: `pnpm vitest run src/lib/server/booking-search.test.ts src/app/api/bookings/search-data/route.test.ts src/hooks/use-booking-search-data.test.tsx src/hooks/use-availability-search.test.tsx`
- Result: passed, 4 files / 6 tests.

## 2026-05-13 23:09 IST - Booking Search Data Type Gate

- Command: `date`
- Result: `Wed May 13 23:09:42 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 23:09 IST - Booking Search Data Full Test Gate

- Command: `date`
- Result: `Wed May 13 23:09:55 IST 2026`.
- Command: `pnpm test`
- Result: passed, 146 files / 347 tests.

## 2026-05-13 23:10 IST - Booking Search Data Build Gate

- Command: `date`
- Result: `Wed May 13 23:10:39 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/book` remains static with 1h revalidation.
  - `/api/bookings/search-data` remains a dynamic route handler with explicit public cache headers and cached server data.

## 2026-05-13 23:11 IST - Booking Search Data Select Scan

- Command: `date`
- Result: `Wed May 13 23:11:23 IST 2026`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in the audited paths.

## 2026-05-13 23:12 IST - Public Availability Search Egress Analysis And Research

- Command: `date`
- Result: `Wed May 13 23:12:40 IST 2026`.
- Web research:
  - Next.js route-handler docs confirm non-GET methods are not cached, so `/api/availability/search` should remain a no-store POST: https://nextjs.org/docs/app/getting-started/route-handlers
  - Next.js caching docs note POST fetches are not memoized like GET fetches, reinforcing request-scoped optimization over caching for availability checks: https://nextjs.org/docs/app/deep-dive/caching
  - Supabase JavaScript docs confirm `select()` can be combined with filters such as `neq` and `in` to bound payloads: https://supabase.com/docs/reference/javascript/v1
- Commands:
  - `sed -n '1,260p' src/lib/server/availability.ts`
  - `sed -n '1,220p' src/lib/server/availability.test.ts`
  - `sed -n '1,220p' src/app/api/availability/search/route.ts`
  - `sed -n '1,220p' src/hooks/use-room-type-availability-search.ts`
  - `sed -n '1,120p' src/lib/rooms.ts`
- Findings:
  - `/api/availability/search` correctly uses `POST`, `dynamic = "force-dynamic"`, `revalidate = 0`, and `Cache-Control: no-store`.
  - General booking search must evaluate all visible room types, but room-detail availability checks know the selected `roomTypeId` and currently still ask the API for all room types and all overlapping reservations.
  - Server-side availability already filters overlapping reservations by date but not by scoped room IDs.
  - Server-side availability computes bookable rooms in memory even though bookable statuses are already centralized in `BOOKABLE_ROOM_STATUSES`.
  - Safe optimization: let detail checks pass `roomTypeIds`, validate/pass the scope in the route, filter visible room types and bookable rooms in Supabase, and when scoped, filter overlapping reservations by the matching room IDs.
- Next step: add red tests for scoped availability requests and DB filters before implementation.

## 2026-05-13 23:13 IST - Public Availability Search Red Tests

- Command: `date`
- Result: `Wed May 13 23:13:24 IST 2026`.
- Changed focused tests to require:
  - `useRoomTypeAvailabilitySearch()` sending `roomTypeIds` for room-detail checks,
  - `/api/availability/search` preserving `roomTypeIds` through validation,
  - `searchPublicAvailability()` filtering visible room types, bookable rooms, scoped room types, scoped rooms, and scoped reservations.
- Command: `pnpm vitest run src/hooks/use-room-type-availability-search.test.tsx src/app/api/availability/search/route.test.ts src/lib/server/availability.test.ts`
- Intended result: failed, 3 files / 3 failing tests.
- Failures proved the current detail hook did not send `roomTypeIds`, the route schema stripped `roomTypeIds`, and the server helper did not apply the new database filters.

## 2026-05-13 23:14 IST - Public Availability Search Scoped Implementation

- Updated `src/hooks/use-room-type-availability-search.ts`.
  - Room-detail availability checks now include `roomTypeIds: [roomTypeId]` in the no-store POST body.
- Updated `src/app/api/availability/search/route.ts`.
  - Validation now preserves optional `roomTypeIds`.
- Updated `src/lib/server/availability.ts`.
  - Narrowed `PUBLIC_AVAILABILITY_ROOM_TYPE_SELECT` by removing `is_visible`; visibility is now a database filter.
  - Added `.neq("is_visible", false)` to public room-type availability reads.
  - Added `.in("status", BOOKABLE_ROOM_STATUSES)` to public room reads.
  - Applies optional room-type scope to room-type and room queries.
  - When scoped, filters overlapping reservations by the selected room IDs before computing availability.

## 2026-05-13 23:14 IST - Public Availability Search Focused Green Gate

- Command: `date`
- Result: `Wed May 13 23:14:30 IST 2026`.
- Command: `pnpm vitest run src/hooks/use-room-type-availability-search.test.tsx src/app/api/availability/search/route.test.ts src/lib/server/availability.test.ts`
- Result: passed, 3 files / 6 tests.

## 2026-05-13 23:14 IST - Public Availability Search Type Gate First Run

- Command: `date`
- Result: `Wed May 13 23:14:46 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: failed because the scoped no-room branch used a plain `{ data, error }` object where TypeScript expected a full PostgREST response.
- Fix: track reservation rows and reservation errors separately instead of representing the empty scoped branch as a PostgREST response.

## 2026-05-13 23:15 IST - Public Availability Search Type Gate

- Command: `date`
- Result: `Wed May 13 23:15:19 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 23:15 IST - Public Availability Search Full Test Gate

- Command: `date`
- Result: `Wed May 13 23:15:30 IST 2026`.
- Command: `pnpm test`
- Result: passed, 146 files / 347 tests.

## 2026-05-13 23:16 IST - Public Availability Search Build Gate

- Command: `date`
- Result: `Wed May 13 23:16:15 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/api/availability/search` remains a dynamic no-store POST route.
  - `/book/rooms/[id]` remains dynamic and now its client-side availability check can use room-type scoped payloads.

## 2026-05-13 23:17 IST - Public Availability Search Select Scan And Fetch Audit

- Command: `date`
- Result: `Wed May 13 23:17:05 IST 2026`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in the audited paths.
- Command: `rg -n "fetch\\(\"/api|fetch\\('/api|authorizedFetch\\(\"/api|authorizedFetch\\('/api" src/app src/components src/hooks -S`
- Result: remaining fetch surface refreshed.
- Public GET/check paths now covered in recent passes:
  - `/api/room-types/preview`
  - `/api/bookings/search-data`
  - `/api/availability/search`
  - `/api/reviews`
  - `/api/event-banner/active`
- Remaining public form/booking POSTs are transactional:
  - `/api/donations/create-order`
  - `/api/donations/verify-payment`
  - `/api/feedback`
  - `/api/bookings/public`
- Next target: inspect admin route-local GET `/api/admin/room-categories` from the admin room categories panel.

## 2026-05-13 23:17 IST - Admin Room Categories Egress Analysis And Research

- Command: `date`
- Result: `Wed May 13 23:17:40 IST 2026`.
- Web research:
  - Next.js route-handler docs confirm route handlers support request-time authenticated GET handlers and are not cached by default unless opted in: https://nextjs.org/docs/app/getting-started/route-handlers
  - Supabase JavaScript docs confirm explicit `select()` and `order()` are the right way to bound and stabilize table reads: https://supabase.com/docs/reference/javascript/v1
- Commands:
  - `sed -n '1,220p' src/app/admin/room-categories/components/room-categories-panel.tsx`
  - `sed -n '1,220p' src/app/api/admin/room-categories/route.ts`
  - `sed -n '1,220p' src/lib/server/admin-room-categories.ts`
  - `sed -n '1,220p' src/lib/server/admin-room-categories.test.ts`
  - `sed -n '1,180p' src/app/api/admin/room-categories/route.test.ts`
  - `sed -n '1,260p' src/app/admin/room-categories/room-categories-panel-loader.tsx src/app/admin/room-categories/page.tsx`
- Findings:
  - The route requires `requireAdminProfile()` and returns `Cache-Control: private, no-store`, which is appropriate for admin data.
  - The server helper uses `ADMIN_ROOM_CATEGORIES_SELECT = "id, name, description"` and stable name ordering.
  - The panel consumes only `RoomCategory[]` with `id`, `name`, and `description`; no broader category fields or joins are loaded.
- Decision: no implementation change needed for this pass; existing tests already lock the compact select and no-store response.

## 2026-05-13 23:18 IST - Admin Room Categories Focused Verification

- Command: `date`
- Result: `Wed May 13 23:18:02 IST 2026`.
- Command: `pnpm vitest run src/lib/server/admin-room-categories.test.ts src/app/api/admin/room-categories/route.test.ts`
- Result: passed, 2 files / 2 tests.
- No source change was made in this pass.

## 2026-05-13 23:18 IST - Admin Rooms Egress Analysis And Research

- Command: `date`
- Result: `Wed May 13 23:18:27 IST 2026`.
- Web research:
  - Next.js route-handler and authentication docs emphasize verifying authorization in route handlers and returning only needed DTO fields: https://nextjs.org/docs/app/building-your-application/authentication
  - Supabase JavaScript docs confirm explicit `select()` and ordered reads bound table payloads: https://supabase.com/docs/reference/javascript/v1
- Commands:
  - `sed -n '1,260p' src/app/admin/rooms/components/rooms-panel.tsx`
  - `sed -n '1,220p' src/app/api/admin/rooms/route.ts`
  - `sed -n '1,260p' src/lib/server/admin-rooms.ts`
  - `sed -n '1,220p' src/lib/server/admin-rooms.test.ts`
  - `sed -n '1,180p' src/app/api/admin/rooms/route.test.ts`
  - `sed -n '1,260p' src/app/admin/rooms/components/columns.tsx src/app/admin/rooms/components/room-form-dialog.tsx`
- Findings:
  - The route requires `requireAdminProfile()` and returns `Cache-Control: private, no-store`.
  - `getAdminRoomsData()` uses two explicit selects: rooms (`id`, `room_number`, `room_type_id`, `status`, `photos`) and room type summaries (`id`, `name`, `main_photo_url`).
  - The table needs room number, status, room type name, and an image. The edit dialog also needs the room's existing `photos` array immediately for `MultiImageUpload`, so dropping `photos` from the initial DTO would change edit behavior unless a new lazy detail fetch is introduced.
- Decision: no implementation change in this pass; existing route-local API is compact for its current UI behavior and tests lock the selected columns.

## 2026-05-13 23:18 IST - Admin Rooms Focused Verification

- Command: `date`
- Result: `Wed May 13 23:18:53 IST 2026`.
- Command: `pnpm vitest run src/lib/server/admin-rooms.test.ts src/app/api/admin/rooms/route.test.ts`
- Result: passed, 2 files / 2 tests.
- No source change was made in this pass.

## 2026-05-13 23:19 IST - Admin Room Types Egress Analysis And Research

- Command: `date`
- Result: `Wed May 13 23:19:20 IST 2026`.
- Web research:
  - Supabase docs confirm explicit `select()`, filters, and ordered reads are the correct controls for bounded table payloads: https://supabase.com/docs/reference/javascript/v1/select
  - Next.js authentication docs recommend route-handler authorization checks and DTOs that return only necessary data: https://nextjs.org/docs/app/building-your-application/authentication
- Commands:
  - `sed -n '1,300p' src/app/admin/room-types/components/room-types-panel.tsx`
  - `sed -n '1,220p' src/app/api/admin/room-types/route.ts`
  - `sed -n '1,320p' src/lib/server/admin-room-types.ts`
  - `sed -n '1,260p' src/lib/server/admin-room-types.test.ts`
  - `sed -n '1,180p' src/app/api/admin/room-types/route.test.ts`
  - `sed -n '1,360p' src/app/admin/room-types/components/columns.tsx src/app/admin/room-types/components/room-type-form-dialog.tsx`
  - `sed -n '180,360p' src/app/admin/room-types/components/room-type-form-dialog.tsx`
- Findings:
  - The route requires `requireAdminProfile()` and returns `Cache-Control: private, no-store`.
  - `getAdminRoomTypesData()` uses explicit room type, room-type amenity, and amenity option selects, with stable ordering.
  - The table uses image/name/occupancy/bed types/amenity badges, and the edit dialog needs full `photos`, `mainPhotoUrl`, `amenities`, `price`, `description`, and visibility fields immediately.
  - Amenity options are already compact (`id`, `name`), and room-type amenity rows are just the junction ids needed to populate badges/checklist defaults.
- Decision: no implementation change in this pass; current payload matches the panel/edit behavior and focused tests lock compact selects.

## 2026-05-13 23:19 IST - Admin Room Types Focused Verification

- Command: `date`
- Result: `Wed May 13 23:19:47 IST 2026`.
- Command: `pnpm vitest run src/lib/server/admin-room-types.test.ts src/app/api/admin/room-types/route.test.ts`
- Result: passed, 2 files / 2 tests.
- No source change was made in this pass.

## 2026-05-13 23:20 IST - Admin Rates Egress Analysis And Research

- Command: `date`
- Result: `Wed May 13 23:20:13 IST 2026`.
- Web research:
  - Supabase docs confirm `select()` can be combined with modifiers/filters and explicit columns to bound table payloads: https://supabase.com/docs/reference/javascript/v1/select
  - Supabase `order()` docs confirm stable server-side ordering for select queries: https://supabase.com/docs/reference/javascript/v1/order
  - Next.js authentication docs recommend route-handler authorization checks and DTOs with only necessary data: https://nextjs.org/docs/app/building-your-application/authentication
- Commands:
  - `sed -n '1,320p' src/app/admin/rates/components/rates-panel.tsx`
  - `sed -n '1,220p' src/app/api/admin/rates/route.ts`
  - `sed -n '1,360p' src/lib/server/admin-rates.ts`
  - `sed -n '1,280p' src/lib/server/admin-rates.test.ts`
  - `sed -n '1,220p' src/app/api/admin/rates/route.test.ts`
  - `rg -n "Rate|Season|Occupancy|admin/rates|rates" src/app/admin/rates src/components -S`
- Findings:
  - The route requires `requireAdminProfile()` and returns `Cache-Control: private, no-store`.
  - `getAdminRatesData()` uses explicit selects for rate plans (`id`, `name`, `price`, `rules`), seasonal prices (`id`, `room_type_id`, `name`, `price`, `start_date`, `end_date`), and room type options (`id`, `name`).
  - The rates panel renders both the rate-plan table and the full seasonal-prices table with edit forms, so the current route-local DTO matches the visible/editable UI.
  - A further egress reduction would require a larger UX/API change such as pagination or lazy seasonal-price detail loading, not a safe no-behavior-change edit in this pass.
- Decision: no implementation change in this pass; existing tests lock the compact selects and no-store response.

## 2026-05-13 23:20 IST - Admin Rates Focused Verification

- Command: `date`
- Result: `Wed May 13 23:20:33 IST 2026`.
- Command: `pnpm vitest run src/lib/server/admin-rates.test.ts src/app/api/admin/rates/route.test.ts`
- Result: passed, 2 files / 2 tests.
- No source change was made in this pass.

## 2026-05-13 23:21 IST - Admin Manual Receipts Egress Analysis And Research

- Command: `date`
- Result: `Wed May 13 23:21:04 IST 2026`.
- Web research:
  - Supabase docs recommend explicit columns and pagination/range when payloads can grow: https://supabase.com/docs/reference/javascript/range
  - Supabase select docs note projects cap rows by default and recommend pagination for large result sets: https://supabase.com/docs/reference/javascript/v1/select
  - Next.js authentication docs recommend route-handler authorization checks and DTOs with only needed data: https://nextjs.org/docs/app/building-your-application/authentication
- Commands:
  - `sed -n '1,380p' src/app/admin/manual-receipt/manual-receipt-history.tsx`
  - `sed -n '380,920p' src/app/admin/manual-receipt/manual-receipt-history.tsx`
  - `sed -n '1,280p' src/app/api/admin/manual-receipts/route.ts`
  - `sed -n '1,260p' src/app/api/admin/manual-receipts/route.test.ts`
  - `rg -n "manual-receipts|ManualReceipt|manual receipt|getManual|receipt" src/lib src/app/api src/app/admin/manual-receipt -S`
- Findings:
  - The history table, edit dialog, PDF download, and WhatsApp flow all reuse the same `ManualReceipt` row shape, so dropping fields from the initial response would change current behavior unless a separate lazy detail fetch is introduced.
  - The list still fetches all manual receipts and filters client-side; a larger pagination/server-filter change could reduce egress but would alter UX and needs a dedicated pass.
  - The immediate safe issue is cache control: unlike other admin route-local GETs, `/api/admin/manual-receipts` does not return `Cache-Control: private, no-store`, and the client fetch does not pass `cache: "no-store"`.
- Next step: add red tests for private no-store response headers before changing the route/client fetch.

## 2026-05-13 23:21 IST - Admin Manual Receipts Red Test

- Command: `date`
- Result: `Wed May 13 23:21:46 IST 2026`.
- Changed `src/app/api/admin/manual-receipts/route.test.ts` to require `Cache-Control: private, no-store` on manual receipt GET and POST responses.
- Command: `pnpm vitest run src/app/api/admin/manual-receipts/route.test.ts`
- Intended result: failed, 1 file / 2 tests.
- Failure proved the current manual receipt route returned no cache-control header.

## 2026-05-13 23:22 IST - Admin Manual Receipts No-Store Implementation

- Updated `src/app/api/admin/manual-receipts/route.ts`.
  - Added `Cache-Control: private, no-store` to GET and POST success/error responses.
- Updated `src/app/admin/manual-receipt/manual-receipt-history.tsx`.
  - Manual receipt history fetch now passes `cache: "no-store"`.

## 2026-05-13 23:22 IST - Admin Manual Receipts Focused Green Gate

- Command: `date`
- Result: `Wed May 13 23:22:19 IST 2026`.
- Command: `pnpm vitest run src/app/api/admin/manual-receipts/route.test.ts src/app/admin/manual-receipt/manual-receipt-code-splitting.test.ts`
- Result: passed, 2 files / 4 tests.

## 2026-05-13 23:22 IST - Admin Manual Receipts Type Gate

- Command: `date`
- Result: `Wed May 13 23:22:36 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 23:22 IST - Admin Manual Receipts Full Test Gate First Run

- Command: `date`
- Result: `Wed May 13 23:22:50 IST 2026`.
- Command: `pnpm test`
- Result: failed due to a `beforeAll` hook timeout in `src/test/setup.ts` while running `src/app/admin/reservations/[id]/edit/reservation-edit-code-splitting.test.ts`.
- Notes:
  - The two tests in that suite were reported as skipped.
- The failure was a shared test setup timeout, not an assertion failure in the manual receipt route/client changes.
- Next step: rerun the full suite.

## 2026-05-14 11:14 IST - Admin Manual Receipts Full Test Gate

- Command: `date`
- Result: `Thu May 14 11:14:15 IST 2026`.
- Command: `pnpm test`
- Result: passed, 146 files / 347 tests.

## 2026-05-14 11:15 IST - Admin Manual Receipts Build Gate

- Command: `date`
- Result: `Thu May 14 11:15:37 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/admin/manual-receipt` and `/admin/manual-receipt/new` remain static admin shells with dynamic client workflows.
  - `/api/admin/manual-receipts` remains a dynamic route handler and now returns private no-store headers.

## 2026-05-14 11:17 IST - Admin Manual Receipts Select Scan And Fetch Audit

- Command: `date`
- Result: `Thu May 14 11:17:32 IST 2026`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in the audited paths.
- Command: `rg -n "fetch\\(\"/api|fetch\\('/api|authorizedFetch\\(\"/api|authorizedFetch\\('/api" src/app src/components src/hooks -S`
- Result: remaining fetch surface refreshed after the manual receipt no-store change.
- Newly audited this segment:
  - `/api/admin/room-categories`: no source change; focused tests passed.
  - `/api/admin/rooms`: no source change; focused tests passed.
  - `/api/admin/room-types`: no source change; focused tests passed.
  - `/api/admin/rates`: no source change; focused tests passed.
  - `/api/admin/manual-receipts`: source change added private no-store route/client behavior; full gates passed.
- Next unaudited route-local candidates from the refreshed surface include settings import support endpoints (`/api/admin/rooms/options`, `/api/admin/external-room-links*`, `/api/admin/import/vikbooking`) and transactional form endpoints.

## 2026-05-14 11:20 IST - Admin Room Options Egress Analysis And Research

- Command: `date`
- Result: `Thu May 14 11:20:11 IST 2026`.
- Web research:
  - Supabase docs confirm explicit column selection and stable ordering are the primary controls for bounded option-list payloads: https://supabase.com/docs/reference/javascript/v1/select and https://supabase.com/docs/reference/javascript/v1/order
  - Supabase docs recommend range/pagination when result sets can grow, but this route is a tiny room mapping option list used only during import mapping: https://supabase.com/docs/reference/javascript/range
  - Next.js authentication docs recommend route-handler authorization and DTOs with only needed data: https://nextjs.org/docs/app/building-your-application/authentication
- Commands:
  - `sed -n '1,260p' src/app/api/admin/rooms/options/route.ts`
  - `sed -n '1,260p' src/app/api/admin/rooms/options/route.test.ts`
  - `sed -n '1,260p' src/lib/server/admin-room-options.ts`
  - `sed -n '1,260p' src/lib/server/admin-room-options.test.ts`
  - `sed -n '1,320p' src/app/admin/settings/components/data-tools/csv-import-panel.tsx`
  - `rg -n "rooms/options|AdminRoomOption|getAdminRoomOptions|roomOptions|room options" src -S`
- Findings:
  - The route requires `requireAdminProfile()` and returns `Cache-Control: private, no-store`.
  - The server helper selects only `id, room_number` from `rooms` and orders by room number.
  - The CSV import panel lazy-loads these options only after validation finds missing room labels/numbers, and it already uses `cache: "no-store"`.
  - The payload exactly matches the mapping UI needs (`id`, `roomNumber`).
- Decision: no implementation change needed; existing tests lock the compact select and no-store response.

## 2026-05-14 11:20 IST - Admin Room Options Focused Verification

- Command: `date`
- Result: `Thu May 14 11:20:41 IST 2026`.
- Command: `pnpm vitest run src/lib/server/admin-room-options.test.ts src/app/api/admin/rooms/options/route.test.ts`
- Result: passed, 2 files / 2 tests.
- No source change was made in this pass.

## 2026-05-14 11:21 IST - Admin External Room Links Egress Analysis And Research

- Command: `date`
- Result: `Thu May 14 11:21:25 IST 2026`.
- Web research:
  - Supabase insert/upsert docs confirm mutation calls do not return rows unless chained with `select()`, so omitting `select()` avoids unnecessary return payloads when callers do not need the row: https://supabase.com/docs/reference/javascript/insert
  - Supabase reference notes update/delete/insert/upsert do not return rows by default in modern `supabase-js`: https://supabase.com/docs/reference/javascript/v1
  - Next.js authentication docs recommend secure route-handler authorization checks and DTOs with only needed data: https://nextjs.org/docs/app/building-your-application/authentication
- Commands:
  - `sed -n '1,320p' src/app/api/admin/external-room-links/route.ts`
  - `sed -n '1,320p' src/app/api/admin/external-room-links/room-numbers/route.ts`
  - `rg -n "external-room-links|room-numbers|ExternalRoom|upsertExternal|room links|roomLinks|external_room" src/app src/lib supabase -S`
  - `rg -n "external-room-links" src/app/api src -g '*test*' -S`
  - `sed -n '1,260p' src/lib/importers/vikbooking/room-links.ts`
  - `sed -n '1,260p' src/lib/importers/vikbooking/room-number-links.ts`
  - `sed -n '1980,2055p' supabase/migrations/00000000000000_baseline.sql`
  - `sed -n '430,470p' src/data/types.ts`
- Findings:
  - The CSV import UI uses the POST endpoints only as commands; it does not read the returned `link` payload.
  - Both room-label and room-number upsert helpers currently call `.select(...).single()` after `upsert()`, causing unnecessary mutation-return egress.
  - Both external-room-link route groups also lack explicit `Cache-Control: private, no-store` headers.
  - GET routes still need to return full link objects for import matching/status flows.
- Test-first change:
  - Added `src/lib/importers/vikbooking/room-links.test.ts`.
  - Added `src/lib/importers/vikbooking/room-number-links.test.ts`.
  - Added `src/app/api/admin/external-room-links/route.test.ts`.
  - Added `src/app/api/admin/external-room-links/room-numbers/route.test.ts`.
- Next step: run focused red tests requiring no-return upserts and no-store/no-content POST responses.

## 2026-05-14 11:23 IST - Admin External Room Links Red Tests

- Command: `date`
- Result: `Thu May 14 11:23:24 IST 2026`.
- Command: `pnpm vitest run src/lib/importers/vikbooking/room-links.test.ts src/lib/importers/vikbooking/room-number-links.test.ts src/app/api/admin/external-room-links/route.test.ts src/app/api/admin/external-room-links/room-numbers/route.test.ts`
- Intended result: failed, 4 files / 6 tests.
- Failures proved:
  - both upsert helpers still chained `.select(...).single()` after mutation,
  - both route groups lacked private no-store cache headers,
  - both POST handlers still returned `200` with a JSON row payload instead of `204 No Content`.

## 2026-05-14 11:24 IST - Admin External Room Links No-Return Mutation Implementation

- Updated `src/lib/importers/vikbooking/room-links.ts`.
  - `upsertExternalRoomLink()` now awaits `upsert()` directly and does not select the saved row back.
- Updated `src/lib/importers/vikbooking/room-number-links.ts`.
  - `upsertRoomNumberLink()` now awaits `upsert()` directly and does not select the saved row back.
- Updated `src/app/api/admin/external-room-links/route.ts`.
  - Added `Cache-Control: private, no-store` to GET/POST/PATCH success and error responses.
  - POST now returns `204 No Content`.
- Updated `src/app/api/admin/external-room-links/room-numbers/route.ts`.
  - Added `Cache-Control: private, no-store` to GET/POST success and error responses.
  - POST now returns `204 No Content`.

## 2026-05-14 11:26 IST - Admin External Room Links Focused Verification

- Command: `date`
- Result: `2026-05-14 11:26 IST`.
- Command: `pnpm vitest run src/lib/importers/vikbooking/room-links.test.ts src/lib/importers/vikbooking/room-number-links.test.ts src/app/api/admin/external-room-links/route.test.ts src/app/api/admin/external-room-links/room-numbers/route.test.ts`
- Result: passed, 4 files / 6 tests.
- Verified:
  - room-label and room-number upserts no longer call `.select().single()` after mutation,
  - both admin route groups emit private no-store headers,
  - both POST handlers return `204 No Content`.

## 2026-05-14 11:26 IST - Admin External Room Links Typecheck Gate

- Command: `date`
- Result: `2026-05-14 11:26 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 11:27 IST - Admin External Room Links Full Test Gate

- Command: `date`
- Result: `2026-05-14 11:27 IST`.
- Command: `pnpm test`
- Result: passed, 150 files / 353 tests.

## 2026-05-14 11:28 IST - Admin External Room Links Build And Select Scan

- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/api/admin/external-room-links` remains a dynamic route handler.
  - `/api/admin/external-room-links/room-numbers` remains a dynamic route handler.
- Command: `date`
- Result: `2026-05-14 11:28 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 11:31 IST - Admin VikBooking Import Egress Analysis And Research

- Command: `date`
- Result: `2026-05-14 11:31 IST`.
- Web research:
  - Supabase select docs recommend keeping result sizes low and using pagination/range for growing tables; count-only queries can use `{ count: "exact", head: true }` to avoid returning rows: https://supabase.com/docs/reference/javascript/v1/select
  - Supabase mutation docs confirm inserted/updated/upserted rows are not returned unless `.select()` is chained, reinforcing command-style imports where rows are not read by the caller: https://supabase.com/docs/reference/javascript/db-modifiers-select
  - Supabase database function docs recommend database functions for data-intensive operations executed within Postgres, matching the existing `import_vikbooking_payload` RPC: https://supabase.com/docs/guides/database/functions
  - Next.js route handler/caching docs show route handlers return `Response` objects and sensitive dynamic responses should avoid shared caching: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers and https://nextjs.org/docs/app/guides/cdn-caching
- Commands:
  - `sed -n '1,320p' src/app/api/admin/import/vikbooking/route.ts`
  - `sed -n '260,560p' src/app/api/admin/import/vikbooking/route.ts`
  - `sed -n '1,320p' 'src/app/api/admin/import/vikbooking/jobs/[id]/route.ts'`
  - `sed -n '1,360p' src/lib/importers/vikbooking/jobs.ts`
  - `sed -n '1,260p' src/lib/importers/vikbooking/room-number-map.ts`
  - `sed -n '100,260p' src/app/admin/settings/components/data-tools/csv-import-panel.tsx`
  - `sed -n '260,540p' src/app/admin/settings/components/data-tools/csv-import-panel.tsx`
  - `rg -n "fetch\\(.*import/vikbooking|authorizedFetch\\(.*import/vikbooking|/api/admin/import/vikbooking" src/app src/components src/hooks src/lib -S`
- Findings:
  - Dry-run validation stores only `SUMMARY_PREVIEW_LIMIT` rows in job summary but returns `preview: parseResult.rows`, sending the full parsed CSV back to the browser.
  - The settings import UI only renders the preview table and uses `totalRows`/job progress separately, so the dry-run response can be bounded to the preview limit without losing import capability.
  - The polling route reads every `import_job_entries` row on every poll to compute four status counts and the first ten errors.
  - The polling route can use count-only Supabase queries for each status plus a limited error query, avoiding repeated full-entry payloads during import.
  - The import and job status endpoints return admin import/job data and should emit `Cache-Control: private, no-store`.
- Test-first change planned:
  - Add dry-run route coverage requiring bounded preview rows and private no-store response headers.
  - Add job status route coverage requiring count-only status queries, a 10-row error query, and private no-store response headers.

## 2026-05-14 11:33 IST - Admin VikBooking Import Red Tests

- Command: `date`
- Result: `2026-05-14 11:33 IST`.
- Added failing coverage:
  - `src/app/api/admin/import/vikbooking/route.test.ts`
  - `src/app/api/admin/import/vikbooking/jobs/[id]/route.test.ts`
- Command: `pnpm vitest run src/app/api/admin/import/vikbooking/route.test.ts 'src/app/api/admin/import/vikbooking/jobs/[id]/route.test.ts'`
- Intended result: failed, 2 files / 2 tests.
- Failures proved the import dry-run and job status endpoints do not yet emit `Cache-Control: private, no-store`; the tests also require bounded dry-run preview payloads and count-only polling queries for the implementation pass.

## 2026-05-14 11:35 IST - Admin VikBooking Import Bounded Payload Implementation

- Updated `src/app/api/admin/import/vikbooking/route.ts`.
  - Added `Cache-Control: private, no-store` to success and error responses.
  - Dry-run validation now returns `preview: summaryPreview` instead of all parsed rows while still inserting all rows into `import_job_entries`.
- Updated `src/app/api/admin/import/vikbooking/jobs/[id]/route.ts`.
  - Added `Cache-Control: private, no-store` to success and error responses.
  - Replaced the all-entry polling query with four count-only status queries using `{ count: "exact", head: true }`.
  - Added a separate bounded recent-error query selecting `id,row_number,message` with `limit(10)`.
- Updated `src/app/admin/settings/components/data-tools/csv-import-panel.tsx`.
  - The preview heading now distinguishes a bounded preview from the total imported row count.

## 2026-05-14 11:35 IST - Admin VikBooking Import Focused Verification

- Command: `date`
- Result: `2026-05-14 11:35 IST`.
- Command: `pnpm vitest run src/app/api/admin/import/vikbooking/route.test.ts 'src/app/api/admin/import/vikbooking/jobs/[id]/route.test.ts'`
- Result: passed, 2 files / 2 tests.

## 2026-05-14 11:35 IST - Admin VikBooking Import Typecheck Gate

- Command: `date`
- Result: `2026-05-14 11:35 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 11:36 IST - Admin VikBooking Import Full Test Gate

- Command: `date`
- Result: `2026-05-14 11:36 IST`.
- Command: `pnpm test`
- Result: passed, 152 files / 355 tests.

## 2026-05-14 11:38 IST - Admin VikBooking Import Build And Select Scan

- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/api/admin/import/vikbooking` remains a dynamic route handler.
  - `/api/admin/import/vikbooking/jobs/[id]` remains a dynamic route handler.
- Command: `date`
- Result: `2026-05-14 11:38 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 11:39 IST - Admin Send Invoice WhatsApp Egress Analysis And Research

- Command: `date`
- Result: `2026-05-14 11:39 IST`.
- Web research:
  - Next.js route handler docs confirm POST handlers are dynamic and use Web Request/Response APIs, including `request.formData()` for form submissions: https://nextjs.org/docs/14/app/building-your-application/routing/route-handlers
  - Next.js CDN caching docs describe private no-store headers for dynamic user-specific responses: https://nextjs.org/docs/app/guides/cdn-caching
  - MDN FormData docs confirm file/blob form fields can be appended with filenames for upload-style requests: https://developer.mozilla.org/en-US/docs/Web/API/FormData/append
  - Next.js fetch docs document `cache: "no-store"` for requests that must go to source every time: https://nextjs.org/docs/app/api-reference/functions/fetch
- Commands:
  - `sed -n '1,280p' src/app/api/admin/send-invoice-whatsapp/route.ts`
  - `sed -n '1,260p' src/lib/whatsapp.ts`
  - `sed -n '40,110p' src/components/shared/send-invoice-whatsapp-button.tsx`
  - `sed -n '300,340p' src/app/admin/manual-receipt/manual-receipt-history.tsx`
  - `sed -n '230,270p' src/app/admin/manual-receipt/new/new-manual-receipt-form.tsx`
  - `rg -n "sendWhatsAppFile|normalizePhone|send-invoice-whatsapp" src -g '*test*' -S`
- Findings:
  - The route is a command endpoint; all clients only check `response.ok` and optionally parse errors, so success does not need a JSON payload.
  - The route currently returns `200 { success: true }` and has no explicit private no-store headers.
  - The GOWA file send is also a command-style outbound fetch and should explicitly opt out of caching.
- Test-first change planned:
  - Add route coverage requiring `204 No Content`, empty body, private no-store headers, and the existing feature guard.
  - Add WhatsApp client coverage requiring outbound file sends to use `cache: "no-store"`.

## 2026-05-14 11:40 IST - Admin Send Invoice WhatsApp Red Tests

- Command: `date`
- Result: `2026-05-14 11:40 IST`.
- Added failing coverage:
  - `src/app/api/admin/send-invoice-whatsapp/route.test.ts`
  - `src/lib/whatsapp.test.ts`
- Command: `pnpm vitest run src/app/api/admin/send-invoice-whatsapp/route.test.ts src/lib/whatsapp.test.ts`
- Intended result: failed, 2 files / 2 tests.
- Failures proved:
  - the WhatsApp send route still returns `200` with a success JSON body,
  - the outbound GOWA file upload does not yet set `cache: "no-store"`.

## 2026-05-14 11:41 IST - Admin Send Invoice WhatsApp Command Response Implementation

- Updated `src/app/api/admin/send-invoice-whatsapp/route.ts`.
  - Success now returns `204 No Content` instead of `200 { success: true }`.
  - Success and error responses now include `Cache-Control: private, no-store`.
- Updated `src/lib/whatsapp.ts`.
  - `sendWhatsAppMessage()`, `sendWhatsAppImage()`, and `sendWhatsAppFile()` now pass `cache: "no-store"` to outbound GOWA command requests.

## 2026-05-14 11:41 IST - Admin Send Invoice WhatsApp Focused Verification

- Command: `date`
- Result: `2026-05-14 11:41 IST`.
- Command: `pnpm vitest run src/app/api/admin/send-invoice-whatsapp/route.test.ts src/lib/whatsapp.test.ts`
- Result: passed, 2 files / 2 tests.

## 2026-05-14 11:41 IST - Admin Send Invoice WhatsApp Typecheck Gate

- Command: `date`
- Result: `2026-05-14 11:41 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 11:42 IST - Admin Send Invoice WhatsApp Full Test Gate

- Command: `date`
- Result: `2026-05-14 11:42 IST`.
- Command: `pnpm test`
- Result: passed, 154 files / 357 tests.

## 2026-05-14 11:43 IST - Admin Send Invoice WhatsApp Build And Select Scan

- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/api/admin/send-invoice-whatsapp` remains a dynamic route handler.
- Command: `date`
- Result: `2026-05-14 11:43 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 11:44 IST - Public Reviews And Event Banner Egress Audit

- Command: `date`
- Result: `2026-05-14 11:44 IST`.
- Web research:
  - Supabase docs recommend explicit columns and bounded result sets with `limit()`/pagination for growing tables: https://supabase.com/docs/reference/javascript/v1/select and https://supabase.com/docs/reference/javascript/v1/limit
  - Next.js route/CDN caching docs support shared cache headers for deterministic public content endpoints: https://nextjs.org/docs/app/guides/cdn-caching
- Commands:
  - `sed -n '1,220p' src/app/api/reviews/route.ts`
  - `sed -n '1,220p' src/app/api/event-banner/active/route.ts`
  - `sed -n '1,220p' src/lib/server/reviews.ts`
  - `sed -n '120,160p' src/lib/server/events.ts`
  - `sed -n '1,180p' src/components/marketing/home/ReviewSection.tsx`
  - `sed -n '1,130p' src/components/marketing/home/EventBannerModal.tsx`
- Findings:
  - `/api/reviews` already returns only public review DTO fields and shared cache headers.
  - `getPublishedReviews()` uses `unstable_cache`, explicit `PUBLIC_REVIEW_SELECT_COLUMNS`, and a clamped public review limit.
  - `/api/event-banner/active` already returns shared cache headers.
  - `getHomepageModalBanner()` uses `unstable_cache`, explicit public banner columns, and a bounded `limit(5)` candidate query before active-window filtering.
- Decision: no source change needed.
- Command: `pnpm vitest run src/app/api/reviews/route.test.ts src/app/api/event-banner/active/route.test.ts src/lib/server/reviews.test.ts src/lib/server/events.test.ts`
- Result: passed, 4 files / 9 tests.

## 2026-05-14 11:45 IST - Public Feedback Submit Egress Analysis And Red Test

- Command: `date`
- Result: `2026-05-14 11:45 IST`.
- Web research:
  - Supabase insert docs confirm inserts do not return rows unless `.select()` is chained, so the current command-style insert avoids mutation-return egress: https://supabase.com/docs/reference/javascript/insert
  - Next.js route handler docs confirm POST route handlers use Web Request/Response APIs and can set response headers directly: https://nextjs.org/docs/app/getting-started/route-handlers
- Commands:
  - `sed -n '1,240p' src/app/api/feedback/route.ts`
  - `sed -n '80,140p' src/components/feedback/feedback-form.tsx`
  - `rg -n "api/feedback|feedback-form|insert\\(|from\\(\"feedback\"|from\\('feedback'" src -S`
- Findings:
  - `/api/feedback` already inserts feedback without chaining `.select()`.
  - The client reads only the success/error message and does not need any database row.
  - Success and error responses currently lack explicit `Cache-Control: private, no-store`.
- Added `src/app/api/feedback/route.test.ts`.
- Command: `pnpm vitest run src/app/api/feedback/route.test.ts`
- Intended result: failed, 1 file / 1 test.
- Failure proved the route does not yet emit the private no-store header while preserving no-select insert behavior.

## 2026-05-14 11:46 IST - Public Feedback Submit No-Store Implementation

- Updated `src/app/api/feedback/route.ts`.
  - Success and error responses now include `Cache-Control: private, no-store`.
  - The Supabase insert remains command-style with no `.select()` and no returned database row.
- Command: `date`
- Result: `2026-05-14 11:46 IST`.
- Command: `pnpm vitest run src/app/api/feedback/route.test.ts`
- Result: passed, 1 file / 1 test.

## 2026-05-14 11:46 IST - Public Feedback Submit Typecheck Gate

- Command: `date`
- Result: `2026-05-14 11:46 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 11:48 IST - Public Feedback Submit Full Test Gate

- Command: `date`
- Result: `2026-05-14 11:48 IST`.
- Command: `pnpm test`
- Result: passed, 155 files / 358 tests.

## 2026-05-14 11:49 IST - Public Feedback Submit Build And Select Scan

- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/api/feedback` remains a dynamic route handler.
- Command: `date`
- Result: `2026-05-14 11:49 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 11:52 IST - Public Donation Payment Egress Analysis And Red Tests

- Command: `date`
- Result: `2026-05-14 11:52 IST`.
- Web research:
  - Razorpay Orders API docs confirm Checkout needs an order created with amount/currency and uses the returned order id: https://razorpay.com/docs/api/orders/create/
  - Razorpay Checkout docs require backend signature verification after payment and describe HMAC SHA256 verification using the order id and payment id: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/build-integration/
  - Razorpay webhook docs recommend signature validation for webhook payloads: https://razorpay.com/docs/webhooks/validate-test/
  - Next.js route handler docs support direct response headers for POST route handlers: https://nextjs.org/docs/app/getting-started/route-handlers
- Commands:
  - `sed -n '1,260p' src/app/api/donations/create-order/route.ts`
  - `sed -n '1,260p' src/app/api/donations/verify-payment/route.ts`
  - `sed -n '1,120p' src/app/api/donations/webhook/route.ts`
  - `sed -n '1,260p' src/lib/api/donations.ts`
  - `sed -n '90,180p' src/components/donations/donation-form.tsx`
  - `rg -n "createDonationRecord|updateDonationRecord|getDonationById|getDonationByOrderId|DONATION_SELECT_COLUMNS" src -S`
- Findings:
  - `/api/donations/create-order` returns the full Razorpay order object, but the client uses only `order.id`, `order.amount`, and `order.currency` for Checkout.
  - `/api/donations/create-order` and `/api/donations/verify-payment` lack explicit private no-store response headers.
  - The existing donation data helpers use explicit donation columns; create/update return rows because the payment flow needs a donation DTO and verify needs updated receipt fields.
- Added failing coverage:
  - `src/app/api/donations/create-order/route.test.ts`
  - `src/app/api/donations/verify-payment/route.test.ts`
- Command: `pnpm vitest run src/app/api/donations/create-order/route.test.ts src/app/api/donations/verify-payment/route.test.ts`
- Intended result: failed, 2 files / 2 tests.
- Failures proved both payment routes do not yet emit `Cache-Control: private, no-store`; create-order coverage also requires a compact checkout order payload.

## 2026-05-14 11:53 IST - Public Donation Payment No-Store And Compact Order Implementation

- Updated `src/app/api/donations/create-order/route.ts`.
  - Success and error responses now include `Cache-Control: private, no-store`.
  - Razorpay order responses are mapped to the checkout fields used by the browser: `id`, `amount`, `currency`, and `status`.
- Updated `src/app/api/donations/verify-payment/route.ts`.
  - Success and error responses now include `Cache-Control: private, no-store`.
- Command: `date`
- Result: `2026-05-14 11:53 IST`.
- Command: `pnpm vitest run src/app/api/donations/create-order/route.test.ts src/app/api/donations/verify-payment/route.test.ts`
- Result: passed, 2 files / 2 tests.

## 2026-05-14 11:53 IST - Public Donation Payment Typecheck Gate

- Command: `date`
- Result: `2026-05-14 11:53 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 11:55 IST - Public Donation Payment Full Test Gate

- Command: `date`
- Result: `2026-05-14 11:55 IST`.
- Command: `pnpm test`
- Result: passed, 157 files / 360 tests.

## 2026-05-14 11:56 IST - Public Donation Payment Build And Select Scan

- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/api/donations/create-order` remains a dynamic route handler.
  - `/api/donations/verify-payment` remains a dynamic route handler.
- Command: `date`
- Result: `2026-05-14 11:56 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 11:58 IST - Donation Webhook Egress Analysis And Red Tests

- Command: `date`
- Result: `2026-05-14 11:58 IST`.
- Findings:
  - `/api/donations/webhook` only needs a donation id for a Razorpay order id, but currently calls `getDonationByOrderId()` which selects the full donation DTO.
  - Webhook updates are side-effect-only and currently use `updateDonationRecord()`, which selects the updated donation row even though the webhook ignores it.
  - The webhook route also lacks explicit private no-store headers.
- Added failing coverage:
  - `src/lib/api/donations.test.ts` now requires an id-only order lookup and a no-return update helper.
  - `src/app/api/donations/webhook/route.test.ts` now requires the webhook route to use those narrow helpers and emit private no-store headers.
- Command: `pnpm vitest run src/lib/api/donations.test.ts src/app/api/donations/webhook/route.test.ts`
- Intended result: failed, 2 files / 6 tests.
- Failures proved the narrow donation helpers do not exist yet and the webhook route does not yet emit the private no-store header.

## 2026-05-14 11:59 IST - Donation Webhook Narrow Helper Implementation

- Updated `src/lib/api/donations.ts`.
  - Added `DONATION_ID_SELECT_COLUMNS`.
  - Added `getDonationIdByOrderId()` to select only `id` for webhook order lookups.
  - Added `updateDonationRecordWithoutReturning()` for side-effect-only donation updates.
  - Shared donation update payload construction between returning and no-return update helpers.
- Updated `src/app/api/donations/create-order/route.ts`.
  - Ignored donation updates now use `updateDonationRecordWithoutReturning()`.
- Updated `src/app/api/donations/webhook/route.ts`.
  - The webhook now uses id-only lookup and no-return update helpers.
  - Success and error responses now include `Cache-Control: private, no-store`.
- Command: `date`
- Result: `2026-05-14 11:59 IST`.
- Command: `pnpm vitest run src/lib/api/donations.test.ts src/app/api/donations/create-order/route.test.ts src/app/api/donations/webhook/route.test.ts`
- Result: passed, 3 files / 7 tests.

## 2026-05-14 12:00 IST - Donation Webhook Typecheck Gate

- Command: `pnpm exec tsc --noEmit`
- Initial result: failed on a stale `Parameters<typeof updateDonationRecord>` type reference in `src/app/api/donations/webhook/route.ts`.
- Fix: changed the type reference to `Parameters<typeof updateDonationRecordWithoutReturning>`.
- Command: `date`
- Result: `2026-05-14 12:00 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 12:01 IST - Donation Webhook Full Test Gate

- Command: `date`
- Result: `2026-05-14 12:01 IST`.
- Command: `pnpm test`
- Result: passed, 158 files / 363 tests.

## 2026-05-14 12:02 IST - Donation Webhook Build And Select Scan

- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/api/donations/create-order` remains a dynamic route handler.
  - `/api/donations/verify-payment` remains a dynamic route handler.
  - `/api/donations/webhook` remains a dynamic route handler.
- Command: `date`
- Result: `2026-05-14 12:02 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 12:04 IST - Public Booking Search Endpoint Egress Audit

- Command: `date`
- Result: `2026-05-14 12:04 IST`.
- Web research:
  - Next.js caching docs support `unstable_cache` with `revalidate` and cache tags for database-query helpers: https://nextjs.org/docs/app/building-your-application/data-fetching/caching
  - Next.js CDN caching docs support shared public cache headers for deterministic public metadata endpoints: https://nextjs.org/docs/app/guides/cdn-caching
  - Supabase select/limit docs recommend explicit columns and bounded query scopes for payload control: https://supabase.com/docs/reference/javascript/v1/select
- Commands:
  - `sed -n '1,220p' src/app/api/room-types/preview/route.ts`
  - `sed -n '1,220p' src/app/api/bookings/search-data/route.ts`
  - `sed -n '1,240p' src/app/api/availability/search/route.ts`
  - `sed -n '1,260p' src/lib/server/room-type-preview.ts`
  - `sed -n '1,260p' src/lib/server/booking-search.ts`
  - `sed -n '1,340p' src/lib/server/availability.ts`
- Findings:
  - `/api/room-types/preview` already returns shared-cache headers and uses `unstable_cache`; the helper selects compact candidate/detail/amenity fields and limits the preview to four room types.
  - `/api/bookings/search-data` already returns shared-cache headers and uses `unstable_cache`; the helper selects explicit room type, amenity, rate plan, and closure columns.
  - `/api/availability/search` is explicitly dynamic/no-store and validates date ranges before querying.
  - `searchPublicAvailability()` selects only the fields needed for availability math and narrows reservation lookup by scoped room ids when `roomTypeIds` are supplied.
- Decision: no source change needed.
- Command: `pnpm vitest run src/app/api/room-types/preview/route.test.ts src/lib/server/room-type-preview.test.ts src/app/api/bookings/search-data/route.test.ts src/lib/server/booking-search.test.ts src/app/api/availability/search/route.test.ts src/lib/server/availability.test.ts`
- Result: passed, 6 files / 7 tests.

## 2026-05-14 12:06 IST - App Data Housekeepers And Public Property Analysis

- Command: `date`
- Result: `2026-05-14 12:06 IST`.
- Web research:
  - Next.js route handler docs note route handlers are not cached by default and can use response headers for cache policy: https://nextjs.org/docs/15/app/getting-started/route-handlers-and-middleware
  - Next.js caching docs document `force-cache` for cached fetches and `no-store` for uncached fetches: https://nextjs.org/docs/app/guides/caching
  - Supabase select/filter docs support explicit projection columns and referenced-table filters such as `roles.name`: https://supabase.com/docs/reference/javascript/select and https://supabase.com/docs/client/filter
- Commands:
  - `sed -n '1,220p' src/hooks/use-app-data.ts`
  - `sed -n '1,180p' src/app/api/public/property/route.ts`
  - `sed -n '1,220p' src/app/api/admin/housekeepers/route.ts`
  - `sed -n '1,220p' src/app/api/public/property/route.test.ts`
  - `sed -n '1,220p' src/app/api/admin/housekeepers/route.test.ts`
- Findings:
  - `/api/public/property` already uses `getCachedPublicAppProperty()`, `revalidate = 3600`, public shared-cache headers, and a force-cache client fetch.
  - `/api/admin/housekeepers` already gates on the housekeeping feature, selects `HOUSEKEEPER_PROFILE_SELECT_COLUMNS`, filters by `roles.name`, and orders by name.
  - The admin housekeepers endpoint lacked a private no-store response header despite the client fetching it with `cache: "no-store"`.
- Planned change: keep the existing housekeeper query shape and add a private no-store header to every JSON response from `/api/admin/housekeepers`.

## 2026-05-14 12:07 IST - Admin Housekeepers Red Gate

- Test edit: added an expectation that `/api/admin/housekeepers` returns `Cache-Control: private, no-store`.
- Command: `pnpm vitest run src/app/api/admin/housekeepers/route.test.ts`
- Result: failed as expected, 1 file / 1 test; the header was `null` instead of `private, no-store`.

## 2026-05-14 12:08 IST - Admin Housekeepers Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 12:08 IST`.
- Source change:
  - `src/app/api/admin/housekeepers/route.ts` now routes all JSON responses through `noStoreJson()`.
  - Success, feature-error, Supabase-error, and unexpected-error responses all include `Cache-Control: private, no-store`.
  - The existing explicit `HOUSEKEEPER_PROFILE_SELECT_COLUMNS` projection and `roles.name` filter were left unchanged.
- Command: `pnpm vitest run src/app/api/admin/housekeepers/route.test.ts`
- Result: passed, 1 file / 1 test.

## 2026-05-14 12:09 IST - Admin Housekeepers Full Gates And Select Scan

- Command: `date`
- Result: `2026-05-14 12:09 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 158 files / 363 tests.
- Command: `pnpm build`
- Result: passed; `/api/admin/housekeepers` remains dynamic and `/api/public/property` remains static with 1h revalidation.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 12:12 IST - Admin Upload Command Egress Analysis And Red Gate

- Command: `date`
- Result: `2026-05-14 12:12 IST`.
- Web research:
  - Next.js `NextResponse.json()` supports returning JSON responses with custom init options such as status and headers: https://nextjs.org/docs/app/api-reference/functions/next-response
  - Next.js caching docs document `{ cache: "no-store" }` for uncached fetches: https://nextjs.org/docs/app/guides/caching
  - Supabase Storage upload docs support `cacheControl`, `contentType`, and `upsert` options for stored assets: https://supabase.com/docs/reference/javascript/v1/storage-from-upload
- Commands:
  - `sed -n '1,260p' src/app/api/admin/uploads/route.ts`
  - `sed -n '560,680p' src/lib/api/index.ts`
  - `sed -n '1,220p' src/lib/server/storage.ts`
  - `sed -n '1,220p' src/lib/server/storage.test.ts`
  - `rg -n "uploadFile\\(|api/admin/uploads|UploadResponse" src -S`
- Findings:
  - Stored images already use the shared immutable asset cache control through `uploadToImagesBucket()`.
  - The authenticated upload command response lacked `Cache-Control: private, no-store`.
  - The browser `uploadFile()` helper posted the file without an explicit `cache: "no-store"` option.
- Red test edits:
  - Added `src/app/api/admin/uploads/route.test.ts` covering successful image upload response headers and prefix.
  - Added `src/lib/api/index.test.ts` coverage for `uploadFile()` fetch options.
- Command: `pnpm vitest run src/app/api/admin/uploads/route.test.ts src/lib/api/index.test.ts`
- Result: failed as expected, 2 files / 13 tests; the route header was `null`, and the client fetch options omitted `cache: "no-store"`.

## 2026-05-14 12:13 IST - Admin Upload Command Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 12:13 IST`.
- Source changes:
  - `src/app/api/admin/uploads/route.ts` now routes every JSON response through `noStoreJson()` with `Cache-Control: private, no-store`.
  - `src/lib/api/index.ts` now sends upload commands with `cache: "no-store"`.
  - Stored image asset cache behavior remains unchanged in `uploadToImagesBucket()`.
- Command: `pnpm vitest run src/app/api/admin/uploads/route.test.ts src/lib/api/index.test.ts`
- Result: passed, 2 files / 13 tests.

## 2026-05-14 12:15 IST - Admin Upload Command Full Gates And Select Scan

- Command: `date`
- Result: `2026-05-14 12:15 IST`.
- Command: `pnpm exec tsc --noEmit`
- First result: failed on a test-only cast in `src/lib/api/index.test.ts`.
- Fix: cast the mocked fetch call tuple through `unknown` before asserting the `RequestInit` body.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 159 files / 365 tests.
- Command: `pnpm build`
- Result: passed; `/api/admin/uploads` remains dynamic.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 12:17 IST - Admin Command Routes Egress Analysis And Red Gate

- Command: `date`
- Result: `2026-05-14 12:17 IST`.
- Web research:
  - Next.js route handler docs confirm POST route handlers are request handlers that return Web `Response` objects and are not cached by default: https://nextjs.org/docs/app/getting-started/route-handlers
  - Next.js `revalidateTag` docs support calling `revalidateTag` from route handlers: https://nextjs.org/docs/15/app/api-reference/functions/revalidateTag
  - Next.js `NextResponse.json()` docs support JSON responses with custom status/header init options: https://nextjs.org/docs/app/api-reference/functions/next-response
- Commands:
  - `sed -n '1,220p' src/app/api/admin/activity/log/route.ts`
  - `sed -n '1,200p' src/app/api/admin/reservations/revalidate/route.ts`
  - `sed -n '1,80p' src/lib/reservations/cache-client.ts`
  - `sed -n '1,120p' src/lib/activity/server.ts`
  - `rg -n "admin/activity/log|reservations/revalidate|revalidateReservationsCache|logAdminActivityFromProfile" src -S`
- Findings:
  - `/api/admin/activity/log` performs an authenticated command and delegates to the RPC helper without returning database rows.
  - `/api/admin/reservations/revalidate` performs an authenticated cache invalidation command and the client already sends `cache: "no-store"`.
  - Both command routes lacked explicit `Cache-Control: private, no-store` response headers.
- Red test edits:
  - Added `src/app/api/admin/activity/log/route.test.ts`.
  - Added `src/app/api/admin/reservations/revalidate/route.test.ts`.
- Command: `pnpm vitest run src/app/api/admin/activity/log/route.test.ts src/app/api/admin/reservations/revalidate/route.test.ts`
- Result: failed as expected, 2 files / 2 tests; both response headers were `null` instead of `private, no-store`.

## 2026-05-14 12:18 IST - Admin Command Routes Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 12:18 IST`.
- Source changes:
  - `src/app/api/admin/activity/log/route.ts` now routes success and error JSON through `noStoreJson()`.
  - `src/app/api/admin/reservations/revalidate/route.ts` now routes success and error JSON through `noStoreJson()`.
  - Existing command semantics and client `cache: "no-store"` behavior were preserved.
- Command: `pnpm vitest run src/app/api/admin/activity/log/route.test.ts src/app/api/admin/reservations/revalidate/route.test.ts`
- Result: passed, 2 files / 2 tests.

## 2026-05-14 12:20 IST - Admin Command Routes Full Gates And Select Scan

- Command: `date`
- Result: `2026-05-14 12:20 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 161 files / 367 tests.
- Command: `pnpm build`
- Result: passed; `/api/admin/activity/log` and `/api/admin/reservations/revalidate` remain dynamic.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 12:21 IST - Admin Events API Egress Analysis And Red Gate

- Command: `date`
- Result: `2026-05-14 12:21 IST`.
- Web research:
  - Next.js route handler docs cover POST handlers as Web Request/Response handlers: https://nextjs.org/docs/app/getting-started/route-handlers
  - Next.js `NextResponse.json()` docs support JSON responses with custom status/header init options: https://nextjs.org/docs/app/api-reference/functions/next-response
  - Supabase select docs support explicit column strings for returned mutation rows: https://supabase.com/docs/reference/javascript/select
- Commands:
  - `sed -n '1,260p' src/app/api/admin/events/route.ts`
  - `sed -n '1,80p' src/lib/server/cache-config.ts`
  - `sed -n '200,320p' src/lib/server/events.ts`
  - `sed -n '1,180p' src/components/admin/events/event-form.tsx`
- Findings:
  - `/api/admin/events` is not referenced by the current admin event form, which uses server actions, but the route remains built and callable.
  - The API insert already returns the explicit `EVENT_SELECT_COLUMNS` projection and uses the inserted id for the optional active-banner RPC.
  - The route lacked explicit `Cache-Control: private, no-store` response headers.
- Red test edit: added `src/app/api/admin/events/route.test.ts` covering exact insert columns, optional activation RPC, returned payload, and no-store headers.
- Command: `pnpm vitest run src/app/api/admin/events/route.test.ts`
- Result: failed as expected, 1 file / 1 test; the response header was `null` instead of `private, no-store`.

## 2026-05-14 12:21 IST - Admin Events API Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 12:21 IST`.
- Source change:
  - `src/app/api/admin/events/route.ts` now routes success, auth-error, validation-error, Supabase-error, and unexpected-error JSON through `noStoreJson()`.
  - Existing `EVENT_SELECT_COLUMNS` insert projection and optional `toggle_event_banner` RPC behavior were preserved.
- Command: `pnpm vitest run src/app/api/admin/events/route.test.ts`
- Result: passed, 1 file / 1 test.

## 2026-05-14 12:23 IST - Admin Events API Full Gates And Select Scan

- Command: `date`
- Result: `2026-05-14 12:23 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 162 files / 368 tests.
- Command: `pnpm build`
- Result: passed; `/api/admin/events` remains dynamic.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 12:25 IST - Admin Reservations API Egress Analysis And Red Gate

- Command: `date`
- Result: `2026-05-14 12:25 IST`.
- Web research:
  - Next.js route handler docs cover `NextRequest` query handling and response objects for route handlers: https://nextjs.org/docs/app/getting-started/route-handlers
  - Next.js `unstable_cache` docs support cached database-query helpers with cache tags: https://nextjs.org/docs/15/app/api-reference/functions/unstable_cache
  - Next.js `NextResponse.json()` docs support custom status/header init options: https://nextjs.org/docs/app/api-reference/functions/next-response
- Commands:
  - `sed -n '1,280p' src/app/api/admin/reservations/route.ts`
  - `sed -n '240,285p' src/hooks/use-app-data.ts`
  - `sed -n '120,220p' src/server/reservations/cache.ts`
  - `rg -n "getReservationsPage|/api/admin/reservations\\?|api/testimonials|/api/testimonials|testimonials" src -S`
- Findings:
  - `/api/admin/reservations` already delegates to bounded cached page/count helpers and the client fetches it with `cache: "no-store"`.
  - The success response already had `Cache-Control: private, no-store`.
  - Auth, validation, and unexpected-error responses did not consistently share the no-store header.
  - `/api/testimonials` is an alias of `/api/reviews`; the reviewed public testimonials/reviews implementation and tests already cover its exported handler.
- Red test edit: added `src/app/api/admin/reservations/route.test.ts` covering cached page shape and validation-error cache headers.
- Command: `pnpm vitest run src/app/api/admin/reservations/route.test.ts`
- Result: failed as expected, 1 file / 2 tests; success passed, validation-error response had `null` instead of `private, no-store`.

## 2026-05-14 12:25 IST - Admin Reservations API Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 12:25 IST`.
- Source change:
  - `src/app/api/admin/reservations/route.ts` now routes success, auth-error, validation-error, and unexpected-error JSON through `noStoreJson()`.
  - Existing cached page/count helper usage and bounded query normalization were preserved.
- Command: `pnpm vitest run src/app/api/admin/reservations/route.test.ts`
- Result: passed, 1 file / 2 tests.

## 2026-05-14 12:27 IST - Admin Reservations API Full Gates And Select Scan

- Command: `date`
- Result: `2026-05-14 12:27 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 163 files / 370 tests.
- Command: `pnpm build`
- Result: passed; `/api/admin/reservations` remains dynamic.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 12:28 IST - Testimonials Alias Route Audit

- Command: `date`
- Result: `2026-05-14 12:28 IST`.
- Source review:
  - `src/app/api/testimonials/route.ts` re-exports `GET` from `src/app/api/reviews/route.ts`.
  - The public reviews handler and review data helper were already audited for explicit public DTOs, cache headers, and bounded selects.
- Test edit: added `src/app/api/testimonials/route.test.ts` to lock the alias to the audited reviews handler.
- Command: `pnpm vitest run src/app/api/testimonials/route.test.ts src/app/api/reviews/route.test.ts src/lib/server/reviews.test.ts`
- Result: passed, 3 files / 4 tests.
- Command: `for f in $(find src/app/api -name route.ts | sort); do t=${f%.ts}.test.ts; [ -f "$t" ] || printf '%s\n' "$f"; done`
- Result: no untested `src/app/api/**/route.ts` handlers remain.

## 2026-05-14 12:30 IST - API Route Coverage Full Gates And Select Scan

- Command: `date`
- Result: `2026-05-14 12:30 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 164 files / 371 tests.
- Command: `pnpm build`
- Result: passed.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 12:32 IST - Public Transactional Form Fetch Egress Analysis And Red Gate

- Command: `date`
- Result: `2026-05-14 12:32 IST`.
- Web research:
  - Next.js fetch docs document `cache: "no-store"` for requests that must always fetch from the server: https://nextjs.org/docs/app/api-reference/functions/fetch
  - Next.js caching docs document uncached fetch behavior for `{ cache: "no-store" }`: https://nextjs.org/docs/app/guides/caching
- Commands:
  - `sed -n '90,185p' src/components/donations/donation-form.tsx`
  - `sed -n '90,135p' src/components/feedback/feedback-form.tsx`
  - `rg -n "create-order|verify-payment|/api/feedback|/api/bookings/public|cache: \"no-store\"" src -S`
- Findings:
  - `/api/donations/create-order`, `/api/donations/verify-payment`, and `/api/feedback` routes already return no-store responses.
  - The donation and feedback client form POSTs omitted explicit `cache: "no-store"` on browser fetch calls.
  - `/api/bookings/public` review submission already uses `cache: "no-store"`.
- Red test edits:
  - Updated `src/app/(public)/donate/donate-code-splitting.test.ts` to require no-store on both donation payment POSTs.
  - Updated `src/app/(public)/feedback/feedback-code-splitting.test.ts` to require no-store on feedback submission.
- Command: `pnpm vitest run 'src/app/(public)/donate/donate-code-splitting.test.ts' 'src/app/(public)/feedback/feedback-code-splitting.test.ts'`
- Result: failed as expected, 2 files / 5 tests; donation had zero no-store fetches and feedback had no no-store fetch.

## 2026-05-14 12:33 IST - Public Transactional Form Fetch Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 12:33 IST`.
- Source changes:
  - `src/components/donations/donation-form.tsx` now sends both create-order and verify-payment POSTs with `cache: "no-store"`.
  - `src/components/feedback/feedback-form.tsx` now sends feedback POSTs with `cache: "no-store"`.
- Command: `pnpm vitest run 'src/app/(public)/donate/donate-code-splitting.test.ts' 'src/app/(public)/feedback/feedback-code-splitting.test.ts'`
- Result: passed, 2 files / 5 tests.

## 2026-05-14 12:35 IST - Public Transactional Form Fetch Full Gates And Select Scan

- Command: `date`
- Result: `2026-05-14 12:35 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 164 files / 373 tests.
- Command: `pnpm build`
- Result: passed.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 12:37 IST - Authorized Fetch Default Cache Analysis And Red Gate

- Command: `date`
- Result: `2026-05-14 12:37 IST`.
- Web research:
  - Next.js fetch docs document `no-store` and explicit cache modes on `fetch`: https://nextjs.org/docs/app/api-reference/functions/fetch
  - Next.js caching docs document that `force-cache` remains opt-in per request: https://nextjs.org/docs/app/guides/caching
- Commands:
  - `rg -n "fetch\\(\"/api|fetch\\('/api|authorizedFetch\\(" src/app src/components src/hooks src/lib -S`
  - `rg -n "authorizedFetch\\([^\\n]*(\\{|$)|cache: \\\"force-cache\\\"|cache: \\\"no-store\\\"" src/app src/components src/hooks src/lib -S`
  - `sed -n '1,140p' src/lib/auth/client-session.ts`
- Findings:
  - Most route-specific admin hooks already pass `cache: "no-store"`.
  - Several authenticated admin command/view fetches still call `authorizedFetch()` without an explicit cache option.
  - `authorizedFetch()` is the safer boundary for private authenticated defaults, while preserving explicit `force-cache` callers such as public property hydration.
- Red test edit: added `src/lib/auth/client-session.test.ts` covering default `cache: "no-store"` and explicit cache preservation.
- Command: `pnpm vitest run src/lib/auth/client-session.test.ts`
- Result: failed as expected, 1 file / 2 tests; default authenticated fetch omitted `cache: "no-store"`, explicit `force-cache` passed.

## 2026-05-14 12:38 IST - Authorized Fetch Default Cache Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 12:38 IST`.
- Source change:
  - `src/lib/auth/client-session.ts` now applies `cache: "no-store"` by default for authenticated fetches.
  - Explicit cache modes supplied by callers are preserved, including `cache: "force-cache"`.
  - Retry-on-401 requests use the same cache mode as the original request.
- Command: `pnpm vitest run src/lib/auth/client-session.test.ts`
- Result: passed, 1 file / 2 tests.

## 2026-05-14 12:40 IST - Authorized Fetch Default Cache Full Gates And Select Scan

- Command: `date`
- Result: `2026-05-14 12:40 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 165 files / 375 tests.
- Command: `pnpm build`
- Result: passed.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 12:40 IST - Continuation Audit Snapshot

- Command: `date`
- Result: `2026-05-14 12:40 IST`.
- Command: `for f in $(find src/app/api -name route.ts | sort); do t=${f%.ts}.test.ts; [ -f "$t" ] || printf '%s\n' "$f"; done`
- Result: no untested `src/app/api/**/route.ts` handlers remain.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.
- Command: `rg -n "fetch\\(\"/api|fetch\\('/api|authorizedFetch\\(" src/app src/components src/hooks src/lib -S`
- Result:
  - Authenticated API calls now go through `authorizedFetch()`, which defaults to `cache: "no-store"` and preserves explicit `force-cache`.
  - Public transactional POSTs audited in this continuation now pass explicit `cache: "no-store"`.
  - Remaining public GET fetches are cacheable metadata/content reads with route-level public cache headers, or already-audited no-store search/booking POSTs.

## 2026-05-14 12:43 IST - Direct Room Mutation Analysis And Research

- Command: `date`
- Result: `2026-05-14 12:43 IST`.
- Web research:
  - Supabase JavaScript docs confirm `.insert()`, `.update()`, `.upsert()`, and `.delete()` do not return modified rows by default, and only return data when `.select()` is chained: https://supabase.com/docs/reference/javascript/db-modifiers-select
  - Supabase upgrade docs show update-without-return as the default shape and update-with-return only after chaining `.select()`: https://supabase.com/docs/reference/javascript/upgrade-guide
- Commands:
  - `rg -n "export const (add|create|update|delete|set|assign|unassign|mark|toggle)|\\.insert\\(|\\.update\\(|\\.upsert\\(|\\.delete\\(|\\.rpc\\(" src/lib/api/index.ts src/context/data-context.tsx src/hooks/use-app-data.ts -S`
  - `rg -n "api\\.|addGuest|updateGuest|addRoom|updateRoom|addRoomCategory|updateRoomCategory|addRatePlan|updateRatePlan|addSeasonalPrice|updateSeasonalPrice|addAmenity|updateAmenity|addRole|updateRole|updateProperty|createProperty|updateUserProfile|addStickyNote|updateStickyNote|addPropertyClosure|updatePropertyClosure|upsertRoomType|createReservationsWithTotal|updateReservation|updateBookingReservationsStatus|addFolioItem" src/context/data-context.tsx src/app src/components src/hooks -S`
  - `sed -n '1080,1165p' src/hooks/use-app-data.ts`
  - `sed -n '1160,1220p' src/lib/api/index.ts`
- Findings:
  - `src/lib/api/index.ts` still has several browser Supabase mutation helpers that chain `.select(...).single()` to return updated rows.
  - The safest first target is `updateRoom`, because current room and housekeeping call sites pass the existing room to `useAppData().updateRoom()`.
  - `useAppData().updateRoom()` still calls row-returning `api.updateRoom()` unconditionally and then replaces local state with the returned row.
- Planned red coverage:
  - Add a `src/lib/api/index.test.ts` assertion for a no-return room update helper with no `.select()` or `.single()`.
  - Add a `src/hooks/use-app-data.load-plan.test.tsx` assertion that `updateRoom()` uses the no-return helper and merges supplied existing room data locally when possible.

## 2026-05-14 12:46 IST - Direct Room Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 12:46 IST`.
- Test edits:
  - `src/lib/api/index.test.ts` now expects `updateRoomWithoutReturning()` to update the `rooms` table without chaining `.select()` or `.single()`.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects `useAppData().updateRoom()` to call the no-return helper when an existing room is supplied, avoid legacy `api.updateRoom()`, and log the merged updated room label.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 files / 39 tests; `updateRoomWithoutReturning` does not exist yet and the hook still does not call the no-return path.

## 2026-05-14 12:47 IST - Direct Room Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 12:47 IST`.
- Source changes:
  - Added `updateRoomWithoutReturning()` in `src/lib/api/index.ts`, using Supabase `update(...).eq(...)` without chaining `.select()` or `.single()`.
  - Updated `useAppData().updateRoom()` to call the no-return helper when an existing room is available, merge the patch into that room for local state/activity logging, and keep the legacy row-returning `api.updateRoom()` fallback when no previous room is known.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 39 tests.

## 2026-05-14 12:48 IST - Direct Room Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 12:48 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 12:48 IST - Direct Room Mutation Full Test

- Command: `date`
- Result: `2026-05-14 12:48 IST`.
- Command: `pnpm test`
- Result: passed, 165 files / 377 tests.

## 2026-05-14 12:49 IST - Direct Room Mutation Build

- Command: `date`
- Result: `2026-05-14 12:49 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 12:50 IST - Direct Room Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 12:50 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 12:52 IST - Direct Rate Plan Mutation Analysis

- Command: `date`
- Result: `2026-05-14 12:52 IST`.
- Research basis:
  - The same current Supabase JavaScript docs from the room pass apply here: mutation helpers avoid returned-row egress by omitting `.select()`.
- Commands:
  - `sed -n '1230,1285p' src/hooks/use-app-data.ts`
  - `sed -n '1,100p' src/app/admin/rates/components/rate-plan-form-dialog.tsx`
  - `sed -n '1260,1325p' src/lib/api/index.ts`
  - `rg -n "updateRatePlan\\(" src/app src/components src/hooks -S`
- Findings:
  - `RatePlanFormDialog` passes the existing rate plan to `useAppData().updateRatePlan()`.
  - `useAppData().updateRatePlan()` still calls row-returning `api.updateRatePlan()` unconditionally.
  - `src/lib/api/index.ts` currently chains `.select(RATE_PLAN_SELECT_COLUMNS).single()` for every rate-plan update.
- Planned red coverage:
  - Add an API helper test for a no-return rate-plan update command.
  - Add a hook test proving `updateRatePlan()` uses the no-return helper and logs the merged updated label when an existing rate plan is supplied.

## 2026-05-14 12:53 IST - Direct Rate Plan Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 12:53 IST`.
- Test edits:
  - `src/lib/api/index.test.ts` now expects `updateRatePlanWithoutReturning()` to update `rate_plans` without `.select()` or `.single()`.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects `useAppData().updateRatePlan()` to use that no-return helper when an existing rate plan is supplied and to log the merged updated label.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 files / 41 tests; the no-return rate-plan helper does not exist and the hook still uses the row-returning helper.

## 2026-05-14 12:54 IST - Direct Rate Plan Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 12:54 IST`.
- Source changes:
  - Added `updateRatePlanWithoutReturning()` in `src/lib/api/index.ts`, using Supabase `update(...).eq(...)` without `.select()` or `.single()`.
  - Updated `useAppData().updateRatePlan()` to call the no-return helper when an existing rate plan is known, merge the patch locally for state/activity logging, and keep the row-returning fallback when no previous rate plan is available.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 41 tests.

## 2026-05-14 12:55 IST - Direct Rate Plan Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 12:55 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 12:55 IST - Direct Rate Plan Mutation Full Test

- Command: `date`
- Result: `2026-05-14 12:55 IST`.
- Command: `pnpm test`
- Result: passed, 165 files / 379 tests.

## 2026-05-14 12:56 IST - Direct Rate Plan Mutation Build

- Command: `date`
- Result: `2026-05-14 12:56 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 12:57 IST - Direct Rate Plan Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 12:57 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 12:57 IST - Direct Seasonal Price Mutation Analysis

- Command: `date`
- Result: `2026-05-14 12:57 IST`.
- Research basis:
  - The current Supabase JavaScript mutation docs from the direct mutation pass apply: omitting `.select()` avoids returning modified rows.
- Commands:
  - `rg -n "updateSeasonalPrice" src/context/data-context.tsx src/hooks/use-app-data.ts src/app/admin/rates/components/seasonal-price-form-dialog.tsx src/lib/api/index.ts -S`
  - `sed -n '1,115p' src/app/admin/rates/components/seasonal-price-form-dialog.tsx`
  - `sed -n '1320,1385p' src/hooks/use-app-data.ts`
  - `sed -n '1300,1335p' src/lib/api/index.ts`
- Findings:
  - `SeasonalPriceFormDialog` has the existing `seasonalPrice` prop but does not pass it into `updateSeasonalPrice()`.
  - `useAppData().updateSeasonalPrice()` has no existing-record parameter and always calls row-returning `api.updateSeasonalPrice()`.
  - The API update helper maps camelCase fields to database column names and then chains `.select(SEASONAL_PRICE_SELECT_COLUMNS).single()`.
- Planned red coverage:
  - Add an API helper test for a no-return seasonal-price update with camelCase-to-database payload mapping.
  - Add a hook test proving `updateSeasonalPrice()` uses that helper when an existing seasonal price is supplied and logs the merged updated label.

## 2026-05-14 12:58 IST - Direct Seasonal Price Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 12:58 IST`.
- Test edits:
  - `src/lib/api/index.test.ts` now expects `updateSeasonalPriceWithoutReturning()` to update `seasonal_prices` without `.select()`/`.single()` while preserving snake_case database payload mapping.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects `useAppData().updateSeasonalPrice()` to use that no-return helper when an existing seasonal price is supplied and to log the merged updated label.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 files / 43 tests; the no-return seasonal-price helper does not exist and the hook still calls the row-returning helper.

## 2026-05-14 12:59 IST - Direct Seasonal Price Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 12:59 IST`.
- Source changes:
  - Added `updateSeasonalPriceWithoutReturning()` in `src/lib/api/index.ts`, reusing `toDbSeasonalPrice()` and omitting `.select()`/`.single()`.
  - Updated `useAppData().updateSeasonalPrice()` to use the no-return helper and merge locally when an existing seasonal price is known, with the row-returning fallback preserved.
  - Updated `DataContextType` and `SeasonalPriceFormDialog` so edit submissions pass the existing seasonal price through.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 43 tests.

## 2026-05-14 13:00 IST - Direct Seasonal Price Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 13:00 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 13:00 IST - Direct Seasonal Price Mutation Full Test

- Command: `date`
- Result: `2026-05-14 13:00 IST`.
- Command: `pnpm test`
- Result: passed, 165 files / 381 tests.

## 2026-05-14 13:01 IST - Direct Seasonal Price Mutation Build

- Command: `date`
- Result: `2026-05-14 13:01 IST`.
- Command: `pnpm build`
- Result: passed.
- Observation: build emitted Node's experimental type-stripping warning, but completed successfully.

## 2026-05-14 13:02 IST - Direct Seasonal Price Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 13:02 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 13:03 IST - Direct Room Category Mutation Analysis

- Command: `date`
- Result: `2026-05-14 13:03 IST`.
- Web research:
  - Supabase JavaScript docs confirm mutation calls do not return modified rows unless `.select()` is chained: https://supabase.com/docs/reference/javascript/db-modifiers-select
- Commands:
  - `sed -n '1185,1228p' src/hooks/use-app-data.ts`
  - `sed -n '1,95p' src/app/admin/room-categories/components/room-category-form-dialog.tsx`
  - `sed -n '1220,1248p' src/lib/api/index.ts`
  - `rg -n "updateRoomCategory\\(" src/app src/components src/hooks src/context -S`
- Findings:
  - `RoomCategoryFormDialog` receives the existing `roomCategory`, but currently calls `updateRoomCategory(id, patch)` without passing it through.
  - `useAppData().updateRoomCategory()` can find a previous category in local state, but still always calls row-returning `api.updateRoomCategory()`.
  - `src/lib/api/index.ts` chains `.select(ROOM_CATEGORY_SELECT_COLUMNS).single()` for every room-category update.
- Planned red coverage:
  - Add an API helper test for a no-return room-category update command.
  - Add a hook test proving the existing-category path avoids `api.updateRoomCategory()` and logs the merged updated label.

## 2026-05-14 13:04 IST - Direct Room Category Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 13:04 IST`.
- Test edits:
  - `src/lib/api/index.test.ts` now expects `updateRoomCategoryWithoutReturning()` to update `room_categories` without `.select()` or `.single()`.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects `useAppData().updateRoomCategory()` to call the no-return helper when an existing category is supplied and to log the merged updated label.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 files / 45 tests; the no-return room-category helper does not exist and the hook still uses the row-returning helper.

## 2026-05-14 13:05 IST - Direct Room Category Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 13:05 IST`.
- Source changes:
  - Added `updateRoomCategoryWithoutReturning()` in `src/lib/api/index.ts`, using `update(...).eq(...)` without `.select()` or `.single()`.
  - Updated `useAppData().updateRoomCategory()` to use the no-return helper when a previous category is known, merge locally for state/activity logging, and keep the row-returning fallback when no previous category is known.
  - Updated `DataContextType` and `RoomCategoryFormDialog` so edit submissions pass the existing category through.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 45 tests.

## 2026-05-14 13:06 IST - Direct Room Category Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 13:06 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 13:06 IST - Direct Room Category Mutation Full Test

- Command: `date`
- Result: `2026-05-14 13:06 IST`.
- Command: `pnpm test`
- Result: passed, 165 files / 383 tests.

## 2026-05-14 13:07 IST - Direct Room Category Mutation Build

- Command: `date`
- Result: `2026-05-14 13:07 IST`.
- Command: `pnpm build`
- Result: passed.
- Observation: build emitted Node's experimental type-stripping warning, but completed successfully.

## 2026-05-14 13:07 IST - Direct Room Category Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 13:07 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 13:08 IST - Direct Role Mutation Analysis

- Command: `date`
- Result: `2026-05-14 13:08 IST`.
- Web research:
  - Supabase JavaScript docs confirm `.update()` does not return modified rows unless `.select()` is chained: https://supabase.com/docs/reference/javascript/db-modifiers-select
- Commands:
  - `rg -n "updateRole|toDbRolePayload|RoleForm" src/hooks/use-app-data.ts src/lib/api/index.ts src/context/data-context.tsx src/app/admin/settings/components/role-form-dialog.tsx -S`
  - `sed -n '1,145p' src/app/admin/settings/components/role-form-dialog.tsx`
  - `sed -n '1508,1532p' src/hooks/use-app-data.ts`
  - `sed -n '288,305p' src/lib/api/index.ts`
- Findings:
  - `RoleFormDialog` receives the existing `role`, but calls `updateRole(id, patch)` without passing that role through.
  - `useAppData().updateRole()` can only fall back to `roles.find(...)` and always calls row-returning `api.updateRole()`.
  - `api.updateRole()` maps `hierarchyLevel` to `hierarchy_level`, then chains `.select(ROLE_SELECT_COLUMNS).single()`.
- Planned red coverage:
  - Add an API helper test for a no-return role update that preserves `hierarchyLevel` to `hierarchy_level` mapping.
  - Add a hook test proving the existing-role path avoids `api.updateRole()` and logs the merged updated role label.

## 2026-05-14 13:09 IST - Direct Role Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 13:09 IST`.
- Test edits:
  - `src/lib/api/index.test.ts` now expects `updateRoleWithoutReturning()` to update `roles` without `.select()`/`.single()` while preserving `hierarchyLevel` to `hierarchy_level` mapping.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects `useAppData().updateRole()` to call that no-return helper when an existing role is supplied and to log the merged updated role label.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 files / 47 tests; the no-return role helper does not exist and the hook still uses the row-returning helper.

## 2026-05-14 13:10 IST - Direct Role Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 13:10 IST`.
- Source changes:
  - Added `updateRoleWithoutReturning()` in `src/lib/api/index.ts`, reusing `toDbRolePayload()` and omitting `.select()`/`.single()`.
  - Updated `useAppData().updateRole()` to use the no-return helper when a previous role is known, merge locally for state/activity logging, and keep the row-returning fallback when no previous role is known.
  - Updated `DataContextType` and `RoleFormDialog` so edit submissions pass the existing role through.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 47 tests.

## 2026-05-14 13:11 IST - Direct Role Mutation Typecheck Fix

- Command: `date`
- Result: `2026-05-14 13:11 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: failed on test fixture permissions only; `read:rooms` and `update:rooms` are not valid `Permission` literals and should be singular `read:room` / `update:room`.
- Fix: corrected role test fixtures in `src/lib/api/index.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx` to valid permission literals.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 47 tests.

## 2026-05-14 13:12 IST - Direct Role Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 13:12 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 13:13 IST - Direct Role Mutation Full Test

- Command: `date`
- Result: `2026-05-14 13:13 IST`.
- Command: `pnpm test`
- Result: passed, 165 files / 385 tests.

## 2026-05-14 13:15 IST - Direct Role Mutation Build

- Command: `date`
- Result: `2026-05-14 13:15 IST`.
- Command: `pnpm build`
- Result: passed.
- Observation: build emitted Node's experimental type-stripping warning, but completed successfully.

## 2026-05-14 13:16 IST - Direct Role Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 13:16 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in the audited paths.

## 2026-05-14 13:16 IST - Direct Amenity Mutation Analysis

- Command: `date`
- Result: `2026-05-14 13:16 IST`.
- Web research:
  - Supabase JavaScript docs confirm mutation calls do not return modified rows unless `.select()` is chained: https://supabase.com/docs/reference/javascript/db-modifiers-select
- Commands:
  - `rg -n "updateAmenity|AmenityForm|amenity-form" src/hooks/use-app-data.ts src/lib/api/index.ts src/context/data-context.tsx src/app/admin/settings/components/amenity-form-dialog.tsx -S`
  - `sed -n '1,105p' src/app/admin/settings/components/amenity-form-dialog.tsx`
  - `sed -n '1648,1674p' src/hooks/use-app-data.ts`
  - `sed -n '1364,1372p' src/lib/api/index.ts`
- Findings:
  - `AmenityFormDialog` receives the existing `amenity`, but currently calls `updateAmenity(id, patch)` without passing it through.
  - `useAppData().updateAmenity()` can only fall back to local state and always calls row-returning `api.updateAmenity()`.
  - `api.updateAmenity()` chains `.select(AMENITY_SELECT_COLUMNS).single()` for every amenity update.
- Planned red coverage:
  - Add an API helper test for a no-return amenity update.
  - Add a hook test proving the existing-amenity path avoids `api.updateAmenity()` and logs the merged updated amenity label.

## 2026-05-14 13:18 IST - Direct Amenity Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 13:18 IST`.
- Test edits:
  - `src/lib/api/index.test.ts` now expects `updateAmenityWithoutReturning()` to update `amenities` without `.select()` or `.single()`.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects `useAppData().updateAmenity()` to call that no-return helper when an existing amenity is supplied and to log the merged updated amenity label.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 files / 49 tests; the no-return amenity helper does not exist and the hook still uses the row-returning helper.

## 2026-05-14 13:19 IST - Direct Amenity Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 13:19 IST`.
- Source changes:
  - Added `updateAmenityWithoutReturning()` in `src/lib/api/index.ts`, using `update(...).eq(...)` without `.select()`/`.single()`.
  - Updated `useAppData().updateAmenity()` to use the no-return helper when a previous amenity is known, merge locally for state/activity logging, and keep the row-returning fallback when no previous amenity is known.
  - Updated `DataContextType` and `AmenityFormDialog` so edit submissions pass the existing amenity through.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 49 tests.

## 2026-05-14 13:20 IST - Direct Amenity Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 13:20 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 13:22 IST - Direct Amenity Mutation Full Test

- Command: `date`
- Result: `2026-05-14 13:22 IST`.
- Command: `pnpm test`
- Result: passed, 165 files / 387 tests.

## 2026-05-14 13:23 IST - Direct Amenity Mutation Build

- Command: `date`
- Result: `2026-05-14 13:23 IST`.
- Command: `pnpm build`
- Result: passed. Build emitted the existing Node experimental type-stripping warning.

## 2026-05-14 13:23 IST - Direct Amenity Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 13:23 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 13:25 IST - Direct Sticky Note Mutation Analysis

- Command: `date`
- Result: `2026-05-14 13:25 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained.
- Findings:
  - `api.updateStickyNote()` currently updates `sticky_notes` and chains `.select(STICKY_NOTE_SELECT_COLUMNS).single()`, returning the full note after every edit.
  - `useAppData().updateStickyNote()` already computes the previous note from local `stickyNotes`, and `StickyNoteFormDialog` has the edited `note` object available.
  - The direct update payload contains only note fields (`title`, `description`, `color`), so a no-return update can safely merge with the existing note locally while preserving the existing row-returning fallback.
- Next step: add red coverage for a no-return sticky note helper and the hook/dialog path using the existing note.

## 2026-05-14 13:26 IST - Direct Sticky Note Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 13:26 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 focused failures:
  - `updateStickyNoteWithoutReturning is not a function`.
  - `updateStickyNoteWithoutReturning` was not called by `useAppData().updateStickyNote()` when an existing note is available.

## 2026-05-14 13:27 IST - Direct Sticky Note Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 13:27 IST`.
- Source changes:
  - Added `updateStickyNoteWithoutReturning()` in `src/lib/api/index.ts`, using `update(...).eq(...)` without `.select()`/`.single()`.
  - Updated `useAppData().updateStickyNote()` to use the no-return helper when a previous note is known, merge locally for state/activity logging, and preserve the row-returning fallback.
  - Updated `DataContextType` and `StickyNoteFormDialog` so edit submissions pass the existing note through.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 51 tests.

## 2026-05-14 13:27 IST - Direct Sticky Note Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 13:27 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 13:29 IST - Direct Sticky Note Mutation Full Test

- Command: `date`
- Result: `2026-05-14 13:29 IST`.
- Command: `pnpm test`
- Result: passed, 165 files / 389 tests.

## 2026-05-14 13:30 IST - Direct Sticky Note Mutation Build

- Command: `date`
- Result: `2026-05-14 13:30 IST`.
- Command: `pnpm build`
- Result: passed. Build emitted the existing Node experimental type-stripping warning.

## 2026-05-14 13:30 IST - Direct Sticky Note Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 13:30 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 13:31 IST - Direct Property Closure Mutation Analysis

- Command: `date`
- Result: `2026-05-14 13:31 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained.
- Findings:
  - `api.updatePropertyClosure()` updates `property_closures`, maps camelCase fields to DB columns, and chains `.select(PROPERTY_CLOSURE_SELECT_COLUMNS).single()`.
  - `PropertyClosureFormDialog` has the edited `closure` object available and the settings section reloads its closure table through `onSaved`, so the immediate returned row is not needed for that UI path.
  - `useAppData().updatePropertyClosure()` can merge `existingClosure + updatedData` locally for state/activity logging and keep the existing row-returning fallback when no prior closure is available.
- Next step: add red coverage for a no-return property-closure helper and an existing-closure hook update.

## 2026-05-14 13:32 IST - Direct Property Closure Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 13:32 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 focused failures:
  - `updatePropertyClosureWithoutReturning is not a function`.
  - `updatePropertyClosureWithoutReturning` was not called by `useAppData().updatePropertyClosure()` when an existing closure is available.

## 2026-05-14 13:33 IST - Direct Property Closure Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 13:33 IST`.
- Source changes:
  - Added `updatePropertyClosureWithoutReturning()` in `src/lib/api/index.ts`, preserving `toDbPropertyClosure()` mapping while avoiding `.select()`/`.single()`.
  - Updated `useAppData().updatePropertyClosure()` to use the no-return helper when a previous closure is known, merge locally for state/activity logging, and preserve the row-returning fallback.
  - Updated `DataContextType` and `PropertyClosureFormDialog` so edit submissions pass the existing closure through.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 53 tests.

## 2026-05-14 13:33 IST - Direct Property Closure Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 13:33 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 13:35 IST - Direct Property Closure Mutation Full Test

- Command: `date`
- Result: `2026-05-14 13:35 IST`.
- Command: `pnpm test`
- Result: passed, 165 files / 391 tests.

## 2026-05-14 13:36 IST - Direct Property Closure Mutation Build

- Command: `date`
- Result: `2026-05-14 13:36 IST`.
- Command: `pnpm build`
- Result: passed. Build emitted the existing Node experimental type-stripping warning.

## 2026-05-14 13:36 IST - Direct Property Closure Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 13:36 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 13:37 IST - Direct Property Mutation Analysis

- Command: `date`
- Result: `2026-05-14 13:37 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained.
- Findings:
  - `api.updateProperty()` currently updates `properties` and chains `.select(PROPERTY_SELECT_COLUMNS).single()`, returning the whole property row after every settings edit.
  - `useAppData().updateProperty()` already has the current property in state and can merge `property + updatedData` locally for existing properties.
  - The create path still needs `api.createProperty()` to return the inserted row, so this pass should only optimize updates when `property.id !== "default-property-id"`.
- Next step: add red coverage for a no-return property update helper and the existing-property hook path.

## 2026-05-14 13:39 IST - Direct Property Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 13:39 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 focused failures:
  - `updatePropertyWithoutReturning is not a function`.
  - `updatePropertyWithoutReturning` was not called by `useAppData().updateProperty()` for an existing property.

## 2026-05-14 13:40 IST - Direct Property Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 13:40 IST`.
- Source changes:
  - Added `updatePropertyWithoutReturning()` in `src/lib/api/index.ts`, using `update(...).eq(...)` without `.select()`/`.single()`.
  - Updated `useAppData().updateProperty()` to use the no-return helper for existing properties, merge locally for state/activity logging, and preserve the returned-row create path for default/new properties.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 55 tests.

## 2026-05-14 13:40 IST - Direct Property Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 13:40 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 13:41 IST - Direct Property Mutation Full Test

- Command: `date`
- Result: `2026-05-14 13:41 IST`.
- Command: `pnpm test`
- Result: passed, 165 files / 393 tests.

## 2026-05-14 13:43 IST - Direct Property Mutation Build

- Command: `date`
- Result: `2026-05-14 13:43 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 13:43 IST - Direct Property Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 13:43 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 13:44 IST - Direct Guest Mutation Analysis

- Command: `date`
- Result: `2026-05-14 13:44 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained.
- Findings:
  - `api.updateGuest()` maps guest fields with `toDbGuest()`, updates `guests`, and chains `.select(GUEST_SELECT_COLUMNS).single()`.
  - `GuestFormDialog` has the edited `guest` object available, and already builds a local `updatedGuest` for `onGuestSaved`.
  - `useAppData().updateGuest()` can accept an optional existing guest, merge locally for state/activity logging, and keep the row-returning fallback for callers without a previous guest.
- Next step: add red coverage for a no-return guest helper and the guest edit path using the existing guest.

## 2026-05-14 13:45 IST - Direct Guest Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 13:45 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 focused failures:
  - `updateGuestWithoutReturning is not a function`.
  - `updateGuestWithoutReturning` was not called by `useAppData().updateGuest()` when an existing guest is available.

## 2026-05-14 13:47 IST - Direct Guest Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 13:47 IST`.
- Source changes:
  - Added `updateGuestWithoutReturning()` in `src/lib/api/index.ts`, preserving `toDbGuest()` field mapping while avoiding `.select()`/`.single()`.
  - Updated `useAppData().updateGuest()` to use the no-return helper when a previous guest is known, merge locally for state/activity logging, and preserve the row-returning fallback.
  - Updated `DataContextType` and `GuestFormDialog` so edit submissions pass the existing guest through.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 57 tests.

## 2026-05-14 13:47 IST - Direct Guest Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 13:47 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 13:49 IST - Direct Guest Mutation Full Test

- Command: `date`
- Result: `2026-05-14 13:49 IST`.
- Command: `pnpm test`
- Result: passed, 165 files / 395 tests.

## 2026-05-14 13:50 IST - Direct Guest Mutation Build

- Command: `date`
- Result: `2026-05-14 13:50 IST`.
- Command: `pnpm build`
- Result: passed. Build emitted the existing Node experimental type-stripping warning.

## 2026-05-14 13:51 IST - Direct Guest Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 13:51 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 13:52 IST - Direct User Profile Mutation Analysis

- Command: `date`
- Result: `2026-05-14 13:52 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained.
- Findings:
  - `api.updateUserProfile()` maps `roleId` to `role_id`, updates `profiles`, and chains `.select(PROFILE_SELECT_COLUMNS).single()`.
  - `UserFormDialog` has the edited `user` object available and refetches users after save, so the immediate returned profile row is not needed for that UI path.
  - `useAppData().updateUser()` can accept an optional existing user, merge `name`/`roleId` locally for activity/state, and keep the row-returning fallback for callers without a previous user.
- Next step: add red coverage for a no-return profile helper and the existing-user hook path.

## 2026-05-14 13:54 IST - Direct User Profile Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 13:54 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 focused failures:
  - `updateUserProfileWithoutReturning is not a function`.
  - `updateUserProfileWithoutReturning` was not called by `useAppData().updateUser()` when an existing user is available.

## 2026-05-14 13:55 IST - Direct User Profile Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 13:55 IST`.
- Source changes:
  - Added `toDbUserProfilePayload()` and `updateUserProfileWithoutReturning()` in `src/lib/api/index.ts`, preserving `roleId` to `role_id` mapping while avoiding `.select()`/`.single()`.
  - Updated `useAppData().updateUser()` to use the no-return helper when a previous user is known, merge locally for state/activity logging, and preserve the row-returning fallback.
  - Updated `DataContextType` and `UserFormDialog` so edit submissions pass the existing user through and await the update before refetching users.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 59 tests.

## 2026-05-14 13:56 IST - Direct User Profile Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 13:56 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 13:58 IST - Direct User Profile Mutation Full Test

- Command: `date`
- Result: `2026-05-14 13:58 IST`.
- Command: `pnpm test`
- Result: passed, 165 files / 397 tests.

## 2026-05-14 13:59 IST - Direct User Profile Mutation Build

- Command: `date`
- Result: `2026-05-14 13:59 IST`.
- Command: `pnpm build`
- Result: passed. Build emitted the existing Node experimental type-stripping warning.

## 2026-05-14 14:00 IST - Direct User Profile Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 14:00 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 14:01 IST - Direct Reservation Mutation Analysis

- Command: `date`
- Result: `2026-05-14 14:01 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained.
- Findings:
  - `api.updateReservation()` maps app reservation fields to reservation columns, updates `reservations`, and chains `.select(RESERVATION_SELECT_COLUMNS).single()`, which returns joined guest and folio payloads.
  - `applyRoomOccupancyAssignments()` only needs to persist numeric guest-count fields after a reservation-create RPC has already returned the rows, so it can merge those numeric fields locally and preserve `folio`.
  - `useAppData().updateReservation()` can avoid the returned row when a matching reservation already exists in `reservations` or `activeBookingReservations`, merge only defined update fields locally to avoid treating `undefined` as a database change, and keep the row-returning fallback for cold callers.
- Next step: add red coverage for a no-return reservation helper plus the known-reservation hook and occupancy assignment paths.

## 2026-05-14 14:05 IST - Direct Reservation Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 14:05 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 3 focused failures:
  - `updateReservationWithoutReturning is not a function`.
  - Known active booking edits did not call `updateReservationWithoutReturning()`.
  - Create-time room occupancy normalization did not call `updateReservationWithoutReturning()`.

## 2026-05-14 14:07 IST - Direct Reservation Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 14:07 IST`.
- Source changes:
  - Added `updateReservationWithoutReturning()` in `src/lib/api/index.ts`, preserving `Reservation` to DB column mapping while avoiding `.select()`/`.single()`.
  - Added reservation merge helpers in `src/hooks/use-app-data.ts` that ignore `undefined` update fields, preserving local values that the DB mutation also leaves unchanged.
  - Updated create-time room occupancy normalization to persist numeric occupancy changes without returning reservation rows.
  - Updated `useAppData().updateReservation()` to use the no-return helper when a matching reservation exists in local or active booking state, update those local lists, and keep the row-returning fallback for cold callers.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 62 tests.

## 2026-05-14 14:07 IST - Direct Reservation Mutation Typecheck Repair

- Command: `date`
- Result: `2026-05-14 14:07 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: failed on `src/hooks/use-app-data.load-plan.test.tsx` because the mocked `createReservationsWithTotal()` default response inferred `data` as `never[]`, rejecting the new reservation fixtures.
- Repair: widened the test mock response type to `Reservation[]`.

## 2026-05-14 14:08 IST - Direct Reservation Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 14:08 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 14:10 IST - Direct Reservation Mutation Full Test

- Command: `date`
- Result: `2026-05-14 14:10 IST`.
- Command: `pnpm test`
- Result: passed, 165 files / 400 tests.

## 2026-05-14 14:11 IST - Direct Reservation Mutation Build

- Command: `date`
- Result: `2026-05-14 14:11 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 14:11 IST - Direct Reservation Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 14:11 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 14:11 IST - Direct Blog Mutation Analysis

- Command: `date`
- Result: `2026-05-14 14:11 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained.
- Findings:
  - `api.updateCategory()` updates `categories` and chains `.select(CATEGORY_SELECT_COLUMNS).single()`. `CategoriesManager` already has the edited category state and refreshes the route after saving, so it can persist without returning a row and merge defined fields locally.
  - `api.updatePost()` updates `posts`, returns `POST_SELECT_COLUMNS`, then syncs `post_categories`. `PostForm` ignores the returned post and immediately navigates/refreshes after edit, so the post update can avoid returning a row while keeping category sync.
  - Create helpers still need returned rows for generated IDs or immediate local insertion, so this pass is scoped to update helpers only.
- Next step: add red coverage for no-return category/post helpers and static callsite coverage for the blog edit components.

## 2026-05-14 14:13 IST - Direct Blog Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 14:13 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/components/admin/posts/blog-mutation-egress.test.ts`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/components/admin/posts/blog-mutation-egress.test.ts`
- Result: failed as expected, 4 focused failures:
  - `updateCategoryWithoutReturning` is not exported.
  - `updatePostWithoutReturning` is not exported.
  - `CategoriesManager` still calls `updateCategory()`.
  - `PostForm` still calls `updatePost()`.

## 2026-05-14 14:15 IST - Direct Blog Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 14:15 IST`.
- Source changes:
  - Added `toDbCategoryUpdatePayload()` and `updateCategoryWithoutReturning()` in `src/lib/api/index.ts`.
  - Added shared post update/category-sync helpers plus `updatePostWithoutReturning()` in `src/lib/api/index.ts`, preserving existing category sync behavior while avoiding the returned post row.
  - Updated `CategoriesManager` to call the no-return category helper and merge defined fields locally before route refresh.
  - Updated `PostForm` to call the no-return post helper on edit; create still uses `createPost()` because it needs the inserted post row.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/components/admin/posts/blog-mutation-egress.test.ts`
- Result: passed, 2 files / 28 tests.

## 2026-05-14 14:15 IST - Direct Blog Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 14:15 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 14:17 IST - Direct Blog Mutation Full Test

- Command: `date`
- Result: `2026-05-14 14:17 IST`.
- Command: `pnpm test`
- Result: passed, 166 files / 404 tests.

## 2026-05-14 14:18 IST - Direct Blog Mutation Build

- Command: `date`
- Result: `2026-05-14 14:18 IST`.
- Command: `pnpm build`
- Result: passed. Build emitted the existing Node experimental type-stripping warning.

## 2026-05-14 14:18 IST - Direct Blog Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 14:18 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 14:19 IST - Direct Booking Status Mutation Analysis

- Command: `date`
- Result: `2026-05-14 14:19 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained.
- Findings:
  - `api.updateBookingReservationsStatus()` updates all rows for a booking and chains `.select(RESERVATION_SELECT_COLUMNS)`, returning joined reservation/guest/folio rows.
  - `useAppData().updateBookingReservationStatus()` only needs affected reservation IDs, booking IDs, room IDs, and status to update local state and activity logs.
  - The hook already has known booking rows in `reservations`, `activeBookingReservations`, or `bookings[].subRows` on the main UI paths; it can use a no-return helper in those known-state cases and keep the current row-returning helper as fallback.
- Next step: add red coverage for a no-return booking status helper and the known booking hook path.

## 2026-05-14 14:21 IST - Direct Booking Status Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 14:21 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 focused failures:
  - `updateBookingReservationsStatusWithoutReturning` is not exported.
  - Known booking status updates still call the row-returning helper instead of the no-return helper.

## 2026-05-14 14:23 IST - Direct Booking Status Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 14:23 IST`.
- Source changes:
  - Added `updateBookingReservationsStatusWithoutReturning()` in `src/lib/api/index.ts` for booking-wide status updates without `.select()`.
  - Updated `useAppData().updateBookingReservationStatus()` to use the no-return helper when affected booking rows are known locally from `reservations`, `activeBookingReservations`, or `bookings[].subRows`.
  - The known-state path now updates `reservations`, `activeBookingReservations`, `todayReservations`, and `bookings` locally and preserves the row-returning fallback for cold state.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 66 tests.

## 2026-05-14 14:23 IST - Direct Booking Status Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 14:23 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 14:25 IST - Direct Booking Status Mutation Full Test

- Command: `date`
- Result: `2026-05-14 14:25 IST`.
- Command: `pnpm test`
- Result: passed, 166 files / 406 tests.

## 2026-05-14 14:26 IST - Direct Booking Status Mutation Build

- Command: `date`
- Result: `2026-05-14 14:26 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 14:26 IST - Direct Booking Status Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 14:26 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 14:27 IST - Direct Mutation Callsite Audit

- Command: `date`
- Result: `2026-05-14 14:27 IST`.
- Commands:
  - `rg -n "update(Property|Guest|Reservation|BookingReservationsStatus|Room\(|RoomCategory|RatePlan|SeasonalPrice|Role|UserProfile|Amenity|StickyNote|PropertyClosure|Category|Post)\(" src -S`
  - `rg -n "update[A-Za-z0-9]+\([^\n]*\).*select\(|\.update\([^\n]*\).*\.select\(" src/app/api src/lib src/server -S`
  - `rg -n "await update(Category|Post)\(|update(Category|Post)," src/components/admin/posts -S`
  - `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Findings:
  - Blog components no longer call row-returning `updateCategory()` or `updatePost()` directly.
  - The remaining row-returning update helpers in `src/lib/api/index.ts` are fallback helpers; known-state callers now use `*WithoutReturning` helpers first.
  - Broad wildcard/empty Supabase select scan stayed clean; command exited 1 with no matches.

## 2026-05-14 14:28 IST - Direct Blog Create Mutation Analysis

- Command: `date`
- Result: `2026-05-14 14:28 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained and the `columns` argument controls which columns are retrieved.
- Findings:
  - `PostForm` ignores the created post object and immediately navigates to `/admin/posts` with `router.refresh()`.
  - `createPost()` currently inserts into `posts`, selects `POST_SELECT_COLUMNS`, and only needs `post.id` to create `post_categories` rows before returning a mapped `Post`.
  - A no-return create helper can select only `id`, sync categories, and return `void`, preserving the existing `createPost()` helper as a fallback for callers that need a full created post.
- Next step: add red coverage for an id-only/no-return post create helper and the `PostForm` create call site.

## 2026-05-14 14:29 IST - Direct Blog Create Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 14:29 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/components/admin/posts/blog-mutation-egress.test.ts`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/components/admin/posts/blog-mutation-egress.test.ts`
- Result: failed as expected, 2 focused failures:
  - `createPostWithoutReturning` is not exported.
  - `PostForm` still calls the row-returning `createPost()` helper.

## 2026-05-14 14:32 IST - Direct Blog Create Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 14:32 IST`.
- Source changes:
  - Added shared post-create DB payload mapping in `src/lib/api/index.ts`.
  - Added `createPostWithoutReturning()` in `src/lib/api/index.ts`, selecting only the inserted `id` needed for `post_categories` inserts.
  - Reused the category insert payload builder for create and update category sync paths.
  - Updated `PostForm` to use the id-only no-return helper on create while keeping the existing row-returning `createPost()` fallback helper available.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/components/admin/posts/blog-mutation-egress.test.ts`
- Result: passed, 2 files / 31 tests.

## 2026-05-14 14:32 IST - Direct Blog Create Mutation Typecheck Repair

- Command: `date`
- Result: `2026-05-14 14:32 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: failed because the new `DbPostInsertPayload` type required nullable DB fields while the app create shape allows `undefined` for optional post fields.
- Repair: normalize optional create fields to `null` in the shared post insert payload mapping.

## 2026-05-14 14:33 IST - Direct Blog Create Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 14:33 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 14:34 IST - Direct Blog Create Mutation Full Test

- Command: `date`
- Result: `2026-05-14 14:34 IST`.
- Command: `pnpm test`
- Result: passed, 166 files / 408 tests.

## 2026-05-14 14:35 IST - Direct Blog Create Mutation Build

- Command: `date`
- Result: `2026-05-14 14:35 IST`.
- Command: `pnpm build`
- Result: passed. Build emitted the existing Node experimental type-stripping warning.

## 2026-05-14 14:36 IST - Direct Blog Create Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 14:36 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 14:36 IST - Direct Blog Category Create Mutation Analysis

- Command: `date`
- Result: `2026-05-14 14:36 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained and the `columns` argument controls which columns are retrieved.
- Findings:
  - `CategoriesManager` calls `createCategory()` and uses the returned category only to append an immediate local row before `router.refresh()`.
  - The category table needs the generated `id` for edit/delete controls, but it already has submitted `name`, `slug`, `description`, and `parent_id`; `_count.posts` can start at `0` for a new category.
  - `api.createCategory()` currently inserts into `categories`, selects `CATEGORY_SELECT_COLUMNS`, and returns a mapped full `Category`.
- Next step: add red coverage for an id-only category create helper and the category manager create call site.

## 2026-05-14 14:37 IST - Direct Blog Category Create Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 14:37 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/components/admin/posts/blog-mutation-egress.test.ts`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/components/admin/posts/blog-mutation-egress.test.ts`
- Result: failed as expected, 2 focused failures:
  - `createCategoryIdOnly` is not exported.
  - `CategoriesManager` still calls the row-returning `createCategory()` helper.

## 2026-05-14 14:38 IST - Direct Blog Category Create Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 14:38 IST`.
- Source changes:
  - Added shared category create DB payload mapping in `src/lib/api/index.ts`.
  - Added `createCategoryIdOnly()` in `src/lib/api/index.ts`, selecting only the inserted `id` needed for local state.
  - Updated `CategoriesManager` to call the id-only helper and construct the immediate local category row from submitted form values with `_count.posts` initialized to `0`.
  - Preserved the existing row-returning `createCategory()` fallback helper.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/components/admin/posts/blog-mutation-egress.test.ts`
- Result: passed, 2 files / 33 tests.

## 2026-05-14 14:39 IST - Direct Blog Category Create Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 14:39 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 14:40 IST - Direct Blog Category Create Mutation Full Test

- Command: `date`
- Result: `2026-05-14 14:40 IST`.
- Command: `pnpm test`
- Result: passed, 166 files / 410 tests.

## 2026-05-14 14:42 IST - Direct Blog Category Create Mutation Build

- Command: `date`
- Result: `2026-05-14 14:42 IST`.
- Command: `pnpm build`
- Result: passed. Build emitted the existing Node experimental type-stripping warning.

## 2026-05-14 14:42 IST - Direct Blog Category Create Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 14:42 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 14:42 IST - Direct Room Category Create Mutation Analysis

- Command: `date`
- Result: `2026-05-14 14:42 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained and the `columns` argument controls which columns are retrieved.
- Findings:
  - `api.addRoomCategory()` inserts into `room_categories`, selects `ROOM_CATEGORY_SELECT_COLUMNS`, and returns the full row.
  - `useAppData().addRoomCategory()` only needs the generated `id`, submitted `name`, and submitted `description` to update local context and activity logs.
  - `/admin/room-categories` is route-backed and calls `onSaved` to refresh its page data after create, so the full inserted row is not needed on the create call path.
- Next step: add red coverage for an id-only room category create helper and the hook create path.

## 2026-05-14 14:45 IST - Direct Room Category Create Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 14:45 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 focused failures:
  - `addRoomCategoryIdOnly` is not exported.
  - `useAppData().addRoomCategory()` still calls the row-returning `addRoomCategory()` helper.

## 2026-05-14 14:46 IST - Direct Room Category Create Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 14:46 IST`.
- Source changes:
  - Added `addRoomCategoryIdOnly()` in `src/lib/api/index.ts`, selecting only the inserted `id`.
  - Updated `useAppData().addRoomCategory()` to call the id-only helper, construct local room category state from submitted values plus the returned id, and preserve activity logging.
  - Preserved the existing row-returning `addRoomCategory()` fallback helper.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 70 tests.

## 2026-05-14 14:46 IST - Direct Room Category Create Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 14:46 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 14:47 IST - Direct Room Category Create Mutation Full Test

- Command: `date`
- Result: `2026-05-14 14:47 IST`.
- Command: `pnpm test`
- Result: passed, 166 files / 412 tests.

## 2026-05-14 14:49 IST - Direct Room Category Create Mutation Build

- Command: `date`
- Result: `2026-05-14 14:49 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 14:49 IST - Direct Room Category Create Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 14:49 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 14:49 IST - Direct Rate Plan Create Mutation Analysis

- Command: `date`
- Result: `2026-05-14 14:49 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained and the `columns` argument controls which columns are retrieved.
- Findings:
  - `api.addRatePlan()` inserts into `rate_plans`, selects `RATE_PLAN_SELECT_COLUMNS`, and returns the full row.
  - `useAppData().addRatePlan()` only needs the generated `id` plus submitted `name`, `price`, and `rules` to update local context and activity logs.
  - `/admin/rates` is route-backed and calls `onSaved` to refresh its page data after create, so full inserted rate-plan rows are unnecessary on this create path.
- Next step: add red coverage for an id-only rate plan create helper and the hook create path.

## 2026-05-14 14:50 IST - Direct Rate Plan Create Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 14:50 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 focused failures:
  - `addRatePlanIdOnly` is not exported.
  - `useAppData().addRatePlan()` still calls the row-returning `addRatePlan()` helper.

## 2026-05-14 14:51 IST - Direct Rate Plan Create Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 14:51 IST`.
- Source changes:
  - Added `addRatePlanIdOnly()` in `src/lib/api/index.ts`, selecting only the inserted `id`.
  - Updated `useAppData().addRatePlan()` to call the id-only helper, construct local rate-plan state from submitted values plus the returned id, and preserve activity logging.
  - Preserved the existing row-returning `addRatePlan()` fallback helper.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 72 tests.

## 2026-05-14 14:52 IST - Direct Rate Plan Create Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 14:52 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 14:53 IST - Direct Rate Plan Create Mutation Full Test

- Command: `date`
- Result: `2026-05-14 14:53 IST`.
- Command: `pnpm test`
- Result: passed, 166 files / 414 tests.

## 2026-05-14 14:54 IST - Direct Rate Plan Create Mutation Build

- Command: `date`
- Result: `2026-05-14 14:54 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 14:54 IST - Direct Rate Plan Create Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 14:54 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 14:55 IST - Direct Role Create Mutation Analysis

- Command: `date`
- Result: `2026-05-14 14:55 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained and the `columns` argument controls which columns are retrieved.
- Findings:
  - `api.addRole()` inserts into `roles`, selects `ROLE_SELECT_COLUMNS`, and returns the full role row.
  - `useAppData().addRole()` maps the returned DB row mainly to recover `id`; submitted role form data already contains `name`, `permissions`, and `hierarchyLevel`.
  - Settings role creation can update local context and activity logs from the submitted role data plus the generated id, preserving the full-row helper as a fallback.
- Next step: add red coverage for an id-only role create helper and the hook create path.

## 2026-05-14 14:56 IST - Direct Role Create Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 14:56 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 focused failures:
  - `addRoleIdOnly` is not exported.
  - `useAppData().addRole()` still calls the row-returning `addRole()` helper.

## 2026-05-14 14:57 IST - Direct Role Create Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 14:57 IST`.
- Source changes:
  - Added `addRoleIdOnly()` in `src/lib/api/index.ts`, selecting only the inserted `id` while reusing the role DB payload mapper.
  - Updated `useAppData().addRole()` to call the id-only helper, construct local role state from submitted values plus the returned id, and preserve activity logging.
  - Preserved the existing row-returning `addRole()` fallback helper.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 74 tests.

## 2026-05-14 14:57 IST - Direct Role Create Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 14:57 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 14:59 IST - Direct Role Create Mutation Full Test

- Command: `date`
- Result: `2026-05-14 14:59 IST`.
- Command: `pnpm test`
- Result: passed, 166 files / 416 tests.

## 2026-05-14 15:00 IST - Direct Role Create Mutation Build

- Command: `date`
- Result: `2026-05-14 15:00 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 15:00 IST - Direct Role Create Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 15:00 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 15:01 IST - Direct Amenity Create Mutation Analysis

- Command: `date`
- Result: `2026-05-14 15:01 IST`.
- Research source: Supabase JS `select()` modifier docs at `https://supabase.com/docs/reference/javascript/db-modifiers-select`; current docs state mutations do not return modified rows unless `.select()` is chained and the `columns` argument controls which columns are retrieved.
- Findings:
  - `api.addAmenity()` inserts into `amenities`, selects `AMENITY_SELECT_COLUMNS`, and returns the full row.
  - `useAppData().addAmenity()` only needs the generated `id` plus submitted `name` and `icon` to update local context and activity logs.
  - The settings amenity form already has all non-id fields at submit time, so this path can use an id-only create helper while preserving the full-row helper as a fallback.
- Next step: add red coverage for an id-only amenity create helper and the hook create path.

## 2026-05-14 15:02 IST - Direct Amenity Create Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 15:02 IST`.
- Added failing coverage in `src/lib/api/index.test.ts` and `src/hooks/use-app-data.load-plan.test.tsx`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 focused failures:
  - `addAmenityIdOnly` is not exported.
  - `useAppData().addAmenity()` still calls the row-returning `addAmenity()` helper.

## 2026-05-14 15:03 IST - Direct Amenity Create Mutation Implementation And Focused Green

- Command: `date`
- Result: `2026-05-14 15:03 IST`.
- Source changes:
  - Added `addAmenityIdOnly()` in `src/lib/api/index.ts`, selecting only the inserted `id`.
  - Updated `useAppData().addAmenity()` to call the id-only helper, construct local amenity state from submitted values plus the returned id, and preserve activity logging.
  - Preserved the existing row-returning `addAmenity()` fallback helper.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 76 tests.

## 2026-05-14 15:03 IST - Direct Amenity Create Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 15:03 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 15:05 IST - Direct Amenity Create Mutation Full Test

- Command: `date`
- Result: `2026-05-14 15:05 IST`.
- Command: `pnpm test`
- Result: passed, 166 files / 418 tests.

## 2026-05-14 15:06 IST - Direct Amenity Create Mutation Build

- Command: `date`
- Result: `2026-05-14 15:06 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 15:06 IST - Direct Amenity Create Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 15:06 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 15:09 IST - Direct Sticky Note Create Mutation Analysis

- Command: `date`
- Result: `2026-05-14 15:09:30 IST`.
- Web research source: Supabase JavaScript select modifier docs, "Return data after inserting" (`https://supabase.com/docs/reference/javascript/db-modifiers-select`).
- Relevant Supabase behavior: mutation rows are not returned by default; chaining `.select()` returns modified rows, and the `columns` parameter controls which columns are retrieved.
- Findings:
  - `api.addStickyNote()` inserts into `sticky_notes`, chains `.select(STICKY_NOTE_SELECT_COLUMNS).single()`, and returns the full note row after create.
  - `useAppData().addStickyNote()` only needs the generated id for local state and activity logging because title, description, and color already come from the submitted payload.
  - The immediate UI can safely use `new Date().toISOString()` for `createdAt` until the next read because sticky-note cards only display and expose that timestamp, and the persisted server timestamp is reloaded later.
  - The row-returning `addStickyNote()` helper should remain as a compatibility fallback; the direct hook create path can use a new id-only helper.
- Next step: add strict red coverage proving sticky-note creation can select only `id` and the hook no longer calls the full-row helper.

## 2026-05-14 15:10 IST - Direct Sticky Note Create Mutation Red Test Change

- Command: `date`
- Result: `2026-05-14 15:10:37 IST`.
- Changed tests:
  - `src/lib/api/index.test.ts` now expects `addStickyNoteIdOnly()` to insert into `sticky_notes`, select only `id`, and not select `STICKY_NOTE_SELECT_COLUMNS`.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects `useAppData().addStickyNote()` to call `api.addStickyNoteIdOnly()`, avoid `api.addStickyNote()`, and preserve activity logging from the submitted payload and returned id.
- Expected red result: the id-only helper is not implemented/exported yet, and the hook still calls the row-returning create helper.

## 2026-05-14 15:11 IST - Direct Sticky Note Create Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 15:11:00 IST`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 failed / 76 passed / 78 total tests.
- Intended failures:
  - `src/lib/api/index.test.ts`: `addStickyNoteIdOnly` is currently undefined.
  - `src/hooks/use-app-data.load-plan.test.tsx`: `apiMock.addStickyNoteIdOnly` received zero calls because `useAppData().addStickyNote()` still calls the row-returning `api.addStickyNote()`.

## 2026-05-14 15:12 IST - Direct Sticky Note Create Mutation Implementation

- Command: `date`
- Result: `2026-05-14 15:12:14 IST`.
- Changed `src/lib/api/index.ts`:
  - Added `addStickyNoteIdOnly()` for `sticky_notes` inserts.
  - The helper selects only `id`, unwraps `data.id`, and preserves `error` plus response metadata.
  - Kept the existing row-returning `addStickyNote()` helper as a fallback.
- Changed `src/hooks/use-app-data.ts`:
  - `useAppData().addStickyNote()` now calls `api.addStickyNoteIdOnly()`.
  - It builds the local `StickyNote` from the returned id, submitted title/description/color, and a local ISO `createdAt`.
  - Activity logging now uses the locally constructed note rather than a returned database row.

## 2026-05-14 15:12 IST - Direct Sticky Note Create Mutation Focused Green

- Command: `date`
- Result: `2026-05-14 15:12:49 IST`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 78 tests.

## 2026-05-14 15:13 IST - Direct Sticky Note Create Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 15:13:27 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 15:14 IST - Direct Sticky Note Create Mutation Full Test

- Command: `date`
- Result: `2026-05-14 15:14:50 IST`.
- Command: `pnpm test`
- Result: passed, 166 files / 420 tests.

## 2026-05-14 15:16 IST - Direct Sticky Note Create Mutation Build

- Command: `date`
- Result: `2026-05-14 15:16:18 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 15:16 IST - Direct Sticky Note Create Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 15:16:48 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 15:17 IST - Direct Room Create Mutation Analysis

- Command: `date`
- Result: `2026-05-14 15:17:15 IST`.
- Web research source: Supabase JavaScript select modifier docs, "Return data after inserting" (`https://supabase.com/docs/reference/javascript/db-modifiers-select`).
- Relevant Supabase behavior: mutation rows are not returned by default; chaining `.select()` returns modified rows, and the `columns` parameter controls which columns are retrieved.
- Findings:
  - `api.addRoom()` inserts into `rooms`, chains `.select(ROOM_SELECT_COLUMNS).single()`, and maps the full returned row with `fromDbRoom()`.
  - `useAppData().addRoom()` only needs the generated id plus submitted `roomNumber`, `roomTypeId`, `status`, and optional `photos` to append local state and record activity.
  - `RoomFormDialog` trims `roomNumber` before calling `addRoom()`, so constructing local state from the submitted payload preserves the current UI behavior for the direct form path.
  - The row-returning `addRoom()` helper should remain as a compatibility fallback; the direct hook create path can use a new id-only helper.
- Next step: add red coverage proving room creation can select only `id` and the hook no longer calls the full-row helper.

## 2026-05-14 15:21 IST - Direct Room Create Mutation Red Test Change

- Command: `date`
- Result: `2026-05-14 15:21:27 IST`.
- Changed tests:
  - `src/lib/api/index.test.ts` now expects `addRoomIdOnly()` to insert mapped room columns, select only `id`, and perform a single-row read of only that id.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects `useAppData().addRoom()` to call `api.addRoomIdOnly()`, avoid `api.addRoom()`, and preserve activity logging from the submitted room payload and returned id.
- Expected red result: the id-only helper is not implemented/exported yet, and the hook still calls the row-returning room create helper.

## 2026-05-14 15:21 IST - Direct Room Create Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 15:21:57 IST`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 failed / 78 passed / 80 total tests.
- Intended failures:
  - `src/lib/api/index.test.ts`: `addRoomIdOnly` is currently undefined.
  - `src/hooks/use-app-data.load-plan.test.tsx`: `apiMock.addRoomIdOnly` received zero calls because `useAppData().addRoom()` still calls the row-returning `api.addRoom()`.

## 2026-05-14 15:22 IST - Direct Room Create Mutation Implementation

- Command: `date`
- Result: `2026-05-14 15:22:35 IST`.
- Changed `src/lib/api/index.ts`:
  - Added `addRoomIdOnly()` for `rooms` inserts.
  - The helper maps the app room payload through `toDbRoom()`, selects only `id`, unwraps `data.id`, and preserves `error` plus response metadata.
  - Kept the existing row-returning `addRoom()` helper as a fallback.
- Changed `src/hooks/use-app-data.ts`:
  - `useAppData().addRoom()` now calls `api.addRoomIdOnly()`.
  - It builds the local `Room` from the returned id and submitted room payload.
  - Activity logging now uses the locally constructed room rather than a returned database row.

## 2026-05-14 15:23 IST - Direct Room Create Mutation Focused Green

- Command: `date`
- Result: `2026-05-14 15:23:04 IST`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 80 tests.

## 2026-05-14 15:23 IST - Direct Room Create Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 15:23:38 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 15:25 IST - Direct Room Create Mutation Full Test

- Command: `date`
- Result: `2026-05-14 15:25:01 IST`.
- Command: `pnpm test`
- Result: passed, 166 files / 422 tests.

## 2026-05-14 15:26 IST - Direct Room Create Mutation Build

- Command: `date`
- Result: `2026-05-14 15:26:20 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 15:26 IST - Direct Room Create Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 15:26:36 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 15:26 IST - Direct Seasonal Price Create Mutation Analysis

- Command: `date`
- Result: `2026-05-14 15:26:55 IST`.
- Web research source: Supabase JavaScript select modifier docs, "Return data after inserting" (`https://supabase.com/docs/reference/javascript/db-modifiers-select`).
- Relevant Supabase behavior: mutation rows are not returned by default; chaining `.select()` returns modified rows, and the `columns` parameter controls which columns are retrieved.
- Findings:
  - `api.addSeasonalPrice()` inserts into `seasonal_prices`, chains `.select(SEASONAL_PRICE_SELECT_COLUMNS).single()`, and maps the full returned row with `fromDbSeasonalPrice()`.
  - `useAppData().addSeasonalPrice()` only needs the generated id plus submitted `roomTypeId`, `name`, `price`, `startDate`, and `endDate` to append local state, record activity, and return the created object to callers.
  - `SeasonalPriceFormDialog` submits exactly the persisted seasonal-price fields and does not need server-computed columns after create.
  - The row-returning `addSeasonalPrice()` helper should remain as a compatibility fallback; the direct hook create path can use a new id-only helper.
- Next step: add red coverage proving seasonal-price creation can select only `id` and the hook no longer calls the full-row helper.

## 2026-05-14 15:28 IST - Direct Seasonal Price Create Mutation Red Test Change

- Command: `date`
- Result: `2026-05-14 15:28:38 IST`.
- Changed tests:
  - `src/lib/api/index.test.ts` now expects `addSeasonalPriceIdOnly()` to insert mapped seasonal-price columns, select only `id`, and not select `SEASONAL_PRICE_SELECT_COLUMNS`.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects `useAppData().addSeasonalPrice()` to call `api.addSeasonalPriceIdOnly()`, avoid `api.addSeasonalPrice()`, return a locally constructed seasonal price, and preserve activity logging from the submitted payload and returned id.
- Expected red result: the id-only helper is not implemented/exported yet, and the hook still calls the row-returning seasonal-price create helper.

## 2026-05-14 15:29 IST - Direct Seasonal Price Create Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 15:29:17 IST`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 failed / 80 passed / 82 total tests.
- Intended failures:
  - `src/lib/api/index.test.ts`: `addSeasonalPriceIdOnly` is currently undefined.
  - `src/hooks/use-app-data.load-plan.test.tsx`: `apiMock.addSeasonalPriceIdOnly` received zero calls because `useAppData().addSeasonalPrice()` still calls the row-returning `api.addSeasonalPrice()`.

## 2026-05-14 15:29 IST - Direct Seasonal Price Create Mutation Implementation

- Command: `date`
- Result: `2026-05-14 15:29:47 IST`.
- Changed `src/lib/api/index.ts`:
  - Added `addSeasonalPriceIdOnly()` for `seasonal_prices` inserts.
  - The helper maps the app seasonal-price payload through `toDbSeasonalPrice()`, selects only `id`, unwraps `data.id`, and preserves `error` plus response metadata.
  - Kept the existing row-returning `addSeasonalPrice()` helper as a fallback.
- Changed `src/hooks/use-app-data.ts`:
  - `useAppData().addSeasonalPrice()` now calls `api.addSeasonalPriceIdOnly()`.
  - It builds the local `SeasonalPrice` from the returned id and submitted seasonal-price payload.
  - Activity logging and the returned created object now use the locally constructed seasonal price rather than a returned database row.

## 2026-05-14 15:30 IST - Direct Seasonal Price Create Mutation Focused Green

- Command: `date`
- Result: `2026-05-14 15:30:21 IST`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 82 tests.

## 2026-05-14 15:30 IST - Direct Seasonal Price Create Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 15:30:54 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 15:32 IST - Direct Seasonal Price Create Mutation Full Test

- Command: `date`
- Result: `2026-05-14 15:32:23 IST`.
- Command: `pnpm test`
- Result: passed, 166 files / 424 tests.

## 2026-05-14 15:33 IST - Direct Seasonal Price Create Mutation Build

- Command: `date`
- Result: `2026-05-14 15:33:51 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 15:34 IST - Direct Seasonal Price Create Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 15:34:19 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-14 15:34 IST - Direct Property Closure Create Mutation Analysis

- Command: `date`
- Result: `2026-05-14 15:34:40 IST`.
- Web research source: Supabase JavaScript select modifier docs, "Return data after inserting" (`https://supabase.com/docs/reference/javascript/db-modifiers-select`).
- Relevant Supabase behavior: mutation rows are not returned by default; chaining `.select()` returns modified rows, and the `columns` parameter controls which columns are retrieved.
- Findings:
  - `api.addPropertyClosure()` inserts into `property_closures`, chains `.select(PROPERTY_CLOSURE_SELECT_COLUMNS).single()`, and maps the full returned row with `fromDbPropertyClosure()`.
  - `useAppData().addPropertyClosure()` only needs the generated id plus submitted `propertyId`, optional `roomTypeId`, `startDate`, `endDate`, and optional `reason` to append local state, record activity, and return the created object to callers.
  - `PropertyClosureFormDialog` builds the exact persisted closure payload before calling the hook and does not need server-computed columns after create.
  - The row-returning `addPropertyClosure()` helper should remain as a compatibility fallback; the direct hook create path can use a new id-only helper.
- Next step: add red coverage proving property-closure creation can select only `id` and the hook no longer calls the full-row helper.

## 2026-05-14 15:36 IST - Direct Property Closure Create Mutation Red Test Change

- Command: `date`
- Result: `2026-05-14 15:36:24 IST`.
- Changed tests:
  - `src/lib/api/index.test.ts` now expects `addPropertyClosureIdOnly()` to insert mapped closure columns, select only `id`, and not select `PROPERTY_CLOSURE_SELECT_COLUMNS`.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects `useAppData().addPropertyClosure()` to call `api.addPropertyClosureIdOnly()`, avoid `api.addPropertyClosure()`, return a locally constructed closure, and preserve activity logging from the submitted payload and returned id.
- Expected red result: the id-only helper is not implemented/exported yet, and the hook still calls the row-returning property-closure create helper.

## 2026-05-14 15:36 IST - Direct Property Closure Create Mutation Red Gate

- Command: `date`
- Result: `2026-05-14 15:36:50 IST`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected, 2 failed / 82 passed / 84 total tests.
- Intended failures:
  - `src/lib/api/index.test.ts`: `addPropertyClosureIdOnly` is currently undefined.
  - `src/hooks/use-app-data.load-plan.test.tsx`: `apiMock.addPropertyClosureIdOnly` received zero calls because `useAppData().addPropertyClosure()` still calls the row-returning `api.addPropertyClosure()`.

## 2026-05-14 15:37 IST - Direct Property Closure Create Mutation Implementation

- Command: `date`
- Result: `2026-05-14 15:37:30 IST`.
- Changed `src/lib/api/index.ts`:
  - Added `addPropertyClosureIdOnly()` for `property_closures` inserts.
  - The helper maps the app closure payload through `toDbPropertyClosure()`, selects only `id`, unwraps `data.id`, and preserves `error`.
  - Kept the existing row-returning `addPropertyClosure()` helper as a fallback.
- Changed `src/hooks/use-app-data.ts`:
  - `useAppData().addPropertyClosure()` now calls `api.addPropertyClosureIdOnly()`.
  - It builds the local `PropertyClosure` from the returned id and submitted closure payload.
  - Activity logging and the returned created object now use the locally constructed closure rather than a returned database row.

## 2026-05-14 15:38 IST - Direct Property Closure Create Mutation Focused Green

- Command: `date`
- Result: `2026-05-14 15:38:10 IST`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 84 tests.

## 2026-05-14 15:38 IST - Direct Property Closure Create Mutation Typecheck

- Command: `date`
- Result: `2026-05-14 15:38:40 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-14 15:40 IST - Direct Property Closure Create Mutation Full Test

- Command: `date`
- Result: `2026-05-14 15:40:03 IST`.
- Command: `pnpm test`
- Result: passed, 166 files / 426 tests.

## 2026-05-14 15:41 IST - Direct Property Closure Create Mutation Build

- Command: `date`
- Result: `2026-05-14 15:41:17 IST`.
- Command: `pnpm build`
- Result: passed.

## 2026-05-14 15:41 IST - Direct Property Closure Create Mutation Select Scan

- Command: `date`
- Result: `2026-05-14 15:41:43 IST`.
- Command: `rg -n "select\([^\n]*\*|select\(\)" src/app/api src/lib src/server -S`
- Result: clean; command exited 1 with no matches.

## 2026-05-13 18:53 IST - Admin Guests Index Egress Analysis Resume

- Timestamp check: `2026-05-13 18:53:06 IST`.
- Workspace status: many optimization edits and untracked tests/routes are already in flight; this pass will only touch the guest-index path and will not revert unrelated changes.
- Current guest-index findings:
  - `/admin/guests` still uses `ADMIN_GUESTS_PLAN = ["property", "guests"]`, so the page hydrates all guests at startup.
  - `GuestsPanel` reads `guests` from `useDataContext()` and passes the full array to `GuestsDataTable`.
  - `GuestsDataTable` performs client-side global filtering and pagination over the full guest list.
  - Browser `api.getGuests()` still loops over all guest pages from Supabase, making this a direct egress target.
- Implementation direction:
  - Add a route-backed guest page API guarded by the `guests` feature.
  - Query explicit guest columns with `limit`, `offset`, and optional search.
  - Move the guest index to manual/server pagination and remove `guests` from the route load plan.

## 2026-05-13 18:56 IST - Admin Guests Index Red Tests Added

- Timestamp check: `2026-05-13 18:56:44 IST`.
- Added failing coverage for the guest-index pagination/egress pass:
  - `src/hooks/app-data-load-plan.test.ts` now expects `/admin/guests` to load only `property`.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects `/admin/guests` to skip `api.getGuests()`.
  - `src/lib/server/guests.test.ts` defines bounded explicit-column guest page queries with search and clamped limits.
  - `src/app/api/admin/guests/route.test.ts` defines the authenticated no-store guest page API contract.
  - `src/hooks/use-guests-page.test.tsx` defines the route-backed client hook contract.
  - `src/app/admin/guests/guests-index-code-splitting.test.ts` prevents returning to global guest hydration and client-side table filtering.

## 2026-05-13 18:57 IST - Admin Guests Index Red Test Run

- Timestamp check: `2026-05-13 18:57:05 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/lib/server/guests.test.ts src/app/api/admin/guests/route.test.ts src/hooks/use-guests-page.test.tsx src/app/admin/guests/guests-index-code-splitting.test.ts`
- Intended red result: failed because:
  - `/admin/guests` still includes `guests` in its load plan and `useAppData` still calls `api.getGuests()`.
  - `useGuestsPage`, `src/lib/server/guests.ts`, and `src/app/api/admin/guests/route.ts` do not exist yet.
  - `GuestsPanel` still reads global `guests`, and `GuestsDataTable` still uses client-side filtering/pagination.

## 2026-05-13 19:01 IST - Admin Guests Index Implementation

- Timestamp check: `2026-05-13 19:01:32 IST`.
- Added `src/lib/guests/list.ts` with the shared guest-page response shape.
- Added `src/lib/server/guests.ts` with explicit guest columns, exact count, clamped `limit`/`offset`, optional search over name/email/phone, and newest-first ordering.
- Added `src/app/api/admin/guests/route.ts`, guarded by `requireFeature(request, "guests")` and returning `Cache-Control: private, no-store`.
- Added `src/hooks/use-guests-page.ts` to fetch bounded guest pages through `authorizedFetch`.
- Updated `/admin/guests` load plan to `["property"]`.
- Updated `GuestsPanel` to drive page/search state through URL params and `useGuestsPage`.
- Updated `GuestsDataTable` to use manual pagination and server-controlled search instead of client filtering/pagination over the full guest list.
- Added a guest-save table meta callback so add/edit/delete actions reload the current page.

## 2026-05-13 19:02 IST - Admin Guests Index Focused Green Test

- Timestamp check: `2026-05-13 19:02:00 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/lib/server/guests.test.ts src/app/api/admin/guests/route.test.ts src/hooks/use-guests-page.test.tsx src/app/admin/guests/guests-index-code-splitting.test.ts`
- Result: passed, 6 files / 64 tests.

## 2026-05-13 19:02 IST - Admin Guests Index Typecheck

- Timestamp check: `2026-05-13 19:02:23 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 19:02 IST - Admin Guests Index Full Test

- Timestamp check: `2026-05-13 19:02:56 IST`.
- Command: `pnpm test`
- Result: passed, 107 files / 265 tests.

## 2026-05-13 19:03 IST - Admin Guests Index Build

- Timestamp check: `2026-05-13 19:03:52 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observations:
  - New `/api/admin/guests` route is present.
  - `/admin/guests` builds at about `106 kB` first-load JS.
  - Shared first-load JS remains about `105 kB`.
  - Recurring Node `ExperimentalWarning: Type Stripping...` appeared during build.

## 2026-05-13 19:04 IST - Admin Guests Index Select Scan

- Timestamp check: `2026-05-13 19:04:12 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in audited server/API paths.

## 2026-05-13 19:05 IST - Reservation Create Guest Egress Analysis

- Timestamp check: `2026-05-13 19:05:05 IST`.
- Analysis:
  - After the guest-index pass, the remaining route-specific `guests` startup load is `/admin/reservations/new`.
  - `CreateReservationForm` currently destructures `guests` from `useDataContext()`, finds the selected guest locally, and renders the guest combobox from `guests.map(...)`.
  - This forces `api.getGuests()` to loop through the entire guest table before the reservation form becomes usable.
  - The new `/api/admin/guests` page API and existing `/api/admin/guests/[id]` profile API can cover the form with a bounded search list plus a selected-guest profile lookup.
- Next test-first target:
  - Remove `guests` from `ADMIN_RESERVATIONS_PLAN` for `/admin/reservations/new`.
  - Update the create form to use `useGuestsPage()` for the combobox options and `useGuestProfile()` for selected/prefilled guests.

## 2026-05-13 19:05 IST - Reservation Create Guest Egress Red Tests Added

- Timestamp check: `2026-05-13 19:05:40 IST`.
- Updated route-plan tests so `/admin/reservations/new` no longer expects the `guests` dataset or `api.getGuests()`.
- Expanded `src/app/admin/reservations/new/reservation-create-egress.test.ts` to require `useGuestsPage()` and `useGuestProfile()` and forbid `guests.map(...)` over global context state.

## 2026-05-13 19:06 IST - Reservation Create Guest Egress Red Test Run

- Timestamp check: `2026-05-13 19:06:10 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/new/reservation-create-egress.test.ts`
- Intended red result: failed because `/admin/reservations/new` still includes `guests` in its load plan, `useAppData` still calls `api.getGuests()`, and `CreateReservationForm` still renders `guests.map(...)` from context.

## 2026-05-13 19:07 IST - Reservation Create Guest Egress Implementation

- Timestamp check: `2026-05-13 19:07:07 IST`.
- Removed `guests` from `ADMIN_RESERVATIONS_PLAN`, so `/admin/reservations/new` no longer triggers the browser `api.getGuests()` full-table loop.
- Updated `CreateReservationForm`:
  - Removed `guests` from `useDataContext()`.
  - Added `useGuestsPage({ limit: 50, offset: 0, query })` for bounded guest combobox results.
  - Added `useGuestProfile(selectedGuestId)` so redirected/prefilled guest ids still render a selected guest label without loading the global guest list.
  - Disabled command-side filtering for the combobox because the displayed rows are already route-filtered.

## 2026-05-13 19:07 IST - Reservation Create Guest Egress Focused Test Adjustment

- Timestamp check: `2026-05-13 19:07:41 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/new/reservation-create-egress.test.ts`
- Result: route-plan and hook tests passed, but the source test had a false-positive assertion on visible copy containing the phrase `dates, guests, and room type filters`.
- Adjustment: narrowed the source assertion to forbid `const {\n    guests,` context destructuring instead of forbidding all user-facing text containing `guests,`.

## 2026-05-13 19:08 IST - Reservation Create Guest Egress Focused Green Test

- Timestamp check: `2026-05-13 19:08:03 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/new/reservation-create-egress.test.ts`
- Result: passed, 3 files / 58 tests.

## 2026-05-13 19:08 IST - Reservation Create Guest Egress Typecheck

- Timestamp check: `2026-05-13 19:08:28 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 19:08 IST - Reservation Create Guest Egress Full Test

- Timestamp check: `2026-05-13 19:08:58 IST`.
- Command: `pnpm test`
- Result: passed, 107 files / 266 tests.

## 2026-05-13 19:09 IST - Reservation Create Guest Egress Build

- Timestamp check: `2026-05-13 19:09:49 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observations:
  - `/admin/reservations/new` builds at about `106 kB` first-load JS.
  - `/api/admin/guests` remains present.
  - Shared first-load JS remains about `105 kB`.
  - Recurring Node `ExperimentalWarning: Type Stripping...` appeared during build.

## 2026-05-13 19:10 IST - Reservation Create Guest Egress Select Scan

- Timestamp check: `2026-05-13 19:10:12 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in audited server/API paths.

## 2026-05-13 19:12 IST - Calendar Reservation Egress Analysis

- Timestamp check: `2026-05-13 19:12:54 IST`.
- Analysis:
  - `/admin/calendar` still includes `dashboardReservations`, so `useAppData` fetches `/api/admin/reservations?limit=1000&offset=0&includeCount=1` before the calendar is usable.
  - The main `AvailabilityCalendar` view already gets room-type/day availability through `/api/admin/availability/monthly`.
  - The remaining reason for the full reservation preload is hover details: `RoomTypeRow` and `ReservationHoverCard` read `reservations`, `guests`, `rooms`, and `roomTypes` from `useDataContext()`.
  - A bounded hover-detail API keyed by the visible monthly reservation ids can replace that startup reservation payload for the calendar route.
- Next target:
  - Remove `dashboardReservations`, `rooms`, and `roomTypes` from the calendar load plan, leaving property only.
  - Add a narrow reservation hover-details route/hook and pass the resulting detail map through `AvailabilityCalendar` -> `RoomTypeRow` -> `ReservationHoverCard`.

## 2026-05-13 19:14 IST - Calendar Reservation Egress Red Tests Added

- Timestamp check: `2026-05-13 19:14:46 IST`.
- Added/updated failing coverage:
  - Calendar load plan and `useAppData` tests now expect `/admin/calendar` to load only `property` and skip the 1000-row reservations startup call.
  - Calendar source coverage now requires `useCalendarReservationDetails` and forbids `RoomTypeRow`/`ReservationHoverCard` from using `DataContext`.
  - Added server-helper, API route, and hook tests for bounded calendar reservation hover details.

## 2026-05-13 19:15 IST - Calendar Reservation Egress Red Test Run

- Timestamp check: `2026-05-13 19:15:09 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/calendar/calendar-code-splitting.test.ts src/lib/server/calendar-reservation-details.test.ts src/app/api/admin/reservations/calendar-details/route.test.ts src/hooks/use-calendar-reservation-details.test.tsx`
- Intended red result: failed because the calendar load plan still includes `rooms`, `roomTypes`, and `dashboardReservations`; the bounded hover-detail helper/route/hook do not exist yet; and calendar hover components still read reservation data from `DataContext`.

## 2026-05-13 19:18 IST - Calendar Reservation Egress Implementation

- Timestamp check: `2026-05-13 19:18:03 IST`.
- Added `src/lib/calendar/reservation-details.ts` with the client-safe calendar hover detail response type.
- Added `src/lib/server/calendar-reservation-details.ts` with a narrow reservation/guest/room/room-type select for requested reservation ids only.
- Added `src/app/api/admin/reservations/calendar-details/route.ts`, guarded by the `calendar` feature and `Cache-Control: private, no-store`.
- Added `src/hooks/use-calendar-reservation-details.ts` for bounded client fetching keyed by visible reservation ids.
- Updated `/admin/calendar` load plan to `["property"]`.
- Updated `AvailabilityCalendar` to collect visible reservation ids from monthly availability data and fetch hover details separately.
- Updated `RoomTypeRow` and `ReservationHoverCard` to receive a reservation detail map via props instead of reading global `reservations`/`guests`/`rooms`/`roomTypes` context.

## 2026-05-13 19:18 IST - Calendar Reservation Egress Focused Green Test

- Timestamp check: `2026-05-13 19:18:32 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/calendar/calendar-code-splitting.test.ts src/lib/server/calendar-reservation-details.test.ts src/app/api/admin/reservations/calendar-details/route.test.ts src/hooks/use-calendar-reservation-details.test.tsx`
- Result: passed, 6 files / 65 tests.

## 2026-05-13 19:19 IST - Calendar Reservation Egress Typecheck

- Timestamp check: `2026-05-13 19:19:00 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 19:19 IST - Calendar Reservation Egress Full Test

- Timestamp check: `2026-05-13 19:19:35 IST`.
- Command: `pnpm test`
- Result: passed, 110 files / 273 tests.

## 2026-05-13 19:20 IST - Calendar Reservation Egress Build

- Timestamp check: `2026-05-13 19:20:23 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observations:
  - New `/api/admin/reservations/calendar-details` route is present.
  - `/admin/calendar` remains about `106 kB` first-load JS.
  - Shared first-load JS remains about `105 kB`.
  - Recurring Node `ExperimentalWarning: Type Stripping...` appeared during build.

## 2026-05-13 19:20 IST - Calendar Reservation Egress Select Scan

- Timestamp check: `2026-05-13 19:20:42 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no broad Supabase select matches in audited server/API paths.

## 2026-05-13 19:23 IST - Dashboard Summary Egress Analysis

- Timestamp check: `2026-05-13 19:23:16 IST`.
- Analysis:
  - `/admin/dashboard` still includes `rooms`, `roomTypes`, and `dashboardReservations`.
  - `DashboardPanel` computes stats and today-arrival/departure tables from client-side `bookings + rooms`, which forces `/api/admin/reservations?limit=1000&offset=0&includeCount=1` on dashboard startup.
  - The dashboard calendar no longer needs these datasets after the calendar hover-detail pass; sticky notes still need `stickyNotes`.
  - Next implementation should return a compact dashboard summary payload for one date and remove the reservation/room startup datasets from the dashboard route plan.
- Research refresh:
  - Official Supabase JS docs recommend keeping the 1,000 row default low to limit accidental payload size and using `range()` for pagination when rows are needed.
  - The same docs show filters can be chained onto explicit `select("column, ...")` queries and that `.or()`/`.filter()` use raw PostgREST syntax for advanced predicates.
  - Reference: https://supabase.com/docs/reference/javascript/select

## 2026-05-13 19:27 IST - Dashboard Summary Egress Red Tests

- Timestamp check: `2026-05-13 19:27 IST`.
- Added test coverage for the next dashboard egress cut:
  - `src/lib/server/dashboard-summary.test.ts` defines the narrow Supabase query contract for room count, active occupancy rows, and today's arrival/departure rows.
  - `src/app/api/admin/dashboard/summary/route.test.ts` defines the dashboard feature guard, date validation, no-store header, and `{ data }` response shape.
  - `src/hooks/use-dashboard-summary.test.tsx` defines the client hook fetch contract for `/api/admin/dashboard/summary?date=yyyy-MM-dd`.
  - `src/app/admin/dashboard/dashboard-code-splitting.test.ts` now also guards against the panel using `getTodayRange`.
- Red test command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/dashboard/dashboard-code-splitting.test.ts src/lib/server/dashboard-summary.test.ts src/app/api/admin/dashboard/summary/route.test.ts src/hooks/use-dashboard-summary.test.tsx`
- Timestamp check: `2026-05-13 19:27:53 IST`.
- Intended red result: failed.
  - Missing modules: dashboard summary server helper, dashboard summary API route, and dashboard summary hook.
  - Existing dashboard startup plan still includes `rooms`, `roomTypes`, and `dashboardReservations`.
  - Existing dashboard panel still uses `bookings`, `rooms`, `getTodayRange`, and `buildDashboardSummary`.

## 2026-05-13 19:29 IST - Dashboard Summary Egress Implementation

- Timestamp check: `2026-05-13 19:29:49 IST`.
- Added `src/lib/dashboard/summary.ts` for the compact dashboard summary payload and empty fallback.
- Added `src/lib/server/dashboard-summary.ts`:
  - Counts rooms for sale with a head/count query against `rooms`.
  - Loads only active occupancy reservation IDs/room IDs for the requested date.
  - Loads only today's arrival/departure row fields with nested guest and room display columns.
  - Deduplicates occupied rooms before computing occupancy and availability.
- Added `src/app/api/admin/dashboard/summary/route.ts` guarded by the `dashboard` feature, with strict `YYYY-MM-DD` validation and `private, no-store`.
- Added `src/hooks/use-dashboard-summary.ts` and rewired `src/app/admin/dashboard/components/dashboard-panel.tsx` to use it instead of global `bookings`/`rooms`.
- Reduced `/admin/dashboard` app-data startup plan to `["property", "stickyNotes"]`.
- Focused test command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/dashboard/dashboard-code-splitting.test.ts src/lib/server/dashboard-summary.test.ts src/app/api/admin/dashboard/summary/route.test.ts src/hooks/use-dashboard-summary.test.tsx`
- Timestamp check: `2026-05-13 19:30:21 IST`.
- Result: passed, 6 files / 63 tests.
- TypeScript command: `pnpm exec tsc --noEmit`
- Timestamp check: `2026-05-13 19:30:37 IST`.
- Result: failed on Supabase nested relation inference for dashboard summary rows; the implementation needs the same explicit `unknown` cast style used by other server helpers.
- Timestamp check: `2026-05-13 19:30:50 IST`.
- TypeScript fix: cast today's dashboard summary rows through `unknown` before mapping nested guest/room relation fields.
- TypeScript command: `pnpm exec tsc --noEmit`
- Timestamp check: `2026-05-13 19:31:05 IST`.
- Result: passed.
- Full test command: `pnpm test`
- Timestamp check: `2026-05-13 19:31:34 IST`.
- Result: passed, 113 files / 278 tests.
- Build command: `pnpm build`
- Timestamp check: `2026-05-13 19:32:29 IST`.
- Result: passed.
- Build observations:
  - New `/api/admin/dashboard/summary` route is present.
  - `/admin/dashboard` remains about `106 kB` first-load JS.
  - Shared first-load JS remains about `105 kB`.
  - Recurring Node `ExperimentalWarning: Type Stripping...` appeared during build.
- Broad select scan command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Timestamp check: `2026-05-13 19:32:40 IST`.
- Result: clean, no broad Supabase select matches in audited server/API paths.

## 2026-05-13 19:33 IST - Reports Room Count Egress Analysis

- Timestamp check: `2026-05-13 19:33:44 IST`.
- Scan/read targets:
  - `src/hooks/app-data-load-plan.ts`
  - `src/app/admin/reports/components/occupancy-report.tsx`
  - `src/hooks/use-report-reservations.ts`
  - `src/lib/server/report-reservations.ts`
  - `src/app/api/admin/reports/reservations/route.ts`
- Findings:
  - `/admin/reports` still loads all `rooms` through app-data startup.
  - `OccupancyReport` only needs the total room denominator, not full room rows.
  - The reports reservations API already supplies the date-window reservation payload; it can include a narrow non-maintenance room count so `/admin/reports` can drop `rooms` from startup data.
  - `RevenueReport` imports `useDataContext` but does not use it.

## 2026-05-13 19:34 IST - Reports Room Count Egress Red Tests

- Timestamp check: `2026-05-13 19:34:41 IST`.
- Updated report route-plan tests to expect `/admin/reports` startup data to be `["property"]` and not call `api.getRooms()`.
- Updated report server/API/hook tests to require a `roomsForSaleCount` returned from the report reservations API.
- Added a source guard requiring `OccupancyReport` to use `roomsForSaleCount` instead of `useDataContext`/`rooms.length`.
- Red test command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reports/reports-code-splitting.test.ts src/lib/server/report-reservations.test.ts src/app/api/admin/reports/reservations/route.test.ts src/hooks/use-report-reservations.test.tsx`
- Timestamp check: `2026-05-13 19:35:07 IST`.
- Intended red result: failed because reports still load rooms in app-data, `OccupancyReport` still reads global `rooms`, the report API still wraps the server result as `{ data }`, and the report hook does not expose `roomsForSaleCount`.

## 2026-05-13 19:36 IST - Reports Room Count Egress Implementation

- Timestamp check: `2026-05-13 19:36:41 IST`.
- Reduced `/admin/reports` app-data startup plan to `["property"]`.
- Extended the report reservations server helper/API/hook response with `roomsForSaleCount`.
- Added a narrow Supabase room count query using `select("id", { count: "exact", head: true })` and `neq("status", "Maintenance")`.
- Updated `OccupancyReport` to use `roomsForSaleCount` instead of global room rows.
- Removed the unused `useDataContext` import from `RevenueReport`.
- Focused test command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reports/reports-code-splitting.test.ts src/lib/server/report-reservations.test.ts src/app/api/admin/reports/reservations/route.test.ts src/hooks/use-report-reservations.test.tsx`
- Timestamp check: `2026-05-13 19:37:04 IST`.
- Result: passed, 6 files / 63 tests.
- TypeScript command: `pnpm exec tsc --noEmit`
- Timestamp check: `2026-05-13 19:37:19 IST`.
- Result: passed.
- Full test command: `pnpm test`
- Timestamp check: `2026-05-13 19:37:51 IST`.
- Result: passed, 113 files / 279 tests.
- Build command: `pnpm build`
- Timestamp check: `2026-05-13 19:38:55 IST`.
- Result: passed.
- Build observations:
  - `/admin/reports` remains about `106 kB` first-load JS.
  - `/api/admin/reports/reservations` remains present as the reports data route.
  - Shared first-load JS remains about `105 kB`.
  - Recurring Node `ExperimentalWarning: Type Stripping...` appeared during build.
- Broad select scan command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Timestamp check: `2026-05-13 19:39:13 IST`.
- Result: clean, no broad Supabase select matches in audited server/API paths.

## 2026-05-13 19:39 IST - Guest Detail Room Lookup Egress Analysis

- Timestamp check: `2026-05-13 19:39:57 IST`.
- Scan/read targets:
  - `src/hooks/app-data-load-plan.ts`
  - `src/app/admin/guests/[id]/guest-details-client.tsx`
  - `src/hooks/use-guest-reservations.ts`
  - `src/lib/server/guest-reservations.ts`
  - `src/lib/guests/reservations.ts`
- Findings:
  - `/admin/guests/[id]` still loads all `rooms` through app-data startup.
  - The guest details page only uses those room rows to display room numbers in reservation history.
  - The existing guest-reservations API can include `room:rooms(room_number)` so the detail page can drop full-room startup data.

## 2026-05-13 19:40 IST - Guest Detail Room Lookup Egress Red Tests

- Timestamp check: `2026-05-13 19:40:42 IST`.
- Updated guest-detail route-plan tests to expect startup data `["property"]` and no `api.getRooms()` call.
- Updated guest reservation server/hook tests to require `roomNumber` on each reservation history row.
- Added a guest-detail source guard so `GuestDetailsClient` uses route-backed reservation room numbers instead of global `rooms`.
- Red test command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/admin/guests/[id]/guest-detail-code-splitting.test.ts' src/lib/server/guest-reservations.test.ts src/hooks/use-guest-reservations.test.tsx`
- Timestamp check: `2026-05-13 19:41:04 IST`.
- Intended red result: failed because guest detail still loads `rooms`, `GuestDetailsClient` still maps room IDs through global rooms, and the guest-reservations server helper does not return `roomNumber`.

## 2026-05-13 19:41 IST - Guest Detail Room Lookup Egress Implementation

- Timestamp check: `2026-05-13 19:41:40 IST`.
- Reduced `/admin/guests/[id]` app-data startup plan to `["property"]`.
- Extended guest reservation history rows with `roomNumber`.
- Updated `getGuestReservations` to select `room:rooms(room_number)` and map the nested room number.
- Updated `GuestDetailsClient` to display the route-backed `roomNumber` instead of looking up global `rooms`.
- Focused test command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/admin/guests/[id]/guest-detail-code-splitting.test.ts' src/lib/server/guest-reservations.test.ts src/hooks/use-guest-reservations.test.tsx`
- Timestamp check: `2026-05-13 19:42:07 IST`.
- Result: passed, 5 files / 61 tests.
- TypeScript command: `pnpm exec tsc --noEmit`
- Timestamp check: `2026-05-13 19:42:24 IST`.
- Result: passed.
- Full test command: `pnpm test`
- Timestamp check: `2026-05-13 19:43:05 IST`.
- Result: passed, 113 files / 280 tests.
- Build command: `pnpm build`
- Timestamp check: `2026-05-13 19:43:58 IST`.
- Result: passed.
- Build observations:
  - `/admin/guests/[id]` remains about `106 kB` first-load JS.
  - `/api/admin/guests/[id]/reservations` remains present as the guest history data route.
  - Shared first-load JS remains about `105 kB`.
  - Recurring Node `ExperimentalWarning: Type Stripping...` appeared during build.
- Broad select scan command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Timestamp check: `2026-05-13 19:44:18 IST`.
- Result: clean, no broad Supabase select matches in audited server/API paths.

## 2026-05-13 19:46 IST - Reservation Detail Seasonal Price Egress Analysis

- Timestamp check: `2026-05-13 19:46:11 IST`.
- Scan/read targets:
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/app-data-load-plan.test.ts`
  - `src/hooks/use-app-data.load-plan.test.tsx`
  - `src/app/admin/reservations/[id]/reservation-details-client.tsx`
  - `src/app/admin/reservations/[id]/components/*`
- Findings:
  - `/admin/reservations/[id]` and `/admin/reservations/[id]/edit` currently share the same app-data plan.
  - The detail view uses property, rooms, room types, and rate plans, but no `seasonalPrices`.
  - The edit form still needs the fuller reservation workflow data, so the plan should split detail view from edit view.

## 2026-05-13 19:46 IST - Reservation Detail Seasonal Price Egress Red Tests

- Timestamp check: `2026-05-13 19:46:50 IST`.
- Updated route-plan tests to expect `/admin/reservations/[id]` to exclude `seasonalPrices` while `/admin/reservations/[id]/edit` still includes them.
- Updated `useAppData` route-plan tests to assert reservation detail startup does not call `api.getSeasonalPrices()`.
- Red test command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Timestamp check: `2026-05-13 19:47:19 IST`.
- Intended red result: failed because reservation detail currently shares the edit plan and still loads `seasonalPrices`.

## 2026-05-13 19:47 IST - Reservation Detail Seasonal Price Egress Implementation

- Timestamp check: `2026-05-13 19:47:39 IST`.
- Split reservation detail and reservation edit route plans.
- `/admin/reservations/[id]` now loads property, rooms, room types, and rate plans only.
- `/admin/reservations/[id]/edit` keeps the existing fuller edit workflow plan including seasonal prices.
- Focused test command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Timestamp check: `2026-05-13 19:47:59 IST`.
- Result: passed, 2 files / 57 tests.
- TypeScript command: `pnpm exec tsc --noEmit`
- Timestamp check: `2026-05-13 19:48:14 IST`.
- Result: passed.
- Full test command: `pnpm test`
- Timestamp check: `2026-05-13 19:48:51 IST`.
- Result: passed, 113 files / 281 tests.
- Build command: `pnpm build`
- Timestamp check: `2026-05-13 19:49:41 IST`.
- Result: passed.
- Build observations:
  - `/admin/reservations/[id]` remains about `106 kB` first-load JS.
  - `/admin/reservations/[id]/edit` remains about `106 kB` first-load JS.
  - Shared first-load JS remains about `105 kB`.
- Broad select scan command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Timestamp check: `2026-05-13 19:49:58 IST`.
- Result: clean, no broad Supabase select matches in audited server/API paths.

## 2026-05-13 19:50 IST - Next Target Scan

- Timestamp check: `2026-05-13 19:50:49 IST`.
- Commands:
  - `find src/app/admin -name page.tsx | sort`
  - `sed -n '1,340p' src/hooks/app-data-load-plan.ts`
  - `rg -n 'useDataContext\\(\\)|getReservations\\(|dashboardReservations|select\\([^\\n]*\\*|cache: "no-store"|force-dynamic' src/app src/components src/hooks src/lib src/server -S`
- Findings:
  - Admin route plans are now mostly narrow; known remaining heavier startup plans are intentional management/workflow routes.
  - The reservations invoice path still depends on room/room-type context, but that path is coupled to invoice output formatting.
  - Public home/room-preview traffic still starts with room types plus amenity datasets; this is a higher-volume public egress candidate for a route-backed compact preview payload.

## 2026-05-13 19:53 IST - Home Room Preview Egress Analysis

- Timestamp check: `2026-05-13 19:53:50 IST`.
- Read targets:
  - `src/components/marketing/home/RoomsShowcaseSection.tsx`
  - `src/app/(public)/home-deferred-sections.tsx`
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/use-app-data.ts`
  - `src/lib/api/index.ts`
- Findings:
  - The public home page uses `RoomsShowcaseSection` for four visible room cards.
  - Current `/` startup data fetches all visible/hidden `roomTypes`, all `room_type_amenities`, and all `amenities` through global app data.
  - The component only needs `id`, `name`, `description`, an image URL, and at most three amenity labels/icons for the selected preview cards.
- Research refresh:
  - Supabase official docs recommend explicit selected columns and keeping row limits low to avoid accidental large payloads.
  - Supabase supports querying referenced/nested tables, but the simpler robust path here is a cached server helper with targeted selects for selected room type IDs and selected amenity IDs.
  - Next.js official caching docs recommend `unstable_cache` for database/non-fetch async functions and cache headers for repeated public Route Handler reads.
  - References: https://supabase.com/docs/reference/javascript/select, https://supabase.com/docs/guides/database/joins-and-nesting, https://nextjs.org/docs/app/building-your-application/data-fetching/caching

## 2026-05-13 19:55 IST - Home Room Preview Egress Red Tests

- Timestamp check: `2026-05-13 19:55:53 IST`.
- Updated home load-plan tests so `/` only hydrates `property` and does not startup-fetch `roomTypes`, `roomTypeAmenities`, or `amenities`.
- Added `useAppData` coverage for `/` to verify only `api.getProperty()` runs.
- Added a source guard requiring `RoomsShowcaseSection` to use `useRoomTypePreview` instead of global app data.
- Added server/API/hook tests for a cached compact room-preview payload from `/api/room-types/preview`.

## 2026-05-13 19:57 IST - Home Room Preview Egress Focused Red Gate

- Timestamp check: `2026-05-13 19:57:31 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/(public)/home-code-splitting.test.ts' src/lib/server/room-type-preview.test.ts src/app/api/room-types/preview/route.test.ts src/hooks/use-room-type-preview.test.tsx`
- Intended red result: failed because `/` still loads `roomTypes`, `roomTypeAmenities`, and `amenities`; `RoomsShowcaseSection` still uses `useDataContext`; and the compact preview server helper, API route, and client hook do not exist yet.

## 2026-05-13 19:59 IST - Home Room Preview Egress Implementation Setup

- Timestamp check: `2026-05-13 19:59:04 IST`.
- Created `src/lib/room-types/` for shared compact preview response types.

## 2026-05-13 20:00 IST - Home Room Preview Egress Implementation

- Timestamp check: `2026-05-13 20:00:58 IST`.
- Added compact room preview response types in `src/lib/room-types/preview.ts`.
- Added `src/lib/server/room-type-preview.ts` with targeted `room_types`, `room_type_amenities`, and `amenities` selects plus `unstable_cache`.
- Added `GET /api/room-types/preview` with public cache headers.
- Added `useRoomTypePreview()` and switched `RoomsShowcaseSection` off global room type and amenity context.
- Reduced the public `/` app-data plan to `property` only.

## 2026-05-13 20:01 IST - Home Room Preview Egress Focused Green Gate

- Timestamp check: `2026-05-13 20:01:14 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/(public)/home-code-splitting.test.ts' src/lib/server/room-type-preview.test.ts src/app/api/room-types/preview/route.test.ts src/hooks/use-room-type-preview.test.tsx`
- Result: passed, 6 files / 64 tests.

## 2026-05-13 20:01 IST - Home Room Preview Egress Type Gate

- Timestamp check: `2026-05-13 20:01:34 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 20:02 IST - Home Room Preview Egress Full Test Gate

- Timestamp check: `2026-05-13 20:02:05 IST`.
- Command: `pnpm test`
- Result: passed, 116 files / 286 tests.

## 2026-05-13 20:02 IST - Home Room Preview Egress Build Gate

- Timestamp check: `2026-05-13 20:02:53 IST`.
- Command: `pnpm build`
- Result: passed.
- Build note: `/` remains static with 1h revalidation, and `/api/room-types/preview` is present as the cached public preview endpoint.

## 2026-05-13 20:03 IST - Home Room Preview Egress Select Scan

- Timestamp check: `2026-05-13 20:03:05 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 20:03 IST - Home Room Preview Egress Diff Review

- Timestamp check: `2026-05-13 20:03:23 IST`.
- Commands: `git diff --stat`, targeted `git diff` for the home preview files, and `git status --short`.
- Finding: the focused home preview changes are isolated to the new compact preview path and `/` load-plan reduction; the worktree also contains many existing performance-pass changes and untracked tests/components that predate this pass and should not be reverted.

## 2026-05-13 20:03 IST - Home Room Preview Egress Component Cleanup

- Timestamp check: `2026-05-13 20:03:41 IST`.
- Removed unused `React` and `IconName` imports from `RoomsShowcaseSection` after switching amenity icons to the compact preview payload.

## 2026-05-13 20:03 IST - Home Room Preview Egress Focused Regate

- Timestamp check: `2026-05-13 20:03:59 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/(public)/home-code-splitting.test.ts' src/lib/server/room-type-preview.test.ts src/app/api/room-types/preview/route.test.ts src/hooks/use-room-type-preview.test.tsx`
- Result: passed, 6 files / 64 tests.

## 2026-05-13 20:04 IST - Home Room Preview Egress Type Regate

- Timestamp check: `2026-05-13 20:04:14 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 20:04 IST - Home Room Preview Egress Full Test Regate

- Timestamp check: `2026-05-13 20:04:44 IST`.
- Command: `pnpm test`
- Result: passed, 116 files / 286 tests.

## 2026-05-13 20:05 IST - Home Room Preview Egress Build Regate

- Timestamp check: `2026-05-13 20:05:36 IST`.
- Command: `pnpm build`
- Result: passed.
- Build note: `/` remains static with 1h revalidation, and `/api/room-types/preview` remains present.

## 2026-05-13 20:05 IST - Home Room Preview Egress Select Rescan

- Timestamp check: `2026-05-13 20:05:46 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 20:06 IST - Next Egress Candidate Scan

- Timestamp check: `2026-05-13 20:06:08 IST`.
- Commands:
  - `rg -n "useDataContext\\(" src/app src/components src/hooks -S`
  - `rg -n "PUBLIC_BOOKING|public-booking|roomTypes|ratePlans|seasonalPrices|propertyClosures|amenities" src/app/(public)/book src/components/public src/hooks src/lib/server/public-booking.ts src/hooks/app-data-load-plan.ts -S`
  - `rg -n "get[A-Za-z]+\\(|from\\(\\\"|from\\('\\w" src/app/api src/lib/server src/hooks -S`
- Findings:
  - Public booking routes remain the main public startup-data egress surface.
  - `/book/rooms/[id]`, `/book/review`, and `/book` still hydrate broad `roomTypes`, `ratePlans`, `seasonalPrices`, `propertyClosures`, and sometimes `amenities` through global app data.
  - The likely next high-value pass is a room-detail route-backed payload for `/book/rooms/[id]`, because that page has the room type id in the URL and should not need all public room types or all amenities at startup.

## 2026-05-13 20:06 IST - Public Room Detail Egress Analysis

- Timestamp check: `2026-05-13 20:06:36 IST`.
- Read targets:
  - `src/app/(public)/book/rooms/[id]/room-detail-client.tsx`
  - `src/app/(public)/book/rooms/[id]/components/room-booking-panel.tsx`
  - `src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts`
  - `src/hooks/app-data-load-plan.test.ts`
- Findings:
  - The detail route uses one URL room type id, but global app data currently hydrates all room types, all room-type amenity links, all amenities, all rate plans, all seasonal prices, and all property closures.
  - The page needs the selected room type, up to three related visible room types, amenity labels for those room types, one standard/default rate plan, seasonal prices, and closures scoped to either the selected room type or property-wide closures.
  - The existing booking panel already uses route-backed inventory and date-scoped availability checks, so the next pass can focus on removing broad startup datasets from `/book/rooms/[id]`.

## 2026-05-13 20:07 IST - Public Room Detail Egress Design Read

- Timestamp check: `2026-05-13 20:07:46 IST`.
- Read targets:
  - `src/components/public/room-type-card.tsx`
  - `src/app/(public)/book/rooms/[id]/components/room-amenities-section.tsx`
  - `src/lib/pricing-calculator.ts`
  - `src/lib/server/public-booking.ts`
- Findings:
  - Related room cards only need compact room-type rows plus amenity labels/icons; `RoomTypeCard` can accept optional preloaded amenities while keeping existing global-context behavior for other routes.
  - The room booking panel needs the selected room type, one rate plan, selected-room seasonal prices, and selected/property-wide closures.
  - A targeted public room-detail API can query the selected room type by id, three related visible room types, amenity links for those four ids, selected amenity labels, standard/fallback rate plan, selected-room seasonal prices, and selected/property-wide closures.

## 2026-05-13 20:10 IST - Public Room Detail Egress Red Tests

- Timestamp check: `2026-05-13 20:10:37 IST`.
- Added load-plan and `useAppData` tests requiring `/book/rooms/[id]` to hydrate only `property` at startup.
- Added a room detail source guard requiring `useRoomTypeDetail` and optional preloaded amenities for related room cards.
- Added server/API/hook tests for a targeted `/api/room-types/[id]/detail` payload.

## 2026-05-13 20:11 IST - Public Room Detail Egress Focused Red Gate

- Timestamp check: `2026-05-13 20:11:11 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts' src/lib/server/room-type-detail.test.ts 'src/app/api/room-types/[id]/detail/route.test.ts' src/hooks/use-room-type-detail.test.tsx`
- Intended red result: failed because `/book/rooms/[id]` still hydrates broad public booking datasets, `RoomDetailClient` still uses global booking data, and the room-detail helper/route/hook do not exist yet.

## 2026-05-13 20:13 IST - Public Room Detail Egress Implementation

- Timestamp check: `2026-05-13 20:13:19 IST`.
- Added shared public room-detail response types.
- Added `src/lib/server/room-type-detail.ts` with targeted selected-room, related-room, amenity, standard-rate, seasonal-price, and closure queries plus cache wrapping.
- Added `GET /api/room-types/[id]/detail` with public cache headers.
- Added `useRoomTypeDetail()` and switched `RoomDetailClient` to the route-backed payload while keeping global app data for property only.
- Updated `RoomTypeCard` to accept optional preloaded amenity labels/icons for related cards.
- Reduced the public `/book/rooms/[id]` app-data plan to `property` only.

## 2026-05-13 20:14 IST - Public Room Detail Egress Focused Green Gate

- Timestamp check: `2026-05-13 20:14:03 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts' src/lib/server/room-type-detail.test.ts 'src/app/api/room-types/[id]/detail/route.test.ts' src/hooks/use-room-type-detail.test.tsx`
- Result: passed, 6 files / 71 tests.

## 2026-05-13 20:14 IST - Public Room Detail Egress Type Gate

- Timestamp check: `2026-05-13 20:14:40 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 20:15 IST - Public Room Detail Egress Full Test Gate

- Timestamp check: `2026-05-13 20:15:19 IST`.
- Command: `pnpm test`
- Result: passed, 119 files / 293 tests.

## 2026-05-13 20:16 IST - Public Room Detail Egress Build Gate

- Timestamp check: `2026-05-13 20:16:12 IST`.
- Command: `pnpm build`
- Result: passed.
- Build note: `/api/room-types/[id]/detail` is present in the route table, and `/book/rooms/[id]` still builds successfully.

## 2026-05-13 20:16 IST - Public Room Detail Egress Select Scan

- Timestamp check: `2026-05-13 20:16:30 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 20:17 IST - Public Room Detail Diff Review And Next Candidate

- Timestamp check: `2026-05-13 20:17:10 IST`.
- Commands: targeted `git diff` for room-detail files and `rg` scan for remaining public booking `useDataContext`/dataset reads.
- Finding: the room detail page now uses the compact detail payload, while remaining broad public booking egress is concentrated in `/book` search and `/book/review`.
- Next candidate: `/book/review`, because it has selected room type ids and dates in query params and currently hydrates all room types, rate plans, seasonal prices, and closures through global app data.

## 2026-05-13 20:17 IST - Public Booking Review Egress Analysis

- Timestamp check: `2026-05-13 20:17:32 IST`.
- Read targets:
  - `src/app/(public)/book/review/booking-review-client.tsx`
  - `src/app/(public)/book/review/book-review-code-splitting.test.ts`
- Findings:
  - `/book/review` has `roomTypeId`, `from`, `to`, `guests`, and `children` in the URL, but currently hydrates all room types, all rate plans, all seasonal prices, and all property closures through global app data.
  - The page needs only selected room types, a standard/fallback rate plan, selected-room seasonal prices for the check-in date, and property/selected-room closures overlapping the requested stay.
  - The final booking submission already posts to `/api/bookings/public`, so this pass can target display/validation egress without changing reservation creation.

## 2026-05-13 20:19 IST - Public Booking Review Egress Red Tests

- Timestamp check: `2026-05-13 20:19:37 IST`.
- Updated `/book/review` load-plan and `useAppData` tests to require property-only startup.
- Added a source guard requiring `useBookingReviewData` instead of global review lookup datasets.
- Added server/API/hook tests for selected-room review data through `/api/bookings/review-data`.

## 2026-05-13 20:19 IST - Public Booking Review Egress Focused Red Gate

- Timestamp check: `2026-05-13 20:19:58 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/(public)/book/review/book-review-code-splitting.test.ts' src/lib/server/booking-review.test.ts src/app/api/bookings/review-data/route.test.ts src/hooks/use-booking-review-data.test.tsx`
- Intended red result: failed because `/book/review` still hydrates broad public booking lookup datasets, `BookingReviewClient` still reads global review data, and the selected-room review helper/route/hook do not exist yet.

## 2026-05-13 20:22 IST - Public Booking Review Egress Implementation

- Timestamp check: `2026-05-13 20:22:19 IST`.
- Added selected-room booking review response types.
- Added `src/lib/server/booking-review.ts` with targeted selected room type, standard/fallback rate plan, date-scoped seasonal price, and overlapping closure queries.
- Added `GET /api/bookings/review-data` with public cache headers.
- Added `useBookingReviewData()` and switched `BookingReviewClient` to the selected-room payload while keeping global app data for property only.
- Reduced `/book/review` startup app-data to `property` only.

## 2026-05-13 20:22 IST - Public Booking Review Egress Focused Green Gate

- Timestamp check: `2026-05-13 20:22:50 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/(public)/book/review/book-review-code-splitting.test.ts' src/lib/server/booking-review.test.ts src/app/api/bookings/review-data/route.test.ts src/hooks/use-booking-review-data.test.tsx`
- Result: passed, 6 files / 70 tests.
- Warning noted: `useBookingReviewData` emitted a maximum update depth warning due to array identity in effect dependencies; cleanup follows before full gates.

## 2026-05-13 20:23 IST - Public Booking Review Hook Cleanup

- Timestamp check: `2026-05-13 20:23:12 IST`.
- Stabilized `useBookingReviewData` effect dependencies with a room-type id key so repeated renders do not refetch or warn on equivalent selected ids.

## 2026-05-13 20:23 IST - Public Booking Review Egress Focused Regate

- Timestamp check: `2026-05-13 20:23:41 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/(public)/book/review/book-review-code-splitting.test.ts' src/lib/server/booking-review.test.ts src/app/api/bookings/review-data/route.test.ts src/hooks/use-booking-review-data.test.tsx`
- Result: passed, 6 files / 70 tests, with no hook warning.

## 2026-05-13 20:24 IST - Public Booking Review Egress Type Gate

- Timestamp check: `2026-05-13 20:24:00 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: failed on `useBookingReviewData` URL-builder input types accepting nullable dates.

## 2026-05-13 20:24 IST - Public Booking Review Type Fix

- Timestamp check: `2026-05-13 20:24:21 IST`.
- Tightened `buildReviewDataUrl()` to accept concrete string dates after the hook's fetch guard has normalized them.

## 2026-05-13 20:24 IST - Public Booking Review Type Regate

- Timestamp check: `2026-05-13 20:24:37 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 20:25 IST - Public Booking Review Full Test Gate

- Timestamp check: `2026-05-13 20:25:13 IST`.
- Command: `pnpm test`
- Result: passed, 122 files / 299 tests.

## 2026-05-13 20:26 IST - Public Booking Review Build Gate

- Timestamp check: `2026-05-13 20:26:15 IST`.
- Command: `pnpm build`
- Result: passed.
- Build note: `/api/bookings/review-data` is present, and `/book/review` remains static with 1h revalidation.

## 2026-05-13 20:26 IST - Public Booking Review Select Scan

- Timestamp check: `2026-05-13 20:26:31 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 20:26 IST - Public Booking Search Egress Analysis

- Timestamp check: `2026-05-13 20:26:54 IST`.
- Commands:
  - `rg -n "PUBLIC_BOOKING_SEARCH_PLAN|PUBLIC_BOOKING_REVIEW_PLAN|PUBLIC_BOOKING_ROOM_PLAN|useDataContext\\(|roomTypes|ratePlans|seasonalPrices|propertyClosures|amenities" src/hooks/app-data-load-plan.ts 'src/app/(public)/book' src/components/public src/hooks/use-availability-search.tsx -S`
  - `sed -n '130,230p' 'src/app/(public)/book/booking-client.tsx'`
  - `sed -n '1,130p' src/hooks/use-availability-search.tsx`
- Findings:
  - `/book` search still hydrates global room types, room-type amenities, amenities, rate plans, seasonal prices, and property closures through `PUBLIC_BOOKING_SEARCH_PLAN`.
  - `BookingClient` uses global room types for initial room display/selection and global seasonal prices for date-based card prices.
  - `useAvailabilitySearch` reads global room types and property closures, then maps availability ids from `/api/availability/search` back to global visible room type rows.
  - Next candidate: move `/book` search to route-specific compact search metadata plus date-scoped availability/search data, preserving current room-card display behavior without global lookup datasets.

## 2026-05-13 20:29 IST - Public Booking Search Design Read

- Timestamp check: `2026-05-13 20:29:02 IST`.
- Read targets:
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/app-data-load-plan.test.ts`
  - `src/hooks/use-app-data.load-plan.test.tsx`
  - `src/app/(public)/book/booking-client.tsx`
  - `src/hooks/use-availability-search.tsx`
  - `src/lib/server/availability.ts`
  - `src/lib/availability/search.ts`
  - `src/components/public/room-type-card.tsx`
- Findings:
  - `/api/availability/search` already performs narrow room, reservation, restriction, and closure queries server-side, but returns only room type ids and availability counts.
  - The client still needs global visible room type rows and all seasonal prices to display the initial/search room cards.
  - `RoomTypeCard` now supports an optional `amenities` prop, so `/book` can pass route-backed amenity labels and stop relying on global `amenities`.
  - Best scoped pass: add compact booking search metadata for initial room cards, extend availability search to return matching room type rows and check-in-scoped seasonal prices, then reduce `/book` app data to property only.

## 2026-05-13 20:33 IST - Public Booking Search Egress Red Tests

- Timestamp check: `2026-05-13 20:33:59 IST`.
- Added failing coverage for:
  - `/book` app-data plan reduced to `property` only.
  - `useAppData` skipping global room type, amenity, rate plan, seasonal price, and closure calls on `/book`.
  - `BookingClient` using `useBookingSearchData` and passing route-backed amenities to `RoomTypeCard`.
  - `useAvailabilitySearch` no longer importing `DataContext` and exposing date-scoped seasonal prices from `/api/availability/search`.
  - New compact `/api/bookings/search-data` route, hook, and server helper.
  - Availability server query adding check-in-scoped `seasonal_prices` after availability has determined relevant room type ids.

## 2026-05-13 20:34 IST - Public Booking Search Focused Red Gate

- Timestamp check: `2026-05-13 20:34:26 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/(public)/book/book-code-splitting.test.ts' src/lib/server/booking-search.test.ts src/app/api/bookings/search-data/route.test.ts src/hooks/use-booking-search-data.test.tsx src/lib/server/availability.test.ts src/hooks/use-availability-search.test.tsx`
- Intended red result: failed because `/book` still loads global lookup datasets, `BookingClient` does not use `useBookingSearchData`, the compact search-data helper/route/hook do not exist, `useAvailabilitySearch` still imports `DataContext`, and availability results do not yet include check-in-scoped seasonal prices.

## 2026-05-13 20:37 IST - Public Booking Search Egress Implementation

- Timestamp check: `2026-05-13 20:37:43 IST`.
- Added `src/lib/booking/search.ts`, `src/lib/server/booking-search.ts`, `src/app/api/bookings/search-data/route.ts`, and `src/hooks/use-booking-search-data.ts`.
- Compact search metadata now loads visible room type card fields, linked amenity labels, and non-expired property closures with explicit column selects and public cache headers.
- Reduced `/book` app-data startup to `property` only.
- Reworked `useAvailabilitySearch` to accept route-backed room types/closures instead of reading `DataContext`, and to expose seasonal prices returned by `/api/availability/search`.
- Extended public availability search to fetch check-in-scoped seasonal prices only for room type ids relevant to the availability result.
- Switched `BookingClient` and the legacy `BookingDialog` to pass route-backed booking search metadata into availability search.

## 2026-05-13 20:38 IST - Public Booking Search Focused Green Gate

- Timestamp check: `2026-05-13 20:38:09 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/(public)/book/book-code-splitting.test.ts' src/lib/server/booking-search.test.ts src/app/api/bookings/search-data/route.test.ts src/hooks/use-booking-search-data.test.tsx src/lib/server/availability.test.ts src/hooks/use-availability-search.test.tsx`
- Result: passed, 8 files / 70 tests.

## 2026-05-13 20:38 IST - Public Booking Search Type Gate

- Timestamp check: `2026-05-13 20:38:27 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 20:39 IST - Public Booking Search Full Test Gate

- Timestamp check: `2026-05-13 20:39:09 IST`.
- Command: `pnpm test`
- Result: failed, 124 files passed / 1 file failed.
- Failure: `src/lib/availability/search.test.ts` expected the availability computation payload without the newly added `seasonalPrices: []` field.
- Next fix: update the pure availability search expectation to include the empty seasonal price list now carried by the public response type.

## 2026-05-13 20:39 IST - Public Booking Search Test Expectation Fix

- Timestamp check: `2026-05-13 20:39:27 IST`.
- Updated `src/lib/availability/search.test.ts` so the pure availability result expectation includes `seasonalPrices: []`.

## 2026-05-13 20:39 IST - Public Booking Search Focused Test Regate

- Timestamp check: `2026-05-13 20:39:42 IST`.
- Command: `pnpm vitest run src/lib/availability/search.test.ts`
- Result: passed, 1 file / 4 tests.

## 2026-05-13 20:40 IST - Public Booking Search Full Test Regate

- Timestamp check: `2026-05-13 20:40:21 IST`.
- Command: `pnpm test`
- Result: passed, 125 files / 305 tests.

## 2026-05-13 20:41 IST - Public Booking Search Build Gate

- Timestamp check: `2026-05-13 20:41:11 IST`.
- Command: `pnpm build`
- Result: passed.
- Build note: `/api/bookings/search-data` is present, `/book` remains static with 1h revalidation, and `/book` first-load JS is about `107 kB`.

## 2026-05-13 20:41 IST - Public Booking Search Select Scan

- Timestamp check: `2026-05-13 20:41:27 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 20:42 IST - Public Booking Search Diff Review

- Timestamp check: `2026-05-13 20:42:17 IST`.
- Commands: targeted `git diff` for booking search files, public/data-context scan, and public load-plan scan.
- Finding: `/book` startup lookup egress is reduced, but `BookingSummary` still reads global `ratePlans` and `seasonalPrices` from `DataContext`.
- Risk: because `/book` now uses property-only app data, the post-selection summary can lose the Standard Rate fallback and date-scoped seasonal override that were previously available through global app data.
- Follow-up inside the same pass: make `BookingSummary` accept route-backed `ratePlan` and date-scoped `seasonalPrices` props, and include only one compact Standard/fallback rate plan in `/api/bookings/search-data`.

## 2026-05-13 20:43 IST - Booking Summary Rate Data Red Tests

- Timestamp check: `2026-05-13 20:43:01 IST`.
- Added failing source coverage requiring `BookingClient` to pass route-backed `ratePlan` and `seasonalPrices` into `BookingSummary`, and requiring `BookingSummary` to stop reading global `ratePlans`/`seasonalPrices`.
- Updated booking search server coverage to require a compact Standard Rate row in `/api/bookings/search-data` while still forbidding broad `seasonal_prices` startup reads.

## 2026-05-13 20:43 IST - Booking Summary Rate Data Red Gate

- Timestamp check: `2026-05-13 20:43:21 IST`.
- Command: `pnpm vitest run 'src/app/(public)/book/book-code-splitting.test.ts' src/lib/server/booking-search.test.ts`
- Intended red result: failed because `BookingClient` still does not pass route-backed rate/seasonal data to `BookingSummary`, and `getPublicBookingSearchData()` does not yet include the compact Standard Rate row.

## 2026-05-13 20:44 IST - Booking Summary Rate Data Fix

- Timestamp check: `2026-05-13 20:44:59 IST`.
- Added a compact `ratePlan` field to public booking search data and server mapping.
- `GET /api/bookings/search-data` now returns `ratePlan: null` on fallback errors and the hook empty state includes `ratePlan: null`.
- `BookingSummary` now accepts `ratePlan` and `seasonalPrices` props and no longer reads global `ratePlans`/`seasonalPrices`.
- `BookingClient` passes the compact search-data rate plan and availability search date-scoped seasonal prices into `BookingSummary`.

## 2026-05-13 20:45 IST - Booking Summary Rate Data Focused Regate

- Timestamp check: `2026-05-13 20:45:20 IST`.
- Command: `pnpm vitest run 'src/app/(public)/book/book-code-splitting.test.ts' src/lib/server/booking-search.test.ts src/app/api/bookings/search-data/route.test.ts src/hooks/use-booking-search-data.test.tsx`
- Result: passed, 4 files / 7 tests.

## 2026-05-13 20:45 IST - Booking Summary Rate Data Type Regate

- Timestamp check: `2026-05-13 20:45:39 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 20:46 IST - Booking Summary Rate Data Full Test Regate

- Timestamp check: `2026-05-13 20:46:15 IST`.
- Command: `pnpm test`
- Result: passed, 125 files / 305 tests.

## 2026-05-13 20:47 IST - Booking Summary Rate Data Build Regate

- Timestamp check: `2026-05-13 20:47:09 IST`.
- Command: `pnpm build`
- Result: passed.
- Build note: `/api/bookings/search-data` remains present, `/book` remains static with 1h revalidation, and `/book` first-load JS remains about `107 kB`.

## 2026-05-13 20:47 IST - Booking Summary Rate Data Select Rescan

- Timestamp check: `2026-05-13 20:47:24 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 20:48 IST - Public Events And Shop Remainder Scan

- Timestamp check: `2026-05-13 20:48:31 IST`.
- Read targets:
  - `src/app/(public)/events/page.tsx`
  - `src/lib/server/events.ts`
  - `src/lib/server/events.test.ts`
  - `src/app/(public)/shop/page.tsx`
  - `src/app/(public)/shop/shop-catalog-client.tsx`
  - public `useDataContext`/fetch/select scan output
- Findings:
  - Public events already use explicit event columns, tagged `unstable_cache`, and 60-second revalidation with mutation invalidation.
  - Public shop catalog is local/static product data, not Supabase egress.
  - Remaining root-level performance candidate: `StickyBookingButton` is imported directly by root layout and reads global `roomTypes` from `DataContext`; route plans no longer hydrate those room types on most public routes, so the button mostly falls back to `/book` while still adding client popover/button code to every route.

## 2026-05-13 20:48 IST - Sticky Booking Button Red Tests

- Timestamp check: `2026-05-13 20:48:57 IST`.
- Added failing coverage requiring:
  - root layout to import a dynamic `StickyBookingButtonLoader` instead of the full sticky booking widget,
  - sticky booking button to use deferred `useRoomTypePreview` data instead of global `DataContext` room types,
  - `useRoomTypePreview(false)` to skip the preview API request until the popover is opened.

## 2026-05-13 20:49 IST - Sticky Booking Button Red Gate

- Timestamp check: `2026-05-13 20:49:37 IST`.
- Command: `pnpm vitest run src/components/sticky-booking-button-code-splitting.test.ts src/hooks/use-room-type-preview.test.tsx`
- Intended red result: failed because the sticky booking loader does not exist, the sticky button still imports `DataContext`, and `useRoomTypePreview(false)` still fetches immediately.

## 2026-05-13 20:50 IST - Sticky Booking Button Split And Deferred Preview

- Timestamp check: `2026-05-13 20:50:20 IST`.
- Added `src/components/sticky-booking-button-loader.tsx` and switched root layout to render the dynamic loader.
- Updated `StickyBookingButton` to remove `DataContext` and load compact room previews only when `isOpen && !isAdminRoute`.
- Updated `useRoomTypePreview(enabled)` so callers can defer `/api/room-types/preview` until a UI interaction requires it.

## 2026-05-13 20:50 IST - Sticky Booking Button Focused Green Gate

- Timestamp check: `2026-05-13 20:50:39 IST`.
- Command: `pnpm vitest run src/components/sticky-booking-button-code-splitting.test.ts src/hooks/use-room-type-preview.test.tsx`
- Result: passed, 2 files / 4 tests.

## 2026-05-13 20:51 IST - Sticky Booking Button Type Gate

- Timestamp check: `2026-05-13 20:51:05 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 20:51 IST - Sticky Booking Button Full Test Gate

- Timestamp check: `2026-05-13 20:51:38 IST`.
- Command: `pnpm test`
- Result: passed, 126 files / 308 tests.

## 2026-05-13 20:52 IST - Sticky Booking Button Build Gate

- Timestamp check: `2026-05-13 20:52:27 IST`.
- Command: `pnpm build`
- Result: passed.
- Build note: route table remains stable; `/book` stays about `107 kB` first-load JS and public static pages remain prerendered with their existing revalidation windows.

## 2026-05-13 20:52 IST - Sticky Booking Button Select Scan

- Timestamp check: `2026-05-13 20:52:39 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 20:53 IST - Admin Reservation Detail Egress Analysis

- Timestamp check: `2026-05-13 20:53:24 IST`.
- Read targets:
  - `src/app/admin/reservations/[id]/reservation-details-client.tsx`
  - `src/app/api/admin/reservations/[id]/booking/route.ts`
  - `src/lib/server/admin-reservation-booking.ts`
  - reservation detail cards for header, stay details, linked reservations, invoice buttons
- Findings:
  - Reservation detail already uses a route-backed `/api/admin/reservations/[id]/booking` payload for the reservation group and guest.
  - The page still keeps `rooms`, `roomTypes`, and `ratePlans` in the admin reservation detail app-data plan because child cards use those global lookups for room labels, rate-plan labels, and invoice/WhatsApp generation.
  - Next safe pass would extend the booking-details API with only the selected booking's rooms, room types, and rate plans, then pass those lookups into the detail cards while keeping `DataContext` only for property and mutation actions.

## 2026-05-13 20:54 IST - Admin Reservation Detail Supabase Research

- Timestamp check: `2026-05-13 20:54:48 IST`.
- Research source: Supabase JavaScript `select()` and filters reference.
- Relevant guidance: Supabase `select()` accepts explicit column lists, and filters such as `.in()` can restrict lookup tables to selected ids.
- Application to this pass: extend the existing booking-details route to return only lookup rows referenced by the selected reservation group instead of hydrating global `rooms`, `roomTypes`, and `ratePlans` in `useAppData`.

## 2026-05-13 20:57 IST - Admin Reservation Detail Red Tests

- Timestamp check: `2026-05-13 20:57:00 IST`.
- Updated app-data load-plan coverage to require admin reservation detail routes to load `property` only.
- Updated `useAppData` load-plan coverage to require no startup `getRooms()`, `getRoomTypes()`, or `getRatePlans()` on reservation detail routes, and to expect route-backed active booking lookup rows after `loadBookingDetails()`.
- Updated admin booking API/server tests to require selected booking `rooms`, `roomTypes`, and `ratePlans` payloads using explicit selects and `.in()` filters.
- Added source coverage requiring reservation detail cards to consume route-backed lookup props rather than global room/rate lookup datasets.

## 2026-05-13 20:58 IST - Admin Reservation Detail Red Gate

- Timestamp check: `2026-05-13 20:58:58 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/admin/reservations/[id]/reservation-detail-code-splitting.test.ts' src/lib/server/admin-reservation-booking.test.ts 'src/app/api/admin/reservations/[id]/booking/route.test.ts'`
- Result: failed as expected before implementation.
- Failures confirmed that the reservation detail route still loads global `rooms`, `roomTypes`, and `ratePlans`; the booking details API does not return selected booking lookup rows yet; and detail cards still read global lookup datasets.

## 2026-05-13 21:03 IST - Admin Reservation Detail Lookup Payload Implementation

- Timestamp check: `2026-05-13 21:03:10 IST`.
- Changed `ADMIN_RESERVATION_DETAIL_PLAN` to load only `property`.
- Extended `getAdminReservationBookingDetails()` to return selected booking `rooms`, `roomTypes`, and `ratePlans` using explicit column selects and `.in()` filters.
- Added active booking lookup state in `useAppData()` and exposed it through `DataContext`.
- Updated reservation detail client/card props so stay details, linked reservations, invoice download, and WhatsApp invoice actions use the selected booking lookup rows instead of global room/rate datasets.

## 2026-05-13 21:03 IST - Admin Reservation Detail Focused Green Gate

- Timestamp check: `2026-05-13 21:03:35 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/admin/reservations/[id]/reservation-detail-code-splitting.test.ts' src/lib/server/admin-reservation-booking.test.ts 'src/app/api/admin/reservations/[id]/booking/route.test.ts'`
- Result: passed, 5 files / 67 tests.

## 2026-05-13 21:03 IST - Admin Reservation Detail Type Gate

- Timestamp check: `2026-05-13 21:03:55 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 21:04 IST - Admin Reservation Detail Full Test Gate

- Timestamp check: `2026-05-13 21:04:33 IST`.
- Command: `pnpm test`
- Result: passed, 126 files / 309 tests.

## 2026-05-13 21:05 IST - Admin Reservation Detail Build Gate

- Timestamp check: `2026-05-13 21:05:24 IST`.
- Command: `pnpm build`
- Result: passed.
- Build note: `/admin/reservations/[id]` remains about `107 kB` first-load JS while its app-data startup payload no longer includes global room/rate lookup datasets.

## 2026-05-13 21:05 IST - Admin Reservation Detail Select Scan

- Timestamp check: `2026-05-13 21:05:43 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 21:08 IST - Admin Reservations Index Invoice Egress Analysis

- Timestamp check: `2026-05-13 21:08:00 IST`.
- Read targets:
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/use-app-data.ts`
  - `src/app/admin/reservations/components/reservations-panel.tsx`
  - `src/app/admin/reservations/components/columns.tsx`
  - `src/server/reservations/cache.ts`
  - `src/lib/server/admin-reservation-booking.ts`
- Findings:
  - `/admin/reservations` already uses the paginated `/api/admin/reservations` booking summary API and does not need global reservations or guests on startup.
  - The remaining startup `rooms` and `roomTypes` datasets are only used by table invoice download/view cells in `columns.tsx`.
  - The existing `/api/admin/reservations/[id]/booking` endpoint now returns selected booking rooms and room types, so invoice actions can fetch those rows on demand and the index app-data plan can become `property` only.

## 2026-05-13 21:08 IST - Admin Reservations Index Red Tests

- Timestamp check: `2026-05-13 21:08:41 IST`.
- Updated app-data load-plan coverage to require `/admin/reservations` to load only `property`.
- Updated `useAppData` load-plan coverage to require no startup `getRooms()` or `getRoomTypes()` calls on the reservations index.
- Added source coverage requiring reservation index invoice cells to fetch booking invoice lookup rows on demand through the admin booking API instead of reading global room/room-type lookups.

## 2026-05-13 21:08 IST - Admin Reservations Index Red Gate

- Timestamp check: `2026-05-13 21:08:58 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/reservations-index-egress.test.ts`
- Result: failed as expected before implementation.
- Failures confirmed that `/admin/reservations` still loads global `rooms` and `roomTypes`, and invoice cells still read global `guests`, `rooms`, and `roomTypes` instead of using the booking details API on demand.

## 2026-05-13 21:10 IST - Admin Reservations Index Invoice Lookup Implementation

- Timestamp check: `2026-05-13 21:10:20 IST`.
- Changed `/admin/reservations` app-data plan to load only `property`.
- Updated reservation index invoice download/view cells to keep only `property` from `DataContext`.
- Added on-demand `authorizedFetch()` loading from `/api/admin/reservations/[id]/booking` so invoice generation receives selected booking `reservations`, `guest`, `rooms`, and `roomTypes` only when the user clicks an invoice action.

## 2026-05-13 21:10 IST - Admin Reservations Index Focused Green Gate

- Timestamp check: `2026-05-13 21:10:41 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/reservations-index-egress.test.ts`
- Result: passed, 3 files / 61 tests.

## 2026-05-13 21:11 IST - Admin Reservations Index Type Gate

- Timestamp check: `2026-05-13 21:11:21 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 21:12 IST - Admin Reservations Index Full Test Gate

- Timestamp check: `2026-05-13 21:12:00 IST`.
- Command: `pnpm test`
- Result: passed, 127 files / 310 tests.

## 2026-05-13 21:12 IST - Admin Reservations Index Build Gate

- Timestamp check: `2026-05-13 21:12:52 IST`.
- Command: `pnpm build`
- Result: passed.
- Build note: `/admin/reservations` remains about `106 kB` first-load JS while its startup app-data payload no longer includes global room and room-type lookup datasets.

## 2026-05-13 21:13 IST - Admin Reservations Index Select Scan

- Timestamp check: `2026-05-13 21:13:04 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 21:13 IST - Public Property Hydration Egress Analysis

- Timestamp check: `2026-05-13 21:13:57 IST`.
- Read targets:
  - `src/hooks/use-app-data.ts`
  - `src/lib/api/index.ts`
  - `src/lib/server/public-property.ts`
  - `src/components/public/header.tsx`
  - `src/components/public/footer.tsx`
  - public booking summary/review/room booking components
- Findings:
  - Public app-data plans now mostly load only `property`, but `useAppData()` still calls the broad browser-side `api.getProperty()` for public routes.
  - `PROPERTY_SELECT_COLUMNS` includes admin/configuration fields and media fields that public header/footer/currency/tax UI does not need.
  - Public consumers currently need only `name`, `currency`, `tax_enabled`, and `tax_percentage` from context; public layout location is already handled by a separate cached server helper.
  - Next pass: add a cached public property API with an explicit narrow select and make non-admin app-data property loading use that route.

## 2026-05-13 21:15 IST - Public Property Hydration Red Tests

- Timestamp check: `2026-05-13 21:15:33 IST`.
- Added server helper coverage requiring a narrow cached public app property select for `id`, `name`, `currency`, and tax fields.
- Added `/api/public/property` route coverage requiring shared-cache headers.
- Updated `useAppData` coverage so public property-loading routes must call `/api/public/property` and not the broad browser-side `api.getProperty()`.

## 2026-05-13 21:15 IST - Public Property Hydration Red Gate

- Timestamp check: `2026-05-13 21:15:55 IST`.
- Command: `pnpm vitest run src/lib/server/public-property.test.ts src/app/api/public/property/route.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: failed as expected before implementation.
- Failures confirmed that the narrow cached public property helper and route do not exist yet, and public property routes still call the broad `api.getProperty()` path.

## 2026-05-13 21:16 IST - Public Property Hydration Implementation

- Timestamp check: `2026-05-13 21:16:51 IST`.
- Added cached public app property helper selecting only `id`, `name`, `currency`, `tax_enabled`, and `tax_percentage`.
- Added `/api/public/property` with shared public cache headers.
- Updated `useAppData()` so non-admin property plans use `/api/public/property` while admin routes continue using the full admin property query.

## 2026-05-13 21:17 IST - Public Property Hydration Focused Green Gate

- Timestamp check: `2026-05-13 21:17:12 IST`.
- Command: `pnpm vitest run src/lib/server/public-property.test.ts src/app/api/public/property/route.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 3 files / 27 tests.

## 2026-05-13 21:17 IST - Public Property Hydration Type Gate

- Timestamp check: `2026-05-13 21:17:27 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 21:18 IST - Public Property Hydration Full Test Gate

- Timestamp check: `2026-05-13 21:18:00 IST`.
- Command: `pnpm test`
- Result: passed, 128 files / 313 tests.

## 2026-05-13 21:18 IST - Public Property Hydration Build Gate

- Timestamp check: `2026-05-13 21:18:53 IST`.
- Command: `pnpm build`
- Result: passed.
- Build note: `/api/public/property` is statically prerendered with 1-hour revalidation, and public page first-load JS sizes remain stable.

## 2026-05-13 21:19 IST - Public Property Hydration Select Scan

- Timestamp check: `2026-05-13 21:19:06 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 21:20 IST - Admin Settings Data Tools Egress Analysis And Research

- Timestamp check: `2026-05-13 21:20:50 IST`.
- Read targets:
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/use-app-data.load-plan.test.tsx`
  - `src/app/admin/settings/settings-tabs.tsx`
  - `src/app/admin/settings/components/data-tools/csv-import-panel.tsx`
  - `src/lib/api/index.ts` room query helpers
- Findings:
  - `/admin/settings` still loads the global `rooms` dataset at startup only because `CsvImportPanel` needs room IDs/numbers for VikBooking room mapping.
  - The default settings panel is property settings; the data-tools panel is an occasional workflow and can load room options on demand.
  - `CsvImportPanel` only needs `id` and `roomNumber` for mapping select controls, not room photos, room type IDs, or housekeeping status.
- Research source: Supabase JavaScript `select()` and `order()` official docs.
- Relevant guidance: use explicit column lists in `select()` and order by a specific column for stable option lists.
- Next pass: add an admin room-options API with a narrow `id, room_number` select and switch `CsvImportPanel` to fetch those options when mounted, removing `rooms` from the settings app-data plan.

## 2026-05-13 21:22 IST - Admin Settings Data Tools Red Tests

- Timestamp check: `2026-05-13 21:22:12 IST`.
- Updated settings load-plan coverage to require no startup `rooms` dataset.
- Updated `useAppData` settings coverage to require no startup `api.getRooms()` call on `/admin/settings`.
- Added source coverage requiring `CsvImportPanel` to fetch `/api/admin/rooms/options` and stop reading global `rooms` from `DataContext`.
- Added server/API coverage for a narrow admin room-options query using `id, room_number` and stable `room_number` ordering.

## 2026-05-13 21:22 IST - Admin Settings Data Tools Red Gate

- Timestamp check: `2026-05-13 21:22:35 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/settings/settings-egress.test.ts src/lib/server/admin-room-options.test.ts src/app/api/admin/rooms/options/route.test.ts`
- Result: failed as expected before implementation.
- Failures confirmed that settings still loads global `rooms`, `CsvImportPanel` still reads rooms from `DataContext`, and the narrow room-options helper/API do not exist yet.

## 2026-05-13 21:24 IST - Admin Settings Data Tools Room Options Implementation

- Timestamp check: `21:24 IST`.
- Removed `rooms` from the `/admin/settings` app-data load plan.
- Added `src/lib/server/admin-room-options.ts` with a narrow `id, room_number` Supabase select and stable `room_number` ordering.
- Added `/api/admin/rooms/options` with admin auth and `Cache-Control: private, no-store`.
- Updated `CsvImportPanel` to stop reading global `rooms` from `DataContext` and load narrow room options on demand when VikBooking room mapping issues are present.

## 2026-05-13 21:25 IST - Admin Settings Data Tools Focused Green Gate

- Timestamp check: `2026-05-13 21:25:20 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/settings/settings-egress.test.ts src/lib/server/admin-room-options.test.ts src/app/api/admin/rooms/options/route.test.ts`
- Result: passed, 5 files / 63 tests.

## 2026-05-13 21:25 IST - Admin Settings Data Tools Type Gate

- Timestamp check: `2026-05-13 21:25:40 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 21:26 IST - Admin Settings Data Tools Full Test Gate

- Timestamp check: `2026-05-13 21:26:14 IST`.
- Command: `pnpm test`
- Result: passed, 131 files / 316 tests.

## 2026-05-13 21:27 IST - Admin Settings Data Tools Build Gate

- Timestamp check: `2026-05-13 21:27:00 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/api/admin/rooms/options` is present as a dynamic API route, and `/admin/settings` remains a small route shell at about `107 kB` first-load JS.

## 2026-05-13 21:27 IST - Admin Settings Data Tools Select Scan

- Timestamp check: `2026-05-13 21:27:14 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 21:28 IST - Admin Settings Amenities Egress Analysis And Research

- Timestamp check: `2026-05-13 21:28:41 IST`.
- Read targets:
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/use-app-data.ts`
  - `src/context/data-context.tsx`
  - `src/app/admin/settings/settings-tabs.tsx`
  - `src/app/admin/settings/components/amenities-management.tsx`
  - `src/app/admin/settings/components/amenities-data-table.tsx`
  - `src/app/admin/settings/components/amenity-form-dialog.tsx`
  - `src/lib/api/index.ts`
- Findings:
  - `/admin/settings` still loads `amenities` at startup even though the Amenities tab is dynamically mounted and not part of the default Property tab.
  - The existing amenity CRUD functions in `useAppData` own optimistic state and activity logging, so the low-risk path is to add an on-demand `refetchAmenities()` context method instead of moving mutations into a separate component-owned path.
  - `getAmenities()` already uses explicit `AMENITY_SELECT_COLUMNS`, so this pass targets startup egress rather than query shape.
- Research sources: Supabase JavaScript `select()` and `order()` official docs.
- Relevant guidance: request only needed columns with `select(columns)` and use stable ordering where option/display order matters.
- Next pass: remove `amenities` from the settings app-data plan, add an on-demand amenity refetch method, and have the Amenities tab hydrate its table when mounted.

## 2026-05-13 21:29 IST - Admin Settings Amenities Red Tests

- Timestamp check: `2026-05-13 21:29:30 IST`.
- Updated settings load-plan coverage to require no startup `amenities` dataset.
- Updated `useAppData` settings coverage to require no startup `api.getAmenities()` call and added coverage for an explicit `refetchAmenities()` path.
- Added source coverage requiring the Amenities tab component to call `refetchAmenities()` when it mounts.

## 2026-05-13 21:29 IST - Admin Settings Amenities Red Gate

- Timestamp check: `2026-05-13 21:29:47 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/settings/settings-egress.test.ts`
- Result: failed as expected before implementation.
- Failures confirmed that settings still includes `amenities`, `useAppData` still calls `api.getAmenities()` during `/admin/settings` startup, and the Amenities tab does not call `refetchAmenities()` yet.

## 2026-05-13 21:30 IST - Admin Settings Amenities On-Demand Hydration Implementation

- Timestamp check: `2026-05-13 21:30:20 IST`.
- Removed `amenities` from the `/admin/settings` app-data load plan.
- Added `refetchAmenities()` to `useAppData` and the data context contract.
- Updated `AmenitiesManagement` to call `refetchAmenities()` when the dynamically mounted Amenities tab loads, preserving existing amenity CRUD ownership and activity logging.

## 2026-05-13 21:30 IST - Admin Settings Amenities Focused Green Gate

- Timestamp check: `2026-05-13 21:30:37 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/settings/settings-egress.test.ts`
- Result: passed, 3 files / 63 tests.

## 2026-05-13 21:30 IST - Admin Settings Amenities Type Gate

- Timestamp check: `2026-05-13 21:30:56 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: failed.
- Failure: `src/hooks/use-app-data.load-plan.test.tsx` inferred the new `getAmenities` mock return data as `never[]`, rejecting the concrete amenity fixture.

## 2026-05-13 21:31 IST - Admin Settings Amenities Test Type Fix

- Timestamp check: `2026-05-13 21:31:15 IST`.
- Updated the `getAmenities` mock in `src/hooks/use-app-data.load-plan.test.tsx` to type amenity fixture rows explicitly.

## 2026-05-13 21:31 IST - Admin Settings Amenities Focused Recheck

- Timestamp check: `2026-05-13 21:31:35 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/settings/settings-egress.test.ts`
- Result: passed, 3 files / 63 tests.

## 2026-05-13 21:31 IST - Admin Settings Amenities Type Gate Recheck

- Timestamp check: `2026-05-13 21:31:55 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 21:32 IST - Admin Settings Amenities Full Test Gate

- Timestamp check: `2026-05-13 21:32:27 IST`.
- Command: `pnpm test`
- Result: passed, 131 files / 318 tests.

## 2026-05-13 21:33 IST - Admin Settings Amenities Build Gate

- Timestamp check: `2026-05-13 21:33:16 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/admin/settings` remains about `107 kB` first-load JS while the settings startup data plan no longer includes the `amenities` dataset.

## 2026-05-13 21:33 IST - Admin Settings Amenities Select Scan

- Timestamp check: `2026-05-13 21:33:32 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 21:34 IST - Admin Settings Roles And Users Egress Analysis

- Timestamp check: `2026-05-13 21:34:24 IST`.
- Read targets:
  - `src/app/admin/settings/components/roles-permissions.tsx`
  - `src/app/admin/settings/components/roles-data-table.tsx`
  - `src/app/admin/settings/components/role-form-dialog.tsx`
  - `src/app/admin/settings/components/users-management.tsx`
  - `src/app/admin/settings/components/users-data-table.tsx`
  - `src/app/admin/settings/components/user-form-dialog.tsx`
  - `src/app/admin/settings/components/users-columns.tsx`
  - `src/hooks/use-app-data.ts`
  - `src/context/data-context.tsx`
  - `src/lib/api/index.ts`
- Findings:
  - `/admin/settings` still loads `roles` and `users` at startup, but the Roles and Users tabs are dynamically mounted and are not part of the default Property tab.
  - Existing role/user mutations depend on context-owned state and activity logging, so the low-risk path is to add `refetchRoles()` and reuse the existing `refetchUsers()`.
  - The Users tab needs both users and roles for role labels, permissions, and assignment controls; it should hydrate both when mounted.
- `getRoles()` already uses explicit `ROLE_SELECT_COLUMNS`; users are fetched through the existing `get-users` Edge Function path.
- Next pass: remove `roles` and `users` from the settings app-data plan, add on-demand role hydration, and have Roles/Users tabs hydrate their needed context data when mounted.

## 2026-05-13 21:35 IST - Admin Settings Roles And Users Red Tests

- Timestamp check: `2026-05-13 21:35:12 IST`.
- Updated settings load-plan coverage to require no startup `roles` or `users` datasets.
- Updated `useAppData` settings coverage to require no startup `api.getRoles()` or `api.getUsers()` calls and added coverage for explicit `refetchRoles()`/`refetchUsers()` hydration.
- Added source coverage requiring the Roles tab to call `refetchRoles()` and the Users tab to call both `refetchRoles()` and `refetchUsers()`.

## 2026-05-13 21:35 IST - Admin Settings Roles And Users Red Gate

- Timestamp check: `2026-05-13 21:35:31 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/settings/settings-egress.test.ts`
- Result: failed as expected before implementation.
- Failures confirmed that settings still includes `roles`/`users`, startup still calls `api.getRoles()`/`api.getUsers()`, and the Roles/Users tab components do not call the new refetch paths yet.

## 2026-05-13 21:36 IST - Admin Settings Roles And Users On-Demand Hydration Implementation

- Timestamp check: `2026-05-13 21:36:10 IST`.
- Removed `roles` and `users` from the `/admin/settings` app-data load plan.
- Added `refetchRoles()` to `useAppData` and the data context contract, reusing existing DB role mapping.
- Updated `RolesPermissions` to hydrate roles when the dynamically mounted Roles tab loads.
- Updated `UsersManagement` to hydrate both roles and users when the dynamically mounted Users tab loads.

## 2026-05-13 21:36 IST - Admin Settings Roles And Users Focused Green Gate

- Timestamp check: `2026-05-13 21:36:35 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/settings/settings-egress.test.ts`
- Result: passed, 3 files / 65 tests.

## 2026-05-13 21:36 IST - Admin Settings Roles And Users Type Gate

- Timestamp check: `2026-05-13 21:36:55 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 21:37 IST - Admin Settings Roles And Users Full Test Gate

- Timestamp check: `2026-05-13 21:37:29 IST`.
- Command: `pnpm test`
- Result: passed, 131 files / 320 tests.

## 2026-05-13 21:38 IST - Admin Settings Roles And Users Build Gate

- Timestamp check: `2026-05-13 21:38:20 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/admin/settings` remains about `107 kB` first-load JS while the settings startup data plan no longer includes `roles` or `users`.

## 2026-05-13 21:38 IST - Admin Settings Roles And Users Select Scan

- Timestamp check: `2026-05-13 21:38:33 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 21:39 IST - Admin Settings Property Closures Egress Analysis

- Timestamp check: `2026-05-13 21:39:31 IST`.
- Read targets:
  - `src/app/admin/settings/components/property-closures-section.tsx`
  - `src/app/admin/settings/components/property-closure-form-dialog.tsx`
  - `src/hooks/use-app-data.ts`
  - `src/context/data-context.tsx`
  - `src/lib/api/index.ts`
- Findings:
  - `/admin/settings` now still loads `roomTypes` and `propertyClosures` at startup only for the default Property tab's blocked-date section.
  - The blocked-date table and form need property closure rows plus room type `id`/`name` labels, not full room type descriptions, prices, photos, visibility, or amenity linkage.
- Existing closure add/update/delete mutations should stay in `useAppData` for activity logging; delete needs the local closure row passed through when the global context no longer owns the closure list at startup.
- Next pass: add a narrow authenticated settings closures API returning property closures and room type options, switch the closure section to local route-backed data, and reduce the settings app-data plan to property-only.

## 2026-05-13 21:40 IST - Admin Settings Property Closures Red Tests

- Timestamp check: `2026-05-13 21:40:53 IST`.
- Updated settings load-plan coverage to require a property-only `/admin/settings` startup plan with no `roomTypes` or `propertyClosures`.
- Updated `useAppData` settings coverage to require no startup `api.getRoomTypes()` or `api.getPropertyClosures()` calls.
- Added source coverage requiring `PropertyClosuresSection` to fetch `/api/admin/settings/property-closures`.
- Added server/API coverage for a narrow settings closures helper and route that return property closures plus room type `id`/`name` options with no-store headers.

## 2026-05-13 21:41 IST - Admin Settings Property Closures Red Gate

- Timestamp check: `2026-05-13 21:41:17 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/settings/settings-egress.test.ts src/lib/server/admin-settings-property-closures.test.ts src/app/api/admin/settings/property-closures/route.test.ts`
- Result: failed as expected before implementation.
- Failures confirmed that settings still includes `roomTypes`/`propertyClosures`, startup still calls `api.getRoomTypes()`/`api.getPropertyClosures()`, `PropertyClosuresSection` still reads context datasets, and the narrow helper/API do not exist yet.

## 2026-05-13 21:43 IST - Admin Settings Property Closures Route-Backed Implementation

- Timestamp check: `2026-05-13 21:43:02 IST`.
- Reduced the `/admin/settings` app-data load plan to `property` only.
- Added `src/lib/server/admin-settings-property-closures.ts` with narrow ordered selects for property closures and room type `id`/`name` options.
- Added `/api/admin/settings/property-closures` with admin auth and `Cache-Control: private, no-store`.
- Updated `PropertyClosuresSection` to keep local route-backed closure/room-type option state instead of reading global `propertyClosures`/`roomTypes` from `DataContext`.
- Updated `PropertyClosureFormDialog` to receive `propertyId`, room type options, and an `onSaved` refresh callback.
- Allowed `deletePropertyClosure()` to receive the local closure row so activity logging still has the deleted closure label after removing the global startup dataset.

## 2026-05-13 21:43 IST - Admin Settings Property Closures Focused Green Gate

- Timestamp check: `2026-05-13 21:43:34 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/settings/settings-egress.test.ts src/lib/server/admin-settings-property-closures.test.ts src/app/api/admin/settings/property-closures/route.test.ts`
- Result: passed, 5 files / 68 tests.

## 2026-05-13 21:43 IST - Admin Settings Property Closures Type Gate

- Timestamp check: `2026-05-13 21:43:54 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 21:44 IST - Admin Settings Property Closures Full Test Gate

- Timestamp check: `2026-05-13 21:44:32 IST`.
- Command: `pnpm test`
- Result: passed, 133 files / 323 tests.

## 2026-05-13 21:45 IST - Admin Settings Property Closures Build Gate

- Timestamp check: `2026-05-13 21:45:22 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/api/admin/settings/property-closures` is present as a dynamic API route, and `/admin/settings` remains about `107 kB` first-load JS while its app-data startup plan is now property-only.

## 2026-05-13 21:45 IST - Admin Settings Property Closures Select Scan

- Timestamp check: `2026-05-13 21:45:38 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 21:46 IST - Remaining App-Data Plan Inventory

- Timestamp check: `2026-05-13 21:46:05 IST`.
- Read targets:
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/app-data-load-plan.test.ts`
  - `src/hooks/use-app-data.load-plan.test.tsx`
  - admin component `useDataContext()` call sites
- Findings:
  - `/admin/settings` is now property-only at startup.
- Remaining route-specific startup datasets are concentrated in operational CRUD pages: `/admin/rooms`, `/admin/room-types`, `/admin/rates`, `/admin/housekeeping`, and reservation create/edit flows.
- The next low-risk target is `/admin/room-categories`: it still loads the full `roomCategories` dataset at route startup, while the page is route-local and can hydrate categories through a narrow authenticated API without affecting other modules.

## 2026-05-13 21:47 IST - Public Room Type Card Context Fallback Analysis

- Timestamp check: `2026-05-13 21:47:16 IST`.
- Read targets:
  - `src/components/public/room-type-card.tsx`
  - `src/app/(public)/book/booking-client.tsx`
  - `src/app/(public)/book/rooms/[id]/room-detail-client.tsx`
  - `src/components/marketing/home/OurRoomsSection.tsx`
- Findings:
  - Live booking callers pass compact route-backed amenity arrays into `RoomTypeCard`.
  - `RoomTypeCard` still falls back to `useDataContext().amenities`, which is unnecessary for current route-backed booking pages and creates accidental pressure to hydrate public amenities globally.
- `OurRoomsSection` is not imported anywhere and is the only local caller that still omits the `amenities` prop.
- Next pass: remove the `DataContext` amenity fallback from `RoomTypeCard` and treat missing amenity props as an empty list.

## 2026-05-13 21:47 IST - Public Room Type Card Red Test

- Timestamp check: `2026-05-13 21:47:37 IST`.
- Updated room-detail source coverage to require `RoomTypeCard` to avoid `useDataContext` for amenity fallback.

## 2026-05-13 21:47 IST - Public Room Type Card Red Gate

- Timestamp check: `2026-05-13 21:47:56 IST`.
- Command: `pnpm vitest run 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts'`
- Result: failed as expected before implementation.
- Failure confirmed `RoomTypeCard` still imports and calls `useDataContext` for amenity fallback.

## 2026-05-13 21:48 IST - Public Room Type Card Context Fallback Removal

- Timestamp check: `2026-05-13 21:48:16 IST`.
- Removed the `DataContext` import and amenity fallback from `RoomTypeCard`.
- `RoomTypeCard` now resolves amenities only from the explicit `amenities` prop and defaults to an empty list when omitted.

## 2026-05-13 21:48 IST - Public Room Type Card Focused Green Gate

- Timestamp check: `2026-05-13 21:48:31 IST`.
- Command: `pnpm vitest run 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts'`
- Result: passed, 1 file / 7 tests.

## 2026-05-13 21:48 IST - Public Room Type Card Type Gate

- Timestamp check: `2026-05-13 21:48:47 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 21:49 IST - Public Room Type Card Full Test Gate

- Timestamp check: `2026-05-13 21:49:25 IST`.
- Command: `pnpm test`
- Result: passed, 133 files / 323 tests.

## 2026-05-13 21:50 IST - Public Room Type Card Build Gate

- Timestamp check: `2026-05-13 21:50:17 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observation: public booking routes remain at about `107 kB` first-load JS and `RoomTypeCard` no longer imports `DataContext`.

## 2026-05-13 21:50 IST - Public Room Type Card Select Scan

- Timestamp check: `2026-05-13 21:50:33 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 21:51 IST - Continuation Status Check

- Timestamp check: `2026-05-13 21:51:02 IST`.
- Commands:
  - `git status --short`
  - `git diff --stat`
  - `sed -n '4280,4505p' progress.md`
- Result: worktree remains very large/dirty from the broader optimization effort; no unrelated files were reverted. The latest continuation entries are present in `progress.md`.

## 2026-05-13 21:52 IST - Admin Room Categories Egress Analysis And Research

- Timestamp check: `2026-05-13 21:52:20 IST`.
- Read targets:
  - `src/app/admin/room-categories/components/room-categories-panel.tsx`
  - `src/app/admin/room-categories/components/data-table.tsx`
  - `src/app/admin/room-categories/components/columns.tsx`
  - `src/app/admin/room-categories/components/room-category-form-dialog.tsx`
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/use-app-data.ts`
  - `src/context/data-context.tsx`
  - `src/lib/api/index.ts`
- Findings:
  - `/admin/room-categories` still loads the global `roomCategories` dataset at startup.
  - The page is a route-local CRUD surface and only needs `id`, `name`, and `description` for the table and dialogs.
  - Existing add/update/delete functions in `useAppData` own activity logging, so the low-risk path is route-backed local list hydration plus a refresh callback after mutations.
  - Delete activity logging currently looks up the category in context state; after removing startup hydration it needs the local row passed through.
- Research sources: Supabase JavaScript `select()` and `order()` official docs.
- Relevant guidance: use explicit selected columns and stable ordering for table lists.
- Next pass: add a narrow authenticated `/api/admin/room-categories` route, switch the panel to local route-backed state, and remove `roomCategories` from the route startup plan.

## 2026-05-13 21:54 IST - Admin Room Categories Red Tests

- Timestamp check: `2026-05-13 21:54:22 IST`.
- Updated load-plan coverage to require `/admin/room-categories` to load only `property` at startup.
- Updated `useAppData` route coverage to require no startup `api.getRoomCategories()` call on `/admin/room-categories`.
- Added source coverage requiring `RoomCategoriesPanel` to fetch `/api/admin/room-categories` instead of reading global `roomCategories` from `DataContext`.
- Added server/API coverage for a narrow `id, name, description` room category query with stable `name` ordering and no-store API headers.

## 2026-05-13 21:55 IST - Admin Room Categories Red Gate

- Timestamp check: `2026-05-13 21:55:09 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/admin-management-code-splitting.test.ts src/lib/server/admin-room-categories.test.ts src/app/api/admin/room-categories/route.test.ts`
- Result: failed as expected before implementation.
- Failures confirmed that `/admin/room-categories` still includes `roomCategories` in startup data, `useAppData` still calls `api.getRoomCategories()`, the panel still reads `roomCategories` from `DataContext`, and the narrow helper/API do not exist yet.

## 2026-05-13 21:57 IST - Admin Room Categories Route-Backed Implementation

- Timestamp check: `2026-05-13 21:57:26 IST`.
- Removed `roomCategories` from the `/admin/room-categories` app-data load plan.
- Added `src/lib/server/admin-room-categories.ts` with a narrow `id, name, description` select and stable `name` ordering.
- Added `/api/admin/room-categories` with admin auth and `Cache-Control: private, no-store`.
- Updated `RoomCategoriesPanel` to load local category table state from `/api/admin/room-categories` instead of global `DataContext.roomCategories`.
- Added refresh callbacks through the room category table and form dialog so create/update/delete operations refresh the local route-backed list.
- Allowed `deleteRoomCategory()` to receive the local category row so activity logging still has the deleted category label after removing the global startup dataset.

## 2026-05-13 21:57 IST - Admin Room Categories Focused Green Gate

- Timestamp check: `2026-05-13 21:57:55 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/admin-management-code-splitting.test.ts src/lib/server/admin-room-categories.test.ts src/app/api/admin/room-categories/route.test.ts`
- Result: passed, 5 files / 73 tests.

## 2026-05-13 21:58 IST - Admin Room Categories Type Gate

- Timestamp check: `2026-05-13 21:58:21 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 21:59 IST - Admin Room Categories Full Test Gate

- Timestamp check: `2026-05-13 21:59 IST`.
- Command: `pnpm test`
- Result: passed, 135 files / 327 tests.

## 2026-05-13 22:00 IST - Admin Room Categories Build Gate

- Timestamp check: `2026-05-13 22:00:46 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/admin/room-categories` remains static at about `1.46 kB` route size and `106 kB` first-load JS, with the new dynamic `/api/admin/room-categories` route present for authenticated route-local data.

## 2026-05-13 22:00 IST - Admin Room Categories Select Scan

- Timestamp check: `2026-05-13 22:00:58 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 22:02 IST - Admin Rooms Egress Analysis And Research

- Timestamp check: `2026-05-13 22:02:08 IST`.
- Read targets:
  - `src/app/admin/rooms/components/rooms-panel.tsx`
  - `src/app/admin/rooms/components/data-table.tsx`
  - `src/app/admin/rooms/components/columns.tsx`
  - `src/app/admin/rooms/components/room-form-dialog.tsx`
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/use-app-data.ts`
  - `src/context/data-context.tsx`
  - `src/lib/api/index.ts`
- Findings:
  - `/admin/rooms` still loads global `rooms` and full `roomTypes` at startup.
  - The table and form need room rows, duplicate-check data, and room-type labels; they do not need full room-type descriptions, occupancy, pricing, visibility, or room-type photo arrays.
  - Room rows still need `photos` because the edit dialog manages room-specific photos and the table thumbnail uses the first room-specific image.
  - The low-risk route-local shape is a no-store authenticated `/api/admin/rooms` response with narrow room fields and room type summaries containing only `id`, `name`, and `main_photo_url`.
  - Existing room mutation helpers own activity logging; after removing global startup data, update/delete should accept the local existing room row for accurate logs.
- Research source: Supabase JavaScript `select()` and `order()` official docs.
- Next pass: add red coverage for route-local `/admin/rooms`, implement the narrow admin rooms API/helper, and wire the panel/table/form to local state plus refresh callbacks.

## 2026-05-13 22:03 IST - Admin Rooms Red Tests

- Timestamp check: `2026-05-13 22:03:36 IST`.
- Updated load-plan coverage to require `/admin/rooms` to load only `property` at app-data startup.
- Updated `useAppData` route coverage to require no startup `api.getRooms()` or `api.getRoomTypes()` call on `/admin/rooms`.
- Added source coverage requiring `RoomsPanel` to fetch `/api/admin/rooms`, columns to avoid `DataContext`, and the form to stop reading global `rooms`/`roomTypes` for local list work.
- Added server/API coverage for a narrow admin rooms payload: rooms ordered by `room_number` and compact room type summaries ordered by `name` with no room-type photo array selection.

## 2026-05-13 22:03 IST - Admin Rooms Red Gate

- Timestamp check: `2026-05-13 22:03:57 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/admin-management-code-splitting.test.ts src/lib/server/admin-rooms.test.ts src/app/api/admin/rooms/route.test.ts`
- Result: failed as expected before implementation.
- Failures confirmed that `/admin/rooms` still includes global `rooms`/`roomTypes` in startup data, `useAppData` still calls `api.getRooms()`, `RoomsPanel` still reads `rooms` from `DataContext`, and the narrow helper/API route do not exist yet.

## 2026-05-13 22:05 IST - Admin Rooms Route-Backed Implementation

- Timestamp check: `2026-05-13 22:05:48 IST`.
- Removed `rooms` and `roomTypes` from the `/admin/rooms` app-data load plan.
- Added `src/lib/server/admin-rooms.ts` with narrow room fields and compact room type summaries (`id`, `name`, `main_photo_url`) ordered for stable tables/selects.
- Added `/api/admin/rooms` with admin auth and `Cache-Control: private, no-store`.
- Updated `RoomsPanel` to load local rooms and room type summaries from `/api/admin/rooms` instead of global `DataContext`.
- Updated the rooms table, columns, and form dialog to consume local room/room-type props and refresh the local list after create/update/delete.
- Allowed `updateRoom()` and `deleteRoom()` to receive the local existing room row so activity logging still has previous-room context after startup hydration is removed.

## 2026-05-13 22:06 IST - Admin Rooms Focused Green Gate

- Timestamp check: `2026-05-13 22:06:09 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/admin-management-code-splitting.test.ts src/lib/server/admin-rooms.test.ts src/app/api/admin/rooms/route.test.ts`
- Result: passed, 5 files / 74 tests.

## 2026-05-13 22:06 IST - Admin Rooms Type Gate

- Timestamp check: `2026-05-13 22:06:27 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 22:07 IST - Admin Rooms Full Test Gate

- Timestamp check: `2026-05-13 22:07:04 IST`.
- Command: `pnpm test`
- Result: passed, 137 files / 330 tests.

## 2026-05-13 22:07 IST - Admin Rooms Build Gate

- Timestamp check: `2026-05-13 22:07:52 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/admin/rooms` remains static at about `1.46 kB` route size and `106 kB` first-load JS, with the new dynamic `/api/admin/rooms` route present for authenticated local data.

## 2026-05-13 22:08 IST - Admin Rooms Select Scan

- Timestamp check: `2026-05-13 22:08:03 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 22:08 IST - Admin Rates Egress Analysis And Research

- Timestamp check: `2026-05-13 22:08:49 IST`.
- Read targets:
  - `src/app/admin/rates/components/rates-panel.tsx`
  - `src/app/admin/rates/components/data-table.tsx`
  - `src/app/admin/rates/components/columns.tsx`
  - `src/app/admin/rates/components/rate-plan-form-dialog.tsx`
  - `src/app/admin/rates/components/seasonal-prices-section.tsx`
  - `src/app/admin/rates/components/seasonal-price-form-dialog.tsx`
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/use-app-data.ts`
  - `src/context/data-context.tsx`
  - `src/lib/api/index.ts`
- Findings:
  - `/admin/rates` still loads global `ratePlans`, `seasonalPrices`, and full `roomTypes` at startup.
  - Rate plan and seasonal price records are already narrow, but the route only needs room type option labels (`id`, `name`) rather than full room type descriptions, occupancy, pricing, visibility, or photos.
  - The route is a local CRUD surface; it can fetch a no-store authenticated `/api/admin/rates` payload with rate plans, seasonal prices, and compact room type options.
  - Existing rate/seasonal mutation helpers own activity logging; after removing startup hydration, update/delete helpers need optional local rows or room type labels to preserve useful logs.
- Research source: Supabase JavaScript `select()` and `order()` official docs.
- Next pass: add red coverage for route-local `/admin/rates`, implement the narrow rates API/helper, and wire rate/seasonal panels to local state with refresh callbacks.

## 2026-05-13 22:10 IST - Admin Rates Red Tests

- Timestamp check: `2026-05-13 22:10:17 IST`.
- Updated load-plan coverage to require `/admin/rates` to load only `property` at app-data startup.
- Added `useAppData` route coverage requiring no startup `api.getRatePlans()`, `api.getSeasonalPrices()`, or `api.getRoomTypes()` call on `/admin/rates`.
- Added source coverage requiring `RatesPanel` to fetch `/api/admin/rates` instead of reading global rate plan data, and seasonal components to stop reading global seasonal price and room type lists.
- Added server/API coverage for narrow admin rates data: rate plans, seasonal prices, and room type options with stable ordering and no full room type payload.

## 2026-05-13 22:10 IST - Admin Rates Red Gate

- Timestamp check: `2026-05-13 22:10:44 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/admin-management-code-splitting.test.ts src/lib/server/admin-rates.test.ts src/app/api/admin/rates/route.test.ts`
- Result: failed as expected before implementation.
- Failures confirmed that `/admin/rates` still includes global `ratePlans`, `seasonalPrices`, and `roomTypes` in startup data, `useAppData` still calls `api.getRatePlans()`, `RatesPanel` still reads `ratePlans` from `DataContext`, and the narrow helper/API route do not exist yet.

## 2026-05-13 22:12 IST - Admin Rates Route-Backed Implementation

- Timestamp check: `2026-05-13 22:12:42 IST`.
- Removed `ratePlans`, `seasonalPrices`, and `roomTypes` from the `/admin/rates` app-data load plan.
- Added `src/lib/server/admin-rates.ts` with narrow rate plan fields, seasonal price fields, and compact `id, name` room type options.
- Added `/api/admin/rates` with admin auth and `Cache-Control: private, no-store`.
- Updated `RatesPanel` to load local rate plans, seasonal prices, and room type options from `/api/admin/rates`.
- Updated rate plan and seasonal price components to consume local props and refresh after create/update/delete.
- Allowed rate plan and seasonal price mutation helpers to receive local existing rows or room type labels so activity logging stays useful after global startup hydration is removed.

## 2026-05-13 22:13 IST - Admin Rates Focused Green Gate

- Timestamp check: `2026-05-13 22:13:02 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/admin-management-code-splitting.test.ts src/lib/server/admin-rates.test.ts src/app/api/admin/rates/route.test.ts`
- Result: passed, 5 files / 76 tests.

## 2026-05-13 22:13 IST - Admin Rates Type Gate First Attempt

- Timestamp check: `2026-05-13 22:13:23 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: failed.
- Failure: `src/app/admin/rates/components/columns.tsx` typed `PriceCell` as `CellContext<RatePlan, number>`, but the column definition now infers `unknown` for the generic cell value.
- Next fix: widen the cell context to `unknown` and keep the existing `Number(row.getValue("price"))` normalization.

## 2026-05-13 22:13 IST - Admin Rates Type Fix

- Timestamp check: `2026-05-13 22:13:37 IST`.
- Updated `PriceCell` in `src/app/admin/rates/components/columns.tsx` from `CellContext<RatePlan, number>` to `CellContext<RatePlan, unknown>`, preserving the existing numeric normalization before formatting.

## 2026-05-13 22:13 IST - Admin Rates Type Gate

- Timestamp check: `2026-05-13 22:13:55 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed after the `PriceCell` context type fix.

## 2026-05-13 22:14 IST - Admin Rates Full Test Gate

- Timestamp check: `2026-05-13 22:14:30 IST`.
- Command: `pnpm test`
- Result: passed, 139 files / 334 tests.

## 2026-05-13 22:15 IST - Admin Rates Build Gate

- Timestamp check: `2026-05-13 22:15:17 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/admin/rates` remains static at about `1.46 kB` route size and `106 kB` first-load JS, with the new dynamic `/api/admin/rates` route present for authenticated local data.

## 2026-05-13 22:15 IST - Admin Rates Select Scan

- Timestamp check: `2026-05-13 22:15:30 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 22:16 IST - Admin Room Types Egress Analysis And Research

- Timestamp check: `2026-05-13 22:16:10 IST`.
- Read targets:
  - `src/app/admin/room-types/components/room-types-panel.tsx`
  - `src/app/admin/room-types/components/data-table.tsx`
  - `src/app/admin/room-types/components/columns.tsx`
  - `src/app/admin/room-types/components/room-type-form-dialog.tsx`
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/use-app-data.ts`
  - `src/context/data-context.tsx`
  - `src/lib/api/index.ts`
- Findings:
  - `/admin/room-types` still loads global `roomTypes`, `roomTypeAmenities`, and `amenities` at startup.
  - The table/form need route-local room type rows plus amenity labels/options; they do not need global context hydration.
  - The page still needs room type photos because the table thumbnail and edit form manage room type photo arrays.
  - The page only needs compact amenities (`id`, `name`) for display and checkboxes; amenity icons are unnecessary for this route.
  - The current room type update/delete helpers rely on global `roomTypes` for previous-row context; after removing startup hydration, they should accept the local existing room type row.
- Research source: Supabase JavaScript `select()` and `order()` official docs.
- Next pass: add red coverage for route-local `/admin/room-types`, implement a narrow authenticated room types API/helper, and wire the table/form to local state with refresh callbacks.

## 2026-05-13 22:17 IST - Admin Room Types Red Tests

- Timestamp check: `2026-05-13 22:17:22 IST`.
- Updated load-plan coverage to require `/admin/room-types` to load only `property` at app-data startup.
- Added `useAppData` route coverage requiring no startup `api.getRoomTypes()`, `api.getRoomTypeAmenities()`, or `api.getAmenities()` call on `/admin/room-types`.
- Added source coverage requiring `RoomTypesPanel` to fetch `/api/admin/room-types`, columns to avoid `DataContext`, and the form to stop reading global amenities.
- Added server/API coverage for narrow admin room type data, room type amenity joins, and compact `id, name` amenity options with stable ordering.

## 2026-05-13 22:17 IST - Admin Room Types Red Gate

- Timestamp check: `2026-05-13 22:17:40 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/admin-management-code-splitting.test.ts src/lib/server/admin-room-types.test.ts src/app/api/admin/room-types/route.test.ts`
- Result: failed as expected before implementation.
- Failures confirmed that `/admin/room-types` still includes global `roomTypes`, `roomTypeAmenities`, and `amenities` in startup data, `useAppData` still calls `api.getRoomTypes()`, `RoomTypesPanel` still reads `roomTypes` from `DataContext`, and the narrow helper/API route do not exist yet.

## 2026-05-13 22:19 IST - Admin Room Types Route-Backed Implementation

- Timestamp check: `2026-05-13 22:19:17 IST`.
- Removed `roomTypes`, `roomTypeAmenities`, and `amenities` from the `/admin/room-types` app-data load plan.
- Added `src/lib/server/admin-room-types.ts` with narrow room type fields, room type amenity id joins, and compact `id, name` amenity options.
- Added `/api/admin/room-types` with admin auth and `Cache-Control: private, no-store`.
- Updated `RoomTypesPanel` to load local room types and amenity options from `/api/admin/room-types`.
- Updated the room type table, columns, and form dialog to consume local amenity props and refresh the local list after create/update/delete.
- Allowed `updateRoomType()` and `deleteRoomType()` to receive the local existing room type row so activity logging still has previous-row context after global startup hydration is removed.

## 2026-05-13 22:19 IST - Admin Room Types Focused Green Gate

- Timestamp check: `2026-05-13 22:19:42 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/admin-management-code-splitting.test.ts src/lib/server/admin-room-types.test.ts src/app/api/admin/room-types/route.test.ts`
- Result: passed, 5 files / 78 tests.

## 2026-05-13 22:20 IST - Admin Room Types Type Gate

- Timestamp check: `2026-05-13 22:20:04 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 22:20 IST - Admin Room Types Full Test Gate

- Timestamp check: `2026-05-13 22:20:39 IST`.
- Command: `pnpm test`
- Result: passed, 141 files / 338 tests.

## 2026-05-13 22:21 IST - Admin Room Types Build Gate

- Timestamp check: `2026-05-13 22:21:29 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/admin/room-types` remains static at about `1.46 kB` route size and `106 kB` first-load JS, with the new dynamic `/api/admin/room-types` route present for authenticated local data.

## 2026-05-13 22:21 IST - Admin Room Types Select Scan

- Timestamp check: `2026-05-13 22:21:41 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 22:22 IST - Admin Housekeeping Egress Analysis And Research

- Timestamp check: `2026-05-13 22:22:57 IST`.
- Read targets:
  - `src/app/admin/housekeeping/housekeeping-panel.tsx`
  - `src/app/admin/housekeeping/components/room-status-card.tsx`
  - `src/app/admin/housekeeping/components/assign-housekeeper-dialog.tsx`
  - `src/app/admin/housekeeping/components/update-status-dialog.tsx`
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/use-app-data.ts`
  - `src/context/data-context.tsx`
  - `src/lib/api/index.ts`
  - `src/app/api/admin/housekeepers/route.ts`
- Findings:
  - `/admin/housekeeping` still loads global `rooms`, full `roomTypes`, housekeepers, and today's housekeeping assignments at startup.
  - The page only needs room status cards with `id`, `room_number`, `room_type_id`, and `status`, plus room type labels, compact housekeeper options, and today's assignment rows.
  - Room photos and full room type details are not used on housekeeping cards.
  - Status updates already use `updateRoom`; after removing startup hydration, the panel should pass the local room row into `updateRoom()` and update local state after success.
  - Assignment actions currently only record activity and do not persist assignment rows, so route-local data can preserve existing behavior without adding new mutation semantics.
- Research source: Supabase JavaScript `select()` and `order()` official docs.
- Next pass: add red coverage for route-local `/admin/housekeeping`, implement a narrow authenticated housekeeping API/helper, and wire the panel/dialogs to local state.

## 2026-05-13 22:24 IST - Admin Housekeeping Red Tests

- Timestamp check: `2026-05-13 22:24:43 IST`.
- Updated load-plan coverage to require `/admin/housekeeping` to load only `property` at app-data startup.
- Updated `useAppData` route coverage to require no startup `api.getRooms()`, `api.getRoomTypes()`, `api.getHousekeepingAssignments()`, or `/api/admin/housekeepers` call on `/admin/housekeeping`.
- Added source coverage requiring `HousekeepingPanel` to fetch `/api/admin/housekeeping` and the assign dialog to stop reading global `users` as housekeepers.
- Added server/API coverage for compact housekeeping data: room status rows, room type labels, date-scoped assignment rows, and compact housekeeper profiles.

## 2026-05-13 22:25 IST - Admin Housekeeping Red Gate

- Timestamp check: `2026-05-13 22:25:02 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/housekeeping/housekeeping-code-splitting.test.ts src/lib/server/admin-housekeeping.test.ts src/app/api/admin/housekeeping/route.test.ts`
- Result: failed as expected before implementation.
- Failures confirmed that `/admin/housekeeping` still includes global `rooms`, `roomTypes`, housekeepers, and housekeeping assignments in startup data, `useAppData` still calls `api.getRooms()`, `HousekeepingPanel` still reads global rooms/context, and the narrow helper/API route do not exist yet.

## 2026-05-13 22:27 IST - Admin Housekeeping Route-Backed Implementation

- Timestamp check: `2026-05-13 22:27:57 IST`.
- Removed `rooms`, `roomTypes`, `housekeepers`, and `housekeepingAssignments` from the `/admin/housekeeping` app-data load plan.
- Added `src/lib/server/admin-housekeeping.ts` with compact room status rows, room type labels, date-scoped housekeeping assignments, and compact housekeeper profiles.
- Added `/api/admin/housekeeping` with housekeeping feature auth and `Cache-Control: private, no-store`.
- Updated `HousekeepingPanel` to load route-local housekeeping data for today's date from `/api/admin/housekeeping`.
- Updated room status cards and the assign dialog to receive local housekeeper options instead of reading global `users`.
- Status updates now pass the local room row into `updateRoom()` and update the local room status state after success.

## 2026-05-13 22:28 IST - Admin Housekeeping Focused Gate First Attempt

- Timestamp check: `2026-05-13 22:28:22 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/housekeeping/housekeeping-code-splitting.test.ts src/lib/server/admin-housekeeping.test.ts src/app/api/admin/housekeeping/route.test.ts`
- Result: failed.
- Failure: the source guard rejected the route-local `roomTypes` state/dependency string, even though the global `DataContext` room type read was removed. The implementation tests and route-plan tests otherwise passed.
- Next fix: narrow the source guard to the old global context destructuring pattern instead of any local `roomTypes` usage.

## 2026-05-13 22:28 IST - Admin Housekeeping Source Guard Fix

- Timestamp check: `2026-05-13 22:28:51 IST`.
- Updated `src/app/admin/housekeeping/housekeeping-code-splitting.test.ts` to reject the old global context destructuring patterns instead of legitimate local `roomTypes` state/dependency usage.

## 2026-05-13 22:29 IST - Admin Housekeeping Focused Green Gate

- Timestamp check: `2026-05-13 22:29:14 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/housekeeping/housekeeping-code-splitting.test.ts src/lib/server/admin-housekeeping.test.ts src/app/api/admin/housekeeping/route.test.ts`
- Result: passed, 5 files / 70 tests.

## 2026-05-13 22:29 IST - Admin Housekeeping Type Gate

- Timestamp check: `2026-05-13 22:29:33 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 22:30 IST - Admin Housekeeping Full Test Gate

- Timestamp check: `2026-05-13 22:30:11 IST`.
- Command: `pnpm test`
- Result: passed, 143 files / 341 tests.

## 2026-05-13 22:31 IST - Admin Housekeeping Build Gate

- Timestamp check: `2026-05-13 22:31:02 IST`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/admin/housekeeping` remains static at about `1.43 kB` route size and `106 kB` first-load JS, with the new dynamic `/api/admin/housekeeping` route present for authenticated local data.

## 2026-05-13 22:31 IST - Admin Housekeeping Select Scan

- Timestamp check: `2026-05-13 22:31:14 IST`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 22:31 IST - Admin Fallback Plan Audit

- Timestamp check: `2026-05-13 22:31:56 IST`.
- Read targets:
  - `src/hooks/app-data-load-plan.ts`
  - `src/hooks/app-data-load-plan.test.ts`
  - current `src/app/admin/**/page.tsx` route inventory
- Findings:
  - Current admin page routes are now covered by explicit route plans or the self-fetching chrome-only path set.
  - The generic authenticated admin fallback still returns the old full admin dataset, including guests, roles, users, housekeeping assignments, and dashboard reservations.
- That fallback can silently reintroduce large startup hydration for any future or unclassified admin route.
- Next pass: change the fallback to property-only and add a regression test so unclassified admin routes do not load heavy global datasets by default.

## 2026-05-13 22:32 IST - Admin Fallback Red Test

- Timestamp check: `2026-05-13 22:32:20 IST`.
- Updated `src/hooks/app-data-load-plan.test.ts` so `/admin/unknown` expects a property-only admin fallback and explicitly excludes guests, roles, users, housekeeping assignments, and dashboard reservations.

## 2026-05-13 22:32 IST - Admin Fallback Red Gate

- Timestamp check: `2026-05-13 22:32:35 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts`
- Result: failed as expected before implementation.
- Failure confirmed that unclassified authenticated admin routes still receive the old full admin dataset instead of the property-only fallback.

## 2026-05-13 22:32 IST - Admin Fallback Implementation

- Timestamp check: `2026-05-13 22:32:52 IST`.
- Changed the generic authenticated admin fallback plan from the old full admin dataset to `["property"]`.
- Existing explicit route plans still own the datasets they require for reservation workflows and dashboard sticky notes.

## 2026-05-13 22:33 IST - Admin Fallback Focused Green Gate

- Timestamp check: `2026-05-13 22:33:26 IST`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts`
- Result: passed, 1 file / 40 tests.

## 2026-05-13 22:33 IST - Admin Fallback Type Gate

- Timestamp check: `2026-05-13 22:33:44 IST`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 22:34 IST - Admin Fallback Full Test Gate

- Timestamp check: `2026-05-13 22:34:22 IST`.
- Command: `pnpm test`
- Result: passed, 143 files / 341 tests.

## 2026-05-13 22:36 IST - Admin Fallback Build Gate

- Timestamp check: `Wed May 13 22:36:23 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: existing admin routes remain static and route-local admin APIs remain dynamic; fallback plan change does not add routes.

## 2026-05-13 22:36 IST - Admin Fallback Select Scan

- Timestamp check: `Wed May 13 22:36:56 IST 2026`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 22:37 IST - Route Plan Completion Audit

- Timestamp check: `Wed May 13 22:37:11 IST 2026`.
- Commands:
  - `sed -n '1,260p' src/hooks/app-data-load-plan.ts`
  - `sed -n '260,360p' src/hooks/app-data-load-plan.ts`
  - `rg -n "ADMIN_.*PLAN|datasets: \\[" src/hooks/app-data-load-plan.ts`
- Result: current admin CRUD/operational, chrome-only, guest, calendar, reports, settings, and fallback plans are property-only.
- Remaining non-property admin startup datasets are intentionally scoped to `/admin/reservations/new` and `/admin/reservations/[id]/edit` workflow forms (`rooms`, `roomTypes`, `ratePlans`, `seasonalPrices`), plus dashboard `stickyNotes`.
- Next decision: inspect reservation form dependencies before deciding whether another low-risk route-local egress pass is worthwhile.

## 2026-05-13 22:39 IST - Reservation Workflow Egress Analysis And Research

- Timestamp check: `Wed May 13 22:39:40 IST 2026`.
- Research refresh:
  - Supabase JavaScript `select()` supports explicit comma-separated column lists and returned column aliases: https://supabase.com/docs/reference/javascript/select
  - Supabase JavaScript `order()` orders query results by a chosen column and can be combined with `select()`: https://supabase.com/docs/reference/javascript/order
- Commands:
  - `rg -n "useData|DataContext|rooms|roomTypes|ratePlans|seasonalPrices|propertyClosures|amenities|roomTypeAmenities" src/app/admin/reservations src/hooks -S`
  - `sed -n '1,260p' src/app/admin/reservations/new/create-reservation-form.tsx`
  - `sed -n '1,1400p' src/app/admin/reservations/components/reservation-edit-form.tsx`
  - `sed -n '1,180p' 'src/app/admin/reservations/[id]/edit/reservation-edit-client.tsx'`
  - `sed -n '360,660p' src/hooks/use-app-data.ts`
  - `sed -n '1,380p' src/lib/server/admin-reservation-booking.ts`
- Findings:
  - Create and edit forms are the remaining consumers of global `rooms`, `roomTypes`, `ratePlans`, and `seasonalPrices` startup data.
  - Create already uses route-backed guest search and route-backed date conflict checks, so it only needs compact form reference rows plus existing mutation actions from `DataContext`.
  - Edit already loads the target booking through `/api/admin/reservations/[id]/booking`; it can keep booking state and mutations in `DataContext` while moving all-room/rate reference data to a route-local form-data API.
  - Smallest useful API shape: room ids/numbers/type/status, room type id/name/capacity/bed types/price, rate plan id/name/price/rules, and seasonal price date/rate fields.
- Next pass: add red tests for the route-backed form data API and property-only reservation create/edit startup plans.

## 2026-05-13 22:41 IST - Reservation Workflow Red Tests

- Timestamp check: `Wed May 13 22:41:47 IST 2026`.
- Updated tests:
  - `src/hooks/app-data-load-plan.test.ts`
  - `src/hooks/use-app-data.load-plan.test.tsx`
  - `src/app/admin/reservations/new/reservation-create-egress.test.ts`
  - `src/app/admin/reservations/[id]/edit/reservation-edit-egress.test.ts`
  - `src/lib/server/admin-reservation-form-data.test.ts`
  - `src/app/api/admin/reservations/form-data/route.test.ts`
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/new/reservation-create-egress.test.ts 'src/app/admin/reservations/[id]/edit/reservation-edit-egress.test.ts' src/lib/server/admin-reservation-form-data.test.ts src/app/api/admin/reservations/form-data/route.test.ts`
- Intended red result: failed, 6 files, 7 failed tests / 63 passed.
- Failures confirmed that reservation create/edit still hydrate room and rate reference data at startup, the form-data helper/API are missing, and the create/edit forms have not switched to `useAdminReservationFormData`.

## 2026-05-13 22:44 IST - Reservation Workflow Route-Backed Implementation

- Timestamp check: `Wed May 13 22:44:12 IST 2026`.
- Added shared reservation form-data shape in `src/lib/reservations/admin-form-data.ts`.
- Added `src/lib/server/admin-reservation-form-data.ts` with narrow selects for rooms, room types, rate plans, and seasonal prices.
- Added `/api/admin/reservations/form-data` with admin auth and `Cache-Control: private, no-store`.
- Added `useAdminReservationFormData()` for client-side authenticated form reference data loading.
- Changed `/admin/reservations/new` and `/admin/reservations/[id]/edit` startup plans to property-only.
- Updated create and edit reservation forms to use route-backed reference data while keeping existing mutation and booking-detail actions in `DataContext`.
- Updated the edit client to use booking lookup room rows for the page header instead of the global rooms dataset.

## 2026-05-13 22:44 IST - Reservation Workflow Focused Gate First Attempt

- Timestamp check: `Wed May 13 22:44:39 IST 2026`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/new/reservation-create-egress.test.ts 'src/app/admin/reservations/[id]/edit/reservation-edit-egress.test.ts' src/lib/server/admin-reservation-form-data.test.ts src/app/api/admin/reservations/form-data/route.test.ts`
- Result: failed, 1 test failed / 71 passed.
- Failure was a source guard issue: the create-form test still rejected the `rooms`, `roomTypes`, `ratePlans`, and `seasonalPrices` destructuring even when those values now come from `useAdminReservationFormData()`.
- Next fix: narrow the guard to reject only the old `useDataContext()` destructuring shape.

## 2026-05-13 22:44 IST - Reservation Workflow Source Guard Fix

- Timestamp check: `Wed May 13 22:44:56 IST 2026`.
- Updated `src/app/admin/reservations/new/reservation-create-egress.test.ts` to reject the old `useDataContext()` seasonal price plus `addReservation` destructuring shape instead of rejecting the route-backed form-data hook destructuring.

## 2026-05-13 22:45 IST - Reservation Workflow Focused Gate Second Attempt

- Timestamp check: `Wed May 13 22:45:19 IST 2026`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/new/reservation-create-egress.test.ts 'src/app/admin/reservations/[id]/edit/reservation-edit-egress.test.ts' src/lib/server/admin-reservation-form-data.test.ts src/app/api/admin/reservations/form-data/route.test.ts`
- Result: failed, 1 test failed / 71 passed.
- Failure was the remaining over-broad `const { rooms` source guard, which now matches the route-backed hook destructuring.

## 2026-05-13 22:45 IST - Reservation Workflow Source Guard Follow-Up

- Timestamp check: `Wed May 13 22:45:53 IST 2026`.
- Updated the create-form source guard to reject only the exact old context destructuring sequence that included rooms, room types, rate plans, seasonal prices, and `addReservation`.

## 2026-05-13 22:46 IST - Reservation Workflow Focused Green Gate

- Timestamp check: `Wed May 13 22:46:14 IST 2026`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/new/reservation-create-egress.test.ts 'src/app/admin/reservations/[id]/edit/reservation-edit-egress.test.ts' src/lib/server/admin-reservation-form-data.test.ts src/app/api/admin/reservations/form-data/route.test.ts`
- Result: passed, 6 files / 72 tests.

## 2026-05-13 22:46 IST - Reservation Workflow Type Gate

- Timestamp check: `Wed May 13 22:46:36 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 22:47 IST - Reservation Workflow Full Test Gate

- Timestamp check: `Wed May 13 22:47:18 IST 2026`.
- Command: `pnpm test`
- Result: passed, 146 files / 346 tests.

## 2026-05-13 22:48 IST - Reservation Workflow Build Gate

- Timestamp check: `Wed May 13 22:48:12 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/api/admin/reservations/form-data` is present as a dynamic route, `/admin/reservations/new` remains static at about `1.66 kB` route size / `107 kB` first-load JS, and `/admin/reservations/[id]/edit` remains dynamic at about `1.63 kB` route size / `107 kB` first-load JS.

## 2026-05-13 22:48 IST - Reservation Workflow Select Scan

- Timestamp check: `Wed May 13 22:48:24 IST 2026`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 22:48 IST - Final Route Plan And Worktree Audit

- Timestamp check: `Wed May 13 22:48:54 IST 2026`.
- Commands:
  - `sed -n '60,125p' src/hooks/app-data-load-plan.ts`
  - `sed -n '125,170p' src/hooks/app-data-load-plan.ts`
  - `rg -n "datasets: \\[|stickyNotes|rooms|roomTypes|ratePlans|seasonalPrices|dashboardReservations|housekeepingAssignments|guests" src/hooks/app-data-load-plan.ts src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
  - `git status --short`
  - `git diff --stat`
- Result:
  - Admin fallback, settings, chrome-only, reservations index/create/detail/edit, calendar, reports, guests, housekeeping, room categories, room types, rooms, and rates plans are property-only.
  - Dashboard startup is the only admin plan with a non-property dataset, limited to `stickyNotes`.
  - Reservation create/edit reference rows now load through `/api/admin/reservations/form-data`.
  - Worktree is intentionally broad from the accumulated optimization work; latest diff stat reports 157 tracked files changed plus many new files/tests/routes.

## 2026-05-13 22:49 IST - Remaining Data Call Surface Audit

- Timestamp check: `Wed May 13 22:49:40 IST 2026`.
- Command: `rg -n "\\.from\\(|\\.rpc\\(|authorizedFetch\\(|fetch\\(\\\"/api|fetch\\('/api|select\\(" src/app src/components src/context src/hooks src/lib src/server -S`
- Findings:
  - Startup/global hydration has been narrowed, so remaining Supabase egress risk is mostly route-local APIs and public client-triggered fetches.
  - Public homepage/client fetch candidates include `/api/reviews` from `ReviewSection` and `/api/event-banner/active` from `EventBannerModal`.
  - Next pass: inspect public reviews and event-banner APIs for cache behavior and select shape, starting with reviews because it can be shown on high-traffic public pages.

## 2026-05-13 22:50 IST - Public Reviews Egress Analysis And Research

- Timestamp check: `Wed May 13 22:50:39 IST 2026`.
- Research refresh:
  - Next.js caching docs recommend `unstable_cache` for non-`fetch` database work with `revalidate` and cache tags: https://nextjs.org/docs/app/building-your-application/data-fetching/caching
  - Next.js CDN caching docs describe `Cache-Control`/`s-maxage` as the mechanism CDNs can use for cached responses: https://nextjs.org/docs/app/guides/cdn-caching
  - Supabase JavaScript `select()` supports explicit column lists, and `limit()`/`order()` can cap and sort result sets: https://supabase.com/docs/reference/javascript/select
- Commands:
  - `sed -n '1,220p' src/components/marketing/home/ReviewSection.tsx`
  - `sed -n '1,220p' src/app/api/reviews/route.ts`
  - `sed -n '1,260p' src/lib/server/reviews.ts`
  - `sed -n '1,220p' src/lib/server/reviews.test.ts src/app/api/reviews/route.test.ts`
  - `sed -n '1,220p' src/integrations/supabase/server.ts`
  - `sed -n '1,220p' src/lib/reviews.ts`
- Findings:
  - `/api/reviews` already has shared HTTP cache headers and `getPublishedReviews()` already uses `unstable_cache`, an `is_published` filter, ordering, and a capped limit.
  - The remaining egress/data-exposure issue is field shape: public homepage reviews only render `reviewerName`, `reviewerTitle`, `content`, and `imageUrl`, but the public query currently selects and returns admin-oriented fields (`id`, `is_published`, timestamps, `updated_by`).
  - Next pass: add red tests for a public-only review select/response shape, then split public review mapping from admin review mapping.

## 2026-05-13 22:51 IST - Public Reviews Red Tests

- Timestamp check: `Wed May 13 22:51:45 IST 2026`.
- Updated tests:
  - `src/lib/server/reviews.test.ts` now expects `getPublishedReviews()` to select only public carousel fields and return only `reviewerName`, `reviewerTitle`, `content`, and `imageUrl`.
  - `src/app/api/reviews/route.test.ts` now asserts the public API response does not expose admin fields.
- Command: `pnpm vitest run src/lib/server/reviews.test.ts src/app/api/reviews/route.test.ts`
- Intended red result: failed, 1 test failed / 2 passed.
- Failure confirmed that the public helper still maps rows through the admin review schema, dropping the narrower public row shape.

## 2026-05-13 22:52 IST - Public Reviews Public Shape Implementation

- Timestamp check: `Wed May 13 22:52:24 IST 2026`.
- Added `PUBLIC_REVIEW_SELECT_COLUMNS = "reviewer_name, reviewer_title, content, image_url"`.
- Added public review row schema and mapper in `src/lib/reviews.ts`.
- Updated `getPublishedReviews()` to use the public select and return only the carousel response shape while preserving the admin review mapper/select for admin CRUD.

## 2026-05-13 22:52 IST - Public Reviews Focused Green Gate

- Timestamp check: `Wed May 13 22:52:41 IST 2026`.
- Command: `pnpm vitest run src/lib/server/reviews.test.ts src/app/api/reviews/route.test.ts`
- Result: passed, 2 files / 3 tests.

## 2026-05-13 22:52 IST - Public Reviews Type Gate

- Timestamp check: `Wed May 13 22:52:59 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 22:53 IST - Public Reviews Full Test Gate

- Timestamp check: `Wed May 13 22:53:36 IST 2026`.
- Command: `pnpm test`
- Result: passed, 146 files / 346 tests.

## 2026-05-13 22:54 IST - Public Reviews Build Gate

- Timestamp check: `Wed May 13 22:54:27 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/api/reviews` remains a dynamic route with explicit shared-cache headers; public static route sizes are unchanged.

## 2026-05-13 22:54 IST - Public Reviews Select Scan

- Timestamp check: `Wed May 13 22:54:38 IST 2026`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 22:55 IST - Public Event Banner Egress Analysis

- Timestamp check: `Wed May 13 22:55:03 IST 2026`.
- Commands:
  - `sed -n '1,180p' src/components/marketing/home/EventBannerModal.tsx`
  - `sed -n '1,180p' src/app/api/event-banner/active/route.ts`
  - `sed -n '1,280p' src/lib/server/events.ts`
  - `sed -n '1,220p' src/lib/server/events.test.ts src/app/api/event-banner/active/route.test.ts src/components/marketing/home/EventBannerModal.test.tsx`
  - `sed -n '1,220p' src/lib/event-banners.ts`
  - `sed -n '1,220p' 'src/app/(public)/events/page.tsx'`
- Findings:
  - `/api/event-banner/active` already has shared HTTP cache headers and `getHomepageBanner()` already uses `unstable_cache`.
  - The modal only renders `title`, `description`, and `imageUrl`, but the API currently returns full `EventBanner` data including id, active flag, timestamps, updater, and schedule fields.
  - `getHomepageBanner()` is also used by the public `/events` page, which needs `startsAt`; changing that helper directly would risk breaking the page.
  - Next pass: add a separate compact modal-banner helper for `/api/event-banner/active` with a public-only select that keeps `starts_at`/`ends_at` only for active-window filtering and returns only modal fields.

## 2026-05-13 22:56 IST - Public Event Banner Red Tests

- Timestamp check: `Wed May 13 22:56:09 IST 2026`.
- Updated tests:
  - `src/lib/server/events.test.ts` now expects `getHomepageModalBanner()` to use compact public select fields and return only modal fields.
  - `src/app/api/event-banner/active/route.test.ts` now expects the API to call the compact helper and not expose full event/admin fields.
- Command: `pnpm vitest run src/lib/server/events.test.ts src/app/api/event-banner/active/route.test.ts src/components/marketing/home/EventBannerModal.test.tsx`
- Intended red result: failed, 2 tests failed / 5 passed.
- Failures confirmed the compact helper does not exist yet and the route still imports the full `getHomepageBanner()` helper.

## 2026-05-13 22:57 IST - Public Event Banner Compact API Implementation

- Timestamp check: `Wed May 13 22:57:27 IST 2026`.
- Added `PUBLIC_HOMEPAGE_BANNER_SELECT_COLUMNS = "title, description, image_url, starts_at, ends_at"`.
- Added compact public homepage banner schema, active-window helper, and mapper in `src/lib/event-banners.ts`.
- Added cached `getHomepageModalBanner()` in `src/lib/server/events.ts`, preserving full `getHomepageBanner()` for the `/events` page.
- Updated `/api/event-banner/active` to use the compact helper.
- Updated `EventBannerModal` client types to match the compact API response.

## 2026-05-13 22:57 IST - Public Event Banner Focused Green Gate

- Timestamp check: `Wed May 13 22:57:52 IST 2026`.
- Command: `pnpm vitest run src/lib/server/events.test.ts src/app/api/event-banner/active/route.test.ts src/components/marketing/home/EventBannerModal.test.tsx`
- Result: passed, 3 files / 7 tests.

## 2026-05-13 22:58 IST - Public Event Banner Type Gate

- Timestamp check: `Wed May 13 22:58:09 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 22:58 IST - Public Event Banner Full Test Gate

- Timestamp check: `Wed May 13 22:58:52 IST 2026`.
- Command: `pnpm test`
- Result: passed, 146 files / 347 tests.

## 2026-05-13 22:59 IST - Public Event Banner Build Gate

- Timestamp check: `Wed May 13 22:59:42 IST 2026`.
- Command: `pnpm build`
- Result: passed.
- Build observation: `/api/event-banner/active` remains dynamic with shared-cache headers; public route sizes are unchanged.

## 2026-05-13 22:59 IST - Public Event Banner Select Scan

- Timestamp check: `Wed May 13 22:59:53 IST 2026`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean; no broad Supabase select matches in audited paths.

## 2026-05-13 18:18 IST - Dashboard Guest Egress Analysis

- Timestamp check: `2026-05-13 18:18:42 IST`.
- `src/app/admin/dashboard/components/dashboard-panel.tsx` uses the global `guests` dataset only to map reservation guest IDs to names/emails for the arrivals and departures tables.
- `BookingSummary` already includes `guestName`, `guestSnapshot`, and reservation `subRows`, and `useAppData` already stores the dashboard reservation API payload in `bookings`.
- Next pass: remove `guests` from the `/admin/dashboard` load plan, verify `/admin/dashboard` no longer calls `api.getGuests()`, and derive dashboard table guest names/emails from booking summary data instead. Calendar will keep its existing guest dependency for now.

## 2026-05-13 18:19 IST - Dashboard Guest Egress Red Test

- Timestamp check: `2026-05-13 18:19:37 IST`.
- Updated `src/hooks/app-data-load-plan.test.ts` to expect `/admin/dashboard` to exclude `guests`.
- Updated `src/hooks/use-app-data.load-plan.test.tsx` to expect `/admin/dashboard` startup not to call `api.getGuests()`.
- Added `src/app/admin/dashboard/components/dashboard-summary.test.ts` for deriving dashboard arrival/departure rows from booking summaries without global guest rows.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/dashboard/components/dashboard-summary.test.ts`
- Intended red result: failed because `/admin/dashboard` still includes `guests`, `useAppData` still calls `api.getGuests()`, and `dashboard-summary.ts` does not exist yet.
- Timestamp check: `2026-05-13 18:21:14 IST`.

## 2026-05-13 18:25 IST - Dashboard Guest Egress Implementation

- Timestamp check: `2026-05-13 18:25:15 IST`.
- Removed `guests` from the `/admin/dashboard` app-data plan.
- Added `buildDashboardSummary()` and switched `DashboardPanel` from `todayReservations + guests` to route-backed `bookings + rooms`.
- Added guest snapshots to reservation subRows from the cached bookings summary mapper.
- Updated calendar reservation labels/hover fallback paths to use reservation guest snapshots when a route does not load the full `guests` dataset.

## 2026-05-13 18:25 IST - Dashboard Guest Egress Green Test

- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/dashboard/components/dashboard-summary.test.ts src/server/reservations/cache.test.ts`
- Result: passed, 4 files / 54 tests.
- Timestamp check: `2026-05-13 18:25:41 IST`.

## 2026-05-13 18:25 IST - Dashboard Guest Egress Typecheck

- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Timestamp check: `2026-05-13 18:25:57 IST`.

## 2026-05-13 18:26 IST - Dashboard Guest Egress Full Test

- Command: `pnpm test`
- Result: passed, 101 files / 250 tests.
- Timestamp check: `2026-05-13 18:26:33 IST`.

## 2026-05-13 18:27 IST - Dashboard Guest Egress Build

- Command: `pnpm build`
- Result: passed.
- Build note: Node emitted the recurring `ExperimentalWarning: Type Stripping is an experimental feature...`.
- Build observations: `/admin/dashboard` remains at ~106 kB first-load JS and shared first-load JS remains 105 kB.
- Timestamp check: `2026-05-13 18:27:26 IST`.

## 2026-05-13 18:27 IST - Dashboard Guest Egress Select Scan

- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean, no broad Supabase select matches.
- Timestamp check: `2026-05-13 18:27:37 IST`.

## 2026-05-13 18:27 IST - Calendar Guest Egress Analysis

- Timestamp check: `2026-05-13 18:27:55 IST`.
- `/admin/calendar` renders `CalendarPanel`, which only wraps `AvailabilityCalendar`.
- The modern calendar path reads only property directly, while nested room rows and hover cards previously depended on context `guests` for labels.
- The previous dashboard pass added reservation guestSnapshot fallbacks to `RoomTypeRow`, `ReservationHoverCard`, and the legacy availability calendar path.
- Next pass: remove `guests` from the `/admin/calendar` startup plan and add tests that calendar startup avoids `api.getGuests()` while cached booking subRows carry guest snapshots for label fallback.

## 2026-05-13 18:28 IST - Calendar Guest Egress Red Test

- Timestamp check: `2026-05-13 18:28:21 IST`.
- Updated `src/hooks/app-data-load-plan.test.ts` to expect `/admin/calendar` to exclude `guests`.
- Added `src/hooks/use-app-data.load-plan.test.tsx` coverage that `/admin/calendar` loads property, rooms, room types, and route-backed reservations without calling `api.getGuests()`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Intended red result: failed because `/admin/calendar` still includes `guests` and startup still calls `api.getGuests()`.
- Timestamp check: `2026-05-13 18:28:58 IST`.

## 2026-05-13 18:29 IST - Calendar Guest Egress Implementation

- Timestamp check: `2026-05-13 18:29:07 IST`.
- Removed `guests` from the `/admin/calendar` app-data plan.
- Calendar guest labels now rely on route-backed reservation summaries and the guestSnapshot fallback path added during the dashboard pass.

## 2026-05-13 18:29 IST - Calendar Guest Egress Green Test

- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/server/reservations/cache.test.ts`
- Result: passed, 3 files / 54 tests.
- Timestamp check: `2026-05-13 18:29:29 IST`.

## 2026-05-13 18:29 IST - Calendar Guest Egress Typecheck

- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Timestamp check: `2026-05-13 18:29:48 IST`.

## 2026-05-13 18:30 IST - Calendar Guest Egress Full Test

- Command: `pnpm test`
- Result: passed, 101 files / 251 tests.
- Timestamp check: `2026-05-13 18:30:16 IST`.

## 2026-05-13 18:30 IST - Calendar Guest Egress Build

- Command: `pnpm build`
- Result: passed.
- Build observations: `/admin/calendar` remains at ~106 kB first-load JS and shared first-load JS remains 105 kB.
- Timestamp check: `2026-05-13 18:30:58 IST`.

## 2026-05-13 18:31 IST - Calendar Guest Egress Select Scan

- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean, no broad Supabase select matches.
- Timestamp check: `2026-05-13 18:31:11 IST`.

## 2026-05-13 18:31 IST - Reservations Index Guest Egress Analysis

- Timestamp check: `2026-05-13 18:31:30 IST`.
- `/admin/reservations` renders `ReservationsPanel`, which uses route-backed paginated booking summaries for the table.
- The index still starts with `guests`, `rooms`, and `roomTypes`; table labels come from `guestName`/`roomNumber` in the booking summaries, while invoice actions need rooms/room types for charge summaries.
- Guest data on the index is only needed for invoice generation, and booking summaries now carry guest snapshots on subRows.
- Next pass: remove full `guests` startup from the reservations index while keeping rooms/roomTypes for invoice room metadata, and synthesize invoice guest details from reservation guest snapshots when the global guests dataset is absent.

## 2026-05-13 18:32 IST - Reservations Index Guest Egress Red Test

- Timestamp check: `2026-05-13 18:32:40 IST`.
- Updated `src/hooks/app-data-load-plan.test.ts` to expect `/admin/reservations` to exclude `guests`.
- Updated `src/hooks/use-app-data.load-plan.test.tsx` to expect `/admin/reservations` startup not to call `api.getGuests()`.
- Added `src/app/admin/reservations/components/invoice-data.test.ts` for invoice guest fallback from reservation guest snapshots.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/components/invoice-data.test.ts`
- Intended red result: failed because `/admin/reservations` still includes/calls `guests`, and the new invoice-data helper does not exist yet.
- Timestamp check: `2026-05-13 18:33:32 IST`.

## 2026-05-13 18:33 IST - Reservations Index Guest Egress Implementation

- Timestamp check: `2026-05-13 18:33:51 IST`.
- Removed `guests` from the `/admin/reservations` app-data plan.
- Added `buildReservationInvoiceData()` so invoice actions can synthesize guest details from reservation guest snapshots when the global guest list is not loaded.
- Updated reservation table invoice actions to use the helper.

## 2026-05-13 18:35 IST - Reservations Index Guest Egress Green Test

- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/admin/reservations/components/invoice-data.test.ts`
- Result: passed, 3 files / 54 tests.
- Timestamp check: `2026-05-13 18:35:00 IST`.

## 2026-05-13 18:35 IST - Reservations Index Guest Egress Typecheck

- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Timestamp check: `2026-05-13 18:35:17 IST`.

## 2026-05-13 18:35 IST - Reservations Index Guest Egress Full Test

- Command: `pnpm test`
- Result: passed, 102 files / 252 tests.
- Timestamp check: `2026-05-13 18:35:44 IST`.

## 2026-05-13 18:36 IST - Reservations Index Guest Egress Build

- Command: `pnpm build`
- Result: passed.
- Build note: Node emitted the recurring `ExperimentalWarning: Type Stripping is an experimental feature...`.
- Build observations: `/admin/reservations` remains at ~106 kB first-load JS and shared first-load JS remains 105 kB.
- Timestamp check: `2026-05-13 18:36:35 IST`.

## 2026-05-13 18:36 IST - Reservations Index Guest Egress Select Scan

- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean, no broad Supabase select matches.
- Timestamp check: `2026-05-13 18:36:50 IST`.

## 2026-05-13 18:37 IST - Reservation Detail Guest Egress Analysis

- Timestamp check: `2026-05-13 18:37:11 IST`.
- Reservation detail/edit pages call `loadBookingDetails(id)` on mount and the booking API returns the specific booking reservations plus the specific guest.
- `loadBookingDetails()` already appends that single guest to context `guests`, so the detail page, header, and edit form do not need a full guest list at route startup.
- Detail/edit still need rooms, room types, rate plans, and seasonal prices for stay details, linked rooms, invoice/actions, and edit pricing.
- Next pass: remove `guests` from reservation detail/edit startup plans, keep the booking API as the specific guest source, and assert startup no longer calls `api.getGuests()`.

## 2026-05-13 18:38 IST - Reservation Detail Guest Egress Red Test

- Timestamp check: `2026-05-13 18:38:13 IST`.
- Added app-data plan coverage for `/admin/reservations/:id` and `/admin/reservations/:id/edit` to exclude `guests`.
- Updated booking-detail hook coverage to assert startup does not call `api.getGuests()` before `loadBookingDetails()` adds the specific guest.
- Added edit route hook coverage that keeps rooms, room types, rate plans, and seasonal prices but avoids `api.getGuests()`.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Intended red result: failed because reservation detail/edit still use the reservation workflow plan with `guests`.
- Timestamp check: `2026-05-13 18:39:37 IST`.

## 2026-05-13 18:39 IST - Reservation Detail Guest Egress Implementation

- Timestamp check: `2026-05-13 18:39:51 IST`.
- Added a dedicated reservation detail/edit app-data plan without `guests`.
- Kept `/admin/reservations/new` on the reservation workflow plan because the creation form needs the full guest picker.

## 2026-05-13 18:40 IST - Reservation Detail Guest Egress Green Test

- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 55 tests.
- Timestamp check: `2026-05-13 18:40:35 IST`.

## 2026-05-13 18:41 IST - Reservation Detail Guest Egress Typecheck

- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Timestamp check: `2026-05-13 18:41:11 IST`.

## 2026-05-13 18:41 IST - Reservation Detail Guest Egress Full Test

- Command: `pnpm test`
- Result: passed, 102 files / 254 tests.
- Timestamp check: `2026-05-13 18:41:45 IST`.

## 2026-05-13 18:42 IST - Reservation Detail Guest Egress Build

- Command: `pnpm build`
- Result: passed.
- Build observations: reservation detail/edit routes remain at ~106 kB first-load JS and shared first-load JS remains 105 kB.
- Timestamp check: `2026-05-13 18:42:46 IST`.

## 2026-05-13 18:43 IST - Reservation Detail Guest Egress Select Scan

- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean, no broad Supabase select matches.
- Timestamp check: `2026-05-13 18:43:01 IST`.

## 2026-05-13 18:43 IST - Guest Detail Egress Analysis

- Timestamp check: `2026-05-13 18:43:34 IST`.
- `/admin/guests/[id]` loads the full `guests` dataset through the app-data plan only to find the single guest by ID.
- Reservation history is already route-backed through `/api/admin/guests/[id]/reservations`, and the page only needs `rooms` from app data to label those reservation rows.
- Existing guest reservations API is guest-scoped and cache-disabled; there is no single guest profile API yet.
- Next pass: add a route-backed single guest profile fetch, remove `guests` from the guest-detail app-data plan, and have the detail client use the single-guest hook instead of scanning all guests.

## 2026-05-13 18:44 IST - Guest Detail Egress Red Test

- Timestamp check: `2026-05-13 18:44:28 IST`.
- Updated app-data plan and hook tests to expect `/admin/guests/:id` not to load `guests`.
- Added source coverage that `GuestDetailsClient` uses `useGuestProfile` and does not scan the global guests list.
- Added `src/app/api/admin/guests/[id]/route.test.ts` for a single-guest profile API.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/admin/guests/[id]/guest-detail-code-splitting.test.ts' 'src/app/api/admin/guests/[id]/route.test.ts'`
- Intended red result: failed because guest detail still loads/scans global `guests`, and the single-guest API route does not exist yet.
- Timestamp check: `2026-05-13 18:45:42 IST`.

## 2026-05-13 18:46 IST - Guest Detail Egress Implementation

- Timestamp check: `2026-05-13 18:46:13 IST`.
- Added `getGuestProfile()` with explicit guest profile columns.
- Added `/api/admin/guests/[id]`, guarded by the `guests` feature, returning one guest profile with `private, no-store`.
- Added `useGuestProfile()` and switched `GuestDetailsClient` from global `guests` lookup to the single-guest route.
- Removed `guests` from the guest-detail app-data plan.

## 2026-05-13 18:47 IST - Guest Detail Egress Green Test

- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx 'src/app/admin/guests/[id]/guest-detail-code-splitting.test.ts' 'src/app/api/admin/guests/[id]/route.test.ts'`
- Result: passed, 4 files / 58 tests.
- Timestamp check: `2026-05-13 18:47:41 IST`.

## 2026-05-13 18:48 IST - Guest Detail Egress Typecheck

- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Timestamp check: `2026-05-13 18:48:21 IST`.

## 2026-05-13 18:48 IST - Guest Detail Egress Full Test

- Command: `pnpm test`
- Result: passed, 103 files / 256 tests.
- Timestamp check: `2026-05-13 18:48:53 IST`.

## 2026-05-13 18:49 IST - Guest Detail Egress Build

- Command: `pnpm build`
- Result: passed.
- Build note: Node emitted the recurring `ExperimentalWarning: Type Stripping is an experimental feature...`.
- Build observations: `/api/admin/guests/[id]` is now present, `/admin/guests/[id]` remains at ~106 kB first-load JS, and shared first-load JS remains 105 kB.
- Timestamp check: `2026-05-13 18:49:43 IST`.

## 2026-05-13 18:49 IST - Guest Detail Egress Select Scan

- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: clean, no broad Supabase select matches.
- Timestamp check: `2026-05-13 18:49:57 IST`.

## 2026-05-13 17:43 IST - Home Marketing Image Sizes Implementation

- Added responsive `sizes` hints to the remaining home marketing `Image fill` surfaces:
  - `ReviewSection` reviewer avatars now declare `(min-width: 1024px) 128px, 96px`.
  - `AccommodationCard` thumbnails now declare `(max-width: 768px) 100vw, 33vw`.
- Earlier edits in this pass already added `sizes` hints to the home hero, feature cards, activity cards, gallery images, and rooms showcase images.
- Timestamp check: `Wed May 13 17:43:44 IST 2026`.

## 2026-05-13 17:44 IST - Home Marketing Image Sizes Green Test

- Command: `pnpm vitest run 'src/app/(public)/home-code-splitting.test.ts'`
- Result: passed, 1 file / 2 tests.
- Timestamp check: `Wed May 13 17:44:05 IST 2026`.

## 2026-05-13 17:44 IST - Home Marketing Image Sizes Typecheck

- Command: `pnpm exec tsc --noEmit`
- Result: passed with no TypeScript errors.
- Timestamp check: `Wed May 13 17:44:20 IST 2026`.

## 2026-05-13 17:44 IST - Home Marketing Image Sizes Full Test

- Command: `pnpm test`
- Result: passed, 99 files / 241 tests.
- Timestamp check: `Wed May 13 17:44:58 IST 2026`.

## 2026-05-13 17:45 IST - Home Marketing Image Sizes Build

- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/` remains about `112 kB` first-load JS with `1h` revalidation.
  - Shared first-load JS remains `105 kB`.
  - This pass targets responsive image byte selection for home marketing images rather than route JS weight.
- Warning observation:
  - Node emitted the existing experimental type-stripping warning during build.
- Timestamp check: `Wed May 13 17:45:48 IST 2026`.

## 2026-05-13 17:45 IST - Home Marketing Image Sizes Select Scan

- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Timestamp check: `Wed May 13 17:45:58 IST 2026`.

## 2026-05-13 17:46 IST - Remaining Public Fill Image Audit

- Command: custom Node audit over `src/app/(public)`, `src/components/marketing`, `src/components/public`, and `src/components/donations` for `Image fill` without `sizes`.
- Result: remaining gaps:
  - `src/components/marketing/amenities/HeroSection.tsx`
  - `src/components/marketing/journey/JourneyHeroSection.tsx`
  - `src/components/marketing/journey/JourneyTimeline.tsx`
  - `src/components/marketing/about/rishikesh-experience-section.tsx`
  - `src/app/(public)/shop/page.tsx`
- Timestamp check: `Wed May 13 17:46:20 IST 2026`.

## 2026-05-13 17:46 IST - Remaining Public Fill Image Sizes Analysis

- Analysis:
  - Amenities, journey, about-Rishikesh, and shop still have `Image fill` backgrounds without `sizes`, so Next falls back to viewport-wide candidates even when the displayed image is narrower.
  - Full-width hero/background images should declare `sizes="100vw"`.
  - Journey timeline event images render at full width on mobile and about `45vw` in the desktop timeline column, so they should declare `(max-width: 768px) 100vw, 45vw`.
- Test-first plan:
  - Extend the existing route code-splitting source tests to require the correct `sizes` strings in each affected component/page.
- Timestamp check: `Wed May 13 17:46:57 IST 2026`.

## 2026-05-13 17:47 IST - Remaining Public Fill Image Sizes Red Test

- Added failing coverage to:
  - `src/app/(public)/amenities/amenities-code-splitting.test.ts`
  - `src/app/(public)/journey/journey-code-splitting.test.ts`
  - `src/app/(public)/about-rishikesh/about-rishikesh-code-splitting.test.ts`
  - `src/app/(public)/shop/shop-code-splitting.test.ts`
- Command: `pnpm vitest run 'src/app/(public)/amenities/amenities-code-splitting.test.ts' 'src/app/(public)/journey/journey-code-splitting.test.ts' 'src/app/(public)/about-rishikesh/about-rishikesh-code-splitting.test.ts' 'src/app/(public)/shop/shop-code-splitting.test.ts'`
- Intended result: failed on missing `sizes` strings for amenities hero, journey hero/timeline, Rishikesh experience background, and shop hero.
- Timestamp check: `Wed May 13 17:47:29 IST 2026`.

## 2026-05-13 17:47 IST - Remaining Public Fill Image Sizes Implementation

- Added `sizes="100vw"` to full-width fill images in:
  - `AmenitiesHeroSection`
  - `JourneyHeroSection`
  - `RishikeshExperienceSection`
  - `/shop` hero
- Added `sizes="(max-width: 768px) 100vw, 45vw"` to journey timeline event images.
- Timestamp check: `Wed May 13 17:47:58 IST 2026`.

## 2026-05-13 17:48 IST - Remaining Public Fill Image Sizes Green Test

- Command: `pnpm vitest run 'src/app/(public)/amenities/amenities-code-splitting.test.ts' 'src/app/(public)/journey/journey-code-splitting.test.ts' 'src/app/(public)/about-rishikesh/about-rishikesh-code-splitting.test.ts' 'src/app/(public)/shop/shop-code-splitting.test.ts'`
- Result: passed, 4 files / 9 tests.
- Timestamp check: `Wed May 13 17:48:12 IST 2026`.

## 2026-05-13 17:48 IST - Remaining Public Fill Image Audit Clean

- Command: custom Node audit over `src/app/(public)`, `src/components/marketing`, `src/components/public`, and `src/components/donations` for `Image fill` without `sizes`.
- Result: no public fill `Image` components missing `sizes` in the audited paths.
- Timestamp check: `Wed May 13 17:48:33 IST 2026`.

## 2026-05-13 17:48 IST - Remaining Public Fill Image Typecheck

- Command: `pnpm exec tsc --noEmit`
- Result: passed with no TypeScript errors.
- Timestamp check: `Wed May 13 17:48:46 IST 2026`.

## 2026-05-13 17:49 IST - Remaining Public Fill Image Full Test

- Command: `pnpm test`
- Result: passed, 99 files / 245 tests.
- Timestamp check: `Wed May 13 17:49:21 IST 2026`.

## 2026-05-13 17:50 IST - Remaining Public Fill Image Build

- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/amenities`, `/journey`, `/about-rishikesh`, and `/shop` remain about `112 kB` first-load JS with `1h` revalidation.
  - Shared first-load JS remains `105 kB`.
  - This pass reduces over-wide image candidate selection for fill images rather than changing JS route weight.
- Warning observation:
  - Node emitted the existing experimental type-stripping warning during build.
- Timestamp check: `Wed May 13 17:50:16 IST 2026`.

## 2026-05-13 17:50 IST - Remaining Public Fill Image Select Scan

- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Timestamp check: `Wed May 13 17:50:27 IST 2026`.

## 2026-05-13 17:50 IST - Source Supabase Select Audit

- Commands:
  - `rg -n "\\.select\\((['\\\"])?\\*|\\.select\\(\\)" src -S --glob '!**/*.test.*'`
  - `rg -n "\\.select\\(" src -S --glob '!**/*.test.*'`
  - `rg -n "supabase\\.|createClient\\(|createServerClient\\(|createBrowserClient\\(" src/app src/components src/hooks src/lib -S --glob '!**/*.test.*'`
- Result:
  - No non-test browser/source broad `select("*")` or empty `select()` calls found.
  - Remaining reads use explicit columns; next audit should focus on which explicit reads are still loaded unnecessarily at route startup.
- Note:
  - An initial multiline `rg` pattern failed because ripgrep needs multiline mode for `\n`; reran as simpler source inventories.
- Timestamp check: `Wed May 13 17:50:58 IST 2026`.

## 2026-05-13 17:52 IST - Housekeeping Assignment Egress Analysis

- Analysis:
  - `/admin/housekeeping` includes `housekeepingAssignments` in its startup plan.
  - `HousekeepingPanel` only uses assignments matching `formatISO(new Date(), { representation: "date" })`.
  - `api.getHousekeepingAssignments()` currently selects explicit columns but does not filter by date, so the housekeeping page can pull historical assignment rows it never renders.
- Test-first plan:
  - Add coverage that the admin housekeeping load calls `getHousekeepingAssignments` with today's date.
  - Add API helper coverage that `getHousekeepingAssignments(date)` applies `.eq("date", date)`.
- Timestamp check: `Wed May 13 17:52:19 IST 2026`.

## 2026-05-13 17:54 IST - Housekeeping Assignment Egress Red Test

- Added failing coverage:
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects `/admin/housekeeping` startup to call `getHousekeepingAssignments(<today>)`.
  - `src/lib/api/index.test.ts` now expects `getHousekeepingAssignments(date)` to apply `.eq("date", date)`.
- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Intended result: failed because the hook passed no date and the API helper did not filter by `date`.
- Timestamp check: `Wed May 13 17:54:13 IST 2026`.

## 2026-05-13 17:54 IST - Housekeeping Assignment Date Scope

- Updated `getHousekeepingAssignments(date)` to apply `.eq("date", date)`.
- Added a local date-key helper in `useAppData` and passed today's local date into the housekeeping assignment startup fetch.
- Updated the existing API query-shape test to use the date-scoped helper signature.
- Timestamp check: `Wed May 13 17:54:58 IST 2026`.

## 2026-05-13 17:55 IST - Housekeeping Assignment Egress Green Test

- Command: `pnpm vitest run src/lib/api/index.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 24 tests.
- Timestamp check: `Wed May 13 17:55:15 IST 2026`.

## 2026-05-13 17:55 IST - Housekeeping Assignment Typecheck

- Command: `pnpm exec tsc --noEmit`
- Result: passed with no TypeScript errors.
- Timestamp check: `Wed May 13 17:55:39 IST 2026`.

## 2026-05-13 17:56 IST - Housekeeping Assignment Full Test

- Command: `pnpm test`
- Result: passed, 99 files / 247 tests.
- Timestamp check: `Wed May 13 17:56:28 IST 2026`.

## 2026-05-13 17:57 IST - Housekeeping Assignment Build

- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/housekeeping` remains about `106 kB` first-load JS.
  - This pass narrows housekeeping startup egress to today's assignment rows instead of changing route JS weight.
- Timestamp check: `Wed May 13 17:57:21 IST 2026`.

## 2026-05-13 17:57 IST - Housekeeping Assignment Select Scan

- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Timestamp check: `Wed May 13 17:57:33 IST 2026`.

## 2026-05-13 17:58 IST - Housekeeper User Egress Analysis

- Analysis:
  - `/admin/housekeeping` currently loads `roles` and `users` in its startup plan.
  - `users` comes from the `get-users` Edge Function, which calls `auth.admin.listUsers()` and returns all auth users with email addresses.
  - The housekeeping UI only needs housekeeper `id` and `name` for assignment and display, plus today's housekeeping assignments.
  - `AssignHousekeeperDialog` uses roles only to filter `users` down to the `Housekeeper` role.
- Test-first plan:
  - Add a route-backed `/api/admin/housekeepers` payload that requires the housekeeping feature and selects only profile id/name/role id for `Housekeeper` profiles.
  - Change the housekeeping app-data plan to load a `housekeepers` dataset instead of all `users` plus `roles`.
  - Update `AssignHousekeeperDialog` to treat context `users` as the already-filtered housekeeper list on that route.
- Timestamp check: `Wed May 13 17:58:53 IST 2026`.

## 2026-05-13 18:00 IST - Housekeeper User Egress Red Test

- Added failing coverage:
  - `src/hooks/app-data-load-plan.test.ts` expects `/admin/housekeeping` to load `housekeepers` instead of `roles` and `users`.
  - `src/hooks/use-app-data.load-plan.test.tsx` expects `/admin/housekeeping` to fetch `/api/admin/housekeepers` and avoid `getRoles()` / `getUsers()`.
  - `src/app/api/admin/housekeepers/route.test.ts` defines the expected minimal profile route.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/api/admin/housekeepers/route.test.ts`
- Intended result: failed because the app-data plan still includes `roles`/`users` and the route does not exist yet.
- Timestamp check: `Wed May 13 18:00:30 IST 2026`.

## 2026-05-13 18:01 IST - Housekeeper User Route Implementation

- Added `/api/admin/housekeepers`, guarded by `requireFeature(request, "housekeeping")`.
- The route reads `profiles` with `id, name, role_id, roles!inner(name)`, filters `roles.name = Housekeeper`, and returns minimal user-shaped rows with blank email.
- Added a `housekeepers` app-data dataset and changed the `/admin/housekeeping` plan to use it instead of `roles` and all `users`.
- Updated `useAppData` to fetch `/api/admin/housekeepers` for that dataset.
- Updated `AssignHousekeeperDialog` to use the already-filtered context `users` list as housekeepers.
- Timestamp check: `Wed May 13 18:01:30 IST 2026`.

## 2026-05-13 18:01 IST - Housekeeper User Egress Green Test

- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/app/api/admin/housekeepers/route.test.ts`
- Result: passed, 3 files / 52 tests.
- Timestamp check: `Wed May 13 18:01:53 IST 2026`.

## 2026-05-13 18:02 IST - Housekeeper User Typecheck

- Command: `pnpm exec tsc --noEmit`
- Result: passed with no TypeScript errors.
- Timestamp check: `Wed May 13 18:02:20 IST 2026`.

## 2026-05-13 18:03 IST - Housekeeper User Full Test

- Command: `pnpm test`
- Result: passed, 100 files / 248 tests.
- Timestamp check: `Wed May 13 18:03:06 IST 2026`.

## 2026-05-13 18:03 IST - Housekeeper User Build Failure

- Command: `pnpm build`
- Result: failed.
- Failure:
  - Next.js route type validation rejected `HOUSEKEEPER_PROFILE_SELECT_COLUMNS` as an invalid named export from `src/app/api/admin/housekeepers/route.ts`.
- Fix plan:
  - Move the select constant into a colocated non-route module and import it from both route and test.
- Timestamp check: `Wed May 13 18:03:54 IST 2026`.

## 2026-05-13 18:04 IST - Housekeeper Route Export Fix

- Added `src/app/api/admin/housekeepers/columns.ts` for `HOUSEKEEPER_PROFILE_SELECT_COLUMNS`.
- Updated the route and route test to import the select constant from the colocated columns module, leaving `route.ts` with only valid route exports.
- Timestamp check: `Wed May 13 18:04:19 IST 2026`.

## 2026-05-13 18:04 IST - Housekeeper Route Export Fix Focused Test

- Command: `pnpm vitest run src/app/api/admin/housekeepers/route.test.ts`
- Result: passed, 1 file / 1 test.
- Timestamp check: `Wed May 13 18:04:32 IST 2026`.

## 2026-05-13 18:04 IST - Housekeeper Route Export Fix Typecheck

- Command: `pnpm exec tsc --noEmit`
- Result: passed with no TypeScript errors.
- Timestamp check: `Wed May 13 18:04:47 IST 2026`.

## 2026-05-13 18:05 IST - Housekeeper Route Export Fix Full Test

- Command: `pnpm test`
- Result: passed, 100 files / 248 tests.
- Timestamp check: `Wed May 13 18:05:26 IST 2026`.

## 2026-05-13 18:06 IST - Housekeeper User Build

- Command: `pnpm build`
- Result: passed after moving the housekeeper select constant out of `route.ts`.
- Build observation:
  - New `/api/admin/housekeepers` route is present at the standard API shell size.
  - `/admin/housekeeping` remains about `106 kB` first-load JS.
  - Static page generation count increased from 75 to 76 because of the added route entry.
- Warning observation:
  - Node emitted the existing experimental type-stripping warning during build.
- Timestamp check: `Wed May 13 18:06:12 IST 2026`.

## 2026-05-13 18:06 IST - Housekeeper User Select Scan

- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Timestamp check: `Wed May 13 18:06:25 IST 2026`.

## 2026-05-13 18:06 IST - Housekeeping Source Check

- Commands:
  - `rg -n "getUsers\\(|getRoles\\(|roles|users" src/app/admin/housekeeping src/hooks/app-data-load-plan.ts src/hooks/use-app-data.ts -S --glob '!**/*.test.*'`
  - `rg -n "auth\\.admin\\.listUsers|get-users|/api/admin/housekeepers|housekeepers" src supabase/functions -S --glob '!**/*.test.*'`
- Result:
  - Housekeeping UI still reads context `users`, but that route now receives the housekeeper-only payload.
  - `/admin/housekeeping` no longer needs `roles` in its route plan or dialog filtering path.
  - The all-users Edge Function remains available for settings/user-management flows, while housekeeping now calls `/api/admin/housekeepers`.
- Timestamp check: `Wed May 13 18:06:49 IST 2026`.

## 2026-05-13 18:08 IST - Dashboard Calendar Reservation Egress Analysis

- Research:
  - Supabase JavaScript `select()` docs note that projects return a maximum row count by default and recommend keeping it low to limit accidental payload size, using `range()` for pagination: https://supabase.com/docs/reference/javascript/select
  - Supabase JavaScript `range()` docs define bounded, ordered result windows with zero-based inclusive indexes: https://supabase.com/docs/reference/javascript/range
- Analysis:
  - `useAppData` still has a background effect that calls browser-side `api.getReservations()` whenever the route plan includes `dashboardReservations`.
  - `api.getReservations()` pages through every reservation row in 500-row chunks through the browser Supabase client.
  - `/admin/dashboard` and `/admin/calendar` already load route-backed booking summaries through `/api/admin/reservations` and the modern calendar fetches monthly availability through `/api/admin/availability/monthly`.
  - The automatic full-reservation background call mainly supports legacy/hover details and can create large ongoing egress even when the user only opens dashboard or calendar.
- Test-first plan:
  - Add a route-load test requiring dashboard startup to avoid the background `api.getReservations()` call after the route-backed data load settles.
  - Remove the automatic background full-reservations effect from `useAppData`.
- Timestamp check: `Wed May 13 18:08:24 IST 2026`.

## 2026-05-13 18:11 IST - Dashboard Full Reservation Background Red Test

- Added failing coverage in `src/hooks/use-app-data.load-plan.test.tsx`.
- Command: `pnpm vitest run src/hooks/use-app-data.load-plan.test.tsx`
- Intended result: failed because `/admin/dashboard` still called `api.getReservations()` once after startup.
- Timestamp check: `Wed May 13 18:11:05 IST 2026`.

## 2026-05-13 18:12 IST - Dashboard Full Reservation Background Removal

- Removed the automatic `api.getReservations()` background effect from `useAppData`.
- Dashboard and calendar startup now rely on route-backed `/api/admin/reservations` summaries plus the monthly availability API instead of an unbounded browser Supabase reservation sweep.
- Timestamp check: `Wed May 13 18:12:08 IST 2026`.

## 2026-05-13 18:12 IST - Dashboard Full Reservation Background Green Test

- Command: `pnpm vitest run src/hooks/use-app-data.load-plan.test.tsx src/hooks/app-data-load-plan.test.ts`
- Result: passed, 2 files / 52 tests.
- Timestamp check: `Wed May 13 18:12:33 IST 2026`.

## 2026-05-13 18:13 IST - Dashboard Full Reservation Background Typecheck

- Command: `pnpm exec tsc --noEmit`
- Result: passed with no TypeScript errors.
- Timestamp check: `Wed May 13 18:13:07 IST 2026`.

## 2026-05-13 18:14 IST - Dashboard Full Reservation Background Full Test

- Command: `pnpm test`
- Result: passed, 100 files / 249 tests.
- Timestamp check: `Wed May 13 18:14:22 IST 2026`.

## 2026-05-13 18:15 IST - Dashboard Full Reservation Background Build

- Command: `pnpm build`
- Result: passed.
- Build observation:
  - `/admin/dashboard` remains about `106 kB` first-load JS.
  - `/admin/calendar` remains about `106 kB` first-load JS.
  - This pass removes automatic reservation egress rather than changing route JS weight.
- Timestamp check: `Wed May 13 18:15:37 IST 2026`.

## 2026-05-13 18:15 IST - Dashboard Full Reservation Background Select Scan

- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
- Result: no remaining broad Supabase select matches in audited server/API paths.
- Timestamp check: `Wed May 13 18:15:52 IST 2026`.

## 2026-05-13 03:26 IST - Room Detail Inventory Red Tests

- Research refresh:
  - Supabase JavaScript docs show `select('name', { count: 'exact' })` and note `{ count: 'exact', head: true }` when row bodies are not needed.
  - Supabase filter docs confirm filters are chained after `select()`, and `.eq()` / `.in()` match the planned room-type and status predicates.
- Added failing coverage for replacing public room detail's full `rooms` dataset dependency with route-backed room-type inventory:
  - `src/hooks/app-data-load-plan.test.ts`
  - `src/lib/server/room-type-inventory.test.ts`
  - `src/app/api/room-types/[id]/inventory/route.test.ts`
  - `src/hooks/use-room-type-inventory.test.tsx`
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/lib/server/room-type-inventory.test.ts 'src/app/api/room-types/[id]/inventory/route.test.ts' src/hooks/use-room-type-inventory.test.tsx`
- Intended result: failed because `PUBLIC_BOOKING_ROOM_PLAN` still includes `rooms`, and the new helper, API route, and hook modules do not exist yet.

## 2026-05-13 03:28 IST - Room Detail Inventory Egress Fix

- Implemented `getPublicRoomTypeInventory()` with a Supabase `rooms` head-count query filtered by `room_type_id` and bookable housekeeping statuses.
- Added `GET /api/room-types/[id]/inventory` with `Cache-Control: no-store` and missing-id validation.
- Added `useRoomTypeInventory()` to fetch only the selected room type's inventory count from that route.
- Removed `rooms` from `PUBLIC_BOOKING_ROOM_PLAN` so public room detail routes no longer load the whole rooms dataset at startup.
- Updated `src/app/(public)/book/rooms/[id]/page.tsx` to use the route-backed inventory count while retaining date-specific availability checks.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/lib/server/room-type-inventory.test.ts 'src/app/api/room-types/[id]/inventory/route.test.ts' src/hooks/use-room-type-inventory.test.tsx`
- Result: passed, 4 files / 43 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 03:31 IST - Room Detail Booking Panel Split Started

- Analysis:
  - `/book/rooms/[id]` remains the largest public route in the build output at about `432 kB` first-load JS.
  - The room detail page still imports the booking form stack directly: `react-hook-form`, zod resolver, `zod`, form/popover UI, pricing calculation, pricing breakdown, and availability/inventory hooks.
- Added a stricter code-splitting test requiring the booking form stack to move behind `./components/room-booking-panel`.
- Command: `pnpm vitest run 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts'`
- Intended result: failed because `room-booking-panel` is not yet present and the page still owns the booking form imports.

## 2026-05-13 03:37 IST - Room Detail Booking Panel Split

- Added `src/app/(public)/book/rooms/[id]/components/room-booking-panel.tsx`.
- Moved the room detail booking form stack into that route-local component:
  - form/zod validation,
  - date/guest/room popovers,
  - pricing calculation and breakdown,
  - inventory and date availability hooks.
- Updated `src/app/(public)/book/rooms/[id]/page.tsx` to dynamically import `RoomBookingPanel`, leaving the initial page chunk focused on room content, media, amenities, policies, share dialog, and related room cards.
- Command: `pnpm vitest run 'src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts'`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 03:22 IST - Latest Tail Verification Snapshot

- Tail reconciliation:
  - Several 02:30-03:22 optimization entries exist earlier in this file due patch context matching older sections.
  - This snapshot is appended at the physical file tail so the latest state is visible at EOF.
- Latest completed frontend bundle passes in this session:
  - `/book`: about `462 kB` -> `270-271 kB` first-load JS.
  - `/admin/settings`: about `491 kB` -> `183-184 kB`.
  - `/admin/posts/create` and `/admin/posts/[id]`: about `370 kB` -> `240 kB`.
  - `/admin/guests`, `/admin/rooms`, `/admin/room-types`, `/admin/rates`, `/admin/room-categories`, `/admin/reservations`: reduced to about `176 kB`.
  - `/admin` and `/admin/dashboard`: about `311 kB` -> `176 kB`.
  - `/book/rooms/[id]`: about `454 kB` -> `432 kB` after low-risk widget deferrals.
- Latest gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 49 files / 140 tests.
  - Command: `pnpm build`
  - Result: passed.
- Latest broad select scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 03:22:30 IST 2026`.

## 2026-05-13 03:23 IST - Room Detail Room Dataset Egress Started

- Research refresh:
  - Supabase JS select docs show selecting specific columns with `select("column")` rather than pulling every column.
  - Supabase JS filter docs show `.eq(column, value)` for narrowing a table query server-side.
- Analysis:
  - `/book/rooms/[id]` still uses the public room route plan that loads the full `rooms` dataset.
  - The page only needs total bookable rooms for the selected room type; it does not need every room row on startup.
  - Existing date-specific availability already uses `/api/availability/search`, so the remaining full `rooms` load is only for inventory count/capping.
- Next step:
  - Add tests for a narrow room-type inventory server helper/API/hook and for removing `rooms` from the public room detail plan before implementation.

## 2026-05-13 02:59 IST - Room Detail Code-Splitting Started

- Analysis:
  - Latest build still shows `/book/rooms/[id]` with a large first-load JS payload.
  - The room detail page directly imports the share dialog and related room cards even though the dialog is only used after user intent and related rooms are below the main booking flow.
  - Existing worktree changes in this file include the availability-search refactor; this pass will keep those intact and only adjust import boundaries.
- Next step:
  - Add a failing static guard for dynamic imports before changing the room detail page.
- Command: `date`
- Result: `Wed May 13 02:59:30 IST 2026`.

## 2026-05-13 03:01 IST - Room Detail Code-Splitting Pass

- Implemented room detail frontend performance change:
  - Added a static guard in `src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts`.
  - Moved `ShareDialog` and related-room `RoomTypeCard` behind `next/dynamic` in `src/app/(public)/book/rooms/[id]/page.tsx`.
  - Mounted the share dialog only when the share button opens it, avoiding a normal hydration-time dialog chunk load.
- Focused gate:
  - Command: `pnpm vitest run src/app/'(public)'/book/rooms/'[id]'/room-detail-code-splitting.test.ts`
  - Expected first result: failed because the page still directly imported deferred UI.
  - Result after implementation: passed, 1 file / 1 test.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 43 files / 134 tests.
  - Command: `pnpm build`
  - Result: passed.
- Build result:
  - Before split: `/book/rooms/[id]` was about `23.3 kB` route size and `479 kB` first-load JS.
  - After split: `/book/rooms/[id]` is `22.8 kB` route size and `453 kB` first-load JS.
- Follow-up scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 03:01:25 IST 2026`.

## 2026-05-13 03:02 IST - Booking Page Code-Splitting Started

- Analysis:
  - Latest build shows `/book` at about `15.8 kB` route size and `462 kB` first-load JS.
  - `BookingWidget` is first-screen functionality and should remain direct.
  - Room cards are below the search form, `BookingSummary` only appears after room selection, and the brochure PDF dialog only opens after explicit user action.
- Next step:
  - Add failing static guards for the `/book` page and brochure dialog split.

## 2026-05-13 03:04 IST - Booking Page Code-Splitting Pass

- Implemented booking frontend performance changes:
  - Added `src/app/(public)/book/book-code-splitting.test.ts`.
  - Added `src/components/public/brochure-section-code-splitting.test.ts`.
  - Moved `/book` room cards and post-selection `BookingSummary` behind `next/dynamic`.
  - Split the brochure PDF viewer into `src/components/public/brochure-viewer-dialog.tsx` and only mount it when the viewer opens.
- Focused gate:
  - Command: `pnpm vitest run src/app/'(public)'/book/book-code-splitting.test.ts src/components/public/brochure-section-code-splitting.test.ts`
  - Expected first result: failed because the page and brochure section still directly imported deferred UI.
  - Result after implementation: passed, 2 files / 2 tests.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 45 files / 136 tests.
  - Command: `pnpm build`
  - Result: passed.
- Build result:
  - Before split: `/book` was about `15.8 kB` route size and `462 kB` first-load JS.
  - After split: `/book` is `11 kB` route size and `270 kB` first-load JS.
  - `/book/rooms/[id]` remains `453 kB` first-load JS, so its remaining weight is mostly in the room detail booking/form path rather than shared room cards.
- Follow-up scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 03:04:09 IST 2026`.

## 2026-05-13 03:05 IST - Admin Settings Code-Splitting Started

- Analysis:
  - Latest build shows `/admin/settings` at about `25.8 kB` route size and `491 kB` first-load JS.
  - The settings page directly imports every tab panel, including users/roles/amenities data tables, form dialogs, property closures, and the 631-line CSV import panel.
  - These panels can be loaded behind the settings tabs without changing the route data plan or permissions.
- Next step:
  - Add a failing static guard that prevents direct tab-panel imports in `src/app/admin/settings/page.tsx`.

## 2026-05-13 03:07 IST - Admin Settings Code-Splitting Pass

- Implemented admin settings frontend performance changes:
  - Added `src/app/admin/settings/settings-code-splitting.test.ts`.
  - Extracted settings tabs into `src/app/admin/settings/settings-tabs.tsx`.
  - Moved property, closures, amenities, roles, users, and CSV import tab panels behind `next/dynamic`.
  - Kept the billing placeholder inline because it is small and static.
- Focused gate:
  - Command: `pnpm vitest run src/app/admin/settings/settings-code-splitting.test.ts`
  - Expected first result: failed because `page.tsx` directly imported every settings tab panel.
  - Result after implementation: passed, 1 file / 1 test.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 46 files / 137 tests.
  - Command: `pnpm build`
  - Result: passed.
- Build result:
  - Before split: `/admin/settings` was about `25.8 kB` route size and `491 kB` first-load JS.
  - After split: `/admin/settings` is `7.37 kB` route size and `183 kB` first-load JS.
- Follow-up scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 03:07:07 IST 2026`.

## 2026-05-13 03:08 IST - Post Editor Code-Splitting Started

- Analysis:
  - Latest build shows `/admin/posts/create` and `/admin/posts/[id]` at about `370 kB` first-load JS.
  - `PostForm` directly imports the Tiptap-backed rich text editor, even though the form already imports `next/dynamic`.
  - The editor can be lazy-loaded at the content field boundary while keeping the rest of the post form interactive.
- Next step:
  - Add a failing static guard that prevents `PostForm` from directly importing `rich-text-editor`.

## 2026-05-13 03:09 IST - Post Editor Code-Splitting Pass

- Implemented post editor frontend performance change:
  - Added `src/components/admin/posts/post-form-code-splitting.test.ts`.
  - Replaced the direct Tiptap `RichTextEditor` import in `src/components/admin/posts/post-form.tsx` with a `next/dynamic` boundary at the content field.
  - Kept the rest of the post form direct so title, metadata, category, and featured image controls remain available while the editor chunk loads.
- Focused gate:
  - Command: `pnpm vitest run src/components/admin/posts/post-form-code-splitting.test.ts`
  - Expected first result: failed because `PostForm` still directly imported the editor.
  - Result after implementation: passed, 1 file / 1 test.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 47 files / 138 tests.
  - Command: `pnpm build`
  - Result: passed.
- Build result:
  - Before split: `/admin/posts/create` and `/admin/posts/[id]` were about `370 kB` first-load JS.
  - After split: both routes are `240 kB` first-load JS.
- Follow-up scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 03:09:10 IST 2026`.

## 2026-05-13 03:10 IST - Admin Management Table Code-Splitting Started

- Analysis:
  - Latest build still shows admin management list routes with high first-load JS:
    - `/admin/guests` about `302 kB`,
    - `/admin/rooms` about `286 kB`,
    - `/admin/room-types` about `289 kB`,
    - `/admin/rates` about `286 kB`.
  - These pages directly import table columns, TanStack table wrappers, pagination, and form dialogs.
  - Each can keep its permission gate in the route page while loading the table management surface as a dynamic panel.
- Next step:
  - Add failing static guards for the page-level table/dialog imports before extracting panels.

## 2026-05-13 03:12 IST - Admin Management Table Code-Splitting Pass

- Implemented admin management frontend performance changes:
  - Added `src/app/admin/admin-management-code-splitting.test.ts`.
  - Extracted dynamic panels for:
    - `src/app/admin/guests/components/guests-panel.tsx`,
    - `src/app/admin/rooms/components/rooms-panel.tsx`,
    - `src/app/admin/room-types/components/room-types-panel.tsx`,
    - `src/app/admin/rates/components/rates-panel.tsx`.
  - Kept page-level permission gates direct and moved TanStack tables, columns, dialogs, and seasonal price controls behind dynamic panel imports.
- Focused gate:
  - Command: `pnpm vitest run src/app/admin/admin-management-code-splitting.test.ts`
  - Expected first result: failed because the pages still directly imported table management components.
  - Result after implementation: passed, 1 file / 1 test.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 48 files / 139 tests.
  - Command: `pnpm build`
  - Result: passed.
- Build result:
  - `/admin/guests`: about `302 kB` -> `176 kB` first-load JS.
  - `/admin/rooms`: about `286 kB` -> `176 kB` first-load JS.
  - `/admin/room-types`: about `289 kB` -> `176 kB` first-load JS.
  - `/admin/rates`: about `286 kB` -> `176 kB` first-load JS.
- Follow-up scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 03:12:13 IST 2026`.

## 2026-05-13 03:13 IST - Reservation And Category Table Code-Splitting Started

- Analysis:
  - `/admin/room-categories` still directly imports the same table/dialog stack as the other admin management pages.
  - `/admin/reservations` directly imports its paginated reservation table, columns, and financial mapping logic into the page bundle.
  - Both can keep page-level permission gates direct while loading table surfaces as dynamic panels.
- Next step:
  - Extend the static management guard to cover room categories and the reservations index before extracting panels.

## 2026-05-13 03:15 IST - Reservation And Category Table Code-Splitting Pass

- Implemented additional admin table performance changes:
  - Added `src/app/admin/room-categories/components/room-categories-panel.tsx`.
  - Added `src/app/admin/reservations/components/reservations-panel.tsx`.
  - Moved room category table/dialog imports and reservation index table/financial mapping imports out of the route pages and behind dynamic panel imports.
  - Kept page-level permission gates direct.
- Focused gate:
  - Command: `pnpm vitest run src/app/admin/admin-management-code-splitting.test.ts`
  - Expected first result: failed because room categories and reservations still directly imported table components.
  - Result after implementation: passed, 1 file / 1 test.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 48 files / 139 tests.
  - Command: `pnpm build`
  - Result: passed.
- Build result:
  - `/admin/room-categories`: about `278 kB` -> `176 kB` first-load JS.
  - `/admin/reservations`: about `285 kB` -> `176 kB` first-load JS.
- Follow-up scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 03:15:36 IST 2026`.

## 2026-05-13 03:16 IST - Dashboard Code-Splitting Started

- Analysis:
  - Latest build shows `/admin` and `/admin/dashboard` around `311 kB` first-load JS.
  - The dashboard route directly imports DnD, availability calendar, sticky notes, and dashboard table modules.
  - These can move behind a dynamic dashboard panel while preserving the route-level dashboard permission gate.
- Next step:
  - Add a failing static guard for the dashboard route imports before extracting the panel.

## 2026-05-13 03:18 IST - Dashboard Code-Splitting Pass

- Implemented dashboard frontend performance change:
  - Added `src/app/admin/dashboard/dashboard-code-splitting.test.ts`.
  - Extracted the DnD/calendar/sticky-notes/table dashboard board into `src/app/admin/dashboard/components/dashboard-panel.tsx`.
  - Kept the route-level dashboard permission gate direct in `src/app/admin/dashboard/page.tsx`.
- Focused gate:
  - Command: `pnpm vitest run src/app/admin/dashboard/dashboard-code-splitting.test.ts`
  - Expected first result: failed because the route directly imported DnD and dashboard board modules.
  - Result after implementation: passed, 1 file / 1 test.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 49 files / 140 tests.
  - Command: `pnpm build`
  - Result: passed.
- Build result:
  - `/admin`: about `311 kB` -> `176 kB` first-load JS.
  - `/admin/dashboard`: about `311 kB` -> `176 kB` first-load JS.
- Follow-up scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 03:18:36 IST 2026`.

## 2026-05-13 03:19 IST - Room Detail Widget Code-Splitting Started

- Analysis:
  - `/book/rooms/[id]` remains the largest route at about `454 kB` first-load JS.
  - A full booking-form extraction is higher risk because form state, availability, pricing, and routing are tightly coupled.
  - Lower-risk widgets to defer first are the date calendar, mobile carousel, and ashram-rules accordion.
- Next step:
  - Extend the room detail static guard to prevent direct imports of those widget libraries.

## 2026-05-13 03:22 IST - Room Detail Widget Code-Splitting Pass

- Implemented room detail widget performance changes:
  - Extended `src/app/(public)/book/rooms/[id]/room-detail-code-splitting.test.ts`.
  - Moved the date calendar behind a dynamic import.
  - Added `src/app/(public)/book/rooms/[id]/components/room-photo-carousel.tsx` for the mobile carousel.
  - Added `src/app/(public)/book/rooms/[id]/components/room-policies-accordion.tsx` for the ashram-rules accordion.
  - Removed unused room-detail lucide icon imports and the stale commented action button.
- Focused gate:
  - Command: `pnpm vitest run src/app/'(public)'/book/rooms/'[id]'/room-detail-code-splitting.test.ts`
  - Expected first result: failed because the room detail page still directly imported widget libraries.
  - Result after implementation: passed, 1 file / 1 test.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 49 files / 140 tests.
  - Command: `pnpm build`
  - Result: passed.
- Build result:
  - `/book/rooms/[id]`: about `454 kB` -> `432 kB` first-load JS.
  - Note: the route remains the largest bundle; the next meaningful reduction likely requires extracting the coupled booking form/pricing/availability panel.
- Follow-up scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 03:22:04 IST 2026`.

## 2026-05-13 02:30 IST - Footer Priority Build Gate

- Completed the footer image preload pass:
  - Removed `priority` from the offscreen marketing footer logo.
  - Added `src/components/marketing/layout/Footer.test.tsx` to lock that the footer logo is not priority-preloaded.
- Gates from this pass:
  - Command: `pnpm vitest run src/components/marketing/layout/Footer.test.tsx`
  - Result: passed, 1 file / 1 test.
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 30 files / 117 tests.
  - Command: `pnpm build`
  - Result: passed.
- Follow-up scan:
  - Command: `rg -n "\\bpriority\\b|fetchPriority|preload" src -S`
  - Result: remaining `priority` uses are in first-viewport hero/header images or a delayed event banner candidate.
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 02:30:12 IST 2026`.

## 2026-05-13 02:33 IST - Event Banner Modal Priority Pass

- Analysis:
  - `EventBannerModal` fetches the banner only after `window.load` and a 5s timer.
  - The modal image is therefore not first-viewport critical content and should not request Next image priority preloading.
- Added `src/components/marketing/home/EventBannerModal.test.tsx`.
  - First focused run failed after the test harness was corrected: the delayed banner image reported `data-priority="true"`.
- Change:
  - Removed `priority` from the delayed event banner modal image.
- Gates:
  - Command: `pnpm vitest run src/components/marketing/home/EventBannerModal.test.tsx`
  - Result: passed, 1 file / 1 test.
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 31 files / 118 tests.
  - Command: `pnpm build`
  - Result: passed.
- Follow-up scans:
  - Command: `rg -n "\\bpriority\\b|fetchPriority|preload" src -S`
  - Result: remaining real image `priority` props are on first-viewport hero/header images; the event banner modal no longer appears.
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 02:33:06 IST 2026`.

## 2026-05-13 02:35 IST - Admin Reports Reservation Egress Started

- Analysis:
  - `/admin/reports` still used the `dashboardReservations` dataset.
  - That caused the global app-data fetch to call `/api/admin/reservations?limit=1000&offset=0&includeCount=1`, followed by the background full `getReservations()` load when the dashboard reservation dataset was enabled.
  - The default bookings report tab only needs property data; occupancy and revenue can fetch a lean route-local reservation range when those tabs mount.
- Added failing tests first:
  - `src/hooks/app-data-load-plan.test.ts` now expects `/admin/reports` to load only property and rooms.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects no reservation startup requests on `/admin/reports`.
  - New tests cover a lean report reservations server helper, API route, and client hook.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/lib/server/report-reservations.test.ts src/app/api/admin/reports/reservations/route.test.ts src/hooks/use-report-reservations.test.tsx`
- Expected first result: failed because the plan still included `dashboardReservations` and the new implementation files did not exist yet.
- Command: `date`
- Result: `Wed May 13 02:35:53 IST 2026`.

## 2026-05-13 02:39 IST - Admin Reports Reservation Egress Pass

- Implemented the report egress change:
  - Added `src/lib/server/report-reservations.ts` with exact report columns only: `id, check_in_date, check_out_date, status, total_amount`.
  - Added `GET /api/admin/reports/reservations` with `requireFeature("reports")`, date validation, and `Cache-Control: private, no-store`.
  - Added `src/hooks/use-report-reservations.ts` to fetch report rows by selected date range with normalized date-string dependencies.
  - Updated occupancy and revenue reports to use the lean route-local report rows.
  - Removed `dashboardReservations` from the `/admin/reports` app-data plan so the reports shell no longer calls `/api/admin/reservations?limit=1000...` or the background full `getReservations()` load.
- Focused gate:
  - Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/lib/server/report-reservations.test.ts src/app/api/admin/reports/reservations/route.test.ts src/hooks/use-report-reservations.test.tsx`
  - First result after implementation: one hook test failure exposed a real dependency bug from using `Date` object identity.
  - Fix: depend on normalized `YYYY-MM-DD` strings in `useReportReservations`.
  - Final result: passed, 5 files / 51 tests.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 34 files / 123 tests.
  - Command: `pnpm build`
  - Result: passed.
- Follow-up scans:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
  - Command: `rg -n "ADMIN_REPORTS_PLAN|/admin/reports|dashboardReservations|useReportReservations|reports/reservations" src/hooks src/app/admin/reports src/app/api/admin/reports src/lib/server/report-reservations.ts -S`
  - Result: reports components use `useReportReservations`; `dashboardReservations` remains only in other route plans/tests and is not part of `ADMIN_REPORTS_PLAN`.
- Command: `date`
- Result: `Wed May 13 02:38:58 IST 2026`.

## 2026-05-13 02:42 IST - Guest Details Reservation Egress Started

- Analysis:
  - `/admin/guests/[id]` still used the `dashboardReservations` dataset to show one guest's reservation history.
  - That route only needs guest-scoped reservation rows plus existing room data for room numbers.
- Added failing tests first:
  - `src/hooks/app-data-load-plan.test.ts` now expects guest details to omit `dashboardReservations`.
  - `src/hooks/use-app-data.load-plan.test.tsx` now expects no global reservation startup requests for guest details.
  - New tests cover a guest reservation server helper, API route, and client hook.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/lib/server/guest-reservations.test.ts src/app/api/admin/guests/'[id]'/reservations/route.test.ts src/hooks/use-guest-reservations.test.tsx`
- Expected first result: failed because guest details still included `dashboardReservations` and the new implementation files did not exist yet.
- Command: `date`
- Result: `Wed May 13 02:41:47 IST 2026`.

## 2026-05-13 02:44 IST - Guest Details Reservation Egress Pass

- Implemented the guest-detail egress change:
  - Added `src/lib/server/guest-reservations.ts` with exact guest history columns only: `id, booking_id, room_id, status, check_in_date, check_out_date`.
  - Added `GET /api/admin/guests/[id]/reservations` with `requireFeature("guests")` and `Cache-Control: private, no-store`.
  - Added `src/hooks/use-guest-reservations.ts`.
  - Updated `/admin/guests/[id]` to load reservation history through the guest-scoped endpoint and keep room-number joining local via the existing rooms dataset.
  - Removed `dashboardReservations` from the `/admin/guests/[id]` app-data plan.
- Focused gate:
  - Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/lib/server/guest-reservations.test.ts src/app/api/admin/guests/'[id]'/reservations/route.test.ts src/hooks/use-guest-reservations.test.tsx`
  - Result: passed, 5 files / 51 tests.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 37 files / 127 tests.
  - Command: `pnpm build`
  - Result: passed.
- Follow-up scans:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
  - Command: `rg -n "ADMIN_GUEST_DETAILS_PLAN|/admin/guests|useGuestReservations|guest-reservations|dashboardReservations" src/hooks src/app/admin/guests src/app/api/admin/guests src/lib/server/guest-reservations.ts -S`
  - Result: guest detail page uses `useGuestReservations`; `dashboardReservations` remains only in other route plans/tests and is not part of `ADMIN_GUEST_DETAILS_PLAN`.
- Command: `date`
- Result: `Wed May 13 02:43:57 IST 2026`.

## 2026-05-13 02:46 IST - Monthly Availability Cache Pass Started

- Analysis:
  - Admin availability calendar hooks call the Supabase `get_monthly_availability` RPC directly from the browser for each visible month.
  - Moving this behind an authenticated admin route with a short server cache can reduce repeated Supabase RPC egress while keeping client responses private/no-store.
  - The cache will use the existing reservations cache tag so reservation mutations can revalidate it through the existing reservations revalidation endpoint.
- Added failing tests first:
  - New server helper test expects `unstable_cache` with the reservations cache tag and normalized room type IDs.
  - New API route test expects authenticated calendar access, private no-store response headers, and parameter validation.
  - New hook test expects `useMonthlyAvailability` to call the admin API instead of the browser Supabase client.
- Command: `pnpm vitest run src/lib/server/monthly-availability.test.ts src/app/api/admin/availability/monthly/route.test.ts src/hooks/use-monthly-availability.test.tsx`
- Expected first result: failed because the server helper/API route did not exist and the hook still used the old direct client path; the hook test also exposed existing Date/array dependency instability.
- Command: `date`
- Result: `Wed May 13 02:46:05 IST 2026`.

## 2026-05-13 02:50 IST - Monthly Availability Cache Pass

- Implemented the monthly availability egress change:
  - Added `src/lib/server/monthly-availability.ts`.
  - Wrapped `get_monthly_availability` RPC reads in `unstable_cache` with `revalidate: 60` and the existing `RESERVATIONS_CACHE_TAG`.
  - Added `GET /api/admin/availability/monthly` with `requireFeature("calendar")`, month-start validation, normalized room type IDs, and `Cache-Control: private, no-store`.
  - Updated `useMonthlyAvailability` and `useMultiMonthAvailability` to fetch through the authenticated admin route instead of the browser Supabase client.
  - Fixed hook dependency stability by using normalized month and room-type keys rather than raw `Date`/array identity.
  - Removed the now-unused direct browser `getMonthlyAvailability` Supabase RPC export from `src/lib/api/index.ts`.
- Focused gates:
  - Command: `pnpm vitest run src/lib/server/monthly-availability.test.ts src/app/api/admin/availability/monthly/route.test.ts src/hooks/use-monthly-availability.test.tsx`
  - First result after implementation: one test harness failure from clearing the import-time `unstable_cache` call.
  - Fix: reset only the Supabase mock for that test, preserving the cache wrapper assertion.
  - Final result: passed, 3 files / 4 tests.
  - Command: `pnpm vitest run src/hooks/use-monthly-availability.test.tsx src/lib/api/index.test.ts`
  - Result after removing the old client RPC export: passed, 2 files / 11 tests.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 40 files / 131 tests.
  - Command: `pnpm build`
  - Result: passed.
- Follow-up scans:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
  - Command: `rg -n "getMonthlyAvailability|supabase\\.rpc\\('get_monthly_availability'|availability/monthly|MONTHLY_AVAILABILITY|unstable_cache|RESERVATIONS_CACHE_TAG" src/hooks src/app/api/admin/availability src/lib/server/monthly-availability.ts src/lib/api/index.ts -S`
  - Result: no remaining direct browser `get_monthly_availability` path; monthly availability goes through the authenticated admin API and cached server helper.
- Command: `date`
- Result: `Wed May 13 02:50:23 IST 2026`.

## 2026-05-13 02:51 IST - Client Supabase Read Scan

- Scan:
  - Command: `rg -n "supabase\\." src/hooks src/components 'src/app/(public)' src/app/admin --glob '!src/app/api/**' -S`
  - Result: no remaining browser Supabase data reads in hooks/components/pages.
- Remaining client Supabase calls are auth/session operations and the admin `create-user` edge function invocation:
  - login, register, forgot/reset password flows,
  - `supabase.auth.getSession/getUser/exchangeCodeForSession/updateUser`,
  - `supabase.functions.invoke("create-user")`.
- Command: `date`
- Result: `Wed May 13 02:51:11 IST 2026`.

## 2026-05-13 02:52 IST - Reports Code-Splitting Started

- Analysis:
  - `/admin/reports` defaults to the bookings/PDF tab but imports chart-heavy occupancy and revenue report components up front.
  - Those chart panels can be split behind dynamic imports so Recharts is not part of the default reports shell bundle.
- Added failing test first:
  - `src/app/admin/reports/reports-code-splitting.test.ts` locks that `page.tsx` does not directly import occupancy/revenue report panels and that `reports-tabs.tsx` uses `next/dynamic` for them.
- Command: `pnpm vitest run src/app/admin/reports/reports-code-splitting.test.ts`
- Expected first result: failed because `reports-tabs.tsx` does not exist yet.
- Command: `date`
- Result: `Wed May 13 02:52:07 IST 2026`.

## 2026-05-13 02:54 IST - Reports Code-Splitting Pass

- Implemented reports frontend performance change:
  - Added `src/app/admin/reports/reports-tabs.tsx` as the client tab wrapper.
  - Kept `BookingsReport` in the default reports shell.
  - Moved `OccupancyReport` and `RevenueReport` behind `next/dynamic` so Recharts/chart code is loaded only when those tabs mount.
  - Simplified `src/app/admin/reports/page.tsx` to render the header and `ReportsTabs`.
- Focused gate:
  - Command: `pnpm vitest run src/app/admin/reports/reports-code-splitting.test.ts`
  - Result: passed, 1 file / 1 test.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 41 files / 132 tests.
  - Command: `pnpm build`
  - Result: passed.
- Build result:
  - Before split: `/admin/reports` was about `110 kB` route size and `343 kB` first-load JS.
  - After split: `/admin/reports` is `8.54 kB` route size and `239 kB` first-load JS.
- Follow-up scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 02:53:59 IST 2026`.

## 2026-05-13 02:55 IST - Home Code-Splitting Started

- Analysis:
  - Public home still imports below-the-fold sections directly into the initial client bundle.
  - The hero and feature cards remain inline, but welcome/gallery/video/rooms/reviews/support sections can be deferred with dynamic imports.
- Added failing test first:
  - `src/app/(public)/home-code-splitting.test.ts` locks that below-the-fold home sections are not directly imported by `page.tsx` and that the page uses `next/dynamic`.
- Command: `pnpm vitest run src/app/'(public)'/home-code-splitting.test.ts`
- Expected first result: failed because `page.tsx` still directly imports below-the-fold sections and does not use `dynamic`.
- Command: `date`
- Result: `Wed May 13 02:55:17 IST 2026`.

## 2026-05-13 02:57 IST - Home Code-Splitting Pass

- Implemented home frontend performance change:
  - Added dynamic imports in `src/app/(public)/page.tsx` for below-the-fold sections:
    - event banner modal,
    - welcome,
    - gallery,
    - video,
    - rooms showcase,
    - reviews,
    - support actions.
  - Kept the hero and feature card grid inline.
  - Kept a static code-splitting guard in `src/app/(public)/home-code-splitting.test.ts`.
- Focused gate:
  - Command: `pnpm vitest run src/app/'(public)'/home-code-splitting.test.ts`
  - Result: passed, 1 file / 1 test.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 42 files / 133 tests.
  - Command: `pnpm build`
  - Result: passed.
- Build result:
  - Before split: `/` was about `12.3 kB` route size and `448 kB` first-load JS.
  - After split: `/` is `6.32 kB` route size and `163 kB` first-load JS.
- Follow-up scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 02:56:53 IST 2026`.

## 2026-05-13 02:17 IST - Room Detail Availability Audit Started

- Tail reconciliation:
  - The 02:00 through 02:16 booking availability entries exist earlier in this file because earlier patches matched a non-tail context.
  - This section is intentionally appended at the actual file tail so the next entries remain chronological from here.
- Current analysis:
  - `/book/rooms/[id]` still read `reservations` from DataContext to derive fully booked dates and selected-range room counts.
  - Public booking route plans intentionally avoid loading broad reservations, so that code path is not a reliable source of availability and should not be re-enabled as a broad client fetch.
  - The existing no-store `/api/availability/search` endpoint can be reused for selected-range availability without exposing reservation details or loading global reservation context.
- Next step:
  - Add a tested room-type availability hook around `/api/availability/search`, then replace the room-detail page's reservation-based availability calculation with that hook while preserving booking UI behavior.
- Command: `date`
- Result: `Wed May 13 02:17:57 IST 2026`.

## 2026-05-13 02:21 IST - Room Detail Availability Route Hook

- Added `src/hooks/use-room-type-availability-search.ts` and tests.
- Updated `/book/rooms/[id]`:
  - removed reservation-context availability math,
  - kept local closure and past-date disabling,
  - uses the no-store `/api/availability/search` endpoint for selected date-range room counts,
  - disables "Book now" while the selected range is being checked.
- Focused gate:
  - Command: `pnpm vitest run src/hooks/use-room-type-availability-search.test.tsx src/hooks/use-availability-search.test.tsx src/app/api/availability/search/route.test.ts src/lib/availability/search.test.ts src/lib/server/availability.test.ts`
  - Result: passed, 5 files / 12 tests.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 29 files / 116 tests.
  - Command: `pnpm build`
  - Result: passed.
- Latest broad select scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 02:21:25 IST 2026`.

## 2026-05-13 02:25 IST - Confirmation Route Rate Plan Prune

- Analysis:
  - `/book/confirmation/[id]` loaded `ratePlans` through the public DataProvider plan.
  - The page computed `bookingRatePlan`, but that value was unused in rendering and invoice generation.
- Test-first change:
  - Updated route-plan tests to expect `/book/confirmation/*` to load only property, rooms, and room types.
  - Initial focused test failed because the plan still included `ratePlans`.
- Implemented:
  - Removed `ratePlans` from `PUBLIC_BOOKING_CONFIRMATION_PLAN`.
  - Removed unused `bookingRatePlan`, `primaryRoomType`, and `BedDouble` code from the confirmation page.
  - Updated `useAppData` route-aware loading test to assert `getRatePlans()` is not called on confirmation routes.
- Focused gate:
  - Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
  - Result: passed, 2 files / 46 tests.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 29 files / 116 tests.
  - Command: `pnpm build`
  - Result: passed.
- Latest broad select scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 02:25:12 IST 2026`.

## 2026-05-13 02:26 IST - Public/Admin Dependency Scan

- Public dependency scan:
  - Command: `rg -n "useDataContext\\(|useCurrencyFormatter\\(|useCurrencyCode\\(" 'src/app/(public)' src/components/public src/components/marketing -S`
  - Result: remaining public context consumers are booking pages/components, home room showcase, shop currency formatting, and layout-adjacent components that are not used by the active marketing layout.
- Admin dependency scan:
  - Command: `rg -n "useDataContext\\(" src/app/admin src/components/admin src/components/layout -S`
  - Result: current admin route plans mostly map to actual consumers: settings, housekeeping, reports, reservations, guests, rooms, room types, rates, and chrome property display.
- Broad Supabase call scan:
  - Command: `rg -n "supabase\\.|\\.from\\(|\\.select\\(" src -S`
  - Result: no new broad data call was found outside already-audited areas; one broad-select regex hit was a false positive on `onSelect()` in a React component.
- Follow-up candidate:
  - Public confirmation could eventually be collapsed into a dedicated server-backed confirmation payload, but the page also feeds invoice generation and needs reservation folios, rooms, room types, guest, and property trust fields, so that should be a separate larger test-first refactor rather than a blind edit.
- Command: `date`
- Result: `Wed May 13 02:26:13 IST 2026`.

## 2026-05-13 02:00 IST - Public Availability API Pass Started

- Research refresh:
  - Supabase JavaScript docs confirm exact `select('name, country_id')` projections and chained filters such as `.lt(...)` on `select()` queries.
  - Next.js App Router caching docs confirm route handlers can opt into per-request rendering with `dynamic = 'force-dynamic'`, equivalent to no-store fetch behavior.
- Analysis:
  - The public availability hook still calculates availability from client DataContext reservations and fetches booking restrictions from the browser.
  - Public booking startup plans no longer load reservations, so a server-side date-filtered availability route is both more correct and lower egress than broad client reservation context.
- Next step:
  - Add a pure availability calculator and a dynamic route-backed public availability search helper, with tests covering narrow Supabase columns and date-overlap filters.

## 2026-05-13 02:08 IST - Public Availability API Implemented

- Added test-first coverage for:
  - pure availability calculation,
  - the server Supabase helper's exact public columns and reservation overlap filters,
  - the public availability route's no-store response,
  - the public hook's route-backed search behavior.
- Implemented:
  - `src/lib/availability/search.ts` as a pure calculator that returns room type IDs and aggregate counts without exposing reservation details.
  - `src/lib/server/availability.ts` with exact public availability selects and `check_in_date < checkOut` / `check_out_date > checkIn` reservation filters.
  - `src/app/api/availability/search/route.ts` as a dynamic, no-store POST endpoint with zod validation.
  - `useAvailabilitySearch()` now posts to `/api/availability/search` instead of reading client reservation context or fetching booking restrictions from the browser.
  - `/book` route startup data no longer loads rooms; `/book/rooms/*` remains on the room-detail booking plan.
- Focused gate:
  - Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx src/lib/availability/search.test.ts src/lib/server/availability.test.ts src/app/api/availability/search/route.test.ts src/hooks/use-availability-search.test.tsx`
  - Result: passed, 6 files / 55 tests.
- Command: `date`
- Result: `Wed May 13 02:08:00 IST 2026`.

## 2026-05-13 02:09 IST - Public Availability Verification Snapshot

- Full gates:
  - Command: `pnpm test`
  - Result: passed, 26 files / 107 tests.
  - Command: `pnpm exec tsc --noEmit`
  - First result: failed because the new pure availability test fixture still included excess fields not used by the narrow calculator types.
  - Fix: trimmed the fixture to the exact minimal room and room-type shape.
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm build`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 26 files / 107 tests.
- Latest build observations:
  - `/api/availability/search` is dynamic.
  - `/book` still builds static with 1h revalidation, while its availability search now uses the dynamic route at interaction time.
- Latest broad select scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 02:09:45 IST 2026`.

## 2026-05-13 02:13 IST - Booking Review Assignment Safeguard

- Analysis:
  - Public booking review had no reservation context under the narrowed public data plans, but still tried to choose physical rooms by scanning local reservations.
  - The database reservation RPC already rejects conflicts, but a client-side blind first-room choice could reject a booking even when another room of the same type was available.
- Added `src/lib/booking/room-assignment.ts` with focused tests.
- Updated `/book/review` to assign candidate rooms by calling the existing exact `validateBookingRequest()` check during submit, instead of depending on broad reservation context.
- Focused gate:
  - Command: `pnpm vitest run src/lib/booking/room-assignment.test.ts src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
  - Result: passed, 3 files / 49 tests.
- Full gates after the review change:
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 27 files / 110 tests.
  - Command: `pnpm build`
  - Result: passed.
- Latest broad select scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 02:13:50 IST 2026`.

## 2026-05-13 02:16 IST - Booking Confirmation Sibling Fetch

- Analysis:
  - Public booking confirmation can fetch the primary reservation by ID, but multi-room confirmations need sibling reservations with the same booking ID for totals, room grouping, and invoice display.
- Added `src/lib/booking/confirmation.ts` with focused tests for confirmation reservation resolution.
- Updated `/book/confirmation/[id]` to lazily fetch sibling reservations by booking ID after the primary reservation is known.
- Focused gate:
  - Command: `pnpm vitest run src/lib/booking/confirmation.test.ts src/lib/booking/room-assignment.test.ts`
  - Result: passed, 2 files / 6 tests.
- Full gates:
  - Command: `pnpm exec tsc --noEmit`
  - First result: failed because a route-local reservation value could be `undefined`; normalized it to `null`.
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm test`
  - Result: passed, 28 files / 113 tests.
  - Command: `pnpm build`
  - Result: passed.
- Latest broad select scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 02:16:36 IST 2026`.

## 2026-05-13 01:46 IST - Admin Route Load-Plan Pass

- Analysis in progress:
  - The admin layout shell reads auth directly; the sidebar's `property` read is unused.
  - The header currently uses `property` for the property name and `roles` only to rediscover the user's role name, even though `AuthContext` already has `userRole`.
  - Several admin pages (`posts`, `events`, `reviews`, `feedback`, `donations`, `manual receipt`, `activity`) fetch their own data through server helpers or scoped API routes and should not trigger global guests/rooms/reservations/housekeeping loads.
  - Context-backed admin pages can use smaller route-specific datasets instead of the previous full admin dataset.
- Next action:
  - Add failing route-plan tests for these admin route groups, then implement the narrower planner and header/sidebar cleanup.
- Added failing tests:
  - `src/hooks/app-data-load-plan.test.ts` now covers chrome-only admin pages, rooms, room types, rates, room categories, guest index/detail, housekeeping, dashboard, calendar, reports, and reservations.
  - `src/hooks/use-app-data.load-plan.test.tsx` now checks the actual hook call behavior for chrome-only admin routes, rooms, and dashboard.
- First test results:
  - `pnpm vitest run src/hooks/app-data-load-plan.test.ts` failed as expected because the planner still returned the full admin dataset for classified routes.
  - `pnpm vitest run src/hooks/use-app-data.load-plan.test.tsx` failed as expected because the hook still called broad loaders on those routes.
- Implementation:
  - Added route-specific admin plans in `src/hooks/app-data-load-plan.ts`, while retaining the full `ADMIN_PLAN` as a conservative fallback for unclassified admin routes.
  - Removed an unused `useDataContext()` read from the sidebar.
  - Changed the admin header to use `userRole` from `AuthContext` instead of loading `roles` just to display the current role name.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 39 tests.
- Command: `date`
- Result: `Wed May 13 01:48:57 IST 2026`.
- Command: `pnpm test`
- Result: passed, 23 files / 92 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm build`
- Result: passed.
- Build note:
  - `/blog` remains static with 1h revalidation.
  - `/blog/[slug]` remains SSG.
- Command: `date`
- Result: `Wed May 13 01:34:33 IST 2026`.

## 2026-05-13 01:36 IST - Public Donation Currency Cache Pass

- Analysis:
  - `getPropertyCurrency()` used the cookie-aware server Supabase client.
  - Public `/donate` and `/donate/success` call this helper, keeping otherwise public currency reads tied to request cookies.
  - `/donate` also reads public donation stats and should not hit Supabase on every request.
- Added `src/lib/server/property.test.ts` to require:
  - a cookie-free anon Supabase client,
  - exact `currency` selection,
  - a 1h property-currency cache policy.
- Command: `pnpm vitest run src/lib/server/property.test.ts`
- First result: failed because the helper did not create a public client.
- Updated `src/lib/server/property.ts`:
  - added `PROPERTY_CURRENCY_SELECT`,
  - added `PROPERTY_CURRENCY_CACHE_TAG`,
  - added `PROPERTY_CURRENCY_REVALIDATE_SECONDS`,
  - changed `getPropertyCurrency()` to a cached cookie-free public read with fallback to default currency.
- Updated `src/app/(public)/donate/page.tsx` with literal `revalidate = 300` so donation stats refresh via ISR instead of per-request dynamic rendering.
- Command: `pnpm vitest run src/lib/server/property.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `date`
- Result: `Wed May 13 01:36:48 IST 2026`.
- Command: `pnpm test`
- Result: passed, 23 files / 62 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm build`
- Result: passed.
- Build result:
  - `/donate` is now static with 5m revalidation.
  - `/donate/success` remains dynamic due search params, but its property currency helper is cached and cookie-free.
- Command: `date`
- Result: `Wed May 13 01:37:32 IST 2026`.

## 2026-05-13 01:38 IST - Public Static Root Provider No-Data Plan

- Analysis:
  - Most public static routes do not consume `property`, `roomTypes`, or any other `DataContext` data.
  - `/shop` still needs property currency through `useCurrencyFormatter()`.
  - Home and booking routes already have explicit room-preview/booking data plans.
- Updated tests first:
  - `/about-us` should use `mode: "none"` and no datasets.
  - `/shop` should keep the property-only plan.
  - The `useAppData()` hook should make no API calls on a logged-in `/about-us` route.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- First result: failed because `/about-us` still used the property-only plan and called `getProperty()`.
- Updated `src/hooks/app-data-load-plan.ts`:
  - fallback public routes now return `NONE_PLAN`,
  - `/shop` explicitly returns the property-only plan.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 10 tests.

## 2026-05-13 01:30 IST - Public Booking Duplicate Closure Read Removed

- Analysis:
  - `useAppData()` now loads `propertyClosures` for public booking routes.
  - `useAvailabilitySearch()` still fetched `getPropertyClosures()` on mount, causing a duplicate Supabase read on `/book`.
  - Booking restrictions are not currently part of `DataContext`, so only the duplicate closure read was targeted.
- Added `src/hooks/use-availability-search.test.tsx` to require:
  - `getBookingRestrictions()` still runs,
  - `getPropertyClosures()` is not called,
  - closures returned by the hook come from `DataContext`.
- Command: `pnpm vitest run src/hooks/use-availability-search.test.tsx`
- First result: failed because the hook still called `getPropertyClosures()`.
- Updated `src/hooks/use-availability-search.tsx`:
  - reads `propertyClosures` from `useDataContext()`,
  - syncs local `closures` state from context,
  - fetches only booking restrictions on mount.
- Command: `pnpm vitest run src/hooks/use-availability-search.test.tsx`
- Result: passed, 1 file / 1 test.
- Command: `pnpm build`
- Result: failed during prerender because the new public property cache called `getServerSupabaseClient()`, which reads `cookies()` inside `unstable_cache`. Next.js forbids dynamic request APIs inside an `unstable_cache` scope.
- Fix in progress: `src/lib/server/public-property.ts` now uses a cookie-free Supabase anon client for public read-only property location data.
- Additional hardening: if Supabase env is unavailable during a local build, the public property helper now returns an empty location instead of failing the build.

## 2026-05-13 00:24 IST - First Target Verification Complete

- Command: `date`
- Result: `Wed May 13 00:24:30 IST 2026`.
- Command: `pnpm test`
- Result: passed, 8 files / 22 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm build`
- Result: passed.
- Build note: public pages now show 1h static revalidation in the build output; `/events` shows 1m revalidation because homepage event banner caching is minute-bucketed.
- Current verified changes reduce repeat Supabase database egress for:
  - public layout property location lookup,
  - public reviews API and homepage review carousel,
  - active event banner API and homepage modal,
  - public event page homepage-banner read.

## Next Target Area

- Target: shared admin/client data layer.
- Files to analyze next:
  - `src/context/data-context.tsx`
  - `src/lib/api/index.ts`
  - dependent admin pages/components that use `useDataContext()`
- Initial risk from scan:
  - Many client Supabase reads still use `select("*")`.
  - Admin context may eagerly load broad datasets on login/startup, increasing database egress and browser work even when only one admin page needs a subset.

## 2026-05-13 00:28 IST - Admin Data Layer Test-First Pass

- Analysis:
  - `src/hooks/use-app-data.ts` eagerly loads property, guests, rooms, room types, room categories, rate plans, seasonal prices, closures, roles, amenities, sticky notes, users, housekeeping assignments, room type amenities, and a 1000-row reservations dashboard payload.
  - `src/lib/api/index.ts` already has some column constants, but several shared lookup reads still use `select("*")`.
  - The lowest-risk next change is exact column selection for shared lookup tables and property settings because it preserves existing call timing while reducing payload width.
- Added tests in `src/lib/api/index.test.ts` to lock query shape for:
  - `getProperty()`,
  - `getRoomTypes()`,
  - `getRoomCategories()`,
  - `getRatePlans()`,
  - `getAmenities()`.

## 2026-05-13 00:30 IST - Admin Lookup Query Width Reduced

- Command: `pnpm vitest run src/lib/api/index.test.ts`
- First result: failed because these functions still used wildcard selects or unexported selection constants.
- Implemented explicit exported selection constants in `src/lib/api/index.ts`:
  - `PROPERTY_SELECT_COLUMNS`
  - `ROOM_TYPE_SELECT_COLUMNS`
  - `ROOM_CATEGORY_SELECT_COLUMNS`
  - `RATE_PLAN_SELECT_COLUMNS`
  - `AMENITY_SELECT_COLUMNS`
- Updated lookup readers and matching create/update return selects to use exact columns.
- Added PostgREST aliases for property camelCase fields (`allowSameDayTurnover`, `showPartialDays`, `defaultUnitsView`) so the existing context shape is preserved while avoiding `select("*")`.
- Command: `pnpm vitest run src/lib/api/index.test.ts`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm test`
- Result: passed, 9 files / 24 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Remaining scan: `src/lib/api/index.ts`, admin feedback/manual-receipt/report routes, donations, and reservations still contain additional wildcard or broad selects that need separate function-by-function review before changes.

## 2026-05-13 00:31 IST - Reservation Query Test-First Pass

- Analysis:
  - Reservation client API reads use `select("*")` plus `folio_items(*)`, which can send unnecessary columns for every reservation and folio row.
  - This matters because `useAppData()` fetches a dashboard reservation payload and then lazy-loads full reservations in the background.
- Added tests in `src/lib/api/index.test.ts` for:
  - `getReservationById()`,
  - `getReservationsPage()`,
  - `updateReservation()`.
- Expected behavior under test: reservation reads/mutations must use explicit reservation, guest, and folio column selections.

## 2026-05-13 00:34 IST - Reservation Query Width Reduced

- Command: `pnpm vitest run src/lib/api/index.test.ts`
- First result: failed because reservation functions still used `select("*")` and `folio_items(*)`.
- Implemented:
  - `FOLIO_ITEM_SELECT_COLUMNS`
  - `RESERVATION_SELECT_COLUMNS`
- Updated reservation page, full reservation, single reservation, booking sibling, insert, update, booking-status update, and folio insert/list return selects to use explicit columns.
- Command: `pnpm vitest run src/lib/api/index.test.ts`
- Result: passed, 1 file / 5 tests.
- Command: `pnpm test`
- Result: passed, 9 files / 27 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: initially failed on Supabase nested relation typing, then passed after adding explicit `unknown` bridge casts where rows are mapped into `DbReservation`.
- Command: `pnpm build`
- Result: passed.
- Command: `date`
- Result: `Wed May 13 00:34:22 IST 2026`.
- Remaining wildcard scan still shows broad selects in activity logs, guest/room mutation returns, room type amenities, roles, sticky notes, housekeeping, seasonal prices, booking restrictions, property closures, blog categories/posts, server donations, feedback/manual receipt routes, reports export, and the cached bookings summary view.

## 2026-05-13 00:35 IST - Secondary Admin Lookup Test-First Pass

- Analysis:
  - `useAppData()` also fetches room type amenities, roles, sticky notes, housekeeping assignments, seasonal prices, booking restrictions, and property closures during admin hydration.
  - These are narrower than reservations but still repeat across admin sessions and currently include several wildcard selects.
- Added tests in `src/lib/api/index.test.ts` to require exact selection strings for those startup readers.

## 2026-05-13 00:38 IST - Secondary Admin Lookup Query Width Reduced

- Command: `pnpm vitest run src/lib/api/index.test.ts`
- First result: failed on the remaining `room_type_amenities.select("*")` path.
- Implemented exact selection constants for:
  - room type amenities,
  - seasonal prices,
  - roles,
  - profile update return rows,
  - sticky notes,
  - housekeeping assignments,
  - booking restrictions,
  - property closures.
- Updated guest/room mutation return selects to use existing exact guest/room columns.
- Added aliases for sticky note `createdAt` and housekeeping `roomId`/`assignedTo`, matching the client-side types instead of leaking DB snake_case.
- Command: `pnpm vitest run src/lib/api/index.test.ts`
- Result: passed, 1 file / 6 tests.
- Command: `pnpm test`
- Result: passed, 9 files / 28 tests.
- Command: `pnpm exec tsc --noEmit`
- First result: failed because role rows selected from Supabase expose `hierarchy_level` while `mapDbRole` required `hierarchyLevel`.
- Fix: widened the mapper input type in `src/hooks/use-app-data.ts` to the actual DB/API role row shape while preserving strict `Role` output.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 00:39 IST - Activity And Category Test-First Pass

- Analysis:
  - `getAdminActivityLogs()` is paginated but still selects every activity-log column.
  - `getCategories()` currently makes one preliminary wildcard query, discards its data, then makes the actual wildcard category query. That is an avoidable extra Supabase call.
- Added tests in `src/lib/api/index.test.ts` to require:
  - exact activity-log columns with server-side filters/range,
  - a single exact category query ordered by name.

## 2026-05-13 00:42 IST - Activity And Category Query Width Reduced

- Command: `pnpm vitest run src/lib/api/index.test.ts`
- First result: failed because activity logs still selected `*` and categories still made two calls.
- Implemented:
  - `ADMIN_ACTIVITY_LOG_SELECT_COLUMNS`,
  - `CATEGORY_SELECT_COLUMNS`,
  - `POST_SELECT_COLUMNS`.
- Updated activity log query to select exact columns with count.
- Removed the discarded preliminary category query from `getCategories()`, reducing that function from two Supabase calls to one.
- Updated category and post create/update return selects to exact columns.
- Command: `pnpm vitest run src/lib/api/index.test.ts`
- Result: passed, 1 file / 8 tests.
- Command: `pnpm test`
- Result: passed, 9 files / 30 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 00:43 IST - Blog Post Test-First Pass

- Analysis:
  - `src/lib/server/posts.ts` uses `posts.*` and nested `categories(*)`.
  - This affects public blog pages and admin posts lists/counts.
- Added `src/lib/server/posts.test.ts` to require exact post/category selections for:
  - `getPosts()`,
  - `getPostBySlug()`,
  - `countPosts()`.

## 2026-05-13 00:45 IST - Blog Post Query Width Reduced

- Command: `pnpm vitest run src/lib/server/posts.test.ts`
- First result: failed because server post reads still used `posts.*` and nested `categories(*)`.
- Implemented exact blog selection constants in `src/lib/api/blog-mappers.ts`:
  - `DB_CATEGORY_SELECT_COLUMNS`,
  - `DB_POST_SELECT_COLUMNS`,
  - `DB_POST_WITH_CATEGORIES_SELECT_COLUMNS`.
- Updated `src/lib/server/posts.ts` to use the exact nested select for lists, details, slug lookups, and head counts.
- Command: `pnpm vitest run src/lib/server/posts.test.ts`
- Result: passed, 1 file / 3 tests.
- Command: `pnpm exec tsc --noEmit`
- First result: failed on Supabase nested relation inference for post categories.
- Fix: added explicit `unknown` bridge casts at the post mapper boundaries.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 00:46 IST - Donations Test-First Pass

- Analysis:
  - Donation rows include payment provider IDs/signatures and metadata; wildcard selects can increase payload size and expose columns callers do not need.
  - `src/lib/api/donations.ts` already had a donation select constant for some reads, but create/update returns and stats still used broad selects.
  - `src/lib/server/donations.ts` still used wildcard donation and stats selects.
- Added tests for exact donation/stat selection in:
  - `src/lib/api/donations.test.ts`,
  - `src/lib/server/donations.test.ts`.

## 2026-05-13 00:48 IST - Donation Query Width Reduced

- Command: `pnpm vitest run src/lib/api/donations.test.ts src/lib/server/donations.test.ts`
- First result: failed because donation create/update/admin reads and donation stats used broad selects.
- Exported and reused:
  - `DONATION_SELECT_COLUMNS`,
  - `DONATION_STATS_SELECT_COLUMNS`.
- Updated donation create/update/stat reads in `src/lib/api/donations.ts`.
- Updated admin donation list/stat reads in `src/lib/server/donations.ts`.
- Command: `pnpm vitest run src/lib/api/donations.test.ts src/lib/server/donations.test.ts`
- Result: passed, 2 files / 5 tests.
- Command: `pnpm test`
- Result: passed, 12 files / 38 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 00:49 IST - Profile And Room Type Detail Test-First Pass

- Analysis:
  - `getRoomTypeWithAmenities()` still uses `room_types.*`.
  - `getUserProfile()` still uses `profiles.*` and `roles(*)`, and it runs during auth/login flows.
- Added tests in `src/lib/api/index.test.ts` to require exact selects for both functions.

## 2026-05-13 00:50 IST - Profile And Room Type Detail Query Width Reduced

- Command: `pnpm vitest run src/lib/api/index.test.ts`
- First result: failed because both functions still used wildcard nested selects.
- Implemented:
  - `ROOM_TYPE_WITH_AMENITIES_SELECT_COLUMNS`,
  - `USER_PROFILE_SELECT_COLUMNS`.
- Updated `getRoomTypeWithAmenities()` and `getUserProfile()` to use exact nested selects.
- Command: `pnpm vitest run src/lib/api/index.test.ts`
- Result: passed, 1 file / 10 tests.
- Command: `pnpm test`
- Result: passed, 12 files / 40 tests.
- Command: `pnpm exec tsc --noEmit`
- First result: failed on Supabase role relation inference in `use-auth`.
- Fix: changed the existing auth profile cast to bridge through `unknown` before `ProfileWithRole`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 00:52 IST - Admin Feedback Test-First Pass

- Analysis:
  - Admin feedback list and update routes still use `select("*")`.
  - These endpoints are paginated and can include internal notes and contact fields, so exact columns are preferable.
- Added route tests for:
  - `src/app/api/admin/feedback/route.ts`,
  - `src/app/api/admin/feedback/[id]/route.ts`.

## 2026-05-13 00:54 IST - Admin Feedback Query Width Reduced

- Command: `pnpm vitest run src/app/api/admin/feedback/route.test.ts 'src/app/api/admin/feedback/[id]/route.test.ts'`
- First result: failed because both routes used `select("*")`.
- Added shared `ADMIN_FEEDBACK_SELECT_COLUMNS` in `src/app/api/admin/feedback/columns.ts`.
- Updated admin feedback list and update routes to use exact feedback columns.
- Command: `pnpm vitest run src/app/api/admin/feedback/route.test.ts 'src/app/api/admin/feedback/[id]/route.test.ts'`
- Result: passed, 2 files / 2 tests.
- Command: `pnpm test`
- Result: passed, 14 files / 42 tests.
- Command: `pnpm exec tsc --noEmit`
- First result: failed because Next route modules cannot export arbitrary constants from `route.ts`.
- Fix: tests now import the constant from `columns.ts`, and `route.ts` no longer re-exports it.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 00:55 IST - Cached Reservation View Test-First Pass

- Analysis:
  - `src/server/reservations/cache.ts` uses `select("*")` on `bookings_summary_view`.
  - This path is cached, but every cache miss can return wide view rows; narrowing the view select reduces database egress on misses and refreshes.
- Added `src/server/reservations/cache.test.ts` to require exact `bookings_summary_view` columns and preserve search/range behavior.

## 2026-05-13 00:56 IST - Cached Reservation View Query Width Reduced

- Command: `pnpm vitest run src/server/reservations/cache.test.ts`
- First result: failed once because the test needed `unstable_cache` mocked outside a Next incremental-cache runtime, then failed on the actual wildcard select.
- Implemented `BOOKINGS_SUMMARY_SELECT_COLUMNS` in `src/server/reservations/cache.ts`.
- Updated cached reservation page query to select only the columns consumed by `mapBookingSummaryRow()`.
- Command: `pnpm vitest run src/server/reservations/cache.test.ts`
- Result: passed, 1 file / 1 test.
- Command: `pnpm test`
- Result: passed, 15 files / 43 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 00:57 IST - Production Build Gate

- Command: `pnpm build`
- Result: passed.
- Build output still shows `/blog` and `/blog/[slug]` as dynamic because they use cookie-aware server data today; query width is reduced, but static/cached blog rendering remains a future optimization.
- Remaining broad select scan after this pass is down to:
  - manual receipt API routes,
  - bookings report export route,
  - two mutation-return helpers using bare `.select()` (`admin/events`, `external-room-links`).

## 2026-05-13 00:58 IST - Manual Receipt Test-First Pass

- Analysis:
  - Manual receipt list/create/update routes still use `select("*")`.
  - The mapper only consumes a known receipt shape, so exact columns are safe and reduce donation-admin payloads.
- Added route tests for:
  - `src/app/api/admin/manual-receipts/route.ts`,
  - `src/app/api/admin/manual-receipts/[id]/route.ts`.

## 2026-05-13 01:00 IST - Manual Receipt Query Width Reduced

- Command: `pnpm vitest run src/app/api/admin/manual-receipts/route.test.ts 'src/app/api/admin/manual-receipts/[id]/route.test.ts'`
- First result: failed because the shared manual receipt column file did not exist yet.
- Added `MANUAL_RECEIPT_SELECT_COLUMNS` in `src/app/api/admin/manual-receipts/columns.ts`.
- Updated manual receipt list/create/update routes to use exact receipt columns instead of `select("*")`.
- Command: `pnpm vitest run src/app/api/admin/manual-receipts/route.test.ts 'src/app/api/admin/manual-receipts/[id]/route.test.ts'`
- Result: passed, 2 files / 3 tests.
- Command: `pnpm test`
- Result: passed, 17 files / 46 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 01:01 IST - Report Export Test-First Pass

- Analysis:
  - The final wildcard select from the app/server scan is in the bookings report export route.
  - It reads `bookings_summary_view`, so it can reuse the same exact view column list as the cached reservations API.
- Added `src/app/api/admin/reports/bookings/export/route.test.ts` to require exact bookings summary columns for arrival/dispatch export queries.

## 2026-05-13 01:04 IST - Report Export And Select Scan Complete

- Command: `pnpm vitest run src/app/api/admin/reports/bookings/export/route.test.ts`
- First result: failed because report export still used `select("*")`.
- Updated report export to use `BOOKINGS_SUMMARY_SELECT_COLUMNS`.
- Command: `pnpm vitest run src/app/api/admin/reports/bookings/export/route.test.ts`
- Result: passed, 1 file / 1 test.
- Replaced two remaining bare mutation `.select()` calls:
  - admin event creation now uses `EVENT_SELECT_COLUMNS`,
  - external room link upsert/update now uses `EXTERNAL_ROOM_LINK_SELECT_COLUMNS`.
- Replaced VikBooking import job bare selects with:
  - `IMPORT_JOB_SELECT_COLUMNS`,
  - `IMPORT_JOB_ENTRY_SELECT_COLUMNS`.
- Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/lib/api/index.ts src/lib/server src/app/api src/server src/lib/importers`
- Result: no matches.
- Command: `pnpm test`
- Result: passed, 18 files / 47 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm build`
- Result: passed.
- Command: `date`
- Result: `Wed May 13 01:03:46 IST 2026`.

## 2026-05-13 01:11 IST - Root Data Provider Route-Plan Analysis

- Command: `date`
- Result: `Wed May 13 01:11:27 IST 2026`.
- Research refresh:
  - Next.js App Router docs confirm `usePathname()` is the client-component route hook for reading the current pathname.
  - Next.js data-fetching docs recommend client data fetching through controlled client libraries/hooks or server-to-client data flow; this supports avoiding one broad root hook for every route.
  - Supabase egress docs identify database/API responses as egress and recommend identifying high-traffic API paths/frequent queries.
- Analysis:
  - Root `src/app/layout.tsx` mounts `DataProvider` for every route.
  - Current `useAppData()` fetches a public fallback set with property, rooms, room types, room categories, rate plans, seasonal prices, property closures, amenities, and room-type amenities whenever there is no user session.
  - If a user is logged in and browses a public route, the current hook fetches the full admin startup dataset, including guests, users, roles, sticky notes, housekeeping, and dashboard reservations.
  - Public consumer map:
    - Home page needs room type preview data for `RoomsShowcaseSection`.
    - Booking routes need rooms, room types, rate plans, seasonal prices, property closures, amenities, and room-type amenities.
    - Most other public routes only need a property/currency fallback from global data; public layout location data is already server-cached.
    - Admin login/forgot-password pages do not need global data.
- Test-first change in progress:
  - Added `src/hooks/app-data-load-plan.test.ts` to lock a route-aware data-load plan before wiring `useAppData()`.

## 2026-05-13 01:17 IST - Route-Aware Data Provider Implemented

- Red test command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Red result:
  - `src/hooks/app-data-load-plan.ts` was missing.
  - Current `useAppData()` called `getGuests()` on a logged-in `/about-us` route, proving that public browsing could trigger admin-sized data loads.
- Implemented `src/hooks/app-data-load-plan.ts`:
  - `/admin/login` and `/admin/forget-password`: no global data.
  - Protected `/admin/*` routes: full admin dataset only when a user session exists.
  - `/`: public room-preview dataset only (`property`, `roomTypes`, `roomTypeAmenities`, `amenities`).
  - `/book` and `/book/*`: public booking dataset only (`property`, `rooms`, `roomTypes`, `roomTypeAmenities`, `ratePlans`, `seasonalPrices`, `propertyClosures`, `amenities`).
  - Other public routes: property-only dataset.
- Updated `src/hooks/use-app-data.ts`:
  - Uses `usePathname()` and `getAppDataLoadPlan()` to gate each data call.
  - Clears private/admin state when a public or no-data route is active.
  - Prevents the background full-reservations load unless the active plan is `admin`.
  - Preserves the existing context shape and mutation helpers.
- Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
- Result: passed, 2 files / 7 tests.
- Command: `date`
- Result: `Wed May 13 01:17:48 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `pnpm test`
- Result: passed, 20 files / 54 tests.
- Command: `pnpm build`
- Result: passed.
- Build note:
  - Public pages still build successfully with 1h revalidation where expected.
  - `/blog` and `/blog/[slug]` remain dynamic, so the next target is public blog server data caching/client isolation.

## 2026-05-13 01:24 IST - Public Blog Cache Pass

- Analysis:
  - Public blog pages used `getPosts()` / `getPostBySlug()`, which call the cookie-aware server Supabase client.
  - `src/app/(public)/blog/page.tsx` also forced dynamic rendering.
  - Admin post pages share the same server module and still need auth-aware draft/filter access, so public caching should be added as separate helpers rather than changing admin behavior.
- Added tests in `src/lib/server/posts.test.ts` for:
  - public published post list using a cookie-free Supabase anon client,
  - public published slug lookup using the same client and published-status filter.
- Command: `pnpm vitest run src/lib/server/posts.test.ts`
- First result: failed because `getPublishedPosts()` and `getPublishedPostBySlug()` did not exist.
- Implemented in `src/lib/server/posts.ts`:
  - `PUBLIC_POSTS_CACHE_TAG`,
  - `PUBLIC_POSTS_REVALIDATE_SECONDS`,
  - `getPublishedPosts()`,
  - `getPublishedPostBySlug()`.
- Updated public blog pages:
  - Blog list now uses `getPublishedPosts()` and no longer exports `dynamic = "force-dynamic"`.
  - Blog detail now uses `getPublishedPostBySlug()` and exports `generateStaticParams()` from published posts.
- Command: `pnpm vitest run src/lib/server/posts.test.ts`
- Result: passed, 1 file / 5 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.
- Command: `date`
- Result: `Wed May 13 01:24:33 IST 2026`.
- Command: `pnpm test`
- Result: passed, 20 files / 56 tests.
- Command: `pnpm build`
- First result: failed because Next.js requires `revalidate` page config to be a literal, not an imported constant.
- Fix: public blog pages now export literal `revalidate = 3600`.
- Command: `pnpm build`
- Result: passed.
- Build result:
  - `/blog` is now static with 1h revalidation.
  - `/blog/[slug]` is now SSG via `generateStaticParams()`.
- Command: `date`
- Result: `Wed May 13 01:26:30 IST 2026`.
- Command: `pnpm exec tsc --noEmit`
- Result: passed after rerun. A concurrent `tsc` attempt during `next build` failed because `.next/types` was temporarily being regenerated, not because of source errors.

## 2026-05-13 01:28 IST - Storage Cache-Control Pass

- Research refresh:
  - Supabase Storage upload docs expose a `cacheControl` upload option.
  - Supabase Storage CDN docs note storage assets are served through CDN and browser cache duration is controlled by upload `cacheControl`.
- Analysis:
  - Admin uploads go through `src/app/api/admin/uploads/route.ts` and `uploadToImagesBucket()` in `src/lib/server/storage.ts`.
  - Uploaded image object paths use `randomUUID()` and `upsert: false`, so they are immutable asset URLs.
  - Existing upload cache control was `3600` seconds, which is safe but short for immutable UUID-named images.
- Added `src/lib/server/storage.test.ts` to lock:
  - upload options for immutable public image assets,
  - bucket creation options for the images bucket.
- Command: `pnpm vitest run src/lib/server/storage.test.ts`
- First intended result: failed because `IMAGE_ASSET_CACHE_CONTROL_SECONDS` did not exist and upload still used the old short cache value.
- Implemented `IMAGE_ASSET_CACHE_CONTROL_SECONDS = "31536000"` and reused it in `uploadToImagesBucket()`.
- Command: `pnpm vitest run src/lib/server/storage.test.ts`
- Result: passed, 1 file / 2 tests.
- Command: `date`
- Result: `Wed May 13 01:28:58 IST 2026`.
- Command: `pnpm test`
- Result: passed, 21 files / 58 tests.
- Command: `pnpm exec tsc --noEmit`
- First result: failed on a test-only tuple inference issue in `src/lib/server/storage.test.ts`.
- Fix: added an explicit upload-call tuple cast in the test.
- Command: `pnpm vitest run src/lib/server/storage.test.ts`
- Result: passed, 1 file / 2 tests.
- Command: `pnpm exec tsc --noEmit`
- Result: passed.

## 2026-05-13 01:40 IST - Current Verification Snapshot

- Later work completed after the storage pass:
  - Narrowed `/admin/settings` startup data to property, roles, users, amenities, rooms, room types, and property closures.
  - Prevented the background full-reservations load unless the active plan includes `dashboardReservations`.
  - Cached public property currency through a cookie-free anon Supabase client.
  - Made `/donate` static with 5m revalidation.
  - Changed default public static routes such as `/about-us` to a no-data provider plan; `/shop`, `/`, and `/book` remain explicit exceptions.
- Latest gates:
  - Command: `pnpm test`
  - Result: passed, 23 files / 63 tests.
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm build`
  - Result: passed.
- Latest build observations:
  - `/blog` is static with 1h revalidation.
  - `/blog/[slug]` is SSG.
  - `/donate` is static with 5m revalidation.
  - `/donate/success` remains dynamic because it depends on search params.
- Latest scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 01:39:43 IST 2026`.

## 2026-05-13 01:56 IST - Latest Verification Snapshot

- Additional route-load optimizations completed after the earlier snapshot:
  - Added route-specific admin DataProvider plans for chrome-only admin pages, rooms, room types, rates, room categories, guest index/detail, housekeeping, dashboard, calendar, reports, and reservation workflows.
  - Split `/admin/reservations` from reservation create/detail/edit so the index uses its paginated API instead of the dashboard-reservations startup fetch.
  - Updated the reservations index refresh action to reload the current paginated query instead of triggering a global app-data refresh.
  - Removed unnecessary admin chrome data dependencies: sidebar no longer reads `DataContext`, and header uses `AuthContext.userRole` instead of loading roles for display.
  - Split public booking review and confirmation routes from the full `/book*` public booking plan.
- Latest focused route-plan gate:
  - Command: `pnpm vitest run src/hooks/app-data-load-plan.test.ts src/hooks/use-app-data.load-plan.test.tsx`
  - Result: passed, 2 files / 45 tests.
- Latest full gates:
  - Command: `pnpm test`
  - Result: passed, 23 files / 98 tests.
  - Command: `pnpm exec tsc --noEmit`
  - Result: passed.
  - Command: `pnpm build`
  - Result: passed.
- Latest broad select scan:
  - Command: `rg -n "select\\([^\\n]*\\*|select\\(\\)" src/app/api src/lib src/server -S`
  - Result: no remaining broad Supabase select matches in those audited paths.
- Command: `date`
- Result: `Wed May 13 01:56:01 IST 2026`.
