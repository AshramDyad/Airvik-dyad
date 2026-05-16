import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const adminDir = join(process.cwd(), "src/app/admin");

type ManagementRouteCase = {
  label: string;
  pagePath: string;
  loaderPath: string;
  panelPath: string;
  loaderName: string;
  dynamicConst: string;
  dynamicTarget: string;
  feature: string;
};

const routeCases: ManagementRouteCase[] = [
  {
    label: "guests",
    pagePath: "guests/page.tsx",
    loaderPath: "guests/guests-panel-loader.tsx",
    panelPath: "guests/components/guests-panel.tsx",
    loaderName: "GuestsPanelLoader",
    dynamicConst: "const DynamicGuestsPanel = dynamic",
    dynamicTarget: "./components/guests-panel",
    feature: 'feature="guests"',
  },
  {
    label: "rooms",
    pagePath: "rooms/page.tsx",
    loaderPath: "rooms/rooms-panel-loader.tsx",
    panelPath: "rooms/components/rooms-panel.tsx",
    loaderName: "RoomsPanelLoader",
    dynamicConst: "const DynamicRoomsPanel = dynamic",
    dynamicTarget: "./components/rooms-panel",
    feature: 'feature="rooms"',
  },
  {
    label: "room types",
    pagePath: "room-types/page.tsx",
    loaderPath: "room-types/room-types-panel-loader.tsx",
    panelPath: "room-types/components/room-types-panel.tsx",
    loaderName: "RoomTypesPanelLoader",
    dynamicConst: "const DynamicRoomTypesPanel = dynamic",
    dynamicTarget: "./components/room-types-panel",
    feature: 'feature="roomTypes"',
  },
  {
    label: "rates",
    pagePath: "rates/page.tsx",
    loaderPath: "rates/rates-panel-loader.tsx",
    panelPath: "rates/components/rates-panel.tsx",
    loaderName: "RatesPanelLoader",
    dynamicConst: "const DynamicRatesPanel = dynamic",
    dynamicTarget: "./components/rates-panel",
    feature: 'feature="ratePlans"',
  },
  {
    label: "room categories",
    pagePath: "room-categories/page.tsx",
    loaderPath: "room-categories/room-categories-panel-loader.tsx",
    panelPath: "room-categories/components/room-categories-panel.tsx",
    loaderName: "RoomCategoriesPanelLoader",
    dynamicConst: "const DynamicRoomCategoriesPanel = dynamic",
    dynamicTarget: "./components/room-categories-panel",
    feature: 'feature="roomCategories"',
  },
  {
    label: "reservations",
    pagePath: "reservations/page.tsx",
    loaderPath: "reservations/reservations-panel-loader.tsx",
    panelPath: "reservations/components/reservations-panel.tsx",
    loaderName: "ReservationsPanelLoader",
    dynamicConst: "const DynamicReservationsPanel = dynamic",
    dynamicTarget: "./components/reservations-panel",
    feature: 'feature="reservations"',
  },
];

describe("admin management code splitting", () => {
  it.each(routeCases)(
    "keeps the $label route page as a server shell around a dynamic panel loader",
    ({
      pagePath,
      loaderPath,
      panelPath,
      loaderName,
      dynamicConst,
      dynamicTarget,
      feature,
    }) => {
      const pageSource = readFileSync(join(adminDir, pagePath), "utf8");
      const loaderSource = readFileSync(join(adminDir, loaderPath), "utf8");
      const panelSource = readFileSync(join(adminDir, panelPath), "utf8");

      expect(pageSource).toContain(loaderName);
      expect(pageSource).not.toContain('"use client"');
      expect(pageSource).not.toContain("dynamic(");
      expect(pageSource).not.toContain("@/components/admin/permission-gate");
      expect(loaderSource).toContain(dynamicConst);
      expect(loaderSource).toContain(dynamicTarget);
      expect(panelSource).toContain("PermissionGate");
      expect(panelSource).toContain(feature);
    },
  );

  it("keeps table management surfaces out of route shell pages", () => {
    const guestsPage = readFileSync(join(adminDir, "guests/page.tsx"), "utf8");
    const roomsPage = readFileSync(join(adminDir, "rooms/page.tsx"), "utf8");
    const roomTypesPage = readFileSync(
      join(adminDir, "room-types/page.tsx"),
      "utf8",
    );
    const ratesPage = readFileSync(join(adminDir, "rates/page.tsx"), "utf8");
    const roomCategoriesPage = readFileSync(
      join(adminDir, "room-categories/page.tsx"),
      "utf8",
    );
    const reservationsPage = readFileSync(
      join(adminDir, "reservations/page.tsx"),
      "utf8",
    );

    expect(guestsPage).not.toContain("./components/columns");
    expect(guestsPage).not.toContain("./components/data-table");
    expect(guestsPage).not.toContain("./components/guest-form-dialog");

    expect(roomsPage).not.toContain("./components/columns");
    expect(roomsPage).not.toContain("./components/data-table");

    expect(roomTypesPage).not.toContain("./components/columns");
    expect(roomTypesPage).not.toContain("./components/data-table");

    expect(ratesPage).not.toContain("./components/columns");
    expect(ratesPage).not.toContain("./components/data-table");
    expect(ratesPage).not.toContain("./components/seasonal-prices-section");

    expect(roomCategoriesPage).not.toContain("./components/columns");
    expect(roomCategoriesPage).not.toContain("./components/data-table");

    expect(reservationsPage).not.toContain("./components/columns");
    expect(reservationsPage).not.toContain("./components/data-table");
  });

  it("lets room categories hydrate through a route-backed API instead of global app data", () => {
    const panelSource = readFileSync(
      join(adminDir, "room-categories/components/room-categories-panel.tsx"),
      "utf8",
    );

    expect(panelSource).toContain("/api/admin/room-categories");
    expect(panelSource).not.toContain("roomCategories } = useDataContext");
  });

  it("lets rooms hydrate through a route-backed API instead of global app data", () => {
    const panelSource = readFileSync(
      join(adminDir, "rooms/components/rooms-panel.tsx"),
      "utf8",
    );
    const columnsSource = readFileSync(
      join(adminDir, "rooms/components/columns.tsx"),
      "utf8",
    );
    const formSource = readFileSync(
      join(adminDir, "rooms/components/room-form-dialog.tsx"),
      "utf8",
    );

    expect(panelSource).toContain("/api/admin/rooms");
    expect(panelSource).not.toContain("rooms } = useDataContext");
    expect(columnsSource).not.toContain("useDataContext");
    expect(formSource).not.toContain("rooms, addRoom, updateRoom, roomTypes");
  });

  it("lets rates hydrate through a route-backed API instead of global app data", () => {
    const panelSource = readFileSync(
      join(adminDir, "rates/components/rates-panel.tsx"),
      "utf8",
    );
    const seasonalSectionSource = readFileSync(
      join(adminDir, "rates/components/seasonal-prices-section.tsx"),
      "utf8",
    );
    const seasonalFormSource = readFileSync(
      join(adminDir, "rates/components/seasonal-price-form-dialog.tsx"),
      "utf8",
    );

    expect(panelSource).toContain("/api/admin/rates");
    expect(panelSource).not.toContain("ratePlans } = useDataContext");
    expect(seasonalSectionSource).not.toContain("seasonalPrices, roomTypes");
    expect(seasonalFormSource).not.toContain("roomTypes, addSeasonalPrice");
  });

  it("lets room types hydrate through a route-backed API instead of global app data", () => {
    const panelSource = readFileSync(
      join(adminDir, "room-types/components/room-types-panel.tsx"),
      "utf8",
    );
    const columnsSource = readFileSync(
      join(adminDir, "room-types/components/columns.tsx"),
      "utf8",
    );
    const formSource = readFileSync(
      join(adminDir, "room-types/components/room-type-form-dialog.tsx"),
      "utf8",
    );

    expect(panelSource).toContain("/api/admin/room-types");
    expect(panelSource).not.toContain("roomTypes } = useDataContext");
    expect(columnsSource).not.toContain("useDataContext");
    expect(formSource).not.toContain("amenities: allAmenities");
  });
});
