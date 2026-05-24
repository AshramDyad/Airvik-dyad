BEGIN;

SET search_path TO public;

REVOKE ALL ON FUNCTION "public"."mark_payment_request_paid"(uuid, numeric, text, jsonb)
  FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON FUNCTION "public"."mark_payment_request_paid"(uuid, numeric, text, jsonb)
  TO "service_role";

REVOKE ALL ON FUNCTION "public"."admin_confirm_gateway_payment_override"(uuid, numeric, text, text, uuid)
  FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON FUNCTION "public"."admin_confirm_gateway_payment_override"(uuid, numeric, text, text, uuid)
  TO "service_role";

REVOKE ALL ON FUNCTION "public"."create_cash_reservations_with_total"(text, uuid, uuid[], uuid, date, date, integer, text, timestamp with time zone, text, integer, integer, boolean, numeric, numeric[], numeric, uuid)
  FROM PUBLIC, "anon", "authenticated";
GRANT ALL ON FUNCTION "public"."create_cash_reservations_with_total"(text, uuid, uuid[], uuid, date, date, integer, text, timestamp with time zone, text, integer, integer, boolean, numeric, numeric[], numeric, uuid)
  TO "service_role";

COMMIT;

-- ROLLBACK:
-- GRANT ALL ON FUNCTION "public"."mark_payment_request_paid"(uuid, numeric, text, jsonb) TO "anon", "authenticated";
-- GRANT ALL ON FUNCTION "public"."admin_confirm_gateway_payment_override"(uuid, numeric, text, text, uuid) TO "anon", "authenticated";
-- GRANT ALL ON FUNCTION "public"."create_cash_reservations_with_total"(text, uuid, uuid[], uuid, date, date, integer, text, timestamp with time zone, text, integer, integer, boolean, numeric, numeric[], numeric, uuid) TO "anon", "authenticated";
