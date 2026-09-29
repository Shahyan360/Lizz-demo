import { describe, expect, it } from "vitest";
import {
  hasInboundAttachments,
  markPhotosProvidedFromAttachments,
  stripPhotoAsksFromDraft,
  claimedAttachmentsMissing,
  ensureMissingAttachmentAskInDraft,
} from "@/lib/reply/attachment-awareness";

describe("claimedAttachmentsMissing", () => {
  it("detects when the customer says they attached but no file arrived", () => {
    expect(
      claimedAttachmentsMissing("Please see the attached photo of the gate.", [])
    ).toBe(true);
    expect(
      claimedAttachmentsMissing("I've attached the pictures below.", [])
    ).toBe(true);
  });

  it("is false when a real attachment is present", () => {
    expect(
      claimedAttachmentsMissing("I've attached the pictures.", ["gate.jpg"])
    ).toBe(false);
  });

  it("is false when they never claimed an attachment", () => {
    expect(claimedAttachmentsMissing("Can you come look at our gate?", [])).toBe(
      false
    );
  });
});

describe("ensureMissingAttachmentAskInDraft", () => {
  it("asks the customer to re-attach when they claimed a file that is missing", () => {
    const out = ensureMissingAttachmentAskInDraft(
      "Hi,\nThanks for reaching out.\n\nLizzz",
      "I've attached photos of the gate.",
      []
    );
    expect(out).toMatch(/don.?t see any file/i);
    expect(out).toMatch(/re-attach/i);
    expect(out).not.toMatch(/we received your attachment/i);
  });
});

describe("hasInboundAttachments", () => {
  it("is true when filenames are present", () => {
    expect(hasInboundAttachments(["gate.jpg"])).toBe(true);
  });

  it("is false for empty lists", () => {
    expect(hasInboundAttachments([])).toBe(false);
    expect(hasInboundAttachments(undefined)).toBe(false);
  });
});

describe("markPhotosProvidedFromAttachments", () => {
  it("sets Photos Provided and removes photo from Missing Information", () => {
    const next = markPhotosProvidedFromAttachments(
      {
        "Photos Provided?": "No",
        "Missing Information": "Site Address, Photos, Customer Goals",
      },
      ["front.jpg", "inside.png"]
    );
    expect(next["Photos Provided?"]).toMatch(/^Yes/i);
    expect(next["Photos Provided?"]).toContain("front.jpg");
    expect(next["Missing Information"]).toBe("Site Address, Customer Goals");
  });
});

describe("stripPhotoAsksFromDraft", () => {
  it("removes proposal template photo bullets and acknowledges the file", () => {
    const draft = `Hi,
Thanks for checking in with us about your project.

If you can, please also send over:
  -1 overview photo from outside looking in.
  -1 overview photo from inside looking out.
  -1 or 2 pictures of the current gear or any obvious problem areas.
  -What are your main goals for the project?

Once we take a look at the info and photos, we'll follow up with a ballpark estimate.

Lizzz`;

    const out = stripPhotoAsksFromDraft(draft, ["broken-gate.jpg"]);
    expect(out).not.toMatch(/overview photo from outside/i);
    expect(out).not.toMatch(/pictures of the current gear/i);
    expect(out).toMatch(/main goals/i);
    expect(out).toMatch(/info/i);
  });

  it("leaves the draft alone when there are no attachments", () => {
    const draft = "Please send a photo of the gate.";
    expect(stripPhotoAsksFromDraft(draft, [])).toBe(draft);
  });
});
