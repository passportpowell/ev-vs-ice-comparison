// Expands the curated UK vehicle catalog so the dashboard reflects more brands.
// Run: node scripts/expand-catalog.mjs
// Updates: data/raw/vehicles.csv, data/processed/portfolio-dataset.json,
//          src/data/portfolio-dataset.json
//
// Prices/efficiency are realistic 2024 UK list-price approximations using
// public WLTP-style ranges (curated demo data — same convention as the
// original seed CSV).

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const csvPath = resolve(root, "data/raw/vehicles.csv");
const jsonPaths = [
  resolve(root, "src/data/portfolio-dataset.json"),
  resolve(root, "data/processed/portfolio-dataset.json"),
];

const NOTE = "Curated UK demo trim estimate using public 2024 list price and WLTP style assumptions";

// Helpers to keep the entry list compact.
const ev = (o) => ({
  uk_market_status: "current",
  powertrain: "EV",
  fuel_type: "electric",
  efficiency_unit: "kwh_per_100km",
  tailpipe_gco2_per_km: 0,
  source_note: NOTE,
  ...o,
});
const petrol = (o) => ({
  uk_market_status: "current",
  powertrain: "Petrol",
  fuel_type: "petrol",
  efficiency_unit: "litres_per_100km",
  battery_kwh: 0,
  source_note: NOTE,
  ...o,
});
const diesel = (o) => ({
  uk_market_status: "current",
  powertrain: "Diesel",
  fuel_type: "diesel",
  efficiency_unit: "litres_per_100km",
  battery_kwh: 0,
  source_note: NOTE,
  ...o,
});
const hybrid = (o) => ({
  uk_market_status: "current",
  powertrain: "Petrol Hybrid",
  fuel_type: "petrol",
  efficiency_unit: "litres_per_100km",
  source_note: NOTE,
  ...o,
});

// Catalog of additions — ~125 entries spread across major UK brands.
// Fields: id, make, model, trim, model_year, available_from_year,
//   available_to_year, body_style, segment, purchase_price_gbp,
//   efficiency_value, battery_kwh, manufacturing_gco2e_kg,
//   annual_maintenance_gbp, insurance_group, depreciation_3yr_pct,
//   tailpipe_gco2_per_km (ICE / hybrid only)
const NEW_VEHICLES = [
  // ---------------- BYD ----------------
  ev({ id: "byd-atto-3-design", make: "BYD", model: "Atto 3", trim: "Design", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 36900, efficiency_value: 16.4, battery_kwh: 60.5, manufacturing_gco2e_kg: 10300, annual_maintenance_gbp: 320, insurance_group: 30, depreciation_3yr_pct: 0.50 }),
  ev({ id: "byd-dolphin-design", make: "BYD", model: "Dolphin", trim: "Design", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "hatchback", segment: "supermini", purchase_price_gbp: 30205, efficiency_value: 15.9, battery_kwh: 60.4, manufacturing_gco2e_kg: 9500, annual_maintenance_gbp: 305, insurance_group: 26, depreciation_3yr_pct: 0.49 }),
  ev({ id: "byd-seal-design", make: "BYD", model: "Seal", trim: "Design", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "saloon", segment: "compact-executive", purchase_price_gbp: 45695, efficiency_value: 16.6, battery_kwh: 82.5, manufacturing_gco2e_kg: 11800, annual_maintenance_gbp: 380, insurance_group: 38, depreciation_3yr_pct: 0.48 }),
  ev({ id: "byd-seal-u-comfort", make: "BYD", model: "Seal U", trim: "Comfort", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 42990, efficiency_value: 18.4, battery_kwh: 71.8, manufacturing_gco2e_kg: 11500, annual_maintenance_gbp: 370, insurance_group: 32, depreciation_3yr_pct: 0.49 }),

  // ---------------- Tesla extras ----------------
  ev({ id: "tesla-model-3-performance", make: "Tesla", model: "Model 3", trim: "Performance AWD", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "saloon", segment: "compact-executive", purchase_price_gbp: 59990, efficiency_value: 16.6, battery_kwh: 79, manufacturing_gco2e_kg: 11900, annual_maintenance_gbp: 430, insurance_group: 50, depreciation_3yr_pct: 0.47 }),
  ev({ id: "tesla-model-s-long-range", make: "Tesla", model: "Model S", trim: "Long Range AWD", model_year: 2024, available_from_year: 2021, available_to_year: 2026, body_style: "fastback", segment: "executive", purchase_price_gbp: 89990, efficiency_value: 17.4, battery_kwh: 100, manufacturing_gco2e_kg: 14200, annual_maintenance_gbp: 540, insurance_group: 50, depreciation_3yr_pct: 0.50 }),
  ev({ id: "tesla-model-x-long-range", make: "Tesla", model: "Model X", trim: "Long Range AWD", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 99990, efficiency_value: 19.6, battery_kwh: 100, manufacturing_gco2e_kg: 15400, annual_maintenance_gbp: 580, insurance_group: 50, depreciation_3yr_pct: 0.50 }),

  // ---------------- BMW extras ----------------
  ev({ id: "bmw-i5-edrive40", make: "BMW", model: "i5", trim: "eDrive40 M Sport", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "saloon", segment: "executive", purchase_price_gbp: 74365, efficiency_value: 17.5, battery_kwh: 84, manufacturing_gco2e_kg: 13400, annual_maintenance_gbp: 510, insurance_group: 45, depreciation_3yr_pct: 0.49 }),
  ev({ id: "bmw-ix-xdrive50", make: "BMW", model: "iX", trim: "xDrive50 M Sport", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 100440, efficiency_value: 19.5, battery_kwh: 111.5, manufacturing_gco2e_kg: 16100, annual_maintenance_gbp: 620, insurance_group: 50, depreciation_3yr_pct: 0.51 }),
  ev({ id: "bmw-ix3-m-sport", make: "BMW", model: "iX3", trim: "M Sport Pro", model_year: 2024, available_from_year: 2021, available_to_year: 2025, body_style: "suv", segment: "crossover", purchase_price_gbp: 65495, efficiency_value: 18.8, battery_kwh: 80, manufacturing_gco2e_kg: 12600, annual_maintenance_gbp: 460, insurance_group: 43, depreciation_3yr_pct: 0.49 }),
  petrol({ id: "bmw-x1-sdrive20i-m-sport", make: "BMW", model: "X1", trim: "sDrive20i M Sport", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 41435, efficiency_value: 6.3, tailpipe_gco2_per_km: 144, manufacturing_gco2e_kg: 6900, annual_maintenance_gbp: 580, insurance_group: 28, depreciation_3yr_pct: 0.43 }),
  hybrid({ id: "bmw-x5-xdrive50e", make: "BMW", model: "X5", trim: "xDrive50e M Sport", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 79390, efficiency_value: 1.4, battery_kwh: 25.7, tailpipe_gco2_per_km: 32, manufacturing_gco2e_kg: 13900, annual_maintenance_gbp: 760, insurance_group: 50, depreciation_3yr_pct: 0.48 }),
  petrol({ id: "bmw-118-m-sport", make: "BMW", model: "1 Series", trim: "118 M Sport", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "hatchback", segment: "compact-executive", purchase_price_gbp: 32500, efficiency_value: 6.1, tailpipe_gco2_per_km: 138, manufacturing_gco2e_kg: 6500, annual_maintenance_gbp: 580, insurance_group: 25, depreciation_3yr_pct: 0.43 }),

  // ---------------- Audi extras ----------------
  ev({ id: "audi-q6-etron-quattro", make: "Audi", model: "Q6 e-tron", trim: "quattro", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 68975, efficiency_value: 17.3, battery_kwh: 100, manufacturing_gco2e_kg: 13400, annual_maintenance_gbp: 530, insurance_group: 47, depreciation_3yr_pct: 0.50 }),
  ev({ id: "audi-q8-etron-50", make: "Audi", model: "Q8 e-tron", trim: "50 Sport", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 71775, efficiency_value: 21.5, battery_kwh: 95, manufacturing_gco2e_kg: 13900, annual_maintenance_gbp: 560, insurance_group: 49, depreciation_3yr_pct: 0.51 }),
  ev({ id: "audi-etron-gt-quattro", make: "Audi", model: "e-tron GT", trim: "quattro", model_year: 2024, available_from_year: 2021, available_to_year: 2026, body_style: "fastback", segment: "executive", purchase_price_gbp: 89500, efficiency_value: 19.2, battery_kwh: 93.4, manufacturing_gco2e_kg: 14000, annual_maintenance_gbp: 580, insurance_group: 50, depreciation_3yr_pct: 0.50 }),
  petrol({ id: "audi-a1-30-tfsi", make: "Audi", model: "A1", trim: "30 TFSI Sport", model_year: 2023, available_from_year: 2018, available_to_year: 2025, body_style: "hatchback", segment: "supermini", purchase_price_gbp: 23900, efficiency_value: 5.3, tailpipe_gco2_per_km: 121, manufacturing_gco2e_kg: 5400, annual_maintenance_gbp: 480, insurance_group: 16, depreciation_3yr_pct: 0.43 }),
  petrol({ id: "audi-a4-40-tfsi-sport", make: "Audi", model: "A4", trim: "40 TFSI Sport", model_year: 2023, available_from_year: 2016, available_to_year: 2025, body_style: "saloon", segment: "compact-executive", purchase_price_gbp: 41500, efficiency_value: 6.4, tailpipe_gco2_per_km: 144, manufacturing_gco2e_kg: 7000, annual_maintenance_gbp: 660, insurance_group: 31, depreciation_3yr_pct: 0.46 }),
  diesel({ id: "audi-a6-40-tdi-sport", make: "Audi", model: "A6", trim: "40 TDI Sport", model_year: 2023, available_from_year: 2018, available_to_year: 2026, body_style: "saloon", segment: "executive", purchase_price_gbp: 49000, efficiency_value: 5.4, tailpipe_gco2_per_km: 142, manufacturing_gco2e_kg: 8200, annual_maintenance_gbp: 750, insurance_group: 38, depreciation_3yr_pct: 0.46 }),
  petrol({ id: "audi-q3-35-tfsi", make: "Audi", model: "Q3", trim: "35 TFSI Sport", model_year: 2024, available_from_year: 2018, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 38000, efficiency_value: 6.4, tailpipe_gco2_per_km: 145, manufacturing_gco2e_kg: 7100, annual_maintenance_gbp: 600, insurance_group: 24, depreciation_3yr_pct: 0.43 }),
  petrol({ id: "audi-q7-50-tfsi", make: "Audi", model: "Q7", trim: "50 TFSI quattro", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 67000, efficiency_value: 9.6, tailpipe_gco2_per_km: 218, manufacturing_gco2e_kg: 9700, annual_maintenance_gbp: 880, insurance_group: 47, depreciation_3yr_pct: 0.49 }),

  // ---------------- Mercedes-Benz extras ----------------
  ev({ id: "mercedes-eqe-300", make: "Mercedes-Benz", model: "EQE", trim: "300 AMG Line", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "saloon", segment: "executive", purchase_price_gbp: 74480, efficiency_value: 17.0, battery_kwh: 89, manufacturing_gco2e_kg: 13200, annual_maintenance_gbp: 520, insurance_group: 47, depreciation_3yr_pct: 0.51 }),
  ev({ id: "mercedes-eqs-450", make: "Mercedes-Benz", model: "EQS", trim: "450+ AMG Line", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "saloon", segment: "luxury", purchase_price_gbp: 102640, efficiency_value: 17.5, battery_kwh: 108.4, manufacturing_gco2e_kg: 15400, annual_maintenance_gbp: 620, insurance_group: 50, depreciation_3yr_pct: 0.53 }),
  ev({ id: "mercedes-eqb-300-amg-line", make: "Mercedes-Benz", model: "EQB", trim: "300 4MATIC AMG Line", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 56400, efficiency_value: 19.7, battery_kwh: 70.5, manufacturing_gco2e_kg: 11700, annual_maintenance_gbp: 470, insurance_group: 40, depreciation_3yr_pct: 0.50 }),
  petrol({ id: "mercedes-e220-amg-line", make: "Mercedes-Benz", model: "E-Class", trim: "E220 AMG Line", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "saloon", segment: "executive", purchase_price_gbp: 56000, efficiency_value: 6.4, tailpipe_gco2_per_km: 146, manufacturing_gco2e_kg: 8200, annual_maintenance_gbp: 770, insurance_group: 41, depreciation_3yr_pct: 0.46 }),
  petrol({ id: "mercedes-gla-200-amg-line", make: "Mercedes-Benz", model: "GLA", trim: "200 AMG Line", model_year: 2024, available_from_year: 2020, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 38000, efficiency_value: 6.6, tailpipe_gco2_per_km: 151, manufacturing_gco2e_kg: 6900, annual_maintenance_gbp: 620, insurance_group: 26, depreciation_3yr_pct: 0.44 }),

  // ---------------- Porsche ----------------
  ev({ id: "porsche-taycan-rwd", make: "Porsche", model: "Taycan", trim: "RWD", model_year: 2024, available_from_year: 2020, available_to_year: 2026, body_style: "fastback", segment: "executive", purchase_price_gbp: 86500, efficiency_value: 17.6, battery_kwh: 89, manufacturing_gco2e_kg: 13400, annual_maintenance_gbp: 620, insurance_group: 50, depreciation_3yr_pct: 0.49 }),
  ev({ id: "porsche-macan-electric", make: "Porsche", model: "Macan", trim: "Electric", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 69800, efficiency_value: 18.6, battery_kwh: 100, manufacturing_gco2e_kg: 13700, annual_maintenance_gbp: 580, insurance_group: 49, depreciation_3yr_pct: 0.48 }),
  petrol({ id: "porsche-cayenne-v6", make: "Porsche", model: "Cayenne", trim: "V6", model_year: 2024, available_from_year: 2018, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 76000, efficiency_value: 10.5, tailpipe_gco2_per_km: 240, manufacturing_gco2e_kg: 10100, annual_maintenance_gbp: 990, insurance_group: 50, depreciation_3yr_pct: 0.45 }),

  // ---------------- Polestar ----------------
  ev({ id: "polestar-3-long-range", make: "Polestar", model: "3", trim: "Long Range Single Motor", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 73900, efficiency_value: 18.6, battery_kwh: 111, manufacturing_gco2e_kg: 14200, annual_maintenance_gbp: 480, insurance_group: 47, depreciation_3yr_pct: 0.49 }),
  ev({ id: "polestar-4-long-range", make: "Polestar", model: "4", trim: "Long Range Single Motor", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv-coupe", segment: "compact-executive", purchase_price_gbp: 59990, efficiency_value: 17.0, battery_kwh: 100, manufacturing_gco2e_kg: 13200, annual_maintenance_gbp: 460, insurance_group: 45, depreciation_3yr_pct: 0.48 }),

  // ---------------- Genesis ----------------
  ev({ id: "genesis-gv60-premium", make: "Genesis", model: "GV60", trim: "Premium", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "suv-coupe", segment: "crossover", purchase_price_gbp: 53905, efficiency_value: 17.5, battery_kwh: 77.4, manufacturing_gco2e_kg: 11600, annual_maintenance_gbp: 470, insurance_group: 41, depreciation_3yr_pct: 0.51 }),
  ev({ id: "genesis-electrified-gv70", make: "Genesis", model: "Electrified GV70", trim: "Sport", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 65750, efficiency_value: 19.4, battery_kwh: 77.4, manufacturing_gco2e_kg: 12200, annual_maintenance_gbp: 510, insurance_group: 45, depreciation_3yr_pct: 0.52 }),

  // ---------------- Jaguar ----------------
  ev({ id: "jaguar-i-pace-r-dynamic", make: "Jaguar", model: "I-Pace", trim: "R-Dynamic Black", model_year: 2024, available_from_year: 2018, available_to_year: 2025, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 75290, efficiency_value: 22.0, battery_kwh: 90, manufacturing_gco2e_kg: 13800, annual_maintenance_gbp: 620, insurance_group: 50, depreciation_3yr_pct: 0.55 }),
  petrol({ id: "jaguar-f-pace-p250", make: "Jaguar", model: "F-Pace", trim: "P250 R-Dynamic SE", model_year: 2024, available_from_year: 2017, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 60000, efficiency_value: 8.5, tailpipe_gco2_per_km: 195, manufacturing_gco2e_kg: 9000, annual_maintenance_gbp: 800, insurance_group: 42, depreciation_3yr_pct: 0.49 }),

  // ---------------- Lexus extras ----------------
  ev({ id: "lexus-rz-450e-premium", make: "Lexus", model: "RZ", trim: "450e Premium", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 64500, efficiency_value: 19.0, battery_kwh: 71.4, manufacturing_gco2e_kg: 11900, annual_maintenance_gbp: 480, insurance_group: 42, depreciation_3yr_pct: 0.50 }),
  hybrid({ id: "lexus-ux-300h-premium", make: "Lexus", model: "UX", trim: "300h Premium", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "crossover", segment: "crossover", purchase_price_gbp: 36500, efficiency_value: 4.7, battery_kwh: 1.0, tailpipe_gco2_per_km: 106, manufacturing_gco2e_kg: 6500, annual_maintenance_gbp: 480, insurance_group: 28, depreciation_3yr_pct: 0.39 }),
  hybrid({ id: "lexus-rx-350h-premium", make: "Lexus", model: "RX", trim: "350h Premium", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 64000, efficiency_value: 6.2, battery_kwh: 1.9, tailpipe_gco2_per_km: 140, manufacturing_gco2e_kg: 9100, annual_maintenance_gbp: 720, insurance_group: 44, depreciation_3yr_pct: 0.43 }),
  hybrid({ id: "lexus-lbx-emotion", make: "Lexus", model: "LBX", trim: "Emotion", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 30000, efficiency_value: 4.5, battery_kwh: 0.9, tailpipe_gco2_per_km: 102, manufacturing_gco2e_kg: 5800, annual_maintenance_gbp: 460, insurance_group: 18, depreciation_3yr_pct: 0.40 }),

  // ---------------- Honda ----------------
  ev({ id: "honda-eny1-advance", make: "Honda", model: "e:Ny1", trim: "Advance", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 44995, efficiency_value: 18.2, battery_kwh: 68.8, manufacturing_gco2e_kg: 11400, annual_maintenance_gbp: 380, insurance_group: 30, depreciation_3yr_pct: 0.50 }),
  hybrid({ id: "honda-civic-e-hev-advance", make: "Honda", model: "Civic", trim: "e:HEV Advance", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "hatchback", segment: "family", purchase_price_gbp: 35400, efficiency_value: 4.8, battery_kwh: 1.05, tailpipe_gco2_per_km: 108, manufacturing_gco2e_kg: 6500, annual_maintenance_gbp: 470, insurance_group: 22, depreciation_3yr_pct: 0.40 }),
  hybrid({ id: "honda-cr-v-e-hev-advance", make: "Honda", model: "CR-V", trim: "e:HEV Advance", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 50000, efficiency_value: 6.4, battery_kwh: 1.06, tailpipe_gco2_per_km: 144, manufacturing_gco2e_kg: 7800, annual_maintenance_gbp: 580, insurance_group: 32, depreciation_3yr_pct: 0.42 }),
  hybrid({ id: "honda-hr-v-e-hev-advance", make: "Honda", model: "HR-V", trim: "e:HEV Advance", model_year: 2024, available_from_year: 2021, available_to_year: 2026, body_style: "crossover", segment: "crossover", purchase_price_gbp: 33800, efficiency_value: 5.0, battery_kwh: 1.06, tailpipe_gco2_per_km: 113, manufacturing_gco2e_kg: 6400, annual_maintenance_gbp: 480, insurance_group: 24, depreciation_3yr_pct: 0.40 }),

  // ---------------- Toyota extras ----------------
  ev({ id: "toyota-bz4x-vision", make: "Toyota", model: "bZ4X", trim: "Vision", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 47600, efficiency_value: 18.2, battery_kwh: 71.4, manufacturing_gco2e_kg: 11700, annual_maintenance_gbp: 380, insurance_group: 32, depreciation_3yr_pct: 0.50 }),
  hybrid({ id: "toyota-rav4-hybrid-design", make: "Toyota", model: "RAV4", trim: "2.5 Hybrid Design", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 39000, efficiency_value: 5.7, battery_kwh: 1.6, tailpipe_gco2_per_km: 130, manufacturing_gco2e_kg: 7400, annual_maintenance_gbp: 510, insurance_group: 30, depreciation_3yr_pct: 0.39 }),
  hybrid({ id: "toyota-c-hr-hybrid-design", make: "Toyota", model: "C-HR", trim: "1.8 Hybrid Design", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "crossover", segment: "crossover", purchase_price_gbp: 31500, efficiency_value: 4.7, battery_kwh: 1.1, tailpipe_gco2_per_km: 105, manufacturing_gco2e_kg: 6300, annual_maintenance_gbp: 470, insurance_group: 22, depreciation_3yr_pct: 0.39 }),
  hybrid({ id: "toyota-yaris-cross-hybrid", make: "Toyota", model: "Yaris Cross", trim: "1.5 Hybrid Design", model_year: 2024, available_from_year: 2021, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 26000, efficiency_value: 4.4, battery_kwh: 0.8, tailpipe_gco2_per_km: 100, manufacturing_gco2e_kg: 5900, annual_maintenance_gbp: 450, insurance_group: 16, depreciation_3yr_pct: 0.38 }),
  petrol({ id: "toyota-aygo-x-edge", make: "Toyota", model: "Aygo X", trim: "1.0 VVT-i Edge", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "hatchback", segment: "city-car", purchase_price_gbp: 17000, efficiency_value: 4.7, tailpipe_gco2_per_km: 108, manufacturing_gco2e_kg: 4800, annual_maintenance_gbp: 380, insurance_group: 8, depreciation_3yr_pct: 0.41 }),

  // ---------------- Mazda ----------------
  ev({ id: "mazda-mx-30-r-ev", make: "Mazda", model: "MX-30", trim: "R-EV Makoto", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "crossover", segment: "crossover", purchase_price_gbp: 35500, efficiency_value: 17.5, battery_kwh: 17.8, manufacturing_gco2e_kg: 7200, annual_maintenance_gbp: 470, insurance_group: 26, depreciation_3yr_pct: 0.52 }),
  petrol({ id: "mazda-cx-5-skyactiv-g", make: "Mazda", model: "CX-5", trim: "2.0 e-Skyactiv G Centre-Line", model_year: 2024, available_from_year: 2017, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 30900, efficiency_value: 6.7, tailpipe_gco2_per_km: 152, manufacturing_gco2e_kg: 7100, annual_maintenance_gbp: 540, insurance_group: 23, depreciation_3yr_pct: 0.42 }),
  petrol({ id: "mazda-cx-30-skyactiv-g", make: "Mazda", model: "CX-30", trim: "2.0 e-Skyactiv X Homura", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "crossover", segment: "crossover", purchase_price_gbp: 30000, efficiency_value: 5.6, tailpipe_gco2_per_km: 128, manufacturing_gco2e_kg: 6500, annual_maintenance_gbp: 510, insurance_group: 20, depreciation_3yr_pct: 0.42 }),
  petrol({ id: "mazda-mx-5-exclusive-line", make: "Mazda", model: "MX-5", trim: "1.5 Exclusive-Line", model_year: 2024, available_from_year: 2016, available_to_year: 2026, body_style: "convertible", segment: "sports", purchase_price_gbp: 28335, efficiency_value: 6.2, tailpipe_gco2_per_km: 142, manufacturing_gco2e_kg: 5900, annual_maintenance_gbp: 520, insurance_group: 26, depreciation_3yr_pct: 0.40 }),

  // ---------------- Suzuki ----------------
  hybrid({ id: "suzuki-swift-mhev", make: "Suzuki", model: "Swift", trim: "1.2 MHEV Motion", model_year: 2024, available_from_year: 2017, available_to_year: 2026, body_style: "hatchback", segment: "supermini", purchase_price_gbp: 18700, efficiency_value: 4.4, battery_kwh: 0.5, tailpipe_gco2_per_km: 100, manufacturing_gco2e_kg: 4500, annual_maintenance_gbp: 360, insurance_group: 11, depreciation_3yr_pct: 0.40 }),
  hybrid({ id: "suzuki-vitara-hybrid", make: "Suzuki", model: "Vitara", trim: "1.5 Full Hybrid Ultra", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "crossover", segment: "crossover", purchase_price_gbp: 27200, efficiency_value: 5.2, battery_kwh: 0.84, tailpipe_gco2_per_km: 118, manufacturing_gco2e_kg: 5800, annual_maintenance_gbp: 460, insurance_group: 17, depreciation_3yr_pct: 0.43 }),

  // ---------------- MG extras ----------------
  ev({ id: "mg-zs-ev-trophy", make: "MG", model: "ZS EV", trim: "Trophy Long Range", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 32495, efficiency_value: 17.1, battery_kwh: 72.6, manufacturing_gco2e_kg: 9800, annual_maintenance_gbp: 320, insurance_group: 27, depreciation_3yr_pct: 0.45 }),
  ev({ id: "mg-mg5-ev-trophy", make: "MG", model: "MG5 EV", trim: "Trophy Long Range", model_year: 2024, available_from_year: 2020, available_to_year: 2025, body_style: "estate", segment: "family", purchase_price_gbp: 30995, efficiency_value: 17.5, battery_kwh: 61.1, manufacturing_gco2e_kg: 9200, annual_maintenance_gbp: 320, insurance_group: 25, depreciation_3yr_pct: 0.46 }),
  ev({ id: "mg-cyberster-trophy", make: "MG", model: "Cyberster", trim: "Trophy", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "convertible", segment: "sports", purchase_price_gbp: 54995, efficiency_value: 18.5, battery_kwh: 64, manufacturing_gco2e_kg: 11200, annual_maintenance_gbp: 470, insurance_group: 42, depreciation_3yr_pct: 0.48 }),
  hybrid({ id: "mg-mg3-hybrid-plus", make: "MG", model: "MG3", trim: "Hybrid+ Trophy", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "hatchback", segment: "supermini", purchase_price_gbp: 18495, efficiency_value: 4.4, battery_kwh: 1.83, tailpipe_gco2_per_km: 100, manufacturing_gco2e_kg: 5300, annual_maintenance_gbp: 360, insurance_group: 14, depreciation_3yr_pct: 0.42 }),

  // ---------------- Ford extras ----------------
  ev({ id: "ford-mustang-mach-e-extended", make: "Ford", model: "Mustang Mach-E", trim: "Extended Range RWD", model_year: 2024, available_from_year: 2021, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 56830, efficiency_value: 18.0, battery_kwh: 91, manufacturing_gco2e_kg: 12300, annual_maintenance_gbp: 410, insurance_group: 45, depreciation_3yr_pct: 0.50 }),
  ev({ id: "ford-explorer-ev-extended", make: "Ford", model: "Explorer", trim: "Extended Range RWD", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 49975, efficiency_value: 17.6, battery_kwh: 77, manufacturing_gco2e_kg: 11400, annual_maintenance_gbp: 400, insurance_group: 36, depreciation_3yr_pct: 0.49 }),
  petrol({ id: "ford-puma-st-line", make: "Ford", model: "Puma", trim: "1.0 EcoBoost Hybrid ST-Line", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 27600, efficiency_value: 5.5, tailpipe_gco2_per_km: 124, manufacturing_gco2e_kg: 5800, annual_maintenance_gbp: 480, insurance_group: 16, depreciation_3yr_pct: 0.42 }),
  hybrid({ id: "ford-kuga-phev-st-line", make: "Ford", model: "Kuga", trim: "2.5 PHEV ST-Line", model_year: 2024, available_from_year: 2020, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 41100, efficiency_value: 1.4, battery_kwh: 14.4, tailpipe_gco2_per_km: 32, manufacturing_gco2e_kg: 7900, annual_maintenance_gbp: 600, insurance_group: 27, depreciation_3yr_pct: 0.45 }),

  // ---------------- Vauxhall extras ----------------
  ev({ id: "vauxhall-mokka-electric-gs", make: "Vauxhall", model: "Mokka Electric", trim: "GS", model_year: 2024, available_from_year: 2021, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 32500, efficiency_value: 16.4, battery_kwh: 54, manufacturing_gco2e_kg: 9000, annual_maintenance_gbp: 320, insurance_group: 26, depreciation_3yr_pct: 0.46 }),
  ev({ id: "vauxhall-astra-electric", make: "Vauxhall", model: "Astra Electric", trim: "GS", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "hatchback", segment: "hatchback", purchase_price_gbp: 36400, efficiency_value: 16.0, battery_kwh: 54, manufacturing_gco2e_kg: 9100, annual_maintenance_gbp: 340, insurance_group: 28, depreciation_3yr_pct: 0.46 }),
  ev({ id: "vauxhall-grandland-electric", make: "Vauxhall", model: "Grandland Electric", trim: "Design", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 40995, efficiency_value: 17.6, battery_kwh: 73, manufacturing_gco2e_kg: 10500, annual_maintenance_gbp: 360, insurance_group: 30, depreciation_3yr_pct: 0.46 }),
  petrol({ id: "vauxhall-astra-tgdi", make: "Vauxhall", model: "Astra", trim: "1.2 Turbo GS", model_year: 2024, available_from_year: 2021, available_to_year: 2026, body_style: "hatchback", segment: "hatchback", purchase_price_gbp: 27600, efficiency_value: 5.6, tailpipe_gco2_per_km: 128, manufacturing_gco2e_kg: 5900, annual_maintenance_gbp: 470, insurance_group: 17, depreciation_3yr_pct: 0.42 }),

  // ---------------- Peugeot extras ----------------
  ev({ id: "peugeot-e-2008-allure", make: "Peugeot", model: "e-2008", trim: "Allure", model_year: 2024, available_from_year: 2020, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 36880, efficiency_value: 16.4, battery_kwh: 54, manufacturing_gco2e_kg: 9100, annual_maintenance_gbp: 320, insurance_group: 28, depreciation_3yr_pct: 0.46 }),
  ev({ id: "peugeot-e-3008-allure", make: "Peugeot", model: "e-3008", trim: "Allure", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 45850, efficiency_value: 17.4, battery_kwh: 73, manufacturing_gco2e_kg: 10800, annual_maintenance_gbp: 360, insurance_group: 32, depreciation_3yr_pct: 0.46 }),
  ev({ id: "peugeot-e-308-gt", make: "Peugeot", model: "e-308", trim: "GT", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "hatchback", segment: "hatchback", purchase_price_gbp: 40050, efficiency_value: 15.4, battery_kwh: 54, manufacturing_gco2e_kg: 8900, annual_maintenance_gbp: 340, insurance_group: 28, depreciation_3yr_pct: 0.46 }),
  petrol({ id: "peugeot-3008-puretech", make: "Peugeot", model: "3008", trim: "1.2 PureTech Allure", model_year: 2024, available_from_year: 2017, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 36900, efficiency_value: 6.0, tailpipe_gco2_per_km: 137, manufacturing_gco2e_kg: 6800, annual_maintenance_gbp: 540, insurance_group: 22, depreciation_3yr_pct: 0.43 }),

  // ---------------- Citroen ----------------
  ev({ id: "citroen-e-c4-shine", make: "Citroen", model: "e-C4", trim: "Shine", model_year: 2024, available_from_year: 2021, available_to_year: 2026, body_style: "crossover", segment: "hatchback", purchase_price_gbp: 31515, efficiency_value: 16.0, battery_kwh: 50, manufacturing_gco2e_kg: 8800, annual_maintenance_gbp: 320, insurance_group: 24, depreciation_3yr_pct: 0.46 }),
  ev({ id: "citroen-e-berlingo-flair", make: "Citroen", model: "e-Berlingo", trim: "Flair", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "mpv", segment: "family", purchase_price_gbp: 32195, efficiency_value: 17.4, battery_kwh: 50, manufacturing_gco2e_kg: 9000, annual_maintenance_gbp: 350, insurance_group: 25, depreciation_3yr_pct: 0.48 }),
  petrol({ id: "citroen-c3-puretech-max", make: "Citroen", model: "C3", trim: "1.2 PureTech Max", model_year: 2024, available_from_year: 2017, available_to_year: 2026, body_style: "hatchback", segment: "supermini", purchase_price_gbp: 18500, efficiency_value: 5.5, tailpipe_gco2_per_km: 125, manufacturing_gco2e_kg: 4900, annual_maintenance_gbp: 420, insurance_group: 11, depreciation_3yr_pct: 0.41 }),

  // ---------------- DS Automobiles ----------------
  ev({ id: "ds-3-e-tense-rivoli", make: "DS Automobiles", model: "DS 3", trim: "E-Tense Rivoli", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 39400, efficiency_value: 15.7, battery_kwh: 54, manufacturing_gco2e_kg: 8700, annual_maintenance_gbp: 360, insurance_group: 28, depreciation_3yr_pct: 0.49 }),

  // ---------------- Renault extras ----------------
  ev({ id: "renault-megane-e-tech-techno", make: "Renault", model: "Megane E-Tech", trim: "EV60 Techno", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "crossover", segment: "hatchback", purchase_price_gbp: 36995, efficiency_value: 16.1, battery_kwh: 60, manufacturing_gco2e_kg: 9300, annual_maintenance_gbp: 350, insurance_group: 27, depreciation_3yr_pct: 0.46 }),
  ev({ id: "renault-scenic-e-tech-techno", make: "Renault", model: "Scenic E-Tech", trim: "Long Range Techno", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 42995, efficiency_value: 16.3, battery_kwh: 87, manufacturing_gco2e_kg: 11000, annual_maintenance_gbp: 380, insurance_group: 30, depreciation_3yr_pct: 0.46 }),
  ev({ id: "renault-5-e-tech-techno", make: "Renault", model: "5 E-Tech", trim: "Techno 52kWh", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "hatchback", segment: "supermini", purchase_price_gbp: 26995, efficiency_value: 14.9, battery_kwh: 52, manufacturing_gco2e_kg: 8400, annual_maintenance_gbp: 310, insurance_group: 22, depreciation_3yr_pct: 0.45 }),
  petrol({ id: "renault-captur-tce-techno", make: "Renault", model: "Captur", trim: "TCe 90 Techno", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 25800, efficiency_value: 5.8, tailpipe_gco2_per_km: 132, manufacturing_gco2e_kg: 5800, annual_maintenance_gbp: 480, insurance_group: 14, depreciation_3yr_pct: 0.42 }),
  hybrid({ id: "renault-austral-e-tech-techno", make: "Renault", model: "Austral", trim: "E-Tech Full Hybrid Techno", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 36995, efficiency_value: 4.6, battery_kwh: 2.0, tailpipe_gco2_per_km: 105, manufacturing_gco2e_kg: 6900, annual_maintenance_gbp: 540, insurance_group: 23, depreciation_3yr_pct: 0.41 }),

  // ---------------- Dacia ----------------
  ev({ id: "dacia-spring-extreme", make: "Dacia", model: "Spring", trim: "Extreme", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "hatchback", segment: "city-car", purchase_price_gbp: 16995, efficiency_value: 13.2, battery_kwh: 26.8, manufacturing_gco2e_kg: 5800, annual_maintenance_gbp: 280, insurance_group: 8, depreciation_3yr_pct: 0.50 }),
  petrol({ id: "dacia-duster-tce-journey", make: "Dacia", model: "Duster", trim: "TCe 130 Journey", model_year: 2024, available_from_year: 2018, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 22745, efficiency_value: 6.4, tailpipe_gco2_per_km: 145, manufacturing_gco2e_kg: 5800, annual_maintenance_gbp: 480, insurance_group: 18, depreciation_3yr_pct: 0.40 }),
  hybrid({ id: "dacia-jogger-hybrid", make: "Dacia", model: "Jogger", trim: "Hybrid 140 Extreme", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "estate", segment: "family", purchase_price_gbp: 22995, efficiency_value: 4.9, battery_kwh: 1.2, tailpipe_gco2_per_km: 112, manufacturing_gco2e_kg: 6000, annual_maintenance_gbp: 460, insurance_group: 18, depreciation_3yr_pct: 0.40 }),

  // ---------------- Fiat ----------------
  ev({ id: "fiat-600e-red", make: "Fiat", model: "600e", trim: "RED", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 32995, efficiency_value: 15.5, battery_kwh: 54, manufacturing_gco2e_kg: 8800, annual_maintenance_gbp: 320, insurance_group: 24, depreciation_3yr_pct: 0.47 }),
  petrol({ id: "fiat-500-hybrid", make: "Fiat", model: "500", trim: "1.0 Hybrid Top", model_year: 2024, available_from_year: 2020, available_to_year: 2026, body_style: "hatchback", segment: "city-car", purchase_price_gbp: 17000, efficiency_value: 5.0, tailpipe_gco2_per_km: 113, manufacturing_gco2e_kg: 4500, annual_maintenance_gbp: 380, insurance_group: 9, depreciation_3yr_pct: 0.42 }),

  // ---------------- SEAT / Cupra ----------------
  petrol({ id: "seat-ibiza-tsi-fr", make: "SEAT", model: "Ibiza", trim: "1.0 TSI FR", model_year: 2024, available_from_year: 2017, available_to_year: 2026, body_style: "hatchback", segment: "supermini", purchase_price_gbp: 21000, efficiency_value: 5.4, tailpipe_gco2_per_km: 122, manufacturing_gco2e_kg: 5100, annual_maintenance_gbp: 440, insurance_group: 15, depreciation_3yr_pct: 0.42 }),
  petrol({ id: "seat-arona-tsi-fr", make: "SEAT", model: "Arona", trim: "1.0 TSI FR", model_year: 2024, available_from_year: 2017, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 24500, efficiency_value: 5.7, tailpipe_gco2_per_km: 130, manufacturing_gco2e_kg: 5500, annual_maintenance_gbp: 470, insurance_group: 17, depreciation_3yr_pct: 0.42 }),
  ev({ id: "cupra-tavascan-vz", make: "Cupra", model: "Tavascan", trim: "VZ", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv-coupe", segment: "crossover", purchase_price_gbp: 53715, efficiency_value: 17.3, battery_kwh: 77, manufacturing_gco2e_kg: 11400, annual_maintenance_gbp: 410, insurance_group: 38, depreciation_3yr_pct: 0.47 }),

  // ---------------- Skoda extras ----------------
  petrol({ id: "skoda-scala-tsi", make: "Skoda", model: "Scala", trim: "1.0 TSI SE Technology", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "hatchback", segment: "hatchback", purchase_price_gbp: 24400, efficiency_value: 5.4, tailpipe_gco2_per_km: 122, manufacturing_gco2e_kg: 5500, annual_maintenance_gbp: 470, insurance_group: 14, depreciation_3yr_pct: 0.41 }),
  petrol({ id: "skoda-karoq-tsi-se-l", make: "Skoda", model: "Karoq", trim: "1.5 TSI SE L", model_year: 2024, available_from_year: 2018, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 32100, efficiency_value: 6.0, tailpipe_gco2_per_km: 137, manufacturing_gco2e_kg: 6700, annual_maintenance_gbp: 540, insurance_group: 19, depreciation_3yr_pct: 0.41 }),
  petrol({ id: "skoda-kodiaq-tsi", make: "Skoda", model: "Kodiaq", trim: "1.5 TSI SE L", model_year: 2024, available_from_year: 2017, available_to_year: 2026, body_style: "suv", segment: "family", purchase_price_gbp: 38000, efficiency_value: 6.5, tailpipe_gco2_per_km: 148, manufacturing_gco2e_kg: 7700, annual_maintenance_gbp: 590, insurance_group: 22, depreciation_3yr_pct: 0.42 }),
  petrol({ id: "skoda-superb-tsi-se-l", make: "Skoda", model: "Superb", trim: "1.5 TSI SE L Estate", model_year: 2024, available_from_year: 2016, available_to_year: 2026, body_style: "estate", segment: "executive", purchase_price_gbp: 38500, efficiency_value: 5.9, tailpipe_gco2_per_km: 134, manufacturing_gco2e_kg: 7400, annual_maintenance_gbp: 580, insurance_group: 24, depreciation_3yr_pct: 0.43 }),

  // ---------------- Volvo ----------------
  ev({ id: "volvo-ex30-plus", make: "Volvo", model: "EX30", trim: "Plus Single Motor", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 36995, efficiency_value: 15.4, battery_kwh: 69, manufacturing_gco2e_kg: 9700, annual_maintenance_gbp: 360, insurance_group: 30, depreciation_3yr_pct: 0.45 }),
  ev({ id: "volvo-ex40-recharge", make: "Volvo", model: "EX40", trim: "Recharge Plus Single Motor", model_year: 2024, available_from_year: 2020, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 50295, efficiency_value: 17.2, battery_kwh: 78, manufacturing_gco2e_kg: 11400, annual_maintenance_gbp: 410, insurance_group: 36, depreciation_3yr_pct: 0.47 }),
  ev({ id: "volvo-ex90-twin", make: "Volvo", model: "EX90", trim: "Twin Motor Plus", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 96255, efficiency_value: 21.0, battery_kwh: 111, manufacturing_gco2e_kg: 14600, annual_maintenance_gbp: 580, insurance_group: 50, depreciation_3yr_pct: 0.50 }),
  petrol({ id: "volvo-xc60-b5-plus", make: "Volvo", model: "XC60", trim: "B5 Plus", model_year: 2024, available_from_year: 2017, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 50000, efficiency_value: 7.6, tailpipe_gco2_per_km: 173, manufacturing_gco2e_kg: 8700, annual_maintenance_gbp: 720, insurance_group: 35, depreciation_3yr_pct: 0.45 }),
  hybrid({ id: "volvo-xc90-recharge-t8", make: "Volvo", model: "XC90", trim: "T8 Recharge Plus", model_year: 2024, available_from_year: 2020, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 78000, efficiency_value: 1.4, battery_kwh: 18.8, tailpipe_gco2_per_km: 32, manufacturing_gco2e_kg: 13000, annual_maintenance_gbp: 800, insurance_group: 45, depreciation_3yr_pct: 0.47 }),

  // ---------------- Hyundai extras ----------------
  ev({ id: "hyundai-ioniq-6-premium", make: "Hyundai", model: "Ioniq 6", trim: "Premium RWD", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "saloon", segment: "compact-executive", purchase_price_gbp: 47040, efficiency_value: 14.3, battery_kwh: 77.4, manufacturing_gco2e_kg: 11000, annual_maintenance_gbp: 390, insurance_group: 36, depreciation_3yr_pct: 0.47 }),
  ev({ id: "hyundai-inster-02", make: "Hyundai", model: "Inster", trim: "02", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "crossover", segment: "city-car", purchase_price_gbp: 23495, efficiency_value: 14.3, battery_kwh: 49, manufacturing_gco2e_kg: 7800, annual_maintenance_gbp: 320, insurance_group: 16, depreciation_3yr_pct: 0.46 }),
  petrol({ id: "hyundai-i10-premium", make: "Hyundai", model: "i10", trim: "1.2 Premium", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "hatchback", segment: "city-car", purchase_price_gbp: 17000, efficiency_value: 5.4, tailpipe_gco2_per_km: 122, manufacturing_gco2e_kg: 4400, annual_maintenance_gbp: 360, insurance_group: 7, depreciation_3yr_pct: 0.41 }),
  petrol({ id: "hyundai-i20-premium", make: "Hyundai", model: "i20", trim: "1.0 T-GDi Premium", model_year: 2024, available_from_year: 2020, available_to_year: 2026, body_style: "hatchback", segment: "supermini", purchase_price_gbp: 21500, efficiency_value: 5.5, tailpipe_gco2_per_km: 124, manufacturing_gco2e_kg: 5100, annual_maintenance_gbp: 420, insurance_group: 12, depreciation_3yr_pct: 0.42 }),

  // ---------------- Kia extras ----------------
  ev({ id: "kia-ev9-air", make: "Kia", model: "EV9", trim: "Air RWD", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 65025, efficiency_value: 22.8, battery_kwh: 99.8, manufacturing_gco2e_kg: 13800, annual_maintenance_gbp: 480, insurance_group: 41, depreciation_3yr_pct: 0.47 }),
  ev({ id: "kia-ev3-air", make: "Kia", model: "EV3", trim: "Air Long Range", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 35995, efficiency_value: 14.9, battery_kwh: 81.4, manufacturing_gco2e_kg: 10400, annual_maintenance_gbp: 360, insurance_group: 28, depreciation_3yr_pct: 0.46 }),
  petrol({ id: "kia-picanto-2", make: "Kia", model: "Picanto", trim: "1.0 2", model_year: 2024, available_from_year: 2017, available_to_year: 2026, body_style: "hatchback", segment: "city-car", purchase_price_gbp: 15800, efficiency_value: 5.4, tailpipe_gco2_per_km: 122, manufacturing_gco2e_kg: 4400, annual_maintenance_gbp: 360, insurance_group: 8, depreciation_3yr_pct: 0.41 }),
  hybrid({ id: "kia-sportage-hev-3", make: "Kia", model: "Sportage", trim: "1.6 T-GDi HEV 3", model_year: 2024, available_from_year: 2021, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 35400, efficiency_value: 5.6, battery_kwh: 1.5, tailpipe_gco2_per_km: 127, manufacturing_gco2e_kg: 7400, annual_maintenance_gbp: 580, insurance_group: 24, depreciation_3yr_pct: 0.41 }),

  // ---------------- Nissan extras ----------------
  ev({ id: "nissan-ariya-evolve", make: "Nissan", model: "Ariya", trim: "Evolve 87kWh", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 51500, efficiency_value: 18.4, battery_kwh: 87, manufacturing_gco2e_kg: 12100, annual_maintenance_gbp: 420, insurance_group: 36, depreciation_3yr_pct: 0.49 }),
  petrol({ id: "nissan-juke-tekna", make: "Nissan", model: "Juke", trim: "1.0 DIG-T Tekna", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 28000, efficiency_value: 5.9, tailpipe_gco2_per_km: 134, manufacturing_gco2e_kg: 5900, annual_maintenance_gbp: 490, insurance_group: 17, depreciation_3yr_pct: 0.42 }),

  // ---------------- Volkswagen extras ----------------
  ev({ id: "volkswagen-id7-pro", make: "Volkswagen", model: "ID.7", trim: "Pro Match", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "fastback", segment: "executive", purchase_price_gbp: 51545, efficiency_value: 14.5, battery_kwh: 77, manufacturing_gco2e_kg: 11500, annual_maintenance_gbp: 410, insurance_group: 38, depreciation_3yr_pct: 0.47 }),
  ev({ id: "volkswagen-id-buzz-life", make: "Volkswagen", model: "ID. Buzz", trim: "Pro Life", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "mpv", segment: "family", purchase_price_gbp: 60175, efficiency_value: 21.0, battery_kwh: 77, manufacturing_gco2e_kg: 12500, annual_maintenance_gbp: 460, insurance_group: 36, depreciation_3yr_pct: 0.50 }),
  petrol({ id: "volkswagen-tiguan-tsi", make: "Volkswagen", model: "Tiguan", trim: "1.5 eTSI Life DSG", model_year: 2024, available_from_year: 2017, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 36000, efficiency_value: 6.4, tailpipe_gco2_per_km: 145, manufacturing_gco2e_kg: 7200, annual_maintenance_gbp: 580, insurance_group: 22, depreciation_3yr_pct: 0.43 }),
  petrol({ id: "volkswagen-t-roc-tsi", make: "Volkswagen", model: "T-Roc", trim: "1.0 TSI Style", model_year: 2024, available_from_year: 2018, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 28000, efficiency_value: 5.7, tailpipe_gco2_per_km: 130, manufacturing_gco2e_kg: 6000, annual_maintenance_gbp: 480, insurance_group: 17, depreciation_3yr_pct: 0.42 }),
  petrol({ id: "volkswagen-t-cross-tsi", make: "Volkswagen", model: "T-Cross", trim: "1.0 TSI Match", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 24500, efficiency_value: 5.6, tailpipe_gco2_per_km: 127, manufacturing_gco2e_kg: 5700, annual_maintenance_gbp: 470, insurance_group: 14, depreciation_3yr_pct: 0.42 }),

  // ---------------- Mini extras ----------------
  ev({ id: "mini-cooper-se-classic", make: "MINI", model: "Cooper SE", trim: "Classic", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "hatchback", segment: "supermini", purchase_price_gbp: 30000, efficiency_value: 14.5, battery_kwh: 40.7, manufacturing_gco2e_kg: 8000, annual_maintenance_gbp: 320, insurance_group: 26, depreciation_3yr_pct: 0.46 }),
  ev({ id: "mini-aceman-classic", make: "MINI", model: "Aceman", trim: "E Classic", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 31800, efficiency_value: 15.5, battery_kwh: 49.2, manufacturing_gco2e_kg: 8500, annual_maintenance_gbp: 330, insurance_group: 28, depreciation_3yr_pct: 0.46 }),
  ev({ id: "mini-countryman-e", make: "MINI", model: "Countryman", trim: "E Classic", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 41005, efficiency_value: 16.3, battery_kwh: 64.6, manufacturing_gco2e_kg: 10300, annual_maintenance_gbp: 380, insurance_group: 32, depreciation_3yr_pct: 0.46 }),

  // ---------------- Smart ----------------
  ev({ id: "smart-1-pro", make: "Smart", model: "#1", trim: "Pro+", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 33950, efficiency_value: 16.8, battery_kwh: 66, manufacturing_gco2e_kg: 9700, annual_maintenance_gbp: 360, insurance_group: 28, depreciation_3yr_pct: 0.49 }),
  ev({ id: "smart-3-pro", make: "Smart", model: "#3", trim: "Pro+", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv-coupe", segment: "crossover", purchase_price_gbp: 35950, efficiency_value: 16.3, battery_kwh: 66, manufacturing_gco2e_kg: 9800, annual_maintenance_gbp: 360, insurance_group: 30, depreciation_3yr_pct: 0.49 }),

  // ---------------- Subaru / Mitsubishi ----------------
  petrol({ id: "subaru-forester-e-boxer", make: "Subaru", model: "Forester", trim: "2.0i e-Boxer XE Premium", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 39000, efficiency_value: 8.1, tailpipe_gco2_per_km: 184, manufacturing_gco2e_kg: 8000, annual_maintenance_gbp: 660, insurance_group: 27, depreciation_3yr_pct: 0.46 }),
  ev({ id: "subaru-solterra-touring", make: "Subaru", model: "Solterra", trim: "Touring", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 53000, efficiency_value: 18.4, battery_kwh: 71.4, manufacturing_gco2e_kg: 12000, annual_maintenance_gbp: 440, insurance_group: 36, depreciation_3yr_pct: 0.50 }),
  petrol({ id: "mitsubishi-asx-design", make: "Mitsubishi", model: "ASX", trim: "1.3 Mild Hybrid Design", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 26100, efficiency_value: 5.8, tailpipe_gco2_per_km: 132, manufacturing_gco2e_kg: 5800, annual_maintenance_gbp: 460, insurance_group: 16, depreciation_3yr_pct: 0.43 }),

  // ---------------- Land Rover / Range Rover ----------------
  diesel({ id: "land-rover-defender-110-d250", make: "Land Rover", model: "Defender", trim: "110 D250 X-Dynamic SE", model_year: 2024, available_from_year: 2020, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 75000, efficiency_value: 8.5, tailpipe_gco2_per_km: 224, manufacturing_gco2e_kg: 11000, annual_maintenance_gbp: 950, insurance_group: 45, depreciation_3yr_pct: 0.45 }),
  hybrid({ id: "range-rover-sport-p440e", make: "Land Rover", model: "Range Rover Sport", trim: "P440e Autobiography PHEV", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 105000, efficiency_value: 1.5, battery_kwh: 31.8, tailpipe_gco2_per_km: 35, manufacturing_gco2e_kg: 14500, annual_maintenance_gbp: 1100, insurance_group: 50, depreciation_3yr_pct: 0.49 }),
  diesel({ id: "land-rover-discovery-sport-d200", make: "Land Rover", model: "Discovery Sport", trim: "D200 R-Dynamic SE", model_year: 2024, available_from_year: 2019, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 50000, efficiency_value: 6.5, tailpipe_gco2_per_km: 171, manufacturing_gco2e_kg: 8800, annual_maintenance_gbp: 850, insurance_group: 36, depreciation_3yr_pct: 0.49 }),

  // ---------------- Jeep ----------------
  ev({ id: "jeep-avenger-summit", make: "Jeep", model: "Avenger", trim: "Summit", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "suv", segment: "supermini", purchase_price_gbp: 35400, efficiency_value: 15.7, battery_kwh: 54, manufacturing_gco2e_kg: 8800, annual_maintenance_gbp: 360, insurance_group: 26, depreciation_3yr_pct: 0.46 }),
  hybrid({ id: "jeep-wrangler-4xe", make: "Jeep", model: "Wrangler", trim: "4xe Sahara", model_year: 2024, available_from_year: 2021, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 70000, efficiency_value: 3.5, battery_kwh: 17.3, tailpipe_gco2_per_km: 80, manufacturing_gco2e_kg: 12000, annual_maintenance_gbp: 880, insurance_group: 40, depreciation_3yr_pct: 0.47 }),

  // ---------------- Alfa Romeo / Lotus / Maserati ----------------
  hybrid({ id: "alfa-romeo-tonale-veloce-phev", make: "Alfa Romeo", model: "Tonale", trim: "Veloce PHEV Q4", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "suv", segment: "crossover", purchase_price_gbp: 50500, efficiency_value: 1.5, battery_kwh: 15.5, tailpipe_gco2_per_km: 35, manufacturing_gco2e_kg: 8200, annual_maintenance_gbp: 660, insurance_group: 32, depreciation_3yr_pct: 0.46 }),
  ev({ id: "alfa-romeo-junior-elettrica", make: "Alfa Romeo", model: "Junior", trim: "Elettrica Speciale", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "crossover", segment: "supermini", purchase_price_gbp: 33895, efficiency_value: 15.5, battery_kwh: 54, manufacturing_gco2e_kg: 8800, annual_maintenance_gbp: 380, insurance_group: 30, depreciation_3yr_pct: 0.47 }),
  ev({ id: "lotus-eletre-r", make: "Lotus", model: "Eletre", trim: "R", model_year: 2024, available_from_year: 2023, available_to_year: 2026, body_style: "suv-coupe", segment: "luxury-suv", purchase_price_gbp: 120000, efficiency_value: 21.5, battery_kwh: 112, manufacturing_gco2e_kg: 16200, annual_maintenance_gbp: 720, insurance_group: 50, depreciation_3yr_pct: 0.51 }),
  ev({ id: "maserati-grecale-folgore", make: "Maserati", model: "Grecale", trim: "Folgore", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 110000, efficiency_value: 23.0, battery_kwh: 105, manufacturing_gco2e_kg: 16000, annual_maintenance_gbp: 850, insurance_group: 50, depreciation_3yr_pct: 0.55 }),

  // ---------------- Alpine ----------------
  ev({ id: "alpine-a290-gt-performance", make: "Alpine", model: "A290", trim: "GT Performance", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "hatchback", segment: "hot-hatch", purchase_price_gbp: 37500, efficiency_value: 14.6, battery_kwh: 52, manufacturing_gco2e_kg: 8400, annual_maintenance_gbp: 380, insurance_group: 32, depreciation_3yr_pct: 0.45 }),

  // ---------------- Ineos ----------------
  petrol({ id: "ineos-grenadier-fieldmaster", make: "Ineos", model: "Grenadier", trim: "Station Wagon Fieldmaster", model_year: 2024, available_from_year: 2022, available_to_year: 2026, body_style: "suv", segment: "luxury-suv", purchase_price_gbp: 75000, efficiency_value: 11.5, tailpipe_gco2_per_km: 263, manufacturing_gco2e_kg: 12000, annual_maintenance_gbp: 1050, insurance_group: 45, depreciation_3yr_pct: 0.43 }),

  // ---------------- BMW Mini extras ----------------
  petrol({ id: "mini-cooper-c", make: "MINI", model: "Cooper", trim: "C Classic", model_year: 2024, available_from_year: 2024, available_to_year: 2026, body_style: "hatchback", segment: "supermini", purchase_price_gbp: 23800, efficiency_value: 5.7, tailpipe_gco2_per_km: 130, manufacturing_gco2e_kg: 5500, annual_maintenance_gbp: 500, insurance_group: 18, depreciation_3yr_pct: 0.43 }),
];

function vehicleToCsvLine(v) {
  const cols = [
    v.id,
    v.make,
    v.model,
    v.trim,
    v.model_year,
    v.available_from_year,
    v.available_to_year,
    v.uk_market_status,
    v.body_style,
    v.segment,
    v.powertrain,
    v.fuel_type,
    v.purchase_price_gbp,
    v.efficiency_value,
    v.efficiency_unit,
    v.battery_kwh ?? 0,
    v.tailpipe_gco2_per_km ?? 0,
    v.manufacturing_gco2e_kg,
    v.annual_maintenance_gbp,
    v.insurance_group,
    v.depreciation_3yr_pct,
    v.source_note,
  ];
  return cols
    .map((c) => {
      const s = String(c ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    })
    .join(",");
}

async function main() {
  const csvOriginal = await readFile(csvPath, "utf8");
  const csvLines = csvOriginal.split(/\r?\n/);
  const existingIds = new Set(
    csvLines
      .slice(1)
      .filter(Boolean)
      .map((line) => line.split(",")[0])
  );

  const toAdd = NEW_VEHICLES.filter((v) => !existingIds.has(v.id));
  if (toAdd.length === 0) {
    console.log("All entries already present in CSV — nothing to add.");
  } else {
    const csvAddition = toAdd.map(vehicleToCsvLine).join("\n");
    const csvOut = (csvLines.at(-1) === ""
      ? csvLines.slice(0, -1).concat(csvAddition).concat("")
      : csvLines.concat(csvAddition).concat("")).join("\n");
    await writeFile(csvPath, csvOut, "utf8");
    console.log(`Added ${toAdd.length} entries to vehicles.csv`);
  }

  for (const jsonPath of jsonPaths) {
    const raw = await readFile(jsonPath, "utf8");
    const ds = JSON.parse(raw);
    const known = new Set(ds.vehicles.map((v) => v.id));
    let added = 0;
    for (const v of NEW_VEHICLES) {
      if (known.has(v.id)) continue;
      ds.vehicles.push({
        id: v.id,
        make: v.make,
        model: v.model,
        trim: v.trim,
        model_year: v.model_year,
        available_from_year: v.available_from_year,
        available_to_year: v.available_to_year,
        uk_market_status: v.uk_market_status,
        body_style: v.body_style,
        segment: v.segment,
        powertrain: v.powertrain,
        fuel_type: v.fuel_type,
        purchase_price_gbp: v.purchase_price_gbp,
        efficiency_value: v.efficiency_value,
        efficiency_unit: v.efficiency_unit,
        battery_kwh: v.battery_kwh ?? 0,
        tailpipe_gco2_per_km: v.tailpipe_gco2_per_km ?? 0,
        manufacturing_gco2e_kg: v.manufacturing_gco2e_kg,
        annual_maintenance_gbp: v.annual_maintenance_gbp,
        insurance_group: v.insurance_group,
        depreciation_3yr_pct: v.depreciation_3yr_pct,
        source_note: v.source_note,
      });
      added++;
    }
    await writeFile(jsonPath, JSON.stringify(ds, null, 2) + "\n", "utf8");
    console.log(`Added ${added} entries to ${jsonPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
