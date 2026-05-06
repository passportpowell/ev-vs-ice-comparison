// Live UK grid carbon intensity feed.
// API docs: https://carbonintensity.org.uk/

export type CarbonIntensitySnapshot = {
  fetched_at: string;
  from: string;
  to: string;
  forecast_gco2_per_kwh: number;
  actual_gco2_per_kwh: number | null;
  index: string;
  generation_mix: Array<{ fuel: string; percentage: number }>;
  source_name: string;
  source_url: string;
  stale: boolean;
  note: string;
};

const INTENSITY_URL = "https://api.carbonintensity.org.uk/intensity";
const MIX_URL = "https://api.carbonintensity.org.uk/generation";

const FALLBACK: CarbonIntensitySnapshot = {
  fetched_at: new Date(0).toISOString(),
  from: "1970-01-01T00:00Z",
  to: "1970-01-01T00:30Z",
  forecast_gco2_per_kwh: 168,
  actual_gco2_per_kwh: 168,
  index: "moderate",
  generation_mix: [],
  source_name: "National Grid ESO Carbon Intensity API",
  source_url: "https://carbonintensity.org.uk/",
  stale: true,
  note: "Live carbon intensity refresh failed; returning fallback average.",
};

type IntensityPayload = {
  data: Array<{
    from: string;
    to: string;
    intensity: {
      forecast: number;
      actual: number | null;
      index: string;
    };
  }>;
};

type GenerationPayload = {
  data: {
    from: string;
    to: string;
    generationmix: Array<{ fuel: string; perc: number }>;
  };
};

export async function fetchCarbonIntensity(): Promise<CarbonIntensitySnapshot> {
  try {
    const [intensityResponse, generationResponse] = await Promise.all([
      fetch(INTENSITY_URL, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
      fetch(MIX_URL, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
    ]);

    if (!intensityResponse.ok) {
      return { ...FALLBACK, fetched_at: new Date().toISOString() };
    }

    const intensity = (await intensityResponse.json()) as IntensityPayload;
    const head = intensity.data[0];
    if (!head) {
      return { ...FALLBACK, fetched_at: new Date().toISOString() };
    }

    let generation_mix: CarbonIntensitySnapshot["generation_mix"] = [];
    if (generationResponse.ok) {
      const mix = (await generationResponse.json()) as GenerationPayload;
      generation_mix = mix.data.generationmix
        .filter((row) => row.perc > 0)
        .map((row) => ({ fuel: row.fuel, percentage: row.perc }))
        .sort((a, b) => b.percentage - a.percentage);
    }

    return {
      fetched_at: new Date().toISOString(),
      from: head.from,
      to: head.to,
      forecast_gco2_per_kwh: head.intensity.forecast,
      actual_gco2_per_kwh: head.intensity.actual,
      index: head.intensity.index,
      generation_mix,
      source_name: "National Grid ESO Carbon Intensity API",
      source_url: INTENSITY_URL,
      stale: false,
      note: `Half-hourly grid carbon intensity for the GB transmission system. Index: ${head.intensity.index}.`,
    };
  } catch {
    return { ...FALLBACK, fetched_at: new Date().toISOString() };
  }
}
