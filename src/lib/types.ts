export type FuelType = "electric" | "petrol" | "diesel";

export type Vehicle = {
  id: string;
  make: string;
  model: string;
  trim: string;
  model_year: number;
  available_from_year: number;
  available_to_year: number;
  uk_market_status: "current" | "used";
  body_style: string;
  segment: string;
  powertrain: string;
  fuel_type: FuelType;
  purchase_price_gbp: number;
  efficiency_value: number;
  efficiency_unit: "kwh_per_100km" | "litres_per_100km";
  battery_kwh: number;
  tailpipe_gco2_per_km: number;
  manufacturing_gco2e_kg: number;
  annual_maintenance_gbp: number;
  insurance_group: number;
  depreciation_3yr_pct: number;
  source_note: string;
};

export type Scenario = {
  scenario_id: string;
  label: string;
  annual_miles: number;
  ownership_years: number;
  urban_share_pct: number;
  motorway_share_pct: number;
  grid_year: number;
  price_scenario_id: string;
  grid_gco2e_per_kwh: number;
  petrol_gbp_per_litre: number;
  diesel_gbp_per_litre: number;
  home_electricity_gbp_per_kwh: number;
  public_rapid_gbp_per_kwh: number;
  weighted_electricity_gbp_per_kwh: number;
  home_charging_share_pct: number;
};

export type EvTariff = {
  tariff_id: string;
  supplier: string;
  tariff_name: string;
  tariff_category: "time_of_use" | "smart_charging_add_on";
  off_peak_start: string;
  off_peak_end: string;
  off_peak_hours: number;
  off_peak_min_p_per_kwh: number;
  off_peak_max_p_per_kwh: number;
  default_off_peak_p_per_kwh: number;
  peak_p_per_kwh: number | null;
  standing_charge_p_per_day: number;
  standing_charge_source: string;
  standing_charge_scope: string;
  exit_fee_gbp_per_fuel: number;
  requires_smart_meter: boolean;
  requires_compatible_car_or_charger: boolean;
  applies_to_whole_home: boolean;
  fixed_or_variable: "fixed" | "variable";
  source_name: string;
  source_url: string;
  source_date: string;
  secondary_source_name: string | null;
  secondary_source_value_note: string | null;
  notes: string;
};

export type ScenarioResult = {
  scenario_id: string;
  vehicle_id: string;
  make: string;
  model: string;
  trim: string;
  model_year: number;
  available_from_year: number;
  available_to_year: number;
  uk_market_status: string;
  body_style: string;
  segment: string;
  powertrain: string;
  fuel_type: FuelType;
  annual_miles: number;
  ownership_years: number;
  adjusted_efficiency: number;
  efficiency_unit: string;
  energy_unit: string;
  energy_units_used: number;
  energy_cost_gbp: number;
  maintenance_cost_gbp: number;
  depreciation_cost_gbp: number;
  total_cost_gbp: number;
  total_cost_per_mile_gbp: number;
  annual_energy_cost_gbp: number;
  use_phase_kgco2e: number;
  manufacturing_kgco2e: number;
  lifecycle_kgco2e: number;
  lifecycle_tonnes_co2e: number;
  break_even_miles_vs_segment_ice?: number | null;
};

export type PowertrainSummary = {
  scenario_id: string;
  powertrain: string;
  vehicles: number;
  avg_total_cost_per_mile_gbp: number;
  avg_total_cost_gbp: number;
  avg_lifecycle_tonnes_co2e: number;
  avg_annual_energy_cost_gbp: number;
  avg_use_phase_kgco2e: number;
};

export type SignalFeature = {
  cycle: string;
  samples: number;
  avg_speed_kph: number;
  max_speed_kph: number;
  stop_share_pct: number;
  peak_acceleration_mps2: number;
  peak_deceleration_mps2: number;
  jerk_rms: number;
  energy_stress_score: number;
};

export type ModelReport = {
  target: string;
  training_rows: number;
  test_rows: number;
  r2: number;
  mae_gbp_per_mile: number;
  feature_importance: Array<{ feature: string; importance: number }>;
  permutation_importance?: Array<{ feature: string; mean: number; std: number }>;
  sample_predictions: Array<Record<string, string | number>>;
};

export type SequenceModelReport = {
  target: string;
  framework: string;
  architecture: string;
  parameters?: number;
  feature_window_seconds?: number;
  feature_count?: number;
  training_rows: number;
  test_rows: number;
  r2: number;
  mae_mps2: number;
  epochs_trained: number;
  loss_curve: number[];
  sample_predictions: Array<{
    predicted_acceleration_mps2: number;
    actual_acceleration_mps2: number;
  }>;
  feature_engineering: Record<string, string>;
  training_method?: string;
  weights_path?: string;
};

export type CvSamplePrediction = {
  url: string;
  label: string;
  label_index: number;
  predicted: string;
  confidence: number;
  correct: boolean;
  all_probs: Record<string, number>;
};

export type CvModelReport = {
  framework: string;
  task: string;
  domain: string;
  classes: string[];
  input_size: [number, number, number];
  architecture: string;
  parameters: number;
  trainable_parameters: number;
  training_method: string;
  augmentations: string[];
  samples_per_class: number;
  epochs: number;
  accuracy: number;
  macro_f1: number;
  per_class_accuracy: Record<string, number>;
  confusion_matrix: number[][];
  loss_curve: number[];
  val_accuracy_curve: number[];
  sample_predictions: CvSamplePrediction[];
  onnx_path: string;
};

export type RagDocument = {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  source: string;
  metadata: Record<string, string | number>;
  tfidf_vector?: Record<string, number>;
  semantic_neighbours?: Array<{ id: string; similarity: number }>;
};

export type RagHit = RagDocument & {
  score: number;
  matched_terms: string[];
  related?: Array<{ id: string; title: string; similarity: number }>;
};

export type RagIndex = {
  vocab: Record<string, { i: number; idf: number }>;
  params: {
    n_components?: number;
    vocab_size?: number;
    ngram_range?: [number, number];
  };
};

export type SourceRegistryEntry = {
  source_id: string;
  source_name: string;
  source_type: string;
  refresh_mode: string;
  fields: string;
  conflict_policy: string;
};

export type AgentStep = {
  step: number;
  action: string;
  observation: string;
};

export type AgentRecommendation = {
  vehicle_id: string;
  vehicle: string;
  powertrain: string;
  reason: string;
  total_cost_per_mile_gbp: number;
  lifecycle_tonnes_co2e: number;
};

export type AgentResponse = {
  query: string;
  intent: "cost" | "emissions" | "balanced";
  scenario_id: string;
  answer: string;
  recommendation: AgentRecommendation | null;
  steps: AgentStep[];
  citations: RagHit[];
};

export type PortfolioDataset = {
  generated_at: string;
  project: {
    name: string;
    slug: string;
    repository: string;
  };
  assumptions: Record<string, string | number>;
  vehicles: Vehicle[];
  ev_tariffs: EvTariff[];
  scenarios: Scenario[];
  scenario_results: ScenarioResult[];
  powertrain_summary: PowertrainSummary[];
  signal_processing: SignalFeature[];
  rag_corpus: RagDocument[];
  rag_index?: RagIndex;
  source_registry: SourceRegistryEntry[];
  model: ModelReport;
  sequence_model?: SequenceModelReport;
  cv_model?: CvModelReport;
  api_examples: string[];
};

export type ScenarioOverrides = {
  annualMiles: number;
  ownershipYears: number;
  urbanSharePct: number;
  motorwaySharePct: number;
  petrolGbpPerLitre: number;
  dieselGbpPerLitre: number;
  homeElectricityGbpPerKwh: number;
  publicRapidGbpPerKwh: number;
  homeChargingSharePct: number;
  gridGco2ePerKwh: number;
  evStandingChargeGbpPerDay?: number;
  standingChargeAllocationPct?: number;
};

export type TariffRateInput = {
  offPeakPPerKwh: number;
  peakPPerKwh: number;
  offPeakSharePct: number;
  standingChargePPerDay: number;
  standingChargeAllocationPct: number;
};

export type EnergyComparisonRow = {
  vehicle_id: string;
  vehicle: string;
  powertrain: string;
  fuel_type: FuelType;
  annual_energy_units: number;
  energy_unit: "kWh" | "litres";
  annual_unit_cost_gbp: number;
  annual_standing_cost_gbp: number;
  annual_total_cost_gbp: number;
  pence_per_mile: number;
  unit_rate_label: string;
};

export type FuelPriceSnapshot = {
  date: string;
  petrol_p_per_litre: number;
  diesel_p_per_litre: number;
  petrol_gbp_per_litre: number;
  diesel_gbp_per_litre: number;
  duty_p_per_litre: number;
  vat_pct: number;
  source_name: string;
  source_url: string;
  fetched_at: string;
  stale: boolean;
  note: string;
};
