"use client";

export default function Error({
  reset
}: {
  reset: () => void;
}) {
  return (
    <main className="error-shell">
      <section>
        <p className="eyebrow">Application error</p>
        <h1>Something went wrong</h1>
        <p>
          The dashboard failed to render this view. The data pipeline and API
          checks are still available through the health endpoint.
        </p>
        <button onClick={reset} type="button">
          Try again
        </button>
      </section>
    </main>
  );
}
