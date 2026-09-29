import {
  sectionTitle,
  fieldGroup,
  labelStyle,
  inputStyle,
  grid2,
  hint,
} from "../property-form-ui";
import { LIGHT } from "../../../zoho/_components/ui";
import { PropertyFormData } from "../PropertyFormWizard";

function ContactBlock({
  title,
  roleKey,
  data,
  onChange,
  optional,
}: {
  title: string;
  roleKey: "propertyManager" | "maintenanceManager" | "regionalManager";
  data: PropertyFormData;
  onChange: (patch: Partial<PropertyFormData>) => void;
  optional?: boolean;
}) {
  const contact = data[roleKey];

  function patch(field: "name" | "email" | "phone", value: string) {
    onChange({ [roleKey]: { ...contact, [field]: value } });
  }

  return (
    <div
      style={{
        background: LIGHT.panelAlt,
        border: `1px solid ${LIGHT.border}`,
        borderRadius: 10,
        padding: "1rem",
      }}
    >
      <p style={{ margin: "0 0 0.75rem", fontWeight: 700, fontSize: "0.85rem", color: LIGHT.text }}>
        {title}
        {optional && (
          <span style={{ fontWeight: 400, color: LIGHT.textMuted, fontSize: "0.75rem", marginLeft: "0.5rem" }}>
            (Optional)
          </span>
        )}
      </p>
      <div style={grid2}>
        <div style={fieldGroup}>
          <label style={labelStyle}>Name</label>
          <input
            style={inputStyle}
            placeholder="Jane Doe"
            value={contact.name}
            onChange={(e) => patch("name", e.target.value)}
          />
        </div>
        <div style={fieldGroup}>
          <label style={labelStyle}>Phone</label>
          <input
            style={inputStyle}
            placeholder="(555) 000-0000"
            value={contact.phone}
            onChange={(e) => patch("phone", e.target.value)}
          />
        </div>
      </div>
      <div style={{ ...fieldGroup, marginTop: "0.75rem" }}>
        <label style={labelStyle}>Email</label>
        <input
          style={inputStyle}
          type="email"
          placeholder="jane@property.com"
          value={contact.email}
          onChange={(e) => patch("email", e.target.value)}
        />
      </div>
    </div>
  );
}

export function Step2Contacts({
  data,
  onChange,
}: {
  data: PropertyFormData;
  onChange: (patch: Partial<PropertyFormData>) => void;
}) {
  return (
    <div>
      <h2 style={sectionTitle}>👤 Property Contacts</h2>
      <p style={{ ...hint, marginBottom: "1.25rem", fontSize: "0.8rem" }}>
        Managers change frequently — keeping contacts current is critical for the sales team.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <ContactBlock
          title="Property Manager"
          roleKey="propertyManager"
          data={data}
          onChange={onChange}
        />
        <ContactBlock
          title="Maintenance Manager"
          roleKey="maintenanceManager"
          data={data}
          onChange={onChange}
        />
        <ContactBlock
          title="Regional Manager"
          roleKey="regionalManager"
          data={data}
          onChange={onChange}
          optional
        />
      </div>
    </div>
  );
}
