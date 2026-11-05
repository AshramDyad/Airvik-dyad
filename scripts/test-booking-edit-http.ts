// Local-only real HTTP acceptance check. Run the local app before this script.
// Node 24: node --env-file=.env.booking-local scripts/test-booking-edit-http.ts
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
assert.equal(apiUrl, "http://127.0.0.1:54321", "refusing to test against a non-local Supabase URL");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.ok(serviceKey, "local service key is required");
const local = createClient(apiUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const role = randomUUID(), guest = randomUUID(), rate = randomUUID(), type = randomUUID();
const rooms = Array.from({ length: 38 }, () => randomUUID());
const ids = Array.from({ length: 37 }, () => randomUUID());
const booking = `A${Date.now()}`;
const payment = randomUUID();
let actor: string | undefined;
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
function sql(statement: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("psql", ["postgresql://postgres:postgres@127.0.0.1:54322/postgres", "-X", "-A", "-t", "-q", "-v", "ON_ERROR_STOP=1", "-c", statement],
      { timeout: 15_000 }, (error, stdout, stderr) => error ? reject(new Error(stderr || error.message)) : resolve(stdout.trim()));
  });
}
const savedSchema = z.object({ bookingId: z.string(), reservations: z.array(z.object({
  id: z.string(), room_id: z.string(), number_of_guests: z.number(), total_amount: z.number(), notes: z.string().nullable(),
  folio: z.array(z.object({ id: z.string(), transaction_id: z.string().nullable(), amount: z.number() })),
})) });

try {
  const email = `booking-http-${randomUUID()}@example.invalid`, password = randomUUID();
  const created = await local.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) throw created.error;
  actor = created.data.user.id;
  await sql(`BEGIN;
    INSERT INTO public.roles(id,name,permissions) VALUES (${quote(role)},${quote(`HTTP fixture ${role}`)},ARRAY['update:reservation','create:reservation']);
    UPDATE public.profiles SET role_id=${quote(role)} WHERE id=${quote(actor)};
    INSERT INTO public.guests(id,first_name,last_name) VALUES (${quote(guest)},'Local','HTTP fixture');
    INSERT INTO public.rate_plans(id,name,price) VALUES (${quote(rate)},${quote(`HTTP fixture ${rate}`)},100);
    INSERT INTO public.room_types(id,name,max_occupancy,price) VALUES (${quote(type)},${quote(`HTTP fixture ${type}`)},4,100);
    INSERT INTO public.rooms(id,room_number,room_type_id,status) VALUES ${rooms.map((id, i) => `(${quote(id)},${quote(i === 0 ? `http-206-${booking}` : i === 37 ? `http-210-${booking}` : `http-${booking}-${i}`)},${quote(type)},'Clean')`).join(",")};
    INSERT INTO public.reservations(id,booking_id,guest_id,room_id,rate_plan_id,check_in_date,check_out_date,number_of_guests,adult_count,child_count,total_amount,status,source)
      VALUES ${ids.map((id, i) => `(${quote(id)},${quote(booking)},${quote(guest)},${quote(rooms[i])},${quote(rate)},'2053-01-01','2053-01-03',${i < 16 ? 3 : 2},${i < 16 ? 3 : 2},0,200,'Confirmed','reception')`).join(",")};
    INSERT INTO public.folio_items(id,reservation_id,description,amount,payment_method,transaction_id,external_reference)
      VALUES (${quote(payment)},${quote(ids[0])},'HTTP attached payment',-6800,'UPI','S58965663','627292156097');
    COMMIT;`);
  const signIn = await local.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  const token = signIn.data.session.access_token;
  const snapshotRaw: unknown = JSON.parse(await sql(`SELECT jsonb_agg(jsonb_build_object(
    'id',id,'roomId',room_id,'ratePlanId',rate_plan_id,'checkInDate',check_in_date,'checkOutDate',check_out_date,
    'adultCount',adult_count,'childCount',child_count,'numberOfGuests',number_of_guests,'notes',notes,
    'totalAmount',total_amount,'taxEnabledSnapshot',tax_enabled_snapshot,'taxRateSnapshot',tax_rate_snapshot,
    'status',status,'paymentMethod',payment_method) ORDER BY id) FROM public.reservations WHERE booking_id=${quote(booking)}`));
  const snapshot = z.array(z.record(z.unknown())).parse(snapshotRaw);
  const input = { checkInDate: "2053-01-01", checkOutDate: "2053-01-03", roomIds: [...rooms.slice(1, 37), rooms[37]], adultCount: 90, childCount: 0, notes: "HTTP confirmed save", customRates: {}, expectedReservations: snapshot };
  const url = `http://127.0.0.1:3000/api/admin/reservations/${ids[0]}`;
  const patch = (auth = true) => fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(input), signal: AbortSignal.timeout(30_000) });
  assert.equal((await patch(false)).status, 401, "unauthenticated HTTP calls must be denied");
  const startedAt = performance.now();
  const response = await patch();
  const rawResult: unknown = await response.json();
  assert.equal(response.status, 200, JSON.stringify(rawResult));
  const result = savedSchema.parse(rawResult);
  assert.equal(result.bookingId, booking); assert.equal(result.reservations.length, 37);
  assert.equal(result.reservations.reduce((sum, row) => sum + row.number_of_guests, 0), 90);
  assert.equal(result.reservations.reduce((sum, row) => sum + row.total_amount, 0), 7400);
  assert.equal(result.reservations.find((row) => row.id === ids[0])?.room_id, rooms[37]);
  assert.ok(result.reservations.some((row) => row.folio.some((item) => item.id === payment && item.transaction_id === "S58965663" && item.amount === -6800)));
  assert.equal(await sql(`SELECT room_id FROM public.reservations WHERE id=${quote(ids[0])}`), rooms[37]);
  assert.equal(await sql(`SELECT notes FROM public.reservations WHERE id=${quote(ids[0])}`), "HTTP confirmed save");
  console.log(`PASS: authenticated 37-room/90-guest HTTP save, payment references and fresh-read persistence (${Math.round(performance.now() - startedAt)} ms locally; not a production benchmark)`);
  assert.equal((await patch()).status, 409, "stale replay cannot overwrite the saved booking");
  console.log("PASS: HTTP unauthorized and stale-edit rejection");
} finally {
  // Remove only this test's UUID-scoped local fixtures, leaving seed data intact.
  await sql(`BEGIN;
    DELETE FROM public.folio_items WHERE reservation_id IN (SELECT id FROM public.reservations WHERE booking_id=${quote(booking)});
    DELETE FROM public.admin_activity_logs WHERE entity_label=${quote(booking)};
    DELETE FROM public.reservations WHERE booking_id=${quote(booking)};
    DELETE FROM public.rooms WHERE room_type_id=${quote(type)};
    DELETE FROM public.room_types WHERE id=${quote(type)}; DELETE FROM public.rate_plans WHERE id=${quote(rate)};
    DELETE FROM public.guests WHERE id=${quote(guest)};
    ${actor ? `UPDATE public.profiles SET role_id=NULL WHERE id=${quote(actor)};` : ""}
    DELETE FROM public.roles WHERE id=${quote(role)}; COMMIT;`);
  if (actor) {
    const removed = await local.auth.admin.deleteUser(actor);
    if (removed.error) throw removed.error;
  }
}
