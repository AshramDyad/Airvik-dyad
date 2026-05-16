import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  requireFeature: vi.fn(),
  HttpError: class HttpError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
}));
const whatsappMocks = vi.hoisted(() => ({
  sendWhatsAppFile: vi.fn(),
}));

vi.mock("@/lib/server/auth", () => authMocks);
vi.mock("@/lib/whatsapp", () => whatsappMocks);

import { POST } from "./route";

describe("send invoice WhatsApp API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    whatsappMocks.sendWhatsAppFile.mockResolvedValue({ success: true });
  });

  it("sends the uploaded receipt as a command without returning a success body", async () => {
    const formData = new FormData();
    const receipt = new File(["receipt"], "receipt.pdf", {
      type: "application/pdf",
    });
    formData.append("phone", "(941) 110-9999");
    formData.append("file", receipt);

    const response = await POST({
      formData: async () => formData,
    } as Request);

    expect(response.status).toBe(204);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.text()).resolves.toBe("");
    expect(authMocks.requireFeature).toHaveBeenCalledWith(expect.anything(), [
      "reservations",
      "donations",
    ]);
    expect(whatsappMocks.sendWhatsAppFile).toHaveBeenCalledWith(
      "919411109999",
      receipt,
      "Here is your Swaminarayan Ashram Receipt. Thank you!",
    );
  });
});
