import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authorizedFetch } from "@/lib/auth/client-session";
import { SendBookingConfirmationButton } from "./SendBookingConfirmationButton";

vi.mock("@/lib/auth/client-session", () => ({ authorizedFetch: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));

const mockedFetch = vi.mocked(authorizedFetch);
const preview = { phone: "+919876543210", message: "Hello Test Guest, your booking A12345 is confirmed.", previewToken: "a".repeat(64) };

describe("SendBookingConfirmationButton", () => {
  beforeEach(() => { mockedFetch.mockReset(); });

  it("requires consent, prevents repeated clicks and never retries the write", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce(Response.json(preview));
    let finish: (value: Response) => void = () => undefined;
    mockedFetch.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    render(<SendBookingConfirmationButton reservationId="booking-id" />);
    await user.click(screen.getByRole("button", { name: "Send confirmation" }));
    expect(await screen.findByText(preview.phone)).toBeInTheDocument();
    expect(screen.getByText(preview.message)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    const send = screen.getByRole("button", { name: "Send" });
    fireEvent.click(send);
    fireEvent.click(send);
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(2));
    expect(mockedFetch.mock.calls[1]?.[1]).toEqual(expect.objectContaining({ method: "POST", retryOnUnauthorized: false }));
    finish(Response.json({ success: true }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("warns that the outcome is uncertain when the send response is lost", async () => {
    const user = userEvent.setup();
    mockedFetch.mockResolvedValueOnce(Response.json(preview));
    mockedFetch.mockRejectedValueOnce(new Error("network error"));
    render(<SendBookingConfirmationButton reservationId="booking-id" />);
    await user.click(screen.getByRole("button", { name: "Send confirmation" }));
    await screen.findByText(preview.phone);
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't confirm sending");
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });
});
