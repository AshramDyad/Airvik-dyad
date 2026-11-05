// Run with Node 24: node scripts/test-booking-edit-concurrency.ts
// Deliberately hard-coded to LOCAL Supabase. No production URL or env override.
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";

const localDatabase = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";
const actor = randomUUID(), role = randomUUID(), guest = randomUUID(), rate = randomUUID(), type = randomUUID();
const roomIds = Array.from({ length: 5 }, () => randomUUID());
const reservationIds = [randomUUID(), randomUUID()];
const codeBase = `A${Date.now()}`;
const bookings = [`${codeBase}1`, `${codeBase}2`, `${codeBase}3`];
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const uuidArray = (ids: string[]) => `ARRAY[${ids.map(quote).join(",")}]::uuid[]`;
const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

function sql(statement: string, applicationName = "booking-concurrency-test"): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("psql", [localDatabase, "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-c", statement],
      { env: { ...process.env, PGAPPNAME: applicationName }, timeout: 15_000 },
      (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve(stdout.trim()));
  });
}

async function expected(reservationId: string) {
  return sql(`SELECT jsonb_build_array(jsonb_build_object(
    'id', id, 'roomId', room_id, 'ratePlanId', rate_plan_id,
    'checkInDate', check_in_date, 'checkOutDate', check_out_date,
    'adultCount', adult_count, 'childCount', child_count, 'numberOfGuests', number_of_guests,
    'notes', notes, 'totalAmount', total_amount, 'taxEnabledSnapshot', tax_enabled_snapshot,
    'taxRateSnapshot', tax_rate_snapshot, 'status', status, 'paymentMethod', payment_method
  )) FROM public.reservations WHERE id = ${quote(reservationId)}::uuid`);
}

function edit(reservationId: string, destination: string, snapshot: string, notes: string | null = null) {
  return `SELECT public.save_booking_edit(${quote(reservationId)}::uuid, ${quote(actor)}::uuid, ${quote(snapshot)}::jsonb,
    (SELECT jsonb_build_object(
      'bookingId', booking_id, 'primaryReservationId', id,
      'checkInDate', check_in_date, 'checkOutDate', check_out_date, 'notes', ${notes === null ? "NULL::text" : quote(notes)},
      'ratePlanId', rate_plan_id, 'taxEnabledSnapshot', tax_enabled_snapshot, 'taxRateSnapshot', tax_rate_snapshot,
      'adultCount', adult_count, 'childCount', child_count, 'newRoomStatus', status, 'confirmNewRooms', false,
      'cancelIds', '[]'::jsonb, 'assignments', jsonb_build_array(jsonb_build_object(
        'reservationId', id, 'roomId', ${quote(destination)}::uuid, 'adultCount', adult_count,
        'childCount', child_count, 'numberOfGuests', number_of_guests, 'totalAmount', total_amount
      ))) FROM public.reservations WHERE id = ${quote(reservationId)}::uuid));`;
}

function create(destination: string) {
  return `SELECT id FROM public.create_reservations_with_total(
    ${quote(bookings[2])}, ${quote(guest)}::uuid, ${uuidArray([destination])}, ${quote(rate)}::uuid,
    '2052-01-01', '2052-01-03', 2, 'Confirmed', NULL, now(), 'reception', 'Not specified', 2, 0);`;
}

async function competingWrites(first: string, second: string, expectedError: "23P01" | "PT409", label: string) {
  const name = `booking-edit-lock-${randomUUID()}`;
  const winner = sql(`BEGIN; ${first} SELECT pg_sleep(0.7); COMMIT;`, name)
    .then(() => null, (error: unknown) => error);
  let lockObserved = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    const held = await sql(`SELECT EXISTS (
      SELECT 1 FROM pg_locks l JOIN pg_stat_activity a ON a.pid = l.pid
      WHERE a.application_name = ${quote(name)} AND l.locktype = 'advisory' AND l.granted
    )`);
    if (held === "t") { lockObserved = true; break; }
    await delay(25);
  }
  assert.ok(lockObserved, "the first real connection must hold the room lock before starting its competitor");
  const loser = await sql(second).then(() => null, (error: unknown) => error);
  const winnerError = await winner;
  assert.equal(winnerError, null, "the first transaction should commit");
  assert.ok(loser instanceof Error, "the conflicting transaction should fail");
  assert.match(loser.message, new RegExp(expectedError));
  console.log(`PASS: ${label}`);
}

try {
  assert.equal(await sql("SELECT current_database()"), "postgres");
  await sql(`BEGIN;
    INSERT INTO public.roles(id,name,permissions) VALUES (${quote(role)},${quote(`Concurrent test ${role}`)},ARRAY['update:reservation','create:reservation']);
    INSERT INTO auth.users(id,email,raw_user_meta_data,raw_app_meta_data) VALUES (${quote(actor)},${quote(`${actor}@example.invalid`)},'{}','{}');
    INSERT INTO public.profiles(id,name,role_id) VALUES (${quote(actor)},'Local concurrent tester',${quote(role)}) ON CONFLICT(id) DO UPDATE SET role_id=EXCLUDED.role_id;
    INSERT INTO public.guests(id,first_name,last_name) VALUES (${quote(guest)},'Local','Concurrent fixture');
    INSERT INTO public.rate_plans(id,name,price) VALUES (${quote(rate)},${quote(`Concurrent test ${rate}`)},100);
    INSERT INTO public.room_types(id,name,max_occupancy,price) VALUES (${quote(type)},${quote(`Concurrent test ${type}`)},4,100);
    INSERT INTO public.rooms(id,room_number,room_type_id,status) SELECT id,'concurrent-'||id::text,${quote(type)},'Clean' FROM unnest(${uuidArray(roomIds)}) id;
    INSERT INTO public.reservations(id,booking_id,guest_id,room_id,rate_plan_id,check_in_date,check_out_date,number_of_guests,adult_count,child_count,total_amount,status,source)
      VALUES ${reservationIds.map((id, index) => `(${quote(id)},${quote(bookings[index])},${quote(guest)},${quote(roomIds[index])},${quote(rate)},'2052-01-01','2052-01-03',2,2,0,200,'Confirmed','reception')`).join(",")};
    COMMIT;`);

  await competingWrites(edit(reservationIds[0], roomIds[2], await expected(reservationIds[0])),
    edit(reservationIds[1], roomIds[2], await expected(reservationIds[1])), "23P01", "two booking edits cannot reserve the same room");
  assert.equal(await sql(`SELECT room_id FROM public.reservations WHERE id=${quote(reservationIds[1])}`), roomIds[1]);

  await competingWrites(create(roomIds[3]), edit(reservationIds[1], roomIds[3], await expected(reservationIds[1])),
    "23P01", "legacy batch creation protects its room against a new edit");
  await competingWrites(edit(reservationIds[1], roomIds[4], await expected(reservationIds[1])), create(roomIds[4]),
    "23P01", "a new edit protects its room against legacy batch creation");
  assert.equal(await sql(`SELECT count(*) FROM public.reservations WHERE booking_id=${quote(bookings[2])}`), "1");

  const staleSnapshot = await expected(reservationIds[1]);
  await competingWrites(edit(reservationIds[1], roomIds[4], staleSnapshot, "First staff edit"),
    edit(reservationIds[1], roomIds[4], staleSnapshot, "Stale staff edit"), "PT409", "concurrent stale saves cannot overwrite the first edit");
  assert.equal(await sql(`SELECT notes FROM public.reservations WHERE id=${quote(reservationIds[1])}`), "First staff edit");
  console.log("All four real-connection concurrency checks passed.");
} finally {
  // Delete only the UUID-scoped fixtures this script created, never seed/user data.
  await sql(`BEGIN;
    DELETE FROM public.folio_items WHERE reservation_id IN (SELECT id FROM public.reservations WHERE booking_id=ANY(ARRAY[${bookings.map(quote).join(",")}]));
    DELETE FROM public.admin_activity_logs WHERE actor_user_id=${quote(actor)};
    DELETE FROM public.reservations WHERE booking_id=ANY(ARRAY[${bookings.map(quote).join(",")}]);
    DELETE FROM public.rooms WHERE id=ANY(${uuidArray(roomIds)});
    DELETE FROM public.room_types WHERE id=${quote(type)}; DELETE FROM public.rate_plans WHERE id=${quote(rate)};
    DELETE FROM public.guests WHERE id=${quote(guest)}; DELETE FROM public.profiles WHERE id=${quote(actor)};
    DELETE FROM auth.users WHERE id=${quote(actor)}; DELETE FROM public.roles WHERE id=${quote(role)};
    COMMIT;`);
}
