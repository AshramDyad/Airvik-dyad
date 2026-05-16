"use client";

import * as React from "react";
import type { User as AuthUser } from "@supabase/supabase-js";
import { useSessionContext } from "@/context/session-context";
import type { User, Role, Permission } from "@/data/types";
import { getPermissionsForFeature, type PermissionFeature } from "@/lib/permissions/map";

type ProfileWithRole = {
  id: string;
  name: string | null;
  role_id: string;
  roles: Role | null;
};
import { getUserProfile } from "@/lib/api";

const mapRole = (role: Role | null): Role | null => {
  if (!role) return null;
  const raw = role as Role & { hierarchy_level?: number };
  return {
    ...role,
    hierarchyLevel: typeof raw.hierarchyLevel === "number" ? raw.hierarchyLevel : raw.hierarchy_level ?? 0,
  };
};

export function useAuth() {
  const [authUser, setAuthUser] = React.useState<AuthUser | null>(null);
  const [currentUser, setCurrentUser] = React.useState<User | null>(null);
  const [userRole, setUserRole] = React.useState<Role | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const lastLoadedUserIdRef = React.useRef<string | null>(null);
  const fetchInFlightUserIdRef = React.useRef<string | null>(null);

  const fetchUserProfile = React.useCallback(async (user: AuthUser) => {
    if (lastLoadedUserIdRef.current === user.id) {
      return;
    }

    if (fetchInFlightUserIdRef.current === user.id) {
      return;
    }

    fetchInFlightUserIdRef.current = user.id;
    setIsLoading(true);
    try {
      const { data: profile, error } = await getUserProfile(user.id);
      if (error) throw error;
      if (!profile) throw new Error("Profile not found");

      const typedProfile = profile as unknown as ProfileWithRole;

      setAuthUser(user);
      setCurrentUser({
        id: typedProfile.id,
        name: typedProfile.name ?? "",
        email: user.email ?? "",
        roleId: typedProfile.role_id,
      });
      setUserRole(mapRole(typedProfile.roles));

      lastLoadedUserIdRef.current = user.id;
    } catch (error) {
      console.error("Failed to fetch user profile:", error);
      // Don't call signOut() — transient errors (429-caused expired token, network)
      // shouldn't trigger logout. If session is genuinely invalid, Supabase's
      // auto-refresh will fire SIGNED_OUT via onAuthStateChange automatically.
    } finally {
      if (fetchInFlightUserIdRef.current === user.id) {
        fetchInFlightUserIdRef.current = null;
      }
      setIsLoading(false);
    }
  }, []);

  const clearAuthData = () => {
    lastLoadedUserIdRef.current = null;
    fetchInFlightUserIdRef.current = null;
    setAuthUser(null);
    setCurrentUser(null);
    setUserRole(null);
    setIsLoading(false);
  };

  const { session, isLoading: isSessionLoading } = useSessionContext();

  React.useEffect(() => {
    if (isSessionLoading) return;

    if (session?.user) {
      // Skip profile fetch if access token is expired (e.g., 429 returned stale session).
      // Supabase auto-refresh will deliver a fresh session via onAuthStateChange.
      const now = Math.floor(Date.now() / 1000);
      if (session.expires_at && session.expires_at < now) {
        return;
      }
      fetchUserProfile(session.user);
    } else {
      clearAuthData();
    }
  }, [session, isSessionLoading, fetchUserProfile]);

  const hasPermission = (permission: Permission): boolean => {
    if (!userRole) return false;
    return userRole.permissions?.includes(permission) || false;
  };

  const hasAnyPermission = (permissions: Iterable<Permission>): boolean => {
    for (const permission of permissions) {
      if (hasPermission(permission)) {
        return true;
      }
    }
    return false;
  };

  const hasFeatureAccess = (
    feature: PermissionFeature,
    { requireAll = false }: { requireAll?: boolean } = {}
  ): boolean => {
    const required = getPermissionsForFeature(feature);
    if (required.length === 0) {
      return true;
    }

    if (requireAll) {
      return required.every((permission) => hasPermission(permission));
    }

    return hasAnyPermission(required);
  };

  return {
    authUser,
    currentUser,
    userRole,
    isLoading,
    hasPermission,
    hasAnyPermission,
    hasFeatureAccess,
  };
}
