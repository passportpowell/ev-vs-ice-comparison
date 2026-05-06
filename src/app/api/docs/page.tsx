import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "API Reference",
  description:
    "Interactive OpenAPI 3.1 reference for the EV vs ICE Intelligence Lab REST surface.",
  alternates: { canonical: "/api/docs" },
};

export default function ApiDocsPage() {
  return (
    <main className="api-docs-shell">
      <header className="api-docs-header">
        <p className="eyebrow">REST surface</p>
        <h1>API Reference</h1>
        <p>
          Open data product. Every endpoint that powers the dashboard is also
          callable directly. The OpenAPI 3.1 spec is served from{" "}
          <a href="/api/openapi.json">/api/openapi.json</a>.
        </p>
      </header>
      <link
        rel="stylesheet"
        href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"
      />
      <div id="swagger-ui" />
      <Script
        src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"
        strategy="afterInteractive"
      />
      <Script
        src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"
        strategy="afterInteractive"
      />
      <Script
        id="swagger-ui-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener("load", function () {
              if (typeof window.SwaggerUIBundle === "undefined") return;
              window.ui = window.SwaggerUIBundle({
                url: "/api/openapi.json",
                dom_id: "#swagger-ui",
                deepLinking: true,
                docExpansion: "list",
                presets: [
                  window.SwaggerUIBundle.presets.apis,
                  window.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout",
                tryItOutEnabled: true,
                defaultModelsExpandDepth: -1
              });
            });
          `,
        }}
      />
    </main>
  );
}
