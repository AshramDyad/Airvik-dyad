import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

import { Footer } from "./Footer";

describe("marketing Footer", () => {
  it("does not priority-preload the offscreen footer logo", () => {
    render(
      <Footer
        propertyLocation={{
          address: "Rishikesh",
          google_maps_url: "",
        }}
      />,
    );

    expect(screen.getByAltText("SahajAnand Wellness Logo")).toHaveAttribute(
      "data-priority",
      "false",
    );
  });
});
