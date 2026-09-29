export interface GeneratedReply {
  replyText: string;
  followUp: string[];
  evernotePayload?: string;
  proposalTask?: {
    title: string;
    description: string;
    assignee?: string;
    priority?: string;
  };
  schedulingTask?: {
    title: string;
    description: string;
  };
  adminTask?: {
    title: string;
    description: string;
  };
  ccTeammates?: string[];
  llmFailed?: true;
}
