// Live Octopus Energy product feed.
// Octopus exposes a public REST API at api.octopus.energy that does not
// require authentication for product metadata or display rates.
//
// Docs: https://developer.octopus.energy/docs/api/

export type OctopusTariffSnapshot = {
  product_code: string;
  display_name: string;
  brand: string;
  is_green: boolean;
  available_from: string;
  available_to: string | null;
  region: string;
  unit_rate_p_per_kwh: number;
  off_peak_p_per_kwh: number | null;
  peak_p_per_kwh: number | null;
  standing_charge_p_per_day: number;
  description: string;
  source_url: string;
};

export type OctopusFeed = {
  fetched_at: string;
  source_name: string;
  source_url: string;
  region: string;
  tariffs: OctopusTariffSnapshot[];
  stale: boolean;
  note: string;
};

const OCTOPUS_BASE = "https://api.octopus.energy/v1";

// London region "C" — most populous; users can override via query param.
const DEFAULT_REGION = "C";

// Curated list of Octopus product codes that are interesting for EV drivers.
// We pull each one individually because the public products list is paginated
// and noisy. These IDs are stable and widely referenced in their docs.
const PRODUCT_CODES = [
  "AGILE-24-10-01",
  "GO-VAR-22-10-14",
  "INTELLI-VAR-22-10-14",
  "COSY-22-12-08",
];

const FALLBACK: OctopusFeed = {
  fetched_at: new Date(0).toISOString(),
  source_name: "Octopus Energy public API",
  source_url: "https://developer.octopus.energy/",
  region: DEFAULT_REGION,
  stale: true,
  note: "Live Octopus refresh unavailable; returning curated fallback rates.",
  tariffs: [
    {
      product_code: "AGILE-24-10-01",
      display_name: "Agile Octopus October 2024",
      brand: "OCTOPUS_ENERGY",
      is_green: true,
      available_from: "2024-10-01",
      available_to: null,
      region: DEFAULT_REGION,
      unit_rate_p_per_kwh: 22.5,
      off_peak_p_per_kwh: null,
      peak_p_per_kwh: null,
      standing_charge_p_per_day: 47.85,
      description:
        "Half-hourly variable tariff that tracks wholesale prices, capped at 100p/kWh.",
      source_url: `${OCTOPUS_BASE}/products/AGILE-24-10-01/`,
    },
    {
      product_code: "GO-VAR-22-10-14",
      display_name: "Octopus Go (variable)",
      brand: "OCTOPUS_ENERGY",
      is_green: true,
      available_from: "2022-10-14",
      available_to: null,
      region: DEFAULT_REGION,
      unit_rate_p_per_kwh: 26.0,
      off_peak_p_per_kwh: 8.5,
      peak_p_per_kwh: 26.0,
      standing_charge_p_per_day: 47.85,
      description:
        "EV smart tariff with a 5-hour overnight cheap window for off-peak charging.",
      source_url: `${OCTOPUS_BASE}/products/GO-VAR-22-10-14/`,
    },
    {
      product_code: "INTELLI-VAR-22-10-14",
      display_name: "Intelligent Octopus Go (variable)",
      brand: "OCTOPUS_ENERGY",
      is_green: true,
      available_from: "2022-10-14",
      available_to: null,
      region: DEFAULT_REGION,
      unit_rate_p_per_kwh: 26.0,
      off_peak_p_per_kwh: 7.0,
      peak_p_per_kwh: 26.0,
      standing_charge_p_per_day: 47.85,
      description:
        "Smart EV tariff that schedules charging into 6 hours of low rates each night.",
      source_url: `${OCTOPUS_BASE}/products/INTELLI-VAR-22-10-14/`,
    },
  ],
};

type OctopusProductPayload = {
  code: string;
  display_name: string;
  description: string;
  is_green: boolean;
  brand: string;
  available_from: string;
  available_to: string | null;
  single_register_electricity_tariffs?: Record<string, RegionPayload>;
  dual_register_electricity_tariffs?: Record<string, RegionPayload>;
};

type RegionPayload = {
  direct_debit_monthly?: TariffRates;
  direct_debit_quarterly?: TariffRates;
  varying?: TariffRates;
};

type TariffRates = {
  code: string;
  standard_unit_rate_inc_vat?: number;
  day_unit_rate_inc_vat?: number;
  night_unit_rate_inc_vat?: number;
  standing_charge_inc_vat?: number;
};

function pickRegionRates(
  product: OctopusProductPayload,
  region: string
): TariffRates | null {
  const single = product.single_register_electricity_tariffs?.[`_${region}`];
  const dual = product.dual_register_electricity_tariffs?.[`_${region}`];
  return (
    single?.direct_debit_monthly ??
    single?.varying ??
    dual?.direct_debit_monthly ??
    dual?.varying ??
    null
  );
}

async function fetchProduct(
  code: string,
  region: string
): Promise<OctopusTariffSnapshot | null> {
  const url = `${OCTOPUS_BASE}/products/${code}/`;
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) {
      return null;
    }
    const product = (await response.json()) as OctopusProductPayload;
    const rates = pickRegionRates(product, region);
    if (!rates) {
      return null;
    }
    return {
      product_code: product.code,
      display_name: product.display_name,
      brand: product.brand,
      is_green: product.is_green,
      available_from: product.available_from,
      available_to: product.available_to,
      region,
      unit_rate_p_per_kwh:
        rates.standard_unit_rate_inc_vat ??
        rates.day_unit_rate_inc_vat ??
        Number.NaN,
      off_peak_p_per_kwh: rates.night_unit_rate_inc_vat ?? null,
      peak_p_per_kwh:
        rates.day_unit_rate_inc_vat ??
        rates.standard_unit_rate_inc_vat ??
        null,
      standing_charge_p_per_day: rates.standing_charge_inc_vat ?? Number.NaN,
      description: product.description,
      source_url: url,
    };
  } catch {
    return null;
  }
}

export async function fetchOctopusTariffs(
  region: string = DEFAULT_REGION
): Promise<OctopusFeed> {
  try {
    const results = await Promise.all(
      PRODUCT_CODES.map((code) => fetchProduct(code, region))
    );
    const tariffs = results.filter(
      (item): item is OctopusTariffSnapshot => item !== null
    );

    if (tariffs.length === 0) {
      return {
        ...FALLBACK,
        region,
        fetched_at: new Date().toISOString(),
      };
    }

    return {
      fetched_at: new Date().toISOString(),
      source_name: "Octopus Energy public API",
      source_url: `${OCTOPUS_BASE}/products/`,
      region,
      tariffs,
      stale: false,
      note: `Live unit rates for region ${region}. VAT inclusive.`,
    };
  } catch {
    return {
      ...FALLBACK,
      region,
      fetched_at: new Date().toISOString(),
    };
  }
}
