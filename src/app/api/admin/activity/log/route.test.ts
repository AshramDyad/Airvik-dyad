import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireAdminProfile: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
}));
const logAdminActivityFromProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/activity/server", () => ({
  logAdminActivityFromProfile: logAdminActivityFromProfileMock,
}));

import { POST } from "./route";

describe("admin activity log API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs activity commands with private no-store responses", async () => {
    const profile = { userId: "user-1", roleName: "admin" };
    authMocks.requireAdminProfile.mockResolvedValue(profile);

    const response = await POST(
      new Request("https://airvik.test/api/admin/activity/log", {
        method: "POST",
        body: JSON.stringify({
          section: "reservations",
          action: "status_changed",
          entityType: "reservation",
          entityId: "reservation-1",
          entityLabel: "BK-1",
          details: "Checked in",
          amountMinor: 123.9,
          metadata: { source: "route-test" },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(logAdminActivityFromProfileMock).toHaveBeenCalledWith({
      profile,
      entry: {
        section: "reservations",
        action: "status_changed",
        entityType: "reservation",
        entityId: "reservation-1",
        entityLabel: "BK-1",
        details: "Checked in",
        amountMinor: 123,
        metadata: { source: "route-test" },
      },
    });
  });
});
