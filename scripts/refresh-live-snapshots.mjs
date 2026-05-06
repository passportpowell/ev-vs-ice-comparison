// Pulls live data from Octopus Energy + National Grid Carbon Intensity API
// and writes the snapshots to public/data/ so the dashboard can show them
// pre-rendered. Designed for the nightly GitHub Actions cron.
//
// Run: node scripts/refresh-live-snapshots.mjs

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const outDir = resolve(root, "public/data/live");

const OCTOPUS_PRODUCTS = [
  "AGILE-24-10-01",
  "GO-VAR-22-10-14",
  "INTELLI-VAR-22-10-14",
  "COSY-22-12-08",
];
const REGION = "C";

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return response.json();
}

async function fetchOctopus() {
  const tariffs = [];
  for (const code of OCTOPUS_PRODUCTS) {
    try {
      const product = await fetchJson(
        `https://api.octopus.energy/v1/products/${code}/`
      );
      const single = product.single_register_electricity_tariffs?.[`_${REGION}`];
      const dual = product.dual_register_electricity_tariffs?.[`_${REGION}`];
      const rates =
        single?.direct_debit_monthly ??
        single?.varying ??
        dual?.direct_debit_monthly ??
        dual?.varying;
      if (!rates) continue;
      tariffs.push({
        product_code: product.code,
        display_name: product.display_name,
        is_green: product.is_green,
        unit_rate_p_per_kwh:
          rates.standard_unit_rate_inc_vat ??
          rates.day_unit_rate_inc_vat ??
          null,
        off_peak_p_per_kwh: rates.night_unit_rate_inc_vat ?? null,
        peak_p_per_kwh:
          rates.day_unit_rate_inc_vat ??
          rates.standard_unit_rate_inc_vat ??
          null,
        standing_charge_p_per_day: rates.standing_charge_inc_vat ?? null,
        source_url: `https://api.octopus.energy/v1/products/${product.code}/`,
      });
    } catch (err) {
      console.warn(`octopus ${code} failed:`, err.message);
    }
  }
  return {
    fetched_at: new Date().toISOString(),
    region: REGION,
    source_name: "Octopus Energy public API",
    tariffs,
  };
}

async function fetchCarbonIntensity() {
  const intensity = await fetchJson(
    "https://api.carbonintensity.org.uk/intensity"
  );
  const generation = await fetchJson(
    "https://api.carbonintensity.org.uk/generation"
  ).catch(() => null);
  const head = intensity.data[0];
  return {
    fetched_at: new Date().toISOString(),
    from: head.from,
    to: head.to,
    forecast_gco2_per_kwh: head.intensity.forecast,
    actual_gco2_per_kwh: head.intensity.actual,
    index: head.intensity.index,
    generation_mix:
      generation?.data?.generationmix
        ?.filter((row) => row.perc > 0)
        ?.sort((a, b) => b.perc - a.perc)
        ?.map((row) => ({ fuel: row.fuel, percentage: row.perc })) ?? [],
    source_name: "National Grid ESO Carbon Intensity API",
    source_url: "https://api.carbonintensity.org.uk/",
  };
}

async function main() {
  await mkdir(outDir, { recursive: true });

  const tasks = [
    {
      name: "octopus.json",
      fetcher: fetchOctopus,
    },
    {
      name: "carbon-intensity.json",
      fetcher: fetchCarbonIntensity,
    },
  ];

  for (const task of tasks) {
    try {
      const data = await task.fetcher();
      await writeFile(
        resolve(outDir, task.name),
        JSON.stringify(data, null, 2) + "\n",
        "utf8"
      );
      console.log(`wrote ${task.name}`);
    } catch (err) {
      console.error(`failed ${task.name}:`, err.message);
      process.exitCode = 1;
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
