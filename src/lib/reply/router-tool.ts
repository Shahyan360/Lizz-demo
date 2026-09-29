import { z } from "zod";
import { PRODUCT_CATEGORIES } from "./business-knowledge";

const DEFAULT_ROUTE_TO_OPTIONS = ["Dave", "Sarah", "Beverly", "Mathew"] as const;

/**
 * Short, single-purpose descriptions for tool-selection only. The FULL
 * workflow instructions (templates, trigger phrases, etc.) live ONCE in
 * `router-system.ts` and are injected into the Phase 2 system prompt by
 * `buildPhase2SystemPrompt` — they used to also be duplicated here as the
 * tool `description` field, doubling the prompt tokens sent for the same
 * text on every Phase 2 call. Keep these short.
 */
const TOOL_SHORT_DESCRIPTIONS = {
  create_proposal_template:
    "Send AutoGate's standard residential gate/call-box intake questionnaire " +
    "when required project details (address, photos, power, network) are still missing.",
  forward_to_evernote:
    "Forward a fully-detailed service request to the team's Evernote inbox " +
    "once ALL required intake details have been provided — residential gates, " +
    "video surveillance, access control, commercial/HOA, or repairs.",
  create_scheduling_template:
    "Ask for missing scheduling details (contact, meeting type, address, " +
    "preferred times) when the customer wants to schedule but hasn't given availability yet.",
  forward_scheduling_to_evernote:
    "Forward a complete scheduling request to Evernote and create a task for " +
    "the active Scheduling primary.",
  create_admin_followup_template:
    "Ask for missing CRM/admin/billing follow-up details when the request is " +
    "not yet fully specified.",
  forward_admin_to_evernote:
    "Forward a complete CRM/admin follow-up to Evernote and create a task for " +
    "the active Admin / CRM primary.",
  create_video_surveillance_template:
    "Send the video surveillance intake questionnaire when camera-system " +
    "project details are still missing.",
  decline_service:
    "Politely decline a request that is out of AutoGate's service area or " +
    "service type, with referral links.",
  create_quote_link:
    "Generate and send a personalized Quote Builder link for the customer to select products and receive an estimate quotation in Zoho Books.",
  get_product_information:
    "Answer an informational question about AutoGate's product lines using " +
    "only the approved catalog — no pricing, scheduling, or commitments.",
} as const;

function normalizeRouteToOptions(
  routeToOptions: readonly string[],
): [string, ...string[]] {
  const cleaned = [
    ...new Set(
      routeToOptions.map((name) => name.trim()).filter((name) => name.length > 0),
    ),
  ];

  const fallback = [...DEFAULT_ROUTE_TO_OPTIONS];
  return (cleaned.length > 0 ? cleaned : fallback) as [string, ...string[]];
}

function routeToEnum(routeToOptions: readonly string[]) {
  return z.enum(normalizeRouteToOptions(routeToOptions));
}

type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};
// Tool definitions

function buildCoreActionTools(routeToOptions: readonly string[]): ToolDefinition[] {
  const routeEnumValues = normalizeRouteToOptions(routeToOptions);

  return [
    {
      type: "function" as const,
      function: {
        name: "create_proposal_template",
        description: TOOL_SHORT_DESCRIPTIONS.create_proposal_template,
        parameters: {
          type: "object",
          properties: {
            extractedDetails: {
              type: "object",
              description:
                "All project details extracted from the customer's email and conversation history. " +
                "If a value is unknown, return 'Unknown'. Never guess or invent information.",
              properties: {
                "Customer / Property": {
                  type: "string",
                  description: "Customer name and/or property name."
                },
                "Contact Info": {
                  type: "string",
                  description: "Phone number, email address, or other contact details."
                },
                "Site Address": {
                  type: "string",
                  description: "Service address."
                },
                "Request Type": {
                  type: "string",
                  description: "New installation, replacement, repair, etc."
                },
                "Existing Gate?": {
                  type: "string",
                  description: "Yes, No, or Unknown."
                },
                "Existing Equipment Mentioned": {
                  type: "string",
                  description: "Existing gate operator, keypad, call box, etc."
                },
                "Photos Provided?": {
                  type: "string",
                  description: "Yes, No, or Unknown."
                },
                "Power at Gate?": {
                  type: "string",
                  description: "Yes, No, or Unknown."
                },
                "Phone/Network at Gate?": {
                  type: "string",
                  description: "Yes, No, or Unknown."
                },
                "UL325 Acceptance Mentioned?": {
                  type: "string",
                  description: "Yes, No, or Unknown."
                },
                "Customer Goals": {
                  type: "string",
                  description: "Brief summary of what the customer wants."
                },
                "Relevant History Found": {
                  type: "string",
                  description: "Relevant previous conversation or 'None'."
                },
                "Missing Information": {
                  type: "string",
                  description:
                    "Comma-separated list of only the information still required."
                },
                "Project Details (Complexity)": {
                  type: "string",
                  description:
                    "Internal sales assessment. Examples: 'Customer appears serious about replacing an existing gate.', 'Customer is requesting information only.', 'Large commercial project with multiple entry points.'"
                }
              },
              required: [
                "Customer / Property",
                "Contact Info",
                "Site Address",
                "Request Type",
                "Existing Gate?",
                "Existing Equipment Mentioned",
                "Photos Provided?",
                "Power at Gate?",
                "Phone/Network at Gate?",
                "UL325 Acceptance Mentioned?",
                "Customer Goals",
                "Relevant History Found",
                "Missing Information",
                "Project Details (Complexity)"
              ]
            },

            emailDraft: {
              type: "string",
              description:
                "The complete customer-facing email. Ask ONLY for the missing information. " +
                "Do not request information already provided anywhere in the email thread. " +
                "Use AutoGate Electric's proposal request writing style and sign as 'Lizzz'."
            }
          },

          required: ["extractedDetails", "emailDraft"]
        }
      }
    },
    {
      type: "function" as const,
      function: {
        name: "forward_to_evernote",
        description: TOOL_SHORT_DESCRIPTIONS.forward_to_evernote,
        parameters: {
          type: "object",
          properties: {
            extractedDetails: {
              type: "object",
              description:
                "All project details extracted from the full email thread. " +
                "If a value was not provided, enter 'Unknown'. If a field does not apply to this service type, enter 'N/A'. Never invent information.",
              properties: {
                "Customer / Property": {
                  type: "string",
                  description: "Customer name and/or property name.",
                },
                "Contact Info": {
                  type: "string",
                  description: "Phone, email, or other contact details.",
                },
                "Site Address": {
                  type: "string",
                  description: "Full service/property address.",
                },
                "Request Type": {
                  type: "string",
                  description: "e.g. 'New gate installation', 'Video surveillance upgrade', 'Access control install', etc.",
                },
                "Existing Gate?": {
                  type: "string",
                  description: "Yes, No, N/A (for non-gate requests), or Unknown.",
                },
                "Existing Equipment Mentioned": {
                  type: "string",
                  description: "Gate operator, keypad, call box, cameras, NVR, access control panels, etc.",
                },
                "Photos Provided?": {
                  type: "string",
                  description: "Yes (with count if known), No, or Unknown.",
                },
                "Power at Gate?": {
                  type: "string",
                  description: "Yes, No, N/A, or Unknown. For non-gate: power at equipment location.",
                },
                "Phone/Network at Gate?": {
                  type: "string",
                  description: "Yes, No, N/A, or Unknown. For non-gate: network at equipment location.",
                },
                "UL325 Acceptance Mentioned?": {
                  type: "string",
                  description: "Yes, No, Not yet, N/A, or Unknown.",
                },
                "Customer Goals": {
                  type: "string",
                  description: "Brief summary of what the customer wants to achieve.",
                },
                "Relevant History Found": {
                  type: "string",
                  description: "Summary of any relevant prior conversations, or 'None'.",
                },
                "Missing Information": {
                  type: "string",
                  description: "Comma-separated list of any remaining gaps, or 'None'.",
                },
                "Additional Information": {
                  type: "string",
                  description:
                    "Any service-specific details not covered by the fields above. " +
                    "For video surveillance: camera count, wiring type, system age, single/multiple systems, recording/storage needs. " +
                    "For access control: number of doors/entry points, user count. " +
                    "For commercial: gate type, opening width. " +
                    "Put all relevant details here.",
                },
                "Summary of Request": {
                  type: "string",
                  description: "A brief plain-language summary of the entire request for quick scanning.",
                },
              },
              required: [
                "Customer / Property",
                "Contact Info",
                "Site Address",
                "Request Type",
                "Existing Gate?",
                "Existing Equipment Mentioned",
                "Photos Provided?",
                "Power at Gate?",
                "Phone/Network at Gate?",
                "UL325 Acceptance Mentioned?",
                "Customer Goals",
                "Relevant History Found",
                "Missing Information",
                "Additional Information",
                "Summary of Request",
              ],
            },
            recommendedNextStep: {
              type: "string",
              description:
                "One-sentence recommended action for whoever is routeTo, e.g. " +
                "'Should review photos and schedule a site visit.'",
            },
            priority: {
              type: "string",
              description:
                "Priority level. Use Normal for brand-new residential gate installations (MEDIUM in training). " +
                "Use High for replacements, upgrades, modernization, commercial, HOA, video, access control. " +
                "Use Low for out-of-area or vague leads.",
              enum: ["High", "Normal", "Low"],
            },
            routeTo: {
              type: "string",
              description:
                "Which active roster member should handle this — pick the exact " +
                "name from the CURRENT ROUTING ROSTER (in the system prompt) whose " +
                "role matches: the Owner Review primary handles complex opportunities, " +
                "unusual projects, high-value residential, Invisible Intercom, or video " +
                "surveillance projects. The Proposal Review primary handles standard " +
                "residential proposals, site visit reviews, and proposal follow-ups. " +
                "The Scheduling primary handles operations or scheduling handoffs after " +
                "approval. The Admin / CRM primary is only used via " +
                "forward_admin_to_evernote — do not route sales proposals there.",
              enum: routeEnumValues,
            },
            summary: {
              type: "string",
              description:
                "A 2-4 sentence internal summary of this follow-up for the team. " +
                "Cover who the customer is, what they need, what info was collected, " +
                "and what should happen next. Written for the internal team, not the customer.",
            },
            emailDraft: {
              type: "string",
              description:
                "A short, friendly acknowledgment email to the customer letting them know " +
                "we received their details and the team will review and follow up. " +
                "Sign off with 'Lizzz'.",
            },
          },
          required: [
            "extractedDetails",
            "recommendedNextStep",
            "priority",
            "routeTo",
            "summary",
            "emailDraft",
          ],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "create_scheduling_template",
        description: TOOL_SHORT_DESCRIPTIONS.create_scheduling_template,
        parameters: {
          type: "object",
          properties: {
            extractedDetails: {
              type: "object",
              description:
                "Scheduling details extracted from the full email thread. " +
                "If a value is unknown, return 'Unknown'. Never invent information.",
              properties: {
                "Customer / Property": {
                  type: "string",
                  description: "Customer name and/or property name.",
                },
                "Contact Info": {
                  type: "string",
                  description: "Best phone number and/or email for scheduling.",
                },
                "Site Address": {
                  type: "string",
                  description: "Property address, or 'Phone only' / 'Remote'.",
                },
                "Meeting Type": {
                  type: "string",
                  description:
                    "Site visit, sales meeting, service appointment, phone call, etc.",
                },
                "Purpose / Context": {
                  type: "string",
                  description:
                    "Why they want to meet — new project, proposal follow-up, repair, etc.",
                },
                "Preferred Dates / Times": {
                  type: "string",
                  description: "Specific dates/times or general availability.",
                },
                "Alternate Availability": {
                  type: "string",
                  description: "Backup windows, or 'None' / 'Unknown'.",
                },
                "Related Project / History": {
                  type: "string",
                  description: "Prior proposal, open project, or 'None'.",
                },
                "Missing Information": {
                  type: "string",
                  description:
                    "Comma-separated list of scheduling fields still required.",
                },
              },
              required: [
                "Customer / Property",
                "Contact Info",
                "Site Address",
                "Meeting Type",
                "Purpose / Context",
                "Preferred Dates / Times",
                "Alternate Availability",
                "Related Project / History",
                "Missing Information",
              ],
            },
            emailDraft: {
              type: "string",
              description:
                "Customer-facing email asking ONLY for missing scheduling details. " +
                "Subject should reference 'Scheduling Request'. Sign off as Lizzz.",
            },
          },
          required: ["extractedDetails", "emailDraft"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "forward_scheduling_to_evernote",
        description: TOOL_SHORT_DESCRIPTIONS.forward_scheduling_to_evernote,
        parameters: {
          type: "object",
          properties: {
            extractedDetails: {
              type: "object",
              description:
                "All scheduling details from the full thread. Missing Information must be 'None'.",
              properties: {
                "Customer / Property": { type: "string" },
                "Contact Info": { type: "string" },
                "Site Address": { type: "string" },
                "Meeting Type": { type: "string" },
                "Purpose / Context": { type: "string" },
                "Preferred Dates / Times": { type: "string" },
                "Alternate Availability": { type: "string" },
                "Related Project / History": { type: "string" },
                "Missing Information": { type: "string" },
                "Summary of Request": {
                  type: "string",
                  description: "Brief plain-language summary for the team.",
                },
              },
              required: [
                "Customer / Property",
                "Contact Info",
                "Site Address",
                "Meeting Type",
                "Purpose / Context",
                "Preferred Dates / Times",
                "Alternate Availability",
                "Related Project / History",
                "Missing Information",
                "Summary of Request",
              ],
            },
            recommendedNextStep: {
              type: "string",
              description:
                "One sentence for the active Scheduling primary, e.g. 'The scheduling primary should call the customer to schedule a site visit.'",
            },
            priority: {
              type: "string",
              enum: ["High", "Normal", "Low"],
            },
            summary: {
              type: "string",
              description:
                "2-4 sentence internal summary for the active Scheduling primary and the team.",
            },
            emailDraft: {
              type: "string",
              description:
                "Brief acknowledgment that scheduling preferences were received; " +
                "someone from our team will follow up to confirm a time. " +
                "Do NOT mention the scheduling primary or any teammate by name — the scheduling primary is CC'd automatically. " +
                "Sign off as Lizzz.",
            },
          },
          required: [
            "extractedDetails",
            "recommendedNextStep",
            "priority",
            "summary",
            "emailDraft",
          ],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "create_admin_followup_template",
        description: TOOL_SHORT_DESCRIPTIONS.create_admin_followup_template,
        parameters: {
          type: "object",
          properties: {
            extractedDetails: {
              type: "object",
              description:
                "CRM/admin details from the thread. If unknown, return 'Unknown'.",
              properties: {
                "Customer / Property": { type: "string" },
                "Contact Info": { type: "string" },
                "Request Type": {
                  type: "string",
                  description: "e.g. Update contact info, billing admin, CRM correction.",
                },
                "Details / Issue": {
                  type: "string",
                  description: "What needs to change or be followed up administratively.",
                },
                "Related Account or Project": { type: "string" },
                "Urgency": { type: "string" },
                "Relevant History Found": { type: "string" },
                "Missing Information": { type: "string" },
              },
              required: [
                "Customer / Property",
                "Contact Info",
                "Request Type",
                "Details / Issue",
                "Related Account or Project",
                "Urgency",
                "Relevant History Found",
                "Missing Information",
              ],
            },
            emailDraft: {
              type: "string",
              description:
                "Ask ONLY for missing admin/CRM details. Subject should reference 'Admin Follow Up'. Sign off as Lizzz.",
            },
          },
          required: ["extractedDetails", "emailDraft"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "forward_admin_to_evernote",
        description: TOOL_SHORT_DESCRIPTIONS.forward_admin_to_evernote,
        parameters: {
          type: "object",
          properties: {
            extractedDetails: {
              type: "object",
              description: "All CRM/admin details. Missing Information must be 'None'.",
              properties: {
                "Customer / Property": { type: "string" },
                "Contact Info": { type: "string" },
                "Request Type": { type: "string" },
                "Details / Issue": { type: "string" },
                "Related Account or Project": { type: "string" },
                "Urgency": { type: "string" },
                "Relevant History Found": { type: "string" },
                "Missing Information": { type: "string" },
                "Summary of Request": { type: "string" },
              },
              required: [
                "Customer / Property",
                "Contact Info",
                "Request Type",
                "Details / Issue",
                "Related Account or Project",
                "Urgency",
                "Relevant History Found",
                "Missing Information",
                "Summary of Request",
              ],
            },
            recommendedNextStep: {
              type: "string",
              description: "One sentence for Beverly, e.g. 'Beverly should update the contact record.'",
            },
            priority: {
              type: "string",
              enum: ["High", "Normal", "Low"],
            },
            summary: {
              type: "string",
              description: "2-4 sentence internal summary for Beverly and the team.",
            },
            emailDraft: {
              type: "string",
              description:
                "Brief acknowledgment — team will follow up. Do NOT name Beverly — she is CC'd automatically. Sign off as Lizzz.",
            },
          },
          required: [
            "extractedDetails",
            "recommendedNextStep",
            "priority",
            "summary",
            "emailDraft",
          ],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "create_video_surveillance_template",
        description: TOOL_SHORT_DESCRIPTIONS.create_video_surveillance_template,
        parameters: {
          type: "object",
          properties: {
            extractedDetails: {
              type: "object",
              description:
                "All project details extracted from the customer's email and conversation history. " +
                "If a value is unknown, return 'Unknown'. Never guess or invent information.",
              properties: {
                "Customer / Property": {
                  type: "string",
                  description: "Customer name and/or property name.",
                },
                "Contact Info": {
                  type: "string",
                  description: "Phone number, email address, or other contact details.",
                },
                "Site Address": {
                  type: "string",
                  description: "Service address.",
                },
                "Property Type": {
                  type: "string",
                  description: "Residential, commercial, HOA, etc.",
                },
                "Number of Cameras / Coverage Area": {
                  type: "string",
                  description: "How many cameras or approximate area to cover.",
                },
                "Existing Camera System?": {
                  type: "string",
                  description: "Yes (with brand/model of VMS or cameras if known), No, or Unknown.",
                },
                "Single or Multiple Systems?": {
                  type: "string",
                  description: "Is it one system or multiple separate systems? Or Unknown.",
                },
                "System Age": {
                  type: "string",
                  description: "How old is the current system, or Unknown.",
                },
                "Cameras Working vs. Malfunctioning": {
                  type: "string",
                  description: "Details on which cameras work and which don't, or Unknown.",
                },
                "Wiring Type": {
                  type: "string",
                  description: "Coax, ethernet, or Unknown. Whether wiring exists to camera locations.",
                },
                "Power at Camera Locations?": {
                  type: "string",
                  description: "Yes, No, or Unknown.",
                },
                "Recording/Storage Needs": {
                  type: "string",
                  description: "NVR/DVR needs, storage duration preferences, or Unknown.",
                },
                "Remote Viewing Needed?": {
                  type: "string",
                  description: "Yes, No, or Unknown.",
                },
                "Photos/Diagrams Provided?": {
                  type: "string",
                  description: "Yes (with count if known), No, or Unknown.",
                },
                "Areas of Concern": {
                  type: "string",
                  description: "Specific areas: entrances, parking lots, blind spots, etc.",
                },
                "Customer Goals": {
                  type: "string",
                  description: "Brief summary of what the customer wants to achieve.",
                },
                "Missing Information": {
                  type: "string",
                  description:
                    "Comma-separated list of only the information still required.",
                },
              },
              required: [
                "Customer / Property",
                "Contact Info",
                "Site Address",
                "Property Type",
                "Number of Cameras / Coverage Area",
                "Existing Camera System?",
                "Single or Multiple Systems?",
                "System Age",
                "Cameras Working vs. Malfunctioning",
                "Wiring Type",
                "Power at Camera Locations?",
                "Recording/Storage Needs",
                "Remote Viewing Needed?",
                "Photos/Diagrams Provided?",
                "Areas of Concern",
                "Customer Goals",
                "Missing Information",
              ],
            },
            emailDraft: {
              type: "string",
              description:
                "The complete customer-facing email. Ask ONLY for the missing information. " +
                "Do not request information already provided anywhere in the email thread. " +
                "Use AutoGate Electric's friendly writing style and sign as 'Lizzz'.",
            },
          },
          required: ["extractedDetails", "emailDraft"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "decline_service",
        description: TOOL_SHORT_DESCRIPTIONS.decline_service,
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Brief explanation of why the service is out of scope.",
            },
            extractedDetails: {
              type: "object",
              description:
                "All project details gathered from the customer during the conversation. " +
                "REQUIRED when declining a new gate installation after collecting info. " +
                "If no details were gathered (e.g. clearly out-of-scope request), omit this field.",
              properties: {
                "Customer / Property": { type: "string" },
                "Contact Info": { type: "string" },
                "Site Address": { type: "string" },
                "Request Type": { type: "string" },
                "Existing Gate?": { type: "string" },
                "Existing Equipment Mentioned": { type: "string" },
                "Photos Provided?": { type: "string" },
                "Power at Gate?": { type: "string" },
                "Phone/Network at Gate?": { type: "string" },
                "UL325 Acceptance Mentioned?": { type: "string" },
                "Customer Goals": { type: "string" },
                "Relevant History Found": { type: "string" },
                "Missing Information": { type: "string" },
                "Additional Information": { type: "string" },
                "Summary of Request": { type: "string" },
              },
            },
            priority: {
              type: "string",
              description: "Priority level for this opportunity (for Evernote routing).",
              enum: ["High", "Normal", "Low"],
            },
            routeTo: {
              type: "string",
              description:
                "Which active roster member should review this declined opportunity — " +
                "pick the exact name from the CURRENT ROUTING ROSTER whose role fits: " +
                "the Owner Review primary for complex, unusual, or high-value cases; the " +
                "Proposal Review primary for standard residential; the Scheduling " +
                "primary for operations/scheduling; the Admin / CRM primary for " +
                "administrative work.",
              enum: routeEnumValues,
            },
            summary: {
              type: "string",
              description:
                "A 2-4 sentence internal summary for the team. " +
                "Cover who the customer is, what they need, what info was collected, " +
                "and why it was declined.",
            },
            emailDraft: {
              type: "string",
              description:
                "The complete decline email. Keep it warm and brief. " +
                "Include referrals: AGW and Associates (https://www.agwdoors.com/), " +
                "Kelly's Automatic Gate (https://www.kellysgateservice.com/), " +
                "Gate Control Systems (https://www.gatecontrolsystemsinc.com/). " +
                "Sign off with 'Lizzz'.",
            },
          },
          required: ["reason", "emailDraft"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_product_information",
        description: TOOL_SHORT_DESCRIPTIONS.get_product_information,
        parameters: {
          type: "object",
          properties: {
            productCategory: {
              type: "string",
              description: "Primary product line that best matches the customer's question.",
              enum: [...PRODUCT_CATEGORIES],
            },
            customerQuestion: {
              type: "string",
              description: "One-sentence summary of what the customer asked about.",
            },
            productsReferenced: {
              type: "array",
              items: { type: "string" },
              description:
                "Product line names mentioned in the reply (must match approved catalog names).",
            },
            emailDraft: {
              type: "string",
              description:
                "Complete customer-facing email explaining the relevant product/service line. " +
                "Warm, concise, grounded in the catalog only. Offer a next step (e.g. site visit or proposal) " +
                "without quoting price or dates. Sign off as 'Lizzz'.",
            },
            nextAction: {
              type: "string",
              description: "One-sentence internal note for the reviewer.",
            },
          },
          required: ["productCategory", "customerQuestion", "emailDraft"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "create_quote_link",
        description: TOOL_SHORT_DESCRIPTIONS.create_quote_link,
        parameters: {
          type: "object",
          properties: {
            customerName: {
              type: "string",
              description: "Customer's full name or greeting name.",
            },
            customerEmail: {
              type: "string",
              description: "Customer's email address.",
            },
            emailDraft: {
              type: "string",
              description:
                "The complete customer-facing email introducing the personalized Quote Builder link where they can select products and receive an estimate. Sign off as 'Lizzz'.",
            },
          },
          required: ["emailDraft"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "draft_custom_reply",
        description:
          "Call this for ALL other requests that do not match the residential proposal workflow, " +
          "product-information questions, and are not out of scope: commercial gates, HOA, repairs, " +
          "maintenance, access control, telephone entry, video surveillance, scheduling, existing customer " +
          "service, confirming/rechecking details the customer already sent, service-area coverage questions, " +
          "customer no longer interested / withdrawing from a project, " +
          "general questions, etc. Draft a natural, grounded reply that directly addresses what the customer asked.",
        parameters: {
          type: "object",
          properties: {
            workflow: {
              type: "string",
              description: "The assigned workflow category.",
              enum: [
                "none",
                "residential_gate_repair",
                "commercial_gate_install",
                "commercial_gate_repair",
                "hoa_gate_system",
                "access_control",
                "telephone_entry",
                "video_surveillance",
                "invisible_intercom",
                "amenity_access",
                "preventive_maintenance",
                "emergency_service",
                "vendor_purchase",
                "permit_utility",
              ],
            },
            emailDraft: {
              type: "string",
              description:
                "The complete, ready-to-send email reply text. Grounded, natural, human voice. " +
                "Address only what the customer actually asked. Sign off with 'Lizzz'.",
            },
            nextAction: {
              type: "string",
              description: "One-sentence note for the human reviewer about the next business step.",
            },
            routeTo: {
              type: "string",
              description:
                "If an active teammate needs to follow up or was addressed by the customer, set their exact active roster name here so a task is generated and emailed to them.",
              enum: routeEnumValues,
            },
            priority: {
              type: "string",
              description: "Priority of the handoff task if routeTo is set.",
              enum: ["High", "Normal", "Low"],
            },
            extractedDetails: {
              type: "object",
              additionalProperties: {
                type: "string",
              },
              description:
                "Known facts extracted from the complete email thread. Include customer/property, contact information, site address, request type, equipment, urgency, history, missing information, and summary. Never invent facts. Use Unknown when information is unavailable.",
            },
          },
          required: ["workflow", "emailDraft"],
        },
      },
    },
  ];
}

export function buildActionTools(routeToOptions: readonly string[]) {
  return buildCoreActionTools(routeToOptions);
}

export const ACTION_TOOLS = buildActionTools(DEFAULT_ROUTE_TO_OPTIONS);

export function buildForwardToEvernoteSchema(routeToOptions: readonly string[]) {
  return z.object({
    extractedDetails: z.record(z.string()),
    recommendedNextStep: z.string(),
    priority: z.enum(["High", "Normal", "Low"]),
    routeTo: routeToEnum(routeToOptions),
    summary: z.string(),
    emailDraft: z.string(),
  });
}

export function buildDeclineServiceSchema(routeToOptions: readonly string[]) {
  return z.object({
    reason: z
      .string()
      .describe(
        "Specific reason for declining (e.g. out of service area in Richmond, or unsupported service type like residential garage doors)."
      ),
    extractedDetails: z.record(z.string()).optional(),
    priority: z.enum(["High", "Normal", "Low"]).optional(),
    routeTo: routeToEnum(routeToOptions).optional(),
    summary: z.string().optional(),
    emailDraft: z
      .string()
      .describe(
        "The decline reply email. The sentence after 'Thanks for reaching out about the project.' MUST explicitly state the specific reason for declining (e.g. out of service area in Richmond, or unsupported service type like residential garage doors)."
      ),
  });
}

// Keep compatibility exports for current call sites.
export const proposalTemplateSchema = z.object({
  extractedDetails: z.record(z.string()),
  emailDraft: z.string(),
});

export const forwardToEvernoteSchema = buildForwardToEvernoteSchema(
  DEFAULT_ROUTE_TO_OPTIONS,
);

export const schedulingTemplateSchema = z.object({
  extractedDetails: z.record(z.string()),
  emailDraft: z.string(),
});

export function buildForwardSchedulingSchema() {
  return z.object({
    extractedDetails: z.record(z.string()),
    recommendedNextStep: z.string(),
    priority: z.enum(["High", "Normal", "Low"]),
    // routeTo is always "Sarah" for scheduling handoffs; default to it if the LLM omits the field.
    routeTo: z.literal("Sarah").optional().default("Sarah"),
    summary: z.string(),
    emailDraft: z.string(),
  });
}
export const forwardSchedulingSchema = buildForwardSchedulingSchema();

export const adminFollowupTemplateSchema = z.object({
  extractedDetails: z.record(z.string()),
  emailDraft: z.string(),
});

export function buildForwardAdminSchema() {
  return z.object({
    extractedDetails: z.record(z.string()),
    recommendedNextStep: z.string(),
    priority: z.enum(["High", "Normal", "Low"]),
    // routeTo is always "Beverly" for admin handoffs; default to it if the LLM omits the field.
    routeTo: z.literal("Beverly").optional().default("Beverly"),
    summary: z.string(),
    emailDraft: z.string(),
  });
}
export const forwardAdminSchema = buildForwardAdminSchema();

export const videoSurveillanceTemplateSchema = z.object({
  extractedDetails: z.record(z.string()),
  emailDraft: z.string(),
});

export const declineServiceSchema = buildDeclineServiceSchema(DEFAULT_ROUTE_TO_OPTIONS);

export const productInformationSchema = z.object({
  productCategory: z.enum(PRODUCT_CATEGORIES),
  customerQuestion: z.string(),
  productsReferenced: z.array(z.string()).optional(),
  emailDraft: z.string(),
  nextAction: z.string().optional(),
});

export function buildDraftCustomReplySchema(
  routeToOptions: readonly string[]
) {
  return z.object({
    workflow: z.string(),
    emailDraft: z.string(),
    nextAction: z.string().optional(),
    routeTo: routeToEnum(routeToOptions).optional(),
    priority: z
      .string()
      .optional()
      .transform((val) => {
        if (!val) return undefined;
        if (val === "High" || val === "Normal" || val === "Low") return val;
        return "Normal";
      }),

     extractedDetails: z
      .record(z.string())
      .optional(),
  });
}
export const draftCustomReplySchema =
  buildDraftCustomReplySchema(
    DEFAULT_ROUTE_TO_OPTIONS
  );

export const createQuoteLinkSchema = z.object({
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
  emailDraft: z.string(),
});

/**
 * Gemini OpenAI-compat rejects >8 tools per request. We have 11 tools total,
 * so Phase 2 only ever sends the Phase-1-selected action plus (for "gather
 * more info" template actions) its forward-to-Evernote escape hatch — at
 * most 2, well under the limit.
 */
export const EMAIL_ACTIONS = [
  "create_quote_link",
  "create_proposal_template",
  "forward_to_evernote",
  "create_scheduling_template",
  "forward_scheduling_to_evernote",
  "create_admin_followup_template",
  "forward_admin_to_evernote",
  "create_video_surveillance_template",
  "decline_service",
  "get_product_information",
  "draft_custom_reply",
] as const;

export type EmailAction = (typeof EMAIL_ACTIONS)[number];

/** Appended to UNIFIED_SYSTEM_PROMPT for phase-1 routing - same rules, JSON output only. */
export const EMAIL_ROUTE_JSON_SUFFIX = `

---
## ROUTING OUTPUT
Using ALL rules above, reply with JSON only (no other text):
{"action":"<exactly_one_tool_name>"}

Valid values: ${EMAIL_ACTIONS.join(", ")}
`;

/**
 * One-directional escape hatch: a "gather more info" template action may be
 * upgraded to its paired "forward to Evernote" handoff within the SAME Phase
 * 2 call, if the model judges (from the fuller Phase 2 context, which the
 * cheap Phase 1 router doesn't get) that all required details are already
 * present. There is deliberately no reverse mapping — a forward_* action
 * that turns out to be premature is already handled safely downstream by
 * `isEvernoteHandoffComplete` in the corresponding handler, which falls back
 * to `blockedHandoffReply` instead of forwarding incomplete intake.
 */
const FORWARD_ESCAPE_HATCH: Partial<Record<EmailAction, EmailAction>> = {
  create_proposal_template: "forward_to_evernote",
  create_scheduling_template: "forward_scheduling_to_evernote",
  create_admin_followup_template: "forward_admin_to_evernote",
  // Video surveillance intake also hands off via forward_to_evernote — there
  // is no dedicated forward_video_surveillance_to_evernote tool.
  create_video_surveillance_template: "forward_to_evernote",
};

/** The paired forward-to-Evernote action Phase 2 may also call for `action`, if any. */
export function getEscapeHatchAction(action: EmailAction): EmailAction | undefined {
  return FORWARD_ESCAPE_HATCH[action];
}

export function isEmailAction(value: string): value is EmailAction {
  return (EMAIL_ACTIONS as readonly string[]).includes(value);
}

/** Phase 2: the selected action, plus its forward-to-Evernote escape hatch when one exists. */
export function toolsForPhase2(
  action: EmailAction,
  routeToOptions: readonly string[] = DEFAULT_ROUTE_TO_OPTIONS,
): ToolDefinition[] {
  const escapeHatch = FORWARD_ESCAPE_HATCH[action];
  const names = escapeHatch ? [action, escapeHatch] : [action];
  const tools = buildActionTools(routeToOptions);

  return tools.filter((tool) => names.includes(tool.function.name as EmailAction));
}
