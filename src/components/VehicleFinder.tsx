"use client";

import { useEffect, useMemo, useState } from "react";

export type VehicleSpecRanges = {
  battery_kwh?: [number, number];
  kwh_per_100km?: [number, number];
  petrol_mpg_uk?: [number, number];
  diesel_mpg_uk?: [number, number];
};

export type VehiclePick = {
  make: string;
  year: number;
  model: string;
  powertrain: "EV" | "ICE" | "Hybrid" | "Mixed";
  specs?: VehicleSpecRanges;
} | null;

type Props = {
  label: string;
  value: VehiclePick;
  onChange: (next: VehiclePick) => void;
  /** Allow the user to "clear" this pick (compare-with slots) */
  clearable?: boolean;
};

type MakesResponse = {
  count: number;
  makes: Array<{ id: number; name: string }>;
};

type ModelsResponse = {
  count: number;
  models: Array<{
    make: string;
    model: string;
    year: number;
    powertrain: "EV" | "ICE" | "Hybrid" | "Mixed";
    specs?: VehicleSpecRanges;
  }>;
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS: number[] = (() => {
  const out: number[] = [];
  for (let y = CURRENT_YEAR; y >= 1995; y -= 1) out.push(y);
  return out;
})();

let makesPromise: Promise<MakesResponse["makes"]> | null = null;
const modelsCache = new Map<string, Promise<ModelsResponse["models"]>>();

async function loadMakes(): Promise<MakesResponse["makes"]> {
  if (!makesPromise) {
    makesPromise = fetch("/api/vehicles/makes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: MakesResponse) => d.makes);
  }
  return makesPromise;
}

async function loadModels(
  make: string,
  year: number
): Promise<ModelsResponse["models"]> {
  const key = `${make.toLowerCase()}::${year}`;
  let promise = modelsCache.get(key);
  if (!promise) {
    promise = fetch(
      `/api/vehicles/models?make=${encodeURIComponent(make)}&year=${year}`,
      { cache: "no-store" }
    )
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: ModelsResponse) => d.models);
    modelsCache.set(key, promise);
  }
  return promise;
}

export function VehicleFinder({ label, value, onChange, clearable = false }: Props) {
  const [makes, setMakes] = useState<MakesResponse["makes"]>([]);
  const [makesError, setMakesError] = useState<string | null>(null);
  const [models, setModels] = useState<ModelsResponse["models"]>([]);
  const [modelsError, setModelsError] = useState<string | null>(null);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Cascading state — keep make+year locally so the user can pick a year
  // before choosing a model. Once a model is picked we lift it to the
  // parent via onChange.
  const [pendingMake, setPendingMake] = useState<string>(value?.make ?? "");
  const [pendingYear, setPendingYear] = useState<number>(
    value?.year ?? CURRENT_YEAR
  );

  useEffect(() => {
    let active = true;
    loadMakes()
      .then((data) => {
        if (active) setMakes(data);
      })
      .catch((err: unknown) => {
        if (active) setMakesError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingMake) return;
    let active = true;
    loadModels(pendingMake, pendingYear)
      .then((data) => {
        if (!active) return;
        setModels(data);
        setModelsError(null);
        setModelsLoading(false);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setModelsError(err instanceof Error ? err.message : String(err));
        setModels([]);
        setModelsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pendingMake, pendingYear]);

  const modelOptions = useMemo(() => {
    return models.map((m) => m.model);
  }, [models]);

  function applyModel(model: string) {
    if (!model) {
      onChange(null);
      return;
    }
    const meta = models.find((m) => m.model === model);
    onChange({
      make: pendingMake,
      year: pendingYear,
      model,
      powertrain: meta?.powertrain ?? "ICE",
      ...(meta?.specs ? { specs: meta.specs } : {}),
    });
  }

  function applyMake(make: string) {
    setPendingMake(make);
    setModelsLoading(true);
    if (value && value.make !== make) {
      onChange(null);
    }
  }

  function applyYear(year: number) {
    setPendingYear(year);
    setModelsLoading(true);
    if (value && value.year !== year) {
      onChange({ ...value, year });
    }
  }

  return (
    <div className="vehicle-finder">
      <span className="vehicle-finder-label">{label}</span>
      <div className="vehicle-finder-row">
        <label>
          <span>Make</span>
          <select
            value={pendingMake}
            onChange={(event) => applyMake(event.target.value)}
          >
            <option value="">
              {makesError ? "(Catalog unreachable)" : makes.length === 0 ? "Loading…" : "Select…"}
            </option>
            {makes.map((make) => (
              <option key={make.id} value={make.name}>
                {make.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Year</span>
          <select
            value={pendingYear}
            onChange={(event) => applyYear(Number(event.target.value))}
          >
            {YEAR_OPTIONS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Model</span>
          <select
            disabled={!pendingMake || modelsLoading}
            value={value?.model ?? ""}
            onChange={(event) => applyModel(event.target.value)}
          >
            <option value="">
              {!pendingMake
                ? "Pick a make first"
                : modelsError
                  ? "(Catalog unreachable)"
                  : modelsLoading
                    ? "Loading…"
                    : modelOptions.length === 0
                      ? `No ${pendingYear} models — try a different year`
                      : "Select…"}
            </option>
            {modelOptions.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </label>
      </div>
      {clearable && value ? (
        <button
          type="button"
          className="vehicle-finder-clear"
          onClick={() => {
            setPendingMake("");
            setPendingYear(CURRENT_YEAR);
            onChange(null);
          }}
        >
          Clear
        </button>
      ) : null}
    </div>
  );
}
