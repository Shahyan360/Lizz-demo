import { describe, it, expect } from 'vitest';
import { freshState, restoreState, applyAnalysis } from '../../src/lib/demo-state';
import { emails, sampleAnalysis, fictionalSubtotal } from '../../src/lib/demo-data';
describe('isolated demo state', () => {
  it('creates independent session objects', () => {
    const one = freshState(),
      two = freshState();
    one.tasks[0].title = 'changed';
    one.rules[0].enabled = false;
    expect(two.tasks[0].title).not.toBe('changed');
    expect(two.rules[0].enabled).toBe(true);
  });
  it('discards corrupted, oversized or expired state', () => {
    const now = 100000;
    for (const raw of [
      '{',
      JSON.stringify({ ...freshState(0), expiresAt: now - 1 }),
      'x'.repeat(200001),
      JSON.stringify({ ...freshState(), settings: { review: false } }),
    ])
      expect(restoreState(raw, now).results).toEqual({});
  });
  it('restores valid local state and resets it independently', () => {
    const initial = freshState();
    initial.tasks[0].status = 'Done';
    expect(restoreState(JSON.stringify(initial)).tasks[0].status).toBe('Done');
    expect(freshState().tasks[0].status).toBe('To do');
  });
  it('requires approval even with no enabled rules and high AI confidence', () => {
    const initial = freshState();
    initial.rules = [];
    const result = { ...sampleAnalysis(emails[0].id), confidence: 1 };
    const next = applyAnalysis(initial, emails[0].id, result);
    expect(next.approvals[emails[0].id]).toBe('Pending');
    expect(next.activity[0].message).toContain('draft queued for review');
  });
  it('creates an automation task only once per conversation', () => {
    const initial = freshState();
    const result = sampleAnalysis('email-support');
    const one = applyAnalysis(initial, 'email-support', result);
    const two = applyAnalysis(one, 'email-support', result);
    expect(two.tasks.filter((task) => task.id === 'ai-email-support')).toHaveLength(1);
  });
  it('records review flags and honors disabled rules', () => {
    const initial = freshState();
    const result = sampleAnalysis('email-complaint');
    expect(applyAnalysis(initial, 'email-complaint', result).activity[0].message).toContain(
      'flagged',
    );
    initial.rules.forEach((rule) => (rule.enabled = false));
    expect(applyAnalysis(initial, 'email-complaint', result).activity[0].message).not.toContain(
      'flagged',
    );
  });
  it('uses only reserved example email domains', () => {
    for (const email of emails)
      expect(email.email).toMatch(/@(?:[a-z0-9-]+\.)?example\.(com|net|org)$/);
  });
  it('rejects unknown demo samples', () =>
    expect(() => sampleAnalysis('another-workspaces-email')).toThrow('Unknown sample'));
  it('calculates draft estimates in cents', () => {
    expect(
      fictionalSubtotal([
        { price: 420, quantity: 24 },
        { price: 260, quantity: 24 },
      ]),
    ).toBe(16320);
    expect(fictionalSubtotal([{ price: 0.1, quantity: 3 }])).toBe(0.3);
  });
});
