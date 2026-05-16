import { NextResponse } from "next/server";

import { ROLE_NAMES } from "@/constants/roles";
import type { User } from "@/data/types";
import { createServerSupabaseClient } from "@/integrations/supabase/server";
import { HttpError, requireFeature } from "@/lib/server/auth";
import { HOUSEKEEPER_PROFILE_SELECT_COLUMNS } from "./columns";

type HousekeeperProfileRow = {
  id: string;
  name: string | null;
  role_id: string | null;
};

const cacheHeaders = {
  "Cache-Control": "private, no-store",
};

const noStoreJson = (body: unknown, init?: ResponseInit) =>
  NextResponse.json(body, { ...init, headers: cacheHeaders });

const mapHousekeeper = (row: HousekeeperProfileRow): User => ({
  id: row.id,
  name: row.name ?? "Housekeeper",
  email: "",
  roleId: row.role_id ?? "",
});

export async function GET(request: Request) {
  try {
    await requireFeature(request, "housekeeping");

    const supabase = createServerSupabaseClient();
    const { data, error } = await supabase
      .from("profiles")
      .select(HOUSEKEEPER_PROFILE_SELECT_COLUMNS)
      .eq("roles.name", ROLE_NAMES.HOUSEKEEPER)
      .order("name", { ascending: true });

    if (error) {
      console.error("Failed to fetch housekeepers", error);
      return noStoreJson(
        { message: "Unable to load housekeepers." },
        { status: 500 },
      );
    }

    return noStoreJson({
      data: ((data ?? []) as HousekeeperProfileRow[]).map(mapHousekeeper),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return noStoreJson(
        { message: error.message },
        { status: error.status },
      );
    }
    console.error("Unexpected housekeepers fetch error", error);
    return noStoreJson(
      { message: "Unexpected error while loading housekeepers." },
      { status: 500 },
    );
  }
}
