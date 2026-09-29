"use client";

import { useEffect, useState } from "react";
import { inputStyle, fieldLabel } from "./planner-ui";
import { ROUTE_TO_TEAMMATES } from "@/lib/reply/business-knowledge";

const nice = (name: string) => name;

function useDbTeamMembers(providedMembers?: readonly string[]) {
  const [dbMembers, setDbMembers] = useState<string[]>([]);

  useEffect(() => {
    if (providedMembers && providedMembers.length > 0) return;
    let cancel = false;
    fetch("/api/zoho/team-roster")
      .then((res) => res.json())
      .then((data) => {
        if (cancel) return;
        if (Array.isArray(data?.roster)) {
          const names = data.roster.map((m: { name: string }) => m.name).filter(Boolean);
          setDbMembers(names);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch team members from DB:", err);
      });
    return () => {
      cancel = true;
    };
  }, [providedMembers]);

  return providedMembers && providedMembers.length > 0 ? providedMembers : dbMembers;
}

/** Team member dropdown for task assignment. */
export function AssigneeSelect({
  name = "assignee",
  defaultValue = "",
  required = false,
  members: providedMembers,
}: {
  name?: string;
  defaultValue?: string;
  required?: boolean;
  members?: readonly string[];
}) {
  let members = useDbTeamMembers(providedMembers);
  if (members?.length === 0) {
    members = [...ROUTE_TO_TEAMMATES];
  }

  return (
    <label style={fieldLabel}>
      Assign to
      <select
        name={name}
        defaultValue={defaultValue}
        required={required}
        style={inputStyle}
      >
        <option value="">Unassigned</option>
        {members.map((member) => (
          <option key={member} value={member}>
            {nice(member)}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Inline assign control for team board cards. */
export function AssigneeQuickSelect({
  taskId,
  currentAssignee,
  onAssign,
  busy,
  members: providedMembers,
}: {
  taskId: string;
  currentAssignee: string | null;
  onAssign: (taskId: string, assignee: string) => void;
  busy: boolean;
  members?: readonly string[];
}) {
  const members = useDbTeamMembers(providedMembers);

  return (
    <select
      value={currentAssignee ?? ""}
      disabled={busy}
      onChange={(e) => onAssign(taskId, e.target.value)}
      style={{
        ...inputStyle,
        fontSize: 11,
        padding: "4px 6px",
        width: "100%",
      }}
      aria-label="Assign task to teammate"
    >
      <option value="">Move to unassigned</option>
      {members.map((member) => (
        <option key={member} value={member}>
          Assign to {member}
        </option>
      ))}
    </select>
  );
}
