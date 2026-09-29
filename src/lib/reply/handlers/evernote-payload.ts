export function formatEvernotePayload(input: {
  fieldNames?: readonly string[];
  details?: Record<string, string | undefined>;
  recommendedNextStep: string;
  priority: string;
  routeTo: string;
  summary: string;
}): string {
  const details = input.details ?? {};
  const fieldNames =
    input.fieldNames ??
    Object.keys(details).filter((f) => details[f] !== undefined);
  const sections = fieldNames.map(
    (field) => `${field}: ${details[field] ?? ""}`
  );
  sections.push(`Recommended Next Step: ${input.recommendedNextStep}`);
  sections.push(`Priority: ${input.priority}`);
  sections.push(`Route To: ${input.routeTo}`);
  sections.push("");
  sections.push("");
  sections.push(input.summary);
  return sections.join("\n");
}
