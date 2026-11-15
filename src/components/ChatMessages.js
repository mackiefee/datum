import { html, useState } from '../lib/react.js';
import { CITE, DC, TY } from '../config/constants.js';
import { Ic } from './Icon.js';

function renderTextWithCitations(text, sources, onSelectSource) {
  const lines = String(text || '').split('\n').filter((l) => l.trim() !== '');
  if (!lines.length) return null;

  return lines.map((line, lIdx) => {
    const isBullet = /^[•\-*]\s+/.test(line.trim());
    const cleanLine = isBullet ? line.trim().replace(/^[•\-*]\s+/, '') : line;
    const parts = cleanLine.split(CITE).map((chunk, i) =>
      i % 2
        ? html`<sup
            key=${i}
            className="kspace-cite-sup"
            onClick=${() => {
              const s = sources && sources[Number(chunk) - 1];
              if (s && onSelectSource) onSelectSource(s);
            }}
          >[${chunk}]</sup>`
        : chunk
    );
    return isBullet
      ? html`<div key=${lIdx} className="chat-msg-bullet"><span className="chat-bullet-dot">•</span><span>${parts}</span></div>`
      : html`<p key=${lIdx}>${parts}</p>`;
  });
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
      const hasActions =
        !msg.busy &&
        ((msg.actions && (msg.actions.suggestNamingStudio || msg.actions.noResultsGap)) ||
          Boolean(primaryExtUrl) ||
          Boolean(primarySrc && !isGuest && onToggleFav));

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
              title=${s.sectionTitle ? `Jump to § ${s.sectionTitle}` : 'Open standard'}
            >
              <b>${s.index}</b>
              <span>
                ${s.title}${s.sectionTitle ? ` · § ${s.sectionTitle}` : ''}${s.stale ? ' (Review)' : ''}
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

          ${primarySrc &&
          !isGuest &&
          onToggleFav &&
          html`<button
            type="button"
            className=${'chat-act-chip' + (isPrimaryFav ? ' on' : '')}
            onClick=${() => onToggleFav(primarySrc.id)}
          >
            <${Ic} n="star" s=${12} f=${isPrimaryFav} />
            <span>${isPrimaryFav ? 'Bookmarked' : 'Bookmark'}</span>
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
