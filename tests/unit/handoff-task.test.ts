import { describe, expect, it } from "vitest";
import {
  buildHandoffTaskTitle,
  handoffPriorityToTaskPriority,
  inferAssigneeFromTitle,
  parseHandoffField,
  resolveTaskAssignee,
} from "@/lib/integrations/handoff-task";

describe("inferAssigneeFromTitle", () => {
  it("parses Sarah prefix", () => {
    expect(
      inferAssigneeFromTitle("Sarah: Schedule site visit — Pat Smith")
    ).toBe("Sarah");
  });
});

describe("resolveTaskAssignee", () => {
  it("prefers explicit assignee over title", () => {
    expect(resolveTaskAssignee("Dave", "Sarah: Something")).toBe("Dave");
  });
});

describe("parseHandoffField", () => {
  it("reads Route To and Priority from handoff body", () => {
    const body = `Customer / Property: Pat
Priority: High
Route To: Dave`;
    expect(parseHandoffField(body, "Customer / Property")).toBe("Pat");
    expect(parseHandoffField(body, "Priority")).toBe("High");
    expect(parseHandoffField(body, "Route To")).toBe("Dave");
  });
});

describe("handoffPriorityToTaskPriority", () => {
  it("maps Evernote labels", () => {
    expect(handoffPriorityToTaskPriority("High")).toBe("HIGH");
    expect(handoffPriorityToTaskPriority("Normal")).toBe("MEDIUM");
    expect(handoffPriorityToTaskPriority("Low")).toBe("LOW");
  });
});

describe("buildHandoffTaskTitle", () => {
  it("includes routeTo and customer", () => {
    const title = buildHandoffTaskTitle({
      routeTo: "Dave",
      customerSubject: "New gate",
      customerName: "Adnan Alvi",
      handoffKind: "proposal",
    });
    expect(title).toContain("Dave:");
    expect(title).toContain("Adnan Alvi");
  });
});
