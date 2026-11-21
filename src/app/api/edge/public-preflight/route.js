import { runPublicPreflightLogic } from '../../../../lib/edgeLogic.js';
import { authenticateEdgeRequest, getSupabaseAdmin } from '../../../../lib/edgeAuth.js';

export const runtime = 'edge';

export async function POST(req) {
  try {
    const auth = await authenticateEdgeRequest(req, getSupabaseAdmin(), { allowGuest: false });
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ error: auth.error, accessDenied: Boolean(auth.accessDenied), code: auth.code || '' }),
        { status: auth.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    }
    const body = await req.json();
    const result = runPublicPreflightLogic(body);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}
