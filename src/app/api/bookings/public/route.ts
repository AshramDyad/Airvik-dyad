import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createPublicBooking,
  PublicBookingError,
} from "@/lib/server/public-booking";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const GuestSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  phone: z.string().trim().min(1),
  address: z.string().trim().min(1),
  pincode: z.string().trim().optional(),
  city: z.string().trim().min(1),
  state: z.string().trim().optional(),
  country: z.string().trim().min(1).optional(),
});

const PublicBookingSchema = z
  .object({
    roomTypeIds: z.array(z.string().trim().min(1)).min(1),
    checkIn: z.string().regex(DATE_PATTERN),
    checkOut: z.string().regex(DATE_PATTERN),
    adults: z.number().int().min(1),
    children: z.number().int().min(0),
    specialRequests: z.string().trim().optional(),
    guest: GuestSchema,
  })
  .refine((payload) => payload.checkIn < payload.checkOut, {
    path: ["checkOut"],
    message: "Check-out must be after check-in",
  });

export async function POST(request: Request) {
  try {
    const payload = PublicBookingSchema.parse(await request.json());
    const data = await createPublicBooking(payload);

    return NextResponse.json({ data }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid input", issues: error.flatten().fieldErrors },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { message: "Invalid JSON" },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    if (error instanceof PublicBookingError) {
      return NextResponse.json(
        { message: error.message, code: error.code },
        { status: error.statusCode, headers: NO_STORE_HEADERS },
      );
    }

    console.error("Failed to create public booking", error);
    return NextResponse.json(
      { message: "Unable to create booking right now." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
