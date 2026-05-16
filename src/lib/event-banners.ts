import { z } from "zod";
import type { EventBanner } from "@/data/types";

export const eventBannerRowSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  image_url: z.string(),
  is_active: z.boolean(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  updated_by: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type EventBannerRow = z.infer<typeof eventBannerRowSchema>;

export const publicHomepageBannerRowSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  image_url: z.string(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
});

export type PublicHomepageBannerRow = z.infer<
  typeof publicHomepageBannerRowSchema
>;
export type PublicHomepageBanner = {
  title: string;
  description?: string;
  imageUrl: string;
};
type PublicHomepageBannerCandidate = PublicHomepageBanner & {
  startsAt?: string;
  endsAt?: string;
};

export function mapEventBannerRow(row: EventBannerRow): EventBanner {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    imageUrl: row.image_url,
    isActive: row.is_active,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by ?? undefined,
  };
}

export function mapPublicHomepageBannerRow(
  row: PublicHomepageBannerRow,
): PublicHomepageBannerCandidate {
  return {
    title: row.title,
    description: row.description ?? undefined,
    imageUrl: row.image_url,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
  };
}

export function toPublicHomepageBanner(
  banner: PublicHomepageBannerCandidate,
): PublicHomepageBanner {
  return {
    title: banner.title,
    description: banner.description,
    imageUrl: banner.imageUrl,
  };
}

export function isEventBannerActive(banner: EventBanner, now: Date = new Date()): boolean {
  if (!banner.isActive) return false;

  const startsAt = banner.startsAt ? new Date(banner.startsAt) : null;
  const endsAt = banner.endsAt ? new Date(banner.endsAt) : null;
  const nowTime = now.getTime();

  if (
    (banner.startsAt && Number.isNaN(startsAt?.getTime() ?? NaN)) ||
    (banner.endsAt && Number.isNaN(endsAt?.getTime() ?? NaN))
  ) {
    return banner.isActive;
  }

  const startsOk = !startsAt || startsAt.getTime() <= nowTime;
  const endsOk = !endsAt || endsAt.getTime() >= nowTime;

  return startsOk && endsOk;
}

export function isPublicHomepageBannerActive(
  banner: PublicHomepageBannerCandidate,
  now: Date = new Date(),
): boolean {
  const startsAt = banner.startsAt ? new Date(banner.startsAt) : null;
  const endsAt = banner.endsAt ? new Date(banner.endsAt) : null;
  const nowTime = now.getTime();

  if (
    (banner.startsAt && Number.isNaN(startsAt?.getTime() ?? NaN)) ||
    (banner.endsAt && Number.isNaN(endsAt?.getTime() ?? NaN))
  ) {
    return true;
  }

  const startsOk = !startsAt || startsAt.getTime() <= nowTime;
  const endsOk = !endsAt || endsAt.getTime() >= nowTime;

  return startsOk && endsOk;
}
