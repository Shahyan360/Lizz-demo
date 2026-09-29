import { beforeEach, describe, expect, it, vi } from "vitest";

let mockToolCall: any = null;
const chatSpy = vi.fn();

vi.mock("@/config/gemini", () => ({
  getGeminiModel: () => "gemini-2.5-flash",
  geminiChatWithRetry: (params: unknown) => {
    chatSpy(params);
    const p = params as {
      response_format?: { type?: string };
      tools?: Array<{ function: { name: string } }>;
    };
    if (p.response_format?.type === "json_object") {
      const action = mockToolCall?.function?.name ?? "draft_custom_reply";
      return Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ action }) } }],
      });
    }
    if (!mockToolCall) return Promise.reject(new Error("boom"));

    let effectiveToolCall = mockToolCall;
    if (p.tools && p.tools.length > 0) {
      const availableNames = p.tools.map((t) => t.function.name);
      if (!availableNames.includes(mockToolCall.function.name)) {
        const fallbackName = availableNames[0];
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(mockToolCall.function.arguments);
        } catch {
          // ignore
        }
        if (fallbackName === "decline_service") {
          parsedArgs.reason = parsedArgs.reason ?? "Brand-new residential gate installation";
        } else if (fallbackName === "draft_custom_reply") {
          parsedArgs.workflow = parsedArgs.workflow ?? "already_handled";
          parsedArgs.emailDraft = parsedArgs.emailDraft ?? "Thanks for the update.";
        }
        effectiveToolCall = {
          ...mockToolCall,
          function: {
            ...mockToolCall.function,
            name: fallbackName,
            arguments: JSON.stringify(parsedArgs),
          },
        };
      }
    }

    return Promise.resolve({
      choices: [{ message: { tool_calls: [effectiveToolCall] } }],
    });
  },
}));

vi.mock("@/lib/reply/contact-history", () => ({
  buildContactContext: vi.fn(() => Promise.resolve("")),
}));

vi.mock("@/lib/reply/attachments", () => ({
  fetchReplyAttachments: () => Promise.resolve([]),
}));

vi.mock("@/lib/reply/team-roster", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/reply/team-roster")>();
  return {
    ...actual,
    getTeamNames: () => Promise.resolve(["Dave", "Sarah", "Jeff", "Lizzz"]),
    getTeamRoster: () => Promise.resolve([
      { id: "1", name: "Dave", email: "dave@example.com", isPrimary: true, roleKey: "proposal_reviewer", isActive: true },
      { id: "2", name: "Sarah", email: "sarah@example.com", isPrimary: true, roleKey: "scheduling_primary", isActive: true },
      { id: "3", name: "Jeff", email: "jeff@example.com", isPrimary: true, roleKey: "installer", isActive: true },
      { id: "4", name: "Lizzz", email: "Lizzz@example.com", isPrimary: false, roleKey: "ai_assistant", isActive: true },
    ]),
    getPrimaryTeamMemberForRole: (roleKey: string) => {
      if (roleKey === "scheduler" || roleKey === "scheduling_primary") {
        return Promise.resolve({ id: "2", name: "Sarah", email: "sarah@example.com", roleKey, isPrimary: true, isActive: true });
      }
      return Promise.resolve({ id: "1", name: "Dave", email: "dave@example.com", roleKey, isPrimary: true, isActive: true });
    },
  };
});

import { processEmailWithLLM } from "@/lib/reply/llm-orchestrator";
import { buildContactContext } from "@/lib/reply/contact-history";

const base = {
  senderName: "Pat",
  fromAddress: "pat@example.com",
  subject: "Gate",
  bodyText: "...",
};

const proposalExtractedDetails = {
  "Customer / Property": "Pat",
  "Contact Info": "pat@example.com",
  "Site Address": "Unknown",
  "Request Type": "New gate installation",
  "Existing Gate?": "Unknown",
  "Existing Equipment Mentioned": "Unknown",
  "Photos Provided?": "Unknown",
  "Power at Gate?": "Unknown",
  "Phone/Network at Gate?": "Unknown",
  "UL325 Acceptance Mentioned?": "Unknown",
  "Customer Goals": "New residential gate",
  "Relevant History Found": "None",
  "Missing Information": "Property address",
  "Project Details (Complexity)": "Customer appears serious about a new gate.",
};

describe("processEmailWithLLM (JSON payload, exact tool execution)", () => {
  beforeEach(() => {
    chatSpy.mockClear();
    mockToolCall = null;
    vi.mocked(buildContactContext).mockResolvedValue("");
  });

  it("formats the LLM payload as strict JSON", async () => {
    mockToolCall = {
      function: {
        name: "draft_custom_reply",
        arguments: JSON.stringify({
          workflow: "general_inquiry",
          emailDraft: "Hi",
        }),
      },
    };
    await processEmailWithLLM(base);

    const params = chatSpy.mock.calls.at(-1)?.[0] as any;
    const user = params.messages.find((m: any) => m.role === "user");

    expect(() => JSON.parse(user.content as string)).not.toThrow();

    const parsed = JSON.parse(user.content as string);
    expect(parsed.threadDetails.sender).toBe("Pat <pat@example.com>");
    expect(parsed.threadDetails.subject).toBe("Gate");
  });

  it("handles create_proposal_template", async () => {
    mockToolCall = {
      function: {
        name: "create_proposal_template",
        arguments: JSON.stringify({
          extractedDetails: proposalExtractedDetails,
          emailDraft: "Hi Pat, please send us your property address.",
        }),
      },
    };
    const result = await processEmailWithLLM(base);
    expect(result.replyText).toContain("Quote Builder link");
    expect(result.replyText).toContain("http://localhost:3000/quote-builder/");
    expect(result.followUp.join(" ")).toContain("Evernote");
  });

  it("handles create_quote_link", async () => {
    mockToolCall = {
      function: {
        name: "create_quote_link",
        arguments: JSON.stringify({
          customerName: "Pat",
          customerEmail: "pat@example.com",
          emailDraft: "Hi Pat, please use our quote builder link.",
        }),
      },
    };
    const result = await processEmailWithLLM(base);
    expect(result.replyText).toContain("Quote Builder link");
    expect(result.replyText).toContain("http://localhost:3000/quote-builder/");
    expect(result.followUp.join(" ")).toContain("Quote Builder link generated");
  });

  it("handles forward_to_evernote with payload", async () => {
    mockToolCall = {
      function: {
        name: "forward_to_evernote",
        arguments: JSON.stringify({
          extractedDetails: {
            "Customer / Property": "Pat Smith",
            "Contact Info": "555-1234",
            "Site Address": "123 Main St",
            "Missing Information": "None",
          },
          recommendedNextStep: "Jeff should schedule a site visit.",
          priority: "Normal",
          routeTo: "Jeff",
          summary: "Pat wants a residential gate replacement at 123 Main St.",
          emailDraft: "Thanks Pat, we got your details and will follow up soon.",
        }),
      },
    };
    const result = await processEmailWithLLM(base);
    expect(result.replyText).toBe(
      "Thanks Pat, we got your details and will follow up soon."
    );
    expect(result.evernotePayload).toContain("Customer / Property: Pat Smith");
    expect(result.followUp.join(" ")).toContain("Evernote");
    expect(result.followUp.join(" ")).toContain("Jeff");
  });

  it("blocks duplicate forward_to_evernote when handoff already sent", async () => {
    vi.mocked(buildContactContext).mockResolvedValue(
      `Recent messages with this contact:
- (7/24/2026) [FROM Lizzz (our reply)] "Residential Gate and Call Box Proposal Request" — Thanks Pat, we got your details and Jeff will follow up with a ballpark estimate.
Request Type: New gate installation`
    );
    mockToolCall = {
      function: {
        name: "forward_to_evernote",
        arguments: JSON.stringify({
          extractedDetails: {
            "Customer / Property": "Pat Smith",
            "Contact Info": "555-1234",
            "Site Address": "123 Main St",
            "Missing Information": "None",
          },
          recommendedNextStep: "Jeff should schedule a site visit.",
          priority: "Normal",
          routeTo: "Jeff",
          summary: "Pat wants a residential gate replacement at 123 Main St.",
          emailDraft: "Thanks Pat, we'll be in touch soon.",
        }),
      },
    };
    const result = await processEmailWithLLM(base);
    expect(result.evernotePayload).toBeUndefined();
    expect(result.followUp.join(" ")).toMatch(/(already forwarded|already handed off|Custom draft reply)/i);
  });

  it("routes brand-new install forward_to_evernote to decline with Normal priority", async () => {
    vi.mocked(buildContactContext).mockResolvedValue(
      `Earlier in this thread:
Residential Gate and Call Box Proposal Request`
    );
    mockToolCall = {
      function: {
        name: "forward_to_evernote",
        arguments: JSON.stringify({
          extractedDetails: {
            "Customer / Property": "Adnan Alvi",
            "Contact Info": "adnannalvi675@gmail.com",
            "Site Address": "123 Main St",
            "Request Type": "New gate installation",
            "Existing Gate?": "No",
            "Missing Information": "None",
          },
          recommendedNextStep: "Jeff should provide a ballpark estimate.",
          priority: "Normal",
          routeTo: "Jeff",
          summary: "New gate install — all details gathered.",
          emailDraft: "Thanks, Jeff will follow up with an estimate.",
        }),
      },
    };
    const result = await processEmailWithLLM({
      ...base,
      bodyText: "Here are my project goals for the new gate installation.",
    });
    expect(result.evernotePayload).toContain("Priority: Normal");
    expect(result.evernotePayload).toContain("Declined —");
    expect(result.followUp[0]).toContain("Out-of-scope");
  });

  it("handles decline_service", async () => {
    mockToolCall = {
      function: {
        name: "decline_service",
        arguments: JSON.stringify({
          reason: "Garage door — not our service",
          emailDraft: "Hey Pat, unfortunately we only work on automatic gates.",
        }),
      },
    };
    const result = await processEmailWithLLM(base);
    expect(result.replyText).toBe(
      "Hey Pat, unfortunately we only work on automatic gates."
    );
    expect(result.followUp[0]).toContain("Out-of-scope");
  });

  it("overrides decline_service to draft_custom_reply on first contact for unsupported services", async () => {
    mockToolCall = {
      function: {
        name: "decline_service",
        arguments: JSON.stringify({
          reason: "Unsupported service: automatic doors",
        }),
      },
    };
    const result = await processEmailWithLLM({
      ...base,
      bodyText: "I want a new automatic door installed at my site.",
    });
    // Should be overridden to draft_custom_reply
    expect(result.replyText).toBe("Thanks for the update.");
    expect(result.followUp.join(" ")).not.toContain("Out-of-scope");
  });

  it("handles get_product_information", async () => {
    mockToolCall = {
      function: {
        name: "get_product_information",
        arguments: JSON.stringify({
          productCategory: "access_control",
          customerQuestion: "Do you install mobile access for gated communities?",
          productsReferenced: ["Access Control"],
          emailDraft:
            "Hi Pat, yes — we install access control with mobile credentials and telephone entry.",
          nextAction: "Offer site visit if they want a proposal.",
        }),
      },
    };
    const result = await processEmailWithLLM(base);
    expect(result.replyText).toContain("mobile credentials");
    expect(result.followUp.join(" ")).toContain("Access Control");
    expect(result.followUp.join(" ")).toContain("site visit");
  });

  it("handles draft_custom_reply and runs its explicit execution block", async () => {
    mockToolCall = {
      function: {
        name: "draft_custom_reply",
        arguments: JSON.stringify({
          workflow: "commercial_gate_repair",
          emailDraft: "Hey Pat, we'll get a tech out to take a look.",
          nextAction: "Assign to commercial team.",
        }),
      },
    };
    const result = await processEmailWithLLM(base);
    expect(result.replyText).toBe("Hey Pat, we'll get a tech out to take a look.");
    expect(result.followUp[0]).toBe("Assign to commercial team.");
  });

  it("handles forward_scheduling_to_evernote with Sarah task", async () => {
    mockToolCall = {
      function: {
        name: "forward_scheduling_to_evernote",
        arguments: JSON.stringify({
          extractedDetails: {
            "Customer / Property": "Jared Smith",
            "Contact Info": "555-9876",
            "Site Address": "456 Oak Ave",
            "Meeting Type": "Site visit",
            "Purpose / Context": "Follow up on gate proposal",
            "Preferred Dates / Times": "Next Tuesday or Wednesday morning",
            "Alternate Availability": "Thursday afternoon",
            "Related Project / History": "Residential gate proposal sent last week",
            "Missing Information": "None",
            "Summary of Request": "Jared wants a site visit to review gate install.",
          },
          recommendedNextStep: "Sarah should call Jared to confirm a site visit time.",
          priority: "Normal",
          summary: "Jared provided availability for a site visit on his gate project.",
          emailDraft:
            "Thanks Jared — we got your scheduling preferences and Sarah will follow up to confirm a time.",
        }),
      },
    };
    const result = await processEmailWithLLM(base);
    expect(result.replyText).toContain("Sarah will follow up");
    expect(result.evernotePayload).toContain("Meeting Type: Site visit");
    expect(result.schedulingTask?.title).toContain("Sarah: Schedule");
    expect(result.ccTeammates).toEqual(["Sarah"]);
    expect(result.followUp.join(" ")).toContain("Sarah");
  });

  it("falls back gracefully when the model throws", async () => {
    mockToolCall = null;
    const result = await processEmailWithLLM(base);
    expect(result.llmFailed).toBe(true);
    expect(result.followUp.length).toBeGreaterThan(0);
  });
});
