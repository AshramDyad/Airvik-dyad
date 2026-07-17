import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useFullscreen } from "./use-fullscreen";

const originalFullscreenElement = Object.getOwnPropertyDescriptor(
  document,
  "fullscreenElement"
);

afterEach(() => {
  if (originalFullscreenElement) {
    Object.defineProperty(
      document,
      "fullscreenElement",
      originalFullscreenElement
    );
  } else {
    Reflect.deleteProperty(document, "fullscreenElement");
  }
});

describe("useFullscreen", () => {
  it("exposes the managed element while it is fullscreen", () => {
    const { result } = renderHook(() => useFullscreen<HTMLDivElement>());
    const calendarElement = document.createElement("div");
    result.current.elementRef.current = calendarElement;

    act(() => {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        value: calendarElement,
      });
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(result.current.isFullscreen).toBe(true);
    expect(result.current.fullscreenElement).toBe(calendarElement);

    act(() => {
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        value: null,
      });
      document.dispatchEvent(new Event("fullscreenchange"));
    });

    expect(result.current.isFullscreen).toBe(false);
    expect(result.current.fullscreenElement).toBeNull();
  });
});
