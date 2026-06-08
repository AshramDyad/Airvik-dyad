import { ROLE_NAMES } from "@/constants/roles";

/**
 * Where an admin-shell user should land after login.
 *
 * Most roles land on the dashboard (`/admin`). View-only roles that cannot see
 * the dashboard (e.g. Rishiraj-ji, who only has `read:owner_overview`) are sent
 * straight to their own page so they don't hit an "Access restricted" screen.
 */
export function getAdminLandingPath(roleName: string | null): string {
  if (roleName === ROLE_NAMES.RISHIRAJ) {
    return "/admin/owner-overview";
  }
  return "/admin";
}
