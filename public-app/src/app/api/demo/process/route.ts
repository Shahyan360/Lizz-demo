import { z } from 'zod';
import { emails, tones, sampleAnalysis } from '@/lib/demo-data';
import { generateAnalysis, ProviderError, DEFAULT_MODEL } from '@/lib/ai';
import { reserveInference, QuotaError } from '@/lib/quota';
import { checkOrigin, smallJson, RequestError } from '@/lib/request';
export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';
const input = z
  .object({
    emailId: z.string().refine((id) => emails.some((email) => email.id === id)),
    tone: z.enum(tones),
    mode: z.enum(['live', 'sample']),
  })
  .strict();
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const parsed = input.safeParse(await smallJson(request));
    if (!parsed.success)
      return Response.json(
        { error: 'Choose one of the fictional sample emails and a supported tone.' },
        { status: 400, headers },
      );
    const { emailId, tone, mode } = parsed.data;
    if (mode === 'sample') return Response.json(sampleAnalysis(emailId), { headers });
    // Vercel supplies this header. Outside Vercel all clients share the local
    // bucket; arbitrary caller-supplied forwarded headers are never trusted.
    const ip =
      process.env.VERCEL === '1'
        ? request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
          'unknown-vercel-client'
        : 'local';
    console.info(JSON.stringify({ event: 'demo.quota.reserve.started' }));
    await reserveInference(ip);
    console.info(JSON.stringify({ event: 'demo.quota.reserve.completed' }));
    const analysis = await generateAnalysis(emailId, tone);
    console.info(
      JSON.stringify({
        event: 'demo.inference.completed',
        model: process.env.LLM_MODEL || DEFAULT_MODEL,
      }),
    );
    return Response.json(
      {
        ...analysis,
        provenance: 'live',
        model: process.env.LLM_MODEL || DEFAULT_MODEL,
        generatedAt: new Date().toISOString(),
      },
      { headers },
    );
  } catch (error) {
    if (error instanceof RequestError)
      return Response.json({ error: error.message }, { status: error.status, headers });
    if (error instanceof QuotaError)
      return Response.json(
        {
          error:
            error.reason === 'visitor'
              ? 'You’ve used today’s live AI allowance. You can keep exploring with sample responses.'
              : error.reason === 'global'
                ? 'Today’s shared live AI allowance has been reached. Sample responses are still available.'
                : 'Live AI is temporarily unavailable. Try the sample response instead.',
          fallbackAvailable: true,
        },
        {
          status: error.reason === 'unavailable' ? 503 : 429,
          headers: { ...headers, 'Retry-After': '3600' },
        },
      );
    console.error(
      JSON.stringify({
        event: 'demo.inference.failed',
        category: error instanceof ProviderError ? error.category : 'internal',
      }),
    );
    return Response.json(
      {
        error: 'The AI provider could not complete this request. Try a sample response instead.',
        fallbackAvailable: true,
      },
      { status: 503, headers },
    );
  }
}
