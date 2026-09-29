import type { PropertyFormData } from "../PropertyFormWizard";
import {
  sectionTitle,
  fieldGroup,
  labelStyle,
  inputStyle,
  hint,
} from "../property-form-ui";
import { LIGHT } from "../../../zoho/_components/ui";

const DEVICE_FIELDS: {
  key: keyof PropertyFormData;
  label: string;
  icon: string;
  tip?: string;
}[] = [
  {
    key: "accessControlledDoors",
    label: "Access-Controlled Doors",
    icon: "🚪",
    tip: "Doors currently with access control",
  },
  {
    key: "additionalDoorsToSecure",
    label: "Additional Doors to Secure",
    icon: "🔒",
    tip: "Doors the property wants to add access control to",
  },
  { key: "vehicleGates", label: "Vehicle Gates", icon: "🚗" },
  { key: "pedestrianGates", label: "Pedestrian Gates", icon: "🚶" },
  { key: "garageDoors", label: "Garage Doors", icon: "🏠" },
  { key: "adaDoorOperators", label: "ADA Door Operators", icon: "♿" },
  { key: "cameras", label: "Cameras", icon: "📷" },
];

export function Step5DeviceCounts({
  data,
  onChange,
}: {
  data: PropertyFormData;
  onChange: (patch: Partial<PropertyFormData>) => void;
}) {
  return (
    <div>
      <h2 style={sectionTitle}>🔢 Device Counts</h2>
      <p
        style={{
          marginBottom: "1.5rem",
          padding: "0.7rem 1rem",
          background: "#fff2e0",
          borderRadius: 8,
          fontSize: "0.8rem",
          color: "#c2620e",
          lineHeight: 1.5,
        }}
      >
        Sales needs these exact numbers before preparing a proposal. Fill in what you know — leave
        blanks for unknown values.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        {DEVICE_FIELDS.map(({ key, label, icon, tip }) => (
          <div
            key={key}
            style={{
              background: LIGHT.panelAlt,
              border: `1px solid ${LIGHT.border}`,
              borderRadius: 10,
              padding: "0.85rem 1rem",
            }}
          >
            <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <span style={{ fontSize: "1rem" }}>{icon}</span>
              {label}
            </label>
            <input
              style={{ ...inputStyle, marginTop: "0.5rem" }}
              type="number"
              min={0}
              placeholder="0"
              value={data[key] as string}
              onChange={(e) => onChange({ [key]: e.target.value })}
            />
            {tip && <span style={hint}>{tip}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
