import { NextResponse } from "next/server";

import { fetchChargingStations } from "@/lib/openchargemap";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const country = (url.searchParams.get("country") ?? "GB").toUpperCase();
  const minPowerParam = Number(url.searchParams.get("minPowerKw") ?? "50");
  const limitParam = Number(url.searchParams.get("limit") ?? "250");

  const feed = await fetchChargingStations({
    countryCode: country,
    minPowerKw: Number.isFinite(minPowerParam) ? minPowerParam : 50,
    limit: Number.isFinite(limitParam) ? limitParam : 250,
  });

  return NextResponse.json(feed, {
    headers: {
      "Cache-Control": "s-maxage=21600, stale-while-revalidate=86400",
    },
  });
}
