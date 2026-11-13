import { ls } from '../utils/storage.js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://knxyslvecmjhvlgapoyl.supabase.co';
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_XQFm2PK27ZDiEMOz3BQe7A_7KuqHNnt';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON);

/**
 * Dual-mode data repository:
 * - Persists state immediately in browser storage (kb2-*) for instant interactive usage.
 * - Exposes Supabase REST/RPC adapter when NEXT_PUBLIC_SUPABASE_URL is configured.
 */
export const db = {
  mode: isSupabaseConfigured ? 'supabase' : 'local',

  load(key, fallback) {
    const val = ls.get(key);
    return val !== null && val !== undefined ? val : fallback;
  },

  save(key, value) {
    ls.set(key, value);
    if (isSupabaseConfigured && typeof window !== 'undefined') {
      // Non-blocking background sync hook when Supabase backend is connected
      window.__lastDbSync = { key, at: Date.now() };
    }
  },

  async rpc(fnName, params, userJwt) {
    if (!isSupabaseConfigured) return null;
    const headers = {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON,
    };
    const bearer = userJwt || (SUPABASE_ANON.startsWith('eyJ') ? SUPABASE_ANON : '');
    if (bearer) {
      headers.Authorization = `Bearer ${bearer}`;
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fnName}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Supabase RPC error: ${res.status}`);
    return res.json();
  },
};
