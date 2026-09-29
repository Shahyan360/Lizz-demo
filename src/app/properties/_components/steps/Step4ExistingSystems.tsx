import type { PropertyFormData } from "../PropertyFormWizard";
import {
  sectionTitle,
  fieldGroup,
  labelStyle,
  inputStyle,
  grid2,
  grid3,
  subheading,
  hint,
  checkboxRow,
} from "../property-form-ui";
import { LIGHT } from "../../../zoho/_components/ui";

const CREDENTIALS = [
  { value: "KEY_FOB", label: "🔑 Key Fobs" },
  { value: "ACCESS_CARDS", label: "💳 Access Cards" },
  { value: "MOBILE_APP", label: "📱 Mobile App" },
  { value: "PIN_CODES", label: "🔢 PIN Codes" },
  { value: "UNKNOWN", label: "❓ Unknown" },
];

export function Step4ExistingSystems({
  data,
  onChange,
}: {
  data: PropertyFormData;
  onChange: (patch: Partial<PropertyFormData>) => void;
}) {
  function toggleCredential(value: string) {
    const current = data.credentials;
    const next = current.includes(value)
      ? current.filter((c) => c !== value)
      : [...current, value];
    onChange({ credentials: next });
  }

  return (
    <div>
      <h2 style={sectionTitle}>🔧 Existing Systems</h2>
      <p style={{ ...hint, marginBottom: "1rem", fontSize: "0.8rem" }}>
        This is the most important section — it identifies sales opportunities. For example, a
        DoorKing call box is a potential ButterflyMX upgrade candidate.
      </p>

      {/* Call Box */}
      <p style={subheading}>Call Box</p>
      <div style={grid3}>
        <div style={fieldGroup}>
          <label style={labelStyle}>Brand</label>
          <input
            style={inputStyle}
            placeholder="e.g. DoorKing"
            value={data.callBoxBrand}
            onChange={(e) => onChange({ callBoxBrand: e.target.value })}
          />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle}>Model</label>
          <input
            style={inputStyle}
            placeholder="e.g. 1837"
            value={data.callBoxModel}
            onChange={(e) => onChange({ callBoxModel: e.target.value })}
          />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle}>Quantity</label>
          <input
            style={inputStyle}
            type="number"
            min={0}
            placeholder="e.g. 2"
            value={data.callBoxQuantity}
            onChange={(e) => onChange({ callBoxQuantity: e.target.value })}
          />
        </div>
      </div>

      {/* Access Control */}
      <p style={subheading}>Access Control</p>
      <div style={grid2}>
        <div style={fieldGroup}>
          <label style={labelStyle}>Brand</label>
          <input
            style={inputStyle}
            placeholder="e.g. Linear"
            value={data.accessControlBrand}
            onChange={(e) => onChange({ accessControlBrand: e.target.value })}
          />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle}>Model</label>
          <input
            style={inputStyle}
            placeholder="e.g. eMerge"
            value={data.accessControlModel}
            onChange={(e) => onChange({ accessControlModel: e.target.value })}
          />
        </div>
      </div>

      {/* Surveillance */}
      <p style={subheading}>Surveillance</p>
      <div style={grid2}>
        <div style={fieldGroup}>
          <label style={labelStyle}>Brand</label>
          <input
            style={inputStyle}
            placeholder="e.g. Avigilon"
            value={data.surveillanceBrand}
            onChange={(e) => onChange({ surveillanceBrand: e.target.value })}
          />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle}>Model</label>
          <input
            style={inputStyle}
            placeholder="e.g. H5A"
            value={data.surveillanceModel}
            onChange={(e) => onChange({ surveillanceModel: e.target.value })}
          />
        </div>
      </div>

      {/* Credentials */}
      <p style={subheading}>Credentials Used</p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "0.6rem",
        }}
      >
        {CREDENTIALS.map((c) => {
          const checked = data.credentials.includes(c.value);
          return (
            <label
              key={c.value}
              style={{
                ...checkboxRow,
                padding: "0.5rem 0.75rem",
                borderRadius: 8,
                border: `1px solid ${checked ? LIGHT.accent : LIGHT.border}`,
                background: checked ? LIGHT.accentSoft : LIGHT.panelAlt,
                color: checked ? LIGHT.accent : LIGHT.text,
                fontWeight: checked ? 700 : 400,
                transition: "all 0.15s ease",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggleCredential(c.value)}
                style={{ accentColor: LIGHT.accent }}
              />
              {c.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
