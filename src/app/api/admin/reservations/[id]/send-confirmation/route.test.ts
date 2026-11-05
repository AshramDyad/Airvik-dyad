import { beforeEach, describe, expect, it, vi } from "vitest";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { logAdminActivityFromProfile } from "@/lib/activity/server";
import { HttpError, requirePermission } from "@/lib/server/auth";
import { sendWhatsAppTemplate } from "@/lib/whatsapp/cloud-api";
import { getEnvNumberConfig } from "@/lib/whatsapp/config";
import { buildDbReservation, buildGuest, buildReservation, resetBuilderSequences } from "@/test/builders";
import { GET, POST } from "./route";

vi.mock("@/integrations/supabase/server", () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock("@/lib/server/auth", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/server/auth")>(), requirePermission: vi.fn(),
}));
vi.mock("@/lib/activity/server", () => ({ logAdminActivityFromProfile: vi.fn() }));
vi.mock("@/lib/whatsapp/config", () => ({ getEnvNumberConfig: vi.fn() }));
vi.mock("@/lib/whatsapp/cloud-api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/whatsapp/cloud-api")>(), sendWhatsAppTemplate: vi.fn(),
}));

const id = "478d783e-354d-479d-a053-f445c382a9b1";
const guestId = "4ac95a34-00b7-437d-a622-033910dd7a25";
const context = { params: Promise.resolve({ id }) };
const token = "a".repeat(64);
let rows: ReturnType<typeof buildDbReservation>[];
let guest: ReturnType<typeof buildGuest>;

function configureDb() {
  const client = {
    from: (table: string) => ({
      select: () => ({
        eq: (column: string) => ({
          maybeSingle: async () => ({ data: table === "guests" ? {
            first_name: guest.firstName, last_name: guest.lastName, phone: guest.phone,
          } : rows.find((row) => row.id === id) ?? null, error: null }),
          range: async () => ({ data: column === "booking_id" ? rows : [], count: rows.length, error: null }),
        }),
      }),
    }),
  };
  vi.mocked(createServerSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof createServerSupabaseClient>);
}

function request(method: "GET" | "POST", payload?: unknown) {
  return new Request(`http://localhost/api/admin/reservations/${id}/send-confirmation`, {
    method, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  });
}

async function previewToken() {
  const response = await GET(request("GET"), context);
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("previewToken" in body) || typeof body.previewToken !== "string") throw new Error("No preview");
  return body.previewToken;
}

describe("manual booking confirmation", () => {
  beforeEach(() => {
    resetBuilderSequences();
    guest = buildGuest({ id: guestId, firstName: "Test", lastName: "Guest", phone: "9876543210" });
    rows = Array.from({ length: 37 }, (_, index) => buildDbReservation(buildReservation({
      id: index === 0 ? id : `478d783e-354d-479d-a053-${String(index).padStart(12, "0")}`,
      guestId, bookingId: "A12345", status: "Confirmed", checkInDate: index === 1 ? "2026-11-09" : "2026-11-10",
      checkOutDate: index === 2 ? "2026-11-13" : "2026-11-12",
    })));
    configureDb();
    vi.mocked(requirePermission).mockResolvedValue({ userId: guestId, roleName: "Receptionist", permissions: ["update:reservation"] });
    vi.mocked(getEnvNumberConfig).mockReturnValue({ apiVersion: "v22.0", phoneNumberId: "test", accessToken: "test", wabaId: null });
    vi.mocked(sendWhatsAppTemplate).mockResolvedValue({ success: true, messageId: "wamid.test" });
    vi.mocked(logAdminActivityFromProfile).mockResolvedValue(undefined);
  });

  it("previews and sends one message with the saved guest and full booking dates", async () => {
    const previewResponse = await GET(request("GET"), context);
    expect(previewResponse.status).toBe(200);
    const preview = await previewResponse.json();
    expect(preview.phone).toBe("+919876543210");
    expect(preview.message).toContain("Check-in: 9 November 2026\nCheck-out: 13 November 2026");
    const response = await POST(request("POST", { consent: true, previewToken: preview.previewToken }), context);
    expect(response.status).toBe(200);
    expect(sendWhatsAppTemplate).toHaveBeenCalledTimes(1);
    expect(sendWhatsAppTemplate).toHaveBeenCalledWith("+919876543210", "booking_confirmation", "en_US", ["Test Guest", "A12345", "9 November 2026", "13 November 2026"], expect.objectContaining({ signal: expect.objectContaining({ aborted: false }) }));
    expect(logAdminActivityFromProfile).toHaveBeenCalledOnce();
  });

  it("rejects missing permission, consent and invalid phone without sending", async () => {
    vi.mocked(requirePermission).mockRejectedValueOnce(new HttpError(403, "Insufficient permissions"));
    expect((await POST(request("POST", { consent: true, previewToken: token }), context)).status).toBe(403);
    expect((await POST(request("POST", { consent: false, previewToken: token }), context)).status).toBe(400);
    guest.phone = "not a phone";
    expect((await GET(request("GET"), context)).status).toBe(409);
    expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  it("rejects unconfirmed rooms and a changed preview", async () => {
    const original = await previewToken();
    guest.phone = "9876543211";
    expect((await POST(request("POST", { consent: true, previewToken: original }), context)).status).toBe(409);
    rows[1].status = "Room Hold";
    expect((await GET(request("GET"), context)).status).toBe(409);
    expect(sendWhatsAppTemplate).not.toHaveBeenCalled();
  });

  it("ignores a cancelled room when choosing the booking dates", async () => {
    rows[36].status = "Cancelled";
    rows[36].check_in_date = "2026-10-01";
    rows[36].check_out_date = "2026-12-01";
    const response = await GET(request("GET"), context);
    const preview = await response.json();
    expect(preview.message).toContain("Check-in: 9 November 2026\nCheck-out: 13 November 2026");
  });

  it("distinguishes Meta rejection from uncertain sending and never fails an accepted send due to logging", async () => {
    const preview = await previewToken();
    vi.mocked(sendWhatsAppTemplate).mockResolvedValueOnce({ success: false, error: "rejected" });
    expect((await POST(request("POST", { consent: true, previewToken: preview }), context)).status).toBe(502);
    vi.mocked(sendWhatsAppTemplate).mockResolvedValueOnce({ success: false, error: "timeout", unconfirmed: true });
    expect((await POST(request("POST", { consent: true, previewToken: preview }), context)).status).toBe(504);
    vi.mocked(sendWhatsAppTemplate).mockResolvedValueOnce({ success: true });
    expect((await POST(request("POST", { consent: true, previewToken: preview }), context)).status).toBe(504);
    vi.mocked(logAdminActivityFromProfile).mockRejectedValueOnce(new Error("unavailable"));
    expect((await POST(request("POST", { consent: true, previewToken: preview }), context)).status).toBe(200);
  });

  it("explains when the confirmation template is not available", async () => {
    const preview = await previewToken();
    vi.mocked(sendWhatsAppTemplate).mockResolvedValueOnce({ success: false, error: "rejected", metaCode: 132001 });
    const response = await POST(request("POST", { consent: true, previewToken: preview }), context);
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: "The booking confirmation template is not approved or available in WhatsApp yet." });
  });
});
