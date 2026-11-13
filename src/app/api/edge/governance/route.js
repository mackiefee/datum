import { runGovernanceScanLogic } from '../../../../lib/edgeLogic.js';

export const runtime = 'edge';

export async function POST(req) {
  try {
    const body = await req.json();
    const result = runGovernanceScanLogic(body);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
