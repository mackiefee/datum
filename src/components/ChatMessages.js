import { html, useState } from '../lib/react.js';
import { CITE, DC, TY } from '../config/constants.js';
import { Ic } from './Icon.js';

function renderInlineWithCitations(text, sources, onSelectSource, keyPrefix = 'in') {
  const tokenRe = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\*[^*\n]+\*)/g;
  const segments = String(text || '').split(tokenRe);
  return segments.map((seg, sIdx) => {
    if (!seg) return null;
    if (seg.startsWith('`') && seg.endsWith('`') && seg.length >= 2) {
      return html`<code key=${`${keyPrefix}-c-${sIdx}`} className="chat-inline-code">${seg.slice(1, -1)}</code>`;
    }
    if (seg.startsWith('**') && seg.endsWith('**') && seg.length >= 4) {
      return html`<strong key=${`${keyPrefix}-b-${sIdx}`}>
        ${renderInlineWithCitations(seg.slice(2, -2), sources, onSelectSource, `${keyPrefix}-b-${sIdx}`)}
      </strong>`;
    }
    if (seg.startsWith('*') && seg.endsWith('*') && seg.length >= 3) {
      return html`<em key=${`${keyPrefix}-i-${sIdx}`}>
        ${renderInlineWithCitations(seg.slice(1, -1), sources, onSelectSource, `${keyPrefix}-i-${sIdx}`)}
      </em>`;
    }
    return seg.split(CITE).map((chunk, i) =>
      i % 2
        ? html`<sup
            key=${`${keyPrefix}-ct-${sIdx}-${i}`}
            className="kspace-cite-sup"
            onClick=${() => {
              const s = sources && sources[Number(chunk) - 1];
              if (s && onSelectSource) onSelectSource(s);
            }}
          >[${chunk}]</sup>`
        : chunk
    );
  });
}

function renderTextWithCitations(text, sources, onSelectSource) {
  const raw = String(text || '').replace(/\r\n/g, '\n');
  if (!raw.trim()) return null;

  const blocks = [];
  const fenceRe = /```([a-zA-Z0-9_+#-]*)\n([\s\S]*?)```/g;
  let lastIdx = 0;
  let m;
  while ((m = fenceRe.exec(raw)) !== null) {
    if (m.index > lastIdx) {
      blocks.push({ kind: 'text', value: raw.slice(lastIdx, m.index) });
    }
    blocks.push({ kind: 'code', lang: m[1] || '', value: m[2].replace(/\n+$/, '') });
    lastIdx = fenceRe.lastIndex;
  }
  if (lastIdx < raw.length) {
    blocks.push({ kind: 'text', value: raw.slice(lastIdx) });
  }

  const out = [];
  blocks.forEach((blk, bIdx) => {
    if (blk.kind === 'code') {
      out.push(
        html`<pre key=${`code-${bIdx}`} className="chat-code-block">
          ${blk.lang && html`<span className="chat-code-lang">${blk.lang}</span>`}
          <code>${blk.value}</code>
        </pre>`
      );
      return;
    }

    const lines = blk.value.split('\n').filter((l) => l.trim() !== '');
    lines.forEach((line, lIdx) => {
      const trimmed = line.trim();
      const k = `${bIdx}-${lIdx}`;
      const headingM = trimmed.match(/^#{1,4}\s+(.+)$/);
      if (headingM) {
        out.push(
          html`<div key=${k} className="chat-msg-h">
            ${renderInlineWithCitations(headingM[1], sources, onSelectSource, k)}
          </div>`
        );
        return;
      }
      const isBullet = /^[•\-*]\s+/.test(trimmed);
      if (isBullet) {
        const cleanLine = trimmed.replace(/^[•\-*]\s+/, '');
        out.push(
          html`<div key=${k} className="chat-msg-bullet">
            <span className="chat-bullet-dot">•</span>
            <span>${renderInlineWithCitations(cleanLine, sources, onSelectSource, k)}</span>
          </div>`
        );
        return;
      }
      const numM = trimmed.match(/^(\d+\.)\s+(.+)$/);
      if (numM) {
        out.push(
          html`<div key=${k} className="chat-msg-bullet">
            <span className="chat-bullet-num">${numM[1]}</span>
            <span>${renderInlineWithCitations(numM[2], sources, onSelectSource, k)}</span>
          </div>`
        );
        return;
      }
      out.push(html`<p key=${k}>${renderInlineWithCitations(trimmed, sources, onSelectSource, k)}</p>`);
    });
  });

  return out;
}

/**
 * Shared threaded conversation renderer for Desktop 3D Space, Mobile Chat-First,
 * and Reader's embedded document AI assistant.
 */
export function ChatMessages({
  messages = [],
  poolById,
  favs = [],
  isGuest = false,
  compact = false,
  onSelectSource,
  onHoverSource,
  onOpenCard,
  onToggleFav,
  onSaveToNote,
  onSaveToTask,
  onOpenNamingStudio,
  onFlagGap,
  endRef = null,
}) {
  const [expandedTurnId, setExpandedTurnId] = useState(null);
  const [flaggedQueries, setFlaggedQueries] = useState(() => new Set());

  return html`<div className=${'chat-thread' + (compact ? ' is-compact' : '')} role="log" aria-label="Search conversation">
    ${messages.map((msg) => {
      if (msg.role === 'user') {
        return html`<div key=${msg.id} className="kspace-mob-msg is-user">
          ${msg.scopeDocTitle &&
          html`<span className="chat-scope-tag">In: ${msg.scopeDocTitle}</span>`}
          <div className="kspace-mob-bubble">${msg.text}</div>
        </div>`;
      }

      const matchedDocs = (msg.matchIds || [])
        .map((id) => (poolById ? poolById.get(id) : null))
        .filter(Boolean);
      const isMatchesOpen = expandedTurnId === msg.id;
      const primarySrc = msg.src && msg.src[0];
      const primaryExtUrl = (msg.src || []).find((s) => s && s.url);
      const isPrimaryFav = primarySrc && favs.includes(primarySrc.id);
      const isGapFlagged = msg.query && flaggedQueries.has(msg.query);
      const canClip =
        !msg.busy && Boolean(msg.text) && !isGuest && Boolean(onSaveToNote || onSaveToTask);
      const canFavPrimary = Boolean(
        primarySrc &&
          !isGuest &&
          onToggleFav &&
          !String(primarySrc.id).startsWith('task:') &&
          !String(primarySrc.id).startsWith('note:') &&
          !String(primarySrc.id).startsWith('res:')
      );
      const hasActions =
        !msg.busy &&
        ((msg.actions && (msg.actions.suggestNamingStudio || msg.actions.noResultsGap)) ||
          Boolean(primaryExtUrl) ||
          canFavPrimary ||
          canClip);

      return html`<div key=${msg.id} className="kspace-mob-msg is-assistant">
        <div className="kspace-mob-msg-head">
          <span className="kspace-ai-badge">
            <${Ic} n="spark" s=${11} /> Datum AI
          </span>
          ${msg.scopeDocTitle &&
          html`<span className="chat-msg-scope">§ ${msg.scopeDocTitle}</span>`}
        </div>

        <div className="kspace-mob-msg-body">
          ${msg.busy && !msg.text
            ? html`<div className="dots"><i></i><i></i><i></i></div>`
            : renderTextWithCitations(msg.text, msg.src, onSelectSource)}
        </div>

        ${msg.src &&
        msg.src.length > 0 &&
        html`<div className="kspace-ai-srcs">
          ${msg.src.map(
            (s, idx) => html`<button
              key=${`${s.id}-${s.sectionId || idx}`}
              type="button"
              className="kspace-src-pill"
              onMouseEnter=${() => onHoverSource && onHoverSource(s.id)}
              onMouseLeave=${() => onHoverSource && onHoverSource(null)}
              onClick=${() => onSelectSource && onSelectSource(s)}
              title=${s.brainKind === 'task'
                ? 'Open in Personal Tasks'
                : s.brainKind === 'note'
                ? 'Open in Private Notes'
                : s.brainKind === 'resource'
                ? 'Open in Personal Resources'
                : s.sectionTitle
                ? `Jump to § ${s.sectionTitle}`
                : 'Open standard'}
            >
              <b>${s.index}</b>
              <span>
                ${s.brainKind === 'task'
                  ? 'Task · '
                  : s.brainKind === 'note'
                  ? 'Note · '
                  : s.brainKind === 'resource'
                  ? 'Resource · '
                  : ''}${s.title}${s.sectionTitle ? ` · § ${s.sectionTitle}` : ''}${s.stale ? ' (Review)' : ''}
              </span>
              <span className="kspace-src-go">↗</span>
            </button>`
          )}
        </div>`}

        ${hasActions &&
        html`<div className="chat-msg-actions">
          ${msg.actions &&
          msg.actions.suggestNamingStudio &&
          onOpenNamingStudio &&
          html`<button
            type="button"
            className="chat-act-chip is-primary"
            onClick=${() => onOpenNamingStudio(msg.actions.namingCode || '')}
          >
            <${Ic} n="sliders" s=${12} />
            <span>${msg.actions.namingCode ? 'Open code in Naming Studio' : 'Open Naming Studio'}</span>
          </button>`}

          ${primaryExtUrl &&
          html`<a
            className="chat-act-chip"
            href=${primaryExtUrl.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <${Ic} n="openx" s=${12} />
            <span>Open ${TY[primaryExtUrl.type] || 'Link'}</span>
          </a>`}

          ${canFavPrimary &&
          html`<button
            type="button"
            className=${'chat-act-chip' + (isPrimaryFav ? ' on' : '')}
            onClick=${() => onToggleFav(primarySrc.id)}
          >
            <${Ic} n="star" s=${12} f=${isPrimaryFav} />
            <span>${isPrimaryFav ? 'Bookmarked' : 'Bookmark'}</span>
          </button>`}

          ${canClip &&
          onSaveToNote &&
          html`<button
            type="button"
            className="chat-act-chip"
            onClick=${() => onSaveToNote(msg)}
            title="Save AI answer as a Private Note in your Second Brain"
          >
            <${Ic} n="note" s=${12} />
            <span>+ Save Note</span>
          </button>`}

          ${canClip &&
          onSaveToTask &&
          html`<button
            type="button"
            className="chat-act-chip"
            onClick=${() => onSaveToTask(msg)}
            title="Turn AI answer into a Personal Task"
          >
            <${Ic} n="check" s=${12} />
            <span>+ To Task</span>
          </button>`}

          ${msg.actions &&
          msg.actions.noResultsGap &&
          onFlagGap &&
          html`<button
            type="button"
            className=${'chat-act-chip' + (isGapFlagged ? ' on' : ' is-warn')}
            disabled=${isGapFlagged}
            onClick=${() => {
              if (!msg.query) return;
              onFlagGap(msg.query);
              setFlaggedQueries((prev) => new Set([...prev, msg.query]));
            }}
          >
            <${Ic} n=${isGapFlagged ? 'check' : 'plus'} s=${12} />
            <span>${isGapFlagged ? 'Gap flagged for Admin' : 'Flag missing standard'}</span>
          </button>`}
        </div>`}

        ${matchedDocs.length > 0 &&
        !msg.busy &&
        html`<div className="kspace-mob-turn-matches">
          <button
            type="button"
            className=${'kspace-mini-btn' + (isMatchesOpen ? ' on' : '')}
            onClick=${() => setExpandedTurnId((cur) => (cur === msg.id ? null : msg.id))}
          >
            ${isMatchesOpen
              ? `Hide matching (${matchedDocs.length})`
              : `${matchedDocs.length} matching ${matchedDocs.length === 1 ? 'standard' : 'standards'} ▾`}
          </button>
          ${isMatchesOpen &&
          html`<div className="kspace-mob-turn-cards">
            ${matchedDocs.map(
              (r) => html`<button
                key=${r.id}
                type="button"
                className="kspace-mob-card"
                style=${{ '--c': DC[r.disc] || '#0a84ff' }}
                onMouseEnter=${() => onHoverSource && onHoverSource(r.id)}
                onMouseLeave=${() => onHoverSource && onHoverSource(null)}
                onClick=${() => (onOpenCard ? onOpenCard(r.id) : onSelectSource && onSelectSource({ id: r.id }))}
              >
                <div className="kspace-mob-card-top">
                  <span className="kspace-mob-disc">
                    <i className="kspace-mob-dot" />
                    <span>${r.disc || 'General'}</span>
                  </span>
                  <span className="kspace-mob-meta">${TY[r.type] || 'Document'}</span>
                </div>
                <div className="kspace-mob-card-title">${r.title}</div>
              </button>`
            )}
          </div>`}
        </div>`}
      </div>`;
    })}
    ${endRef && html`<div ref=${endRef} />`}
  </div>`;
}
