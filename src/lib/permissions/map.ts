import type { Permission } from "@/data/types";

export const FEATURE_PERMISSIONS = {
  dashboard: ["read:reservation"],
  calendar: ["read:reservation"],
  reservations: ["read:reservation"],
  reservationCreate: ["create:reservation"],
  guests: ["read:guest"],
  rooms: ["read:room"],
  roomTypes: ["read:room_type"],
  roomCategories: ["read:room_category"],
  ratePlans: ["read:rate_plan"],
  housekeeping: ["read:room", "update:room"],
  posts: ["read:post"],
  postsCreate: ["create:post"],
  postsUpdate: ["update:post"],
  donations: ["read:donation"],
  donationsCreate: ["create:donation"],
  donationsManage: ["update:donation", "delete:donation"],
  feedback: ["read:feedback"],
  feedbackManage: ["update:feedback", "delete:feedback"],
  eventBanner: ["update:setting"],
  reviews: ["read:review"],
  reviewsCreate: ["create:review"],
  reviewsUpdate: ["update:review"],
  reviewsDelete: ["delete:review"],
  reports: ["read:report"],
  payments: ["read:report"],
  activity: ["read:report"],
  settings: ["update:setting"],
  users: ["read:user"],
} as const satisfies Record<string, readonly Permission[]>;

export type PermissionFeature = keyof typeof FEATURE_PERMISSIONS;

export function getPermissionsForFeature(feature: PermissionFeature): readonly Permission[] {
  return FEATURE_PERMISSIONS[feature] ?? [];
}

export function getPermissionsForFeatures(
  feature: PermissionFeature | PermissionFeature[]
): Permission[] {
  const features = Array.isArray(feature) ? feature : [feature];
  const permissions = features.flatMap((entry) => getPermissionsForFeature(entry));
  return Array.from(new Set(permissions));
}
