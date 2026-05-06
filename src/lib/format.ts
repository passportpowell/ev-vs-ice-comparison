// Shared formatting helpers used by the dashboard and per-vehicle pages.

import type { Vehicle } from "@/lib/types";
import { vehicleDisplayName } from "@/lib/vehicles";

export function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: value < 2 ? 2 : 0,
  }).format(value);
}

export function compactNumber(value: number): string {
  if (value >= 1_000_000) {
    return `${trimDecimal(value / 1_000_000)}m`;
  }
  if (value >= 1_000) {
    return `${trimDecimal(value / 1_000)}k`;
  }
  return Math.round(value).toLocaleString("en-GB");
}

export function formatControlValue(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString("en-GB")
    : value.toFixed(2);
}

export function roundForInput(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatDateLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function labelise(value: string): string {
  return value
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function compareOptionLabel(vehicle: Vehicle): string {
  return `${labelise(vehicle.segment)} - ${vehicleDisplayName(vehicle)} - ${vehicle.powertrain}`;
}

export function cleanFeature(value: string): string {
  return value.replaceAll("_", " ").replace("powertrain ", "");
}

export function formatSourceValue(value: string | number | null): string {
  if (value === null || value === "") {
    return "Not supplied";
  }
  return String(value);
}

export function trimDecimal(value: number): string {
  return value.toFixed(1).replace(".0", "");
}

export function uniqueIds(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function rankEquivalentVehicles(
  vehicles: Vehicle[],
  selected: Vehicle
): Vehicle[] {
  return vehicles
    .filter((vehicle) => vehicle.id !== selected.id)
    .map((vehicle) => ({
      vehicle,
      score:
        Number(vehicle.segment === selected.segment) * 70 +
        Number(vehicle.body_style === selected.body_style) * 35 +
        Number(vehicle.fuel_type !== selected.fuel_type) * 24 +
        Number(vehicle.uk_market_status === "current") * 12 -
        Math.abs(vehicle.purchase_price_gbp - selected.purchase_price_gbp) / 1200 -
        Math.abs(vehicle.model_year - selected.model_year) * 1.5,
    }))
    .sort((a, b) => b.score - a.score)
    .map((item) => item.vehicle);
}
