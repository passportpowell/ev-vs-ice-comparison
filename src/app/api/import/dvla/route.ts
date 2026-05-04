import { type NextRequest, NextResponse } from "next/server";

import { dataset } from "@/lib/data";
import {
  compareDvlaWithCatalog,
  findCatalogMatches,
  normaliseDvlaVehicle
} from "@/lib/dvla";

const DVLA_URL =
  "https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles";
const REQUEST_TIMEOUT_MS = 8000;

export async function GET(request: NextRequest) {
  const registration = request.nextUrl.searchParams
    .get("registration")
    ?.replace(/\s+/g, "")
    .toUpperCase();
  const apiKey =
    process.env.DVLA_API_KEY ?? process.env.VEHICLE_ENQUIRY_API_KEY ?? "";
  const catalogVehicleId = request.nextUrl.searchParams.get("vehicleId");
  const modelHint = request.nextUrl.searchParams.get("model");
  const trimHint = request.nextUrl.searchParams.get("trim");
  const catalogVehicle = dataset.vehicles.find(
    (vehicle) => vehicle.id === catalogVehicleId
  );

  if (!registration) {
    return NextResponse.json(
      { error: "registration query parameter is required" },
      { status: 400 }
    );
  }

  if (!/^[A-Z0-9]{2,8}$/.test(registration)) {
    return NextResponse.json(
      { error: "registration must be a valid UK registration-like value" },
      { status: 400 }
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "DVLA_API_KEY is not configured",
        next_step:
          "Add DVLA_API_KEY to the deployment environment to enable live UK registration import."
      },
      { status: 503 }
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;

  try {
    response = await fetch(DVLA_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({ registrationNumber: registration }),
      cache: "no-store",
      signal: controller.signal
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error && error.name === "AbortError"
            ? "DVLA request timed out"
            : "DVLA request failed"
      },
      { status: upstreamUnavailableStatus(error) }
    );
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => ({
    error: "DVLA returned a non-JSON response"
  }));
  if (!response.ok) {
    return NextResponse.json(payload, { status: response.status });
  }
  const vehicle = normaliseDvlaVehicle(payload);

  return NextResponse.json({
    imported_at: new Date().toISOString(),
    vehicle,
    provenance: compareDvlaWithCatalog(vehicle, catalogVehicle),
    matches: findCatalogMatches(
      vehicle,
      dataset.vehicles,
      {
        model: modelHint ?? catalogVehicle?.model,
        trim: trimHint ?? catalogVehicle?.trim
      },
      5
    )
  });
}

function upstreamUnavailableStatus(error: unknown): number {
  return error instanceof Error && error.name === "AbortError" ? 504 : 502;
}
