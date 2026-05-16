import { NextResponse } from "next/server";

import { getCachedPublicAppProperty } from "@/lib/server/public-property";

export const revalidate = 3600;

const cacheHeaders = {
  "Cache-Control":
    "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET() {
  const data = await getCachedPublicAppProperty();

  return NextResponse.json(
    { data },
    {
      headers: cacheHeaders,
    },
  );
}
