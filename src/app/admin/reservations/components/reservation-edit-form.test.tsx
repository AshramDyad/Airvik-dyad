import { cleanup, fireEvent, render, screen, waitFor, within, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { useDataContext } from "@/context/data-context";
import { BookingEditError, createReservationEditSnapshot, type BookingEditInput, type BookingEditResult } from "@/lib/reservations/booking-edit";
import { buildGuest, buildProperty, buildRatePlan, buildReservation, buildRoom, buildRoomType, resetBuilderSequences } from "@/test/builders";
import type { ReservationWithDetails } from "./columns";
import { ReservationEditForm } from "./reservation-edit-form";

vi.mock("@/context/data-context", () => ({ useDataContext: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const save = vi.fn<(reservationId: string, input: BookingEditInput) => Promise<BookingEditResult>>();
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function fixture() {
  const guest = buildGuest({ id: uuid(1) });
  const rate = buildRatePlan({ id: uuid(2), name: "Standard Rate", price: 100 });
  const big = buildRoomType({ id: uuid(3), maxOccupancy: 3, price: 100 });
  const small = buildRoomType({ id: uuid(4), maxOccupancy: 2, price: 100 });
  const rooms = Array.from({ length: 38 }, (_, index) => buildRoom({ id: uuid(100 + index), roomTypeId: index < 16 || index === 37 ? big.id : small.id, roomNumber: index === 0 ? "206" : index === 37 ? "210" : String(300 + index) }));
  const reservations = rooms.slice(0, 37).map((room, index) => buildReservation({ id: uuid(200 + index), bookingId: "A9469", guestId: guest.id, roomId: room.id, ratePlanId: rate.id, checkInDate: "2026-10-01", checkOutDate: "2026-10-03", totalAmount: 200, adultCount: index < 16 ? 3 : 2, childCount: 0, numberOfGuests: index < 16 ? 3 : 2, notes: undefined, folio: [] }));
  const reservation: ReservationWithDetails = { ...reservations[0], guestName: `${guest.firstName} ${guest.lastName}`, roomNumber: "206", nights: 2 };
  const context = { saveBookingEdit: save, reservations, activeBookingReservations: reservations, rooms, roomTypes: [big, small], guests: [guest], ratePlans: [rate], seasonalPrices: [], property: buildProperty() } as unknown as ReturnType<typeof useDataContext>;
  vi.mocked(useDataContext).mockReturnValue(context);
  return { reservation, reservations, context, rooms };
}

describe("main booking edit form", () => {
  beforeEach(() => { resetBuilderSequences(); vi.clearAllMocks(); save.mockReset(); });
  afterEach(cleanup);

  it("replaces 206 with 210 for a 37-room/90-guest booking through exactly one save", async () => {
    const f = fixture(); const onSuccess = vi.fn();
    save.mockResolvedValueOnce({ bookingId: "A9469", reservations: f.reservations });
    render(<ReservationEditForm reservation={f.reservation} onSuccess={onSuccess} />);
    const roomCheckbox = (number: string) => {
      const label = screen.getByText(`Room ${number}`, { selector: "span" }).closest("label");
      if (!label) throw new Error("Room selection label missing");
      return within(label).getByRole("checkbox");
    };
    fireEvent.click(roomCheckbox("206")); fireEvent.click(roomCheckbox("210"));
    const button = screen.getByRole("button", { name: "Save Changes & Update Invoice" });
    await waitFor(() => expect(button).toBeEnabled());
    fireEvent.click(button);
    await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
    expect(save).toHaveBeenCalledOnce();
    const input = save.mock.calls[0][1];
    expect(input.roomIds).toHaveLength(37); expect(input.adultCount).toBe(90); expect(input.childCount).toBe(0);
    expect(input.roomIds).not.toContain(f.rooms[0].id); expect(input.roomIds).toContain(f.rooms[37].id);
    expect(input.expectedReservations).toEqual(createReservationEditSnapshot(f.reservations));
    expect(toast.success).toHaveBeenCalledOnce();
  });

  it("preserves draft values and the ORIGINAL snapshot when background booking data changes", async () => {
    const f = fixture(); save.mockRejectedValueOnce(new BookingEditError("This booking changed. Reload it before saving.", 409, "PT409"));
    const { rerender } = render(<ReservationEditForm reservation={f.reservation} />);
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "My unsaved notes" } });
    const newer = f.reservations.map((row) => buildReservation({ ...row, notes: "Another staff edit" }));
    vi.mocked(useDataContext).mockReturnValue({ ...f.context, reservations: newer, activeBookingReservations: newer });
    rerender(<ReservationEditForm reservation={{ ...f.reservation, notes: "Another staff edit" }} />);
    expect(screen.getByLabelText("Notes")).toHaveValue("My unsaved notes");
    const button = screen.getByRole("button", { name: "Save Changes & Update Invoice" });
    await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(save.mock.calls[0][1].expectedReservations).toEqual(createReservationEditSnapshot(f.reservations));
    expect(save.mock.calls[0][1].notes).toBe("My unsaved notes");
    expect(screen.getByLabelText("Notes")).toHaveValue("My unsaved notes"); expect(toast.success).not.toHaveBeenCalled();
  });

  it("blocks duplicate submissions and shows success only after confirmation", async () => {
    const f = fixture(); let confirm: (result: BookingEditResult) => void = () => {};
    save.mockImplementationOnce(() => new Promise((resolve) => { confirm = resolve; }));
    render(<ReservationEditForm reservation={f.reservation} />);
    const button = screen.getByRole("button", { name: "Save Changes & Update Invoice" });
    await waitFor(() => expect(button).toBeEnabled());
    const form = button.closest("form"); if (!form) throw new Error("Form missing");
    fireEvent.submit(form); fireEvent.submit(form);
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(toast.success).not.toHaveBeenCalled();
    await act(async () => confirm({ bookingId: "A9469", reservations: f.reservations }));
    expect(toast.success).toHaveBeenCalledOnce();
  });

  it("keeps the draft and reports uncertainty without claiming rollback or retrying", async () => {
    const f = fixture(); save.mockRejectedValueOnce(new BookingEditError("Check the booking before trying again.", 0, "SAVE_UNCONFIRMED"));
    render(<ReservationEditForm reservation={f.reservation} />);
    fireEvent.change(screen.getByLabelText("Notes"), { target: { value: "Keep these notes" } });
    const button = screen.getByRole("button", { name: "Save Changes & Update Invoice" });
    await waitFor(() => expect(button).toBeEnabled()); fireEvent.click(button);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Couldn't confirm the save", expect.objectContaining({ description: "Check the booking before trying again." })));
    expect(screen.getByLabelText("Notes")).toHaveValue("Keep these notes");
    expect(save).toHaveBeenCalledOnce(); expect(toast.success).not.toHaveBeenCalled();
  });
});
