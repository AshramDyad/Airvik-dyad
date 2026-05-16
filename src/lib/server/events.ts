"use server";

import "server-only";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { createServerSupabaseClient, createSessionClient } from "@/integrations/supabase/server";
import {
  eventBannerRowSchema,
  isEventBannerActive,
  isPublicHomepageBannerActive,
  mapEventBannerRow,
  mapPublicHomepageBannerRow,
  publicHomepageBannerRowSchema,
  toPublicHomepageBanner,
} from "@/lib/event-banners";
import type { EventBanner } from "@/data/types";
import type { PublicHomepageBanner } from "@/lib/event-banners";
import { z } from "zod";
import {
  EVENT_BANNERS_CACHE_TAG,
  EVENT_CREATE_RETURN_COLUMNS,
  EVENTS_REVALIDATE_SECONDS,
  EVENT_SELECT_COLUMNS,
  PUBLIC_HOMEPAGE_BANNER_SELECT_COLUMNS,
} from "@/lib/server/cache-config";

// --- Data Fetching ---

const mapEventRows = (rows: unknown[] | null): EventBanner[] =>
  (rows ?? [])
    .map((row) => eventBannerRowSchema.safeParse(row))
    .filter((result): result is { success: true; data: z.infer<typeof eventBannerRowSchema> } => result.success)
    .map((result) => mapEventBannerRow(result.data));

const mapPublicHomepageBannerRows = (rows: unknown[] | null) =>
  (rows ?? [])
    .map((row) => publicHomepageBannerRowSchema.safeParse(row))
    .filter(
      (
        result,
      ): result is {
        success: true;
        data: z.infer<typeof publicHomepageBannerRowSchema>;
      } => result.success,
    )
    .map((result) => mapPublicHomepageBannerRow(result.data));

const revalidateEventPaths = () => {
  revalidateTag(EVENT_BANNERS_CACHE_TAG);
  revalidatePath("/admin/events");
  revalidatePath("/events");
  revalidatePath("/");
};

export async function getAllEvents(): Promise<EventBanner[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("event_banners")
    .select(EVENT_SELECT_COLUMNS)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching events:", error);
    throw new Error("Failed to fetch events");
  }

  return mapEventRows(data);
}

export async function getEventById(id: string): Promise<EventBanner | null> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("event_banners")
    .select(EVENT_SELECT_COLUMNS)
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    console.error("Error fetching event:", error);
    throw new Error("Failed to fetch event");
  }

  const parsed = eventBannerRowSchema.parse(data);
  return mapEventBannerRow(parsed);
}

const toMinuteBucket = (date: Date): string => {
  const time = date.getTime();
  if (!Number.isFinite(time)) {
    return new Date().toISOString().slice(0, 16);
  }
  return new Date(Math.floor(time / 60_000) * 60_000).toISOString();
};

async function getHomepageBannerUncached(nowBucket: string): Promise<EventBanner | null> {
  try {
    const supabase = createServerSupabaseClient();
    const now = new Date(nowBucket);
    const { data, error } = await supabase
      .from("event_banners")
      .select(EVENT_SELECT_COLUMNS)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching homepage banner:", error);
      return null;
    }

    return mapEventRows(data).find((banner) => isEventBannerActive(banner, now)) ?? null;
  } catch {
    return null;
  }
}

const homepageBannerCache = unstable_cache(
  async (nowBucket: string) => getHomepageBannerUncached(nowBucket),
  ["homepage-banner"],
  {
    revalidate: EVENTS_REVALIDATE_SECONDS,
    tags: [EVENT_BANNERS_CACHE_TAG],
  }
);

export async function getHomepageBanner(now = new Date()): Promise<EventBanner | null> {
  return homepageBannerCache(toMinuteBucket(now));
}

async function getHomepageModalBannerUncached(
  nowBucket: string,
): Promise<PublicHomepageBanner | null> {
  try {
    const supabase = createServerSupabaseClient();
    const now = new Date(nowBucket);
    const { data, error } = await supabase
      .from("event_banners")
      .select(PUBLIC_HOMEPAGE_BANNER_SELECT_COLUMNS)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching homepage modal banner:", error);
      return null;
    }

    const active = mapPublicHomepageBannerRows(data).find((banner) =>
      isPublicHomepageBannerActive(banner, now),
    );

    return active ? toPublicHomepageBanner(active) : null;
  } catch {
    return null;
  }
}

const homepageModalBannerCache = unstable_cache(
  async (nowBucket: string) => getHomepageModalBannerUncached(nowBucket),
  ["homepage-modal-banner"],
  {
    revalidate: EVENTS_REVALIDATE_SECONDS,
    tags: [EVENT_BANNERS_CACHE_TAG],
  },
);

export async function getHomepageModalBanner(
  now = new Date(),
): Promise<PublicHomepageBanner | null> {
  return homepageModalBannerCache(toMinuteBucket(now));
}

async function getUpcomingEventsUncached(nowBucket: string): Promise<EventBanner[]> {
  try {
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from("event_banners")
      .select(EVENT_SELECT_COLUMNS)
      .gt("starts_at", nowBucket)
      .eq("is_active", false)
      .order("starts_at", { ascending: true });

    if (error) {
      console.error("Error fetching upcoming events:", error);
      return [];
    }

    return mapEventRows(data);
  } catch {
    return [];
  }
}

const upcomingEventsCache = unstable_cache(
  async (nowBucket: string) => getUpcomingEventsUncached(nowBucket),
  ["upcoming-events"],
  {
    revalidate: EVENTS_REVALIDATE_SECONDS,
    tags: [EVENT_BANNERS_CACHE_TAG],
  }
);

export async function getUpcomingEvents(now = new Date()): Promise<EventBanner[]> {
  return upcomingEventsCache(toMinuteBucket(now));
}

// --- Actions ---

const eventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().min(1),
  isActive: z.boolean(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export async function createEvent(rawFormData: z.infer<typeof eventSchema>) {
  const supabase = await createSessionClient();
  const formData = eventSchema.parse(rawFormData);
  const updatedBy = (await supabase.auth.getUser()).data.user?.id ?? null;

  // Prepare DB payload
  const dbPayload = {
    title: formData.title,
    description: formData.description || null,
    image_url: formData.imageUrl,
    is_active: false, // Default to false, user must toggle it explicitly via the specialized RPC or UI
    starts_at: formData.startsAt || null,
    ends_at: formData.endsAt || null,
    updated_by: updatedBy,
  };

  const { data, error } = await supabase
    .from("event_banners")
    .insert(dbPayload)
    .select(EVENT_CREATE_RETURN_COLUMNS)
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to create event");

  // If user wanted it active immediately, we need to call the toggle logic
  if (formData.isActive) {
    await toggleEventBanner(data.id, true);
  }

  revalidateEventPaths();
  return mapEventBannerRow(
    eventBannerRowSchema.parse({
      ...dbPayload,
      id: data.id,
      created_at: data.created_at,
      updated_at: data.updated_at,
    }),
  );
}

export async function updateEvent(id: string, rawFormData: z.infer<typeof eventSchema>) {
  const supabase = await createSessionClient();
  const formData = eventSchema.parse(rawFormData);

  const dbPayload = {
    title: formData.title,
    description: formData.description || null,
    image_url: formData.imageUrl,
    // We don't update is_active here directly to avoid race conditions/inconsistency
    // It's handled by toggle action usually, but if form includes it:
    starts_at: formData.startsAt || null,
    ends_at: formData.endsAt || null,
    updated_by: (await supabase.auth.getUser()).data.user?.id,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("event_banners")
    .update(dbPayload)
    .eq("id", id);

  if (error) throw error;

  // Handle active status separately if it changed
  // Fetch current status to check? Or just enforce?
  // For simplicity, we trust the separate toggle action for status changes in the list view.
  // But if this is from Edit Form, we might need to handle it.
  // Let's assume the Edit Form uses a specific flow. 
  // If the user sets Active in the form, we call the toggle RPC.
  if (formData.isActive !== undefined) {
    await toggleEventBanner(id, formData.isActive);
  }

  revalidateEventPaths();
}

export async function deleteEvent(id: string) {
  const supabase = await createSessionClient();
  const { error } = await supabase.from("event_banners").delete().eq("id", id);
  if (error) throw error;

  revalidateEventPaths();
}

export async function toggleEventBanner(id: string, isActive: boolean) {
  const supabase = await createSessionClient();

  const { error } = await supabase.rpc("toggle_event_banner", {
    target_event_id: id,
    new_status: isActive,
  });

  if (error) throw error;

  revalidateEventPaths();
}
