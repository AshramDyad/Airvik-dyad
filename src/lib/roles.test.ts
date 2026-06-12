import { describe, expect, it } from "vitest";

import type { Role } from "@/data/types";
import { canManageRole, filterManageableRoles, findRoleById } from "./roles";

// Mirrors the verified live hierarchy after the super-admin migration:
// Administration sits clearly on top; every other role is below it.
const administration: Role = {
  id: "role-administration",
  name: "Administration",
  permissions: [],
  hierarchyLevel: 15,
};
const hotelOwner: Role = {
  id: "role-hotel-owner",
  name: "Hotel Owner",
  permissions: [],
  hierarchyLevel: 5,
};
const hotelManager: Role = {
  id: "role-hotel-manager",
  name: "Hotel Manager",
  permissions: [],
  hierarchyLevel: 4,
};
const accountant: Role = {
  id: "role-accountant",
  name: "Accountant",
  permissions: [],
  hierarchyLevel: 1,
};
const guest: Role = {
  id: "role-guest",
  name: "Guest",
  permissions: [],
  hierarchyLevel: 0,
};

describe("canManageRole", () => {
  it("lets Administration manage every lower role", () => {
    for (const target of [hotelOwner, hotelManager, accountant, guest]) {
      expect(canManageRole(administration, target)).toBe(true);
    }
  });

  it("does not let a lower role manage Administration", () => {
    for (const actor of [hotelOwner, hotelManager, accountant, guest]) {
      expect(canManageRole(actor, administration)).toBe(false);
    }
  });

  it("blocks peer/self management of equal levels (anti-lockout property)", () => {
    // Two Administration peers cannot demote/delete each other or their own role.
    // Strict `>` is intentional: it prevents a super-admin from locking itself out.
    const otherAdmin: Role = { ...administration, id: "role-administration-2" };
    expect(canManageRole(administration, otherAdmin)).toBe(false);
    expect(canManageRole(administration, administration)).toBe(false);
  });

  it("treats a missing/undefined hierarchyLevel as 0", () => {
    const noLevel = { ...guest, hierarchyLevel: undefined } as unknown as Role;
    // Administration (15) still outranks a level-less role (treated as 0).
    expect(canManageRole(administration, noLevel)).toBe(true);
    // A level-less actor (0) cannot manage Guest (also 0).
    expect(canManageRole(noLevel, guest)).toBe(false);
  });

  it("returns false when either role is null/undefined", () => {
    expect(canManageRole(null, hotelOwner)).toBe(false);
    expect(canManageRole(administration, null)).toBe(false);
    expect(canManageRole(undefined, undefined)).toBe(false);
  });

  it("respects a custom role created just below Administration", () => {
    const customNearTop: Role = {
      id: "role-custom",
      name: "Regional Lead",
      permissions: [],
      hierarchyLevel: 14,
    };
    expect(canManageRole(administration, customNearTop)).toBe(true);
    expect(canManageRole(customNearTop, administration)).toBe(false);
  });
});

describe("filterManageableRoles", () => {
  const allRoles = [administration, hotelOwner, hotelManager, accountant, guest];

  it("returns every role except Administration itself for an Administrator", () => {
    const manageable = filterManageableRoles(administration, allRoles);
    expect(manageable.map((role) => role.name)).toEqual([
      "Hotel Owner",
      "Hotel Manager",
      "Accountant",
      "Guest",
    ]);
    expect(manageable).not.toContainEqual(administration);
  });

  it("excludes Administration and same-level roles for a Hotel Owner", () => {
    const manageable = filterManageableRoles(hotelOwner, allRoles);
    expect(manageable.map((role) => role.name)).toEqual([
      "Hotel Manager",
      "Accountant",
      "Guest",
    ]);
  });

  it("returns nothing for a null actor", () => {
    expect(filterManageableRoles(null, allRoles)).toEqual([]);
  });
});

describe("findRoleById", () => {
  const allRoles = [administration, hotelOwner, guest];

  it("finds a role by id", () => {
    expect(findRoleById(allRoles, "role-hotel-owner")).toBe(hotelOwner);
  });

  it("returns undefined for an unknown or null id", () => {
    expect(findRoleById(allRoles, "missing")).toBeUndefined();
    expect(findRoleById(allRoles, null)).toBeUndefined();
  });
});
