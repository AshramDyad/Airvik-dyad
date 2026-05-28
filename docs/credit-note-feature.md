# Credit Note Feature

## Goal

When a guest pays for a reservation using `UPI Gateway` and that reservation is later cancelled, the paid amount should not be lost. The system should create a credit note for the guest. That credit can then be applied to a future reservation for the same guest.

The credit note must keep the existing `guest_id` ownership link and also store the guest name and phone number at the time the credit note is created.

## Core Rules

- Credit notes are created only for reservations paid through `UPI Gateway`.
- A credit note is created only when an actual payment exists in `folio_items`.
- The credit amount is based on the paid amount, not the reservation total.
- `guest_id` remains the primary owner of the credit note.
- Guest name and phone number are stored as snapshots for verification, search, and duplicate guest matching.
- A reservation cancellation should not proceed if the required credit note cannot be created.
- Credit note creation and reservation cancellation must happen in one backend transaction.
- A credit note cannot be created twice for the same cancelled booking.

## Guest Identity

Credit notes should store both strong ownership and human-verifiable identity details.

Required identity fields:

```text
guest_id
guest_name_snapshot
guest_phone_snapshot
guest_name_normalized
guest_phone_normalized
```

How these fields are used:

- `guest_id` is the main ownership/security key.
- `guest_name_snapshot` shows the guest name when the credit note was created.
- `guest_phone_snapshot` shows the guest phone when the credit note was created.
- `guest_name_normalized` and `guest_phone_normalized` help find credits if duplicate guest profiles exist later.

The system should prefer exact `guest_id` matching. Name and phone matching should be a fallback for search and admin verification, not a replacement for `guest_id`.

## Cancellation Workflow

When an admin clicks cancel:

1. Open a cancellation modal.
2. The modal checks whether the reservation is eligible for a credit note.
3. If eligible, show:
   - guest name
   - guest phone
   - booking ID
   - reservation ID or reservation IDs
   - paid UPI Gateway amount
   - credit amount to be created
4. The admin confirms credit note creation.
5. The backend creates the credit note.
6. The backend cancels the reservation or booking.
7. The UI refreshes reservation, guest, billing, and credit-note data.

If credit note creation fails, cancellation must not happen.

## Credit Note Creation Logic

The backend should:

1. Lock the reservation or booking rows.
2. Confirm the booking is not already cancelled.
3. Confirm the payment method is `UPI Gateway`.
4. Sum eligible paid folio rows:
   - `amount < 0`
   - `payment_method = 'UPI Gateway'`
   - `external_source in ('payment_request', 'payment_override')`
5. Check that no credit note already exists for the same source booking.
6. Create a credit note for the paid amount.
7. Store guest name and phone snapshots.
8. Cancel the reservation or booking.
9. Add an admin activity log.

The operation should be idempotent. Repeated clicks should not create duplicate credit notes.

## Suggested Tables

### `credit_notes`

```text
id
credit_note_number
guest_id
guest_name_snapshot
guest_phone_snapshot
guest_name_normalized
guest_phone_normalized
source_booking_id
source_reservation_id
original_amount
available_amount
currency
status
reason
created_by
created_at
updated_at
metadata
```

Suggested statuses:

```text
available
partially_applied
fully_applied
void
```

### `credit_note_applications`

```text
id
credit_note_id
guest_id
reservation_id
booking_id
amount
created_by
created_at
metadata
```

This table records every time credit is applied to a future reservation.

## Applying Credit To A Future Reservation

When creating or editing a reservation:

1. Look for available credit notes by exact `guest_id`.
2. If none are found, search by normalized phone and normalized guest name.
3. If exactly one safe match exists, show it to the admin.
4. If multiple matches exist, require the admin to choose.
5. Apply only up to the reservation balance due.
6. Create a credit-note application row.
7. Add a folio payment row on the new reservation:
   - `amount` should be negative
   - `payment_method = 'Credit Note'`
   - `external_source = 'credit_note_application'`
   - `external_reference = credit_note_id`
8. Reduce the credit note `available_amount`.
9. Update credit note status.

Credit should never be auto-applied silently when matching is ambiguous.

## Guest Detail Page

The guest detail page should show a Credit Notes section.

It should list:

- credit note number
- status
- original amount
- available amount
- guest name snapshot
- guest phone snapshot
- source booking ID
- source reservation ID
- created date
- created by
- future reservations where the credit was applied

The page should show both credits owned by `guest_id` and possible phone/name matches, but phone/name-only matches should be clearly marked for admin review.

## Reservation Detail Page

The reservation detail page should show credit-note tracking.

For the cancelled source reservation, show:

- whether a credit note was generated
- credit note number
- original credit amount
- remaining credit balance
- guest name snapshot
- guest phone snapshot
- created date
- created by
- future reservations where the credit was applied

For a future reservation where credit was used, show:

- applied credit note number
- applied amount
- original source booking ID
- original source reservation ID

This gives traceability in both directions.

## Modal Behavior

The cancellation modal should not be a simple yes/no dialog.

It should show one of these states:

- No UPI Gateway payment found: cancellation is blocked or requires a separate no-credit cancellation flow.
- Credit note will be created: show amount and guest details.
- Credit note already exists: show existing credit note and allow cancellation only if the booking is not already cancelled.
- Ambiguous payment state: block cancellation and ask admin to review billing.

For the agreed workflow, normal cancellation should proceed only through credit-note creation.

## Edge Cases

- No payment made: no credit note should be created.
- Pending payment request: no credit note should be created.
- Expired payment request: no credit note should be created.
- Partial payment: create credit only for the paid amount.
- Multi-room booking: create one booking-level credit note unless partial room cancellation is explicitly supported.
- Duplicate guest profiles: use phone/name matching as admin-assisted fallback.
- Missing phone number: do not auto-match by name only.
- Same phone used by multiple guests: require manual admin selection.
- Credit already fully used: do not apply it again.
- Credit exceeds new reservation balance: apply partial credit and keep the remaining balance.
- New reservation balance exceeds credit: apply full credit and collect the remaining amount normally.
- Refund already processed outside the system: do not also create a credit note.

## Security And Audit

- Admins should manage credit notes through server routes or RPC functions.
- Client-side checks are only for UI; database functions must enforce the rules.
- RLS should use existing reservation/payment permissions.
- Credit note rows should not be edited directly after creation.
- Corrections should be recorded as new adjustment or void actions.
- Every credit creation and application should create an activity log.

## Recommended Backend Functions

```text
cancel_booking_with_credit_note(...)
apply_guest_credit_to_reservation(...)
list_guest_credit_notes(...)
list_reservation_credit_notes(...)
```

`cancel_booking_with_credit_note` should create the credit note and cancel the reservation in the same database transaction.

`apply_guest_credit_to_reservation` should verify the guest match, create the application row, insert the folio payment row, and update the available balance in one transaction.

