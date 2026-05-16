import { NextResponse } from "next/server";
import { z } from "zod";

import { MAX_FEEDBACK_LENGTH, ROOM_OR_FACILITY_OPTIONS } from "@/constants/feedback";
import { createServerSupabaseClient } from "@/integrations/supabase/server";

const feedbackTypeValues = ["suggestion", "praise", "complaint", "question"] as const;
const cacheHeaders = {
  "Cache-Control": "private, no-store",
};
const noStoreJson = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, { ...init, headers: cacheHeaders });

const FeedbackPayloadSchema = z.object({
  feedbackType: z.enum(feedbackTypeValues),
  message: z
    .string()
    .trim()
    .min(1, "Feedback is required")
    .max(MAX_FEEDBACK_LENGTH, `Feedback must be ${MAX_FEEDBACK_LENGTH} characters or fewer`),
  name: z
    .string()
    .trim()
    .max(120, "Name must be 120 characters or fewer")
    .optional(),
  submitAsAnonymous: z.boolean().optional().default(false),
  email: z
    .string()
    .trim()
    .email("Please provide a valid email address")
    .max(254)
    .optional()
    .or(z.literal(""))
    .nullable(),
  roomOrFacility: z.enum(ROOM_OR_FACILITY_OPTIONS).optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = FeedbackPayloadSchema.parse(body);

    const supabase = createServerSupabaseClient();
    const { error } = await supabase.from("feedback").insert([
      {
        feedback_type: payload.feedbackType,
        message: payload.message,
        name: payload.submitAsAnonymous ? "Anonymous" : payload.name ?? null,
        is_anonymous: payload.submitAsAnonymous,
        email: payload.email ? payload.email : null,
        room_or_facility: payload.roomOrFacility ?? null,
        rating: payload.rating ?? null,
      },
    ]);

    if (error) {
      console.error("Failed to store feedback", error);
      return noStoreJson(
        { message: "Unable to submit feedback right now." },
        { status: 500 }
      );
    }

    return noStoreJson(
      { message: "Thank you for your feedback! We appreciate your time." },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return noStoreJson(
        { message: "Invalid input", issues: error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    console.error("Unexpected feedback submission error", error);
    return noStoreJson(
      { message: "Unexpected error while submitting feedback." },
      { status: 500 }
    );
  }
}
