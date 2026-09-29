import { getToneProfile, updateToneProfile } from "../actions/profile.actions";
import { PendingForm } from "../_components/PendingForm";
import { SubmitButton } from "../_components/SubmitButton";
import { jsonStringArray } from "../../lib/json-array";

// Ensure Next.js doesn't cache page renders statically
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const profile = await getToneProfile();

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      
      {/* Page Title */}
      <div style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "2rem", fontWeight: 700, letterSpacing: "-0.03em" }} className="font-display">
          Tone Mimic Controller
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
          Train the multi-agent stack by configuring constraints, greeting templates, and vocabulary metrics.
        </p>
      </div>

      {/* Main Settings Form */}
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "0.75rem",
        padding: "2rem",
        backdropFilter: "blur(8px)"
      }}>
        
        <PendingForm
          action={updateToneProfile}
          style={{ display: "flex", flexDirection: "column", gap: "1.75rem" }}
        >
          
          {/* Row 1: Greetings & Signoffs */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                Greeting Style Template
              </label>
              <input
                type="text"
                name="greetingStyle"
                defaultValue={profile?.greetingStyle || "Hey [Name],"}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "0.375rem",
                  padding: "0.65rem 0.75rem",
                  color: "#FFF",
                  fontSize: "0.85rem",
                  outline: "none"
                }}
                placeholder="e.g. Hi [Name],"
                required
              />
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                Auto-injected into generated draft openers
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
                Sign-off Style Template
              </label>
              <textarea
                name="signoffStyle"
                defaultValue={profile?.signoffStyle || "Thanks,\nAlex"}
                rows={2}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "0.375rem",
                  padding: "0.65rem 0.75rem",
                  color: "#FFF",
                  fontSize: "0.85rem",
                  outline: "none",
                  fontFamily: "inherit",
                  resize: "none"
                }}
                placeholder="e.g. Best,\n[Name]"
                required
              />
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                Appended to generated draft conclusions
              </span>
            </div>

          </div>

          <hr style={{ border: "none", borderBottom: "1px solid var(--border-color)" }} />

          {/* Row 2: Sliders (Sentence Length & Formality) */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
            
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Target Sentence Length
                </label>
                <span style={{ fontSize: "0.8rem", color: "var(--color-primary)", fontWeight: 600 }}>
                  {profile?.avgSentenceLen || 12} words
                </span>
              </div>
              <input
                type="range"
                name="avgSentenceLen"
                min={5}
                max={25}
                defaultValue={profile?.avgSentenceLen || 12}
                style={{
                  width: "100%",
                  accentColor: "var(--color-primary)",
                  cursor: "pointer"
                }}
              />
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                Guides sub-agents to construct brief vs elaborate responses
              </span>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)" }}>
                  Formality Scale
                </label>
                <span style={{ fontSize: "0.8rem", color: "var(--color-primary)", fontWeight: 600 }}>
                  {Math.round((profile?.formalityScale ?? 0.4) * 100)}%
                </span>
              </div>
              <input
                type="range"
                name="formalityScale"
                min={0}
                max={1}
                step={0.1}
                defaultValue={profile?.formalityScale ?? 0.4}
                style={{
                  width: "100%",
                  accentColor: "var(--color-primary)",
                  cursor: "pointer"
                }}
              />
              <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
                0 = Casual/Slang, 100 = Premium Corporate legal jargon
              </span>
            </div>

          </div>

          <hr style={{ border: "none", borderBottom: "1px solid var(--border-color)" }} />

          {/* Row 3: Vocabulary Lists */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              Favored Vocabulary Preferences
            </label>
            <input
              type="text"
              name="vocabularyPref"
              defaultValue={jsonStringArray(profile?.vocabularyPref).join(", ") || "leverage, metrics, expedite"}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--border-color)",
                borderRadius: "0.375rem",
                padding: "0.65rem 0.75rem",
                color: "#FFF",
                fontSize: "0.85rem",
                outline: "none"
              }}
              placeholder="e.g. alignment, paradigm, benchmark"
            />
            <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.25rem", display: "block" }}>
              Comma-separated words you actively favor in standard communications
            </span>
          </div>

          {/* Row 4: Forbidden words */}
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
              Strict Forbidden Words (Failsafe Masked)
            </label>
            <input
              type="text"
              name="forbiddenWords"
              defaultValue={jsonStringArray(profile?.forbiddenWords).join(", ") || "delighted, hope this finds you well, warmest regards"}
              style={{
                width: "100%",
                background: "rgba(239, 68, 68, 0.02)",
                border: "1px solid rgba(239, 68, 68, 0.15)",
                borderRadius: "0.375rem",
                padding: "0.65rem 0.75rem",
                color: "#FFF",
                fontSize: "0.85rem",
                outline: "none"
              }}
              placeholder="e.g. please reply, apologies"
            />
            <span style={{ fontSize: "0.65rem", color: "var(--color-danger)", marginTop: "0.25rem", display: "block" }}>
              WARNING: The Reasoning agent avoids these, and a programmatic post-process strips them before database storage!
            </span>
          </div>

          <hr style={{ border: "none", borderBottom: "1px solid var(--border-color)" }} />

          {/* Save Action Panel */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <SubmitButton className="transition-all" pendingLabel="Saving presets…" style={{
              background: "linear-gradient(135deg, var(--color-primary), #8B5CF6)",
              color: "#FFF",
              border: "none",
              padding: "0.75rem 2rem",
              borderRadius: "0.5rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              boxShadow: "0 4px 15px rgba(99, 102, 241, 0.3)"
            }}>
              Save Mimic Presets
            </SubmitButton>
          </div>

        </PendingForm>

      </div>

    </div>
  );
}
