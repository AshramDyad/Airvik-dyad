import { NextResponse } from "next/server";
import { z } from "zod";

import {
  MAX_FEEDBACK_LENGTH,
  ROOM_OR_FACILITY_OPTIONS,
} from "@/constants/feedback";
import type { Feedback } from "@/data/types";
import { getServerSupabaseClient } from "@/lib/server/supabase";
import { requireFeature, HttpError } from "@/lib/server/auth";
import { ADMIN_FEEDBACK_SELECT_COLUMNS } from "./columns";

const feedbackTypeValues = ["suggestion", "praise", "complaint", "question"] as const;
const feedbackStatusValues = ["new", "in_review", "resolved"] as const;

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  type: z.enum(feedbackTypeValues).optional(),
  status: z.enum(feedbackStatusValues).optional(),
  search: z.string().trim().max(MAX_FEEDBACK_LENGTH).optional(),
  roomOrFacility: z.enum(ROOM_OR_FACILITY_OPTIONS).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

function coerceOptional(param: string | null): string | undefined {
  if (param === null) return undefined;
  return param.length === 0 ? undefined : param;
}

export async function GET(request: Request) {
  try {
    await requireFeature(request, "feedback");
    const { searchParams } = new URL(request.url);
    const parsed = QuerySchema.parse({
      page: searchParams.get("page"),
      pageSize: searchParams.get("pageSize"),
      type: coerceOptional(searchParams.get("type")),
      status: coerceOptional(searchParams.get("status")),
      search: coerceOptional(searchParams.get("search")),
      roomOrFacility: coerceOptional(searchParams.get("roomOrFacility")),
      startDate: coerceOptional(searchParams.get("startDate")),
      endDate: coerceOptional(searchParams.get("endDate")),
    });

    const supabase = await getServerSupabaseClient();
    const start = (parsed.page - 1) * parsed.pageSize;
    const end = start + parsed.pageSize - 1;

    let query = supabase
      .from("feedback")
      .select(ADMIN_FEEDBACK_SELECT_COLUMNS, { count: "exact" })
      .order("created_at", { ascending: false })
      .range(start, end);

    if (parsed.type) {
      query = query.eq("feedback_type", parsed.type);
    }

    if (parsed.status) {
      query = query.eq("status", parsed.status);
    }

    if (parsed.roomOrFacility) {
      query = query.eq("room_or_facility", parsed.roomOrFacility);
    }

    if (parsed.search) {
      const sanitized = parsed.search.replace(/,/g, " ");
      const likeValue = `%${sanitized}%`;
      query = query.or(
        `message.ilike.${likeValue},name.ilike.${likeValue}`
      );
    }

    if (parsed.startDate) {
      const startIso = startOfDayIso(parsed.startDate);
      if (startIso) {
        query = query.gte("created_at", startIso);
      }
    }

    if (parsed.endDate) {
      const endIso = endOfDayIso(parsed.endDate);
      if (endIso) {
        query = query.lte("created_at", endIso);
      }
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("Failed to fetch feedback", error);
      return NextResponse.json(
        { message: "Unable to load feedback." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data: (data ?? []).map(mapFeedbackRow),
      meta: {
        page: parsed.page,
        pageSize: parsed.pageSize,
        total: count ?? 0,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid filters", issues: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    console.error("Unexpected admin feedback fetch error", error);
    return NextResponse.json(
      { message: "Unexpected error while loading feedback." },
      { status: 500 }
    );
  }
}

function startOfDayIso(dateString: string): string | null {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function endOfDayIso(dateString: string): string | null {
  const date = new Date(`${dateString}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

type FeedbackRow = {
  id: string;
  feedback_type: Feedback["feedbackType"];
  message: string;
  name: string | null;
  is_anonymous: boolean;
  email: string | null;
  room_or_facility: string | null;
  rating: number | null;
  status: Feedback["status"];
  internal_note: string | null;
  created_at: string;
  updated_at: string;
};

function mapFeedbackRow(row: FeedbackRow): Feedback {
  return {
    id: row.id,
    feedbackType: row.feedback_type,
    message: row.message,
    name: row.name ?? undefined,
    isAnonymous: row.is_anonymous,
    email: row.email ?? undefined,
    roomOrFacility: row.room_or_facility ?? undefined,
    rating: row.rating ?? undefined,
    status: row.status,
    internalNote: row.internal_note ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
