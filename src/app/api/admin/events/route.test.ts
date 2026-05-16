import { beforeEach, describe, expect, it, vi } from "vitest";

const createSessionClientMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createSessionClient: createSessionClientMock,
}));

import { POST } from "./route";
import { EVENT_CREATE_RETURN_COLUMNS } from "@/lib/server/cache-config";

const eventGeneratedRow = {
  id: "event-1",
  created_at: "2026-05-14T00:00:00.000Z",
  updated_at: "2026-05-14T00:00:00.000Z",
};

const eventRow = {
  ...eventGeneratedRow,
  title: "Satsang",
  description: "Evening satsang",
  image_url: "https://cdn.test/event.jpg",
  is_active: false,
  starts_at: null,
  ends_at: null,
  updated_by: "user-1",
};

const createInsertQuery = (response: unknown) => {
  const query = {
    insert: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(async () => response),
  };
  return query;
};

describe("admin events API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates event banners with exact columns and no-store responses", async () => {
    const query = createInsertQuery({ data: eventGeneratedRow, error: null });
    const rpc = vi.fn(async () => ({ error: null }));
    const getUser = vi.fn(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    }));
    const supabase = {
      auth: { getUser },
      from: vi.fn(() => query),
      rpc,
    };
    createSessionClientMock.mockResolvedValue(supabase);

    const response = await POST(
      new Request("https://airvik.test/api/admin/events", {
        method: "POST",
        body: JSON.stringify({
          title: "Satsang",
          description: "Evening satsang",
          imageUrl: "https://cdn.test/event.jpg",
          isActive: true,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(supabase.from).toHaveBeenCalledWith("event_banners");
    expect(query.insert).toHaveBeenCalledWith({
      title: "Satsang",
      description: "Evening satsang",
      image_url: "https://cdn.test/event.jpg",
      is_active: false,
      starts_at: null,
      ends_at: null,
      updated_by: "user-1",
    });
    expect(query.select).toHaveBeenCalledWith(EVENT_CREATE_RETURN_COLUMNS);
    expect(query.single).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("toggle_event_banner", {
      target_event_id: "event-1",
      new_status: true,
    });
    await expect(response.json()).resolves.toEqual({ data: eventRow });
  });
});
