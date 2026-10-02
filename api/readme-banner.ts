import type { IncomingMessage, ServerResponse } from 'node:http';
import { profileBannerSvg } from '../src/app/features/readme/profile-banner.js';

export default function handler(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  const query = new URL(req.url ?? '/', 'https://aiexpo.s3dyeh.com').searchParams;
  const svg = profileBannerSvg(
    query.get('text') ?? '',
    query.get('desc') ?? '',
    query.get('color') ?? '',
    query.get('fontColor') ?? '',
  );
  res.writeHead(200, {
    'Content-Type': 'image/svg+xml; charset=utf-8',
    'Cache-Control': 'public, max-age=86400, s-maxage=604800',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
  });
  res.end(req.method === 'HEAD' ? undefined : svg);
}
