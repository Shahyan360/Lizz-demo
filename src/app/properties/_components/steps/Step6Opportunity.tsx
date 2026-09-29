import type { PropertyFormData } from "../PropertyFormWizard";
import {
  sectionTitle,
  fieldGroup,
  labelStyle,
  selectStyle,
  textareaStyle,
  subheading,
  hint,
} from "../property-form-ui";
import { LIGHT } from "../../../zoho/_components/ui";

const RATINGS = [
  { value: "HIGH", label: "🟢 High", color: LIGHT.success },
  { value: "MEDIUM", label: "🟡 Medium", color: "#c2620e" },
  { value: "LOW", label: "🔴 Low", color: LIGHT.danger },
  { value: "UNKNOWN", label: "⚪ Unknown", color: LIGHT.textMuted },
];

function RatingPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={fieldGroup}>
      <label style={labelStyle}>{label}</label>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
        {RATINGS.map((r) => {
          const active = value === r.value;
          return (
            <button
              key={r.value}
              type="button"
              onClick={() => onChange(r.value)}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: 8,
                border: `1.5px solid ${active ? r.color : LIGHT.border}`,
                background: active ? `${r.color}18` : LIGHT.panelAlt,
                color: active ? r.color : LIGHT.textSecondary,
                fontSize: "0.82rem",
                fontWeight: active ? 700 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {r.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Step6Opportunity({
  data,
  onChange,
}: {
  data: PropertyFormData;
  onChange: (patch: Partial<PropertyFormData>) => void;
}) {
  return (
    <div>
      <h2 style={sectionTitle}>🎯 Sales Opportunity</h2>
      <p style={{ ...hint, marginBottom: "1.25rem", fontSize: "0.8rem" }}>
        Lizzz's assessment — this helps prioritize which properties deserve immediate attention.
      </p>

      <p style={subheading}>ButterflyMX Opportunity</p>
      <RatingPicker
        label="ButterflyMX Rating"
        value={data.butterflyMxRating}
        onChange={(v) => onChange({ butterflyMxRating: v as PropertyFormData["butterflyMxRating"] })}
      />

      <p style={{ ...subheading, marginTop: "1.5rem" }}>Invisible Intercom Opportunity</p>
      <RatingPicker
        label="Invisible Intercom Rating"
        value={data.invisibleIntercomRating}
        onChange={(v) =>
          onChange({ invisibleIntercomRating: v as PropertyFormData["invisibleIntercomRating"] })
        }
      />

      <div style={{ marginTop: "1.5rem", ...fieldGroup }}>
        <label style={labelStyle}>Notes</label>
        <textarea
          style={textareaStyle}
          placeholder="e.g. Existing DoorKing 1837. Excellent ButterflyMX upgrade candidate."
          value={data.opportunityNotes}
          onChange={(e) => onChange({ opportunityNotes: e.target.value })}
        />
      </div>
    </div>
  );
}
