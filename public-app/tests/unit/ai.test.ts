import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { generateAnalysis } from '../../src/lib/ai';
import { emails, sampleAnalysis } from '../../src/lib/demo-data';
const providerReply = (value: unknown) => ({
  status: 'completed',
  steps: [
    { type: 'thought', signature: 'not-exposed' },
    { type: 'model_output', content: [{ type: 'text', text: JSON.stringify(value) }] },
  ],
});
beforeEach(() => {
  vi.stubEnv('GEMINI_API_KEY', 'test-key');
  vi.stubEnv('LLM_MODEL', 'gemini-3.5-flash-lite');
});
afterEach(() => vi.unstubAllGlobals());
describe('AI boundary', () => {
  it('uses fixed fictional context, opts out of storage, caps output and exposes no tools', async () => {
    const { provenance, notice, ...analysis } = sampleAnalysis('email-quote');
    const mock = vi.fn(async () => Response.json(providerReply(analysis)));
    vi.stubGlobal('fetch', mock);
    const result = await generateAnalysis('email-quote', 'Formal');
    const [url, options] = mock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(options.body as string);
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(body.generation_config.max_output_tokens).toBe(1500);
    expect(body.generation_config.thinking_level).toBe('minimal');
    expect(body.store).toBe(false);
    expect(body.tools).toBeUndefined();
    expect(body.system_instruction).toContain('untrusted DATA');
    expect(body.input).toContain(emails[0].email);
    expect(options.signal).toBeDefined();
    expect(JSON.stringify(result)).not.toContain('not-exposed');
  });
  it('rejects malformed output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json(providerReply({ action: 'send_email' }))),
    );
    await expect(generateAnalysis('email-quote', 'Formal')).rejects.toMatchObject({
      category: 'invalid-output',
    });
  });
  it('rejects unsupported source IDs', async () => {
    const { provenance, notice, ...analysis } = sampleAnalysis('email-quote');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json(providerReply({ ...analysis, sources: ['private-company-document'] })),
      ),
    );
    await expect(generateAnalysis('email-quote', 'Formal')).rejects.toMatchObject({
      category: 'invalid-output',
    });
  });
  it('sanitizes provider failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('private provider error', { status: 401 })),
    );
    await expect(generateAnalysis('email-quote', 'Formal')).rejects.toMatchObject({
      category: 'unavailable',
    });
  });
  it('rejects incomplete model output', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ status: 'incomplete', steps: [] })),
    );
    await expect(generateAnalysis('email-quote', 'Formal')).rejects.toMatchObject({
      category: 'invalid-output',
    });
  });
});
