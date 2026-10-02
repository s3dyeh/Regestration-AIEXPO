import { corsFor } from '../_shared/cors.ts';
import { createClient } from '@supabase/supabase-js';
import { registrationWorkbook, XLSX_TYPE } from './workbook.ts';
import type { ExportPage } from './workbook.ts';

export async function handleExport(request: Request): Promise<Response> {
  const { allowed, headers: corsHeaders } = corsFor(request);
  const headers = { ...corsHeaders, 'Access-Control-Expose-Headers': 'Content-Disposition' };
  const fail = (status: number, message: string) => Response.json({ message }, { status, headers });
  if (!allowed) return fail(403, 'Origin not allowed.');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return fail(405, 'Use POST to export.');
  const authorization = request.headers.get('authorization') ?? '';
  if (!/^Bearer \S+$/i.test(authorization)) return fail(401, 'Sign in to export registrations.');
  try {
    // Use the user's JWT for every RPC: no service-role bypass of operator checks.
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser(authorization.slice(7));
    if (authError || !user) return fail(401, 'Sign in to export registrations.');
    const reader = request.body?.getReader();
    if (!reader) return fail(400, 'An event ID is required.');
    let body = '';
    const decoder = new TextDecoder();
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024) {
        await reader.cancel();
        return fail(413, 'Request too large.');
      }
      body += decoder.decode(value, { stream: true });
    }
    body += decoder.decode();
    let eventId: unknown;
    try {
      eventId = JSON.parse(body)?.eventId;
    } catch {
      return fail(400, 'Invalid JSON.');
    }
    if (
      typeof eventId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)
    )
      return fail(400, 'A valid event ID is required.');
    const fetchPage = (cutoff: string | null, createdAt: string | null, id: string | null) =>
      client
        .rpc('admin_registration_export_page', {
          target_event: eventId,
          export_before: cutoff,
          after_created_at: createdAt,
          after_id: id,
        })
        .abortSignal(request.signal);
    const first = await fetchPage(null, null, null);
    if (first.error)
      return fail(first.error.code === '42501' ? 403 : 503, 'Could not export registrations.');
    const stream = registrationWorkbook(first.data as ExportPage, async (cutoff, last) => {
      const result = await fetchPage(cutoff, last.createdAt, last.id);
      if (result.error) throw new Error('Could not read the next export batch.');
      return result.data as ExportPage;
    });
    return new Response(stream, {
      headers: {
        ...headers,
        'Content-Type': XLSX_TYPE,
        'Content-Disposition': `attachment; filename="ai-expo-attendance-${new Date().toISOString().slice(0, 10)}.xlsx"`,
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return fail(503, 'Could not complete the export. Please try again.');
  }
}

if (import.meta.main) Deno.serve(handleExport);
