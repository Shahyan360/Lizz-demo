interface MetricCardProps {
  label: string;
  value: string | number;
  sublabel: string;
  /** Optional accent color for the headline value. */
  accentColor?: string;
}

/** A single dashboard metric tile. */
export function MetricCard({
  label,
  value,
  sublabel,
  accentColor,
}: MetricCardProps) {
  return (
    <div
      className="transition-all"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "0.75rem",
        padding: "1.5rem",
        backdropFilter: "blur(8px)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <p
        style={{
          color: "var(--text-secondary)",
          fontSize: "0.75rem",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          fontWeight: 600,
        }}
      >
        {label}
      </p>
      <h3
        className="font-display"
        style={{
          fontSize: "2.25rem",
          fontWeight: 700,
          margin: "0.5rem 0 0.25rem",
          color: accentColor ?? "var(--text-primary)",
        }}
      >
        {value}
      </h3>
      <p style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>
        {sublabel}
      </p>
    </div>
  );
}
