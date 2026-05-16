import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  HttpError: class HttpError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

const supabaseMocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/integrations/supabase/server", () => supabaseMocks);

import { ROLE_NAMES } from "@/constants/roles";
import { HOUSEKEEPER_PROFILE_SELECT_COLUMNS } from "./columns";
import { GET } from "./route";

const createQuery = (response: unknown) => {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => Promise.resolve(response)),
  };
  return query;
};

describe("admin housekeepers API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only minimal housekeeper profile fields", async () => {
    const query = createQuery({
      data: [
        {
          id: "user-1",
          name: "Asha",
          role_id: "role-housekeeper",
          roles: { name: ROLE_NAMES.HOUSEKEEPER },
        },
      ],
      error: null,
    });
    const supabase = { from: vi.fn(() => query) };
    supabaseMocks.createServerSupabaseClient.mockReturnValue(supabase);
    const request = new Request("http://localhost/api/admin/housekeepers");

    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(authMocks.requireFeature).toHaveBeenCalledWith(
      request,
      "housekeeping",
    );
    expect(supabase.from).toHaveBeenCalledWith("profiles");
    expect(query.select).toHaveBeenCalledWith(HOUSEKEEPER_PROFILE_SELECT_COLUMNS);
    expect(query.eq).toHaveBeenCalledWith("roles.name", ROLE_NAMES.HOUSEKEEPER);
    expect(query.order).toHaveBeenCalledWith("name", { ascending: true });
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: "user-1",
          name: "Asha",
          email: "",
          roleId: "role-housekeeper",
        },
      ],
    });
  });
});
