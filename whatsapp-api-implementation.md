# WhatsApp integration (official Meta Cloud API + Coexistence)

This is the single source of truth for the WhatsApp feature. It replaces the old
unofficial **GOWA** bridge with the **official Meta WhatsApp Cloud API**, and uses
**Coexistence** so one number runs the API (automation + a guest bot) *and* the
WhatsApp Business app (staff chatting by hand) at the same time.

---

## 0. Scope of THIS branch (`feat/discount-otp-gate`) — read first

This branch ships a **deliberate subset** of the full feature: the **discount-approval
OTP gate** plus the **minimal Meta send layer** it needs. There is **no inbound
automation** — nothing sends or replies on its own. Every WhatsApp message here is the
direct result of an admin action.

**Shipped on this branch**

- **Send layer only** — `src/lib/whatsapp/{cloud-api,config,types,index}.ts`. Replaces
  the dead GOWA `src/lib/whatsapp.ts`. `@/lib/whatsapp` still exports the same
  `sendWhatsApp*` helpers, so existing callers keep working — but now over the official
  Cloud API. Reads number creds from `whatsapp_config` (if present) → falls back to the
  `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN` env vars (the table is **not**
  created on this branch, so the env fallback is the live path).
- **Discount-approval OTP gate** — when an admin lowers a room's nightly rate beyond
  `NEXT_PUBLIC_DISCOUNT_OTP_THRESHOLD` (default ₹300), reservation creation is blocked
  until the owner approves via a WhatsApp OTP. Admin-triggered end to end:
  `POST /api/admin/reservations/otp/request` (guarded by `create:reservation`) sends the
  code, `POST /api/admin/reservations/otp/verify` checks it, then the booking is created.
- **OTP delivery uses a free-form text message** (`sendWhatsAppMessage`) carrying the
  guest, amounts, discount and code. Free-form text only delivers inside an **open 24h
  Customer Service Window**, so the owner must have messaged the business number first —
  otherwise the send fails with **error 131047**. See §6b for the rationale and the
  operational requirement.
- Bonus fix: the existing admin **"send invoice"** and **"send payment QR"** buttons now
  go over the Cloud API too (they were broken once GOWA died). Still admin-click only.
- Migration `20260617000000_reservation_otp.sql` (the `reservation_otp_codes` table +
  `properties.whatsapp_otp_phone`). Apply by hand in the Supabase dashboard.

**NOT on this branch (deferred — lives on `feat/whatsapp-cloud-api`)**

- ❌ Inbound **webhook + guest bot** (auto-replies to guest messages).
- ❌ **Embedded Signup / onboarding** page + route, and the `whatsapp_config` /
  `whatsapp_messages` tables (migration `20260613120000_whatsapp.sql`).
- ❌ **Auto booking-confirmation** (`sendBookingConfirmation` on payment-marked-paid).
- ❌ `booking-replies.ts`, `notifications.ts`, `store.ts`, `signature.ts` modules.

Sections 1–8 below document the **full** feature for the eventual complete rollout.
Treat anything in the "NOT on this branch" list above as future work when reading them.

---

### Goal (why we do Tech Provider onboarding)

**Run the WhatsApp Cloud API and manual WhatsApp chatting on the same number at the
same time — without losing existing chat history.** This is **Coexistence**. The whole
point of Tech Provider onboarding + App Review is to unlock this: API automation
running side-by-side with staff chatting by hand, on the real number, with recent
conversations preserved. (Onboarding syncs up to ~6 months of 1:1 chats + all
contacts — see "Chat history" below.) **Caveat:** the dependable manual interface
under Coexistence is the **WhatsApp Business phone app**, not WhatsApp **Web/Desktop**
(the Web/Desktop companion auto-unlinks under Coexistence).

---

## 1. Why this design

- **Official, ToS-safe, no ban risk.** GOWA emulated WhatsApp Web (unofficial) and
  risked bans. The Cloud API is Meta-hosted and safe for a hotel sending booking
  confirmations + replies (~50–100/day stays GREEN, inside the 250/day starter tier).
- **One number, Coexistence.** The Cloud API and the WhatsApp Business app share the
  same number; messages and contacts sync both ways.
- **Everything on Vercel.** The webhook is a normal Next.js route handler. **Cloudflare
  is not used** — it is unnecessary for the Cloud API (the webhook host is invisible to
  Meta and does not affect the number's standing). The "self-hosting gets you blocked"
  warnings refer to the deprecated **On-Premises API**, not the Cloud API.
- **Supabase only.** Message logs + onboarding config live in Supabase; no new database.

### Two facts that shape everything

1. **One-way door.** The standard "Add phone number / Start using the API" button in the
   Meta dashboard is **mutually exclusive** with Coexistence and **deletes the WhatsApp
   account** to register the number API-only. **Do not press it.** Coexistence is done
   through **Embedded Signup** instead.
2. **Coexistence pairs the API with the WhatsApp Business *app* (phone).** The WhatsApp
   **Web/Desktop** companion is unreliable under coexistence (auto-unlinks); the phone app
   is the staff interface, and it must be opened at least once every ~13 days to stay linked.

### Chat history

Coexistence onboarding syncs **up to 6 months of 1:1 chat history + all contacts**, both
directions — existing conversations are kept. **Group** history does not sync; chats older
than ~6 months stay only on the phone. The number must be on the **WhatsApp Business app**
(not personal WhatsApp) to onboard this way.

---

## 2. Cost / the free 24-hour window

When a guest messages the business, a 24h **Customer Service Window** opens during which
**all replies are free** (bot text, buttons, or staff messages — no template). The only
paid item is a **proactive** message sent when no window is open → one **UTILITY** template
(~₹0.14, or free if a window is open). At this volume, effectively free.

---

## 3. Environment variables

```
WHATSAPP_API_VERSION=v22.0
WHATSAPP_APP_ID=                 # Meta app id (used for code→token exchange)
WHATSAPP_APP_SECRET=             # webhook signature verification + code exchange
WHATSAPP_CONFIG_ID=              # Embedded Signup config (Facebook Login for Business)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=   # self-chosen string for the GET handshake
# Public values for the onboarding page (browser):
NEXT_PUBLIC_WHATSAPP_APP_ID=
NEXT_PUBLIC_WHATSAPP_CONFIG_ID=
# Captured at onboarding and stored in whatsapp_config; mirror here to dev against
# the Meta test number before onboarding:
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_WABA_ID=
WHATSAPP_ACCESS_TOKEN=           # long-lived business-integration token
```

The send layer reads number credentials from the `whatsapp_config` table first (written at
onboarding) and falls back to `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_ACCESS_TOKEN`.

---

## 4. Code map

Files marked **(this branch)** ship on `feat/discount-otp-gate`; the rest are deferred
(present only on `feat/whatsapp-cloud-api`).

| File | Purpose | On branch? |
|------|---------|------------|
| `src/lib/whatsapp/index.ts` | Public re-export (keeps `@/lib/whatsapp` working for existing callers). Trimmed here: send helpers + `getNumberConfig` only — no signature/bot exports. | ✅ this branch |
| `src/lib/whatsapp/cloud-api.ts` | Graph API send helpers: `sendWhatsAppMessage/Image/File`, `sendWhatsAppButtons`, `sendWhatsAppTemplate`, `normalizePhone`. | ✅ this branch |
| `src/lib/whatsapp/config.ts` | Resolves number config (DB → env) + app secret / verify token / app id. | ✅ this branch |
| `src/lib/whatsapp/types.ts` | `WhatsAppResult`, `ReplyButton`. | ✅ this branch |
| `src/app/api/admin/reservations/otp/request/route.ts` | Generates the OTP, sends it to the owner as a free-form WhatsApp text message (`sendWhatsAppMessage`). | ✅ this branch |
| `src/app/api/admin/reservations/otp/verify/route.ts` | Verifies the code (sha256, constant-time, attempt-limited, single-use). | ✅ this branch |
| `src/lib/reservations/discount-approval.ts` | `requiresApproval` / `maxNightlyDiscount` / `computeBookingAmounts` (pure, tested). | ✅ this branch |
| `src/app/admin/reservations/new/otp-approval-dialog.tsx` | Admin dialog: request code → enter code → verify → create. | ✅ this branch |
| `supabase/migrations/20260617000000_reservation_otp.sql` | `reservation_otp_codes` table + `properties.whatsapp_otp_phone`. | ✅ this branch |
| `src/lib/whatsapp/signature.ts` | `verifyWhatsAppSignature` (HMAC-SHA256, constant-time). | ❌ deferred |
| `src/lib/whatsapp/booking-replies.ts` | Bot: `routeInbound` (pure, tested) + `lookupBookingByPhone` + `handleInbound`. | ❌ deferred |
| `src/lib/whatsapp/store.ts` | `whatsapp_messages` log, `isHumanHandling`, `saveWhatsAppConfig`. | ❌ deferred |
| `src/lib/whatsapp/notifications.ts` | `sendBookingConfirmation` (best-effort UTILITY template). | ❌ deferred |
| `src/app/api/whatsapp/webhook/route.ts` | GET handshake + POST (signature → dispatch). | ❌ deferred |
| `src/app/api/whatsapp/onboard/route.ts` | Embedded Signup code→token exchange + webhook subscribe + save config. | ❌ deferred |
| `src/app/admin/whatsapp/page.tsx` | Admin "Connect WhatsApp" (Embedded Signup, coexistence). | ❌ deferred |
| `supabase/migrations/20260613120000_whatsapp.sql` | `whatsapp_config` + `whatsapp_messages` tables. | ❌ deferred |

**Human/bot handover (deferred):** staff replies from the app arrive as `smb_message_echoes`
and are logged with `direction='echo'`. Before auto-replying, the webhook checks
`isHumanHandling` (a recent echo for that phone) and stays silent if a human is engaged.

---

## 5. Verified Graph API shapes (v22.0)

- **Send text:** `POST https://graph.facebook.com/v22.0/<PHONE_NUMBER_ID>/messages`, header
  `Authorization: Bearer <token>`, body `{"messaging_product":"whatsapp","to":"919876543210","type":"text","text":{"body":"..."}}`.
- **`to`** = E.164 without `+` (Indian: `91` + 10 digits).
- **Buttons:** `type:"interactive"`, `interactive.type:"button"`, ≤3 reply buttons.
- **Inbound:** sender at `entry[].changes[].value.messages[].from`; text at `messages[].text.body`;
  button tap at `messages[].interactive.button_reply.id`.
- **Echo (coexistence):** change `field === "smb_message_echoes"`.
- **Outside the 24h window** free-form fails with error **131047** → use a template.

---

## 6. The `booking_confirmation` UTILITY template

> **Deferred — not used on `feat/discount-otp-gate`.** Belongs to the auto-confirmation
> feature (`sendBookingConfirmation`), which is not shipped on this branch.

Create this in WhatsApp Manager (category **UTILITY**, language **English (US) / en_US**) so it
matches `sendBookingConfirmation`'s params:

```
Body: Hi {{1}}, your booking {{2}} is confirmed. Check-in: {{3}}. We look forward to hosting you!
```

Params sent, in order: `{{1}}` guest name, `{{2}}` booking id, `{{3}}` check-in date.

---

## 6b. OTP delivery: free-form text (no template)

The discount-approval OTP is sent as a **free-form WhatsApp text message** via
`sendWhatsAppMessage` — templates were dropped after every pre-approved/library
template attempt failed in the live account (132001 name/language mismatch, no
authentication template provisioned, named-vs-positional variable issues).

The body the owner receives:

```
Reservation approval needed
Guest: Ramesh Patel
Booking amount: ₹4,200
Original amount: ₹6,000
Discount: ₹1,800
OTP: 482915 (valid 10 min)
```

Amounts are formatted with Indian grouping; the `₹` symbol is added in the route.

**The catch — the 24h window.** Free-form text (`type: "text"`) only delivers
inside an **open 24h Customer Service Window**. The owner/approver is normally a
passive party with no open window, so:

- The **owner must message the business number first** (any message) to open the
  window. While it's open, the OTP text delivers.
- If the window is closed the send fails with **error 131047**; the route then
  deletes the code row and returns 502, so the admin can't finish the booking.

This window dependency is the accepted operational tradeoff for not using
templates. (Meta's policy preference is templates for verification codes; this
branch ships free-form text per the product decision.)

**Operational prerequisites for the gate to work:**
- The owner has an **open 24h window** (messaged the business number recently).
- Admin **Settings → `whatsapp_otp_phone`** holds the owner's number (E.164, e.g.
  `9198…`); without it the request route returns "Set the WhatsApp approval number in
  Settings first."
- `WHATSAPP_PHONE_NUMBER_ID` + `WHATSAPP_ACCESS_TOKEN` are set (env fallback path).

---

## 7. Manual Meta setup (do these in order; several are review-gated)

> Hold: do **not** click the standard "Add phone number / Start using the API" button.

**Progress status (updated 2026-06-15):**
- ✅ Tech Provider onboarding started ("Onboard without a partner").
- ✅ **Business Verification — Approved.**
- 🔄 **App Review — fully staged, pending one auto-registering indicator, then final submit.**
  The submission flow (Review → Submit for App Review) has 5 checklist sections; current state:
  - ✅ **Verification** — complete.
  - ✅ **App settings** — complete (app icon, Privacy Policy URL, app category all set).
  - 🔄 **Allowed usage** — `whatsapp_business_messaging` card done (Video A uploaded + description
    + agree + API call shows **Completed**); `public_profile` done (agree only);
    `whatsapp_business_management` card has Video B + description + agree, BUT its **"1 of 1 API
    call required"** indicator was still grey. **This is the ONLY thing blocking submission.**
  - ✅ **Data handling** — complete (processors = Vercel Inc. + Supabase Inc.; data controller =
    Sahajanand Wellness Trust; public-authority-request policies = all four checked).
  - ✅ **Reviewer instructions** — complete (Website platform added in App Settings → Basic;
    instructions describe it as an internal admin tool, functionality shown in videos, no login
    required). Used **Option A** (no live admin creds handed over; site has a separate admin login URL).
  - **Action taken to clear the blocker:** ran 3 successful `whatsapp_business_management` read
    calls via curl using the test-number creds in `.env.local` (GET WABA info, GET
    message_templates, GET phone_numbers) — all 200 OK. Plus the two `POST /message_templates`
    done in Graph API Explorer. The required call IS satisfied; Meta's backend "can take up to 24h
    to show." **Next: revisit Allowed usage; once the management API line flips to green, the
    "Submit for review" button unlocks → click it.** Then 1–3 business days for Meta's review.
  - **Templates already created on the (test) WABA `887144991074880`:** `booking_confirmation`
    (PENDING), `booking_confirmation_demo` (PENDING, throwaway for Video B), `hello_world` (APPROVED).
- ⬜ Embedded Signup run, webhooks, real-number template submit — pending App Review approval.

**Test-number creds in `.env.local` (for recording only; not the real number):**
`WHATSAPP_PHONE_NUMBER_ID=1151582444706889`, `WHATSAPP_WABA_ID=887144991074880`,
`WHATSAPP_ACCESS_TOKEN=<temp 24h token from API Setup — refresh if expired>`. Test number's
display number is `+1 555-659-4017`. `getNumberConfig()` (`src/lib/whatsapp/config.ts`) falls back
to these env vars because the `whatsapp_config` table doesn't exist yet (migration not applied).

0. **Protect history:** ensure the number is on the **WhatsApp Business app** (switch from
   personal WhatsApp if needed — that keeps your chats) and take a chat **backup**.
1. **Register as a Tech Provider** (free): App Dashboard → Tech Provider onboarding →
   "Onboard without a partner". ✅
2. **Business Verification** in Meta Business Manager. ✅ **Approved.**
3. **App basics:** note **App ID** + **App Secret**; add the WhatsApp use case. The App
   Review "Review app settings" sub-step also requires: **app icon**, **Privacy Policy URL**,
   and an **app category** selected (App Settings → Basic).
4. **Embedded Signup config:** create a Facebook-Login-for-Business config → **config_id**;
   set Allowed Domains + Valid OAuth Redirect URIs to the Vercel domain.
5. **App Review** (Advanced Access) for `whatsapp_business_messaging` +
   `whatsapp_business_management` — **the only remaining gate**. Requires **two screencast
   videos**. The two are NOT equal risk (verified against Meta's onboarding text + the
   solution-providers sample-submission page):
   - **Video A — `whatsapp_business_messaging` (send):** Meta requires the video to show the
     message sent **from your app** ("business application interface, not the consumer-facing
     experience"). The pure-cURL / test-number shortcut is third-party folklore and risks
     rejection. **Use the real app UI:** point the send layer at the **free test number** via
     env (`WHATSAPP_PHONE_NUMBER_ID` + temporary `WHATSAPP_ACCESS_TOKEN` from API Setup),
     run the app, and record the existing **"Send invoice via WhatsApp"** admin button
     (`src/components/shared/send-invoice-whatsapp-button.tsx` →
     `/api/admin/send-invoice-whatsapp`) sending to a verified test recipient, plus WhatsApp
     receiving it. Satisfies "your app sending the message" with ~zero rejection risk.
   - **Video B — `whatsapp_business_management` (template):** Meta's onboarding text says
     "make **API test calls** and record... creating a message template" — so Graph API
     Explorer `POST <WABA_ID>/message_templates` (creating `booking_confirmation`) is exactly
     what is asked for. Sanctioned; also creates the real template (step 9).
   - **Where videos + descriptions are uploaded:** inside the submission flow's **"Allowed
     usage"** step (each permission card has Describe + Upload screencast + API-call check +
     Agree). NOT in "Reviewer instructions" (that step only needs a registered platform + a
     text note). **Don't** use Meta's "AI Content Suggestion" boilerplate — it overclaims
     (marketing, managing "onboarded customers'" assets) and invites scrutiny; use tight,
     transactional, own-assets-only descriptions.
   - ✅ **Both videos recorded + uploaded** (Video A = invoice send to test number; Video B =
     template create in Graph Explorer). Status now: see the Progress block above — staged,
     awaiting the management API-call indicator to flip green, then **Submit for review**.
   - Then **Submit documentation for App Review** → typically 1–3 business days; the review
     itself cannot be skipped.
6. **WhatsApp Business app** v2.24.17+ active on the number.
7. **Run Embedded Signup** at `/admin/whatsapp` → "Connect WhatsApp" (QR scan).
8. **Webhooks:** callback `https://<vercel-domain>/api/whatsapp/webhook` + the verify token;
   subscribe to `messages` and `smb_message_echoes` (and `account_offboarded` /
   `account_reconnected` / `smb_app_state_sync` / `history`).
9. **Create + submit** the `booking_confirmation` UTILITY template (section 6).

Apply the Supabase migration by hand in the Supabase dashboard (no local CLI).

---

## 8. Verification

**This branch (`feat/discount-otp-gate`):**

1. **OTP gate fires:** create a reservation, discount a room's nightly rate by more than
   `NEXT_PUBLIC_DISCOUNT_OTP_THRESHOLD` (default ₹300) → the approval dialog opens instead
   of creating immediately. A discount ≤ threshold creates the booking with no dialog.
2. **OTP delivers:** with `whatsapp_otp_phone` set **and the owner's 24h window open**
   (owner messaged the business number first), "request code" reaches the owner's WhatsApp
   as a free-form text showing guest/amounts/discount + code. With the window closed the
   send returns 502 (131047) — confirming the window dependency is the only gap.
3. **Verify + create:** entering the correct code creates the booking; wrong/expired/used
   codes are rejected (5-attempt lock, 10-min TTL, single-use).
4. **Regression:** existing admin "send invoice / payment QR" still send via the new Cloud
   API layer (they were dead on GOWA).

**Deferred (full rollout on `feat/whatsapp-cloud-api`):**

5. **Handshake:** Meta "Verify and save" succeeds against the deployed webhook URL.
6. **Bot:** message the number → 3-button menu; tap "Balance due" → correct balance; rows in
   `whatsapp_messages`.
7. **Coexistence:** reply from the WhatsApp Business app → `smb_message_echoes` logged, bot
   suppressed for that thread.
8. **Template:** approved `booking_confirmation` sends to a no-open-window number (no 131047).
9. **Automation:** confirming a payment fires the confirmation (best-effort).
