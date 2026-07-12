import type { Permission } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { ADMIN_ROLES } from "@/constants/roles";
import { getPermissionsForFeatures, type PermissionFeature } from "@/lib/permissions/map";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export type AuthorizedProfile = {
  userId: string;
  roleName: string | null;
  permissions: Permission[];
};

const BEARER_PREFIX = "bearer ";

export async function requirePermission(
  request: Request,
  requiredPermission: Permission
): Promise<AuthorizedProfile> {
  return requirePermissions(request, requiredPermission);
}

export async function requirePermissions(
  request: Request,
  ...requiredPermissions: Permission[]
): Promise<AuthorizedProfile> {
  if (requiredPermissions.length === 0) {
    throw new Error("At least one permission must be provided");
  }

  const context = await resolveProfileContext(request);
  const isAllowed = requiredPermissions.some((permission) =>
    hasPermission(context.roleName, context.permissions, permission)
  );

  if (!isAllowed) {
    throw new HttpError(403, "Insufficient permissions");
  }

  return {
    userId: context.profileId,
    roleName: context.roleName,
    permissions: context.permissions,
  };
}

export async function requireFeature(
  request: Request,
  feature: PermissionFeature | PermissionFeature[],
  { requireAll = false }: { requireAll?: boolean } = {}
): Promise<AuthorizedProfile> {
  const featurePermissions = getPermissionsForFeatures(feature);
  if (featurePermissions.length === 0) {
    return requireProfile(request);
  }

  const context = await resolveProfileContext(request);
  const allowed = requireAll
    ? featurePermissions.every((permission) =>
        hasPermission(context.roleName, context.permissions, permission)
      )
    : featurePermissions.some((permission) =>
        hasPermission(context.roleName, context.permissions, permission)
      );

  if (!allowed) {
    throw new HttpError(403, "Insufficient permissions");
  }

  return {
    userId: context.profileId,
    roleName: context.roleName,
    permissions: context.permissions,
  };
}

export async function requireProfile(
  request: Request
): Promise<AuthorizedProfile> {
  const context = await resolveProfileContext(request);
  return {
    userId: context.profileId,
    roleName: context.roleName,
    permissions: context.permissions,
  };
}

export async function requireAdminProfile(
  request: Request
): Promise<AuthorizedProfile> {
  const context = await resolveProfileContext(request);
  const allowedRoles = new Set<string>(ADMIN_ROLES);

  if (!context.roleName || !allowedRoles.has(context.roleName)) {
    throw new HttpError(403, "Insufficient permissions");
  }

  return {
    userId: context.profileId,
    roleName: context.roleName,
    permissions: context.permissions,
  };
}

function extractAccessToken(header: string | null): string | null {
  if (!header) return null;
  const normalized = header.trim();
  if (normalized.length === 0) return null;
  if (normalized.toLowerCase().startsWith(BEARER_PREFIX)) {
    return normalized.slice(BEARER_PREFIX.length).trim();
  }
  return normalized;
}

type ProfileContext = {
  profileId: string;
  roleName: string | null;
  permissions: Permission[];
};

async function resolveProfileContext(request: Request): Promise<ProfileContext> {
  const token = extractAccessToken(request.headers.get("authorization"));
  if (!token) {
    throw new HttpError(401, "Missing or invalid Authorization header");
  }

  const supabase = createServerSupabaseClient();
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    throw new HttpError(401, "Invalid access token");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, roles:roles(name, permissions)")
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    throw new HttpError(403, "Profile not found");
  }

  const roleRecord = Array.isArray(profile.roles)
    ? profile.roles[0]
    : profile.roles;
  const roleName: string | null = roleRecord?.name ?? null;
  const permissions: Permission[] = roleRecord?.permissions ?? [];

  return {
    profileId: profile.id,
    roleName,
    permissions,
  };
}

function hasPermission(
  _roleName: string | null,
  permissions: Permission[],
  requiredPermission: Permission
): boolean {
  if (!requiredPermission) {
    return true;
  }

  return permissions.includes(requiredPermission);
}
