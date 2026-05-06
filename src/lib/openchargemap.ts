// UK charging-station feed.
//
// Primary source: OpenStreetMap via the Overpass API. OSM has crowd-sourced
// charging-station POIs across the entire UK, no API key required, free
// to use under ODbL.
//
// Optional secondary: OpenChargeMap. As of 2024 OCM tightened its policy
// and now requires an API key for the public /poi endpoint. If
// OPENCHARGEMAP_API_KEY is set we'll merge OCM rows on top of the
// Overpass results.
//
// Final fallback: a small curated list of well-known UK ultra-rapid
// hubs so the dashboard has something to plot when both upstreams are
// unreachable.

export type ChargingStation = {
  id: number;
  title: string;
  operator: string;
  town: string;
  postcode: string;
  country: string;
  lat: number;
  lng: number;
  max_power_kw: number;
  connectors: Array<{ type: string; power_kw: number; quantity: number }>;
  is_operational: boolean;
  last_verified: string | null;
  source_url: string;
};

export type ChargingStationsFeed = {
  fetched_at: string;
  source_name: string;
  source_url: string;
  country_code: string;
  count: number;
  min_power_kw: number;
  stale: boolean;
  note: string;
  stations: ChargingStation[];
};

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const OCM_BASE = "https://api.openchargemap.io/v3/poi";

// UK bounding box (rough): south=49.5, west=-8, north=61, east=2
const UK_BBOX = "49.5,-8,61,2";

const FALLBACK_STATIONS: ChargingStation[] = [
  station(304842, "Gridserve Braintree", "Gridserve", "Braintree", "CM77 8YA", 51.892, 0.5786, 350, "CCS", 350, 30),
  station(208122, "Tesla Supercharger Heathrow", "Tesla", "Hounslow", "TW6 1QG", 51.4717, -0.4596, 250, "Tesla CCS", 250, 16),
  station(168720, "InstaVolt Banbury", "InstaVolt", "Banbury", "OX17 1JD", 52.0598, -1.3406, 125, "CCS", 125, 6),
  station(310512, "Gridserve Electric Forecourt Norwich", "Gridserve", "Norwich", "NR4 6DJ", 52.611, 1.2486, 350, "CCS", 350, 36),
  station(258400, "MFG EV Power Knutsford", "MFG", "Knutsford", "WA16 6JJ", 53.3145, -2.3698, 300, "CCS", 300, 8),
  station(165220, "BP Pulse Hammersmith", "BP Pulse", "London", "W6 0NW", 51.4912, -0.2236, 150, "CCS", 150, 4),
  station(177822, "Osprey Newark", "Osprey", "Newark", "NG24 2EQ", 53.0746, -0.7975, 175, "CCS", 175, 8),
  station(289614, "Fastned Bristol", "Fastned", "Bristol", "BS34 5RJ", 51.5181, -2.5654, 300, "CCS", 300, 4),
  station(195422, "Ionity Maidstone", "Ionity", "Maidstone", "ME17 2QL", 51.255, 0.585, 350, "CCS", 350, 6),
  station(214558, "Tesla Supercharger Aberdeen", "Tesla", "Aberdeen", "AB12 4XS", 57.0858, -2.205, 250, "Tesla CCS", 250, 12),
  station(307210, "Gridserve M5 Brent Knoll", "Gridserve", "Highbridge", "TA9 4HZ", 51.265, -2.948, 350, "CCS", 350, 12),
  station(317710, "Tesla Supercharger Glasgow", "Tesla", "Glasgow", "G2 6AA", 55.8587, -4.2592, 250, "Tesla CCS", 250, 12),
];

function station(
  id: number,
  title: string,
  operator: string,
  town: string,
  postcode: string,
  lat: number,
  lng: number,
  power: number,
  connectorType: string,
  connectorPower: number,
  quantity: number
): ChargingStation {
  return {
    id,
    title,
    operator,
    town,
    postcode,
    country: "United Kingdom",
    lat,
    lng,
    max_power_kw: power,
    connectors: [{ type: connectorType, power_kw: connectorPower, quantity }],
    is_operational: true,
    last_verified: null,
    source_url: `https://openstreetmap.org/node/${id}`,
  };
}

// ---------------------------------------------------------------------------
// Overpass / OSM
// ---------------------------------------------------------------------------

type OverpassNode = {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

type OverpassPayload = {
  elements: OverpassNode[];
  remark?: string;
};

function powerFromTags(tags: Record<string, string>): {
  maxPower: number;
  connectors: ChargingStation["connectors"];
} {
  // OSM tags charging stations with one or more
  // ``socket:<connector>:output`` keys (e.g. socket:type2_combo:output=50 kW).
  // We pull every output, parse the kW, and pick the highest as headline.
  const connectors: ChargingStation["connectors"] = [];
  let maxPower = 0;
  for (const [key, value] of Object.entries(tags)) {
    const match = key.match(/^socket:([a-z0-9_-]+):output$/);
    if (!match) continue;
    const kw = parseFloat(value);
    if (!Number.isFinite(kw)) continue;
    const type = match[1].replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const qty = parseInt(tags[`socket:${match[1]}`] ?? "1", 10) || 1;
    connectors.push({ type, power_kw: kw, quantity: qty });
    if (kw > maxPower) maxPower = kw;
  }
  if (maxPower === 0) {
    // Some entries only set ``maxstay`` or ``charging_station:output``.
    for (const key of ["charging_station:output", "output", "max_power"]) {
      const v = tags[key];
      if (!v) continue;
      const kw = parseFloat(v);
      if (Number.isFinite(kw) && kw > maxPower) maxPower = kw;
    }
  }
  return { maxPower, connectors };
}

async function fetchOverpassStations(
  minPowerKw: number,
  limit: number
): Promise<ChargingStation[]> {
  // Ask Overpass for a generous slice; we filter by power afterwards.
  // Many UK OSM stations lack power-output tags, so we keep those and
  // mark their power as 0 — UI can decide whether to show them.
  const overpassLimit = Math.min(limit * 3, 6000);
  const query =
    `[out:json][timeout:90];` +
    `node[amenity=charging_station](${UK_BBOX});` +
    `out body ${overpassLimit};`;

  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "ev-vs-ice-intelligence-lab/1.0",
    },
    body: new URLSearchParams({ data: query }).toString(),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Overpass HTTP ${response.status}`);
  }
  const payload = (await response.json()) as OverpassPayload;
  if (payload.remark) {
    // Soft errors come back as 200 with a ``remark`` field.
    throw new Error(`Overpass: ${payload.remark}`);
  }
  const stations: ChargingStation[] = [];
  for (const node of payload.elements) {
    if (node.type !== "node") continue;
    const tags = node.tags ?? {};
    const { maxPower, connectors } = powerFromTags(tags);
    // Keep stations with no power info (very common on OSM) when the
    // user-asked floor is the absolute zero. Otherwise filter.
    if (minPowerKw > 0 && maxPower > 0 && maxPower < minPowerKw) continue;
    if (minPowerKw > 0 && maxPower === 0) continue;
    const operator =
      tags.operator ?? tags["operator:wikidata"] ?? tags.brand ?? "Unknown";
    stations.push({
      id: node.id,
      title: tags.name ?? `${operator} charging station`,
      operator,
      town: tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:suburb"] ?? "",
      postcode: tags["addr:postcode"] ?? "",
      country: "United Kingdom",
      lat: node.lat,
      lng: node.lon,
      max_power_kw: maxPower,
      connectors:
        connectors.length > 0
          ? connectors
          : [{ type: "Unknown", power_kw: maxPower, quantity: 1 }],
      is_operational: tags.access !== "no",
      last_verified: tags["check_date"] ?? null,
      source_url: `https://www.openstreetmap.org/node/${node.id}`,
    });
    if (stations.length >= limit) break;
  }
  return stations;
}

// ---------------------------------------------------------------------------
// OpenChargeMap (optional — only if OPENCHARGEMAP_API_KEY is set)
// ---------------------------------------------------------------------------

type OcmConnection = {
  ConnectionType?: { Title?: string | null } | null;
  PowerKW?: number | null;
  Quantity?: number | null;
};

type OcmPoi = {
  ID: number;
  AddressInfo?: {
    Title?: string | null;
    Town?: string | null;
    Postcode?: string | null;
    Country?: { Title?: string | null } | null;
    Latitude?: number | null;
    Longitude?: number | null;
  } | null;
  OperatorInfo?: { Title?: string | null } | null;
  StatusType?: { IsOperational?: boolean | null } | null;
  Connections?: OcmConnection[] | null;
  DateLastVerified?: string | null;
};

async function fetchOcmStations(
  apiKey: string,
  minPowerKw: number,
  limit: number
): Promise<ChargingStation[]> {
  const params = new URLSearchParams({
    output: "json",
    countrycode: "GB",
    minpowerkw: String(minPowerKw),
    maxresults: String(Math.min(limit, 500)),
    verbose: "false",
    compact: "true",
  });
  const url = `${OCM_BASE}/?${params.toString()}`;
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ev-vs-ice-intelligence-lab/1.0",
      "X-API-Key": apiKey,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`OCM HTTP ${response.status}`);
  const payload = (await response.json()) as OcmPoi[];
  const out: ChargingStation[] = [];
  for (const poi of payload) {
    const a = poi.AddressInfo;
    if (!a || typeof a.Latitude !== "number" || typeof a.Longitude !== "number") continue;
    const connections = (poi.Connections ?? [])
      .filter((c): c is OcmConnection => Boolean(c))
      .map((c) => ({
        type: c.ConnectionType?.Title ?? "Unknown",
        power_kw: c.PowerKW ?? 0,
        quantity: c.Quantity ?? 1,
      }));
    const maxPower = connections.reduce(
      (max, c) => (c.power_kw > max ? c.power_kw : max),
      0
    );
    if (maxPower < minPowerKw) continue;
    out.push({
      id: poi.ID,
      title: a.Title ?? `Site ${poi.ID}`,
      operator: poi.OperatorInfo?.Title ?? "Unknown",
      town: a.Town ?? "",
      postcode: a.Postcode ?? "",
      country: a.Country?.Title ?? "United Kingdom",
      lat: a.Latitude,
      lng: a.Longitude,
      max_power_kw: maxPower,
      connectors: connections,
      is_operational: poi.StatusType?.IsOperational ?? true,
      last_verified: poi.DateLastVerified ?? null,
      source_url: `https://openchargemap.org/site/poi/details/${poi.ID}`,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export async function fetchChargingStations(opts: {
  countryCode?: string;
  minPowerKw?: number;
  limit?: number;
}): Promise<ChargingStationsFeed> {
  const minPower = opts.minPowerKw ?? 50;
  const limit = Math.min(opts.limit ?? 800, 2000);

  const errors: string[] = [];

  // OpenStreetMap / Overpass — primary, keyless.
  let osmStations: ChargingStation[] = [];
  try {
    osmStations = await fetchOverpassStations(minPower, limit);
  } catch (err) {
    errors.push(`OSM: ${err instanceof Error ? err.message : String(err)}`);
  }

  // OpenChargeMap — additive, only with key.
  let ocmStations: ChargingStation[] = [];
  const ocmKey = process.env.OPENCHARGEMAP_API_KEY;
  if (ocmKey) {
    try {
      ocmStations = await fetchOcmStations(ocmKey, minPower, limit);
    } catch (err) {
      errors.push(`OCM: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // De-dupe by approximate location (3 dp ≈ 100 m).
  const merged: ChargingStation[] = [];
  const seen = new Set<string>();
  for (const s of [...osmStations, ...ocmStations]) {
    const key = `${s.lat.toFixed(3)},${s.lng.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(s);
    if (merged.length >= limit) break;
  }

  if (merged.length > 0) {
    const sources: string[] = [];
    if (osmStations.length > 0) sources.push(`${osmStations.length} OSM`);
    if (ocmStations.length > 0) sources.push(`${ocmStations.length} OCM`);
    return {
      fetched_at: new Date().toISOString(),
      source_name: ocmStations.length > 0 ? "OSM + OpenChargeMap" : "OpenStreetMap (Overpass)",
      source_url: ocmStations.length > 0 ? "https://openchargemap.org/" : "https://overpass-api.de/",
      country_code: opts.countryCode ?? "GB",
      count: merged.length,
      min_power_kw: minPower,
      stale: false,
      note: `Live UK charge points · ${sources.join(" + ")}`,
      stations: merged,
    };
  }

  // Fallback — neither source returned data.
  return {
    fetched_at: new Date().toISOString(),
    source_name: "Curated UK fallback",
    source_url: "https://www.openstreetmap.org/",
    country_code: opts.countryCode ?? "GB",
    count: FALLBACK_STATIONS.length,
    min_power_kw: minPower,
    stale: true,
    note: `Live sources unreachable: ${errors.join("; ") || "no upstream configured"}.`,
    stations: FALLBACK_STATIONS.filter((s) => s.max_power_kw >= minPower),
  };
}
