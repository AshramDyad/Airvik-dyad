# UPI Reservation Payment Flow Progress

## Scope

Implement and stabilize reservation UPI request creation and guest payment flow for a manual-payment workflow (no payment gateway):

- admin-only request creation (including percentage/amount modes),
- property-level UPI configuration consumption,
- request link/QR generation per booking/payment request,
- manual payment confirmation and folio allocation,
- public payment page with request + booking/guest details,
- expiry-aware request status normalization,
- cross-platform open/link behavior guidance (Android intent + non-Android fallback).

## Deliverable-to-artifact audit checklist

- [x] **Per-booking payment request creation with amount or percentage options**
  - **Files:** `src/app/admin/reservations/[id]/components/BillingCard.tsx`
  - **Evidence:** `requestEntryMode` with `amount`/`percentage` toggle and computed `calculatedRequestAmount`; validation blocks invalid/overdraft requests.
  - **Status:** Done.

- [x] **Persist each request with status and token**
  - **Files:** `src/app/api/admin/reservation-payment-requests/route.ts`, `src/data/types.ts`, `supabase/migrations/20260517000000_reservation_payment_requests.sql`
  - **Evidence:** API POST inserts request with generated `token`, `reservation_ids`, `amount`, and initial `requested` status; migration defines request table schema and request constraints.
  - **Status:** Done.

- [x] **Property-level UPI settings in admin**
  - **Files:** `src/app/admin/settings/components/property-settings-form.tsx`, `src/data/types.ts`, `supabase/migrations/20260517000000_reservation_payment_requests.sql`
  - **Evidence:** form fields for `upi_id` and `upi_merchant_name`; persisted via `updateProperty`.
  - **Status:** Done.

- [x] **Generate request-specific UPI URI, intent URL, QR URL**
  - **Files:** `src/lib/payments/upi.ts`
  - **Evidence:** `buildReservationPaymentUpiLink`, `buildReservationPaymentIntentLink`, `buildReservationPaymentLaunchLinks`, `buildReservationPaymentQrUrl`.
  - **Status:** Done.

- [x] **Admin can copy/download/share request links/QR for each request**
  - **Files:** `src/app/admin/reservations/[id]/components/BillingCard.tsx`
  - **Evidence:** per-request actions include link copy, page link copy, QR download, open payment page, launch UPI link.
  - **Status:** Done.

- [x] **Guest can open link and see booking/amount info**
  - **Files:** `src/app/(public)/pay/[token]/page.tsx`, `src/app/api/reservation-payment-requests/[token]/route.ts`
  - **Evidence:** API returns request + property + reservation summaries; page renders request amount/paid/remaining, status and booking/guest cards.
  - **Status:** Done.

- [x] **Partial payment recording and application to request**
  - **Files:** `src/app/admin/reservations/[id]/components/BillingCard.tsx`, `src/hooks/use-app-data.ts`, `src/context/data-context.tsx`
  - **Evidence:** manual confirmation section per request creates folio entry and calls `applyManualPaymentToReservationPaymentRequests` with request targeting.
  - **Status:** Done.

- [x] **Request lifecycle normalization for expiry**
  - **Files:** `src/lib/payments/reservation-payment-requests.ts`, `src/app/api/admin/reservation-payment-requests/route.ts`, `src/app/api/reservation-payment-requests/[token]/route.ts`
  - **Evidence:** active status transitions to `expired` when `expires_at` passed and persisted update occurs.
  - **Status:** Done.

- [ ] **Device/app-specific deep-link reliability validation (iOS + Android + major app behavior)**
  - **Files:** not fully verifiable in this environment.
  - **Evidence:** Android intent deep-link flow is implemented (`intent://...#Intent;...`) and iOS falls back to `upi://pay` + manual copy actions, but no device lab execution.
  - **Status:** Incomplete.

- [x] **Research-backed compatibility strategy for deep-link behavior differences**
  - **Files:** `progress.md`
  - **Evidence:** Reviewed official Android and iOS docs for custom scheme and intent behavior and verified Chrome's `intent://` user-gesture/fallback requirements.
  - **Status:** Complete (runtime matrix execution still pending).

- [x] **Robust in-depth component/integration tests**
  - **Files:** `src/app/admin/reservations/[id]/components/BillingCard.test.tsx`, `src/app/(public)/pay/[token]/page.test.tsx`
  - **Evidence:** billing request creation/percentage validation/manual-confirmation and public payment page rendering/error guidance tests.
  - **Status:** Done.

## Prompt-to-artifact checklist (evidence matrix)

- [x] Implemented manual UPI request creation with admin-only controls (amount/percentage mode): `src/app/admin/reservations/[id]/components/BillingCard.tsx`
- [x] Persisted request schema and row-level permissions: `supabase/migrations/20260517000000_reservation_payment_requests.sql`
- [x] Added property-level UPI destination config: `src/app/admin/settings/components/property-settings-form.tsx`
- [x] Added UPI payment helpers (URI, intent, QR): `src/lib/payments/upi.ts`
- [x] Added admin share/copy/download flows for each request: `src/app/admin/reservations/[id]/components/BillingCard.tsx`
- [x] Added guest-facing payment link route + page:
  - `src/app/api/reservation-payment-requests/[token]/route.ts`
  - `src/app/(public)/pay/[token]/page.tsx`
- [x] Added request lifecycle status normalization: `src/lib/payments/reservation-payment-requests.ts`
- [x] Added partial/manual confirmation reconciliation: `src/hooks/use-app-data.ts` + `src/app/admin/reservations/[id]/components/BillingCard.tsx`
- [x] Added tests for UPI link/expiry/manual request behaviors:
  - `src/lib/payments/upi.test.ts`
  - `src/lib/payments/reservation-payment-requests.test.ts`
  - `src/app/admin/reservations/[id]/components/BillingCard.test.tsx`
  - `src/app/(public)/pay/[token]/page.test.tsx`
- [ ] Executed Android/iOS physical-device matrix for UPI app launch behavior: _Not yet executed in this environment_.

## Deep-link compatibility matrix (manual verification plan)

The implementation is designed to avoid assumptions by using environment-aware behavior:
- Android: uses `intent://...#Intent;...` URLs with `action=android.intent.action.VIEW`, `category=android.intent.category.BROWSABLE`, and a `S.browser_fallback_url`.
- iOS/others: uses `upi://pay?...` plus copy/QR/presentation fallback in the UI.

Because browsers/app launch behavior is highly environment-sensitive, execute this matrix on physical devices:

1. **Android + Chrome**: open `/pay/{token}`, tap **Share intent link**, verify chooser launch; validate fallback opens payment page when app missing.
2. **Android + browser without UPI app**: tap action, verify fallback path (payment page/QR + copy) is still usable.
3. **iOS Safari (iPhone/iPad)**: open `/pay/{token}`, verify **iOS guidance** appears and tap copy/open flows to ensure no hard crashes.
4. **iOS with installed Google Pay / PhonePe / Paytm**: verify `upi://pay` opens app picker or direct payment flow; if blocked, confirm copy flow is usable.
5. **Desktop / non-mobile**: verify QR + copy flows render correctly and no app-launch calls break page rendering.

Until this matrix is executed in a real device/browser/app environment, deep-link behavior remains partially unverified.
## Test and validation evidence

- Unit coverage added for link helpers: `src/lib/payments/upi.test.ts`
- Unit coverage added for expiry normalization: `src/lib/payments/reservation-payment-requests.test.ts`
- Component coverage exists for public payment page: `src/app/(public)/pay/[token]/page.test.tsx`
- Command evidence:
  - `pnpm test 'src/app/admin/reservations/[id]/components/BillingCard.test.tsx' 'src/app/(public)/pay/[token]/page.test.tsx' src/lib/payments/upi.test.ts src/lib/payments/reservation-payment-requests.test.ts`
  - Result: 20 passed, 0 failed.
  - `pnpm build` completed successfully.
- Type-level verification:
  - `pnpm exec tsc --noEmit` completes with 0 errors.
- API/UI runtime verification on Android/iOS deep-link behavior has **not** been executed in a real-device matrix.

## Open items before final completion

1. Execute an in-environment deep-link behavior matrix (at least one real Android + iOS pass) for:
   - `upi://pay` launch behavior,
   - intent URL behavior on Android Chrome,
   - QR fallback usability.
2. If/when real-device validation is performed, add a short runbook with device/app matrix execution notes and edge cases found in production.

## Deep-link validation execution log (to complete objective)

| Step | Device / App | Action | Expected | Actual | Evidence | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Android Chrome | Open `/pay/{token}`, tap Share intent link | App chooser or direct UPI app launch |  |  |  |
| 2 | Android (no UPI app) | Open `/pay/{token}`, tap UPI button | Fallback to page/QR/copy path with no crash |  |  |  |
| 3 | iOS Safari | Open `/pay/{token}`, open/copy link | Guidance shown, copy actions work |  |  |  |
| 4 | iOS (Google Pay / PhonePe / Paytm installed) | Open `/pay/{token}`, open button | UPI app launch/chooser or clear manual fallback guidance |  |  |  |
| 5 | Desktop web | Open `/pay/{token}` | No launch attempts fail, QR/copy works |  |  |  |

## Verification evidence

- `src/lib/payments/upi.test.ts`
  - 7 test cases for request amount calculation and UPI/intent/QR link behavior.
- `src/lib/payments/reservation-payment-requests.test.ts`
  - 5 test cases for expiry normalization and fallback behavior.
- `src/app/admin/reservations/[id]/components/BillingCard.test.tsx`
  - 4 test cases for request creation, percentage calculations, manual confirmation flow, and missing UPI warning.
- `src/app/(public)/pay/[token]/page.test.tsx`
  - 4 test cases for request rendering, loading failures, no-UPI behavior, and copy/cta behavior.

## Additional verification run (2026-05-17 UTC)

- Research pass completed:
  - Chrome intent scheme and fallback behavior from Chrome for Android docs.
  - Android `android.intent.action.VIEW` + `android.intent.category.BROWSABLE` behavior from Android Developers docs.
  - NPCI UPI Link Specification parameters from NPCI spec PDF.
  - Apple `canOpenURL`/scheme interoperability guidance notes.
- Command execution evidence:
  - `pnpm vitest run src/lib/payments/upi.test.ts src/lib/payments/reservation-payment-requests.test.ts src/app/admin/reservations/[id]/components/BillingCard.test.tsx src/app/(public)/pay/[token]/page.test.tsx`
    - 4 test files, 20 tests passed.
  - `pnpm exec tsc --noEmit`
    - Success.
  - `pnpm build`
    - Production build passed; `/pay/[token]` page is included in the route output.

## Platform research notes

- Researched NPCI UPI deep-link specs and parameter expectations for `upi://pay` payloads.
- Reviewed Android intent/deep-link invocation guidance for `ACTION_VIEW` workflows and practical browser launch limitations.
- Reviewed Chrome Android Intent docs for `intent:` syntax, BROWSABLE category, and user-gesture/fallback behavior.
- Reviewed iOS URL scheme/open behavior expectations and documented that custom scheme launches are not universally guaranteed from Safari/embedded web contexts.
- Based on this, the implementation uses:
  - Android intent links with browser fallback for better app routing.
  - Non-Android `upi://pay` plus explicit copy/QR/manual-share UX on public page and admin page.

## Runtime follow-up fixes

- Fixed repeated admin payment request fetches by stabilizing `toNumber` and `normalizePaymentRequestResponse` callbacks in `src/hooks/use-app-data.ts`.
  - Symptom: continuous `GET /api/admin/reservation-payment-requests?reservationId=...` requests on the reservation detail page.
  - Root cause: `loadReservationPaymentRequests` changed identity every render, retriggering the reservation page effect after every request state update.
  - Verification: targeted Vitest run passed for billing card and payment helper tests.
- Suppressed extension-injected body hydration attribute warnings in `src/app/layout.tsx`.
  - Symptom: hydration warning for `cz-shortcut-listen="true"` on `<body>`.
  - Root cause: browser extension mutating the DOM before React hydration.
  - Verification: `pnpm exec tsc --noEmit` passed.

## Outstanding tasks

- `progress.md` deep-link execution log and matrix remain open for real-device confirmation on Android/iOS.

## Real-device deep-link matrix execution status

1. Android Chrome: pending.
2. Android no-UPI app fallback: pending.
3. iOS Safari (with/without app installed): pending.
4. iOS app selector flow (Google Pay/PhonePe/Paytm): pending.
5. Desktop/manual fallback flows: ready from component-level tests; no runtime device test needed.

## Real-device verification runbook (execution template)

Use this template when you run on each device/app:

### Pre-checks
- Booking test data with one reservation created and a folio with known outstanding amount.
- Property UPI ID configured in admin.
- Network active.
- Browser used is the target browser for that device (Chrome on Android, Safari on iOS).

### Log row format
- **Row fields**: timestamp, device (model/OS), browser, app scenario, action taken, expected, actual, deep-link URL used, observations, screenshot/video attachment.
- One row per step below.

### Execution steps
1. **Android Chrome + installed UPI app**
   - Create request for a partial amount and open generated `/pay/{token}`.
   - Tap **Share intent link**.
   - Expected: UPI app chooser or direct app launch.
2. **Android Chrome + installed UPI app**
   - Tap **Open UPI app**.
   - Expected: app launch works (or clear fallback message + copy path if blocked).
3. **Android Chrome + no UPI app**
   - Uninstall/disable all UPI apps if possible.
   - Open `/pay/{token}` and tap launch action.
   - Expected: no crash; payment page/QR/copy remains usable and can be shared.
4. **iOS Safari + installed Google Pay/PhonePe/Paytm**
   - Create/refresh request and open `/pay/{token}`.
   - Tap launch button.
   - Expected: app picker/direct app launch if supported; fallback copy flow usable.
5. **iOS Safari + no UPI app**
   - Use device with no installed UPI handlers.
   - Open `/pay/{token}` and use copy actions.
   - Expected: guidance visible, copy succeeds, QR/“open page link” works.
6. **Desktop**
   - Open `/pay/{token}`.
   - Expected: no blocked launch exceptions, QR renders, copy links and page actions operate.

### Completion criteria
- Fill **Real-device deep-link execution log** with pass/fail for each step.
- Attach one screenshot for every action that launches or falls back.
- If any step fails, record workaround applied (or defect with reproduction).
