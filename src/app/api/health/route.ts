import { NextResponse } from "next/server";

import { dataset } from "@/lib/data";

export function GET() {
  const availabilityStarts = dataset.vehicles.map(
    (vehicle) => vehicle.available_from_year
  );
  const availabilityEnds = dataset.vehicles.map(
    (vehicle) => vehicle.available_to_year
  );

  return NextResponse.json({
    status: "ok",
    generated_at: dataset.generated_at,
    vehicle_count: dataset.vehicles.length,
    scenario_count: dataset.scenarios.length,
    rag_document_count: dataset.rag_corpus.length,
    source_count: dataset.source_registry.length,
    catalog_availability_years: {
      min: Math.min(...availabilityStarts),
      max: Math.max(...availabilityEnds)
    }
  });
}
