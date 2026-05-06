import { Suspense } from "react";

import { Dashboard } from "@/components/Dashboard";
import { dataset } from "@/lib/data";

export default function Home() {
  return (
    <Suspense fallback={<DashboardFallback />}>
      <Dashboard data={dataset} />
    </Suspense>
  );
}

function DashboardFallback() {
  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Portfolio data product</p>
          <h1>EV vs ICE Intelligence Lab</h1>
        </div>
      </header>
      <p className="dashboard-loading">Loading dashboard…</p>
    </main>
  );
}
