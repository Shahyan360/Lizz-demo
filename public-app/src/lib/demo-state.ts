import { z } from 'zod';
import { analysisSchema, defaultRules, defaultTasks, intents } from './demo-data';

const resultSchema = analysisSchema.extend({
  provenance: z.enum(['sample', 'live']),
  model: z.string().optional(),
  generatedAt: z.string().optional(),
  notice: z.string().optional(),
});
export const stateSchema = z.object({
  version: z.literal(1),
  expiresAt: z.number(),
  results: z.record(z.string(), resultSchema),
  read: z.array(z.string()),
  tasks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().max(140),
        assignee: z.string(),
        priority: z.enum(['Low', 'Normal', 'High']),
        status: z.enum(['To do', 'In progress', 'Done']),
        emailId: z.string().optional(),
      }),
    )
    .max(100),
  approvals: z.record(z.string(), z.enum(['Pending', 'Approved', 'Rejected'])),
  rules: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        intent: z.enum(intents),
        action: z.enum(['Request approval', 'Create task', 'Flag for review']),
        enabled: z.boolean(),
      }),
    )
    .max(20),
  activity: z.array(z.object({ id: z.string(), message: z.string(), at: z.string() })).max(100),
  settings: z.object({
    name: z.string().max(80),
    tone: z.enum(['Warm and professional', 'Concise', 'Formal']),
    review: z.literal(true),
  }),
  knowledgeEnabled: z.record(z.string(), z.boolean()),
});
export type DemoState = z.infer<typeof stateSchema>;
export const STORAGE_KEY = 'lizz-demo-v1';
export function freshState(now = Date.now()): DemoState {
  return {
    version: 1,
    expiresAt: now + 12 * 60 * 60 * 1000,
    results: {},
    read: [],
    tasks: structuredClone(defaultTasks),
    approvals: {},
    rules: structuredClone(defaultRules),
    activity: [
      {
        id: 'welcome',
        message: 'Your private demo session is ready. All records are fictional.',
        at: new Date(now).toISOString(),
      },
    ],
    settings: { name: 'Northstar Business Solutions', tone: 'Warm and professional', review: true },
    knowledgeEnabled: { catalog: true, support: true, shipping: true, company: true },
  };
}
export function restoreState(raw: string | null, now = Date.now()): DemoState {
  if (!raw || raw.length > 200000) return freshState(now);
  try {
    const parsed = stateSchema.safeParse(JSON.parse(raw));
    return parsed.success && parsed.data.expiresAt > now ? parsed.data : freshState(now);
  } catch {
    return freshState(now);
  }
}
export function applyAnalysis(
  state: DemoState,
  emailId: string,
  result: DemoState['results'][string],
  now = Date.now(),
): DemoState {
  const tasks = [...state.tasks];
  // The fixed approval boundary does not depend on rules, confidence or model output.
  const matching = state.rules.filter((rule) => rule.enabled && rule.intent === result.intent);
  if (
    matching.some((rule) => rule.action === 'Create task') &&
    !tasks.some((task) => task.id === `ai-${emailId}`)
  )
    tasks.push({
      id: `ai-${emailId}`,
      title: result.suggestedTask,
      assignee: 'Alex Morgan',
      priority: result.priority,
      status: 'To do',
      emailId,
    });
  const flagged = matching.some((rule) => rule.action === 'Flag for review');
  return {
    ...state,
    results: { ...state.results, [emailId]: result },
    approvals: { ...state.approvals, [emailId]: 'Pending' },
    tasks,
    activity: [
      {
        id: `process-${emailId}-${now}`,
        message: `${result.intent} processed using ${result.provenance === 'live' ? 'live AI' : 'an illustrative sample'}; draft queued for review.${flagged ? ' Automation flagged this conversation for closer review.' : ''}`,
        at: new Date(now).toISOString(),
      },
      ...state.activity,
    ].slice(0, 100),
  };
}
