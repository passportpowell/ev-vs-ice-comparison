import type { MetadataRoute } from "next";

import { dataset } from "@/lib/data";

const BASE_URL = "https://ev-ice-intelligence-lab.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const generated = dataset.generated_at
    ? new Date(dataset.generated_at)
    : new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${BASE_URL}/`,
      lastModified: generated,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/vehicles`,
      lastModified: generated,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/api/docs`,
      lastModified: generated,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];

  const vehicleEntries: MetadataRoute.Sitemap = dataset.vehicles.map(
    (vehicle) => ({
      url: `${BASE_URL}/vehicles/${vehicle.id}`,
      lastModified: generated,
      changeFrequency: "monthly",
      priority: vehicle.uk_market_status === "current" ? 0.7 : 0.5,
    })
  );

  return [...staticEntries, ...vehicleEntries];
}
