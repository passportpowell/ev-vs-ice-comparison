"""Pandera schemas for raw pipeline inputs.

Pandera (https://pandera.readthedocs.io/) gives us declarative dataframe
validation: types, value ranges, regex patterns, uniqueness, and
cross-column constraints. The pipeline calls ``validate_inputs`` at the
top of ``build_dataset`` so a malformed CSV fails fast with a clear,
column-pointing error rather than producing silently wrong analytics.
"""

from __future__ import annotations

import pandera.pandas as pa
from pandera import Check, Column, DataFrameSchema

POWERTRAINS = ["EV", "Petrol", "Diesel", "Petrol Hybrid"]
FUEL_TYPES = ["electric", "petrol", "diesel"]
EFFICIENCY_UNITS = ["kwh_per_100km", "litres_per_100km"]
UK_MARKET_STATUS = ["current", "used"]


vehicles_schema = DataFrameSchema(
    {
        "id": Column(str, Check.str_matches(r"^[a-z0-9-]+$"), unique=True),
        "make": Column(str, Check.str_length(min_value=1)),
        "model": Column(str, Check.str_length(min_value=1)),
        "trim": Column(str, nullable=True, coerce=True),
        "model_year": Column(int, Check.in_range(2000, 2030)),
        "available_from_year": Column(int, Check.in_range(2000, 2030)),
        "available_to_year": Column(int, Check.in_range(2000, 2030)),
        "uk_market_status": Column(str, Check.isin(UK_MARKET_STATUS)),
        "body_style": Column(str),
        "segment": Column(str),
        "powertrain": Column(str, Check.isin(POWERTRAINS)),
        "fuel_type": Column(str, Check.isin(FUEL_TYPES)),
        "purchase_price_gbp": Column(float, Check.in_range(5_000, 250_000), coerce=True),
        "efficiency_value": Column(float, Check.greater_than(0), coerce=True),
        "efficiency_unit": Column(str, Check.isin(EFFICIENCY_UNITS)),
        "battery_kwh": Column(float, Check.in_range(0, 200), coerce=True),
        "tailpipe_gco2_per_km": Column(
            float, Check.in_range(0, 400), coerce=True
        ),
        "manufacturing_gco2e_kg": Column(
            float, Check.in_range(1_000, 30_000), coerce=True
        ),
        "annual_maintenance_gbp": Column(
            float, Check.in_range(100, 2_000), coerce=True
        ),
        "insurance_group": Column(int, Check.in_range(1, 50), coerce=True),
        "depreciation_3yr_pct": Column(
            float, Check.in_range(0.1, 0.7), coerce=True
        ),
        "source_note": Column(str, nullable=True, coerce=True),
    },
    strict=False,
    checks=[
        Check(
            lambda df: (
                # EVs report kWh/100km, ICE/hybrids report litres/100km.
                ((df["fuel_type"] == "electric") & (df["efficiency_unit"] == "kwh_per_100km"))
                | ((df["fuel_type"] != "electric") & (df["efficiency_unit"] == "litres_per_100km"))
            ).all(),
            error="efficiency_unit must match fuel_type (kwh for electric, litres otherwise)",
        ),
        Check(
            lambda df: (df["available_from_year"] <= df["available_to_year"]).all(),
            error="available_from_year must be <= available_to_year",
        ),
    ],
)


energy_prices_schema = DataFrameSchema(
    {
        "price_scenario_id": Column(str, unique=True),
        "price_scenario_name": Column(str),
        "petrol_gbp_per_litre": Column(float, Check.in_range(0.5, 5), coerce=True),
        "diesel_gbp_per_litre": Column(float, Check.in_range(0.5, 5), coerce=True),
        "home_electricity_gbp_per_kwh": Column(
            float, Check.in_range(0.05, 1.5), coerce=True
        ),
        "public_rapid_gbp_per_kwh": Column(
            float, Check.in_range(0.05, 2), coerce=True
        ),
        "home_charging_share_pct": Column(
            int, Check.in_range(0, 100), coerce=True
        ),
    },
    strict=False,
)


tariffs_schema = DataFrameSchema(
    {
        "tariff_id": Column(str, unique=True),
        "supplier": Column(str),
        "tariff_name": Column(str),
        "default_off_peak_p_per_kwh": Column(float, Check.in_range(0, 80), coerce=True),
        "standing_charge_p_per_day": Column(float, Check.in_range(0, 200), coerce=True),
        "fixed_or_variable": Column(str, Check.isin(["fixed", "variable"])),
    },
    strict=False,
)


grid_intensity_schema = DataFrameSchema(
    {
        "year": Column(int, Check.in_range(2015, 2050), coerce=True, unique=True),
        "uk_grid_gco2e_per_kwh": Column(
            float, Check.in_range(20, 600), coerce=True
        ),
    },
    strict=False,
)


scenario_profiles_schema = DataFrameSchema(
    {
        "scenario_id": Column(str, unique=True),
        "label": Column(str),
        "annual_miles": Column(int, Check.in_range(1_000, 60_000), coerce=True),
        "ownership_years": Column(int, Check.in_range(1, 15), coerce=True),
        "urban_share_pct": Column(int, Check.in_range(0, 100), coerce=True),
        "motorway_share_pct": Column(int, Check.in_range(0, 100), coerce=True),
        "grid_year": Column(int, Check.in_range(2015, 2050), coerce=True),
        "price_scenario_id": Column(str),
    },
    strict=False,
    checks=[
        Check(
            lambda df: (
                df["urban_share_pct"] + df["motorway_share_pct"] <= 100
            ).all(),
            error="urban_share_pct + motorway_share_pct must be <= 100",
        ),
    ],
)


driving_cycles_schema = DataFrameSchema(
    {
        "cycle": Column(str),
        "second": Column(int, Check.greater_than_or_equal_to(0), coerce=True),
        "speed_kph": Column(float, Check.in_range(0, 200), coerce=True),
    },
    strict=False,
)


SCHEMAS = {
    "vehicles": vehicles_schema,
    "energy_prices": energy_prices_schema,
    "ev_tariffs": tariffs_schema,
    "grid_intensity": grid_intensity_schema,
    "scenario_profiles": scenario_profiles_schema,
    "driving_cycles": driving_cycles_schema,
}


def validate_inputs(inputs):
    """Validate every raw input frame against its schema.

    Returns the validated dict (pandera coerces dtypes, so callers should
    use the returned frames). Raises ``pa.errors.SchemaError`` with a
    clear column / row pointer if any check fails.
    """
    validated = {}
    for name, frame in inputs.items():
        schema = SCHEMAS.get(name)
        if schema is None:
            validated[name] = frame
            continue
        validated[name] = schema.validate(frame, lazy=True)
    return validated
