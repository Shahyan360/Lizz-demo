import type { PropertyFormData } from "../PropertyFormWizard";
import {
  sectionTitle,
  fieldGroup,
  labelStyle,
  inputStyle,
  selectStyle,
  grid2,
  requiredStar,
  hint,
} from "../property-form-ui";
import { LIGHT } from "../../../zoho/_components/ui";


const PROPERTY_TYPES = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "MULTIFAMILY", label: "Multifamily" },
  { value: "HOA", label: "HOA" },
  { value: "CONDO_COMMUNITY", label: "Condo Community" },
];

export function Step1PropertyInfo({
  data,
  onChange,
}: {
  data: PropertyFormData;
  onChange: (patch: Partial<PropertyFormData>) => void;
}) {
  return (
    <div>
      <h2 style={sectionTitle}>🏢 Property Information</h2>

      {/* Name + Type */}
      <div style={grid2}>
        <div style={fieldGroup}>
          <label style={labelStyle}>
            Property Name <span style={requiredStar}>*</span>
          </label>
          <input
            style={inputStyle}
            placeholder="Oak Ridge Apartments"
            value={data.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle}>
            Property Type <span style={requiredStar}>*</span>
          </label>
          <select
            style={selectStyle}
            value={data.propertyType}
            onChange={(e) => onChange({ propertyType: e.target.value as PropertyFormData["propertyType"] })}
          >
            <option value="">— Select type —</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <span style={hint}>Only residential communities are qualified.</span>
        </div>
      </div>

      {/* Management Company */}
      <div style={{ ...fieldGroup, marginTop: "1rem" }}>
        <label style={labelStyle}>Management Company</label>
        <input
          style={inputStyle}
          placeholder="e.g. Greystar"
          value={data.managementCompany}
          onChange={(e) => onChange({ managementCompany: e.target.value })}
        />
      </div>

      {/* Address */}
      <div style={{ ...fieldGroup, marginTop: "1rem" }}>
        <label style={labelStyle}>Street Address</label>
        <input
          style={inputStyle}
          placeholder="123 Main St"
          value={data.streetAddress}
          onChange={(e) => onChange({ streetAddress: e.target.value })}
        />
      </div>

      <div style={{ ...grid2, marginTop: "1rem" }}>
        <div style={fieldGroup}>
          <label style={labelStyle}>City</label>
          <input
            style={inputStyle}
            placeholder="Austin"
            value={data.city}
            onChange={(e) => onChange({ city: e.target.value })}
          />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle}>State</label>
          <input
            style={inputStyle}
            placeholder="TX"
            value={data.state}
            onChange={(e) => onChange({ state: e.target.value })}
          />
        </div>
      </div>

      <div style={{ ...grid2, marginTop: "1rem" }}>
        <div style={fieldGroup}>
          <label style={labelStyle}>ZIP Code</label>
          <input
            style={inputStyle}
            placeholder="78701"
            value={data.zipCode}
            onChange={(e) => onChange({ zipCode: e.target.value })}
          />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle}>Property Phone</label>
          <input
            style={inputStyle}
            placeholder="(512) 555-0100"
            value={data.phone}
            onChange={(e) => onChange({ phone: e.target.value })}
          />
        </div>
      </div>

      <div style={{ ...fieldGroup, marginTop: "1rem" }}>
        <label style={labelStyle}>Website</label>
        <input
          style={inputStyle}
          placeholder="https://oakridgeapartments.com"
          value={data.website}
          onChange={(e) => onChange({ website: e.target.value })}
        />
      </div>

      <p
        style={{
          marginTop: "1.5rem",
          padding: "0.75rem 1rem",
          background: LIGHT.accentSoft,
          borderRadius: 8,
          fontSize: "0.8rem",
          color: LIGHT.accent,
          lineHeight: 1.5,
        }}
      >
        <strong>Note:</strong> Only residential communities (Apartments, Multifamily, HOA, Condo) are
        qualified prospects. Non-residential properties should not be entered.
      </p>
    </div>
  );
}
