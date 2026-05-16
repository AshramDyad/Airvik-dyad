import type { SupabaseClient } from "@supabase/supabase-js";

import type { ExternalRoomLink } from "@/data/types";

import { VIKBOOKING_SOURCE } from "./constants";

type DbRoomLink = {
  id: string;
  source: string;
  external_label: string;
  room_id: string;
  created_at: string;
  updated_at: string;
};

export const EXTERNAL_ROOM_LINK_SELECT_COLUMNS =
  "id, source, external_label, room_id, created_at, updated_at" as const;

export async function fetchExternalRoomLinks(
  client: SupabaseClient,
  source: string = VIKBOOKING_SOURCE
): Promise<ExternalRoomLink[]> {
  const { data, error } = await client
    .from("external_room_links")
    .select(EXTERNAL_ROOM_LINK_SELECT_COLUMNS)
    .eq("source", source)
    .order("external_label", { ascending: true });

  if (error) {
    throw error;
  }

  return (data as DbRoomLink[]).map(mapRoomLink);
}

export function mapRoomLink(row: DbRoomLink): ExternalRoomLink {
  return {
    id: row.id,
    source: row.source,
    externalLabel: row.external_label,
    roomId: row.room_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildRoomLabelMap(
  links: ExternalRoomLink[]
): Map<string, ExternalRoomLink> {
  return new Map(
    links.map((link) => [link.externalLabel.toLowerCase(), link])
  );
}

export function resolveRoomMappings(
  labels: string[],
  links: ExternalRoomLink[]
): { mapped: Map<string, string>; missing: string[] } {
  const linkMap = buildRoomLabelMap(links);
  const mapped = new Map<string, string>();
  const missing: string[] = [];

  labels.forEach((label) => {
    const normalized = label?.trim() ?? "";
    if (!normalized) {
      missing.push(label);
      return;
    }
    const match = linkMap.get(normalized.toLowerCase());
    if (match) {
      mapped.set(normalized, match.roomId);
    } else {
      missing.push(label);
    }
  });

  return { mapped, missing };
}

export async function upsertExternalRoomLink(
  client: SupabaseClient,
  payload: { source: string; externalLabel: string; roomId: string }
): Promise<void> {
  const { error } = await client
    .from("external_room_links")
    .upsert(
      {
        source: payload.source,
        external_label: payload.externalLabel,
        room_id: payload.roomId,
      },
      { onConflict: "source,external_label" }
    );

  if (error) {
    throw error;
  }
}
