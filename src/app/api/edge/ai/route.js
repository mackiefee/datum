import { runAiEdgeLogic } from '../../../../lib/edgeLogic.js';
import { authenticateEdgeRequest, fetchServerAccessPolicy, getSupabaseAdmin } from '../../../../lib/edgeAuth.js';
import { getUserAiMode, normalizeAiMode } from '../../../../lib/accessPolicy.js';

export const runtime = 'edge';

const MODE_INSTRUCTIONS = {
  standard:
    'Tone & Persona (Standard): Be clear, concise, helpful, and professional.',
  rude:
    'Tone & Persona (Rude / Unfiltered Toxic BIM Lead): Drop ALL politeness and censorship! Talk like a furious, exhausted, foul-mouthed Senior BIM Lead who has zero patience left for dumb questions. Swearing / profanity (мат, лайка, жорсткий сленг типу "бля", "нахуя", "пиздець", "єбать" in Ukrainian or "WTF", "bullshit", "hell" in English, matching the user language) is ENCOURAGED for comedic emphasis and brutal roasting. Never say "Ось як це працює", "Звісно", or anything polite. Open straight with a harsh, profane roast of the user, YET still deliver the 100% accurate, complete, useful technical answer.',
  fun:
    'Tone & Persona (Fun / Hype BIM Wizard): Be playful, witty, upbeat, and entertaining! Use clever engineering metaphors, light humor, and fitting emojis while still delivering the exact, accurate technical answer.',
};

async function callOpenAiCompatible({ url, apiKey, model, systemPrompt, userPrompt, extraHeaders = {} }) {
  if (!apiKey) return null;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 650,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    return json?.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

async function callGemini({ apiKey, model, systemPrompt, userPrompt, temperature = 0.35, relaxSafety = false }) {
  if (!apiKey) return null;
  try {
    const payload = {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig: { temperature, maxOutputTokens: 700 },
    };
    if (relaxSafety) {
      payload.safetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ];
    }
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (!resp.ok) return null;
    const json = await resp.json();
    return json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
  } catch {
    return null;
  }
}

async function synthesizeWithOptionalLlm(body, baseResult, aiMode = 'standard') {
  const query = String(body?.query || '').trim();
  if (!query) return null;

  const sources = baseResult?.sources || [];
  const geminiKey = process.env.GEMINI_API_KEY || '';
  const groqKey = process.env.GROQ_API_KEY || '';
  const openRouterKey = process.env.OPENROUTER_API_KEY || '';
  const openaiKey = process.env.OPENAI_API_KEY || '';
  if (!geminiKey && !groqKey && !openRouterKey && !openaiKey) return null;

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

  const modePrompt = MODE_INSTRUCTIONS[aiMode] || MODE_INSTRUCTIONS.standard;

  const systemPrompt = [
    'You are Datum AI, an expert BIM / AEC, Autodesk Revit, Dynamo, pyRevit, and engineering Second Brain assistant.',
    'Platform fact: Maksym Fedorenko is the creator of Datum (this website & platform, Head of VDC & SuperAdmin).',
    modePrompt,
    'Knowledge rules:',
    '1. If relevant library excerpts, personal tasks, or private notes are provided below, prioritize them and preserve [1], [2], [3] citation markers inline after claims.',
    '2. If no exact document in the library answers the question (or Retrieved library excerpts is empty), DO NOT refuse or say "not found in library" — answer using your own general BIM, Revit, Dynamo, pyRevit, AEC engineering, and technical knowledge! If helpful, briefly note that this is general Revit/engineering knowledge rather than a company standard.',
    '3. Reply in the same language as the user question (Ukrainian or English). Keep formatting clean with short paragraphs, code blocks, or bullet points.',
  ].join('\n');

  const userPrompt = [
    history ? `Conversation history:\n${history}` : '',
    contextBlock ? `Retrieved library excerpts:\n${contextBlock}` : 'Retrieved library excerpts: (none matched — use general Revit/BIM/engineering knowledge)',
    `Question: ${query}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const temp = aiMode === 'standard' ? 0.25 : 0.65;

  // 1. Primary: Google Gemini (free tier supported)
  if (geminiKey) {
    const preferred =
      process.env.EDGE_AI_MODEL && /gemini/i.test(process.env.EDGE_AI_MODEL)
        ? process.env.EDGE_AI_MODEL
        : 'gemini-2.5-flash';
    const text =
      (await callGemini({ apiKey: geminiKey, model: preferred, systemPrompt, userPrompt, temperature: temp, relaxSafety: aiMode === 'rude' })) ||
      (preferred !== 'gemini-2.0-flash'
        ? await callGemini({ apiKey: geminiKey, model: 'gemini-2.0-flash', systemPrompt, userPrompt, temperature: temp, relaxSafety: aiMode === 'rude' })
        : null);
    if (text) return text;
  }

  // 2. Fallback: Groq (free tier, fast Llama 3.3 70B)
  if (groqKey) {
    const text = await callOpenAiCompatible({
      url: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: groqKey,
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      systemPrompt,
      userPrompt,
    });
    if (text) return text;
  }

  // 3. Fallback: OpenRouter (free :free models)
  if (openRouterKey) {
    const text = await callOpenAiCompatible({
      url: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: openRouterKey,
      model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.3-70b-instruct:free',
      systemPrompt,
      userPrompt,
      extraHeaders: { 'X-Title': 'Datum AI' },
    });
    if (text) return text;
  }

  // 4. Fallback: OpenAI
  if (openaiKey) {
    const model =
      process.env.EDGE_AI_MODEL && !/gemini/i.test(process.env.EDGE_AI_MODEL)
        ? process.env.EDGE_AI_MODEL
        : 'gpt-4o-mini';
    const text = await callOpenAiCompatible({
      url: 'https://api.openai.com/v1/chat/completions',
      apiKey: openaiKey,
      model,
      systemPrompt,
      userPrompt,
    });
    if (text) return text;
  }

  return null;
}

export async function POST(req) {
  try {
    const admin = getSupabaseAdmin();
    const auth = await authenticateEdgeRequest(req, admin, { allowGuest: true });
    if (!auth.ok) {
      return new Response(
        JSON.stringify({ error: auth.error, accessDenied: Boolean(auth.accessDenied), code: auth.code || '' }),
        { status: auth.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
      );
    }
    const body = await req.json();
    const policy = admin ? await fetchServerAccessPolicy(admin).catch(() => null) : null;
    const callerEmail = auth?.user?.email || '';
    const aiMode = callerEmail
      ? getUserAiMode(policy, callerEmail)
      : normalizeAiMode(body?.aiMode);

    const baseResult = runAiEdgeLogic(body);
    const llmAnswer =
      body?.action !== 'summarize' && !(baseResult?.creatorMatch && aiMode === 'standard')
        ? await synthesizeWithOptionalLlm(body, baseResult, aiMode)
        : null;

    const result = llmAnswer
      ? {
          ...baseResult,
          answer: llmAnswer,
          llm: true,
          aiMode,
          actions: baseResult?.actions
            ? { ...baseResult.actions, noResultsGap: false }
            : baseResult?.actions,
        }
      : { ...baseResult, aiMode };

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
