import { NextResponse } from "next/server";
import { handleGetTeamMembers } from "./get-team-members";
import { handleGetTasks } from "./get-tasks";
import { handleGetTaskByTitle } from "./get-task-by-title";
import { handleCreateTask } from "./create-task";
import { handleGetContacts } from "./get-contacts";
import { handleAddContact } from "./add-contact";
import { handleAddCompany } from "./add-company";
import { handleDraftEmail } from "./draft-email";
import { handleGetEmailThreads } from "./get-email-threads";
import { handleReplyToEmailThread } from "./reply-to-email-thread";
import { handleGetZohoProducts } from "./get-zoho-products";
import { handleCreateZohoQuote } from "./create-zoho-quote";
import { handleCreateQuoteLink } from "./create-quote-link";
import { handleCreateMeeting } from "./create-meeting";

export interface ToolExecutionContext {
  sessionUser?: { name?: string | null; email?: string | null };
}

export async function executeAssistantTool(
  toolName: string,
  args: any,
  context: ToolExecutionContext
): Promise<NextResponse | null> {
  const { sessionUser } = context;

  switch (toolName) {
    case "get_team_members":
      return handleGetTeamMembers();
    case "get_tasks":
      return handleGetTasks(args);
    case "get_task_by_title":
      return handleGetTaskByTitle(args);
    case "create_task":
      return handleCreateTask(args);
    case "get_contacts":
      return handleGetContacts(args);
    case "add_contact":
      return handleAddContact(args);
    case "add_company":
      return handleAddCompany(args);
    case "draft_email":
      return handleDraftEmail(args, sessionUser);
    case "get_email_threads":
      return handleGetEmailThreads(args);
    case "reply_to_email_thread":
      return handleReplyToEmailThread(args, sessionUser);
    case "get_zoho_products":
      return handleGetZohoProducts();
    case "create_zoho_quote":
      return handleCreateZohoQuote(args);
    case "create_quote_link":
      return handleCreateQuoteLink(args);
    case "create_meeting":
      return handleCreateMeeting(args);
    default:
      return null;
  }
}
