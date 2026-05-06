import { NextResponse } from "next/server";

import { fetchModelsForMakeYear } from "@/lib/uk-vehicle-catalog";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const make = url.searchParams.get("make")?.trim();
  const year = Number(url.searchParams.get("year"));
  if (!make || !Number.isFinite(year) || year < 1990 || year > 2030) {
    return NextResponse.json(
      { error: "Provide ?make=<MakeName>&year=<YYYY>" },
      { status: 400 }
    );
  }
  const models = fetchModelsForMakeYear(make, year);
  return NextResponse.json(
    { make, year, count: models.length, models },
    {
      headers: {
        "Cache-Control": "s-maxage=43200, stale-while-revalidate=604800",
      },
    }
  );
}
