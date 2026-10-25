export const dynamic = 'force-dynamic';
export function GET() {
  return Response.json(
    {
      status: 'ok',
      product: 'Lizz',
      mode: 'public-demo',
      liveAI: !!(
        process.env.GEMINI_API_KEY &&
        process.env.BLOB_READ_WRITE_TOKEN &&
        (process.env.DEMO_QUOTA_SECRET?.length ?? 0) >= 32
      ),
      outboundEmail: false,
      financialWrites: false,
      customerSignup: false,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
