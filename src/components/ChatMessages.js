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
  const [openSrcTurnIds, setOpenSrcTurnIds] = useState(() => new Set());
  const [copiedMsgId, setCopiedMsgId] = useState(null);
  const [flaggedQueries, setFlaggedQueries] = useState(() => new Set());

  const toggleSourcesForTurn = (id) => {
    setOpenSrcTurnIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyMessageText = (msg) => {
    if (!msg || !msg.text) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(String(msg.text)).catch(() => {});
    }
    setCopiedMsgId(msg.id);
    setTimeout(() => {
      setCopiedMsgId((cur) => (cur === msg.id ? null : cur));
    }, 1500);
  };

  return html`<div className=${'chat-thread' + (compact ? ' is-compact' : '')} role="log" aria-label="Search conversation">
    ${messages.map((msg) => {
      if (msg.role === 'user') {
        return html`<div key=${msg.id} className="kspace-mob-msg is-user">
          ${msg.scopeDocTitle &&
          html`<span className="chat-scope-tag">In: ${msg.scopeDocTitle}</span>`}
          <div className="kspace-mob-bubble">${msg.text}</div>
        </div>`;
      }

      const srcList = Array.isArray(msg.src) ? msg.src : [];
      const hasSources = srcList.length > 0;
      const isSourcesOpen = openSrcTurnIds.has(msg.id);
      const primarySrc = srcList[0] || null;
      const primaryExtUrl = srcList.find((s) => s && s.url);
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
      const showFooter =
        !msg.busy &&
        (hasSources ||
          Boolean(msg.text) ||
          (msg.actions && (msg.actions.suggestNamingStudio || msg.actions.noResultsGap)) ||
          Boolean(primaryExtUrl));

      return html`<div key=${msg.id} className="kspace-mob-msg is-assistant">
        ${msg.scopeDocTitle &&
        html`<div className="kspace-mob-msg-head">
          <span className="chat-msg-scope">§ ${msg.scopeDocTitle}</span>
        </div>`}

        <div className="kspace-mob-msg-body">
          ${msg.busy && !msg.text
            ? html`<div className="dots"><i></i><i></i><i></i></div>`
            : renderTextWithCitations(msg.text, srcList, onSelectSource)}
        </div>

        ${showFooter &&
        html`<div className="chat-msg-footer">
          <div className="chat-footer-left">
            ${hasSources &&
            html`<button
              type="button"
              className=${'chat-src-toggle' + (isSourcesOpen ? ' on' : '')}
              onClick=${() => toggleSourcesForTurn(msg.id)}
              title=${isSourcesOpen ? 'Hide cited sources' : 'Show cited sources'}
            >
              <${Ic} n="doc" s=${11} />
              <span>${srcList.length} ${srcList.length === 1 ? 'source' : 'sources'}</span>
              <span className="chat-src-chev">${isSourcesOpen ? '▴' : '▾'}</span>
            </button>`}

            ${msg.actions &&
            msg.actions.suggestNamingStudio &&
            onOpenNamingStudio &&
            html`<button
              type="button"
              className="chat-ctx-pill is-primary"
              onClick=${() => onOpenNamingStudio(msg.actions.namingCode || '')}
            >
              <${Ic} n="sliders" s=${11} />
              <span>${msg.actions.namingCode ? 'Naming Studio' : 'Naming Studio'}</span>
            </button>`}

            ${primaryExtUrl &&
            html`<a
              className="chat-ctx-pill"
              href=${primaryExtUrl.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <${Ic} n="openx" s=${11} />
              <span>Open ${TY[primaryExtUrl.type] || 'Link'}</span>
            </a>`}

            ${msg.actions &&
            msg.actions.noResultsGap &&
            onFlagGap &&
            html`<button
              type="button"
              className=${'chat-ctx-pill' + (isGapFlagged ? ' on' : ' is-warn')}
              disabled=${isGapFlagged}
              onClick=${() => {
                if (!msg.query) return;
                onFlagGap(msg.query);
                setFlaggedQueries((prev) => new Set([...prev, msg.query]));
              }}
            >
              <${Ic} n=${isGapFlagged ? 'check' : 'plus'} s=${11} />
              <span>${isGapFlagged ? 'Flagged' : 'Flag missing'}</span>
            </button>`}
          </div>

          <div className="chat-ico-bar" role="toolbar" aria-label="Message actions">
            ${Boolean(msg.text) &&
            html`<button
              type="button"
              className=${'chat-ico-btn' + (copiedMsgId === msg.id ? ' on' : '')}
              onClick=${() => copyMessageText(msg)}
              title=${copiedMsgId === msg.id ? 'Copied' : 'Copy answer'}
              aria-label="Copy answer"
            >
              <${Ic} n=${copiedMsgId === msg.id ? 'check' : 'copy'} s=${13} />
            </button>`}

            ${canClip &&
            onSaveToNote &&
            html`<button
              type="button"
              className="chat-ico-btn"
              onClick=${() => onSaveToNote(msg)}
              title="Save to Private Notes"
              aria-label="Save to Private Notes"
            >
              <${Ic} n="note" s=${13} />
            </button>`}

            ${canClip &&
            onSaveToTask &&
            html`<button
              type="button"
              className="chat-ico-btn"
              onClick=${() => onSaveToTask(msg)}
              title="Convert to Personal Task"
              aria-label="Convert to Personal Task"
            >
              <${Ic} n="check" s=${13} />
            </button>`}

            ${canFavPrimary &&
            html`<button
              type="button"
              className=${'chat-ico-btn' + (isPrimaryFav ? ' is-fav' : '')}
              onClick=${() => onToggleFav(primarySrc.id)}
              title=${isPrimaryFav ? 'Remove bookmark' : 'Bookmark source'}
              aria-label="Bookmark source"
            >
              <${Ic} n="star" s=${13} f=${isPrimaryFav} />
            </button>`}
          </div>
        </div>`}

        ${hasSources &&
        isSourcesOpen &&
        html`<div className="kspace-ai-srcs">
          ${srcList.map(
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
                ${s.brainKind === 'task'
                  ? 'Task · '
                  : s.brainKind === 'note'
                  ? 'Note · '
                  : s.brainKind === 'resource'
                  ? 'Resource · '
                  : ''}${s.title}${s.sectionTitle ? ` · § ${s.sectionTitle}` : ''}
              </span>
              <span className="kspace-src-go">↗</span>
            </button>`
          )}
        </div>`}
      </div>`;
    })}
    ${endRef && html`<div ref=${endRef} />`}
  </div>`;
}
