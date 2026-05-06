import { NextResponse } from "next/server";

import {
  CATALOG_SOURCE_NOTE,
  CATALOG_VERSION,
  fetchUkRelevantMakes,
} from "@/lib/uk-vehicle-catalog";

export const dynamic = "force-static";

export async function GET() {
  const makes = fetchUkRelevantMakes();
  return NextResponse.json(
    {
      count: makes.length,
      version: CATALOG_VERSION,
      source: CATALOG_SOURCE_NOTE,
      makes,
    },
    {
      headers: {
        "Cache-Control": "s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}
