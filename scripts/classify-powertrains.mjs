// One-shot script that adds a `powertrain` field to every model in
// data/raw/uk_vehicle_catalog.json based on model-name patterns.
//
// Categories:
//   "EV"     — battery electric only (Tesla Model 3, BYD Atto 3, etc.)
//   "ICE"    — petrol and/or diesel (Ford Fiesta, BMW 3 Series 320d)
//   "Hybrid" — hybrid-only models (Toyota Prius)
//   "Mixed"  — model line with both EV and ICE variants (Mini Cooper)
//
// Run: node scripts/classify-powertrains.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const path = resolve(root, "data/raw/uk_vehicle_catalog.json");

// Brands that are EV-only — every model defaults to EV
const EV_ONLY_MAKES = new Set(["BYD", "Polestar", "Tesla", "Smart"]);

// Per-make explicit model classifications. These override the generic
// pattern-matcher below. Maintained by hand for accuracy.
const EXPLICIT = {
  "Alfa Romeo": {
    Junior: "Mixed", // has both EV "Elettrica" and Hybrid variants
  },
  Alpine: {
    A110: "ICE",
    A290: "EV",
  },
  Audi: {
    "Q4 e-tron": "EV",
    "Q6 e-tron": "EV",
    "Q8 e-tron": "EV",
    "e-tron": "EV",
    "e-tron GT": "EV",
  },
  BMW: {
    i3: "EV", i4: "EV", i5: "EV", i7: "EV", iX: "EV",
    iX1: "EV", iX2: "EV", iX3: "EV",
  },
  Citroën: {
    Ami: "EV",
    "e-C4": "EV", "e-C4 X": "EV", "e-Berlingo": "EV",
  },
  Cupra: {
    Born: "EV",
    Tavascan: "EV",
    Formentor: "Mixed", Leon: "Mixed", // PHEV available
  },
  Dacia: {
    Spring: "EV",
  },
  "DS Automobiles": {
    "DS N°8": "EV",
  },
  Fiat: {
    "500e": "EV", "600e": "EV", Topolino: "EV",
  },
  Ford: {
    "Mustang Mach-E": "EV", Explorer: "EV", Capri: "EV",
    "Puma Gen-E": "EV",
  },
  Genesis: {
    "Electrified G80": "EV", GV60: "EV", "Electrified GV70": "EV",
  },
  Honda: {
    "e:Ny1": "EV", e: "EV",
  },
  Hyundai: {
    "Ioniq 5": "EV", "Ioniq 5 N": "EV", "Ioniq 6": "EV",
    Inster: "EV", "Kona Electric": "EV", Nexo: "EV",
    Ioniq: "Hybrid",
  },
  Jaguar: {
    "I-Pace": "EV",
  },
  Jeep: {
    Avenger: "Mixed", // EV + petrol
  },
  Kia: {
    EV3: "EV", EV6: "EV", EV9: "EV",
    "Niro EV": "EV", "Soul EV": "EV",
    Niro: "Mixed",
  },
  "Land Rover": {},
  Lexus: {
    RZ: "EV",
  },
  Lotus: {
    Eletre: "EV", Emeya: "EV",
    Emira: "ICE", Elise: "ICE", Exige: "ICE", Evora: "ICE",
  },
  Maserati: {},
  Mazda: {
    "MX-30": "EV",
  },
  "Mercedes-Benz": {
    EQA: "EV", EQB: "EV", EQC: "EV", EQE: "EV", EQS: "EV",
    "EQE SUV": "EV", "EQS SUV": "EV",
  },
  MG: {
    MG4: "EV", "MG ZS EV": "EV", Cyberster: "EV",
    MG5: "Mixed", // has both EV and ICE
    MG3: "Hybrid", // MG3 is hybrid-only in UK now
    "MG ZS": "ICE", "MG HS": "Mixed", "MG GS": "ICE",
  },
  MINI: {
    "Cooper SE": "EV", Aceman: "EV",
    Cooper: "Mixed", Countryman: "Mixed", // both EV and ICE variants
  },
  Mitsubishi: {
    Outlander: "Mixed",
  },
  Nissan: {
    Leaf: "EV", Ariya: "EV",
  },
  Peugeot: {
    "e-208": "EV", "e-308": "EV", "e-2008": "EV", "e-3008": "EV",
    "e-5008": "EV", "e-Rifter": "EV",
  },
  Porsche: {
    Taycan: "EV", "Macan Electric": "EV",
  },
  Renault: {
    Zoe: "EV", "Megane E-Tech": "EV", "Scenic E-Tech": "EV",
    "5 E-Tech": "EV", "4 E-Tech": "EV",
  },
  "Rolls-Royce": {
    Spectre: "EV",
  },
  SEAT: {},
  Skoda: {
    Enyaq: "EV", Elroq: "EV",
  },
  SsangYong: {},
  Subaru: {
    Solterra: "EV",
  },
  Suzuki: {
    "e Vitara": "EV",
  },
  Toyota: {
    bZ4X: "EV",
    Mirai: "Hybrid", // FCEV but treat as hybrid for cost purposes
    Prius: "Hybrid",
    Corolla: "Hybrid", "Corolla Cross": "Hybrid",
    "C-HR": "Hybrid",
    Yaris: "Hybrid", "Yaris Cross": "Hybrid",
    Camry: "Hybrid", Highlander: "Hybrid",
    "RAV4": "Hybrid",
  },
  Vauxhall: {
    "Corsa Electric": "EV", "Astra Electric": "EV",
    "Mokka Electric": "EV", "Grandland Electric": "EV",
    "Frontera Electric": "EV", "Combo-e Life": "EV",
  },
  Volkswagen: {
    "ID.3": "EV", "ID.4": "EV", "ID.5": "EV", "ID.7": "EV",
    "ID. Buzz": "EV", "e-up!": "EV",
  },
  Volvo: {
    "C40 Recharge": "EV", EX30: "EV", EX40: "EV", EC40: "EV", EX90: "EV",
  },
};

function classify(make, model) {
  // 1. EV-only manufacturers
  if (EV_ONLY_MAKES.has(make)) return "EV";
  // 2. Explicit override per (make, model)
  const explicit = EXPLICIT[make]?.[model];
  if (explicit) return explicit;
  // 3. Pattern-based fallback
  const lower = model.toLowerCase();
  if (
    lower.startsWith("e-") ||
    lower.includes(" electric") ||
    lower.endsWith(" electric") ||
    lower.includes(" ev") ||
    lower.startsWith("eq") ||
    lower.startsWith("ev")
  ) {
    return "EV";
  }
  if (lower.includes("phev")) return "Hybrid";
  if (lower.includes("hybrid")) return "Hybrid";
  // 4. Default to ICE (petrol/diesel mix)
  return "ICE";
}

async function main() {
  const raw = JSON.parse(await readFile(path, "utf8"));
  let touched = 0;
  for (const make of raw.makes) {
    for (const model of make.models) {
      const tag = classify(make.name, model.model);
      if (model.powertrain !== tag) {
        model.powertrain = tag;
        touched += 1;
      }
    }
  }
  await writeFile(path, JSON.stringify(raw, null, 2) + "\n", "utf8");
  console.log(`Tagged ${touched} models across ${raw.makes.length} makes.`);
  // Quick stats
  const counts = {};
  for (const make of raw.makes) {
    for (const model of make.models) {
      counts[model.powertrain] = (counts[model.powertrain] || 0) + 1;
    }
  }
  console.log("Powertrain counts:", counts);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
