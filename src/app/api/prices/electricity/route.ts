import { NextResponse } from "next/server";

import { fetchOctopusTariffs } from "@/lib/octopus";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const region = (url.searchParams.get("region") ?? "C").toUpperCase();
  const feed = await fetchOctopusTariffs(region);

  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
