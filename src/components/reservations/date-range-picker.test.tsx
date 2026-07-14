import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ReservationDateRangePicker } from "./date-range-picker";

const setViewportWidth = (width: number) => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  });
  window.dispatchEvent(new Event("resize"));
};

describe("ReservationDateRangePicker", () => {
  beforeEach(() => {
    setViewportWidth(1280);
  });

  it("shows two compact months on desktop", () => {
    render(
      <ReservationDateRangePicker
        value={{ from: undefined, to: undefined }}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Select dates" }));

    expect(screen.getAllByRole("grid")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("shows one month on mobile", () => {
    setViewportWidth(390);
    render(
      <ReservationDateRangePicker
        value={{ from: undefined, to: undefined }}
        onChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Select dates" }));

    expect(screen.getAllByRole("grid")).toHaveLength(1);
  });
});
