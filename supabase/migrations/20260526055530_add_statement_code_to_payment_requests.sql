BEGIN;

SET search_path TO public;

ALTER TABLE "public"."payment_requests"
  ADD COLUMN IF NOT EXISTS "statement_code" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "pg_constraint"
    WHERE "conname" = 'payment_requests_statement_code_format'
  ) THEN
    ALTER TABLE "public"."payment_requests"
      ADD CONSTRAINT "payment_requests_statement_code_format"
      CHECK (
        "statement_code" IS NULL
        OR "statement_code" ~ '^[A-Z]{4}$'
      );
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_requests_pending_statement_code_key"
  ON "public"."payment_requests" USING btree ("statement_code")
  WHERE "status" = 'pending'
    AND "statement_code" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "payment_requests_pending_statement_code_initial_amount_idx"
  ON "public"."payment_requests" USING btree (
    "amount",
    (left("statement_code", 1))
  )
  WHERE "status" = 'pending'
    AND "statement_code" IS NOT NULL;

-- ROLLBACK:
-- DROP INDEX IF EXISTS "public"."payment_requests_pending_statement_code_initial_amount_idx";
-- DROP INDEX IF EXISTS "public"."payment_requests_pending_statement_code_key";
-- ALTER TABLE "public"."payment_requests" DROP CONSTRAINT IF EXISTS "payment_requests_statement_code_format";
-- ALTER TABLE "public"."payment_requests" DROP COLUMN IF EXISTS "statement_code";

COMMIT;
