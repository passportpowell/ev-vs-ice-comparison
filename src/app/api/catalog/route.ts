import { type NextRequest, NextResponse } from "next/server";

import { dataset } from "@/lib/data";
import { uniqueSorted } from "@/lib/vehicles";

export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const make = params.get("make");
  const model = params.get("model");
  const year = params.get("year");
  const powertrain = params.get("powertrain");
  const query = params.get("q")?.toLowerCase().trim();

  const vehicles = dataset.vehicles.filter((vehicle) => {
    const haystack = [
      vehicle.make,
      vehicle.model,
      vehicle.trim,
      vehicle.model_year,
      vehicle.powertrain,
      vehicle.fuel_type,
      vehicle.segment,
      vehicle.body_style
    ]
      .join(" ")
      .toLowerCase();

    return (
      (!make || vehicle.make === make) &&
      (!model || vehicle.model === model) &&
      (!year ||
        (vehicle.available_from_year <= Number(year) &&
          vehicle.available_to_year >= Number(year))) &&
      (!powertrain || vehicle.powertrain === powertrain) &&
      (!query || haystack.includes(query))
    );
  });
  const makes = uniqueSorted(dataset.vehicles.map((vehicle) => vehicle.make));
  const models = uniqueSorted(dataset.vehicles.map((vehicle) => vehicle.model));
  const minAvailableYear = Math.min(
    ...dataset.vehicles.map((vehicle) => vehicle.available_from_year)
  );
  const maxAvailableYear = Math.max(
    ...dataset.vehicles.map((vehicle) => vehicle.available_to_year)
  );
  const years = Array.from(
    { length: maxAvailableYear - minAvailableYear + 1 },
    (_, index) => String(maxAvailableYear - index)
  );
  const powertrains = uniqueSorted(
    dataset.vehicles.map((vehicle) => vehicle.powertrain)
  );
  const numericYears = dataset.vehicles.map((vehicle) => vehicle.model_year);

  return NextResponse.json({
    count: vehicles.length,
    total_count: dataset.vehicles.length,
    coverage: {
      min_model_year: Math.min(...numericYears),
      max_model_year: Math.max(...numericYears),
      min_available_year: minAvailableYear,
      max_available_year: maxAvailableYear,
      current_market_count: dataset.vehicles.filter(
        (vehicle) => vehicle.uk_market_status === "current"
      ).length,
      used_market_count: dataset.vehicles.filter(
        (vehicle) => vehicle.uk_market_status === "used"
      ).length,
      policy:
        "The bundled catalog is a transparent UK seed catalog. Live DVLA import and future scheduled source ingestion are designed to extend it rather than cap it."
    },
    makes,
    models,
    model_years: years,
    powertrains,
    vehicles
  });
}
