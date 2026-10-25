export class RequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const internalUrl = new URL(request.url);
  // Next's internal request URL may use localhost behind the production server.
  // Compare the browser Origin with the actual public Host, never a caller's
  // forwarded-host header. Vercel serves this application over HTTPS.
  const publicHost = request.headers.get('host') || internalUrl.host;
  const protocol = process.env.VERCEL === '1' ? 'https:' : internalUrl.protocol;
  if (!/^[a-z0-9.:[\]-]+$/i.test(publicHost) || !origin || origin !== `${protocol}//${publicHost}`)
    throw new RequestError(403, 'Open the demo on this website to continue.');
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    throw new RequestError(403, 'Cross-site requests are not supported.');
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new RequestError(415, 'Use a JSON request.');
}
export async function smallJson(request: Request) {
  if (Number(request.headers.get('content-length')) > 1024)
    throw new RequestError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, 'A request body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        throw new RequestError(413, 'Request is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'Invalid JSON.');
  }
}
