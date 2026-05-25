import { fireEvent, render, screen } from "@testing-library/react";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDataContext } from "@/context/data-context";
import type { AvailabilityDay, Property, RoomTypeAvailability } from "@/data/types";
import { useMultiMonthAvailability } from "@/hooks/use-monthly-availability";
import {
  buildProperty,
  buildRoom,
  buildRoomType,
  resetBuilderSequences,
} from "@/test/builders";
import { AvailabilityCalendar } from "./availability-calendar";

vi.mock("@/context/data-context", () => ({
  useDataContext: vi.fn(),
}));

vi.mock("@/hooks/use-monthly-availability", () => ({
  formatMonthStart: (value: Date): string => {
    const normalized = new Date(value.getFullYear(), value.getMonth(), 1);
    const year = normalized.getFullYear();
    const month = String(normalized.getMonth() + 1).padStart(2, "0");

    return `${year}-${month}-01`;
  },
  useMultiMonthAvailability: vi.fn(),
}));

type DataContextValue = ReturnType<typeof useDataContext>;
type MultiMonthAvailabilityResult = ReturnType<typeof useMultiMonthAvailability>;

const mockedUseDataContext = vi.mocked(useDataContext);
const mockedUseMultiMonthAvailability = vi.mocked(useMultiMonthAvailability);

const stickyColumnWidth = 224;
const dayColumnWidth = 56;

const originalOffsetLeft = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetLeft"
);
const originalOffsetWidth = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "offsetWidth"
);

function formatMonthStartForTest(value: Date): string {
  const normalized = new Date(value.getFullYear(), value.getMonth(), 1);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}-01`;
}

function buildTestProperty(overrides: Partial<Property> = {}): Property {
  const base = buildProperty();

  return {
    id: base.id,
    name: base.name,
    address: base.address,
    phone: base.phone,
    email: base.email,
    logo_url: base.logo_url,
    photos: base.photos,
    google_maps_url: base.google_maps_url,
    timezone: base.timezone,
    currency: base.currency,
    allowSameDayTurnover: true,
    showPartialDays: true,
    defaultUnitsView: "remaining",
    tax_enabled: false,
    tax_percentage: 0,
    ...overrides,
  };
}

function mockDataContext(overrides: Partial<DataContextValue> = {}) {
  mockedUseDataContext.mockReturnValue({
    property: buildTestProperty(),
    guests: [],
    reservations: [],
    rooms: [],
    roomTypes: [],
    ...overrides,
  } as unknown as DataContextValue);
}

function buildAvailabilityDay(
  date: string,
  overrides: Partial<AvailabilityDay> = {}
): AvailabilityDay {
  return {
    date,
    status: "free",
    unitsTotal: 1,
    bookedCount: 0,
    reservationIds: [],
    hasCheckIn: false,
    hasCheckOut: false,
    isClosed: false,
    roomReservations: {},
    ...overrides,
  };
}

function buildMonthAvailability(monthDate: Date): RoomTypeAvailability[] {
  const roomType = buildRoomType({
    id: "room-type-deluxe",
    name: "Deluxe Suite",
  });
  const room = buildRoom({
    id: "room-101",
    roomNumber: "101",
    roomTypeId: roomType.id,
  });
  const monthStart = startOfMonth(monthDate);
  const days = eachDayOfInterval({
    start: monthStart,
    end: endOfMonth(monthStart),
  });

  return [
    {
      roomType: {
        id: roomType.id,
        name: roomType.name,
        description: roomType.description,
        mainPhotoUrl: roomType.mainPhotoUrl,
        price: roomType.price,
        rooms: [{ id: room.id, roomNumber: room.roomNumber }],
        units: 1,
        sharedInventory: false,
      },
      availability: days.map((day) =>
        buildAvailabilityDay(format(day, "yyyy-MM-dd"))
      ),
    },
  ];
}

function mockAvailabilityForRenderedMonth() {
  mockedUseMultiMonthAvailability.mockImplementation(
    (startMonth): MultiMonthAvailabilityResult => {
      const monthKey = formatMonthStartForTest(startMonth);

      return {
        dataByMonth: {
          [monthKey]: buildMonthAvailability(startMonth),
        },
        isLoading: false,
        error: null,
      };
    }
  );
}

function installCalendarLayoutMeasurements() {
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      if (this instanceof HTMLElement) {
        if (this.hasAttribute("data-calendar-sticky-column")) {
          return stickyColumnWidth;
        }
        if (this.hasAttribute("data-calendar-date")) {
          return dayColumnWidth;
        }
      }

      return 0;
    },
  });

  Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
    configurable: true,
    get() {
      if (!(this instanceof HTMLElement)) {
        return 0;
      }

      const calendarDate = this.getAttribute("data-calendar-date");
      if (!calendarDate) {
        return 0;
      }

      const dayOfMonth = Number(calendarDate.slice(8, 10));

      return stickyColumnWidth + (dayOfMonth - 1) * dayColumnWidth;
    },
  });
}

function restoreHTMLElementProperty(
  propertyName: "offsetLeft" | "offsetWidth",
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor) {
    Object.defineProperty(HTMLElement.prototype, propertyName, descriptor);
    return;
  }

  Reflect.deleteProperty(HTMLElement.prototype, propertyName);
}

function expectedScrollLeftForDate(isoDate: string) {
  const dayOfMonth = Number(isoDate.slice(8, 10));

  return Math.max(
    stickyColumnWidth + (dayOfMonth - 1) * dayColumnWidth - stickyColumnWidth,
    0
  );
}

describe("AvailabilityCalendar", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 25, 12));
    resetBuilderSequences();
    installCalendarLayoutMeasurements();
    mockDataContext();
    mockAvailabilityForRenderedMonth();
  });

  afterEach(() => {
    restoreHTMLElementProperty("offsetLeft", originalOffsetLeft);
    restoreHTMLElementProperty("offsetWidth", originalOffsetWidth);
    vi.useRealTimers();
  });

  it("starts the current month at today's column", () => {
    render(<AvailabilityCalendar />);

    const calendarRegion = screen.getByRole("region", {
      name: "Availability grid for May 2026",
    }) as HTMLDivElement;

    expect(calendarRegion.scrollLeft).toBe(
      expectedScrollLeftForDate("2026-05-25")
    );
  });

  it("leaves a month that does not contain today at the beginning", () => {
    render(<AvailabilityCalendar />);

    fireEvent.click(screen.getByLabelText("Next month"));

    const calendarRegion = screen.getByRole("region", {
      name: "Availability grid for June 2026",
    }) as HTMLDivElement;

    expect(calendarRegion.scrollLeft).toBe(0);
  });
});
