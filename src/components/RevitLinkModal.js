import { html, useEffect, useMemo, useState } from '../lib/react.js';
import { Ic, DatumMark } from './Icon.js';

const UID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}-[0-9a-fA-F]{8}$/;
const BIDI_PERCENT_RE = /%(?:E2%80%8[B-F]|E2%80%A[A-E]|E2%81%A[0-9]|EF%BB%BF)/gi;
const BIDI_CHAR_RE = /[\u200b-\u200f\u202a-\u202e\u2060-\u2064\u2066-\u2069\ufeff]/g;
const UTK_QUERY_KEYS = new Set(['m', 't', 'k', 'u', 'n', 'v']);

const KINDS = {
  view: { label: 'Revit View', short: 'View', color: '#0a84ff', icon: 'eye' },
  sheet: { label: 'Revit Sheet', short: 'Sheet', color: '#5e5ce6', icon: 'doc' },
  elem: { label: 'Revit Element', short: 'Element', color: '#30d158', icon: 'layers' },
  room: { label: 'Revit Room', short: 'Room', color: '#bf5af2', icon: 'map' },
};

let lastTriggeredUri = '';
let lastTriggeredAt = 0;

function cleanVisible(val) {
  return String(val || '').replace(BIDI_CHAR_RE, '').trim();
}

function cleanRawQuery(raw) {
  return String(raw || '')
    .replace(BIDI_PERCENT_RE, '')
    .replace(BIDI_CHAR_RE, '')
    .replace(/%20/gi, '+')
    .replace(/ /g, '+')
    .replace(/^[?#]+/, '');
}

/**
 * Parse a Datum /open#... URL, search+hash pair, or utk://open?... URI
 * while keeping raw '+'-encoded utkQuery intact with zero spaces, %20, or bidi chars.
 */
export function parseRevitLinkUrl(inputUrlOrSearch, hashStr = '') {
  if (!inputUrlOrSearch && !hashStr) return null;

  let raw = cleanRawQuery(hashStr);
  if (!raw && typeof inputUrlOrSearch === 'string') {
    const src = inputUrlOrSearch.trim();
    if (!src) return null;
    const isExternalNonOpen =
      /^https?:\/\//i.test(src) &&
      !/[?#/]open(?:[?#]|$)/i.test(src) &&
      !/[?&#]k=(view|sheet|elem|room)\b/i.test(src);
    if (isExternalNonOpen) return null;

    const hashIdx = src.indexOf('#');
    if (hashIdx >= 0 && hashIdx < src.length - 1) {
      raw = cleanRawQuery(src.slice(hashIdx + 1));
    } else {
      const qIdx = src.indexOf('?');
      if (qIdx >= 0) {
        raw = cleanRawQuery(src.slice(qIdx + 1));
      } else if (!/^utk:\/\//i.test(src) && !/^https?:\/\//i.test(src) && !src.startsWith('/')) {
        raw = cleanRawQuery(src);
      }
    }
  }

  if (!raw) return null;

  const cleanParts = [];
  const utkParts = [];
  for (const part of raw.split('&')) {
    if (!part) continue;
    const eqIdx = part.indexOf('=');
    const keyLower = (eqIdx >= 0 ? part.slice(0, eqIdx) : part).trim().toLowerCase();
    cleanParts.push(part);
    if (UTK_QUERY_KEYS.has(keyLower)) {
      utkParts.push(part);
    }
  }

  const cleanFullRaw = cleanParts.join('&');
  const sp = new URLSearchParams(cleanFullRaw);
  const k = cleanVisible(sp.get('k')).toLowerCase();
  const u = cleanVisible(sp.get('u'));
  if (!KINDS[k] || !UID_RE.test(u)) return null;

  const m = cleanVisible(sp.get('m')).slice(0, 80);
  const t = cleanVisible(sp.get('t')).slice(0, 120);
  const n = cleanVisible(sp.get('n')).slice(0, 120);
  const rawV = cleanVisible(sp.get('v'));
  const v = rawV && UID_RE.test(rawV) ? rawV : '';
  const c = cleanVisible(sp.get('c')).slice(0, 80);
  const f = cleanVisible(sp.get('f')).slice(0, 120);
  const tp = cleanVisible(sp.get('tp')).slice(0, 120);

  const utkQuery = utkParts.join('&');
  const utkUri = `utk://open?${utkQuery}`;
  const origin =
    typeof window !== 'undefined' && window.location && window.location.origin
      ? window.location.origin
      : '';
  const webUrl = `${origin}/open#${cleanFullRaw}`;

  return { m, t, k, u, n, v, c, f, tp, cleanFullRaw, utkUri, webUrl };
}

/**
 * Trigger the local Universal Toolkit utk:// protocol on page load via hidden <iframe>
 * (works without requiring user activation; guarded against StrictMode double-mount).
 */
export function triggerUtkProtocol(utkUri, force = false) {
  if (typeof document === 'undefined' || !utkUri || !/^utk:\/\/open\?/i.test(utkUri)) return false;
  const now = Date.now();
  if (!force && utkUri === lastTriggeredUri && now - lastTriggeredAt < 1500) {
    return false;
  }
  lastTriggeredUri = utkUri;
  lastTriggeredAt = now;
  try {
    const ifr = document.createElement('iframe');
    ifr.style.display = 'none';
    ifr.setAttribute('aria-hidden', 'true');
    ifr.src = utkUri;
    document.body.appendChild(ifr);
    window.setTimeout(() => {
      try {
        ifr.remove();
      } catch (e) {}
    }, 2500);
    return true;
  } catch (e) {
    return false;
  }
}

function copyText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  return Promise.resolve(false);
}

export function RevitLinkModal({ linkCtx, res = [], onClose, onOpenDoc, onOpenType, flash }) {
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    if (!linkCtx || !linkCtx.utkUri) return;
    setPulseCount(0);
    triggerUtkProtocol(linkCtx.utkUri);
  }, [linkCtx?.utkUri]);

  useEffect(() => {
    if (!linkCtx) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [linkCtx, onClose]);

  const related = useMemo(() => {
    if (!linkCtx || !Array.isArray(res) || !res.length) return [];
    const raw = [
      linkCtx.n,
      linkCtx.c,
      linkCtx.f,
      linkCtx.tp,
      linkCtx.k === 'sheet' ? 'sheet legend schedule' : '',
      linkCtx.k === 'view' ? 'view template rcp plan' : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const tokens = raw.split(/[^a-z0-9]+/).filter((w) => w.length >= 2);
    if (!tokens.length) return [];
    return res
      .map((item) => {
        const hay = `${item.title || ''} ${item.desc || item.sum || ''} ${(item.tags || []).join(' ')} ${(item.body || '').slice(0, 500)}`.toLowerCase();
        let score = 0;
        for (const tok of tokens) {
          if (hay.includes(tok)) score += tok.length >= 4 ? 3 : 1;
        }
        return { item, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => x.item);
  }, [linkCtx, res]);

  if (!linkCtx) return null;

  const meta = KINDS[linkCtx.k] || KINDS.elem;
  const typeSummary = [linkCtx.c, linkCtx.f, linkCtx.tp].filter(Boolean).join(' · ');

  const handleCopyDatumLink = async () => {
    const ok = await copyText(linkCtx.webUrl);
    if (flash) flash(ok ? 'Copied Datum Revit link' : 'Clipboard unavailable');
  };

  const handleCopyUtk = async () => {
    const ok = await copyText(linkCtx.utkUri);
    if (flash) flash(ok ? 'Copied utk:// protocol URI' : 'Clipboard unavailable');
  };

  return html`<div className="ov rvt-lk-ov" role="dialog" aria-modal="true" aria-label="Open in Autodesk Revit" onClick=${onClose}>
    <div className="rvt-lk-card" onClick=${(e) => e.stopPropagation()}>
      <button type="button" className="x" onClick=${onClose} aria-label="Close"><${Ic} n="x" s=${15} /></button>

      <div className="rvt-lk-top">
        <${DatumMark} s=${30} />
        <div className="rvt-lk-badges">
          <span className="pill" style=${{ '--c': meta.color }}><${Ic} n=${meta.icon} s=${12} /> ${meta.label}</span>
          <span className="rvt-lk-live">
            <i></i>
            ${pulseCount > 0 ? 'Re-sent to Autodesk Revit' : 'Sent to Autodesk Revit'}
          </span>
        </div>
      </div>

      <h2 className="rvt-lk-title">${linkCtx.n || `${meta.short} ${linkCtx.u.slice(0, 8)}`}</h2>

      <div className="insp-group" style=${{ marginTop: 14 }}>
        <div className="insp-row">
          <span className="insp-k">Revit Model<small>Target project file</small></span>
          <span className="insp-v"><span className="insp-val-txt">${linkCtx.t || 'Active Revit Model'}</span></span>
        </div>
        ${typeSummary &&
        html`<div className="insp-row">
          <span className="insp-k">Type Context<small>Category · Family · Type</small></span>
          <span className="insp-v"><span className="insp-val-txt">${typeSummary}</span></span>
        </div>`}
        <div className="insp-row">
          <span className="insp-k">UniqueId<small>Persistent Revit GUID</small></span>
          <span className="insp-v"><code className="rvt-lk-uid">${linkCtx.u}</code></span>
        </div>
      </div>

      <div className="rvt-lk-acts">
        <a
          className="btn p"
          href=${linkCtx.utkUri}
          onClick=${() => {
            setPulseCount((c) => c + 1);
            if (flash) flash('Sent deep link to Autodesk Revit (utk://)');
          }}
        >
          <${Ic} n="openx" s=${15} /> Open in Revit
        </a>
        ${(typeSummary || linkCtx.k === 'elem') &&
        onOpenType &&
        html`<button
          type="button"
          className="btn"
          onClick=${() => {
            onOpenType({
              category: linkCtx.c || '',
              family: linkCtx.f || '',
              typeName: linkCtx.tp || linkCtx.n || '',
            });
            onClose();
          }}
        >
          <${Ic} n="layers" s=${15} /> Inspect Type in Datum
        </button>`}
        <button type="button" className="btn" onClick=${handleCopyDatumLink}>
          <${Ic} n="link" s=${15} /> Copy Datum Link
        </button>
        <button type="button" className="btn" onClick=${handleCopyUtk} title="Copy raw utk:// protocol URI">
          Copy utk://
        </button>
      </div>

      ${related.length > 0 &&
      onOpenDoc &&
      html`<div className="rvt-lk-rel">
        <div className="insp-sec-hdr" style=${{ paddingLeft: 2 }}>Related Datum Standards</div>
        <div className="insp-group">
          ${related.map(
            (doc) => html`<button
              key=${doc.id}
              type="button"
              className="insp-act"
              onClick=${() => {
                onOpenDoc(doc.id);
                onClose();
              }}
            >
              <span className="insp-act-ico"><${Ic} n="doc" s=${15} /></span>
              <span className="insp-act-lbl">${doc.title}</span>
              <span className="insp-act-end"><${Ic} n="chev" s=${14} /></span>
            </button>`
          )}
        </div>
      </div>`}

      <p className="rvt-lk-foot">
        Hosted by Datum · Works with Universal Toolkit’s <code>utk://</code> handler in Autodesk Revit.
      </p>
    </div>
  </div>`;
}
