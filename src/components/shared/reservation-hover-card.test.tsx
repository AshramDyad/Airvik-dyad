import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDataContext } from "@/context/data-context";
import type { Guest, Reservation, Room, RoomType } from "@/data/types";
import { getReservationById, getReservationsByBookingId } from "@/lib/api";
import {
  buildGuest,
  buildReservation,
  buildRoom,
  buildRoomType,
  resetBuilderSequences,
} from "@/test/builders";
import { ReservationHoverCard } from "./reservation-hover-card";

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

function reservationByIdResponse(
  reservation: Reservation | null
): Awaited<ReturnType<typeof getReservationById>> {
  return {
    data: reservation,
    error: null,
    count: null,
    status: 200,
    statusText: "OK",
  };
}

function reservationsByBookingIdResponse(
  reservations: Reservation[]
): Awaited<ReturnType<typeof getReservationsByBookingId>> {
  return {
    data: reservations,
    error: null,
    count: null,
    status: 200,
    statusText: "OK",
  };
}

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function mockDataContext(overrides: Partial<DataContextValue>) {
  mockedUseDataContext.mockReturnValue({
    reservations: [],
    guests: [],
    rooms: [],
    roomTypes: [],
    ...overrides,
  } as unknown as DataContextValue);
}

function buildReservationFixture() {
  const roomType = buildRoomType({
    id: "room-type-deluxe",
    name: "Deluxe Suite",
  });
  const room = buildRoom({
    id: "room-101",
    roomNumber: "101",
    roomTypeId: roomType.id,
  });
  const secondRoom = buildRoom({
    id: "room-102",
    roomNumber: "102",
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
  const siblingReservation = buildReservation({
    id: "reservation-102",
    bookingId: reservation.bookingId,
    guestId: guest.id,
    roomId: secondRoom.id,
    checkInDate: reservation.checkInDate,
    checkOutDate: reservation.checkOutDate,
    bookingDate: reservation.bookingDate,
    numberOfGuests: 2,
    adultCount: 2,
    childCount: 0,
    status: "Confirmed",
  });

  return {
    guest,
    reservation,
    room,
    roomType,
    secondRoom,
    siblingReservation,
  } satisfies {
    guest: Guest;
    reservation: Reservation;
    room: Room;
    roomType: RoomType;
    secondRoom: Room;
    siblingReservation: Reservation;
  };
}

describe("ReservationHoverCard", () => {
  beforeEach(() => {
    vi.useRealTimers();
    resetBuilderSequences();
    mockedGetReservationById.mockResolvedValue(reservationByIdResponse(null));
    mockedGetReservationsByBookingId.mockResolvedValue(
      reservationsByBookingIdResponse([])
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens on click and shows locally available reservation details", async () => {
    const user = userEvent.setup();
    const { guest, reservation, room, roomType } = buildReservationFixture();

    mockDataContext({
      reservations: [reservation],
      guests: [guest],
      rooms: [room],
      roomTypes: [roomType],
    });

    render(
      <ReservationHoverCard
        reservationIds={[reservation.id]}
        date="2026-05-20"
      >
        <button type="button">Open booking details</button>
      </ReservationHoverCard>
    );

    await user.click(
      screen.getByRole("button", { name: "Open booking details" })
    );

    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.getByText("Booking ID: ABCDEFG")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("3 guests (2 adults, 1 child)")).toBeInTheDocument();
    expect(screen.getByText("101")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "View reservation ABCDEFG" })
    ).toHaveAttribute("href", "/admin/reservations/reservation-101");
    expect(mockedGetReservationById).not.toHaveBeenCalled();
  });

  it("does not open from hover and opens from click", async () => {
    const user = userEvent.setup();
    const { guest, reservation, room, roomType } = buildReservationFixture();

    mockDataContext({
      reservations: [reservation],
      guests: [guest],
      rooms: [room],
      roomTypes: [roomType],
    });

    render(
      <ReservationHoverCard
        reservationIds={[reservation.id]}
        date="2026-05-20"
      >
        <button type="button">Hover booking details</button>
      </ReservationHoverCard>
    );

    const trigger = screen.getByRole("button", {
      name: "Hover booking details",
    });

    fireEvent.mouseEnter(trigger);

    expect(screen.queryByText("Alex Morgan")).not.toBeInTheDocument();
    expect(screen.queryByText("Booking ID: ABCDEFG")).not.toBeInTheDocument();

    await user.click(trigger);

    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.getByText("Booking ID: ABCDEFG")).toBeInTheDocument();
    expect(mockedGetReservationById).not.toHaveBeenCalled();
  });

  it("fetches missing reservation details on open and shows linked rooms", async () => {
    const user = userEvent.setup();
    const {
      guest,
      reservation,
      room,
      roomType,
      secondRoom,
      siblingReservation,
    } = buildReservationFixture();

    mockDataContext({
      reservations: [],
      guests: [guest],
      rooms: [room, secondRoom],
      roomTypes: [roomType],
    });
    const reservationRequest = createDeferred<
      Awaited<ReturnType<typeof getReservationById>>
    >();
    mockedGetReservationById.mockReturnValue(reservationRequest.promise);
    mockedGetReservationsByBookingId.mockResolvedValue(
      reservationsByBookingIdResponse([reservation, siblingReservation])
    );

    render(
      <ReservationHoverCard
        reservationIds={[reservation.id]}
        date="2026-05-20"
      >
        <button type="button">Open fetched booking</button>
      </ReservationHoverCard>
    );

    await user.click(
      screen.getByRole("button", { name: "Open fetched booking" })
    );

    expect(
      screen.getByText("Loading reservation details...")
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(
      screen.getByText("Fetching the booking linked to this calendar cell.")
    ).toBeInTheDocument();

    reservationRequest.resolve(reservationByIdResponse(reservation));

    await waitFor(() => {
      expect(mockedGetReservationById).toHaveBeenCalledWith(reservation.id);
    });
    expect(mockedGetReservationsByBookingId).toHaveBeenCalledWith(
      reservation.bookingId
    );
    expect(await screen.findByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.getByText("2 rooms")).toBeInTheDocument();
    expect(screen.getByText("101, 102")).toBeInTheDocument();
  });

  it("keeps the trigger and shows an unavailable state when details cannot load", async () => {
    const user = userEvent.setup();

    mockDataContext({
      reservations: [],
      guests: [],
      rooms: [],
      roomTypes: [],
    });
    mockedGetReservationById.mockResolvedValue(reservationByIdResponse(null));

    render(
      <ReservationHoverCard
        reservationIds={["missing-reservation"]}
        date="2026-05-20"
      >
        <button type="button">Missing booking</button>
      </ReservationHoverCard>
    );

    const trigger = screen.getByRole("button", { name: "Missing booking" });
    await user.click(trigger);

    expect(trigger).toBeInTheDocument();
    expect(
      await screen.findByText("Reservation details unavailable")
    ).toBeInTheDocument();
    expect(mockedGetReservationById).toHaveBeenCalledWith(
      "missing-reservation"
    );
    expect(mockedGetReservationsByBookingId).not.toHaveBeenCalled();
  });
});
