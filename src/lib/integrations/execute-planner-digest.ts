import {
  getRoutableTeammates,
  type RouteToTeammate,
} from "../reply/business-knowledge";
import { sendDailyTaskDigest } from "./team-task-digest";
import { listTasks } from "../tools/task.tool";
import { resolveTaskAssignee } from "./handoff-task";

export interface DigestResult {
  routeTo: RouteToTeammate;
  sentTo: string | null;
  taskCount: number;
}

export interface DigestError {
  routeTo: RouteToTeammate;
  error: string;
}

export async function executePlannerDigest(): Promise<{
  tenantsProcessed: number;
  digestsAttempted: number;
  results: Array<DigestResult | DigestError>;
}> {
  const teammates = getRoutableTeammates();
  const results: Array<DigestResult | DigestError> = [];

  const tasks = await listTasks();
  for (const teammate of teammates) {
    try {
      const memberTasks = tasks.filter(
        (task) => resolveTaskAssignee(task.assignee, task.title) === teammate.routeTo
      );
      const sentTo = await sendDailyTaskDigest({
        routeTo: teammate.routeTo,
        tasks: memberTasks,
      });
      results.push({
        routeTo: teammate.routeTo,
        sentTo,
        taskCount: memberTasks.length,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[cron/planner-digest] ${teammate.routeTo} failed:`,
        message
      );
      results.push({
        routeTo: teammate.routeTo,
        error: message,
      });
    }
  }

  return {
    tenantsProcessed: 1,
    digestsAttempted: teammates.length,
    results,
  };
}
