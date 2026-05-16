import { beforeEach, describe, expect, it, vi } from "vitest";

const getAdminReservationFormDataMock = vi.hoisted(() => vi.fn());
const requireAdminProfileMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/admin-reservation-form-data", () => ({
  getAdminReservationFormData: getAdminReservationFormDataMock,
}));

vi.mock("@/lib/server/auth", () => ({
  HttpError: class HttpError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  },
  requireAdminProfile: requireAdminProfileMock,
}));

import { GET } from "./route";

describe("admin reservation form data API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns compact reservation form reference data with no-store headers", async () => {
    getAdminReservationFormDataMock.mockResolvedValue({
      rooms: [
        {
          id: "room-1",
          roomNumber: "101",
          roomTypeId: "type-1",
          status: "Clean",
        },
      ],
      roomTypes: [
        {
          id: "type-1",
          name: "Ganga View",
          description: "",
          maxOccupancy: 3,
          bedTypes: ["Queen"],
          price: 2400,
          amenities: [],
          photos: [],
          isVisible: true,
        },
      ],
      ratePlans: [
        {
          id: "rate-plan-1",
          name: "Standard Rate",
          price: 2400,
          rules: { minStay: 1, cancellationPolicy: "" },
        },
      ],
      seasonalPrices: [],
    });

    const response = await GET(
      new Request("https://airvik.test/api/admin/reservations/form-data"),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    await expect(response.json()).resolves.toEqual({
      data: {
        rooms: [
          {
            id: "room-1",
            roomNumber: "101",
            roomTypeId: "type-1",
            status: "Clean",
          },
        ],
        roomTypes: [
          {
            id: "type-1",
            name: "Ganga View",
            description: "",
            maxOccupancy: 3,
            bedTypes: ["Queen"],
            price: 2400,
            amenities: [],
            photos: [],
            isVisible: true,
          },
        ],
        ratePlans: [
          {
            id: "rate-plan-1",
            name: "Standard Rate",
            price: 2400,
            rules: { minStay: 1, cancellationPolicy: "" },
          },
        ],
        seasonalPrices: [],
      },
    });
    expect(requireAdminProfileMock).toHaveBeenCalledTimes(1);
    expect(getAdminReservationFormDataMock).toHaveBeenCalledTimes(1);
  });
});
