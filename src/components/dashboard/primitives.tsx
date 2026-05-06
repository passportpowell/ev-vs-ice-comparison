"use client";

import type { ReactNode } from "react";

import { formatControlValue, money } from "@/lib/format";
import type { ScenarioResult } from "@/lib/types";
import { vehicleDisplayName } from "@/lib/vehicles";

export function RangeField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  prefix = "",
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="control-field range-field">
      <span>
        {label}
        <output>
          {prefix}
          {formatControlValue(value)}
          {suffix}
        </output>
      </span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="range"
        value={value}
      />
    </label>
  );
}

export function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="tariff-field">
      <span>{label}</span>
      <input
        max={max}
        min={min}
        onChange={(event) => onChange(Number(event.target.value))}
        step={step}
        type="number"
        value={value}
      />
    </label>
  );
}

export function MetricTile({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="metric-tile">
      <div className="metric-icon">{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

export function PanelTitle({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="panel-title">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

export function PanelIntro({ children }: { children: ReactNode }) {
  return <p className="panel-intro">{children}</p>;
}

export function VehicleTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ScenarioResult }>;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }
  const row = payload[0].payload;
  return (
    <div className="chart-tooltip">
      <strong>{vehicleDisplayName(row)}</strong>
      <span>
        {row.model_year} {row.powertrain}
      </span>
      <span>{money(row.total_cost_per_mile_gbp)}/mile</span>
      <span>{row.lifecycle_tonnes_co2e} tCO2e</span>
    </div>
  );
}
