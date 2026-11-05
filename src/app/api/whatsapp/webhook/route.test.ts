import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";


const database = vi.hoisted(() => ({ rpc: vi.fn().mockResolvedValue({ error: null }) }));
vi.mock('@/integrations/supabase/server', () => ({ createServerSupabaseClient: () => database }));

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("WhatsApp webhook", () => {
  it("returns the challenge only for the configured verification token", async () => {
    vi.stubEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN", "verify-test");
    const request = (token: string) => new Request(`https://example.test/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=1234`);
    expect(await (await GET(request("verify-test"))).text()).toBe("1234");
    expect((await GET(request("wrong"))).status).toBe(403);
  });

  it("rejects invalid signatures and logs only matching delivery events", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "secret-test");
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "number-test");
    vi.stubEnv("WHATSAPP_WABA_ID", "waba-test");
    const log = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const body = JSON.stringify({ object: "whatsapp_business_account", entry: [{ id: "waba-test", changes: [{
      field: "messages", value: { metadata: { phone_number_id: "number-test" }, statuses: [{ id: "wamid.test", status: "delivered", timestamp: "123" }] },
    }] }] });
    const req = (signature: string) => new Request("https://example.test/api/whatsapp/webhook", { method: "POST", headers: { "x-hub-signature-256": signature }, body });
    expect((await POST(req("sha256=wrong"))).status).toBe(403);
    expect(log).not.toHaveBeenCalled();
    const signature = `sha256=${createHmac("sha256", "secret-test").update(body).digest("hex")}`;
    expect((await POST(req(signature))).status).toBe(200);
    expect(log).toHaveBeenCalledWith("[WhatsAppDelivery]", expect.objectContaining({ messageId: "wamid.test", status: "delivered" }));
  });
});

it('records only signed incoming messages for the configured account', async () => {
  vi.stubEnv('WHATSAPP_APP_SECRET', 'secret-test');
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', 'number-test');
  vi.stubEnv('WHATSAPP_WABA_ID', 'waba-test');
  database.rpc.mockClear();
  const timestamp = String(Math.floor(Date.now() / 1000) - 1);
  const makeRequest = (account: string) => {
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [{ id: account, changes: [{ field: 'messages', value: { metadata: { phone_number_id: 'number-test' }, messages: [{ from: '919999999999', timestamp }] } }] }] });
    return new Request('https://example.test/api/whatsapp/webhook', { method: 'POST', body, headers: { 'x-hub-signature-256': `sha256=${createHmac('sha256', 'secret-test').update(body).digest('hex')}` } });
  };
  expect((await POST(makeRequest('wrong-account'))).status).toBe(200);
  expect(database.rpc).not.toHaveBeenCalled();
  expect((await POST(makeRequest('waba-test'))).status).toBe(200);
  expect(database.rpc).toHaveBeenCalledWith('record_whatsapp_inbound', { p_phone: 'number-test', p_sender: '919999999999', p_at: new Date(Number(timestamp) * 1000).toISOString() });
});
