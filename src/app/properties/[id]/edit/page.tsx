import { APP_HEADER_HEIGHT } from "../../../_components/app-nav";
import { LIGHT } from "../../../zoho/_components/ui";
import { PropertyFormWizard } from "../../_components/PropertyFormWizard";

export const metadata = {
  title: "Edit Property — Property Intelligence",
  description: "Edit an existing residential property in the Invisible Intercom prospect database.",
};

export default function EditPropertyPage({ params }: { params: { id: string } }) {
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
            Edit Property Profile
          </h1>
          <p
            style={{
              margin: "0.3rem 0 0",
              fontSize: "0.88rem",
              color: LIGHT.textSecondary,
            }}
          >
            Modify any of the 7 sections to update this property profile.
          </p>
        </div>

        {/* Wizard */}
        <PropertyFormWizard propertyId={params.id} />
      </div>
    </div>
  );
}
