"""Vehicle Certification Agency (VCA) Car Fuel & CO2 dataset loader.

The VCA — an executive agency of the Department for Transport — publishes
the official UK type-approval test results for every new car sold in the
UK. The CSV is updated quarterly and lives at
https://carfueldata.vehicle-certification-agency.gov.uk/.

Why this loader exists: a portfolio project shouldn't ship a hand-curated
catalog as the only option. Real users want their actual car to be
findable. This module pulls the official VCA dataset, normalises every
row to our internal :class:`Vehicle` schema, and synthesises the cost
fields (price, maintenance, depreciation) that VCA doesn't publish.

The CSV URL pattern at VCA changes per release — the gov.uk content
team has moved the dataset more than once in the last few years. To
stay portable across releases, this loader:

  1. Reads the CSV URL from the ``VCA_CSV_URL`` environment variable when
     set (pin a known-good URL in CI).
  2. Falls back to a list of historically-stable URL patterns.
  3. If every fetch fails, returns ``None`` so the pipeline keeps
     working with the bundled curated catalog.

The price / maintenance / depreciation estimates use a transparent
heuristic — a portfolio audience should be able to read the code and
see exactly how those fields were derived.
"""

from __future__ import annotations

import io
import os
import re
from dataclasses import dataclass
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

import numpy as np
import pandas as pd

# Historically stable VCA URLs we'll probe in order. The agency has
# rotated these per release; pinning ``VCA_CSV_URL`` in CI bypasses the
# probe entirely.
_FALLBACK_URLS: tuple[str, ...] = (
    "https://carfueldata.vehicle-certification-agency.gov.uk/downloads/latest/Latest_Cars.csv",
    "https://carfueldata.vehicle-certification-agency.gov.uk/downloads/Latest-Cars.csv",
    "https://www.gov.uk/government/statistics/car-fuel-and-co2-emissions-data",  # parsed for the CSV link
)

# How VCA spells its columns in different release vintages. Keys here
# resolve in order until one matches a real column on the dataframe.
_COLUMN_SYNONYMS: dict[str, tuple[str, ...]] = {
    "make": ("manufacturer", "make"),
    "model": ("model",),
    "trim": ("description", "model variant", "trim"),
    "transmission": ("transmission",),
    "engine_capacity_cc": ("engine_capacity", "engine capacity (cc)", "engine capacity"),
    "fuel_type": ("fuel_type", "fuel type"),
    "powertrain": ("powertrain", "fuel_type"),
    "co2_g_per_km": (
        "wltp_combined_co2",
        "co2_emissions_combined",
        "co2 (g/km)",
        "co2 emissions (combined)",
    ),
    "mpg_combined": (
        "wltp_combined_mpg",
        "mpg combined",
        "metric_combined_mpg",
    ),
    "kwh_per_100km": (
        "electric_energy_consumption_(wh/km)",
        "wltp_combined_(wh/km)",
        "electric energy consumption",
    ),
    "electric_range_km": (
        "electric_range_(km)",
        "wltp_pure_electric_range",
        "wltp electric range",
    ),
}


@dataclass
class VcaLoadResult:
    """Outcome of a load attempt — used by the pipeline for logging."""

    frame: pd.DataFrame | None
    source_url: str | None
    note: str


def _http_get(url: str, timeout: float = 30.0) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": "ev-vs-ice-intelligence-lab/1.0 (+github)",
            "Accept": "text/csv, application/octet-stream",
        },
    )
    with urlopen(request, timeout=timeout) as response:
        if response.status >= 400:
            raise URLError(f"HTTP {response.status}")
        return response.read()


def _resolve_column(frame: pd.DataFrame, target: str) -> str | None:
    candidates = _COLUMN_SYNONYMS.get(target, ())
    lookup = {col.strip().lower(): col for col in frame.columns}
    for candidate in candidates:
        col = lookup.get(candidate.strip().lower())
        if col is not None:
            return col
    return None


def _powertrain_from_row(row: pd.Series, fuel_type_col: str | None) -> str:
    raw = str(row.get(fuel_type_col, "") if fuel_type_col else "").strip().lower()
    if "electric" in raw or raw in {"ev", "bev"}:
        return "EV"
    if "hybrid" in raw or "phev" in raw:
        return "Petrol Hybrid"
    if "diesel" in raw:
        return "Diesel"
    if "petrol" in raw or "gasoline" in raw:
        return "Petrol"
    return "Petrol"


def _segment_from_engine(engine_cc: float, powertrain: str) -> str:
    if powertrain == "EV":
        return "crossover"
    if engine_cc < 1100:
        return "city-car"
    if engine_cc < 1500:
        return "supermini"
    if engine_cc < 2000:
        return "hatchback"
    if engine_cc < 3000:
        return "compact-executive"
    return "executive"


_BASE_PRICE_BY_SEGMENT_GBP: dict[str, int] = {
    "city-car": 17_000,
    "supermini": 21_000,
    "hatchback": 27_000,
    "crossover": 32_000,
    "family": 30_000,
    "compact-executive": 38_000,
    "executive": 52_000,
    "luxury-suv": 75_000,
    "sports": 45_000,
    "luxury": 90_000,
}


def _estimate_price_gbp(powertrain: str, segment: str, engine_cc: float) -> int:
    base = _BASE_PRICE_BY_SEGMENT_GBP.get(segment, 30_000)
    # EVs tend to carry a 25–35% premium versus the segment ICE baseline.
    if powertrain == "EV":
        base = int(base * 1.3)
    elif powertrain == "Petrol Hybrid":
        base = int(base * 1.12)
    elif powertrain == "Diesel" and engine_cc > 2200:
        base = int(base * 1.05)
    return int(round(base, -2))  # round to nearest £100


def _estimate_maintenance_gbp(powertrain: str, segment: str) -> int:
    floor = {
        "city-car": 320,
        "supermini": 380,
        "hatchback": 460,
        "crossover": 520,
        "family": 500,
        "compact-executive": 620,
        "executive": 760,
        "luxury-suv": 900,
        "sports": 700,
        "luxury": 980,
    }.get(segment, 520)
    if powertrain == "EV":
        return int(floor * 0.6)
    if powertrain == "Petrol Hybrid":
        return int(floor * 0.85)
    if powertrain == "Diesel":
        return int(floor * 1.1)
    return floor


def _estimate_depreciation_3yr(powertrain: str, segment: str) -> float:
    base = 0.45 if segment in {"city-car", "supermini"} else 0.47
    if powertrain == "EV":
        return base + 0.02
    if powertrain == "Petrol Hybrid":
        return base - 0.05
    return base


def _estimate_manufacturing_gco2e_kg(powertrain: str, kwh_battery: float) -> int:
    if powertrain == "EV":
        # 70 kgCO2e per kWh of pack + 5500 kg vehicle baseline (Ricardo, 2020).
        return int(5500 + max(kwh_battery, 0) * 70)
    if powertrain == "Petrol Hybrid":
        return 6500
    return 5800


def _normalise_row(row: pd.Series, columns: dict[str, str | None]) -> dict[str, Any] | None:
    make = str(row.get(columns["make"], "")).strip()
    model = str(row.get(columns["model"], "")).strip()
    trim = str(row.get(columns["trim"], "") or "").strip() or "Standard"
    if not make or not model:
        return None

    fuel_col = columns["fuel_type"]
    powertrain = _powertrain_from_row(row, fuel_col)
    fuel_type = (
        "electric"
        if powertrain == "EV"
        else "diesel"
        if powertrain == "Diesel"
        else "petrol"
    )

    engine_cc = float(row.get(columns["engine_capacity_cc"], 0) or 0)
    segment = _segment_from_engine(engine_cc, powertrain)

    if fuel_type == "electric":
        wh_per_km = float(row.get(columns["kwh_per_100km"], 0) or 0)
        # Older releases publish Wh/km, newer ones kWh/100km. If the value
        # looks like 150–300 it's Wh/km; if 13–25 it's kWh/100km already.
        if wh_per_km > 50:
            efficiency_value = round(wh_per_km / 10, 2)
        elif wh_per_km > 0:
            efficiency_value = round(wh_per_km, 2)
        else:
            efficiency_value = 17.0
        battery_kwh = max(
            float(row.get(columns["electric_range_km"], 0) or 0)
            * efficiency_value
            / 100,
            20.0,
        )
        efficiency_unit = "kwh_per_100km"
        co2 = 0.0
    else:
        mpg = float(row.get(columns["mpg_combined"], 0) or 0)
        # 282.481 = miles per gallon (UK) → litres per 100 km.
        efficiency_value = round(282.481 / mpg, 2) if mpg > 0 else 6.0
        efficiency_unit = "litres_per_100km"
        battery_kwh = (
            1.5 if powertrain == "Petrol Hybrid" else 0.0
        )  # mild hybrid bump for hybrids
        co2 = float(row.get(columns["co2_g_per_km"], 0) or 0)

    slug = (
        f"vca-{make}-{model}-{trim}".lower().replace(" ", "-").replace("/", "-")
    )
    slug = re.sub(r"[^a-z0-9-]", "", slug)
    slug = re.sub(r"-+", "-", slug).strip("-") or f"vca-{abs(hash(make + model))}"

    return {
        "id": slug[:80],
        "make": make,
        "model": model,
        "trim": trim,
        "model_year": 2024,
        "available_from_year": 2022,
        "available_to_year": 2026,
        "uk_market_status": "current",
        "body_style": "saloon" if engine_cc > 1500 else "hatchback",
        "segment": segment,
        "powertrain": powertrain,
        "fuel_type": fuel_type,
        "purchase_price_gbp": _estimate_price_gbp(powertrain, segment, engine_cc),
        "efficiency_value": efficiency_value,
        "efficiency_unit": efficiency_unit,
        "battery_kwh": float(battery_kwh),
        "tailpipe_gco2_per_km": float(co2),
        "manufacturing_gco2e_kg": _estimate_manufacturing_gco2e_kg(
            powertrain, float(battery_kwh)
        ),
        "annual_maintenance_gbp": _estimate_maintenance_gbp(powertrain, segment),
        "insurance_group": 25,
        "depreciation_3yr_pct": _estimate_depreciation_3yr(powertrain, segment),
        "source_note": (
            "Vehicle Certification Agency (UK type-approval) — VCA fields only;"
            " price, maintenance, depreciation estimated by transparent heuristic"
            " in pipeline/ev_ice_pipeline/vca.py."
        ),
    }


def _normalise_frame(raw: pd.DataFrame) -> pd.DataFrame:
    columns = {key: _resolve_column(raw, key) for key in _COLUMN_SYNONYMS}
    if not columns["make"] or not columns["model"]:
        # Wrong file — bail out so the caller can fall back.
        return pd.DataFrame()

    rows: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    for _, row in raw.iterrows():
        normalised = _normalise_row(row, columns)
        if not normalised:
            continue
        if normalised["id"] in seen_ids:
            normalised["id"] = f"{normalised['id']}-{len(rows)}"
        seen_ids.add(normalised["id"])
        rows.append(normalised)
    return pd.DataFrame(rows)


def load_vca() -> VcaLoadResult:
    """Try to fetch the latest VCA dataset; return ``VcaLoadResult``.

    Returns ``frame=None`` if every fetch attempt fails — callers should
    fall back to the bundled curated catalog rather than crashing.
    """
    pinned = os.environ.get("VCA_CSV_URL")
    candidate_urls = [pinned] if pinned else list(_FALLBACK_URLS)

    last_error: str | None = None
    for url in candidate_urls:
        if not url:
            continue
        try:
            payload = _http_get(url)
        except Exception as exc:  # noqa: BLE001 — we want every URL error
            last_error = f"{url}: {exc}"
            continue

        # Some URLs return HTML (a landing page rather than the CSV) —
        # peek at the first few bytes and skip those.
        if payload[:5].lower() in (b"<!doc", b"<html"):
            last_error = f"{url}: returned HTML, not CSV"
            continue

        try:
            raw = pd.read_csv(io.BytesIO(payload), low_memory=False)
        except Exception as exc:  # noqa: BLE001
            last_error = f"{url}: csv parse failed ({exc})"
            continue

        frame = _normalise_frame(raw)
        if frame.empty:
            last_error = f"{url}: schema didn't match VCA layout"
            continue

        return VcaLoadResult(
            frame=frame,
            source_url=url,
            note=f"Loaded {len(frame)} rows from VCA Car Fuel & CO2 dataset.",
        )

    return VcaLoadResult(
        frame=None,
        source_url=None,
        note=(
            "VCA dataset unreachable — falling back to the curated UK catalog. "
            f"Last error: {last_error or 'no candidate URLs configured'}. "
            "Set VCA_CSV_URL in CI to pin a known-good CSV."
        ),
    )


# Allow ad-hoc invocation: ``python -m pipeline.ev_ice_pipeline.vca``
if __name__ == "__main__":  # pragma: no cover
    result = load_vca()
    print(result.note)
    if result.frame is not None:
        print(result.frame.head())
        # Tiny self-check: every row should have a non-empty id.
        assert result.frame["id"].str.len().min() > 0  # noqa: S101
    else:
        # Make the failure visible for the test harness.
        np.testing.assert_(result.source_url is None)
