import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendWhatsAppFile } from "./whatsapp";

const originalEnv = {
  GOWA_API_URL: process.env.GOWA_API_URL,
  GOWA_API_USER: process.env.GOWA_API_USER,
  GOWA_API_PASSWORD: process.env.GOWA_API_PASSWORD,
  GOWA_DEVICE_ID: process.env.GOWA_DEVICE_ID,
};

describe("WhatsApp client", () => {
  beforeEach(() => {
    process.env.GOWA_API_URL = "https://gowa.test";
    process.env.GOWA_API_USER = "user";
    process.env.GOWA_API_PASSWORD = "pass";
    process.env.GOWA_DEVICE_ID = "device-1";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(originalEnv)) {
      if (typeof value === "undefined") {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("sends file uploads as uncached command requests", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["receipt"], "receipt.pdf", {
      type: "application/pdf",
    });

    await expect(sendWhatsAppFile("919411109999", file, "Receipt")).resolves.toEqual({
      success: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://gowa.test/send/file",
      expect.objectContaining({
        method: "POST",
        cache: "no-store",
        headers: {
          Authorization: `Basic ${Buffer.from("user:pass").toString("base64")}`,
          "X-Device-Id": "device-1",
        },
        body: expect.any(FormData),
      }),
    );
  });
});
