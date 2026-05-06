import type { ScenarioResult, Vehicle } from "@/lib/types";

export function vehicleDisplayName(vehicle: Vehicle | ScenarioResult): string {
  return [vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
}

export function vehicleCatalogLabel(vehicle: Vehicle): string {
  return `${vehicle.model_year} ${vehicle.trim}`;
}

export function uniqueSorted(values: Array<string | number>): string[] {
  return Array.from(new Set(values.map(String))).sort(naturalCompare);
}

/**
 * Deterministic natural-order string comparison.
 *
 * Splits each input into runs of digits and non-digits, comparing digit
 * runs numerically and the rest case-insensitively. Unlike
 * ``String.prototype.localeCompare(a, b, { numeric: true })``, this
 * implementation is independent of the host's ICU build, so it produces
 * identical orderings under SSR (Node) and hydration (browser) — the
 * source of an otherwise hard-to-diagnose React hydration mismatch.
 */
export function naturalCompare(a: string, b: string): number {
  if (a === b) return 0;
  const re = /(\d+)|(\D+)/g;
  const aChunks = a.toLowerCase().match(re) ?? [];
  const bChunks = b.toLowerCase().match(re) ?? [];
  const len = Math.min(aChunks.length, bChunks.length);
  for (let i = 0; i < len; i += 1) {
    const aChunk = aChunks[i];
    const bChunk = bChunks[i];
    const aIsNum = aChunk.charCodeAt(0) >= 48 && aChunk.charCodeAt(0) <= 57;
    const bIsNum = bChunk.charCodeAt(0) >= 48 && bChunk.charCodeAt(0) <= 57;
    if (aIsNum && bIsNum) {
      const diff = Number(aChunk) - Number(bChunk);
      if (diff !== 0) return diff;
    } else if (aIsNum !== bIsNum) {
      // Numbers sort before letters so "Model 3" comes before "Model S".
      return aIsNum ? -1 : 1;
    } else if (aChunk !== bChunk) {
      return aChunk < bChunk ? -1 : 1;
    }
  }
  return aChunks.length - bChunks.length;
}

export function firstVehicleMatching(
  vehicles: Vehicle[],
  predicate: (vehicle: Vehicle) => boolean
): Vehicle {
  return vehicles.find(predicate) ?? vehicles[0];
}
