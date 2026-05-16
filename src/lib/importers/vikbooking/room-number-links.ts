import type { SupabaseClient } from "@supabase/supabase-js";

import type { RoomNumberLink } from "@/data/types";

import { VIKBOOKING_SOURCE } from "./constants";
import { normalizeRoomNumber } from "./room-number-map";

type DbRoomNumberLink = {
  id: string;
  source: string;
  external_number: string;
  external_number_normalized: string;
  room_id: string;
  created_at: string;
  updated_at: string;
};

export function mapRoomNumberLink(row: DbRoomNumberLink): RoomNumberLink {
  return {
    id: row.id,
    source: row.source,
    externalNumber: row.external_number,
    externalNumberNormalized: row.external_number_normalized,
    roomId: row.room_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  } satisfies RoomNumberLink;
}

export async function fetchRoomNumberLinks(
  client: SupabaseClient,
  source: string = VIKBOOKING_SOURCE
): Promise<RoomNumberLink[]> {
  const { data, error } = await client
    .from("vikbooking_room_number_links")
    .select(
      "id, source, external_number, external_number_normalized, room_id, created_at, updated_at"
    )
    .eq("source", source)
    .order("external_number", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => mapRoomNumberLink(row as DbRoomNumberLink));
}

export function buildRoomNumberAliasMap(
  links: RoomNumberLink[]
): Map<string, string> {
  const map = new Map<string, string>();
  links.forEach((link) => {
    const normalized = link.externalNumberNormalized || normalizeRoomNumber(link.externalNumber);
    if (!normalized) {
      return;
    }
    if (!map.has(normalized)) {
      map.set(normalized, link.roomId);
    }
  });
  return map;
}

export interface UpsertRoomNumberLinkInput {
  source?: string;
  externalNumber: string;
  roomId: string;
}

export async function upsertRoomNumberLink(
  client: SupabaseClient,
  input: UpsertRoomNumberLinkInput
): Promise<void> {
  const normalized = normalizeRoomNumber(input.externalNumber);
  if (!normalized) {
    throw new Error("Room number is required");
  }

  const payload = {
    source: input.source ?? VIKBOOKING_SOURCE,
    external_number: input.externalNumber.trim(),
    external_number_normalized: normalized,
    room_id: input.roomId,
  };

  const { error } = await client
    .from("vikbooking_room_number_links")
    .upsert(payload, { onConflict: "source,external_number_normalized" });

  if (error) {
    throw error;
  }
}
