import { NextResponse } from "next/server";

import { fetchCarbonIntensity } from "@/lib/carbon-intensity";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await fetchCarbonIntensity();

  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": "s-maxage=900, stale-while-revalidate=1800",
    },
  });
}
