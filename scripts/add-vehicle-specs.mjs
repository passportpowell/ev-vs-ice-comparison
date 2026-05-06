// One-shot script that augments data/raw/uk_vehicle_catalog.json with
// realistic UK spec ranges per model. Numbers come from manufacturer UK
// websites + WLTP test data (worst trim → best trim).
//
//   EV / Hybrid / Mixed:  battery_kwh [min, max], kwh_per_100km [min, max]
//   ICE / Hybrid:         petrol_mpg_uk [min, max], diesel_mpg_uk [min, max]
//
// The dashboard uses these to show users a "battery 60-79 kWh, eff 14-17
// kWh/100km" hint under each picked vehicle so they can tune the manual
// inputs to match. Models without entries here just don't show specs.
//
// Run: node scripts/add-vehicle-specs.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const path = resolve(root, "data/raw/uk_vehicle_catalog.json");

// Map keyed by `${make}::${model}` — case-insensitive lookup.
// Specs are UK consumer-trim ranges, WLTP combined.
//   battery in kWh (usable)
//   efficiency in kWh / 100 km
//   mpg in UK gallons combined
const SPECS = {
  // ---------------- Tesla ----------------
  "Tesla::Model 3":       { battery_kwh: [57, 79],   kwh_per_100km: [13.2, 16.6] },
  "Tesla::Model Y":       { battery_kwh: [60, 79],   kwh_per_100km: [14.4, 17.3] },
  "Tesla::Model S":       { battery_kwh: [100, 100], kwh_per_100km: [16.4, 19.4] },
  "Tesla::Model X":       { battery_kwh: [100, 100], kwh_per_100km: [18.7, 21.0] },

  // ---------------- BYD ----------------
  "BYD::Atto 3":          { battery_kwh: [60.5, 60.5], kwh_per_100km: [16.4, 16.6] },
  "BYD::Atto 2":          { battery_kwh: [45, 45],     kwh_per_100km: [15.0, 15.5] },
  "BYD::Dolphin":         { battery_kwh: [44.9, 60.4], kwh_per_100km: [14.5, 15.9] },
  "BYD::Dolphin Surf":    { battery_kwh: [30, 45],     kwh_per_100km: [13.5, 14.5] },
  "BYD::Seal":            { battery_kwh: [61.4, 82.5], kwh_per_100km: [14.6, 16.6] },
  "BYD::Seal U":          { battery_kwh: [71.8, 87],   kwh_per_100km: [18.4, 20.0] },
  "BYD::Seal U DM-i":     { battery_kwh: [18.3, 26.6], kwh_per_100km: [22.0, 24.0], petrol_mpg_uk: [42, 55] },
  "BYD::Sealion 7":       { battery_kwh: [82.5, 91.3], kwh_per_100km: [18.0, 19.5] },

  // ---------------- BMW ----------------
  "BMW::i3":              { battery_kwh: [22.6, 42.2], kwh_per_100km: [13.6, 14.9] },
  "BMW::i4":              { battery_kwh: [70, 84],     kwh_per_100km: [15.5, 18.5] },
  "BMW::i5":              { battery_kwh: [81.2, 84],   kwh_per_100km: [16.2, 19.0] },
  "BMW::i7":              { battery_kwh: [101.7, 105.7], kwh_per_100km: [18.4, 21.0] },
  "BMW::iX":              { battery_kwh: [76.6, 111.5], kwh_per_100km: [18.4, 21.5] },
  "BMW::iX1":             { battery_kwh: [64.7, 64.7], kwh_per_100km: [16.7, 17.0] },
  "BMW::iX2":             { battery_kwh: [64.7, 64.7], kwh_per_100km: [16.4, 17.5] },
  "BMW::iX3":             { battery_kwh: [76.6, 76.6], kwh_per_100km: [18.5, 18.8] },
  "BMW::1 Series":        { petrol_mpg_uk: [42, 55],   diesel_mpg_uk: [50, 65] },
  "BMW::2 Series":        { petrol_mpg_uk: [38, 50],   diesel_mpg_uk: [48, 62] },
  "BMW::3 Series":        { petrol_mpg_uk: [36, 50],   diesel_mpg_uk: [46, 65] },
  "BMW::4 Series":        { petrol_mpg_uk: [32, 48],   diesel_mpg_uk: [45, 60] },
  "BMW::5 Series":        { petrol_mpg_uk: [32, 48],   diesel_mpg_uk: [44, 58] },
  "BMW::X1":              { petrol_mpg_uk: [40, 50],   diesel_mpg_uk: [48, 62] },
  "BMW::X3":              { petrol_mpg_uk: [32, 45],   diesel_mpg_uk: [40, 55] },
  "BMW::X5":              { petrol_mpg_uk: [25, 35],   diesel_mpg_uk: [38, 48] },

  // ---------------- Polestar ----------------
  "Polestar::Polestar 2": { battery_kwh: [69, 82],   kwh_per_100km: [16.0, 18.6] },
  "Polestar::Polestar 3": { battery_kwh: [107, 111], kwh_per_100km: [19.0, 21.0] },
  "Polestar::Polestar 4": { battery_kwh: [94, 100],  kwh_per_100km: [17.0, 19.5] },

  // ---------------- Volkswagen ----------------
  "Volkswagen::ID.3":     { battery_kwh: [45, 77], kwh_per_100km: [15.0, 17.0] },
  "Volkswagen::ID.4":     { battery_kwh: [52, 77], kwh_per_100km: [16.0, 18.5] },
  "Volkswagen::ID.5":     { battery_kwh: [77, 77], kwh_per_100km: [16.5, 17.0] },
  "Volkswagen::ID.7":     { battery_kwh: [77, 86], kwh_per_100km: [14.5, 16.5] },
  "Volkswagen::ID. Buzz": { battery_kwh: [77, 86], kwh_per_100km: [21.0, 23.0] },
  "Volkswagen::e-up!":    { battery_kwh: [16.4, 32.3], kwh_per_100km: [12.7, 14.4] },
  "Volkswagen::Polo":     { petrol_mpg_uk: [48, 60] },
  "Volkswagen::Golf":     { petrol_mpg_uk: [42, 55], diesel_mpg_uk: [55, 70] },
  "Volkswagen::Tiguan":   { petrol_mpg_uk: [36, 48], diesel_mpg_uk: [45, 55] },

  // ---------------- Hyundai ----------------
  "Hyundai::Ioniq 5":     { battery_kwh: [58, 84],   kwh_per_100km: [16.7, 19.4] },
  "Hyundai::Ioniq 5 N":   { battery_kwh: [84, 84],   kwh_per_100km: [20.6, 22.4] },
  "Hyundai::Ioniq 6":     { battery_kwh: [53, 77.4], kwh_per_100km: [13.9, 16.9] },
  "Hyundai::Inster":      { battery_kwh: [42, 49],   kwh_per_100km: [14.3, 15.3] },
  "Hyundai::Kona Electric":{ battery_kwh: [39.2, 65.4], kwh_per_100km: [14.7, 16.6] },
  "Hyundai::Kona":        { petrol_mpg_uk: [40, 55] },
  "Hyundai::Tucson":      { petrol_mpg_uk: [38, 50], diesel_mpg_uk: [48, 60] },
  "Hyundai::i10":         { petrol_mpg_uk: [50, 56] },
  "Hyundai::i20":         { petrol_mpg_uk: [48, 60] },

  // ---------------- Kia ----------------
  "Kia::Niro EV":         { battery_kwh: [64, 64],     kwh_per_100km: [15.9, 16.5] },
  "Kia::EV3":             { battery_kwh: [58.3, 81.4], kwh_per_100km: [14.9, 16.7] },
  "Kia::EV6":             { battery_kwh: [58, 84],     kwh_per_100km: [16.5, 19.7] },
  "Kia::EV9":             { battery_kwh: [76.1, 99.8], kwh_per_100km: [22.8, 25.4] },
  "Kia::Soul EV":         { battery_kwh: [27, 64],     kwh_per_100km: [15.7, 17.0] },
  "Kia::Niro":            { petrol_mpg_uk: [55, 65] },
  "Kia::Sportage":        { petrol_mpg_uk: [38, 50],   diesel_mpg_uk: [48, 58] },
  "Kia::Picanto":         { petrol_mpg_uk: [50, 60] },

  // ---------------- Ford ----------------
  "Ford::Mustang Mach-E":  { battery_kwh: [70, 91], kwh_per_100km: [17.5, 21.5] },
  "Ford::Explorer":        { battery_kwh: [52, 77], kwh_per_100km: [16.0, 17.6] },
  "Ford::Capri":           { battery_kwh: [52, 77], kwh_per_100km: [16.0, 17.4] },
  "Ford::Puma Gen-E":      { battery_kwh: [43, 43], kwh_per_100km: [13.3, 14.0] },
  "Ford::Fiesta":          { petrol_mpg_uk: [48, 60] },
  "Ford::Focus":           { petrol_mpg_uk: [44, 55], diesel_mpg_uk: [55, 65] },
  "Ford::Puma":            { petrol_mpg_uk: [45, 55] },
  "Ford::Kuga":            { petrol_mpg_uk: [38, 50], diesel_mpg_uk: [50, 60] },

  // ---------------- Vauxhall ----------------
  "Vauxhall::Corsa Electric":     { battery_kwh: [50, 51], kwh_per_100km: [15.3, 16.0] },
  "Vauxhall::Astra Electric":     { battery_kwh: [54, 54], kwh_per_100km: [15.5, 16.0] },
  "Vauxhall::Mokka Electric":     { battery_kwh: [50, 54], kwh_per_100km: [15.6, 16.4] },
  "Vauxhall::Grandland Electric": { battery_kwh: [73, 73], kwh_per_100km: [16.6, 17.6] },
  "Vauxhall::Frontera Electric":  { battery_kwh: [44, 54], kwh_per_100km: [15.5, 17.5] },
  "Vauxhall::Combo-e Life":       { battery_kwh: [50, 50], kwh_per_100km: [19.0, 20.0] },
  "Vauxhall::Corsa":              { petrol_mpg_uk: [48, 60] },
  "Vauxhall::Astra":              { petrol_mpg_uk: [44, 55], diesel_mpg_uk: [55, 65] },
  "Vauxhall::Mokka":              { petrol_mpg_uk: [42, 52] },
  "Vauxhall::Grandland":          { petrol_mpg_uk: [38, 50], diesel_mpg_uk: [48, 58] },

  // ---------------- MG ----------------
  "MG::MG4":                { battery_kwh: [51, 77],   kwh_per_100km: [15.4, 16.6] },
  "MG::MG ZS EV":           { battery_kwh: [49, 72.6], kwh_per_100km: [16.5, 18.7] },
  "MG::MG5":                { battery_kwh: [50, 61],   kwh_per_100km: [16.6, 17.9] },
  "MG::Cyberster":          { battery_kwh: [64, 77],   kwh_per_100km: [18.5, 20.0] },
  "MG::MG3":                { petrol_mpg_uk: [55, 64] },
  "MG::MG ZS":              { petrol_mpg_uk: [40, 50] },
  "MG::MG HS":              { petrol_mpg_uk: [38, 48] },

  // ---------------- Mercedes-Benz ----------------
  "Mercedes-Benz::EQA":     { battery_kwh: [70.5, 70.5], kwh_per_100km: [16.7, 18.0] },
  "Mercedes-Benz::EQB":     { battery_kwh: [70.5, 70.5], kwh_per_100km: [18.4, 19.7] },
  "Mercedes-Benz::EQC":     { battery_kwh: [80, 80],     kwh_per_100km: [22.0, 23.0] },
  "Mercedes-Benz::EQE":     { battery_kwh: [89, 89],     kwh_per_100km: [16.0, 18.7] },
  "Mercedes-Benz::EQS":     { battery_kwh: [108.4, 118], kwh_per_100km: [16.4, 19.4] },
  "Mercedes-Benz::EQE SUV": { battery_kwh: [89, 90.6],   kwh_per_100km: [18.5, 20.5] },
  "Mercedes-Benz::EQS SUV": { battery_kwh: [108.4, 118], kwh_per_100km: [21.0, 23.0] },
  "Mercedes-Benz::A-Class": { petrol_mpg_uk: [40, 55],   diesel_mpg_uk: [55, 65] },
  "Mercedes-Benz::C-Class": { petrol_mpg_uk: [36, 48],   diesel_mpg_uk: [50, 65] },
  "Mercedes-Benz::E-Class": { petrol_mpg_uk: [32, 45],   diesel_mpg_uk: [48, 60] },
  "Mercedes-Benz::GLA":     { petrol_mpg_uk: [38, 50],   diesel_mpg_uk: [50, 60] },
  "Mercedes-Benz::GLC":     { petrol_mpg_uk: [32, 45],   diesel_mpg_uk: [42, 55] },

  // ---------------- Audi ----------------
  "Audi::Q4 e-tron":   { battery_kwh: [55, 82],  kwh_per_100km: [16.5, 19.0] },
  "Audi::Q6 e-tron":   { battery_kwh: [83, 100], kwh_per_100km: [16.7, 18.5] },
  "Audi::Q8 e-tron":   { battery_kwh: [89, 106], kwh_per_100km: [21.5, 23.5] },
  "Audi::e-tron":      { battery_kwh: [71, 86],  kwh_per_100km: [22.0, 26.0] },
  "Audi::e-tron GT":   { battery_kwh: [83.7, 97],kwh_per_100km: [18.7, 21.4] },
  "Audi::A1":          { petrol_mpg_uk: [44, 56] },
  "Audi::A3":          { petrol_mpg_uk: [40, 55], diesel_mpg_uk: [55, 65] },
  "Audi::A4":          { petrol_mpg_uk: [38, 50], diesel_mpg_uk: [50, 60] },
  "Audi::A6":          { petrol_mpg_uk: [32, 42], diesel_mpg_uk: [48, 58] },
  "Audi::Q3":          { petrol_mpg_uk: [38, 48], diesel_mpg_uk: [48, 56] },
  "Audi::Q5":          { petrol_mpg_uk: [32, 42], diesel_mpg_uk: [42, 52] },
  "Audi::Q7":          { petrol_mpg_uk: [25, 32], diesel_mpg_uk: [38, 45] },

  // ---------------- Renault ----------------
  "Renault::Megane E-Tech": { battery_kwh: [40, 60],  kwh_per_100km: [14.9, 16.1] },
  "Renault::Scenic E-Tech": { battery_kwh: [60, 87],  kwh_per_100km: [14.9, 17.3] },
  "Renault::Zoe":           { battery_kwh: [22, 52],  kwh_per_100km: [13.0, 17.2] },
  "Renault::5 E-Tech":      { battery_kwh: [40, 52],  kwh_per_100km: [13.4, 14.9] },
  "Renault::4 E-Tech":      { battery_kwh: [40, 52],  kwh_per_100km: [14.0, 15.0] },
  "Renault::Clio":          { petrol_mpg_uk: [50, 65] },
  "Renault::Captur":        { petrol_mpg_uk: [42, 55] },
  "Renault::Megane":        { petrol_mpg_uk: [42, 54], diesel_mpg_uk: [55, 65] },

  // ---------------- Peugeot ----------------
  "Peugeot::e-208":     { battery_kwh: [50, 51], kwh_per_100km: [15.4, 16.4] },
  "Peugeot::e-308":     { battery_kwh: [54, 54], kwh_per_100km: [15.4, 16.0] },
  "Peugeot::e-2008":    { battery_kwh: [50, 54], kwh_per_100km: [16.4, 17.4] },
  "Peugeot::e-3008":    { battery_kwh: [73, 73], kwh_per_100km: [17.0, 17.6] },
  "Peugeot::e-5008":    { battery_kwh: [73, 73], kwh_per_100km: [18.0, 19.0] },
  "Peugeot::e-Rifter":  { battery_kwh: [50, 50], kwh_per_100km: [19.0, 20.0] },
  "Peugeot::208":       { petrol_mpg_uk: [50, 60] },
  "Peugeot::308":       { petrol_mpg_uk: [44, 55], diesel_mpg_uk: [55, 65] },
  "Peugeot::3008":      { petrol_mpg_uk: [38, 50], diesel_mpg_uk: [48, 58] },

  // ---------------- Citroën ----------------
  "Citroën::e-C4":         { battery_kwh: [50, 54], kwh_per_100km: [16.0, 16.8] },
  "Citroën::e-C4 X":       { battery_kwh: [50, 54], kwh_per_100km: [16.0, 16.5] },
  "Citroën::e-Berlingo":   { battery_kwh: [50, 50], kwh_per_100km: [19.5, 20.5] },
  "Citroën::Ami":          { battery_kwh: [5.5, 5.5], kwh_per_100km: [9.0, 10.0] },
  "Citroën::C3":           { petrol_mpg_uk: [50, 60] },
  "Citroën::C4":           { petrol_mpg_uk: [44, 55], diesel_mpg_uk: [55, 65] },

  // ---------------- Volvo ----------------
  "Volvo::EX30":            { battery_kwh: [49, 69], kwh_per_100km: [15.4, 17.0] },
  "Volvo::EX40":            { battery_kwh: [78, 82], kwh_per_100km: [17.2, 18.5] },
  "Volvo::EC40":            { battery_kwh: [69, 82], kwh_per_100km: [16.7, 18.0] },
  "Volvo::EX90":            { battery_kwh: [111, 111], kwh_per_100km: [21.0, 22.0] },
  "Volvo::C40 Recharge":    { battery_kwh: [69, 78], kwh_per_100km: [16.6, 18.0] },
  "Volvo::XC40":            { petrol_mpg_uk: [38, 48], diesel_mpg_uk: [50, 58] },
  "Volvo::XC60":            { petrol_mpg_uk: [32, 42], diesel_mpg_uk: [42, 52] },
  "Volvo::XC90":            { petrol_mpg_uk: [28, 36], diesel_mpg_uk: [40, 50] },

  // ---------------- Smart ----------------
  "Smart::#1":     { battery_kwh: [49, 66], kwh_per_100km: [15.4, 16.8] },
  "Smart::#3":     { battery_kwh: [49, 66], kwh_per_100km: [15.6, 17.0] },
  "Smart::ForTwo": { petrol_mpg_uk: [50, 65] },

  // ---------------- Nissan ----------------
  "Nissan::Leaf":    { battery_kwh: [40, 62], kwh_per_100km: [16.0, 17.6] },
  "Nissan::Ariya":   { battery_kwh: [63, 87], kwh_per_100km: [17.5, 21.4] },
  "Nissan::Qashqai": { petrol_mpg_uk: [40, 55] },
  "Nissan::Juke":    { petrol_mpg_uk: [44, 56] },
  "Nissan::Micra":   { petrol_mpg_uk: [50, 60] },

  // ---------------- MINI ----------------
  "MINI::Cooper SE":   { battery_kwh: [29.2, 40.7], kwh_per_100km: [13.6, 15.5] },
  "MINI::Aceman":      { battery_kwh: [42.5, 54.2], kwh_per_100km: [14.0, 16.0] },
  "MINI::Cooper":      { petrol_mpg_uk: [42, 55] },
  "MINI::Countryman":  { petrol_mpg_uk: [38, 48] },

  // ---------------- Skoda ----------------
  "Skoda::Enyaq":   { battery_kwh: [55, 82], kwh_per_100km: [15.7, 17.6] },
  "Skoda::Elroq":   { battery_kwh: [55, 82], kwh_per_100km: [15.6, 17.0] },
  "Skoda::Octavia": { petrol_mpg_uk: [42, 55], diesel_mpg_uk: [55, 65] },
  "Skoda::Fabia":   { petrol_mpg_uk: [50, 60] },
  "Skoda::Karoq":   { petrol_mpg_uk: [40, 50], diesel_mpg_uk: [50, 60] },
  "Skoda::Kodiaq":  { petrol_mpg_uk: [36, 46], diesel_mpg_uk: [44, 55] },

  // ---------------- Cupra ----------------
  "Cupra::Born":      { battery_kwh: [58, 77], kwh_per_100km: [15.4, 16.5] },
  "Cupra::Tavascan":  { battery_kwh: [77, 77], kwh_per_100km: [17.3, 18.0] },
  "Cupra::Formentor": { petrol_mpg_uk: [38, 48] },
  "Cupra::Leon":      { petrol_mpg_uk: [40, 52] },

  // ---------------- Dacia ----------------
  "Dacia::Spring":   { battery_kwh: [26.8, 26.8], kwh_per_100km: [13.0, 13.5] },
  "Dacia::Sandero":  { petrol_mpg_uk: [48, 56] },
  "Dacia::Duster":   { petrol_mpg_uk: [40, 50] },
  "Dacia::Jogger":   { petrol_mpg_uk: [44, 55] },

  // ---------------- Subaru / Toyota / Lexus EVs ----------------
  "Subaru::Solterra": { battery_kwh: [71.4, 71.4], kwh_per_100km: [17.5, 18.4] },
  "Toyota::bZ4X":     { battery_kwh: [71.4, 71.4], kwh_per_100km: [16.5, 18.2] },
  "Lexus::RZ":        { battery_kwh: [71.4, 71.4], kwh_per_100km: [17.0, 19.0] },

  // ---------------- Toyota / Lexus hybrids ----------------
  "Toyota::Yaris":         { petrol_mpg_uk: [55, 70] },
  "Toyota::Yaris Cross":   { petrol_mpg_uk: [50, 65] },
  "Toyota::Corolla":       { petrol_mpg_uk: [55, 65] },
  "Toyota::C-HR":          { petrol_mpg_uk: [50, 60] },
  "Toyota::RAV4":          { petrol_mpg_uk: [42, 52] },
  "Toyota::Highlander":    { petrol_mpg_uk: [38, 45] },
  "Toyota::Prius":         { petrol_mpg_uk: [55, 70] },
  "Toyota::Camry":         { petrol_mpg_uk: [48, 56] },
  "Toyota::Aygo X":        { petrol_mpg_uk: [56, 65] },
  "Lexus::UX":             { petrol_mpg_uk: [50, 60] },
  "Lexus::NX":             { petrol_mpg_uk: [38, 48] },
  "Lexus::RX":             { petrol_mpg_uk: [32, 42] },
  "Lexus::LBX":            { petrol_mpg_uk: [55, 65] },

  // ---------------- Honda ----------------
  "Honda::e":      { battery_kwh: [35.5, 35.5], kwh_per_100km: [17.8, 18.0] },
  "Honda::e:Ny1":  { battery_kwh: [68.8, 68.8], kwh_per_100km: [18.0, 19.0] },
  "Honda::Jazz":   { petrol_mpg_uk: [55, 65] },
  "Honda::Civic":  { petrol_mpg_uk: [50, 60] },
  "Honda::HR-V":   { petrol_mpg_uk: [48, 58] },
  "Honda::CR-V":   { petrol_mpg_uk: [42, 52] },

  // ---------------- Mazda ----------------
  "Mazda::MX-30":  { battery_kwh: [35.5, 35.5], kwh_per_100km: [18.5, 19.5] },
  "Mazda::2":      { petrol_mpg_uk: [50, 60] },
  "Mazda::3":      { petrol_mpg_uk: [44, 54] },
  "Mazda::CX-30":  { petrol_mpg_uk: [40, 50] },
  "Mazda::CX-5":   { petrol_mpg_uk: [38, 48], diesel_mpg_uk: [48, 58] },
  "Mazda::CX-60":  { petrol_mpg_uk: [32, 42], diesel_mpg_uk: [50, 60] },

  // ---------------- Porsche ----------------
  "Porsche::Taycan":          { battery_kwh: [79, 105], kwh_per_100km: [17.5, 22.0] },
  "Porsche::Macan Electric":  { battery_kwh: [95, 100], kwh_per_100km: [18.6, 21.5] },
  "Porsche::Cayenne":         { petrol_mpg_uk: [22, 30] },
  "Porsche::Macan":           { petrol_mpg_uk: [28, 36] },
  "Porsche::911":             { petrol_mpg_uk: [22, 30] },

  // ---------------- Jaguar / Land Rover ----------------
  "Jaguar::I-Pace":              { battery_kwh: [90, 90], kwh_per_100km: [22.0, 23.5] },
  "Jaguar::F-Pace":              { petrol_mpg_uk: [25, 35], diesel_mpg_uk: [35, 45] },
  "Land Rover::Defender":        { petrol_mpg_uk: [22, 30], diesel_mpg_uk: [30, 38] },
  "Land Rover::Range Rover":     { petrol_mpg_uk: [22, 28], diesel_mpg_uk: [30, 38] },
  "Land Rover::Range Rover Sport": { petrol_mpg_uk: [22, 30], diesel_mpg_uk: [32, 40] },
  "Land Rover::Range Rover Evoque": { petrol_mpg_uk: [32, 42], diesel_mpg_uk: [42, 52] },
  "Land Rover::Discovery Sport": { petrol_mpg_uk: [32, 42], diesel_mpg_uk: [42, 52] },

  // ---------------- Genesis ----------------
  "Genesis::GV60":               { battery_kwh: [77.4, 77.4], kwh_per_100km: [17.5, 18.5] },
  "Genesis::Electrified G80":    { battery_kwh: [87.2, 87.2], kwh_per_100km: [16.8, 17.5] },
  "Genesis::Electrified GV70":   { battery_kwh: [77.4, 77.4], kwh_per_100km: [19.4, 20.0] },

  // ---------------- Lotus / Maserati / Aston / Bentley / Rolls / Ferrari / Lambo / McLaren ----------------
  "Lotus::Eletre":               { battery_kwh: [112, 112], kwh_per_100km: [21.5, 24.0] },
  "Lotus::Emeya":                { battery_kwh: [102, 102], kwh_per_100km: [19.5, 22.0] },
  "Lotus::Emira":                { petrol_mpg_uk: [22, 30] },
  "Maserati::Grecale":           { petrol_mpg_uk: [25, 32] },
  "Maserati::GranTurismo":       { petrol_mpg_uk: [22, 28] },
  "Aston Martin::DBX":           { petrol_mpg_uk: [18, 24] },
  "Bentley::Bentayga":           { petrol_mpg_uk: [18, 24] },
  "Rolls-Royce::Spectre":        { battery_kwh: [102, 102], kwh_per_100km: [21.0, 23.0] },

  // ---------------- Ineos / Subaru / Mitsubishi / Suzuki / SsangYong ----------------
  "Ineos::Grenadier":            { petrol_mpg_uk: [18, 25], diesel_mpg_uk: [25, 32] },
  "Subaru::Forester":            { petrol_mpg_uk: [32, 42] },
  "Subaru::Outback":             { petrol_mpg_uk: [30, 40] },
  "Mitsubishi::ASX":             { petrol_mpg_uk: [42, 52] },
  "Mitsubishi::Outlander":       { petrol_mpg_uk: [32, 42] },
  "Suzuki::Swift":               { petrol_mpg_uk: [55, 65] },
  "Suzuki::Vitara":              { petrol_mpg_uk: [44, 54] },
  "Suzuki::Jimny":               { petrol_mpg_uk: [32, 40] },
  "Suzuki::e Vitara":            { battery_kwh: [49, 61], kwh_per_100km: [15.0, 16.5] },

  // ---------------- Alfa / Alpine / Fiat / Jeep / DS / Bigster ----------------
  "Alfa Romeo::Junior":      { battery_kwh: [54, 54], kwh_per_100km: [15.5, 16.0], petrol_mpg_uk: [44, 55] },
  "Alfa Romeo::Stelvio":     { petrol_mpg_uk: [28, 38], diesel_mpg_uk: [42, 50] },
  "Alfa Romeo::Giulia":      { petrol_mpg_uk: [32, 42], diesel_mpg_uk: [50, 58] },
  "Alpine::A290":            { battery_kwh: [52, 52], kwh_per_100km: [14.6, 15.5] },
  "Alpine::A110":            { petrol_mpg_uk: [32, 42] },
  "Fiat::500e":              { battery_kwh: [24, 42], kwh_per_100km: [13.0, 14.5] },
  "Fiat::600e":              { battery_kwh: [54, 54], kwh_per_100km: [15.5, 16.5] },
  "Fiat::Topolino":          { battery_kwh: [5.4, 5.4], kwh_per_100km: [9.0, 10.0] },
  "Fiat::500":               { petrol_mpg_uk: [50, 60] },
  "Fiat::Panda":             { petrol_mpg_uk: [50, 60] },
  "Jeep::Avenger":           { battery_kwh: [54, 54], kwh_per_100km: [15.5, 16.5], petrol_mpg_uk: [44, 55] },
  "Jeep::Compass":           { petrol_mpg_uk: [38, 48] },
  "Jeep::Wrangler":          { petrol_mpg_uk: [22, 30] },
  "DS Automobiles::DS 3":    { battery_kwh: [50, 54], kwh_per_100km: [15.5, 16.0] },

  // ---------------- SEAT ----------------
  "SEAT::Ibiza":  { petrol_mpg_uk: [48, 60] },
  "SEAT::Leon":   { petrol_mpg_uk: [42, 54] },
  "SEAT::Ateca":  { petrol_mpg_uk: [38, 48] },
  "SEAT::Arona":  { petrol_mpg_uk: [44, 55] },
};

async function main() {
  const raw = JSON.parse(await readFile(path, "utf8"));
  let touched = 0;
  let withSpecs = 0;
  let withoutSpecs = 0;
  for (const make of raw.makes) {
    for (const model of make.models) {
      const key = `${make.name}::${model.model}`;
      if (SPECS[key]) {
        // Round to 1 dp for the JSON file
        const spec = SPECS[key];
        const cleaned = {};
        for (const [k, v] of Object.entries(spec)) {
          if (Array.isArray(v)) {
            cleaned[k] = [
              Math.round(v[0] * 10) / 10,
              Math.round(v[1] * 10) / 10,
            ];
          }
        }
        if (JSON.stringify(model.specs ?? {}) !== JSON.stringify(cleaned)) {
          model.specs = cleaned;
          touched += 1;
        }
        withSpecs += 1;
      } else {
        if (model.specs) {
          delete model.specs;
          touched += 1;
        }
        withoutSpecs += 1;
      }
    }
  }
  await writeFile(path, JSON.stringify(raw, null, 2) + "\n", "utf8");
  console.log(
    `Wrote specs for ${withSpecs} models, ${withoutSpecs} without (${touched} changes).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
