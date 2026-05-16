import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  auth: {
    getSession: vi.fn(),
  },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: supabaseMock,
}));

import { authorizedFetch } from "./client-session";

describe("authorizedFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "access-token",
        },
      },
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defaults authenticated requests to no-store cache mode", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await authorizedFetch("/api/admin/feedback");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/feedback",
      expect.objectContaining({
        cache: "no-store",
        headers: {
          Authorization: "Bearer access-token",
        },
      }),
    );
  });

  it("preserves explicit cache modes", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await authorizedFetch("/api/public/property", {
      cache: "force-cache",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/public/property",
      expect.objectContaining({
        cache: "force-cache",
      }),
    );
  });
});
