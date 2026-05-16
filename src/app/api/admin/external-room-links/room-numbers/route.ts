import { NextResponse } from "next/server";
import { z } from "zod";

import { createServerSupabaseClient } from "@/integrations/supabase/server";
import {
  fetchRoomNumberLinks,
  upsertRoomNumberLink,
} from "@/lib/importers/vikbooking/room-number-links";
import { VIKBOOKING_SOURCE } from "@/lib/importers/vikbooking/constants";
import { requireAdminProfile, HttpError } from "@/lib/server/auth";

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const CreateSchema = z.object({
  source: z.string().min(1).default(VIKBOOKING_SOURCE),
  externalNumber: z.string().min(1),
  roomId: z.string().uuid(),
});

export async function GET(request: Request) {
  try {
    await requireAdminProfile(request);
    const supabase = createServerSupabaseClient();
    const url = new URL(request.url);
    const source = url.searchParams.get("source") ?? VIKBOOKING_SOURCE;
    const links = await fetchRoomNumberLinks(supabase, source);
    return NextResponse.json({ links }, { headers: cacheHeaders });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status, headers: cacheHeaders }
      );
    }
    console.error("Failed to load room number links", error);
    return NextResponse.json(
      { message: "Unable to load room number links" },
      { status: 500, headers: cacheHeaders }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminProfile(request);
    const supabase = createServerSupabaseClient();
    const body = await request.json();
    const payload = CreateSchema.parse(body);
    await upsertRoomNumberLink(supabase, payload);
    return new Response(null, { status: 204, headers: cacheHeaders });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status, headers: cacheHeaders }
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid payload", issues: error.flatten().fieldErrors },
        { status: 400, headers: cacheHeaders }
      );
    }
    console.error("Failed to save room number link", error);
    return NextResponse.json(
      { message: "Unable to save room number link" },
      { status: 500, headers: cacheHeaders }
    );
  }
}
