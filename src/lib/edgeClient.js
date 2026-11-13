import { runAiEdgeLogic, runPublicPreflightLogic, runGovernanceScanLogic } from './edgeLogic.js';

async function callEdge(path, payload, fallbackFn) {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) return await res.json();
  } catch (e) {
    // Fallback to local execution if network or SSR boundary interrupts fetch
  }
  return fallbackFn(payload);
}

export const edgeClient = {
  ai: (payload) => callEdge('/api/edge/ai', payload, runAiEdgeLogic),
  publicPreflight: (payload) => callEdge('/api/edge/public-preflight', payload, runPublicPreflightLogic),
  governance: (payload) => callEdge('/api/edge/governance', payload, runGovernanceScanLogic),
};
