import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { buildProperty } from "@/test/builders";
import { Header } from "./Header";

describe("Header mobile topbar", () => {
  it("shows the brochure and WhatsApp actions in one mobile row", async () => {
    const user = userEvent.setup();
    const property = buildProperty();

    render(
      <Header
        propertyLocation={{
          address: property.address,
          google_maps_url: property.google_maps_url,
        }}
      />
    );

    const mobileTopbar = screen.getByRole("navigation", {
      name: "Mobile quick actions",
    });

    expect(mobileTopbar.parentElement).toHaveClass("md:hidden");
    expect(mobileTopbar).toHaveClass("justify-end");
    expect(
      within(mobileTopbar).queryByText("Swaminarayan Ashram (Estd: 2002)")
    ).not.toBeInTheDocument();

    const whatsappLink = within(mobileTopbar).getByRole("link", {
      name: "Contact us on WhatsApp",
    });
    expect(whatsappLink).toHaveAttribute(
      "href",
      expect.stringContaining("https://wa.me/918511151708")
    );

    await user.click(
      within(mobileTopbar).getByRole("button", { name: "Rooms Brochure" })
    );
    expect(
      screen.getByRole("heading", { name: "Sahajanand Wellness Brochure" })
    ).toBeVisible();

    const brochureDialog = screen.getByRole("dialog");
    expect(brochureDialog).toHaveClass(
      "h-[calc(100dvh-1.5rem)]",
      "w-[calc(100vw-1.5rem)]",
      "overflow-hidden"
    );
    expect(
      screen.getByTitle("Sahajanand Wellness Brochure")
    ).toHaveClass("min-h-0", "h-full", "w-full");
  });
});
