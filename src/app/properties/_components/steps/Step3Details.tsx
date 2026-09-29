// import type { PropertyFormData } from "../PropertyFormWizard";
import {
  sectionTitle,
  fieldGroup,
  labelStyle,
  inputStyle,
  grid3,
  hint,
} from "../property-form-ui";
import { LIGHT } from "../../../zoho/_components/ui";
import { PropertyFormData } from "../PropertyFormWizard";

function NumInput({
  label,
  value,
  onChange,
  placeholder,
  tip,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tip?: string;
}) {
  return (
    <div style={fieldGroup}>
      <label style={labelStyle}>{label}</label>
      <input
        style={inputStyle}
        type="number"
        min={0}
        placeholder={placeholder ?? "0"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {tip && <span style={hint}>{tip}</span>}
    </div>
  );
}

export function Step3Details({
  data,
  onChange,
}: {
  data: PropertyFormData;
  onChange: (patch: Partial<PropertyFormData>) => void;
}) {
  return (
    <div>
      <h2 style={sectionTitle}>📐 Property Details</h2>
      <p
        style={{
          marginBottom: "1.5rem",
          padding: "0.7rem 1rem",
          background: LIGHT.accentSoft,
          borderRadius: 8,
          fontSize: "0.8rem",
          color: LIGHT.accent,
          lineHeight: 1.5,
        }}
      >
        These numbers help estimate the scope of a project.{" "}
        <strong>40 units → smaller opportunity; 500 units → larger opportunity.</strong>
      </p>

      <div style={grid3}>
        <NumInput
          label="Number of Units"
          value={data.numberOfUnits}
          onChange={(v) => onChange({ numberOfUnits: v })}
          placeholder="e.g. 120"
        />
        <NumInput
          label="Estimated Residents"
          value={data.estimatedResidents}
          onChange={(v) => onChange({ estimatedResidents: v })}
          placeholder="e.g. 240"
          tip="Approx. 2 residents per unit"
        />
        <NumInput
          label="Year Built (Optional)"
          value={data.yearBuilt}
          onChange={(v) => onChange({ yearBuilt: v })}
          placeholder="e.g. 1998"
        />
      </div>
    </div>
  );
}
