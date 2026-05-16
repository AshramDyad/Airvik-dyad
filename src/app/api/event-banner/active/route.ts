import { NextResponse } from "next/server";

import { getHomepageModalBanner } from "@/lib/server/events";

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
};

export async function GET() {
  try {
    const data = await getHomepageModalBanner();
    return NextResponse.json({ data }, { headers: cacheHeaders });
  } catch (error) {
    console.error("Unexpected error fetching event banner", error);
    return NextResponse.json(
      { data: null },
      { status: 500, headers: cacheHeaders }
    );
  }
}
