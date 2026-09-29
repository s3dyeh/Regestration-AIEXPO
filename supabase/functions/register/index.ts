import { createClient } from '@supabase/supabase-js';
import { submissionSchema, welcomeSchema } from '../_shared/registration.ts';

export async function handleAttendance(request: Request): Promise<Response> {
  const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const rateSecret = Deno.env.get('RATE_LIMIT_SALT');

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
  if (request.method !== 'POST') return reply(405, { message: 'Use POST to check in.' });
  if (!rateSecret) return reply(503, { message: 'Attendance is not configured yet.' });
  if (!request.headers.get('content-type')?.includes('application/json'))
    return reply(415, { message: 'Send a JSON attendance request.' });

  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer \S+$/i.test(authorization))
    return reply(401, { message: 'Sign in to record attendance.' });
  try {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser(authorization.slice(7));
    if (authError || !user)
      return reply(401, { message: 'Your session has expired. Sign in to record attendance.' });
    // The service client is only used for rate limiting, never attendance mutations.
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    );
    // Bound body consumption even when Content-Length is absent or forged.
    const reader = request.body?.getReader();
    if (!reader) return reply(400, { message: 'An attendance request is required.' });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        return reply(413, { message: 'Attendance request is too large.' });
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
        message: result.error.issues[0]?.message ?? 'Check the participant ID.',
        fields: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
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
      return reply(503, { message: 'Attendance is temporarily unavailable. Please retry.' });
    if (!permitted)
      return new Response(
        JSON.stringify({ message: 'Too many attempts. Please wait a minute and try again.' }),
        { status: 429, headers: { ...headers, 'Retry-After': '60' } },
      );

    const { eventId, requestId, participantId } = result.data;
    const { data, error } = await client.rpc('check_in_attendance', {
      target_event: eventId,
      request_id: requestId,
      participant_id: participantId,
    });
    if (error) {
      if (error.code === '42501')
        return reply(403, { message: 'This account does not have access to this event.' });
      if (error.code === '22023')
        return reply(400, {
          message: 'Enter a valid participant ID.',
        });
      if (error.message === 'participant_not_found')
        return reply(404, {
          message: 'ID not found. Please ask the event team to check the participant list.',
        });
      if (error.message === 'event_closed')
        return reply(409, { message: 'Attendance for this event is closed.' });
      if (error.message === 'request_conflict')
        return reply(409, {
          message: 'This request was already used for another ID. Start a new check-in.',
        });
      console.error('Attendance database failure', { code: error.code });
      return reply(503, {
        message: 'Could not confirm attendance. Please retry with the same ID.',
      });
    }
    return reply(200, welcomeSchema.parse(data));
  } catch {
    return reply(503, {
      message: 'Could not complete check-in. You can safely retry with the same ID.',
    });
  }
}

if (import.meta.main) Deno.serve({ port: Number(Deno.env.get('PORT') ?? 8000) }, handleAttendance);
