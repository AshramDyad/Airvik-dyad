import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { portalContainerSpy } = vi.hoisted(() => ({
  portalContainerSpy: vi.fn(),
}));

vi.mock("@radix-ui/react-popover", async () => {
  const React = await import("react");

  const Content = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  ));
  Content.displayName = "Content";

  return {
    Root: ({ children }: { children: React.ReactNode }) => children,
    Trigger: ({ children }: { children: React.ReactNode }) => children,
    Anchor: ({ children }: { children: React.ReactNode }) => children,
    Portal: ({
      children,
      container,
    }: {
      children: React.ReactNode;
      container?: HTMLElement;
    }) => {
      portalContainerSpy(container);
      return children;
    },
    Content,
  };
});

import { PopoverContent } from "./popover";

describe("PopoverContent", () => {
  it("uses the supplied element as its portal container", () => {
    const fullscreenContainer = document.createElement("div");

    render(
      <PopoverContent portalContainer={fullscreenContainer}>
        Reservation details
      </PopoverContent>
    );

    expect(screen.getByText("Reservation details")).toBeInTheDocument();
    expect(portalContainerSpy).toHaveBeenLastCalledWith(fullscreenContainer);
  });

  it("preserves the default portal behavior when no container is supplied", () => {
    render(<PopoverContent>Reservation details</PopoverContent>);

    expect(portalContainerSpy).toHaveBeenLastCalledWith(undefined);
  });
});
