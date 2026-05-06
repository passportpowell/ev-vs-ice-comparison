// UK consumer-car catalog.
//
// Why this file replaced the NHTSA vPIC integration we had earlier:
// vPIC is the US Department of Transportation's vehicle catalog and
// follows US-market lineups. For UK-only models (BYD's UK consumer
// cars, every Vauxhall, Dacia, Cupra, the post-2020 EV-only Renaults,
// many Citroëns) it returns either nothing or a US-only commercial
// catalog (BYD's US business is electric buses, not the Atto 3).
//
// There is no free public REST API for UK consumer-car data — the
// commercial options (CAP HPI, HPI, SMMT) are paid licences. So we
// curate UK lineups at the *model* level (not the trim level) in a
// single JSON file, kept up to date with new releases.
//
// Trim-level data still comes from the per-vehicle DVLA reg lookup
// when a user wants accuracy on their specific car.

import catalog from "@/../data/raw/uk_vehicle_catalog.json";

export type Powertrain = "EV" | "ICE" | "Hybrid" | "Mixed";

export type VehicleSpecs = {
  battery_kwh?: [number, number];
  kwh_per_100km?: [number, number];
  petrol_mpg_uk?: [number, number];
  diesel_mpg_uk?: [number, number];
};

export type UkMake = { id: number; name: string };
export type UkModel = {
  make: string;
  model: string;
  year: number;
  powertrain: Powertrain;
  specs?: VehicleSpecs;
};

type RawCatalog = {
  version: string;
  source_note: string;
  makes: Array<{
    name: string;
    models: Array<{
      model: string;
      from: number;
      to: number;
      powertrain?: Powertrain;
      specs?: VehicleSpecs;
    }>;
  }>;
};

const RAW = catalog as RawCatalog;

let makeCache: UkMake[] | null = null;

export function fetchUkRelevantMakes(): UkMake[] {
  if (makeCache) return makeCache;
  makeCache = RAW.makes
    .map((m, i) => ({ id: i + 1, name: m.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "en-GB"));
  return makeCache;
}

export function fetchModelsForMakeYear(make: string, year: number): UkModel[] {
  const target = make.toLowerCase();
  const entry = RAW.makes.find((m) => m.name.toLowerCase() === target);
  if (!entry) return [];
  return entry.models
    .filter((m) => year >= m.from && year <= m.to)
    .map((m) => ({
      make: entry.name,
      model: m.model,
      year,
      powertrain: m.powertrain ?? "ICE",
      ...(m.specs ? { specs: m.specs } : {}),
    }))
    .sort((a, b) => a.model.localeCompare(b.model, "en-GB"));
}

export const CATALOG_VERSION = RAW.version;
export const CATALOG_SOURCE_NOTE = RAW.source_note;
