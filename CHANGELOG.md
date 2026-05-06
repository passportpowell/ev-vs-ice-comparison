# Changelog

All notable changes to the EV vs ICE Intelligence Lab. Format follows
[Keep a Changelog](https://keepachangelog.com/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Catalog expansion** — UK vehicle catalog grown from 69 to 200 trims across
  42 brands (BYD, Genesis, Porsche, Jaguar, Lotus, Maserati, Smart, Subaru,
  Mitsubishi, Jeep, Ineos, Alpine, DS Automobiles, Suzuki, Alfa Romeo, plus
  wider coverage of every existing brand).
- **Live Octopus Energy API integration** — `src/lib/octopus.ts` and
  `/api/prices/electricity` proxy the public Octopus product feed and surface
  Agile, Go, Intelligent Octopus Go, and Cosy unit rates for any DNO region.
- **National Grid Carbon Intensity API integration** — `src/lib/carbon-intensity.ts`
  and `/api/prices/carbon-intensity` return the half-hourly UK forecast plus
  the current generation mix (gas, wind, nuclear, solar...). Wired into a new
  "Live grid CO2" metric tile on the dashboard.
- **OpenChargeMap charging-station feed** — `src/lib/openchargemap.ts` and
  `/api/charging-stations` (paged, region-filterable). Dashboard now shows an
  interactive Leaflet map of UK rapid and ultra-rapid chargers with operator,
  power, and connector metadata.
- **Nightly data refresh workflow** — `.github/workflows/refresh-data.yml` runs
  the full pipeline at 03:30 UTC, captures live Octopus + Carbon Intensity
  snapshots into `public/data/live/`, and auto-commits any diff.
- **TF-IDF + LSA RAG** — pipeline now fits a `TfidfVectorizer` (1- and 2-grams)
  and a `TruncatedSVD` (Latent Semantic Analysis) over the corpus, baking
  per-doc TF-IDF vectors and the top-3 semantic neighbours into the dataset.
  Runtime in `src/lib/rag.ts` does proper cosine-similarity scoring and
  surfaces semantic neighbours alongside lexical matches.
- **Deep neural network for signals** — `train_sequence_model()` extracts
  sliding 8-step windows of speed, acceleration, and jerk (Hann-smoothed via
  `scipy.signal`), then trains a 64-32-16 ReLU MLP with Adam + early stopping
  to predict the next-step acceleration. Reports R² 0.986, MAE 0.044 m/s².
  New "Deep Sequence Model" panel renders the loss curve and sample
  predictions vs. actuals.
- **OpenAPI 3.1 spec + Swagger UI** — `/api/openapi.json` serves the full
  spec (now with response schemas for every endpoint); `/api/docs` renders an
  interactive try-it-out reference loaded from the Swagger UI CDN.
- **SEO upgrades** — dynamic Open Graph image at `src/app/opengraph-image.tsx`
  (1200×630 generated via `next/og`), Twitter Cards, three JSON-LD blocks
  (`SoftwareApplication`, `Dataset`, `ItemList` of `Car` items for the top
  10 vehicles), canonical URL, locale, and richer keywords.
- **Repo documentation** — README now carries CI, Refresh, TypeScript,
  Python, and Next.js status badges.

### Changed
- **Dashboard layout** — replaced the rigid 2-column grid with a
  12-column workspace using `grid-auto-flow: dense`. Wide panels (Cost vs
  CO2e, Catalog, Tariffs, Equivalents, Ranked, Agent) span 8 cols; smaller
  side panels (Powertrain, ML, Signal, API) span 4 cols. Ranked Comparison
  and Agent now span 12 to make room for their wide tables.
- **Visual restyle** — softer drop shadows, 14 px card radii, gradient
  accents on highlight cards, hover lift on metric tiles, custom-scrollbar
  catalog list, segment tabs are now solid teal pills, selected catalog row
  shows a teal-soft background + inset ring.
- **Catalog list** — removed the hidden 8-item cap; results panel now
  scrolls through up to 60 visible matches.
- **Topbar** — h1 dropped from a hero `clamp(2rem, 4vw, 4.4rem)` to a tighter
  `2.2rem` max with proper hierarchy; capability chips are pill badges; a
  highlighted "API docs" link now points to `/api/docs`.

### Tooling
- New script: `scripts/expand-catalog.mjs` — idempotent generator that adds
  the 131 new vehicles to both `data/raw/vehicles.csv` and the JSON dataset.
- New script: `scripts/refresh-live-snapshots.mjs` — pulled by the nightly
  workflow to write `public/data/live/octopus.json` and
  `public/data/live/carbon-intensity.json`.

### Notes
- The OpenAPI spec, GitHub README badges, and structured data assume the
  repository slug `passportpowell/ev-vs-ice-comparison`. Update if forked.
- OpenChargeMap accepts anonymous traffic at low volume; set
  `OPENCHARGEMAP_API_KEY` for production reliability.
- The MLP sequence model trains on every pipeline run (~3 s on CPU); R² /
  MAE are stored in the dataset so the dashboard does not retrain at
  request time.
