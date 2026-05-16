import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));
const getGuestProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/server/guest-profile", () => ({
  getGuestProfile: getGuestProfileMock,
}));

import { GET } from "./route";

describe("guest profile API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires guest access and returns one guest profile without shared caching", async () => {
    getGuestProfileMock.mockResolvedValue({
      id: "guest-1",
      firstName: "Asha",
      lastName: "Guest",
      email: "asha@example.com",
      phone: "555",
    });

    const response = await GET(
      new Request("http://localhost/api/admin/guests/guest-1") as never,
      { params: Promise.resolve({ id: "guest-1" }) },
    );

    expect(response.status).toBe(200);
    expect(authMocks.requireFeature).toHaveBeenCalledWith(
      expect.any(Request),
      "guests",
    );
    expect(getGuestProfileMock).toHaveBeenCalledWith("guest-1");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: {
        id: "guest-1",
        firstName: "Asha",
        lastName: "Guest",
        email: "asha@example.com",
        phone: "555",
      },
    });
  });
});
