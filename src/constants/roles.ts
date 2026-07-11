export const ROLE_NAMES = {
  ADMINISTRATION: "Administration",
  HOTEL_OWNER: "Hotel Owner",
  HOTEL_MANAGER: "Hotel Manager",
  RECEPTIONIST: "Receptionist",
  HOUSEKEEPER: "Housekeeper",
  RISHIRAJ: "Rishiraj-ji",
  ACCOUNTANT: "Accountant",
  GUEST: "Guest",
} as const;

// Full-access operational roles. Used for API admin-status checks
// (e.g. requireAdminProfile). Do NOT add view-only roles here.
export const ADMIN_ROLES = [
  ROLE_NAMES.ADMINISTRATION,
  ROLE_NAMES.HOTEL_OWNER,
  ROLE_NAMES.HOTEL_MANAGER,
  ROLE_NAMES.RECEPTIONIST,
  ROLE_NAMES.HOUSEKEEPER,
] as const;

// Roles allowed into the admin shell UI. Superset of ADMIN_ROLES that also
// includes view-only roles (like Rishiraj-ji and Accountant) which are then
// confined to their own pages by per-page permission gates. Used only by the
// UI entry gates.
export const ADMIN_SHELL_ROLES = [
  ...ADMIN_ROLES,
  ROLE_NAMES.RISHIRAJ,
  ROLE_NAMES.ACCOUNTANT,
] as const;

export type RoleName = typeof ROLE_NAMES[keyof typeof ROLE_NAMES];
