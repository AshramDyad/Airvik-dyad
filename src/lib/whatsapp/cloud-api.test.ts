import { afterEach, describe, expect, it, vi } from "vitest";
import { sendWhatsAppTemplate } from "./cloud-api";

const config = { apiVersion: "v22.0", phoneNumberId: "number-test", accessToken: "token-test", wabaId: "waba-test" };

afterEach(() => { vi.restoreAllMocks(); });

describe("WhatsApp template send", () => {
  it("sends the four values once using the specified number configuration", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ messages: [{ id: "wamid.test" }] }));
    const result = await sendWhatsAppTemplate("9876543210", "booking_confirmation", "en_US", ["Guest", "A123", "10 November 2026", "12 November 2026"], { config });
    expect(result).toEqual({ success: true, messageId: "wamid.test" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v22.0/number-test/messages");
    expect(JSON.parse(String(options?.body))).toEqual({
      messaging_product: "whatsapp", to: "919876543210", type: "template",
      template: { name: "booking_confirmation", language: { code: "en_US" }, components: [{
        type: "body", parameters: ["Guest", "A123", "10 November 2026", "12 November 2026"].map((text) => ({ type: "text", text })),
      }] },
    });
  });

  it("marks a network failure as uncertain and does not repeat the call", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetcher = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("timeout"));
    const result = await sendWhatsAppTemplate("9876543210", "booking_confirmation", "en_US", [], { config });
    expect(result).toEqual(expect.objectContaining({ success: false, unconfirmed: true }));
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("preserves Meta's template error code", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: { code: 132001 } }, { status: 404 }));
    const result = await sendWhatsAppTemplate("9876543210", "booking_confirmation", "en_US", [], { config });
    expect(result).toEqual(expect.objectContaining({ success: false, metaCode: 132001 }));
  });
});
