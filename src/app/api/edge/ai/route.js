import { runAiEdgeLogic } from '../../../../lib/edgeLogic.js';

export const runtime = 'edge';

async function synthesizeWithOptionalLlm(body, baseResult) {
  const query = String(body?.query || '').trim();
  const sources = baseResult?.sources || [];
  if (!query || (!sources.length && !baseResult?.answer)) return null;

  const openaiKey = process.env.OPENAI_API_KEY || '';
  const geminiKey = process.env.GEMINI_API_KEY || '';
  if (!openaiKey && !geminiKey) return null;

  const history = Array.isArray(body?.history)
    ? body.history
        .slice(-6)
        .filter((m) => m && m.text)
        .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${String(m.text).slice(0, 320)}`)
        .join('\n')
    : '';

  const contextBlock = sources
    .map((s) => `[${s.index}] ${s.title}${s.sectionTitle ? ` (§ ${s.sectionTitle})` : ''}\n${s.excerpt}`)
    .join('\n\n');

  const systemPrompt =
    'You are Datum AI, a concise BIM & AEC standards assistant. Answer strictly using the provided cited library excerpts. Preserve [1], [2], [3] citation markers inline after claims. Reply in the same language as the user question (Ukrainian or English). Keep formatting clean with short paragraphs or bullet points.';

  const userPrompt = [
    history ? `Conversation history:\n${history}` : '',
    contextBlock ? `Retrieved library excerpts:\n${contextBlock}` : '',
    `Question: ${query}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    if (openaiKey) {
      const model = process.env.EDGE_AI_MODEL && !/gemini/i.test(process.env.EDGE_AI_MODEL)
        ? process.env.EDGE_AI_MODEL
        : 'gpt-4o-mini';
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          max_tokens: 450,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (resp.ok) {
        const json = await resp.json();
        const text = json?.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    }

    if (geminiKey) {
      const model = process.env.EDGE_AI_MODEL && /gemini/i.test(process.env.EDGE_AI_MODEL)
        ? process.env.EDGE_AI_MODEL
        : 'gemini-2.5-flash';
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 450 },
          }),
        }
      );
      if (resp.ok) {
        const json = await resp.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (text) return text;
      }
    }
  } catch {
    // Graceful fallback to deterministic Edge RAG output
  }
  return null;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const baseResult = runAiEdgeLogic(body);
    const llmAnswer = body?.action !== 'summarize' ? await synthesizeWithOptionalLlm(body, baseResult) : null;
    const result = llmAnswer ? { ...baseResult, answer: llmAnswer, llm: true } : baseResult;
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
