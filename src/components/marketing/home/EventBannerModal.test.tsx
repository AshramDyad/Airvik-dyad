import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({
    alt,
    priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} data-priority={priority ? "true" : "false"} {...props} />
  ),
}));

import { EventBannerModal } from "./EventBannerModal";

describe("EventBannerModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            id: "33333333-3333-4333-8333-333333333333",
            title: "Yoga Camp",
            description: "Morning practice",
            imageUrl: "https://example.com/event.jpg",
            isActive: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
          },
        }),
      }),
    );
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "complete",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    window.sessionStorage.clear();
  });

  it("does not priority-preload the delayed event banner image", async () => {
    render(<EventBannerModal />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(fetch).toHaveBeenCalledWith("/api/event-banner/active");
    expect(screen.getByAltText("Yoga Camp")).toHaveAttribute(
      "data-priority",
      "false",
    );
  });
});
