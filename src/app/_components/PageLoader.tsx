interface PageLoaderProps {
  /** Message shown under the spinner. */
  label?: string;
}

/** Full-section loading indicator, used by route-level `loading.tsx` files. */
export function PageLoader({ label = "Loading…" }: PageLoaderProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "6rem 2rem",
        gap: "1rem",
      }}
    >
      <span
        className="spinner"
        aria-hidden="true"
        style={{
          width: "2rem",
          height: "2rem",
          borderWidth: "3px",
          color: "var(--color-primary)",
        }}
      />
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.85rem",
          fontWeight: 500,
        }}
      >
        {label}
      </p>
    </div>
  );
}
