import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requirePermissions } from "@/lib/server/auth";
import type { Permission } from "@/data/types";
import {
  buildRoomOccupancyAssignments,
  type RoomOccupancyAssignment,
} from "@/lib/reservations/guest-allocation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CashBookingSchema = z.object({
  guestId: z.string().uuid(),
  roomIds: z.array(z.string().uuid()).min(1),
  ratePlanId: z.string().uuid(),
  checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  numberOfGuests: z.coerce.number().int().positive(),
  adultCount: z.coerce.number().int().min(0),
  childCount: z.coerce.number().int().min(0),
  notes: z.string().max(500).optional().nullable(),
  bookingDate: z.string().datetime(),
  source: z.string().default("reception"),
  taxEnabledSnapshot: z.boolean().default(false),
  taxRateSnapshot: z.coerce.number().min(0).default(0),
  customRoomTotals: z.array(z.number().positive().nullable()).optional().nullable(),
  roomOccupancies: z
    .array(
      z.object({
        roomId: z.string().uuid().optional(),
        adults: z.coerce.number().int().min(0),
        children: z.coerce.number().int().min(0),
      })
    )
    .optional(),
  cashAmount: z.coerce.number().positive(),
});

type DbCashBookingReservation = {
  id: string;
  booking_id: string;
  room_id?: string | null;
};

type ReservationUpdateClient = {
  from: (table: "reservations") => {
    update: (values: {
      adult_count: number;
      child_count: number;
      number_of_guests: number;
    }) => {
      eq: (
        column: "id",
        value: string
      ) => PromiseLike<{ error: { message: string } | null }>;
    };
  };
};

export async function POST(request: Request) {
  try {
    const profile = await requirePermissions(
      request,
      "create:reservation",
      "update:reservation"
    );
    if (!hasAllPermissions(profile.permissions, [
      "create:reservation",
      "update:reservation",
    ])) {
      throw new HttpError(403, "Insufficient permissions");
    }

    const payload = CashBookingSchema.parse(await request.json());
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc(
      "create_cash_reservations_with_total",
      {
        p_booking_id: null,
        p_guest_id: payload.guestId,
        p_room_ids: payload.roomIds,
        p_rate_plan_id: payload.ratePlanId,
        p_check_in_date: payload.checkInDate,
        p_check_out_date: payload.checkOutDate,
        p_number_of_guests: payload.numberOfGuests,
        p_notes: payload.notes ?? null,
        p_booking_date: payload.bookingDate,
        p_source: payload.source,
        p_adult_count: payload.adultCount,
        p_child_count: payload.childCount,
        p_tax_enabled_snapshot: payload.taxEnabledSnapshot,
        p_tax_rate_snapshot: payload.taxRateSnapshot,
        p_custom_totals: payload.customRoomTotals ?? null,
        p_cash_amount: roundMoney(payload.cashAmount),
        p_actor_user_id: profile.userId,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    const createdReservations = (data ?? []) as unknown as DbCashBookingReservation[];
    await applyMultiRoomOccupancies({
      supabase,
      reservations: createdReservations,
      roomIds: payload.roomIds,
      adultCount: payload.adultCount,
      childCount: payload.childCount,
      roomOccupancies: payload.roomOccupancies,
    });

    const reservations = createdReservations.map((reservation) => ({
      id: reservation.id,
      bookingId: reservation.booking_id,
    }));

    return noStoreJson({ reservations }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

function hasAllPermissions(
  permissions: Permission[],
  requiredPermissions: Permission[]
): boolean {
  return requiredPermissions.every((permission) =>
    permissions.includes(permission)
  );
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

async function applyMultiRoomOccupancies({
  supabase,
  reservations,
  roomIds,
  adultCount,
  childCount,
  roomOccupancies,
}: {
  supabase: ReservationUpdateClient;
  reservations: DbCashBookingReservation[];
  roomIds: string[];
  adultCount: number;
  childCount: number;
  roomOccupancies?: RoomOccupancyAssignment[];
}): Promise<void> {
  if (roomIds.length <= 1 || reservations.length <= 1) {
    return;
  }

  const assignments = normalizeRoomOccupancies(
    roomIds,
    adultCount,
    childCount,
    roomOccupancies
  );
  if (!assignments.length) {
    return;
  }

  const byRoomId = new Map<string, RoomOccupancyAssignment>();
  assignments.forEach((assignment) => {
    if (assignment.roomId) {
      byRoomId.set(assignment.roomId, assignment);
    }
  });

  await Promise.all(
    reservations.map(async (reservation, index) => {
      const assignment = reservation.room_id
        ? byRoomId.get(reservation.room_id) ?? assignments[index]
        : assignments[index];

      if (!assignment) {
        return;
      }

      const adults = Math.max(assignment.adults, 0);
      const children = Math.max(assignment.children, 0);
      const { error } = await supabase
        .from("reservations")
        .update({
          adult_count: adults,
          child_count: children,
          number_of_guests: adults + children,
        })
        .eq("id", reservation.id);

      if (error) {
        throw new Error(error.message);
      }
    })
  );
}

function normalizeRoomOccupancies(
  roomIds: string[],
  totalAdults: number,
  totalChildren: number,
  explicit?: RoomOccupancyAssignment[]
): RoomOccupancyAssignment[] {
  if (!explicit?.length) {
    return buildRoomOccupancyAssignments(roomIds, totalAdults, totalChildren);
  }

  const fallback = buildRoomOccupancyAssignments(roomIds, totalAdults, totalChildren);
  const byRoomId = new Map<string, RoomOccupancyAssignment>();

  explicit.forEach((entry, index) => {
    const roomId = entry.roomId ?? roomIds[index];
    if (!roomId) {
      return;
    }
    byRoomId.set(roomId, {
      roomId,
      adults: Math.max(entry.adults, 0),
      children: Math.max(entry.children, 0),
    });
  });

  return roomIds.map((roomId, index) => {
    return byRoomId.get(roomId) ?? fallback[index];
  });
}

function handleApiError(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return noStoreJson({ message: error.message }, { status: error.status });
  }

  if (error instanceof z.ZodError) {
    return noStoreJson(
      { message: "Invalid cash booking.", issues: error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  if (error instanceof Error && error.message.trim()) {
    return noStoreJson({ message: error.message }, { status: 500 });
  }

  return noStoreJson({ message: "Unable to create cash booking." }, { status: 500 });
}

function noStoreJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "private, no-store");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}
