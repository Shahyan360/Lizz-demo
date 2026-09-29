import { describe, expect, it } from "vitest";
import {
  assigneeInboxMessage,
  assignmentMessage,
} from "@/lib/repositories/task-audit";

describe("task audit messages", () => {
  it("formats assignment message", () => {
    expect(assignmentMessage("Adnan", "Jeff", "New gate follow-up")).toBe(
      'Adnan assigned Jeff the task "New gate follow-up"'
    );
  });

  it("formats assignee inbox message", () => {
    expect(assigneeInboxMessage("Adnan", "New gate follow-up")).toBe(
      'Adnan assigned you the task "New gate follow-up"'
    );
  });
});
