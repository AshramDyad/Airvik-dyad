import { beforeEach, describe, expect, it, vi } from "vitest";

import { IMAGE_ASSET_CACHE_CONTROL_SECONDS } from "./storage-config";

const createClientMock = vi.hoisted(() => vi.fn());
const randomUUIDMock = vi.hoisted(() => vi.fn(() => "asset-uuid"));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return {
    ...actual,
    randomUUID: randomUUIDMock,
  };
});

const createStorageClient = ({
  buckets = [{ name: "images" }],
  uploadError = null,
}: {
  buckets?: Array<{ name: string }>;
  uploadError?: Error | null;
} = {}) => {
  const upload = vi.fn(async () => ({ error: uploadError }));
  const getPublicUrl = vi.fn(() => ({
    data: {
      publicUrl: "https://supabase.test/storage/v1/object/public/images/event-banners/asset-uuid.png",
    },
  }));
  const from = vi.fn(() => ({ upload, getPublicUrl }));
  const listBuckets = vi.fn(async () => ({ data: buckets, error: null }));
  const createBucket = vi.fn(async () => ({ error: null }));
  const client = {
    storage: {
      listBuckets,
      createBucket,
      from,
    },
  };

  createClientMock.mockReturnValue(client);

  return {
    client,
    createBucket,
    from,
    getPublicUrl,
    listBuckets,
    upload,
  };
};

const createTestFile = (name: string, type: string): File =>
  ({
    name,
    type,
    arrayBuffer: vi.fn(async () => new TextEncoder().encode("image").buffer),
  }) as unknown as File;

describe("server storage uploads", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    randomUUIDMock.mockReturnValue("asset-uuid");
  });

  it("uploads immutable image assets with a one-year cache-control value", async () => {
    const storage = createStorageClient();
    const { uploadToImagesBucket } = await import("./storage");

    const file = createTestFile("Banner.PNG", "image/png");
    const url = await uploadToImagesBucket(file, { prefix: "event-banners" });

    expect(url).toBe(
      "https://supabase.test/storage/v1/object/public/images/event-banners/asset-uuid.png"
    );
    expect(IMAGE_ASSET_CACHE_CONTROL_SECONDS).toBe("31536000");
    expect(storage.from).toHaveBeenCalledWith("images");
    const [objectPath, uploadedBuffer, uploadOptions] = storage.upload.mock
      .calls[0] as unknown as [
      string,
      Buffer,
      {
        cacheControl: string;
        contentType: string;
        upsert: boolean;
      },
    ];
    expect(objectPath).toMatch(/^event-banners\/.+\.png$/);
    expect(Buffer.isBuffer(uploadedBuffer)).toBe(true);
    expect(uploadOptions).toEqual({
      cacheControl: IMAGE_ASSET_CACHE_CONTROL_SECONDS,
      contentType: "image/png",
      upsert: false,
    });
  });

  it("creates the public images bucket with image limits when it is missing", async () => {
    const storage = createStorageClient({ buckets: [] });
    const { uploadToImagesBucket } = await import("./storage");

    const file = createTestFile("photo.jpg", "image/jpeg");
    await uploadToImagesBucket(file);

    expect(storage.createBucket).toHaveBeenCalledWith("images", {
      public: true,
      allowedMimeTypes: ["image/*"],
      fileSizeLimit: `${5 * 1024 * 1024}`,
    });
  });
});
