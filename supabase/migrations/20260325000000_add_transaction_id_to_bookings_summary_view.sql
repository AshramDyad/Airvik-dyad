-- Fix: add transactionId to the folio jsonb_build_object inside bookings_summary_view.
-- The transaction_id column was added to folio_items in migration 20260324000000,
-- but the view was never updated to include it. This caused invoices generated from
-- the reservations table to always show "-" for Transaction ID.

CREATE OR REPLACE VIEW "public"."bookings_summary_view" AS
 WITH "filtered_reservations" AS (
         SELECT "r_1"."id",
            "r_1"."booking_id",
            "r_1"."guest_id",
            "r_1"."room_id",
            "r_1"."rate_plan_id",
            "r_1"."check_in_date",
            "r_1"."check_out_date",
            "r_1"."number_of_guests",
            "r_1"."status",
            "r_1"."notes",
            "r_1"."total_amount",
            "r_1"."booking_date",
            "r_1"."source",
            "r_1"."payment_method",
            "r_1"."adult_count",
            "r_1"."child_count",
            "r_1"."tax_enabled_snapshot",
            "r_1"."tax_rate_snapshot",
            "r_1"."external_source",
            "r_1"."external_id",
            "r_1"."external_metadata",
            "rooms"."room_number" AS "room_number_actual"
           FROM ("public"."reservations" "r_1"
             LEFT JOIN "public"."rooms" ON (("r_1"."room_id" = "rooms"."id")))
          WHERE (("r_1"."external_metadata" IS NULL) OR (("r_1"."external_metadata" ->> 'removedDuringEdit'::"text") IS NULL) OR (("r_1"."external_metadata" ->> 'removedDuringEdit'::"text") <> 'true'::"text"))
        )
 SELECT "r"."booking_id",
    "min"("r"."booking_date") AS "booking_date",
    "max"("g"."first_name") AS "guest_first_name",
    "max"("g"."last_name") AS "guest_last_name",
    COALESCE("max"((("g"."first_name" || ' '::"text") || "g"."last_name")), 'N/A'::"text") AS "guest_name",
    "max"("g"."email") AS "guest_email",
    "max"("g"."phone") AS "guest_phone",
    "sum"("r"."total_amount") AS "total_amount",
    "count"("r"."id") AS "room_count",
    "min"("r"."check_in_date") AS "check_in_date",
    "max"("r"."check_out_date") AS "check_out_date",
    "sum"("r"."number_of_guests") AS "number_of_guests",
    "sum"(COALESCE("r"."adult_count", 0)) AS "adult_count",
    "sum"(COALESCE("r"."child_count", 0)) AS "child_count",
    ("max"(("r"."guest_id")::"text"))::"uuid" AS "guest_id",
        CASE "max"(
            CASE "r"."status"
                WHEN 'Checked-out'::"text" THEN 5
                WHEN 'Checked-in'::"text" THEN 4
                WHEN 'Confirmed'::"text" THEN 3
                WHEN 'Standby'::"text" THEN 2
                WHEN 'Tentative'::"text" THEN 1
                WHEN 'Cancelled'::"text" THEN 0
                WHEN 'No-show'::"text" THEN '-1'::integer
                ELSE '-2'::integer
            END)
            WHEN 5 THEN 'Checked-out'::"text"
            WHEN 4 THEN 'Checked-in'::"text"
            WHEN 3 THEN 'Confirmed'::"text"
            WHEN 2 THEN 'Standby'::"text"
            WHEN 1 THEN 'Tentative'::"text"
            WHEN 0 THEN 'Cancelled'::"text"
            WHEN '-1'::integer THEN 'No-show'::"text"
            ELSE 'Tentative'::"text"
        END AS "status",
    "jsonb_agg"("jsonb_build_object"(
      'id', "r"."id",
      'bookingId', "r"."booking_id",
      'guestId', "r"."guest_id",
      'roomId', "r"."room_id",
      'ratePlanId', "r"."rate_plan_id",
      'checkInDate', "r"."check_in_date",
      'checkOutDate', "r"."check_out_date",
      'numberOfGuests', "r"."number_of_guests",
      'status', "r"."status",
      'notes', "r"."notes",
      'totalAmount', "r"."total_amount",
      'bookingDate', "r"."booking_date",
      'source', "r"."source",
      'paymentMethod', "r"."payment_method",
      'adultCount', "r"."adult_count",
      'childCount', "r"."child_count",
      'taxEnabledSnapshot', "r"."tax_enabled_snapshot",
      'taxRateSnapshot', "r"."tax_rate_snapshot",
      'externalSource', "r"."external_source",
      'externalId', "r"."external_id",
      'externalMetadata', "r"."external_metadata",
      'roomNumber', "r"."room_number_actual",
      'folio', COALESCE((
        SELECT "jsonb_agg"("jsonb_build_object"(
          'id', "fi"."id",
          'description', "fi"."description",
          'amount', "fi"."amount",
          'timestamp', "fi"."timestamp",
          'paymentMethod', "fi"."payment_method",
          'transactionId', "fi"."transaction_id",
          'externalSource', "fi"."external_source",
          'externalReference', "fi"."external_reference",
          'externalMetadata', "fi"."external_metadata"
        )) AS "jsonb_agg"
        FROM "public"."folio_items" "fi"
        WHERE ("fi"."reservation_id" = "r"."id")
      ), '[]'::"jsonb")
    )) AS "reservation_rows"
   FROM ("filtered_reservations" "r"
     LEFT JOIN "public"."guests" "g" ON (("r"."guest_id" = "g"."id")))
  GROUP BY "r"."booking_id";
