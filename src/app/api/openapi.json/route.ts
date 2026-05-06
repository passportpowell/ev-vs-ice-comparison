import { NextResponse } from "next/server";

import { dataset } from "@/lib/data";

export const dynamic = "force-static";

// ======================================================================
// Reusable schema definitions (kept in TS so they stay in sync with types)
// ======================================================================

const VEHICLE_SCHEMA = {
  type: "object",
  required: ["id", "make", "model", "trim", "powertrain", "fuel_type"],
  properties: {
    id: { type: "string", example: "tesla-model-3-rwd" },
    make: { type: "string", example: "Tesla" },
    model: { type: "string", example: "Model 3" },
    trim: { type: "string", example: "RWD" },
    model_year: { type: "integer", example: 2024 },
    available_from_year: { type: "integer", example: 2021 },
    available_to_year: { type: "integer", example: 2026 },
    uk_market_status: { type: "string", enum: ["current", "used"] },
    body_style: { type: "string", example: "saloon" },
    segment: { type: "string", example: "compact-executive" },
    powertrain: {
      type: "string",
      enum: ["EV", "Petrol", "Diesel", "Petrol Hybrid"],
    },
    fuel_type: { type: "string", enum: ["electric", "petrol", "diesel"] },
    purchase_price_gbp: { type: "number", example: 39990 },
    efficiency_value: { type: "number", example: 14.4 },
    efficiency_unit: {
      type: "string",
      enum: ["kwh_per_100km", "litres_per_100km"],
    },
    battery_kwh: { type: "number", example: 57 },
    tailpipe_gco2_per_km: { type: "number", example: 0 },
    manufacturing_gco2e_kg: { type: "number", example: 9800 },
    annual_maintenance_gbp: { type: "number", example: 360 },
    insurance_group: { type: "integer", example: 48 },
    depreciation_3yr_pct: { type: "number", example: 0.46 },
    source_note: { type: "string" },
  },
};

const SCENARIO_SCHEMA = {
  type: "object",
  properties: {
    scenario_id: { type: "string", example: "mixed_household" },
    label: { type: "string", example: "Mixed household" },
    annual_miles: { type: "integer", example: 12000 },
    ownership_years: { type: "integer", example: 5 },
    urban_share_pct: { type: "integer", example: 42 },
    motorway_share_pct: { type: "integer", example: 34 },
    grid_year: { type: "integer", example: 2026 },
    price_scenario_id: { type: "string" },
    grid_gco2e_per_kwh: { type: "number", example: 95 },
    petrol_gbp_per_litre: { type: "number", example: 1.57 },
    diesel_gbp_per_litre: { type: "number", example: 1.9 },
    home_electricity_gbp_per_kwh: { type: "number", example: 0.22 },
    public_rapid_gbp_per_kwh: { type: "number", example: 0.79 },
    weighted_electricity_gbp_per_kwh: { type: "number" },
    home_charging_share_pct: { type: "integer", example: 80 },
  },
};

const SCENARIO_RESULT_SCHEMA = {
  type: "object",
  properties: {
    scenario_id: { type: "string" },
    vehicle_id: { type: "string" },
    make: { type: "string" },
    model: { type: "string" },
    trim: { type: "string" },
    powertrain: { type: "string" },
    annual_miles: { type: "integer" },
    ownership_years: { type: "integer" },
    adjusted_efficiency: { type: "number" },
    energy_units_used: { type: "number" },
    energy_cost_gbp: { type: "number" },
    maintenance_cost_gbp: { type: "number" },
    depreciation_cost_gbp: { type: "number" },
    total_cost_gbp: { type: "number" },
    total_cost_per_mile_gbp: { type: "number", example: 0.42 },
    annual_energy_cost_gbp: { type: "number", example: 1180 },
    use_phase_kgco2e: { type: "number" },
    manufacturing_kgco2e: { type: "number" },
    lifecycle_kgco2e: { type: "number" },
    lifecycle_tonnes_co2e: { type: "number", example: 12.5 },
    break_even_miles_vs_segment_ice: {
      type: "number",
      nullable: true,
      example: 32500,
    },
  },
};

const TARIFF_SCHEMA = {
  type: "object",
  properties: {
    tariff_id: { type: "string", example: "intelligent-octopus-go" },
    supplier: { type: "string", example: "Octopus Energy" },
    tariff_name: { type: "string", example: "Intelligent Octopus Go" },
    tariff_category: {
      type: "string",
      enum: ["time_of_use", "smart_charging_add_on"],
    },
    off_peak_start: { type: "string", example: "23:30" },
    off_peak_end: { type: "string", example: "05:30" },
    off_peak_hours: { type: "number" },
    default_off_peak_p_per_kwh: { type: "number", example: 7 },
    peak_p_per_kwh: { type: "number", nullable: true, example: 26 },
    standing_charge_p_per_day: { type: "number", example: 47.85 },
    requires_smart_meter: { type: "boolean" },
    requires_compatible_car_or_charger: { type: "boolean" },
    fixed_or_variable: { type: "string", enum: ["fixed", "variable"] },
    source_name: { type: "string" },
    source_url: { type: "string", format: "uri" },
    source_date: { type: "string", format: "date" },
  },
};

const FUEL_PRICE_SCHEMA = {
  type: "object",
  properties: {
    date: { type: "string", example: "27/04/2026" },
    petrol_p_per_litre: { type: "number", example: 156.99 },
    diesel_p_per_litre: { type: "number", example: 189.81 },
    petrol_gbp_per_litre: { type: "number" },
    diesel_gbp_per_litre: { type: "number" },
    duty_p_per_litre: { type: "number" },
    vat_pct: { type: "number" },
    source_name: { type: "string" },
    source_url: { type: "string", format: "uri" },
    fetched_at: { type: "string", format: "date-time" },
    stale: { type: "boolean" },
    note: { type: "string" },
  },
};

const OCTOPUS_TARIFF_SCHEMA = {
  type: "object",
  properties: {
    product_code: { type: "string", example: "INTELLI-VAR-22-10-14" },
    display_name: { type: "string", example: "Intelligent Octopus Go" },
    brand: { type: "string" },
    is_green: { type: "boolean" },
    available_from: { type: "string", format: "date-time" },
    available_to: { type: "string", format: "date-time", nullable: true },
    region: { type: "string", example: "C" },
    unit_rate_p_per_kwh: { type: "number", example: 26 },
    off_peak_p_per_kwh: { type: "number", nullable: true, example: 7 },
    peak_p_per_kwh: { type: "number", nullable: true, example: 26 },
    standing_charge_p_per_day: { type: "number", example: 47.85 },
    description: { type: "string" },
    source_url: { type: "string", format: "uri" },
  },
};

const OCTOPUS_FEED_SCHEMA = {
  type: "object",
  properties: {
    fetched_at: { type: "string", format: "date-time" },
    source_name: { type: "string" },
    source_url: { type: "string", format: "uri" },
    region: { type: "string", example: "C" },
    stale: { type: "boolean" },
    note: { type: "string" },
    tariffs: {
      type: "array",
      items: { $ref: "#/components/schemas/OctopusTariff" },
    },
  },
};

const CARBON_INTENSITY_SCHEMA = {
  type: "object",
  properties: {
    fetched_at: { type: "string", format: "date-time" },
    from: { type: "string", format: "date-time" },
    to: { type: "string", format: "date-time" },
    forecast_gco2_per_kwh: { type: "number", example: 209 },
    actual_gco2_per_kwh: { type: "number", nullable: true, example: 204 },
    index: {
      type: "string",
      enum: ["very low", "low", "moderate", "high", "very high"],
      example: "high",
    },
    generation_mix: {
      type: "array",
      items: {
        type: "object",
        properties: {
          fuel: { type: "string", example: "gas" },
          percentage: { type: "number", example: 44.2 },
        },
      },
    },
    source_name: { type: "string" },
    source_url: { type: "string", format: "uri" },
    stale: { type: "boolean" },
    note: { type: "string" },
  },
};

const ENERGY_COMPARISON_ROW_SCHEMA = {
  type: "object",
  properties: {
    vehicle_id: { type: "string" },
    vehicle: { type: "string" },
    powertrain: { type: "string" },
    fuel_type: { type: "string", enum: ["electric", "petrol", "diesel"] },
    annual_energy_units: { type: "number" },
    energy_unit: { type: "string", enum: ["kWh", "litres"] },
    annual_unit_cost_gbp: { type: "number" },
    annual_standing_cost_gbp: { type: "number" },
    annual_total_cost_gbp: { type: "number" },
    pence_per_mile: { type: "number" },
    unit_rate_label: { type: "string" },
  },
};

const RAG_HIT_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    category: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
    content: { type: "string" },
    source: { type: "string" },
    score: { type: "number", example: 0.4823 },
    matched_terms: { type: "array", items: { type: "string" } },
    related: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          similarity: { type: "number", example: 0.71 },
        },
      },
    },
  },
};

const AGENT_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    query: { type: "string" },
    intent: { type: "string", enum: ["cost", "emissions", "balanced"] },
    scenario_id: { type: "string" },
    answer: { type: "string" },
    recommendation: {
      type: "object",
      nullable: true,
      properties: {
        vehicle_id: { type: "string" },
        vehicle: { type: "string" },
        powertrain: { type: "string" },
        reason: { type: "string" },
        total_cost_per_mile_gbp: { type: "number" },
        lifecycle_tonnes_co2e: { type: "number" },
      },
    },
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          step: { type: "integer" },
          action: { type: "string" },
          observation: { type: "string" },
        },
      },
    },
    citations: {
      type: "array",
      items: { $ref: "#/components/schemas/RagHit" },
    },
  },
};

const HEALTH_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", example: "ok" },
    generated_at: { type: "string", format: "date-time" },
    vehicle_count: { type: "integer" },
    scenario_count: { type: "integer" },
    rag_document_count: { type: "integer" },
    source_count: { type: "integer" },
    catalog_availability_years: {
      type: "object",
      properties: {
        min: { type: "integer" },
        max: { type: "integer" },
      },
    },
  },
};

const CHARGING_STATION_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "integer", example: 12345 },
    title: { type: "string", example: "InstaVolt Westgate" },
    operator: { type: "string", example: "InstaVolt" },
    town: { type: "string", example: "Oxford" },
    postcode: { type: "string", example: "OX1 1NT" },
    country: { type: "string", example: "United Kingdom" },
    lat: { type: "number", example: 51.7517 },
    lng: { type: "number", example: -1.2553 },
    max_power_kw: { type: "number", example: 150 },
    connectors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", example: "CCS" },
          power_kw: { type: "number", example: 150 },
          quantity: { type: "integer", example: 4 },
        },
      },
    },
    is_operational: { type: "boolean" },
    last_verified: { type: "string", format: "date-time", nullable: true },
    source_url: { type: "string", format: "uri" },
  },
};

const CHARGING_FEED_SCHEMA = {
  type: "object",
  properties: {
    fetched_at: { type: "string", format: "date-time" },
    source_name: { type: "string", example: "OpenChargeMap API" },
    source_url: { type: "string", format: "uri" },
    country_code: { type: "string", example: "GB" },
    count: { type: "integer", example: 200 },
    min_power_kw: { type: "number", example: 50 },
    stale: { type: "boolean" },
    note: { type: "string" },
    stations: {
      type: "array",
      items: { $ref: "#/components/schemas/ChargingStation" },
    },
  },
};

const DVLA_IMPORT_SCHEMA = {
  type: "object",
  properties: {
    vehicle: {
      type: "object",
      properties: {
        registration: { type: "string" },
        make: { type: "string" },
        model_year: { type: "integer" },
        fuel_type: { type: "string" },
        co2_g_per_km: { type: "number", nullable: true },
      },
    },
    matches: {
      type: "array",
      items: {
        type: "object",
        properties: {
          vehicle_id: { type: "string" },
          vehicle: { type: "string" },
          confidence: { type: "number" },
          reasons: { type: "array", items: { type: "string" } },
        },
      },
    },
    provenance: {
      type: "object",
      properties: {
        summary: { type: "string" },
        comparisons: {
          type: "array",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              label: { type: "string" },
              status: {
                type: "string",
                enum: [
                  "match",
                  "conflict",
                  "dvla-only",
                  "catalog-only",
                  "not-comparable",
                ],
              },
              message: { type: "string" },
              values: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    source: { type: "string" },
                    value: {
                      oneOf: [
                        { type: "string" },
                        { type: "number" },
                        { type: "null" },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

const ERROR_SCHEMA = {
  type: "object",
  properties: {
    error: { type: "string", example: "registration is required" },
    next_step: { type: "string" },
  },
};

// ======================================================================
// Path operations
// ======================================================================

function jsonResponse(
  description: string,
  schemaRef: string,
  example?: unknown
) {
  return {
    description,
    content: {
      "application/json": {
        schema: { $ref: `#/components/schemas/${schemaRef}` },
        ...(example ? { example } : {}),
      },
    },
  };
}

function jsonInline(
  description: string,
  schema: Record<string, unknown>,
  example?: unknown
) {
  return {
    description,
    content: {
      "application/json": {
        schema,
        ...(example ? { example } : {}),
      },
    },
  };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "EV vs ICE Intelligence Lab API",
      version: "1.0.0",
      summary:
        "REST surface for the UK vehicle TCO + emissions comparison data product.",
      description:
        "Public read-only endpoints powering the dashboard. Live endpoints proxy GOV.UK fuel prices, Octopus Energy tariff metadata, the National Grid Carbon Intensity API, and OpenChargeMap. Static endpoints serve the curated dataset, scenario results, and the RAG/agent advisor.",
      contact: {
        name: "Passport Powell",
        url: "https://github.com/passportpowell/ev-vs-ice-comparison",
      },
      license: { name: "MIT", url: "https://opensource.org/licenses/MIT" },
    },
    servers: [
      { url: origin, description: "Current host" },
      {
        url: "https://ev-ice-intelligence-lab.vercel.app",
        description: "Public Vercel deployment",
      },
    ],
    tags: [
      { name: "Catalog", description: "Vehicles, scenarios, comparisons" },
      { name: "Energy", description: "Live tariff and fuel-price feeds" },
      { name: "Charging", description: "OpenChargeMap-backed charge points" },
      { name: "Intelligence", description: "RAG retrieval and agent advisor" },
      { name: "Operations", description: "Health and metadata" },
    ],
    paths: {
      "/api/health": {
        get: {
          tags: ["Operations"],
          summary: "Service health and dataset freshness",
          operationId: "getHealth",
          responses: {
            "200": jsonResponse("OK", "Health", {
              status: "ok",
              generated_at: dataset.generated_at,
              vehicle_count: dataset.vehicles.length,
              scenario_count: dataset.scenarios.length,
              rag_document_count: dataset.rag_corpus.length,
              source_count: dataset.source_registry.length,
              catalog_availability_years: { min: 2016, max: 2026 },
            }),
          },
        },
      },
      "/api/vehicles": {
        get: {
          tags: ["Catalog"],
          summary: "List the curated UK vehicle catalog",
          operationId: "listVehicles",
          parameters: [
            {
              in: "query",
              name: "powertrain",
              schema: {
                type: "string",
                enum: ["EV", "Petrol", "Diesel", "Petrol Hybrid"],
              },
            },
            { in: "query", name: "make", schema: { type: "string" } },
          ],
          responses: {
            "200": jsonInline(
              "Wrapped vehicle list",
              {
                type: "object",
                properties: {
                  count: { type: "integer", example: 200 },
                  vehicles: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Vehicle" },
                  },
                },
              },
              { count: 1, vehicles: [VEHICLE_SCHEMA.properties] }
            ),
          },
        },
      },
      "/api/scenarios": {
        get: {
          tags: ["Catalog"],
          summary: "Available driving scenarios",
          operationId: "listScenarios",
          responses: {
            "200": jsonInline("Wrapped scenario list", {
              type: "object",
              properties: {
                count: { type: "integer", example: 5 },
                scenarios: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Scenario" },
                },
              },
            }),
          },
        },
      },
      "/api/comparisons": {
        get: {
          tags: ["Catalog"],
          summary: "Compute total cost / lifecycle CO2 for a scenario",
          operationId: "getComparisons",
          parameters: [
            {
              in: "query",
              name: "scenario",
              schema: { type: "string", default: "mixed_household" },
            },
            { in: "query", name: "annualMiles", schema: { type: "integer" } },
            {
              in: "query",
              name: "ownershipYears",
              schema: { type: "integer" },
            },
            {
              in: "query",
              name: "homeChargeSharePct",
              schema: { type: "integer" },
            },
          ],
          responses: {
            "200": jsonInline("Comparison result table", {
              type: "object",
              properties: {
                scenario: { type: "string" },
                count: { type: "integer" },
                results: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ScenarioResult" },
                },
              },
            }),
          },
        },
      },
      "/api/catalog": {
        get: {
          tags: ["Catalog"],
          summary: "Search the catalog by make/model/year/powertrain",
          operationId: "searchCatalog",
          parameters: [
            { in: "query", name: "q", schema: { type: "string" } },
            { in: "query", name: "make", schema: { type: "string" } },
            { in: "query", name: "model", schema: { type: "string" } },
            { in: "query", name: "year", schema: { type: "integer" } },
            { in: "query", name: "powertrain", schema: { type: "string" } },
          ],
          responses: {
            "200": jsonInline("Filtered catalog rows", {
              type: "object",
              properties: {
                count: { type: "integer" },
                total_count: { type: "integer" },
                coverage: {
                  type: "object",
                  properties: {
                    min_model_year: { type: "integer" },
                    max_model_year: { type: "integer" },
                    min_available_year: { type: "integer" },
                    max_available_year: { type: "integer" },
                    current_market_count: { type: "integer" },
                    used_market_count: { type: "integer" },
                    policy: { type: "string" },
                  },
                },
                results: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Vehicle" },
                },
              },
            }),
          },
        },
      },
      "/api/tariffs": {
        get: {
          tags: ["Energy"],
          summary: "EV tariff seed list with off-peak rates",
          operationId: "listTariffs",
          responses: {
            "200": jsonInline("Wrapped tariff list", {
              type: "object",
              properties: {
                count: { type: "integer", example: 13 },
                source_note: { type: "string" },
                tariffs: {
                  type: "array",
                  items: { $ref: "#/components/schemas/Tariff" },
                },
              },
            }),
          },
        },
      },
      "/api/prices/fuel": {
        get: {
          tags: ["Energy"],
          summary: "Live UK petrol and diesel pump prices",
          description:
            "Scrapes the GOV.UK weekly road fuel prices CSV. Returns the latest published row with VAT and duty.",
          operationId: "getFuelPrices",
          responses: {
            "200": jsonResponse(
              "Latest pump prices",
              "FuelPriceSnapshot",
              {
                date: "27/04/2026",
                petrol_p_per_litre: 156.99,
                diesel_p_per_litre: 189.81,
                source_name: "DESNZ weekly road fuel prices",
                stale: false,
              }
            ),
          },
        },
      },
      "/api/prices/electricity": {
        get: {
          tags: ["Energy"],
          summary: "Live Octopus Energy product unit rates",
          operationId: "getElectricityTariffs",
          parameters: [
            {
              in: "query",
              name: "region",
              description:
                "DNO region letter (A-N). Defaults to C — London. See Octopus docs for the regional code map.",
              schema: { type: "string", default: "C", maxLength: 1 },
            },
          ],
          responses: {
            "200": jsonResponse("Octopus tariff snapshot", "OctopusFeed"),
          },
        },
      },
      "/api/prices/carbon-intensity": {
        get: {
          tags: ["Energy"],
          summary: "Live National Grid carbon intensity",
          description:
            "Half-hourly forecast and actual gCO2/kWh for the GB transmission grid, with the current generation mix.",
          operationId: "getCarbonIntensity",
          responses: {
            "200": jsonResponse(
              "Carbon intensity snapshot",
              "CarbonIntensity"
            ),
          },
        },
      },
      "/api/charging-stations": {
        get: {
          tags: ["Charging"],
          summary: "Public charge points from OpenChargeMap",
          operationId: "listChargingStations",
          parameters: [
            {
              in: "query",
              name: "country",
              schema: { type: "string", default: "GB" },
            },
            {
              in: "query",
              name: "minPowerKw",
              description: "Minimum AC/DC power in kW (default 50).",
              schema: { type: "number", default: 50 },
            },
            {
              in: "query",
              name: "limit",
              schema: { type: "integer", default: 250, maximum: 500 },
            },
          ],
          responses: {
            "200": jsonResponse(
              "Charge-point feed",
              "ChargingStationsFeed"
            ),
          },
        },
      },
      "/api/energy-comparison": {
        get: {
          tags: ["Energy"],
          summary: "Per-vehicle annual energy cost using a given tariff",
          operationId: "getEnergyComparison",
          parameters: [
            { in: "query", name: "tariffId", schema: { type: "string" } },
            { in: "query", name: "scenario", schema: { type: "string" } },
            { in: "query", name: "annualMiles", schema: { type: "integer" } },
          ],
          responses: {
            "200": jsonInline("Energy comparison rows", {
              type: "object",
              properties: {
                scenario: { type: "string" },
                selected_tariff: { $ref: "#/components/schemas/Tariff" },
                rows: {
                  type: "array",
                  items: { $ref: "#/components/schemas/EnergyComparisonRow" },
                },
              },
            }),
          },
        },
      },
      "/api/rag": {
        get: {
          tags: ["Intelligence"],
          summary: "TF-IDF + LSA hybrid retrieval over the project corpus",
          description:
            "Returns the top retrieval hits with cosine-similarity scores. The dataset bakes per-doc TF-IDF vectors and LSA semantic neighbours so retrieval is fully deterministic.",
          operationId: "ragSearch",
          parameters: [
            {
              in: "query",
              name: "q",
              required: true,
              schema: { type: "string" },
              example: "best EV for 22000 miles a year",
            },
          ],
          responses: {
            "200": jsonInline("Ranked retrieval hits", {
              type: "object",
              properties: {
                query: { type: "string" },
                count: { type: "integer" },
                answer: { type: "string" },
                hits: {
                  type: "array",
                  items: { $ref: "#/components/schemas/RagHit" },
                },
              },
            }),
            "400": jsonResponse("Missing query", "Error"),
          },
        },
      },
      "/api/agent": {
        get: {
          tags: ["Intelligence"],
          summary: "Agentic advisor: retrieve, plan, compute, cite",
          operationId: "agentAsk",
          parameters: [
            {
              in: "query",
              name: "q",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": jsonResponse(
              "Agent answer with steps",
              "AgentResponse"
            ),
            "400": jsonResponse("Missing query", "Error"),
          },
        },
      },
      "/api/import/dvla": {
        get: {
          tags: ["Catalog"],
          summary: "Lookup a UK registration via the DVLA VES API",
          operationId: "importDvlaVehicle",
          parameters: [
            {
              in: "query",
              name: "registration",
              required: true,
              schema: { type: "string" },
              example: "AB23 CDE",
            },
            {
              in: "query",
              name: "vehicleId",
              schema: { type: "string" },
            },
            { in: "query", name: "model", schema: { type: "string" } },
            { in: "query", name: "trim", schema: { type: "string" } },
          ],
          responses: {
            "200": jsonResponse(
              "DVLA + catalog provenance",
              "DvlaImport"
            ),
            "400": jsonResponse("Missing registration", "Error"),
            "502": jsonResponse(
              "Upstream DVLA API unavailable",
              "Error"
            ),
          },
        },
      },
      "/api/openapi.json": {
        get: {
          tags: ["Operations"],
          summary: "OpenAPI 3.1 spec for this API",
          operationId: "getOpenApiSpec",
          responses: {
            "200": {
              description: "OpenAPI document",
              content: { "application/json": {} },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        Vehicle: VEHICLE_SCHEMA,
        Scenario: SCENARIO_SCHEMA,
        ScenarioResult: SCENARIO_RESULT_SCHEMA,
        Tariff: TARIFF_SCHEMA,
        FuelPriceSnapshot: FUEL_PRICE_SCHEMA,
        OctopusTariff: OCTOPUS_TARIFF_SCHEMA,
        OctopusFeed: OCTOPUS_FEED_SCHEMA,
        CarbonIntensity: CARBON_INTENSITY_SCHEMA,
        EnergyComparisonRow: ENERGY_COMPARISON_ROW_SCHEMA,
        RagHit: RAG_HIT_SCHEMA,
        AgentResponse: AGENT_RESPONSE_SCHEMA,
        Health: HEALTH_SCHEMA,
        ChargingStation: CHARGING_STATION_SCHEMA,
        ChargingStationsFeed: CHARGING_FEED_SCHEMA,
        DvlaImport: DVLA_IMPORT_SCHEMA,
        Error: ERROR_SCHEMA,
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
