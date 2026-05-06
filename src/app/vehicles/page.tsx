import type { Metadata } from "next";
import Link from "next/link";

import { dataset } from "@/lib/data";
import { naturalCompare, vehicleDisplayName } from "@/lib/vehicles";

export const metadata: Metadata = {
  title: "All UK vehicles",
  description:
    "Browse 200+ EV, petrol, diesel, and hybrid trims across 42 UK brands with prices, efficiency, and lifecycle CO2 estimates.",
  alternates: { canonical: "/vehicles" },
};

export default function VehiclesIndexPage() {
  const grouped = new Map<string, typeof dataset.vehicles>();
  for (const vehicle of dataset.vehicles) {
    const list = grouped.get(vehicle.make) ?? [];
    list.push(vehicle);
    grouped.set(vehicle.make, list);
  }
  const makes = Array.from(grouped.keys()).sort();

  return (
    <main className="vehicles-shell">
      <header className="vehicles-header">
        <p className="eyebrow">Catalog</p>
        <h1>UK vehicle catalog</h1>
        <p>
          200 trims across 42 brands. Click any trim for full ownership cost,
          lifecycle CO₂e, and equivalent comparisons.
        </p>
      </header>

      <div className="vehicles-makes">
        {makes.map((make) => {
          const list = (grouped.get(make) ?? []).sort(
            (a, b) =>
              naturalCompare(a.model, b.model) ||
              naturalCompare(a.trim, b.trim)
          );
          return (
            <section className="make-section" key={make}>
              <h2>{make}</h2>
              <ul>
                {list.map((vehicle) => (
                  <li key={vehicle.id}>
                    <Link href={`/vehicles/${vehicle.id}`}>
                      <strong>{vehicleDisplayName(vehicle)}</strong>
                      <span>
                        {vehicle.model_year} · {vehicle.powertrain}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
