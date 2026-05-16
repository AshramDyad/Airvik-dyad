import { NextResponse } from "next/server";

import { getPublishedReviews } from "@/lib/server/reviews";

const cacheHeaders = {
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
};

export async function GET() {
  try {
    const data = await getPublishedReviews();
    return NextResponse.json({ data }, { headers: cacheHeaders });
  } catch (error) {
    console.error("Failed to load reviews", error);
    return NextResponse.json(
      { error: "Unable to load reviews" },
      { status: 500, headers: cacheHeaders }
    );
  }
}
