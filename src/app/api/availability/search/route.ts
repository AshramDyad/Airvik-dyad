import { NextResponse } from "next/server";
import { z } from "zod";

import { searchPublicAvailability } from "@/lib/server/availability";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const AvailabilitySearchSchema = z
  .object({
    checkIn: z.string().regex(DATE_PATTERN),
    checkOut: z.string().regex(DATE_PATTERN),
    roomOccupancies: z
      .array(
        z.object({
          adults: z.number().int().min(1),
          children: z.number().int().min(0),
        }),
      )
      .min(1),
    categoryIds: z.array(z.string().min(1)).optional(),
    roomTypeIds: z.array(z.string().min(1)).optional(),
  })
  .refine((payload) => payload.checkIn < payload.checkOut, {
    path: ["checkOut"],
    message: "Check-out must be after check-in",
  });

export async function POST(request: Request) {
  try {
    const payload = AvailabilitySearchSchema.parse(await request.json());
    const data = await searchPublicAvailability(payload);

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

    console.error("Failed to search public availability", error);
    return NextResponse.json(
      { message: "Unable to check availability right now." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
