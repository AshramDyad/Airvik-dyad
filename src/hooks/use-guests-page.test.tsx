import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizedFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/client-session", () => ({
  authorizedFetch: authorizedFetchMock,
}));

import { useGuestsPage } from "./use-guests-page";

describe("useGuestsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authorizedFetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "guest-1",
              firstName: "Asha",
              lastName: "Guest",
              email: "asha@example.com",
              phone: "9999999999",
            },
          ],
          nextOffset: 25,
          count: 50,
        }),
        { status: 200 },
      ),
    );
  });

  it("fetches a bounded guest page through the admin API", async () => {
    const { result } = renderHook(() =>
      useGuestsPage({
        limit: 25,
        offset: 0,
        query: "asha",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(authorizedFetchMock).toHaveBeenCalledWith(
      "/api/admin/guests?limit=25&offset=0&query=asha",
      expect.objectContaining({
        cache: "no-store",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(result.current.guests).toEqual([
      {
        id: "guest-1",
        firstName: "Asha",
        lastName: "Guest",
        email: "asha@example.com",
        phone: "9999999999",
      },
    ]);
    expect(result.current.totalCount).toBe(50);
    expect(result.current.nextOffset).toBe(25);
    expect(result.current.error).toBeNull();
  });

  it("can reload the current guest page after mutations", async () => {
    const { result } = renderHook(() =>
      useGuestsPage({
        limit: 25,
        offset: 0,
        query: "",
      }),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      result.current.reload();
    });

    await waitFor(() => expect(authorizedFetchMock).toHaveBeenCalledTimes(2));
  });
});
