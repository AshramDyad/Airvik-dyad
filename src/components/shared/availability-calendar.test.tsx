import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import type { Property, RoomTypeAvailability } from "@/data/types";
import { AvailabilityCalendar } from "./availability-calendar";

const dataContextMock = vi.hoisted(() => ({
  useDataContext: vi.fn(),
}));

const monthlyAvailabilityMock = vi.hoisted(() => {
  const formatMonthStart = (value: Date): string => {
    const normalized = new Date(value.getFullYear(), value.getMonth(), 1);
    const year = normalized.getFullYear();
    const month = String(normalized.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  };

  return {
    formatMonthStart,
    useMultiMonthAvailability: vi.fn(),
  };
});

const reservationDetailsMock = vi.hoisted(() => ({
  useCalendarReservationDetails: vi.fn(),
}));

const fullscreenMock = vi.hoisted(() => ({
  toggleFullscreen: vi.fn(),
  useFullscreen: vi.fn(() => ({
    elementRef: { current: null },
    isFullscreen: false,
    toggleFullscreen: fullscreenMock.toggleFullscreen,
  })),
}));

vi.mock("@/context/data-context", () => ({
  useDataContext: dataContextMock.useDataContext,
}));

vi.mock("@/hooks/use-monthly-availability", () => ({
  formatMonthStart: monthlyAvailabilityMock.formatMonthStart,
  useMultiMonthAvailability: monthlyAvailabilityMock.useMultiMonthAvailability,
}));

vi.mock("@/hooks/use-calendar-reservation-details", () => ({
  useCalendarReservationDetails:
    reservationDetailsMock.useCalendarReservationDetails,
}));

vi.mock("@/hooks/use-fullscreen", () => ({
  useFullscreen: fullscreenMock.useFullscreen,
}));

vi.mock("@/components/shared/reservation-hover-card", () => ({
  ReservationHoverCard: ({ children }: { children: ReactNode }) => children,
}));

const property: Property = {
  id: "property-1",
  name: "Airvik",
  address: "Rishikesh",
  phone: "123",
  email: "stay@example.com",
  logo_url: "",
  photos: [],
  google_maps_url: "",
  timezone: "Asia/Kolkata",
  currency: "INR",
  allowSameDayTurnover: false,
  showPartialDays: true,
  defaultUnitsView: "remaining",
  tax_enabled: false,
  tax_percentage: 0,
};

const isoDate = (value: Date, day: number) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-${String(day).padStart(2, "0")}`;
};

const makeAvailabilityForMonth = (month: Date): RoomTypeAvailability[] => [
  {
    roomType: {
      id: "room-type-1",
      name: "Deluxe Suite",
      description: "River view suite",
      rooms: [
        { id: "room-1", roomNumber: "101" },
        { id: "room-2", roomNumber: "102" },
      ],
      units: 2,
      sharedInventory: false,
    },
    availability: [
      {
        date: isoDate(month, 1),
        status: "partial",
        unitsTotal: 2,
        bookedCount: 1,
        reservationIds: ["reservation-1", "reservation-1"],
        hasCheckIn: true,
        hasCheckOut: false,
        isClosed: false,
        roomReservations: {
          "room-1": {
            reservationId: "reservation-1",
            guestId: "guest-1",
            checkInDate: isoDate(month, 1),
            checkOutDate: isoDate(month, 3),
          },
        },
      },
      {
        date: isoDate(month, 2),
        status: "free",
        unitsTotal: 2,
        bookedCount: 0,
        reservationIds: [],
        hasCheckIn: false,
        hasCheckOut: false,
        isClosed: false,
        roomReservations: {},
      },
      {
        date: isoDate(month, 3),
        status: "closed",
        unitsTotal: 2,
        bookedCount: 0,
        reservationIds: [],
        hasCheckIn: false,
        hasCheckOut: false,
        isClosed: true,
        roomReservations: {},
      },
    ],
  },
];

const buildDataByMonth = (month: Date, monthCount: number) => {
  const dataByMonth: Record<string, RoomTypeAvailability[]> = {};
  for (let index = 0; index < monthCount; index += 1) {
    const monthDate = new Date(month.getFullYear(), month.getMonth() + index, 1);
    dataByMonth[monthlyAvailabilityMock.formatMonthStart(monthDate)] =
      makeAvailabilityForMonth(monthDate);
  }
  return dataByMonth;
};

const renderCalendar = () => render(<AvailabilityCalendar />);

beforeAll(() => {
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
});

const chooseSelectOption = (selectName: string, optionName: string) => {
  fireEvent.pointerDown(screen.getByRole("combobox", { name: selectName }), {
    button: 0,
    ctrlKey: false,
    pointerType: "mouse",
  });
  fireEvent.click(screen.getByRole("option", { name: optionName }));
};

describe("AvailabilityCalendar UI", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 16, 12));
    vi.clearAllMocks();
    dataContextMock.useDataContext.mockReturnValue({ property });
    monthlyAvailabilityMock.useMultiMonthAvailability.mockImplementation(
      (month: Date, monthCount: number) => ({
        dataByMonth: buildDataByMonth(month, monthCount),
        isLoading: false,
        error: null,
      }),
    );
    reservationDetailsMock.useCalendarReservationDetails.mockReturnValue({
      detailsById: new Map([
        [
          "reservation-1",
          {
            id: "reservation-1",
            bookingId: "BK-1",
            guestId: "guest-1",
            roomId: "room-1",
            roomNumber: "101",
            roomTypeName: "Deluxe Suite",
            checkInDate: "2026-05-01",
            checkOutDate: "2026-05-03",
            status: "Confirmed",
            bookingDate: "2026-04-20T00:00:00.000Z",
            adultCount: 2,
            childCount: 0,
            numberOfGuests: 2,
            guestSnapshot: {
              firstName: "Nirav",
              lastName: "Patel",
              email: "nirav@example.com",
              phone: "+91 9999999999",
            },
          },
        ],
      ]),
      isLoading: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders route-backed availability and fetches bounded reservation details", () => {
    renderCalendar();

    expect(
      screen.getByRole("region", {
        name: "Availability grid for May 2026",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Deluxe Suite")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "1 unit left on May 1, 2026" }),
    ).toBeInTheDocument();
    expect(
      reservationDetailsMock.useCalendarReservationDetails,
    ).toHaveBeenLastCalledWith(["reservation-1"]);
  });

  it("toggles selectable cells and keeps closed cells disabled", () => {
    renderCalendar();

    const freeCell = screen.getByRole("button", {
      name: "2 units left on May 2, 2026",
    });
    const closedCell = screen.getByRole("button", {
      name: "2 units left on May 3, 2026",
    });

    expect(freeCell).not.toHaveClass("outline");
    fireEvent.click(freeCell);
    expect(freeCell).toHaveClass("outline-2");
    fireEvent.click(freeCell);
    expect(freeCell).not.toHaveClass("outline-2");
    expect(closedCell).toBeDisabled();
  });

  it("expands room rows and uses reservation details for guest labels", () => {
    renderCalendar();

    expect(screen.queryByText("Room 101")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));

    expect(screen.getByText("Room 101")).toBeInTheDocument();
    expect(screen.getByText("Room 102")).toBeInTheDocument();
    expect(screen.getByText("Nirav Patel")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse" }));

    expect(screen.queryByText("Room 101")).not.toBeInTheDocument();
  });

  it("navigates months and exposes the fullscreen control", () => {
    renderCalendar();

    fireEvent.click(screen.getByRole("button", { name: "Next month" }));

    expect(
      screen.getByRole("region", {
        name: "Availability grid for June 2026",
      }),
    ).toBeInTheDocument();
    const lastAvailabilityCall =
      monthlyAvailabilityMock.useMultiMonthAvailability.mock.calls.at(-1);
    expect(lastAvailabilityCall).toBeDefined();
    expect(
      monthlyAvailabilityMock.formatMonthStart(
        lastAvailabilityCall?.[0] as Date,
      ),
    ).toBe("2026-06-01");

    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(
      screen.getByRole("region", {
        name: "Availability grid for May 2026",
      }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Enter fullscreen" }));
    expect(fullscreenMock.toggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("selects a month from the month dropdown", () => {
    renderCalendar();

    chooseSelectOption("Select calendar month", "August 2026");

    expect(
      screen.getByRole("region", {
        name: "Availability grid for August 2026",
      }),
    ).toBeInTheDocument();
    const lastAvailabilityCall =
      monthlyAvailabilityMock.useMultiMonthAvailability.mock.calls.at(-1);
    expect(lastAvailabilityCall).toBeDefined();
    expect(
      monthlyAvailabilityMock.formatMonthStart(
        lastAvailabilityCall?.[0] as Date,
      ),
    ).toBe("2026-08-01");
  });

  it("changes visible month count and units view", () => {
    renderCalendar();

    chooseSelectOption("Visible calendar months", "2 Months");

    expect(
      screen.getByRole("region", {
        name: "Availability grid for June 2026",
      }),
    ).toBeInTheDocument();
    expect(
      monthlyAvailabilityMock.useMultiMonthAvailability.mock.calls.at(-1)?.[1],
    ).toBe(2);

    chooseSelectOption("Calendar units view", "Units booked");

    expect(
      screen.getByRole("button", { name: "1 unit booked on May 1, 2026" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "No units booked on May 2, 2026" }),
    ).toBeInTheDocument();
  });

  it("dismisses monthly availability errors without falling back to global reservations", () => {
    const calendarError = new Error("Availability RPC failed");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    monthlyAvailabilityMock.useMultiMonthAvailability.mockReturnValue({
      dataByMonth: {},
      isLoading: false,
      error: calendarError,
    });

    try {
      renderCalendar();

      expect(
        screen.getByText("Unable to load aggregated availability."),
      ).toBeInTheDocument();
      expect(screen.queryByText("Use legacy view")).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));

      expect(
        screen.queryByText("Unable to load aggregated availability."),
      ).not.toBeInTheDocument();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
