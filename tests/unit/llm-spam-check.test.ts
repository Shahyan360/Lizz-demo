import { describe, expect, it } from "vitest";
import {
  isLikelyCustomerAdminOrBillingEmail,
  isLikelyCustomerReply,
} from "@/lib/spam/llm-spam-check";

describe("isLikelyCustomerReply", () => {
  it("detects replies by subject prefix", () => {
    expect(isLikelyCustomerReply("Re: Gate photos", "Here they are.")).toBe(true);
    expect(isLikelyCustomerReply("FWD: Gate photos", "See below")).toBe(true);
  });

  it("detects replies by body content heuristics", () => {
    expect(
      isLikelyCustomerReply(
        "Gate photos",
        "Hello assistant, your team requested me to send gate photos. Do you need anything else?"
      )
    ).toBe(true);
  });

  it("returns false for non-replies", () => {
    expect(isLikelyCustomerReply("Gate photos", "I am sending you these pictures.")).toBe(false);
  });
});

describe("isLikelyCustomerAdminOrBillingEmail", () => {
  it("keeps Crestline-style CRM / W-9 vendor updates in inbox", () => {
    const subject = "Update corporate account records — Account #5012";
    const body = `
Hi Lizzz,

Please update our corporate account records in your CRM database for Account #5012.
Our parent company recently merged, and we are updating all active vendor records
for future billing and accounting correspondence. Here are our updated accounting details:

Account Name: Crestline Property Management Group
Primary AP Contact: Karen Thorne (Billing Supervisor)
New Billing Address: 1100 Wilson Blvd, Suite 1500, Arlington, VA 22209
Accounts Payable Email: invoices@crestlinepm.com
Direct Accounting Phone: (703) 555-0119
W-9 / Tax Exempt: Attached is our updated ST-12 Virginia Tax Exemption form for 2026.
Please also email us your company's updated 2026 W-9 form for our tax files.

Thank you,
Karen Thorne
Accounts Payable Supervisor
Crestline Property Management
`;
    expect(isLikelyCustomerAdminOrBillingEmail(subject, body)).toBe(true);
  });

  it("still rejects clear credential phishing even if billing words appear", () => {
    const subject = "Urgent: verify your account billing";
    const body = `
Your account #5012 has been locked. Click here to verify your password and
confirm your bank routing number immediately or we will suspend billing.
`;
    expect(isLikelyCustomerAdminOrBillingEmail(subject, body)).toBe(false);
  });

  it("returns false for unrelated sales mail", () => {
    expect(
      isLikelyCustomerAdminOrBillingEmail(
        "Gate repair quote",
        "Can you come look at our driveway gate this week?"
      )
    ).toBe(false);
  });
});
