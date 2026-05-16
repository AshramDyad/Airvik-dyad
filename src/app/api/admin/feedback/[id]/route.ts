import { NextResponse } from "next/server";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Feedback } from "@/data/types";
import { getServerSupabaseClient } from "@/lib/server/supabase";
import { HttpError, requireFeature } from "@/lib/server/auth";
import { logAdminActivityFromProfile } from "@/lib/activity/server";
import { ADMIN_FEEDBACK_PATCH_RETURN_COLUMNS } from "../columns";

const feedbackStatusValues = ["new", "in_review", "resolved"] as const;

type FeedbackTableRow = {
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

type FeedbackTableInsert = {
  id?: string;
  feedback_type: FeedbackTableRow["feedback_type"];
  message: string;
  name?: string | null;
  is_anonymous?: boolean;
  email?: string | null;
  room_or_facility?: string | null;
  rating?: number | null;
  status?: FeedbackTableRow["status"];
  internal_note?: string | null;
  created_at?: string;
  updated_at?: string;
};

type FeedbackTableUpdate = Partial<FeedbackTableRow>;

type FeedbackPatchReturnRow = Pick<
  FeedbackTableRow,
  "id" | "name" | "email" | "status" | "internal_note" | "updated_at"
>;

type FeedbackSchema = {
  public: {
    Tables: {
      feedback: {
        Row: FeedbackTableRow;
        Insert: FeedbackTableInsert;
        Update: FeedbackTableUpdate;
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const UpdateSchema = z.object({
  status: z.enum(feedbackStatusValues).optional(),
  internalNote: z
    .string()
    .trim()
    .max(1000, "Note must be 1000 characters or fewer")
    .optional()
    .or(z.literal(""))
    .nullable(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireFeature(request, "feedbackManage");
    const body = await request.json();
    const payload = UpdateSchema.parse(body);
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ message: "Missing feedback id" }, { status: 400 });
    }

    const updates: FeedbackTableUpdate = {
      updated_at: new Date().toISOString(),
    };

    if (payload.status) {
      updates.status = payload.status;
    }

    if (typeof payload.internalNote !== "undefined") {
      updates.internal_note = payload.internalNote && payload.internalNote.length > 0 ? payload.internalNote : null;
    }

    if (Object.keys(updates).length === 1) {
      return NextResponse.json({ message: "Nothing to update" }, { status: 400 });
    }

    const supabase = await getServerSupabaseClient();
    const feedbackClient = supabase as unknown as SupabaseClient<FeedbackSchema>;
    const { data, error } = await feedbackClient
      .from("feedback")
      .update(updates)
      .eq("id", id)
      .select(ADMIN_FEEDBACK_PATCH_RETURN_COLUMNS)
      .maybeSingle();

    if (error) {
      console.error("Failed to update feedback", error);
      return NextResponse.json(
        { message: "Unable to update feedback." },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ message: "Feedback not found" }, { status: 404 });
    }

    const compact = mapFeedbackPatchReturn(data as FeedbackPatchReturnRow);

    await logAdminActivityFromProfile({
      profile,
      entry: {
        section: "feedback",
        entityType: "feedback",
        entityId: compact.id,
        entityLabel: compact.name ?? compact.email ?? compact.id,
        action: "feedback_updated",
        details: payload.status
          ? `Updated feedback status to ${payload.status}`
          : "Updated feedback metadata",
        metadata: {
          status: compact.status,
          hasInternalNote: Boolean(
            typeof payload.internalNote === "string" && payload.internalNote.length > 0
          ),
        },
      },
    });

    return NextResponse.json({
      data: {
        id: compact.id,
        status: compact.status,
        internalNote: compact.internalNote,
        updatedAt: compact.updatedAt,
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid payload", issues: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    console.error("Unexpected feedback update error", error);
    return NextResponse.json(
      { message: "Unexpected error while updating feedback." },
      { status: 500 }
    );
  }
}

function mapFeedbackPatchReturn(row: FeedbackPatchReturnRow) {
  return {
    id: row.id,
    name: row.name ?? undefined,
    email: row.email ?? undefined,
    status: row.status,
    internalNote: row.internal_note ?? undefined,
    updatedAt: row.updated_at,
  };
}
