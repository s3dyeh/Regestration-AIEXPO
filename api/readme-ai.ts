import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { StringDecoder } from 'node:string_decoder';
import { handleReadmeAi } from '../server/readme-ai.js';

// Best-effort instance protection. Use a Vercel Firewall rate-limit rule for a shared production limit.
const attempts = new Map<string, { until: number; count: number }>();
function permit(ip: string): boolean {
  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const key = createHash('sha256').update(ip).digest('hex');
  const value = attempts.get(key) ?? { until: now + 600000, count: 0 };
  if (attempts.size >= 1000 && !attempts.has(key)) return false;
  value.count++;
  attempts.set(key, value);
  return value.count <= 5;
}

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');
  const host = req.headers.host ?? '';
  const origin = req.headers.origin;
  const allowed = (process.env['README_AI_ALLOWED_ORIGINS'] ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    !origin ||
    !(
      origin === `https://${host}` ||
      (process.env['VERCEL_ENV'] !== 'production' && origin === `http://${host}`) ||
      allowed.includes(origin)
    )
  ) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'This origin is not allowed.' }));
    return;
  }
  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({ message: 'Use POST.' }));
    return;
  }
  let body = '';
  const decoder = new StringDecoder('utf8');
  if (req.body !== undefined)
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  else
    for await (const chunk of req) {
      body += decoder.write(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      if (Buffer.byteLength(body) > 24000) break;
    }
  body += decoder.end();
  if (Buffer.byteLength(body) > 24000) {
    res.writeHead(413);
    res.end(JSON.stringify({ message: 'Draft is too large.' }));
    return;
  }
  const result = await handleReadmeAi(
    new Request(`https://${host}/api/readme-ai`, {
      method: 'POST',
      headers: { 'content-type': req.headers['content-type'] ?? '' },
      body,
    }),
    {
      key: process.env['OPENAI_API_KEY'],
      model: process.env['OPENAI_README_MODEL'],
      permitted: () =>
        permit(
          String(req.headers['x-vercel-forwarded-for'] ?? req.socket.remoteAddress ?? 'unknown'),
        ),
    },
  );
  res.writeHead(result.status, Object.fromEntries(result.headers));
  res.end(await result.text());
}
