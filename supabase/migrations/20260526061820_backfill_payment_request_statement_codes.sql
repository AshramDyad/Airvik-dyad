BEGIN;

SET search_path TO public;

WITH "candidates" AS (
  SELECT
    "id",
    "amount",
    "status",
    coalesce(
      upper(substring("upi_uri" FROM '[?&]tn=([A-Za-z]{4})(?:&|$)')),
      upper(substring("upi_uri" FROM '[?&]tr=([A-Za-z]{4})(?:&|$)'))
    ) AS "code"
  FROM "public"."payment_requests"
  WHERE "statement_code" IS NULL
),
"safe_candidates" AS (
  SELECT
    "candidates".*,
    count(*) FILTER (WHERE "status" = 'pending')
      OVER (PARTITION BY "amount", left("code", 1)) AS "pending_initial_count",
    count(*) FILTER (WHERE "status" = 'pending')
      OVER (PARTITION BY "code") AS "pending_code_count"
  FROM "candidates"
  WHERE "code" ~ '^[A-Z]{4}$'
)
UPDATE "public"."payment_requests" AS "payment_requests"
SET "statement_code" = "safe_candidates"."code"
FROM "safe_candidates"
WHERE "payment_requests"."id" = "safe_candidates"."id"
  AND (
    "safe_candidates"."status" <> 'pending'
    OR (
      "safe_candidates"."pending_initial_count" = 1
      AND "safe_candidates"."pending_code_count" = 1
      AND NOT EXISTS (
        SELECT 1
        FROM "public"."payment_requests" AS "existing"
        WHERE "existing"."id" <> "safe_candidates"."id"
          AND "existing"."status" = 'pending'
          AND "existing"."statement_code" IS NOT NULL
          AND (
            "existing"."statement_code" = "safe_candidates"."code"
            OR (
              "existing"."amount" = "safe_candidates"."amount"
              AND left("existing"."statement_code", 1) = left("safe_candidates"."code", 1)
            )
          )
      )
    )
  );

-- ROLLBACK:
-- UPDATE "public"."payment_requests"
-- SET "statement_code" = NULL
-- WHERE "statement_code" IS NOT NULL
--   AND (
--     "upi_uri" ~* '[?&]tn=' || "statement_code" || '(?:&|$)'
--     OR "upi_uri" ~* '[?&]tr=' || "statement_code" || '(?:&|$)'
--   );

COMMIT;
