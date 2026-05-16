import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const cacheMocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstableCacheCalls: [] as Array<[unknown, unknown, unknown]>,
  unstable_cache: vi.fn((fn, keyParts, options) => {
    cacheMocks.unstableCacheCalls.push([fn, keyParts, options]);
    return fn;
  }),
}));
const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  createSessionClient: vi.fn(),
}));

vi.mock("next/cache", () => cacheMocks);
vi.mock("@/integrations/supabase/server", () => supabaseMocks);

import {
  getHomepageBanner,
  getHomepageModalBanner,
  getUpcomingEvents,
} from "./events";
import {
  EVENT_BANNERS_CACHE_TAG,
  EVENTS_REVALIDATE_SECONDS,
  EVENT_SELECT_COLUMNS,
  PUBLIC_HOMEPAGE_BANNER_SELECT_COLUMNS,
} from "./cache-config";

const activeRow = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "Yoga Camp",
  description: null,
  image_url: "https://example.com/event.jpg",
  is_active: true,
  starts_at: "2026-05-12T00:00:00.000Z",
  ends_at: "2026-05-14T00:00:00.000Z",
  updated_by: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-02T00:00:00.000Z",
};

const publicActiveRow = {
  title: "Yoga Camp",
  description: null,
  image_url: "https://example.com/event.jpg",
  starts_at: "2026-05-12T00:00:00.000Z",
  ends_at: "2026-05-14T00:00:00.000Z",
};

const futureRow = {
  ...activeRow,
  id: "44444444-4444-4444-8444-444444444444",
  is_active: false,
  starts_at: "2026-06-01T00:00:00.000Z",
};

const createEventsQuery = (response: unknown) => {
  const query = {
    from: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(async () => response),
  };
  return query;
};

describe("event server data access", () => {
  beforeEach(() => {
    cacheMocks.revalidatePath.mockClear();
    cacheMocks.revalidateTag.mockClear();
    supabaseMocks.createServerSupabaseClient.mockReset();
    supabaseMocks.createSessionClient.mockReset();
  });

  it("declares a tagged cache policy for event reads", () => {
    expect(EVENT_BANNERS_CACHE_TAG).toBe("event-banners");
    expect(EVENTS_REVALIDATE_SECONDS).toBe(60);
  });

  it("wraps public event reads in tagged Next data caches", () => {
    expect(cacheMocks.unstableCacheCalls).toContainEqual([
      expect.any(Function),
      ["homepage-banner"],
      {
        revalidate: EVENTS_REVALIDATE_SECONDS,
        tags: [EVENT_BANNERS_CACHE_TAG],
      },
    ]);
    expect(cacheMocks.unstableCacheCalls).toContainEqual([
      expect.any(Function),
      ["upcoming-events"],
      {
        revalidate: EVENTS_REVALIDATE_SECONDS,
        tags: [EVENT_BANNERS_CACHE_TAG],
      },
    ]);
  });

  it("selects only event banner fields and returns the active row for the supplied time", async () => {
    const query = createEventsQuery({
      data: [futureRow, activeRow],
      error: null,
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue(query);

    await expect(
      getHomepageBanner(new Date("2026-05-13T00:00:00.000Z"))
    ).resolves.toEqual({
      id: activeRow.id,
      title: activeRow.title,
      description: undefined,
      imageUrl: activeRow.image_url,
      isActive: true,
      startsAt: activeRow.starts_at,
      endsAt: activeRow.ends_at,
      createdAt: activeRow.created_at,
      updatedAt: activeRow.updated_at,
      updatedBy: undefined,
    });

    expect(query.from).toHaveBeenCalledWith("event_banners");
    expect(query.select).toHaveBeenCalledWith(EVENT_SELECT_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(query.order).toHaveBeenCalledWith("updated_at", {
      ascending: false,
    });
    expect(query.limit).toHaveBeenCalledWith(5);
  });

  it("selects only compact homepage modal banner fields for the public API", async () => {
    const query = createEventsQuery({
      data: [publicActiveRow],
      error: null,
    });
    supabaseMocks.createServerSupabaseClient.mockReturnValue(query);

    await expect(
      getHomepageModalBanner(new Date("2026-05-13T00:00:00.000Z")),
    ).resolves.toEqual({
      title: "Yoga Camp",
      description: undefined,
      imageUrl: "https://example.com/event.jpg",
    });

    expect(query.from).toHaveBeenCalledWith("event_banners");
    expect(query.select).toHaveBeenCalledWith(
      PUBLIC_HOMEPAGE_BANNER_SELECT_COLUMNS,
    );
    expect(PUBLIC_HOMEPAGE_BANNER_SELECT_COLUMNS).toContain("starts_at");
    expect(PUBLIC_HOMEPAGE_BANNER_SELECT_COLUMNS).toContain("ends_at");
    expect(PUBLIC_HOMEPAGE_BANNER_SELECT_COLUMNS).not.toContain("id");
    expect(PUBLIC_HOMEPAGE_BANNER_SELECT_COLUMNS).not.toContain("is_active");
    expect(PUBLIC_HOMEPAGE_BANNER_SELECT_COLUMNS).not.toContain("created_at");
    expect(PUBLIC_HOMEPAGE_BANNER_SELECT_COLUMNS).not.toContain("updated_by");
    expect(query.eq).toHaveBeenCalledWith("is_active", true);
    expect(query.order).toHaveBeenCalledWith("updated_at", {
      ascending: false,
    });
    expect(query.limit).toHaveBeenCalledWith(5);
  });

  it("selects only event banner fields and reads upcoming events by minute bucket", async () => {
    const query = {
      from: vi.fn(() => query),
      select: vi.fn(() => query),
      gt: vi.fn(() => query),
      eq: vi.fn(() => query),
      order: vi.fn(async () => ({
        data: [futureRow],
        error: null,
      })),
    };
    supabaseMocks.createServerSupabaseClient.mockReturnValue(query);

    await expect(
      getUpcomingEvents(new Date("2026-05-13T12:34:56.000Z")),
    ).resolves.toEqual([
      {
        id: futureRow.id,
        title: futureRow.title,
        description: undefined,
        imageUrl: futureRow.image_url,
        isActive: false,
        startsAt: futureRow.starts_at,
        endsAt: futureRow.ends_at,
        createdAt: futureRow.created_at,
        updatedAt: futureRow.updated_at,
        updatedBy: undefined,
      },
    ]);

    expect(query.from).toHaveBeenCalledWith("event_banners");
    expect(query.select).toHaveBeenCalledWith(EVENT_SELECT_COLUMNS);
    expect(query.gt).toHaveBeenCalledWith("starts_at", "2026-05-13T12:34:00.000Z");
    expect(query.eq).toHaveBeenCalledWith("is_active", false);
    expect(query.order).toHaveBeenCalledWith("starts_at", {
      ascending: true,
    });
  });
});
