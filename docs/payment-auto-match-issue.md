# Payment Auto-Match Issue

## Issue

A UPI Gateway reservation can become `paid` automatically even when the guest has not made a new payment.

Verified example:

- Reservation ID: `e47ad12b-c5c2-4b99-be5e-910e0d370eae`
- Booking ID: `A8721`
- QR amount entered by staff: `₹1`
- Generated dynamic QR amount: `₹1.08`
- Payment request status became: `paid`
- Reservation status became: `Confirmed`
- Matched transaction reference: `S17272840`

## What Happened

The new payment request was created at:

```text
2026-05-27 10:08 UTC
```

It was matched with an older bank transaction:

```text
Reference: S17272840
Amount: ₹1.08
Fetched at: 2026-05-27 04:05 UTC
Statement text/code: OJYX
```

That bank transaction was already used by another paid payment request:

```text
Reservation: fcc67afb-ba92-4390-9bc2-2e9592c0d300
Payment request code: OJYX
Reference: S17272840
Amount: ₹1.08
```

The new QR had statement code `ERTA`, but it still matched the old `OJYX` transaction because the fallback matcher accepted the same decimal amount.

## Root Cause

The auto-reconciliation logic is too loose.

Current matching can fall back to amount-only matching when a transaction has the same dynamic decimal amount. It does not strictly require:

- the bank transaction to be newer than the payment request,
- the transaction reference to be unused,
- the statement code in the transaction to match the QR statement code.

Because of that, an old `₹1.08` transaction was reused for a new `₹1.08` QR.

## Correct Solution

The reconciliation logic should be stricter.

Minimum required safeguards:

1. Do not reuse a bank transaction reference.
   - If `payment_reference` is already used by a paid payment request, skip that transaction.

2. Do not match old transactions.
   - A transaction must be after the payment request was created/requested.

3. Do not use amount-only matching for small decimal test amounts.
   - `₹1.xx` amounts are easy to repeat and should require stronger matching.

4. Prefer exact statement code matching.
   - QR code `ERTA` should not match a transaction containing `OJYX`.

## Expected Behavior After Fix

If a QR is generated for a reservation:

- it should remain `pending` until a valid new bank transaction is found,
- an old transaction should not mark it paid,
- a transaction already used by another payment request should not be reused,
- reservation status should change to `Confirmed` only after a valid payment match or admin confirmation.

