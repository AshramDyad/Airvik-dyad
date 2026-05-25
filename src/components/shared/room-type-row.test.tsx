import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useDataContext } from "@/context/data-context";
import type { RoomTypeAvailability } from "@/data/types";
import { getReservationById, getReservationsByBookingId } from "@/lib/api";
import {
  buildGuest,
  buildReservation,
  buildRoom,
  buildRoomType,
  resetBuilderSequences,
} from "@/test/builders";
import { RoomTypeRow } from "./room-type-row";

vi.mock("@/context/data-context", () => ({
  useDataContext: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  getReservationById: vi.fn(),
  getReservationsByBookingId: vi.fn(),
}));

type DataContextValue = ReturnType<typeof useDataContext>;

const mockedUseDataContext = vi.mocked(useDataContext);
const mockedGetReservationById = vi.mocked(getReservationById);
const mockedGetReservationsByBookingId = vi.mocked(getReservationsByBookingId);

function mockDataContext(overrides: Partial<DataContextValue>) {
  mockedUseDataContext.mockReturnValue({
    reservations: [],
    guests: [],
    rooms: [],
    roomTypes: [],
    ...overrides,
  } as unknown as DataContextValue);
}

describe("RoomTypeRow", () => {
  beforeEach(() => {
    resetBuilderSequences();
    mockedGetReservationById.mockResolvedValue({
      data: null,
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    });
    mockedGetReservationsByBookingId.mockResolvedValue({
      data: [],
      error: null,
      count: null,
      status: 200,
      statusText: "OK",
    });
  });

  it("keeps fully booked aggregate cells clickable for booking details", async () => {
    const user = userEvent.setup();
    const roomType = buildRoomType({
      id: "room-type-deluxe",
      name: "Deluxe Suite",
    });
    const room = buildRoom({
      id: "room-101",
      roomNumber: "101",
      roomTypeId: roomType.id,
    });
    const guest = buildGuest({
      id: "guest-alex",
      firstName: "Alex",
      lastName: "Morgan",
    });
    const reservation = buildReservation({
      id: "reservation-101",
      bookingId: "booking-ABCDEFG",
      guestId: guest.id,
      roomId: room.id,
      checkInDate: "2026-05-20",
      checkOutDate: "2026-05-22",
      bookingDate: "2026-04-15",
      status: "Confirmed",
    });
    const rowData: RoomTypeAvailability = {
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
      availability: [
        {
          date: "2026-05-20",
          status: "busy",
          unitsTotal: 1,
          bookedCount: 1,
          reservationIds: [reservation.id],
          hasCheckIn: false,
          hasCheckOut: false,
          isClosed: false,
          roomReservations: {},
        },
      ],
    };

    mockDataContext({
      reservations: [reservation],
      guests: [guest],
      rooms: [room],
      roomTypes: [roomType],
    });

    render(
      <table>
        <tbody>
          <RoomTypeRow
            data={rowData}
            unitsView="booked"
            showPartialDays
            todayIso="2026-05-25"
          />
        </tbody>
      </table>
    );

    const bookedCell = screen.getByRole("button", {
      name: "1 unit booked on May 20, 2026",
    });

    expect(bookedCell).toBeEnabled();
    await user.click(bookedCell);

    expect(await screen.findByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.getByText("Booking ID: ABCDEFG")).toBeInTheDocument();
    expect(mockedGetReservationById).not.toHaveBeenCalled();
  });
});
