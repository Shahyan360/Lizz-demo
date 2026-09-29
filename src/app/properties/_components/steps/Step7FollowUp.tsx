import { PropertyFormData } from "../PropertyFormWizard";
import {
  sectionTitle,
  fieldGroup,
  labelStyle,
  inputStyle,
  selectStyle,
  textareaStyle,
  grid2,
  hint,
} from "../property-form-ui";
import { LIGHT } from "../../../zoho/_components/ui";


const QUALIFICATION_STATUSES = [
  { value: "NEW_PROSPECT", label: "New Prospect" },
  { value: "RESEARCHING", label: "Researching" },
  { value: "QUALIFIED", label: "Qualified" },
  { value: "PROPOSAL_READY", label: "Proposal Ready" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent" },
  { value: "CUSTOMER", label: "Customer" },
  { value: "LOST", label: "Lost" },
];

export function Step7FollowUp({
  data,
  onChange,
}: {
  data: PropertyFormData;
  onChange: (patch: Partial<PropertyFormData>) => void;
}) {
  return (
    <div>
      <h2 style={sectionTitle}>📅 Follow-Up</h2>
      <p
        style={{
          marginBottom: "1.5rem",
          padding: "0.7rem 1rem",
          background: LIGHT.successSoft,
          borderRadius: 8,
          fontSize: "0.8rem",
          color: LIGHT.success,
          lineHeight: 1.5,
        }}
      >
        Lizzz will remind the team to reconnect every <strong>3 months</strong> so you never lose
        touch with a property.
      </p>

      {/* Dates */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={fieldGroup}>
          <label style={labelStyle}>Next Follow-Up Date</label>
          <input
            style={inputStyle}
            type="datetime-local"
            value={data.nextFollowUpDate}
            onChange={(e) => onChange({ nextFollowUpDate: e.target.value })}
          />
          <span style={hint}>Leave blank to default to 3 months from today. Pick a near-future time to test the automated email.</span>
        </div>
      </div>

      {/* Qualification Status */}
      <div style={{ ...fieldGroup, marginTop: "1rem" }}>
        <label style={labelStyle}>Qualification Status</label>
        <select
          style={selectStyle}
          value={data.qualificationStatus}
          onChange={(e) =>
            onChange({ qualificationStatus: e.target.value as PropertyFormData["qualificationStatus"] })
          }
        >
          {QUALIFICATION_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* Internal Notes */}
      <div style={{ ...fieldGroup, marginTop: "1rem" }}>
        <label style={labelStyle}>Internal Notes</label>
        <textarea
          style={textareaStyle}
          placeholder="Any additional context for the sales team..."
          value={data.internalNotes}
          onChange={(e) => onChange({ internalNotes: e.target.value })}
        />
      </div>
    </div>
  );
}
