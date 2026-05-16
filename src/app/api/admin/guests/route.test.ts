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
const getGuestsPageMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/server/guests", () => ({
  getGuestsPage: getGuestsPageMock,
}));

import { GET } from "./route";

describe("admin guests API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires guest access and returns a bounded guest page without shared caching", async () => {
    getGuestsPageMock.mockResolvedValue({
      data: [
        {
          id: "guest-1",
          firstName: "Asha",
          lastName: "Guest",
          email: "asha@example.com",
          phone: "9999999999",
        },
      ],
      nextOffset: 75,
      count: 100,
    });

    const response = await GET(
      new Request(
        "http://localhost/api/admin/guests?limit=25&offset=50&query=asha",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(authMocks.requireFeature).toHaveBeenCalledWith(
      expect.any(Request),
      "guests",
    );
    expect(getGuestsPageMock).toHaveBeenCalledWith({
      limit: 25,
      offset: 50,
      query: "asha",
    });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: [
        {
          id: "guest-1",
          firstName: "Asha",
          lastName: "Guest",
          email: "asha@example.com",
          phone: "9999999999",
        },
      ],
      nextOffset: 75,
      count: 100,
    });
  });

  it("rejects non-numeric pagination params before querying guests", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/guests?limit=abc") as never,
    );

    expect(response.status).toBe(400);
    expect(getGuestsPageMock).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});
