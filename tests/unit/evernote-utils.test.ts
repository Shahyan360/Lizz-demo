import { describe, expect, it } from "vitest";
import {
  isBrandNewResidentialGateInstall,
  isEvernoteHandoffComplete,
  resolveProposalPriority,
  wasAdminHandoffAlreadySent,
  wasProposalHandoffAlreadySent,
  wasSchedulingHandoffAlreadySent,
} from "@/lib/reply/evernote-utils";

describe("isBrandNewResidentialGateInstall", () => {
  it("detects new install from request type and existing gate", () => {
    expect(
      isBrandNewResidentialGateInstall({
        "Request Type": "New gate installation",
        "Existing Gate?": "No",
      })
    ).toBe(true);
  });

  it("does not flag replacement jobs", () => {
    expect(
      isBrandNewResidentialGateInstall({
        "Request Type": "Gate replacement",
        "Existing Gate?": "Yes",
      })
    ).toBe(false);
  });
});

describe("resolveProposalPriority", () => {
  it("returns Normal for brand-new installs", () => {
    expect(
      resolveProposalPriority({
        "Request Type": "New gate installation",
        "Existing Gate?": "No",
      })
    ).toBe("Normal");
  });

  it("returns High for replacements", () => {
    expect(
      resolveProposalPriority({
        "Request Type": "Gate replacement",
        "Existing Gate?": "Yes",
      })
    ).toBe("High");
  });
});

describe("isEvernoteHandoffComplete", () => {
  it("accepts Missing Information set to None", () => {
    expect(
      isEvernoteHandoffComplete({
        "Missing Information": "None",
      })
    ).toBe(true);
  });

  it("accepts Missing Information set to None.", () => {
    expect(
      isEvernoteHandoffComplete({
        "Missing Information": "None.",
      })
    ).toBe(true);
  });

  it("rejects when missing fields are still listed", () => {
    expect(
      isEvernoteHandoffComplete({
        "Missing Information": "Site Address, Photos",
      })
    ).toBe(false);
  });
});

describe("wasProposalHandoffAlreadySent", () => {
  it("returns false on first intake (no prior handoff ack)", () => {
    const history = `
Earlier in this thread:
Lizzz sent Residential Gate and Call Box Proposal Request template.

Recent messages with this contact:
- (7/24/2026) [FROM Lizzz (our reply)] "Residential Gate and Call Box Proposal Request" — Please send your property address...
`;
    expect(wasProposalHandoffAlreadySent(history)).toBe(false);
  });

  it("returns false when history only has the proposal template ballpark language", () => {
    const history = `
Recent messages with this contact:
- (7/24/2026) [FROM Lizzz (our reply)] "Residential Gate and Call Box Proposal Request" — Once we take a look at the info and photos, we'll follow up with a ballpark estimate.
`;
    expect(wasProposalHandoffAlreadySent(history)).toBe(false);
  });

  it("returns true when Lizzz already acknowledged team follow-up", () => {
    const history = `
Earlier in this thread:
Request Type: New gate installation
Power at Gate?: Yes

Recent messages with this contact:
- (7/24/2026) [FROM Lizzz (our reply)] "Re: new gate" — Thanks Adnan, we got your details and Jeff will follow up with a ballpark estimate.
- (7/23/2026) [FROM Lizzz (our reply)] "Residential Gate and Call Box Proposal Request" — Please send your property address...
`;
    expect(wasProposalHandoffAlreadySent(history)).toBe(true);
  });
});

describe("wasSchedulingHandoffAlreadySent", () => {
  it("returns true after scheduling handoff ack", () => {
    const history = `
- (7/24/2026) [FROM Lizzz (our reply)] "Scheduling Request" — Thanks, Sarah will follow up to confirm your site visit.
`;
    expect(wasSchedulingHandoffAlreadySent(history)).toBe(true);
  });
});

describe("wasAdminHandoffAlreadySent", () => {
  it("returns true after admin handoff ack", () => {
    const history = `
- (7/24/2026) [FROM Lizzz (our reply)] "Admin Follow Up" — Beverly will follow up on your CRM request.
`;
    expect(wasAdminHandoffAlreadySent(history)).toBe(true);
  });
});
