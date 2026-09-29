import { APP_HEADER_HEIGHT } from "../../_components/app-nav";
import { LIGHT } from "../../zoho/_components/ui";
import { PropertyFormWizard } from "../_components/PropertyFormWizard";

export const metadata = {
  title: "Add Property — Property Intelligence",
  description: "Add a new residential property to the Invisible Intercom prospect database.",
};

export default function NewPropertyPage() {
  return (
    <div
      style={{
        position: "fixed",
        top: APP_HEADER_HEIGHT,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        background: LIGHT.appBg,
        overflow: "auto",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "2rem 1.5rem 0",
          boxSizing: "border-box",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "2rem" }}>
          <a
            href="/properties"
            style={{
              fontSize: "0.8rem",
              color: LIGHT.textMuted,
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              marginBottom: "0.75rem",
            }}
          >
            ← Back to Properties
          </a>
          <h1
            style={{
              margin: 0,
              fontSize: "1.5rem",
              fontWeight: 800,
              color: LIGHT.text,
            }}
          >
            Add New Property
          </h1>
          <p
            style={{
              margin: "0.3rem 0 0",
              fontSize: "0.88rem",
              color: LIGHT.textSecondary,
            }}
          >
            Complete all 7 sections to qualify and record this property for the sales team.
          </p>
        </div>

        {/* Wizard */}
        <PropertyFormWizard />
      </div>
    </div>
  );
}
