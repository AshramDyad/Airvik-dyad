import { beforeEach, describe, expect, it, vi } from "vitest";

const createSessionClientMock = vi.hoisted(() => vi.fn());
const getServerProfileMock = vi.hoisted(() => vi.fn());
const uploadToImagesBucketMock = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/server", () => ({
  createSessionClient: createSessionClientMock,
}));

vi.mock("@/lib/server/page-auth", () => ({
  getServerProfile: getServerProfileMock,
}));

vi.mock("@/lib/server/storage", () => ({
  uploadToImagesBucket: uploadToImagesBucketMock,
}));

import { POST } from "./route";

describe("admin uploads API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads event banner images with private no-store responses", async () => {
    const getUser = vi.fn(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    }));
    createSessionClientMock.mockResolvedValue({
      auth: { getUser },
    });
    getServerProfileMock.mockResolvedValue({
      permissions: ["update:setting"],
    });
    uploadToImagesBucketMock.mockResolvedValue("https://cdn.test/banner.jpg");

    const formData = new FormData();
    formData.append("file", new File(["image"], "banner.jpg", { type: "image/jpeg" }));

    const response = await POST({
      formData: vi.fn(async () => formData),
    } as unknown as Request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      url: "https://cdn.test/banner.jpg",
    });
    expect(uploadToImagesBucketMock).toHaveBeenCalledWith(expect.any(File), {
      prefix: "event-banners",
    });
  });
});
