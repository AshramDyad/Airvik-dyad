-- Add donation-specific fields to manual_receipts table
-- These columns support the new full-page donation receipt form.
-- All columns are nullable so existing rows are unaffected.

ALTER TABLE "public"."manual_receipts"
  ADD COLUMN "full_name"     text,
  ADD COLUMN "city"          text,
  ADD COLUMN "pancard"       text,
  ADD COLUMN "aadhar_card"   text,
  ADD COLUMN "dob"           date,
  ADD COLUMN "trust"         text,
  ADD COLUMN "donation_type" text,
  ADD COLUMN "donation_in"   text,
  ADD COLUMN "payment_mode"  text;
