import * as React from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDataContext } from "@/context/data-context";
import type { Reservation, RoomTypeAvailability } from "@/data/types";
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
type AvailabilityDay = RoomTypeAvailability["availability"][number];

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

function buildAvailabilityDay(
  overrides: Partial<AvailabilityDay> = {}
): AvailabilityDay {
  return {
    date: "2026-05-20",
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

function buildRowData(
  overrides: Partial<RoomTypeAvailability> = {}
): RoomTypeAvailability {
  const roomType = buildRoomType({
    id: "room-type-deluxe",
    name: "Deluxe Suite",
  });
  const room = buildRoom({
    id: "room-101",
    roomNumber: "101",
    roomTypeId: roomType.id,
  });

  return {
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
    availability: [buildAvailabilityDay()],
    ...overrides,
  };
}

function renderRoomTypeRow(
  props: Partial<React.ComponentProps<typeof RoomTypeRow>> & {
    data: RoomTypeAvailability;
  }
) {
  render(
    <table>
      <tbody>
        <RoomTypeRow
          unitsView="booked"
          showPartialDays
          todayIso="2026-05-25"
          {...props}
        />
      </tbody>
    </table>
  );
}

function ControlledRoomTypeRow(
  props: Omit<
    React.ComponentProps<typeof RoomTypeRow>,
    "activeReservationCardId" | "onActiveReservationCardChange"
  >
) {
  const [activeReservationCardId, setActiveReservationCardId] =
    React.useState<string | null>(null);

  return (
    <RoomTypeRow
      {...props}
      activeReservationCardId={activeReservationCardId}
      onActiveReservationCardChange={setActiveReservationCardId}
    />
  );
}

function renderControlledRoomTypeRow(
  props: Omit<
    React.ComponentProps<typeof RoomTypeRow>,
    "activeReservationCardId" | "onActiveReservationCardChange"
  >
) {
  render(
    <table>
      <tbody>
        <ControlledRoomTypeRow {...props} />
      </tbody>
    </table>
  );
}

function advanceHoverDelay() {
  act(() => {
    vi.advanceTimersByTime(180);
  });
}

describe("RoomTypeRow", () => {
  beforeEach(() => {
    vi.useRealTimers();
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps aggregate busy booked cells disabled without opening reservation details", async () => {
    const user = userEvent.setup();
    const onCellClick = vi.fn();
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
    const rowData = buildRowData({
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
        buildAvailabilityDay({
          status: "busy",
          unitsTotal: 1,
          bookedCount: 1,
          reservationIds: [reservation.id],
        }),
      ],
    });

    mockDataContext({
      reservations: [reservation],
      guests: [guest],
      rooms: [room],
      roomTypes: [roomType],
    });

    renderRoomTypeRow({
      data: rowData,
      onCellClick,
    });

    const bookedCell = screen.getByRole("button", {
      name: "1 unit booked on May 20, 2026",
    });

    expect(bookedCell).toBeDisabled();

    await user.click(bookedCell);

    expect(onCellClick).not.toHaveBeenCalled();
    expect(screen.queryByText("Alex Morgan")).not.toBeInTheDocument();
    expect(screen.queryByText("Booking ID: ABCDEFG")).not.toBeInTheDocument();
    expect(mockedGetReservationById).not.toHaveBeenCalled();
  });

  it("reveals room-number rows when expanded", async () => {
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
    const rowData = buildRowData({
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
    });

    mockDataContext({
      rooms: [room],
      roomTypes: [roomType],
    });

    renderRoomTypeRow({ data: rowData });

    expect(screen.queryByText("Room 101")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Expand" }));

    expect(screen.getByText("Room 101")).toBeInTheDocument();
  });

  it("opens an expanded room reservation pill after the hover delay", () => {
    vi.useFakeTimers();

    const { guest, reservation, room, roomType, rowData } =
      buildReservationRowFixture();

    mockDataContext({
      reservations: [reservation],
      guests: [guest],
      rooms: [room],
      roomTypes: [roomType],
    });

    renderControlledRoomTypeRow({
      data: rowData,
      unitsView: "booked",
      showPartialDays: true,
      todayIso: "2026-05-25",
    });

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));

    const reservationPill = screen.getByRole("button", {
      name: "View booking details for Alex Morgan in Room 101 on May 20, 2026",
    });

    fireEvent.mouseEnter(reservationPill);

    act(() => {
      vi.advanceTimersByTime(179);
    });

    expect(screen.queryByText("Booking ID: ABCDEFG")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(screen.getByText("Booking ID: ABCDEFG")).toBeInTheDocument();
    expect(mockedGetReservationById).not.toHaveBeenCalled();
  });

  it("keeps only one expanded reservation popup open when moving across pills", () => {
    vi.useFakeTimers();

    const roomType = buildRoomType({
      id: "room-type-deluxe",
      name: "Deluxe Suite",
    });
    const firstRoom = buildRoom({
      id: "room-101",
      roomNumber: "101",
      roomTypeId: roomType.id,
    });
    const secondRoom = buildRoom({
      id: "room-102",
      roomNumber: "102",
      roomTypeId: roomType.id,
    });
    const firstGuest = buildGuest({
      id: "guest-alex",
      firstName: "Alex",
      lastName: "Morgan",
    });
    const secondGuest = buildGuest({
      id: "guest-jordan",
      firstName: "Jordan",
      lastName: "Lee",
    });
    const firstReservation = buildReservation({
      id: "reservation-101",
      bookingId: "booking-ABCDEFG",
      guestId: firstGuest.id,
      roomId: firstRoom.id,
      checkInDate: "2026-05-20",
      checkOutDate: "2026-05-22",
      bookingDate: "2026-04-15",
      status: "Confirmed",
    });
    const secondReservation = buildReservation({
      id: "reservation-102",
      bookingId: "booking-HIJKLMN",
      guestId: secondGuest.id,
      roomId: secondRoom.id,
      checkInDate: "2026-05-20",
      checkOutDate: "2026-05-22",
      bookingDate: "2026-04-16",
      status: "Confirmed",
    });
    const rowData = buildRowData({
      roomType: {
        id: roomType.id,
        name: roomType.name,
        description: roomType.description,
        mainPhotoUrl: roomType.mainPhotoUrl,
        price: roomType.price,
        rooms: [
          { id: firstRoom.id, roomNumber: firstRoom.roomNumber },
          { id: secondRoom.id, roomNumber: secondRoom.roomNumber },
        ],
        units: 2,
        sharedInventory: false,
      },
      availability: [
        buildAvailabilityDay({
          status: "busy",
          unitsTotal: 2,
          bookedCount: 2,
          reservationIds: [firstReservation.id, secondReservation.id],
          roomReservations: {
            [firstRoom.id]: {
              reservationId: firstReservation.id,
              guestId: firstGuest.id,
              checkInDate: firstReservation.checkInDate,
              checkOutDate: firstReservation.checkOutDate,
            },
            [secondRoom.id]: {
              reservationId: secondReservation.id,
              guestId: secondGuest.id,
              checkInDate: secondReservation.checkInDate,
              checkOutDate: secondReservation.checkOutDate,
            },
          },
        }),
      ],
    });

    mockDataContext({
      reservations: [firstReservation, secondReservation],
      guests: [firstGuest, secondGuest],
      rooms: [firstRoom, secondRoom],
      roomTypes: [roomType],
    });

    renderControlledRoomTypeRow({
      data: rowData,
      unitsView: "booked",
      showPartialDays: true,
      todayIso: "2026-05-25",
    });

    fireEvent.click(screen.getByRole("button", { name: "Expand" }));

    const firstPill = screen.getByRole("button", {
      name: "View booking details for Alex Morgan in Room 101 on May 20, 2026",
    });
    const secondPill = screen.getByRole("button", {
      name: "View booking details for Jordan Lee in Room 102 on May 20, 2026",
    });

    fireEvent.mouseEnter(firstPill);
    advanceHoverDelay();

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(within(screen.getByRole("dialog")).getByText("Alex Morgan")).toBeInTheDocument();

    fireEvent.mouseLeave(firstPill);
    fireEvent.mouseEnter(secondPill);
    advanceHoverDelay();

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(
      within(screen.getByRole("dialog")).queryByText("Alex Morgan")
    ).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("dialog")).getByText("Jordan Lee")
    ).toBeInTheDocument();
  });
});

function buildReservationRowFixture(): {
  guest: ReturnType<typeof buildGuest>;
  reservation: Reservation;
  room: ReturnType<typeof buildRoom>;
  roomType: ReturnType<typeof buildRoomType>;
  rowData: RoomTypeAvailability;
} {
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
    numberOfGuests: 3,
    adultCount: 2,
    childCount: 1,
    status: "Confirmed",
  });
  const rowData = buildRowData({
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
      buildAvailabilityDay({
        status: "busy",
        unitsTotal: 1,
        bookedCount: 1,
        reservationIds: [reservation.id],
        roomReservations: {
          [room.id]: {
            reservationId: reservation.id,
            guestId: guest.id,
            checkInDate: reservation.checkInDate,
            checkOutDate: reservation.checkOutDate,
          },
        },
      }),
    ],
  });

  return {
    guest,
    reservation,
    room,
    roomType,
    rowData,
  };
}
