import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";

import { dataset } from "@/lib/data";
import { buildComparison, getScenario } from "@/lib/data";
import { vehicleDisplayName } from "@/lib/vehicles";

type RouteParams = { params: Promise<{ id: string }> };

export async function generateStaticParams() {
  return dataset.vehicles.map((vehicle) => ({ id: vehicle.id }));
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { id } = await params;
  const vehicle = dataset.vehicles.find((v) => v.id === id);
  if (!vehicle) {
    return { title: "Vehicle not found" };
  }
  const display = vehicleDisplayName(vehicle);
  const yearRange = `${vehicle.available_from_year}-${vehicle.available_to_year}`;
  const description = `${display} ${yearRange}: total cost of ownership, lifecycle CO2e, energy use, and ${vehicle.powertrain} comparisons against equivalent UK vehicles.`;
  return {
    title: `${display} ${vehicle.model_year}`,
    description,
    alternates: { canonical: `/vehicles/${vehicle.id}` },
    openGraph: {
      title: `${display} ${vehicle.model_year} — UK total cost of ownership`,
      description,
      type: "article",
      url: `/vehicles/${vehicle.id}`,
      locale: "en_GB",
    },
    twitter: {
      card: "summary_large_image",
      title: `${display} ${vehicle.model_year}`,
      description,
    },
  };
}

export default async function VehiclePage({ params }: RouteParams) {
  const { id } = await params;
  const vehicle = dataset.vehicles.find((v) => v.id === id);
  if (!vehicle) {
    notFound();
  }

  const scenario = getScenario("mixed_household");
  const scenarioResults = buildComparison(scenario.scenario_id);
  const ownRow = scenarioResults.find((row) => row.vehicle_id === vehicle.id);

  const equivalents = dataset.vehicles
    .filter(
      (other) =>
        other.id !== vehicle.id &&
        other.segment === vehicle.segment &&
        other.body_style === vehicle.body_style
    )
    .slice(0, 6)
    .map((other) => {
      const otherRow = scenarioResults.find((r) => r.vehicle_id === other.id);
      return { vehicle: other, row: otherRow };
    });

  const display = vehicleDisplayName(vehicle);
  const isElectric = vehicle.fuel_type === "electric";

  const carLd = {
    "@context": "https://schema.org",
    "@type": "Car",
    name: display,
    brand: { "@type": "Brand", name: vehicle.make },
    model: vehicle.model,
    modelDate: vehicle.model_year,
    bodyType: vehicle.body_style,
    vehicleEngine: {
      "@type": "EngineSpecification",
      fuelType: vehicle.fuel_type,
      ...(vehicle.battery_kwh
        ? { engineDisplacement: `${vehicle.battery_kwh} kWh battery` }
        : {}),
    },
    fuelEfficiency: {
      "@type": "QuantitativeValue",
      value: vehicle.efficiency_value,
      unitText: isElectric ? "kWh per 100km" : "litres per 100km",
    },
    emissionsCO2: vehicle.tailpipe_gco2_per_km,
    offers: {
      "@type": "Offer",
      price: vehicle.purchase_price_gbp,
      priceCurrency: "GBP",
      availability:
        vehicle.uk_market_status === "current"
          ? "https://schema.org/InStock"
          : "https://schema.org/Discontinued",
    },
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Dashboard",
        item: "https://ev-ice-intelligence-lab.vercel.app/",
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Vehicles",
        item: "https://ev-ice-intelligence-lab.vercel.app/vehicles",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: display,
        item: `https://ev-ice-intelligence-lab.vercel.app/vehicles/${vehicle.id}`,
      },
    ],
  };

  return (
    <main className="vehicle-shell">
      <nav aria-label="Breadcrumb" className="vehicle-breadcrumb">
        <Link href="/">Dashboard</Link>
        <span aria-hidden>›</span>
        <Link href="/vehicles">Vehicles</Link>
        <span aria-hidden>›</span>
        <span>{display}</span>
      </nav>

      <header className="vehicle-hero">
        <p className="eyebrow">{vehicle.powertrain} · {vehicle.segment}</p>
        <h1>{display}</h1>
        <p className="vehicle-summary">
          {vehicle.model_year} {vehicle.body_style} · UK availability{" "}
          {vehicle.available_from_year}-{vehicle.available_to_year} ·{" "}
          {vehicle.uk_market_status === "current" ? "Current model" : "Used market"}
        </p>
      </header>

      <section className="vehicle-grid">
        <article className="vehicle-card">
          <h2>Headline economics</h2>
          <dl>
            <div>
              <dt>List price</dt>
              <dd>{currency(vehicle.purchase_price_gbp)}</dd>
            </div>
            <div>
              <dt>Cost / mile (mixed household)</dt>
              <dd>
                {ownRow ? currency(ownRow.total_cost_per_mile_gbp) : "—"}
              </dd>
            </div>
            <div>
              <dt>Annual energy cost</dt>
              <dd>
                {ownRow ? currency(ownRow.annual_energy_cost_gbp) : "—"}
              </dd>
            </div>
            <div>
              <dt>Lifecycle CO₂e</dt>
              <dd>
                {ownRow
                  ? `${ownRow.lifecycle_tonnes_co2e.toFixed(1)} t`
                  : "—"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="vehicle-card">
          <h2>Engineering</h2>
          <dl>
            <div>
              <dt>Powertrain</dt>
              <dd>{vehicle.powertrain}</dd>
            </div>
            <div>
              <dt>Efficiency</dt>
              <dd>
                {vehicle.efficiency_value}{" "}
                {isElectric ? "kWh/100km" : "L/100km"}
              </dd>
            </div>
            {isElectric ? (
              <div>
                <dt>Battery</dt>
                <dd>{vehicle.battery_kwh} kWh</dd>
              </div>
            ) : (
              <div>
                <dt>Tailpipe CO₂</dt>
                <dd>{vehicle.tailpipe_gco2_per_km} g/km</dd>
              </div>
            )}
            <div>
              <dt>Manufacturing CO₂e</dt>
              <dd>
                {Math.round(vehicle.manufacturing_gco2e_kg / 100) / 10} t
              </dd>
            </div>
            <div>
              <dt>Annual maintenance</dt>
              <dd>{currency(vehicle.annual_maintenance_gbp)}</dd>
            </div>
            <div>
              <dt>Insurance group</dt>
              <dd>{vehicle.insurance_group}</dd>
            </div>
            <div>
              <dt>3-yr depreciation</dt>
              <dd>{Math.round(vehicle.depreciation_3yr_pct * 100)}%</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="vehicle-equivalents">
        <h2>Equivalent {vehicle.segment} vehicles</h2>
        <div className="vehicle-equivalents-table">
          <table>
            <thead>
              <tr>
                <th>Trim</th>
                <th>Powertrain</th>
                <th>Price</th>
                <th>Cost / mile</th>
                <th>Lifecycle CO₂e</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {equivalents.map(({ vehicle: other, row }) => (
                <tr key={other.id}>
                  <td>
                    <strong>{vehicleDisplayName(other)}</strong>
                    <span>{other.model_year}</span>
                  </td>
                  <td>{other.powertrain}</td>
                  <td>{currency(other.purchase_price_gbp)}</td>
                  <td>
                    {row ? currency(row.total_cost_per_mile_gbp) : "—"}
                  </td>
                  <td>
                    {row ? `${row.lifecycle_tonnes_co2e.toFixed(1)} t` : "—"}
                  </td>
                  <td>
                    <Link
                      className="vehicle-link"
                      href={`/vehicles/${other.id}`}
                    >
                      Compare →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="vehicle-source">{vehicle.source_note}</p>

      <Script
        id={`car-ld-${vehicle.id}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(carLd) }}
      />
      <Script
        id={`crumb-ld-${vehicle.id}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </main>
  );
}

function currency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: value < 5 ? 2 : 0,
  }).format(value);
}
