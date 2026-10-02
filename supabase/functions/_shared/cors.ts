import { corsHeaders as sdkCorsHeaders } from '@supabase/supabase-js/cors';

/** Exact origins only: tolerate a trailing slash, never wildcards or suffix matching. */
function configuredOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export function corsFor(request: Request): { allowed: boolean; headers: Record<string, string> } {
  const origin = request.headers.get('origin');
  const configured = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(configuredOrigin);
  const allowed = !!origin && origin !== 'null' && configured.includes(origin);
  return {
    allowed,
    headers: {
      ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
      'Access-Control-Allow-Headers': sdkCorsHeaders['Access-Control-Allow-Headers'],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      Vary: 'Origin',
      'Cache-Control': 'no-store',
    },
  };
}
