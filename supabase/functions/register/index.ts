import { createClient } from '@supabase/supabase-js';
import { submissionSchema, welcomeSchema } from '../_shared/registration.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);
const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const rateSecret = Deno.env.get('RATE_LIMIT_SALT');

Deno.serve({ port: Number(Deno.env.get('PORT') ?? 8000) }, async (request: Request) => {
  const origin = request.headers.get('origin') ?? '';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Cache-Control': 'no-store',
  };
  const reply = (status: number, message: unknown) =>
    new Response(JSON.stringify(message), { status, headers });
  if (!allowedOrigins.includes(origin))
    return reply(403, { message: 'This origin is not allowed.' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, { message: 'Use POST to register.' });
  if (!rateSecret) return reply(503, { message: 'Registration is not configured yet.' });
  if (!request.headers.get('content-type')?.includes('application/json'))
    return reply(415, { message: 'Send a JSON registration.' });

  try {
    // Bound body consumption even when Content-Length is absent or forged.
    const reader = request.body?.getReader();
    if (!reader) return reply(400, { message: 'Registration details are required.' });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return reply(413, { message: 'Registration is too large.' });
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return reply(400, { message: 'Invalid JSON.' });
    }
    const result = submissionSchema.safeParse(body);
    if (!result.success)
      return reply(400, {
        message: result.error.issues[0]?.message ?? 'Check your registration details.',
      });

    // Trust this header only behind the Supabase gateway. The salt prevents stored IP recovery.
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (!ip) return reply(503, { message: 'Could not verify this request. Please try again.' });
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${rateSecret}:${ip}`),
    );
    const clientHash = [...new Uint8Array(digest)]
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
    // Reuse the IP limiter installed by migration 001 (20 attempts/minute).
    const { data: permitted, error: rateError } = await supabase.rpc('consume_registration_limit', {
      client_hash: clientHash,
    });
    if (rateError)
      return reply(503, { message: 'Registration is temporarily unavailable. Please retry.' });
    if (!permitted)
      return new Response(
        JSON.stringify({ message: 'Too many attempts. Please wait a minute and try again.' }),
        { status: 429, headers: { ...headers, 'Retry-After': '60' } },
      );

    const { eventId, requestId, registration } = result.data;
    const { data, error } = await supabase.rpc('submit_registration', {
      target_event: eventId,
      request_id: requestId,
      details: registration,
    });
    if (error) {
      if (error.code === '23505')
        return reply(409, { message: 'This email is already registered. See you at the event!' });
      if (error.message === 'event_closed')
        return reply(409, { message: 'Registration for this event is closed.' });
      if (error.message === 'request_conflict')
        return reply(409, {
          message: 'These details differ from the original submission. Please submit again.',
        });
      console.error('Registration database failure', { code: error.code });
      return reply(503, {
        message: 'Could not save your registration. Please retry with the same details.',
      });
    }
    return reply(200, welcomeSchema.parse(data));
  } catch {
    return reply(503, {
      message: 'Could not complete registration. Your details are safe to retry.',
    });
  }
});
