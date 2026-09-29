import type { ChatCompletionTool } from "openai/resources/chat/completions";

/**
 * Assistant Tool declarations for Gemini native function calling
 */
export const ASSISTANT_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_team_members",
      description: "Returns the list of all active team members, staff, and account users in the workspace.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tasks",
      description: "Returns the list of workspace tasks or action items. Call this tool when user asks to see tasks, or when user replies 'yes' / 'remaining tasks' / 'show rest' to pagination questions.",
      parameters: {
        type: "object",
        properties: {
          assignee: { type: "string", description: "Optional name of assignee. DO NOT set unless user explicitly names a person (e.g. Dave) If he says 'my tasks'. give him team list and ask to choose one of them to get the tasks " },
          status: { type: "string", description: "Optional status filter (e.g. TODO, IN_PROGRESS, DONE)" },
          startDate: { type: "string", description: "Optional start date filter (YYYY-MM-DD ISO string). Calculate based on current system date for date ranges like 'today', 'this week', 'this month', custom dates, etc." },
          endDate: { type: "string", description: "Optional end date filter (YYYY-MM-DD ISO string). Calculate based on current system date for date ranges like 'today', 'this week', 'this month', custom dates, etc." },
          dateCategory: { type: "string", description: "Optional date category filter: 'today', 'yesterday', 'tomorrow', 'this_week', 'overdue', 'future', 'completed', or 'all'." },
          isSummary: { type: "boolean", description: "Set to true when user asks for a summary, overview, breakdown, or briefing of tasks instead of a raw itemized list." },
          limit: { type: "number", description: "Max items to display (default: 10)." },
          offset: { type: "number", description: "Zero-based index offset to start listing from (e.g. offset: 10 to show remaining items starting after item 10)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_task_by_title",
      description: "Searches for tasks by their title or a keyword in the title. ALWAYS use this tool when: (1) user pastes or types a task title followed by 'details', 'info', 'status', or 'show me'; (2) user says 'find', 'look up', 'get details of', 'what is', or 'tell me about' a task; (3) user pastes a long task title that already exists. Examples: 'Dave: Proposal follow-up — Customer (CCTV) details', 'Created by AI details', 'show me the Barrier Arm task', 'what is the status of [task title]'. DO NOT call create_task for these patterns.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "The task title or keyword to search for (case-insensitive partial match)." },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_task",
      description: "Creates a NEW task or action item in the workspace planner. ONLY call this when the user explicitly says 'create', 'add', 'make', or 'add new task'. DO NOT call this if the user pastes an existing task title and asks for 'details', 'info', or 'status' — use get_task_by_title instead. DO NOT call this if the message ends with 'details' after a task title.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title or description of the task" },
          priority: { type: "string", description: "Priority level: LOW, MEDIUM, HIGH, or URGENT" },
          dueDate: { type: "string", description: "Optional due date ISO string" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_contacts",
      description: "Searches or returns the list of CRM contacts in the workspace. Call this tool when user asks to see contacts, or when user replies 'yes' / 'remaining contacts' / 'show rest' to pagination questions.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search term or name/email to look for in contacts (e.g. Dorothy, dorothy@tnwlc.com)" },
          name: { type: "string", description: "Optional contact name filter" },
          email: { type: "string", description: "Optional contact email filter" },
          stage: { type: "string", description: "Optional lifecycle stage filter: NEW, ACTIVE, or CUSTOMER" },
          limit: { type: "number", description: "Max items to display (default: 10)." },
          offset: { type: "number", description: "Zero-based index offset to start listing from (e.g. offset: 10 to show remaining contacts starting after item 10)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_contact",
      description: "Adds a new contact to the CRM.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Full name of the contact" },
          email: { type: "string", description: "Email address of the contact" },
          stage: { type: "string", description: "Lifecycle stage (NEW, ACTIVE, CUSTOMER)" },
        },
        required: ["name", "email"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_meeting",
      description: "Creates a meeting in the local planner. Use this when the user gives a confirmed meeting date and time. Do not invent a time.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          startTime: { type: "string", description: "ISO datetime with timezone or local offset" },
          endTime: { type: "string" },
          description: { type: "string" },
          location: { type: "string" },
          attendees: { type: "array", items: { type: "string" } },
        },
        required: ["title", "startTime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_company",
      description: "Creates a new company in the CRM.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Company name" },
          domain: { type: "string", description: "Company domain (e.g. acme.com)" },
        },
        required: ["domain"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "draft_email",
      description: "Composes an email to a contact or team member. YOU MUST ALWAYS CALL THIS TOOL whenever the user asks to send, write, compose, or draft a brand-new standalone email. If the user did NOT specify a subject or body, compose a professional, friendly, and appropriate subject line and body text YOURSELF matching the user's intent.",
      parameters: {
        type: "object",
        properties: {
          recipientName: { type: "string", description: "Name of the recipient contact or team member (e.g. Adnan, Dave, Sarah)" },
          recipientEmail: { type: "string", description: "Email address of the recipient contact if provided by user" },
          subject: { type: "string", description: "Subject of the email. Compose a clear, appropriate subject line yourself if the user didn't specify one." },
          body: { type: "string", description: "Full body text of the email. Compose a complete, professional, friendly body yourself matching the user's topic/intent (e.g. greeting, follow up, status update) if the user didn't specify exact text. ALWAYS sign off with 'Best regards,\nLizzz' — never use '[Your Name]' or any other placeholder." },
        },
        required: ["subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_email_threads",
      description: "Fetches email threads or messages from Zoho Mail and workspace history for a specific contact. Use direction='incoming' when user asks for emails received FROM or sent BY a contact. Use direction='outgoing' when user asks for emails sent TO a contact. Use direction='all' when user asks for full conversation history.",
      parameters: {
        type: "object",
        properties: {
          contactName: { type: "string", description: "Name of the contact or sender (e.g. Adnan, Dave, John)" },
          contactEmail: { type: "string", description: "Email address of the contact or sender" },
          query: { type: "string", description: "Search query or subject keyword to look for in emails" },
          direction: { type: "string", description: "Filtering direction: 'incoming' (emails FROM contact), 'outgoing' (emails SENT TO contact by Lizzz/team), or 'all' (full conversation). Default: 'incoming' when user asks for emails from a person." },
          limit: { type: "number", description: "Number of threads to retrieve (default: 5)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reply_to_email_thread",
      description: "Composes an in-thread reply to an existing email conversation/thread. YOU MUST CALL THIS TOOL whenever the user asks to reply to an email thread or answer a specific email from a contact. Ensures the reply carries Zoho/RFC threading headers (inReplyTo & refHeader).",
      parameters: {
        type: "object",
        properties: {
          threadId: { type: "string", description: "The existing email Thread ID or Zoho Message ID to reply to" },
          recipientName: { type: "string", description: "Name of the recipient" },
          recipientEmail: { type: "string", description: "Email address of the recipient" },
          subject: { type: "string", description: "Subject line (e.g., 'Re: Original Subject')" },
          replyBody: { type: "string", description: "Full body text of the reply email. YOU MUST ALWAYS COMPOSE A COMPLETE, HELPFUL, PROFESSIONAL BODY matching the user's topic/intent and parent email subject. NEVER pass an empty body or just the sign-off alone. ALWAYS sign off with 'Best regards,\nLizzz'." },
          action: { type: "string", description: "Action type: 'draft' (save in Zoho/Workspace drafts) or 'send' (auto-send reply). Default: 'draft'" },
        },
        required: ["replyBody"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_zoho_products",
      description: "Retrieves the list of active items/products from Zoho Books.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_zoho_quote",
      description: "Creates and sends a quotation (Estimate) in Zoho Books for a customer. If the customer does not exist in Zoho Books, this tool will automatically find/create the customer contact first using their name and email.",
      parameters: {
        type: "object",
        properties: {
          customerName: { type: "string", description: "The full name of the customer." },
          customerEmail: { type: "string", description: "The email address of the customer." },
          items: {
            type: "array",
            description: "List of items to include in the quote.",
            items: {
              type: "object",
              properties: {
                itemId: { type: "string", description: "The Zoho Books unique Item ID (retrieve this using get_zoho_products first if not known)." },
                quantity: { type: "number", description: "The quantity of the item (e.g. 1, 2)." },
              },
              required: ["itemId", "quantity"],
            },
          },
        },
        required: ["customerName", "customerEmail", "items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_quote_link",
      description:
        "Generates a unique, shareable link for a customer to browse and select products from the AutoGate catalog. The customer can then submit their selection to create a Zoho Books estimate (quotation) as a draft. No login is required for the customer. Use this when a customer asks for a quote/estimate/pricing and you need them to pick specific products from the catalog.",
      parameters: {
        type: "object",
        properties: {
          customerName: {
            type: "string",
            description: "The full name of the customer.",
          },
          customerEmail: {
            type: "string",
            description: "The email address of the customer.",
          },
        },
        required: ["customerName", "customerEmail"],
      },
    },
  },
];
