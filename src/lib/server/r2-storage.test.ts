import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const awsMocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock("@aws-sdk/client-s3", () => {
  class PutObjectCommand {
    constructor(readonly input: Record<string, unknown>) {}
  }

  class S3Client {
    send = awsMocks.send;
  }

  return { PutObjectCommand, S3Client };
});

import { getR2Config, resetR2ClientForTests, uploadImageToR2 } from "./r2-storage";

describe("R2 image storage", () => {
  beforeEach(() => {
    vi.stubEnv("CLOUDFLARE_R2_ACCOUNT_ID", "account-id");
    vi.stubEnv("CLOUDFLARE_R2_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "secret-key");
    vi.stubEnv("CLOUDFLARE_R2_BUCKET_NAME", "airvik-production-images");
    vi.stubEnv(
      "NEXT_PUBLIC_CLOUDFLARE_R2_PUBLIC_URL",
      "https://media-origin.swaminarayan.yoga/",
    );
    awsMocks.send.mockReset().mockResolvedValue({});
    resetR2ClientForTests();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fails clearly when a required secret is missing", () => {
    vi.stubEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY", "");
    expect(() => getR2Config()).toThrow("Missing CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  });

  it("uploads immutable categorized objects and returns the public source URL", async () => {
    const file = {
      name: "room photo.png",
      type: "image/png",
      size: 3,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    } as unknown as File;

    const url = await uploadImageToR2(file, "rooms");

    expect(url).toMatch(
      /^https:\/\/media-origin\.swaminarayan\.yoga\/rooms\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/,
    );
    expect(awsMocks.send).toHaveBeenCalledOnce();
    const command = awsMocks.send.mock.calls[0][0] as { input: Record<string, unknown> };
    expect(command.input).toMatchObject({
      Bucket: "airvik-production-images",
      ContentType: "image/png",
      ContentLength: 3,
      CacheControl: "public, max-age=31536000, immutable",
    });
    expect(command.input.Key).toMatch(/^rooms\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/);
  });
});
