import { createPortal } from 'react-dom';
import { html, Fragment, useState, useMemo, useEffect, useRef } from '../../lib/react.js';
import { DC, ST, TY, TODAY, isDocType } from '../../config/constants.js';
import { db } from '../../lib/db.js';
import { fmt } from '../../utils/format.js';
import { plain } from '../../utils/markdown.js';
import { Ic, DatumMark } from '../../components/Icon.js';
import { Avatar, Pill } from '../../components/Badge.js';
import { Select } from '../../components/Select.js';
import { NEWS_CATEGORIES, SEED_NEWS_POSTS } from '../../data/newsPosts.js';

const STORAGE_POSTS_KEY = 'kb2-news-posts-v2';
const STORAGE_META_KEY = 'kb2-news-meta-v1';
const PAGE_SIZE = 9;
const REACTION_EMOJIS = ['🔥', '👏', '💡', '❤️'];

const CAT_BY_ID = new Map(NEWS_CATEGORIES.map((c) => [c.id, c]));

const BENTO_STAT_PHOTO =
  'https://cdn.prod.website-files.com/686d0fd099ee65617e107e24/6aea0c2220759e2d23282937_1900Broadway.jpg';
const BENTO_WIDE_PHOTO =
  'https://cdn.prod.website-files.com/686d0fd099ee65617e107e24/6ab23b06b375f7dd6e146ffe_exterior_-_front_sunset.1600x0%20(1).webp';

function findCleanBackdrop(post) {
  const htmlStr = String((post && post.bodyHtml) || '');
  const imgs = [
    ...htmlStr.matchAll(
      /<figure[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"[^>]*>(?:<figcaption>([\s\S]*?)<\/figcaption>)?/gi
    ),
  ];
  const slideHit = imgs.find((m) => /slide-/i.test(m[2] || '') && !/Screenshot/i.test(m[1] || ''));
  if (slideHit && slideHit[1]) return { src: slideHit[1], isCleanPhoto: true };

  const cleanHit = imgs.find((m) => {
    const src = m[1] || '';
    const cap = m[2] || '';
    return (
      src &&
      !/comment-photo|video/i.test(cap) &&
      !/Quote|Project%20info|Service|Screenshot/i.test(src)
    );
  });
  if (cleanHit && cleanHit[1]) return { src: cleanHit[1], isCleanPhoto: true };

  return { src: (post && post.cover) || '', isCleanPhoto: false };
}

function resolveHeroBackdrop(post) {
  const hit = findCleanBackdrop(post);
  return hit.src || (post && post.cover) || BENTO_WIDE_PHOTO;
}

function parseReadMinutes(readTime) {
  const m = String(readTime || '').match(/\d+/);
  return m ? Number(m[0]) : 2;
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, '…', total];
  if (current >= total - 3) return [1, '…', total - 4, total - 3, total - 2, total - 1, total];
  return [1, '…', current - 1, current, current + 1, '…', total];
}

const QUICK_UPDATE_SEEDS = [
  {
    id: 'news-update-naming-137',
    kind: 'update',
    category: 'technical',
    title: '13-Slot Wall & Soffit Naming Standard (#137) is now live in Naming Studio',
    summary:
      'All C10_INTERIOR partition types and soffit drops must use the unified 13-slot naming pattern. Validate or generate compliant Revit type names directly in Wall Naming Studio.',
    codeSnippet: 'C1010_I-GWB_2L-362S16OC-2L_1HR_STC50',
    cover: BENTO_STAT_PHOTO,
    accentColor: '#8e5cf7',
    readTime: 'Standard #137',
    date: TODAY,
    author: 'Andrii Lytvynov',
    dept: 'VDC',
    project: 'C10_INTERIOR',
    featured: false,
    pinned: true,
    linkedDocIds: [137, 100],
    tags: ['VDC', 'Naming', 'C10_INTERIOR'],
    bodyHtml:
      '<p>All <strong>C10_INTERIOR</strong> partition types and soffit drops should follow the unified 13-slot naming standard before CL-RFI export.</p><p>Use <strong>Naming Studio</strong> from the workspace sidebar or Datum AI quick actions to validate existing Revit type names or assemble new ones with zero typos.</p>',
  },
  {
    id: 'news-update-planit-knows',
    kind: 'update',
    category: 'company',
    title: 'Planit Knows stories have moved natively into Datum Newsfeed',
    summary:
      'All company stories, Behind the Project case studies, automation updates, and People & Inside interviews are now searchable inside Datum and linked directly to our standards.',
    codeSnippet: '',
    cover: BENTO_WIDE_PHOTO,
    accentColor: '#30d158',
    readTime: '1 min',
    date: TODAY,
    author: 'Maxim',
    dept: 'VDC',
    project: 'General',
    featured: false,
    pinned: false,
    linkedDocIds: [100, 102],
    tags: ['Newsfeed', 'Datum'],
    bodyHtml:
      '<p>We retired external Webflow CMS hosting and brought all <strong>Planit Knows</strong> editorial stories directly into Datum.</p><p>You can now filter by rubric, search with Datum AI, link articles to standards, post quick team updates, and save insights straight to your Second Brain notes or tasks.</p>',
  },
];

function extractDocCover(doc, imgs = {}) {
  if (!doc) return '';
  if (Array.isArray(doc.publicAttachments) && doc.publicAttachments.length) {
    const key = doc.publicAttachments[0];
    if (imgs && imgs[key]) return imgs[key];
  }
  const body = String(doc.body || '');
  const m = body.match(/!\[[^\]]*\]\((?:img:([a-zA-Z0-9_-]+)|((?:https?:\/\/|\/)[^)\s]+))\)/);
  if (!m) return '';
  if (m[1]) return (imgs && imgs[m[1]]) || '';
  return m[2] || '';
}

function getDocDiffInfo(doc) {
  const vers = Array.isArray(doc?.v) ? doc.v : [];
  if (!vers.length) return { verLabel: 'v1', latestNote: doc?.desc || '', prevNote: '', changedLines: [] };
  const cur = vers[vers.length - 1];
  const prev = vers.length > 1 ? vers[vers.length - 2] : null;
  let changedLines = [];
  if (prev && prev.body && cur.body && prev.body !== cur.body) {
    const prevSet = new Set(
      String(prev.body)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 8)
    );
    changedLines = String(cur.body)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 8 && !l.startsWith('![') && !prevSet.has(l))
      .slice(0, 4);
  }
  return {
    verLabel: `v${cur.n || vers.length}`,
    latestBy: cur.by || doc.author || '',
    latestDate: cur.d || doc.upd || '',
    latestNote: cur.note || doc.desc || 'Updated standard content',
    prevVerLabel: prev ? `v${prev.n || vers.length - 1}` : '',
    prevNote: prev ? prev.note || '' : '',
    changedLines,
  };
}

function cleanCaptionText(raw) {
  return String(raw || '')
    .replace(/\[(single|slide-[^\]]+|comment-[^\]]+|video)\]/gi, '')
    .replace(/\u200d|\u00a0/g, ' ')
    .replace(/^\s*\|\s*/, '')
    .trim();
}

function parseQuoteBlock(bqEl, pendingPhoto) {
  const rawHtml = bqEl.innerHTML || '';
  const text = (bqEl.textContent || '').replace(/\u200d|\u00a0/g, ' ').trim();
  const isAccent = /\[comment-accent\]/i.test(text);
  const isPhotoMarker = /\[comment-photo[^\]]*\]/i.test(text);
  const isBasicMarker = /\[comment-basic\]/i.test(text);

  let workingHtml = rawHtml
    .replace(/\[(comment-(?:accent|basic|photo[^\]]*))\]\s*/gi, '')
    .replace(/\u200d|\u00a0/g, ' ')
    .trim();

  let authorName = '';
  let authorRole = '';

  const splitNameRole = (sig) => {
    const cleanSig = String(sig || '').replace(/\s+/g, ' ').trim();
    const commaIdx = cleanSig.indexOf(',');
    if (commaIdx > 0 && commaIdx < cleanSig.length - 1) {
      return [cleanSig.slice(0, commaIdx).trim(), cleanSig.slice(commaIdx + 1).trim()];
    }
    return [cleanSig, ''];
  };

  const pipeMatch = workingHtml.match(/^\s*([^<\n|]{2,60})\|\s*([^<\n]{2,60})(?:<br\s*\/?>|\n)+([\s\S]+)$/i);
  if (pipeMatch && (isAccent || isPhotoMarker || isBasicMarker)) {
    authorName = pipeMatch[1].replace(/<[^>]+>/g, '').trim();
    authorRole = pipeMatch[2].replace(/<[^>]+>/g, '').trim();
    workingHtml = pipeMatch[3].trim();
  }

  // Handle "• Author Name •" even when Webflow split <em>/<strong> tags across the bullets
  if (!authorName) {
    const lastBrIdx = Math.max(workingHtml.lastIndexOf('<br>'), workingHtml.lastIndexOf('<br/>'), workingHtml.lastIndexOf('<br />'));
    if (lastBrIdx >= 0) {
      const tailRaw = workingHtml.slice(lastBrIdx).replace(/<br\s*\/?>/gi, '');
      const tailPlain = tailRaw.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      const bm = tailPlain.match(/^•\s*([^•]{2,72}?)\s*•$/);
      if (bm) {
        [authorName, authorRole] = splitNameRole(bm[1]);
        workingHtml = workingHtml.slice(0, lastBrIdx).trim();
      }
    }
  }

  if (!authorName) {
    const subAttr = workingHtml.match(/([\s\S]*?)<sub>([\s\S]+?)<\/sub>(?:<\/(?:strong|em|b|i)>|\s)*$/i);
    if (subAttr) {
      workingHtml = subAttr[1].replace(/(?:<\/(?:strong|em|b|i)>|<br\s*\/?>|\s)+$/gi, '').trim();
      [authorName, authorRole] = splitNameRole(subAttr[2].replace(/<[^>]+>/g, ''));
    }
  }

  if (!authorName) {
    const tailStrong = workingHtml.match(
      /^([\s\S]*?)(?:<\/?(?:em|i|strong|b)>\s*)*(?:<br\s*\/?>\s*)+(?:<\/?(?:em|i|strong|b)>\s*)*<(?:strong|b)[^>]*>(?:\s*<(?:em|i)[^>]*>)*\s*([^<]{2,64}?)\s*(?:<\/(?:em|i)>\s*)*<\/(?:strong|b)>(?:\s|<\/(?:em|i|p)>)*$/i
    );
    if (tailStrong) {
      const candidate = tailStrong[2].replace(/\s+/g, ' ').trim();
      if (candidate && candidate.split(/\s+/).length <= 6 && !/[.!?)]$/.test(candidate)) {
        [authorName, authorRole] = splitNameRole(candidate);
        workingHtml = tailStrong[1].trim();
      }
    }
  }

  if (!authorName) {
    const dashAttr = workingHtml.match(
      /^([\s\S]*?)(?:<br\s*\/?>\s*)+(?:<(?:strong|em|b|i)[^>]*>)*\s*[-–—]\s*([^<\n-]{2,48}?)\s*[-–—]\s*(?:<\/(?:strong|em|b|i)>|\s)*$/i
    );
    if (dashAttr) {
      workingHtml = dashAttr[1].trim();
      [authorName, authorRole] = splitNameRole(dashAttr[2]);
    }
  }

  workingHtml = workingHtml
    .replace(/^(?:<\/?(?:em|i)>|<br\s*\/?>|\s)+/gi, '')
    .replace(/(?:<\/?(?:em|i)>|<br\s*\/?>|\s)+$/gi, '');

  let paragraphs = [];
  if (/<p[\s>]/i.test(workingHtml)) {
    const tmpDoc = typeof DOMParser !== 'undefined' ? new DOMParser().parseFromString(workingHtml, 'text/html') : null;
    if (tmpDoc) {
      paragraphs = Array.from(tmpDoc.body.children)
        .map((el) => sanitizeNodeForProse(el).trim())
        .filter(Boolean);
    }
  }
  if (!paragraphs.length) {
    paragraphs = workingHtml
      .split(/(?:<br\s*\/?>\s*){2,}/i)
      .map((chunk) =>
        chunk
          .replace(/^(?:<\/?(?:em|i)>|<br\s*\/?>|\s)+/gi, '')
          .replace(/(?:<\/?(?:em|i)>|<br\s*\/?>|\s)+$/gi, '')
          .trim()
      )
      .filter(Boolean)
      .map((chunk) => {
        // Strip unmatched stray leading/trailing inline <em> if balanced wrap was cut across <br><br>
        const cleaned = chunk.replace(/<\/?em>/gi, (tag, off, str) => {
          const opens = (str.match(/<em[^>]*>/gi) || []).length;
          const closes = (str.match(/<\/em>/gi) || []).length;
          return opens === closes ? tag : '';
        });
        return `<p>${cleaned}</p>`;
      });
  }

  const cleanBodyHtml = paragraphs.join('');
  const plainText = cleanBodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const isPlaylistCard = /Spotify|Apple Music|YouTube Music/i.test(text);

  return {
    type: 'quote',
    variant: isAccent ? 'accent' : pendingPhoto ? 'photo' : isPlaylistCard ? 'callout' : 'basic',
    photoSrc: pendingPhoto || '',
    authorName,
    authorRole,
    paragraphs,
    plainLength: plainText.length,
    bodyHtml: cleanBodyHtml,
  };
}

function sanitizeNodeForProse(node) {
  const clone = node.cloneNode(true);
  clone.querySelectorAll &&
    clone.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (/^https?:/i.test(href) || /^mailto:/i.test(href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
  return clone.outerHTML || '';
}

function parseListFeatureBlock(ulNode) {
  if (!ulNode || ulNode.querySelector('ul, ol')) return null;
  const lis = Array.from(ulNode.children).filter((el) => el.tagName && el.tagName.toLowerCase() === 'li');
  if (lis.length < 2 || lis.length > 8) return null;

  const items = lis.map((li) => {
    const clone = li.cloneNode(true);
    clone.querySelectorAll &&
      clone.querySelectorAll('a').forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (/^https?:/i.test(href) || /^mailto:/i.test(href)) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      });

    let title = '';
    const firstEl = clone.firstElementChild;
    const onlyWhitespaceBefore =
      firstEl &&
      (!firstEl.previousSibling ||
        (firstEl.previousSibling.nodeType === 3 && !firstEl.previousSibling.textContent.trim()));
    if (
      firstEl &&
      onlyWhitespaceBefore &&
      /^(strong|b)$/i.test(firstEl.tagName)
    ) {
      title = (firstEl.textContent || '').replace(/\u200d|\u00a0/g, ' ').replace(/[:\s]+$/, '').trim();
      firstEl.remove();
    }

    let bodyHtml = (clone.innerHTML || '')
      .replace(/\u200d|\u00a0/g, ' ')
      .replace(/^\s*(?:[:—–-]+\s*)+/, '')
      .replace(/;\s*$/, '')
      .trim();

    return { title, bodyHtml };
  });

  const titledCount = items.filter((it) => Boolean(it.title)).length;
  const maxPlainLen = Math.max(...items.map((it) => `${it.title} ${it.bodyHtml}`.replace(/<[^>]+>/g, '').length));
  if (titledCount >= 2 || (lis.length <= 6 && maxPlainLen <= 190)) {
    return { type: 'featureList', items };
  }
  return null;
}

export function parseArticleBlocks(htmlStr = '') {
  const raw = String(htmlStr || '').trim();
  if (!raw) return [];
  if (!/<[a-z][\s\S]*>/i.test(raw)) {
    const parts = raw
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    return parts.map((p) => {
      if (p.startsWith('>')) {
        const cleaned = p.replace(/^>\s*/gm, '');
        const paras = cleaned.split(/\n+/).filter(Boolean).map((x) => `<p>${x}</p>`);
        return {
          type: 'quote',
          variant: 'accent',
          photoSrc: '',
          authorName: '',
          authorRole: '',
          paragraphs: paras,
          plainLength: cleaned.length,
          bodyHtml: paras.join(''),
        };
      }
      return { type: 'html', html: `<p>${p.replace(/\n/g, '<br>')}</p>` };
    });
  }
  if (typeof DOMParser === 'undefined') {
    return [{ type: 'html', html: raw }];
  }

  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const blocks = [];
  let htmlBuf = [];
  let pendingCommentPhoto = '';

  const flushHtml = () => {
    const joined = htmlBuf.join('').trim();
    htmlBuf = [];
    if (joined) blocks.push({ type: 'html', html: joined });
  };

  const flushPendingPhotoIfUnused = () => {
    if (pendingCommentPhoto) {
      blocks.push({ type: 'image', src: pendingCommentPhoto, caption: '' });
      pendingCommentPhoto = '';
    }
  };

  const children = Array.from(doc.body.childNodes);
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.nodeType === 3) {
      const txt = node.textContent.replace(/\u200d|\u00a0/g, ' ').trim();
      if (txt) {
        flushPendingPhotoIfUnused();
        htmlBuf.push(`<p>${txt}</p>`);
      }
      continue;
    }
    if (node.nodeType !== 1) continue;
    const tag = node.tagName.toLowerCase();

    if (tag === 'figure') {
      const iframe = node.querySelector('iframe');
      if (iframe && iframe.getAttribute('src')) {
        flushHtml();
        flushPendingPhotoIfUnused();
        blocks.push({
          type: 'video',
          embedUrl: iframe.getAttribute('src'),
          title: iframe.getAttribute('title') || 'Video',
        });
        continue;
      }

      const img = node.querySelector('img');
      if (img && img.getAttribute('src')) {
        const src = img.getAttribute('src');
        const capEl = node.querySelector('figcaption');
        const capText = capEl ? (capEl.textContent || '').trim() : '';

        if (/\[comment-photo[^\]]*\]/i.test(capText)) {
          flushHtml();
          flushPendingPhotoIfUnused();
          pendingCommentPhoto = src;
          continue;
        }

        const slideMatch = capText.match(/\[(slide-[^\]]+)\]/i);
        if (slideMatch) {
          flushHtml();
          flushPendingPhotoIfUnused();
          const groupKey = slideMatch[1].toLowerCase();
          const caption = cleanCaptionText(capText);
          const prev = blocks[blocks.length - 1];
          if (prev && prev.type === 'carousel' && prev.group === groupKey) {
            prev.slides.push({ src, caption });
          } else {
            blocks.push({
              type: 'carousel',
              group: groupKey,
              slides: [{ src, caption }],
            });
          }
          continue;
        }

        if (/\[video\]/i.test(capText) || node.getAttribute('data-video-url')) {
          flushHtml();
          flushPendingPhotoIfUnused();
          const capLink = capEl && capEl.querySelector('a');
          const urlFromText = (capText.match(/https?:\/\/\S+/) || [])[0] || '';
          const videoUrl = node.getAttribute('data-video-url') || (capLink && capLink.getAttribute('href')) || urlFromText;
          let caption = cleanCaptionText(capText);
          if (videoUrl) caption = caption.replace(videoUrl, '').replace(/^\s*\|\s*/, '').trim();
          blocks.push({ type: 'videoLink', url: videoUrl, poster: src, caption });
          continue;
        }

        flushHtml();
        flushPendingPhotoIfUnused();
        blocks.push({
          type: 'image',
          src,
          caption: cleanCaptionText(capText),
        });
        continue;
      }
    }

    if (tag === 'blockquote') {
      flushHtml();
      const qBlock = parseQuoteBlock(node, pendingCommentPhoto);
      pendingCommentPhoto = '';
      blocks.push(qBlock);
      continue;
    }

    if (tag === 'ul') {
      const feat = parseListFeatureBlock(node);
      if (feat) {
        flushHtml();
        flushPendingPhotoIfUnused();
        blocks.push(feat);
        continue;
      }
    }

    if (tag === 'h2' || tag === 'h3' || tag === 'h4' || tag === 'h5') {
      const txt = (node.textContent || '').replace(/\u200d|\u00a0/g, ' ').trim();
      const clone = node.cloneNode(true);
      if (tag === 'h4' || tag === 'h5') {
        if (/\?\s*$/.test(txt)) {
          clone.className = (clone.className ? clone.className + ' ' : '') + 'nf-qa-question';
        }
      }
      flushPendingPhotoIfUnused();
      htmlBuf.push(sanitizeNodeForProse(clone));
      continue;
    }

    if (tag === 'p') {
      const innerTxt = (node.textContent || '').replace(/\u200d|\u00a0/g, ' ').trim();
      if (!innerTxt && !node.querySelector('img, iframe, a')) {
        continue;
      }

      // Convert standalone bold prompt paragraphs ("⭐ What will be part of his new role?...") into crisp subheadings
      const trimmedChildNodes = Array.from(node.childNodes).filter(
        (n) => !(n.nodeType === 3 && !n.textContent.replace(/\u200d|\u00a0/g, '').trim())
      );
      if (
        trimmedChildNodes.length === 1 &&
        trimmedChildNodes[0].nodeType === 1 &&
        /^(strong|b)$/i.test(trimmedChildNodes[0].tagName) &&
        !node.querySelector('a') &&
        innerTxt.length <= 130 &&
        !/[.!]$/.test(innerTxt)
      ) {
        flushPendingPhotoIfUnused();
        htmlBuf.push(`<h3 class="nf-sec-subhead${/\?\s*$/.test(innerTxt) ? ' nf-qa-question' : ''}">${innerTxt}</h3>`);
        continue;
      }

      // Unwrap full-paragraph italic answers ("<em>...</em>") into readable upright roman text
      if (
        trimmedChildNodes.length === 1 &&
        trimmedChildNodes[0].nodeType === 1 &&
        /^(em|i)$/i.test(trimmedChildNodes[0].tagName) &&
        !(innerTxt.length < 60 && /^[-–—]/.test(innerTxt))
      ) {
        flushPendingPhotoIfUnused();
        const innerClone = node.cloneNode(true);
        const onlyEm = Array.from(innerClone.children).find((c) => /^(em|i)$/i.test(c.tagName));
        if (onlyEm) {
          innerClone.innerHTML = onlyEm.innerHTML;
        }
        htmlBuf.push(sanitizeNodeForProse(innerClone));
        continue;
      }
    }

    flushPendingPhotoIfUnused();
    htmlBuf.push(sanitizeNodeForProse(node));
  }

  flushPendingPhotoIfUnused();
  flushHtml();

  // Group consecutive quote blocks (2+) into a 2-column endorsement Bento grid
  const grouped = [];
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i].type === 'quote') {
      const run = [blocks[i]];
      while (i + 1 < blocks.length && blocks[i + 1].type === 'quote') {
        run.push(blocks[++i]);
      }
      if (run.length >= 2) grouped.push({ type: 'quoteGroup', quotes: run });
      else grouped.push(run[0]);
    } else {
      grouped.push(blocks[i]);
    }
  }
  return grouped;
}

function ArticleCarousel({ slides = [] }) {
  const [idx, setIdx] = useState(0);
  if (!slides.length) return null;
  const safeIdx = Math.max(0, Math.min(idx, slides.length - 1));
  const cur = slides[safeIdx];
  const step = (delta) => setIdx((i) => (i + delta + slides.length) % slides.length);

  return html`<div className="nf-carousel" role="region" aria-label="Article image gallery">
    <div className="nf-car-stage">
      <img src=${cur.src} alt=${cur.caption || `Slide ${safeIdx + 1} of ${slides.length}`} loading="lazy" />
      ${slides.length > 1 &&
      html`<button
        type="button"
        className="nf-car-nav prev"
        aria-label="Previous slide"
        onClick=${() => step(-1)}
      >
        <${Ic} n="chev" s=${16} />
      </button>`}
      ${slides.length > 1 &&
      html`<button
        type="button"
        className="nf-car-nav next"
        aria-label="Next slide"
        onClick=${() => step(1)}
      >
        <${Ic} n="chev" s=${16} />
      </button>`}
      <span className="nf-car-cnt">${safeIdx + 1} / ${slides.length}</span>
    </div>
    ${(cur.caption || slides.length > 1) &&
    html`<div className="nf-car-foot">
      ${cur.caption ? html`<span className="nf-car-cap">${cur.caption}</span>` : html`<span className="nf-car-cap">Project gallery</span>`}
      ${slides.length > 1 &&
      slides.length <= 16 &&
      html`<div className="nf-car-dots" role="tablist" aria-label="Select slide">
        ${slides.map(
          (_, sIdx) => html`<button
            key=${sIdx}
            type="button"
            className=${'nf-car-dot' + (sIdx === safeIdx ? ' on' : '')}
            aria-label=${`Slide ${sIdx + 1}`}
            aria-selected=${sIdx === safeIdx}
            onClick=${() => setIdx(sIdx)}
          />`
        )}
      </div>`}
    </div>`}
  </div>`;
}

function QuoteCard({ q, usersByName }) {
  const [expanded, setExpanded] = useState(false);
  const paras = Array.isArray(q.paragraphs) && q.paragraphs.length ? q.paragraphs : [q.bodyHtml || ''];
  const isLong = paras.length > 2 || (q.plainLength || 0) > 420;
  const shownHtml = isLong && !expanded ? paras.slice(0, 2).join('') : q.bodyHtml || paras.join('');
  const authorUser = usersByName && q.authorName ? usersByName.get(q.authorName) || null : null;

  return html`<article className=${'nf-quote-card is-' + (q.variant || 'basic')}>
    <div className="nf-quote-head">
      ${q.photoSrc
        ? html`<div className="nf-quote-photo">
            <img src=${q.photoSrc} alt=${q.authorName || 'Teammate'} loading="lazy" />
          </div>`
        : html`<${Avatar} user=${authorUser} name=${q.authorName || 'Planit Team'} size="sm" />`}
      <div className="nf-quote-meta">
        <strong>${q.authorName || 'Team Perspective'}</strong>
        <span>${q.authorRole || (q.authorName ? 'Teammate' : 'Editorial highlight')}</span>
      </div>
      <span className="nf-quote-mark" aria-hidden="true">“</span>
    </div>

    <div
      className=${'nf-quote-prose' + (isLong && !expanded && paras.length <= 2 ? ' is-clamped' : '')}
      dangerouslySetInnerHTML=${{ __html: shownHtml }}
    />

    ${isLong &&
    html`<button
      type="button"
      className="nf-quote-more"
      aria-expanded=${expanded}
      onClick=${() => setExpanded((v) => !v)}
    >
      ${expanded ? 'Show less ▴' : 'Read full note ▾'}
    </button>`}
  </article>`;
}

function ArticleBlocksView({ htmlStr, imgs = {}, usersByName }) {
  const blocks = useMemo(() => parseArticleBlocks(htmlStr), [htmlStr]);
  return html`<div className="nf-article-blocks">
    ${blocks.map((blk, bIdx) => {
      if (blk.type === 'carousel') {
        return html`<${ArticleCarousel} key=${`car-${bIdx}`} slides=${blk.slides} />`;
      }
      if (blk.type === 'featureList') {
        return html`<div key=${`fl-${bIdx}`} className="nf-feature-grid">
          ${blk.items.map(
            (it, fIdx) => html`<div key=${fIdx} className="nf-feature-card">
              <span className="nf-feature-dot" aria-hidden="true" />
              <div className="nf-feature-copy">
                ${it.title && html`<strong>${it.title}</strong>`}
                ${it.bodyHtml && html`<span dangerouslySetInnerHTML=${{ __html: it.bodyHtml }} />`}
              </div>
            </div>`
          )}
        </div>`;
      }
      if (blk.type === 'quoteGroup') {
        return html`<div key=${`qg-${bIdx}`} className="nf-quote-grid">
          ${blk.quotes.map((q, qIdx) => html`<${QuoteCard} key=${qIdx} q=${q} usersByName=${usersByName} />`)}
        </div>`;
      }
      if (blk.type === 'quote') {
        return html`<${QuoteCard} key=${`q-${bIdx}`} q=${blk} usersByName=${usersByName} />`;
      }
      if (blk.type === 'video') {
        return html`<div key=${`vid-${bIdx}`} className="nf-video-wrap">
          <iframe
            src=${blk.embedUrl}
            title=${blk.title || 'Embedded video'}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>`;
      }
      if (blk.type === 'videoLink') {
        return html`<a
          key=${`vdl-${bIdx}`}
          className="nf-video-poster"
          href=${blk.url || '#'}
          target="_blank"
          rel="noopener noreferrer"
        >
          <img src=${blk.poster} alt=${blk.caption || 'Watch video'} loading="lazy" />
          <span className="nf-video-play">
            <span className="nf-play-tri" />
            <span>Watch video ↗</span>
          </span>
          ${blk.caption && html`<span className="nf-video-cap">${blk.caption}</span>`}
        </a>`;
      }
      if (blk.type === 'image') {
        const resolved = blk.src.startsWith('img:') ? imgs[blk.src.slice(4)] || '' : blk.src;
        if (!resolved) return null;
        return html`<figure key=${`img-${bIdx}`} className="nf-figure">
          <img src=${resolved} alt=${blk.caption || 'Article image'} loading="lazy" />
          ${blk.caption && html`<figcaption>${blk.caption}</figcaption>`}
        </figure>`;
      }
      return html`<div key=${`html-${bIdx}`} className="nf-prose" dangerouslySetInnerHTML=${{ __html: blk.html }} />`;
    })}
  </div>`;
}

function ArticleReaderModal({
  post,
  allPosts = [],
  docById,
  usersByName,
  imgs = {},
  reactionState = { counts: {}, mine: [] },
  isSaved = false,
  comments = [],
  isGuest = false,
  canEdit = false,
  onToggleReact,
  onToggleSave,
  onAddComment,
  onOpenDoc,
  onInspectDoc,
  onSaveToNote,
  onSaveToTask,
  onEditPost,
  onDeletePost,
  onSelectPost,
  onClose,
}) {
  const [draftComment, setDraftComment] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const scrollRef = useRef(null);

  useEffect(() => {
    setConfirmDel(false);
    setDraftComment('');
    setScrollPct(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [post?.id]);

  useEffect(() => {
    if (!post) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose && onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [post?.id, onClose]);

  const linkedDocs = useMemo(() => {
    if (!post || !Array.isArray(post.linkedDocIds)) return [];
    return post.linkedDocIds.map((id) => docById.get(Number(id))).filter(Boolean);
  }, [post, docById]);

  const relatedPosts = useMemo(() => {
    if (!post) return [];
    return allPosts
      .filter((p) => p.id !== post.id && p.category === post.category)
      .slice(0, 3);
  }, [post, allPosts]);

  if (!post || typeof document === 'undefined') return null;
  const cat = CAT_BY_ID.get(post.category) || NEWS_CATEGORIES[3];
  const authorObj = usersByName.get(post.author) || null;

  const handleReaderScroll = (e) => {
    const el = e.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) {
      setScrollPct(0);
      return;
    }
    setScrollPct(Math.min(100, Math.max(0, Math.round((el.scrollTop / max) * 100))));
  };

  return createPortal(
    html`<div
      className="nf-reader-ov"
      role="dialog"
      aria-modal="true"
      aria-label=${post.title}
      onClick=${(e) => {
        if (e.target === e.currentTarget) onClose && onClose();
      }}
    >
      <article className="nf-reader-sheet">
        <div className="nf-reader-topbar">
          <div className="nf-topbar-l">
            <button
              type="button"
              className="nf-topbar-back"
              aria-label="Close article"
              title="Close (Esc)"
              onClick=${onClose}
            >
              <${Ic} n="chev" s=${15} />
              <span>Back</span>
            </button>
            <span className="nf-cat-pill" style=${{ '--cc': cat.color }}>${cat.label}</span>
            ${post.readTime && html`<span className="nf-topbar-rt nf-hide-xs">${post.readTime} read</span>`}
          </div>

          <div className="nf-topbar-acts">
            ${!isGuest &&
            html`<button
              type="button"
              className=${'nf-topbar-btn' + (isSaved ? ' on' : '')}
              aria-label=${isSaved ? 'Remove bookmark' : 'Bookmark article'}
              onClick=${() => onToggleSave && onToggleSave(post.id)}
            >
              <${Ic} n="star" s=${13} f=${isSaved} />
              <span>${isSaved ? 'Saved' : 'Save'}</span>
            </button>`}
            ${!isGuest &&
            onSaveToNote &&
            html`<button type="button" className="nf-topbar-btn nf-hide-xs" onClick=${() => onSaveToNote(post)}>
              + Note
            </button>`}
            ${!isGuest &&
            onSaveToTask &&
            html`<button type="button" className="nf-topbar-btn nf-hide-xs" onClick=${() => onSaveToTask(post)}>
              + Task
            </button>`}
            ${canEdit &&
            onEditPost &&
            html`<button
              type="button"
              className="nf-topbar-ico"
              aria-label="Edit post"
              title="Edit post"
              onClick=${() => onEditPost(post)}
            >
              <${Ic} n="pencil" s=${14} />
            </button>`}
            ${canEdit &&
            onDeletePost &&
            html`<button
              type="button"
              className=${confirmDel ? 'nf-topbar-btn is-danger' : 'nf-topbar-ico'}
              aria-label="Delete post"
              title="Delete post"
              onClick=${() => {
                if (confirmDel) {
                  onDeletePost(post.id);
                  onClose && onClose();
                } else {
                  setConfirmDel(true);
                }
              }}
            >
              ${confirmDel ? html`<span>Confirm</span>` : html`<${Ic} n="trash" s=${14} />`}
            </button>`}
            <button
              type="button"
              className="nf-topbar-ico"
              aria-label="Close article"
              title="Close (Esc)"
              onClick=${onClose}
            >
              <${Ic} n="x" s=${14} />
            </button>
          </div>

          <div className="nf-reader-progress" aria-hidden="true">
            <span style=${{ width: `${scrollPct}%`, background: cat.color || 'var(--blue)' }} />
          </div>
        </div>

        <div ref=${scrollRef} className="nf-reader-scroll" onScroll=${handleReaderScroll}>
          <div className="nf-reader-body">
            <header className="nf-reader-head">
              <div className="nf-reader-eyebrow">
                <span className="nf-cat-pill" style=${{ '--cc': cat.color }}>${cat.label}</span>
                <span>${post.date ? fmt(post.date) : ''}${post.readTime ? ` • ${post.readTime} read` : ''}</span>
              </div>
              <h1>${post.title}</h1>
              ${post.summary && html`<p className="nf-reader-lead">${post.summary}</p>`}
              <div className="nf-reader-byline">
                <${Avatar} user=${authorObj} name=${post.author || 'Planit Team'} size="sm" />
                <span><strong>${post.author || 'Planit Team'}</strong></span>
                <span>·</span>
                <span>${post.dept || 'Planit'}${post.project && post.project !== 'General' ? ` · ${post.project}` : ''}</span>
              </div>
            </header>

            ${post.cover &&
            html`<figure className="nf-reader-cover-frame">
              <img src=${post.cover} alt=${post.title} />
            </figure>`}

            <div className="nf-reader-measure">
              ${post.codeSnippet &&
              html`<div className="nf-code-box">
                <code>${post.codeSnippet}</code>
              </div>`}

              <${ArticleBlocksView} htmlStr=${post.bodyHtml} imgs=${imgs} usersByName=${usersByName} />

              ${linkedDocs.length > 0 &&
              html`<section className="nf-connected-sec" aria-label="Connected Standards in Datum">
                <div className="nf-sec-lbl">Connected in Datum</div>
                <div className="nf-connected-grid">
                  ${linkedDocs.map(
                    (d) => html`<div key=${d.id} className="nf-conn-card" style=${{ '--c': DC[d.disc] || '#0a84ff' }}>
                      <div className="nf-conn-top">
                        <span className="nf-conn-disc">${d.disc}</span>
                        <${Pill} s=${d.status} />
                      </div>
                      <div className="nf-conn-title">${d.title}</div>
                      <div className="nf-conn-acts">
                        <button
                          type="button"
                          className="btn sm p"
                          onClick=${() => {
                            onClose && onClose();
                            onOpenDoc && onOpenDoc(d.id);
                          }}
                        >
                          Open Standard ↗
                        </button>
                        ${onInspectDoc &&
                        html`<button
                          type="button"
                          className="kspace-mini-btn"
                          onClick=${() => onInspectDoc(d.id)}
                        >
                          Inspect
                        </button>`}
                      </div>
                    </div>`
                  )}
                </div>
              </section>`}

              <section className="nf-engage-sec" aria-label="Reactions and Comments">
                <div className="nf-react-row">
                  ${REACTION_EMOJIS.map((em) => {
                    const cnt = (reactionState.counts && reactionState.counts[em]) || 0;
                    const active = Array.isArray(reactionState.mine) && reactionState.mine.includes(em);
                    return html`<button
                      key=${em}
                      type="button"
                      className=${'nf-react-btn' + (active ? ' on' : '')}
                      onClick=${() => onToggleReact && onToggleReact(post.id, em)}
                    >
                      <span>${em}</span>
                      ${cnt > 0 && html`<small>${cnt}</small>`}
                    </button>`;
                  })}
                </div>

                <div className="nf-comments">
                  <div className="nf-sec-lbl">Discussion (${comments.length})</div>
                  ${comments.length > 0 &&
                  html`<div className="nf-comment-list">
                    ${comments.map(
                      (c) => html`<div key=${c.id} className="nf-comment-item">
                        <${Avatar} user=${usersByName.get(c.by)} name=${c.by} size="sm" />
                        <div className="nf-comment-body">
                          <div className="nf-comment-head">
                            <b>${c.by}</b>
                            <small>${fmt(c.at)}</small>
                          </div>
                          <p>${c.text}</p>
                        </div>
                      </div>`
                    )}
                  </div>`}

                  ${!isGuest &&
                  onAddComment &&
                  html`<form
                    className="nf-comment-form"
                    onSubmit=${(e) => {
                      e.preventDefault();
                      const clean = draftComment.trim();
                      if (!clean) return;
                      onAddComment(post.id, clean);
                      setDraftComment('');
                    }}
                  >
                    <input
                      type="text"
                      value=${draftComment}
                      placeholder="Share a takeaway, question, or project note…"
                      onChange=${(e) => setDraftComment(e.target.value)}
                    />
                    <button type="submit" className="btn sm p" disabled=${!draftComment.trim()}>
                      Comment
                    </button>
                  </form>`}
                </div>
              </section>

              ${relatedPosts.length > 0 &&
              html`<section className="nf-related-sec">
                <div className="nf-sec-lbl">More in ${cat.label}</div>
                <div className="nf-related-grid">
                  ${relatedPosts.map(
                    (rp) => html`<button
                      key=${rp.id}
                      type="button"
                      className="nf-rel-card"
                      onClick=${() => onSelectPost && onSelectPost(rp)}
                    >
                      ${rp.cover
                        ? html`<img src=${rp.cover} alt=${rp.title} loading="lazy" />`
                        : html`<div className="nf-rel-fallback" style=${{ '--cc': cat.color }}><${DatumMark} s=${18} /></div>`}
                      <div className="nf-rel-info">
                        <b>${rp.title}</b>
                        <small>${rp.date ? fmt(rp.date) : ''} · ${rp.readTime || '2 min'}</small>
                      </div>
                    </button>`
                  )}
                </div>
              </section>`}
            </div>
          </div>
        </div>
      </article>
    </div>`,
    document.body
  );
}

function NewsComposerModal({
  open,
  initialPost = null,
  docs = [],
  projects = [],
  onClose,
  onSave,
}) {
  const [kind, setKind] = useState('article');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('technical');
  const [summary, setSummary] = useState('');
  const [cover, setCover] = useState('');
  const [readTime, setReadTime] = useState('2 min');
  const [project, setProject] = useState('General');
  const [linkedDocId, setLinkedDocId] = useState('');
  const [codeSnippet, setCodeSnippet] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [featured, setFeatured] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialPost) {
      setKind(initialPost.kind || 'article');
      setTitle(initialPost.title || '');
      setCategory(initialPost.category || 'technical');
      setSummary(initialPost.summary || '');
      setCover(initialPost.cover || '');
      setReadTime(initialPost.readTime || '2 min');
      setProject(initialPost.project || 'General');
      setLinkedDocId(initialPost.linkedDocIds && initialPost.linkedDocIds[0] ? String(initialPost.linkedDocIds[0]) : '');
      setCodeSnippet(initialPost.codeSnippet || '');
      setBodyText(plain(initialPost.bodyHtml || ''));
      setFeatured(Boolean(initialPost.featured));
    } else {
      setKind('article');
      setTitle('');
      setCategory('technical');
      setSummary('');
      setCover('');
      setReadTime('2 min');
      setProject('General');
      setLinkedDocId('');
      setCodeSnippet('');
      setBodyText('');
      setFeatured(false);
    }
  }, [open, initialPost]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (document.querySelector('.asel-menu')) return;
        e.stopPropagation();
        e.preventDefault();
        onClose && onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const paragraphs = bodyText
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) =>
        p.startsWith('>')
          ? `<blockquote>${p.replace(/^>\s*/gm, '').replace(/\n/g, '<br>')}</blockquote>`
          : `<p>${p.replace(/\n/g, '<br>')}</p>`
      )
      .join('');

    onSave &&
      onSave({
        ...(initialPost || {}),
        id: (initialPost && initialPost.id) || `news-custom-${Date.now().toString(36)}`,
        kind,
        title: cleanTitle,
        category,
        summary: summary.trim() || bodyText.trim().slice(0, 140),
        cover: cover.trim(),
        readTime: kind === 'update' ? 'Quick update' : readTime.trim() || '2 min',
        project: project || 'General',
        codeSnippet: codeSnippet.trim(),
        featured,
        linkedDocIds: linkedDocId ? [Number(linkedDocId)] : [],
        date: (initialPost && initialPost.date) || TODAY,
        bodyHtml: paragraphs || `<p>${summary.trim() || cleanTitle}</p>`,
      });
    onClose && onClose();
  };

  return createPortal(
    html`<div
      className="qc-ov"
      role="dialog"
      aria-modal="true"
      aria-label=${initialPost ? 'Edit Newsfeed post' : 'Create Newsfeed post'}
      onClick=${(e) => {
        if (e.target === e.currentTarget) onClose && onClose();
      }}
    >
      <form className="qc-sheet nf-comp-sheet" onSubmit=${handleSubmit}>
        <div className="qc-sh">
          <button type="button" className="qc-sh-cancel" onClick=${onClose}>Cancel</button>
          <b>${initialPost ? 'Edit Post' : 'New Post'}</b>
          <button type="submit" className="btn sm p qc-sh-save" disabled=${!title.trim()}>
            ${initialPost ? 'Save' : 'Publish'}
          </button>
        </div>

        <div className="seg" role="tablist" aria-label="Post type">
          <button
            type="button"
            className=${kind === 'article' ? 'on' : ''}
            onClick=${() => setKind('article')}
          >
            Article / Story
          </button>
          <button
            type="button"
            className=${kind === 'update' ? 'on' : ''}
            onClick=${() => setKind('update')}
          >
            Quick Team Update
          </button>
        </div>

        <div className="qc-cell">
          <input
            type="text"
            placeholder="Headline…"
            value=${title}
            onChange=${(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            rows="2"
            placeholder="Short summary for the Newsfeed card…"
            value=${summary}
            onChange=${(e) => setSummary(e.target.value)}
          />
        </div>

        <div className="qc-cell">
          <div className="qc-row">
            <span className="qc-row-lbl">Category</span>
            <${Select}
              variant="inline"
              ariaLabel="News category"
              value=${category}
              options=${NEWS_CATEGORIES.map((c) => [c.id, c.label])}
              onChange=${setCategory}
            />
          </div>
          <div className="qc-row">
            <span className="qc-row-lbl">Connected standard</span>
            <${Select}
              variant="inline"
              ariaLabel="Connected Datum standard"
              placeholder="None"
              value=${linkedDocId}
              options=${[['', 'None'], ...docs.filter((d) => d && d.title).slice(0, 40).map((d) => [String(d.id), `#${d.id} · ${d.title.slice(0, 38)}`])]}
              minMenuWidth=${240}
              onChange=${setLinkedDocId}
            />
          </div>
          <div className="qc-row">
            <span className="qc-row-lbl">Project tag</span>
            <${Select}
              variant="inline"
              ariaLabel="Project tag"
              value=${project}
              options=${[
                ['General', 'General'],
                ['C10_INTERIOR', 'C10_INTERIOR'],
                ...projects.filter((p) => p !== 'General' && p !== 'C10_INTERIOR').map((p) => [p, p]),
              ]}
              onChange=${setProject}
            />
          </div>
          ${kind === 'article' &&
          html`<div className="qc-row">
            <span className="qc-row-lbl">Cover image URL</span>
            <input
              type="url"
              placeholder="https://… (optional)"
              value=${cover}
              onChange=${(e) => setCover(e.target.value)}
              style=${{ textAlign: 'right', flex: 1, padding: '4px 0' }}
            />
          </div>`}
          ${kind === 'article' &&
          html`<div className="qc-row">
            <span className="qc-row-lbl">Read time</span>
            <input
              type="text"
              placeholder="3 min"
              value=${readTime}
              onChange=${(e) => setReadTime(e.target.value)}
              style=${{ textAlign: 'right', width: 90, padding: '4px 0' }}
            />
          </div>`}
          <div className="qc-row">
            <span className="qc-row-lbl">Pin as Featured</span>
            <button
              type="button"
              className=${'kspace-mini-btn' + (featured ? ' on' : '')}
              onClick=${() => setFeatured((v) => !v)}
            >
              ${featured ? 'Featured' : 'Standard'}
            </button>
          </div>
        </div>

        ${kind === 'update' &&
        html`<div className="qc-cell">
          <input
            type="text"
            placeholder="Code / naming pattern / parameter snippet (optional)…"
            value=${codeSnippet}
            onChange=${(e) => setCodeSnippet(e.target.value)}
            style=${{ fontFamily: 'ui-monospace, SFMono-Regular, monospace', fontSize: 12.5 }}
          />
        </div>`}

        <div className="qc-cell">
          <textarea
            rows="6"
            placeholder="Write your article paragraphs (prefix lines with > for quote cards)…"
            value=${bodyText}
            onChange=${(e) => setBodyText(e.target.value)}
            style=${{ minHeight: 130 }}
          />
        </div>
      </form>
    </div>`,
    document.body
  );
}

export function NewsfeedView({
  docs = [],
  scriptLinks = [],
  imgs = {},
  users = [],
  userName = '',
  role = 'Member',
  isGuest = false,
  effectiveLayer = 'all',
  projectFilter = 'all',
  externalQuery = '',
  activities = [],
  requiredIds = [],
  acks = [],
  favs = [],
  onAck,
  onToggleFav,
  onOpenDoc,
  onInspectDoc,
  onOpenNamingStudio,
  onSaveToNote,
  onSaveToTask,
  onOpenBrainSheet,
  onSelectViewMode,
  flash,
}) {
  const [catTab, setCatTab] = useState('all'); // 'all' | 'projects' | 'technical' | 'personalities' | 'company' | 'pulse' | 'saved'
  const [heroIdx, setHeroIdx] = useState(0);
  const [authorFilter, setAuthorFilter] = useState('');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'featured' | 'readtime'
  const [page, setPage] = useState(1);
  const [readingPostId, setReadingPostId] = useState(null);
  const [composerState, setComposerState] = useState(null);
  const [expandedDiffIds, setExpandedDiffIds] = useState(() => new Set());
  const [copiedCodeId, setCopiedCodeId] = useState(null);
  const gridTopRef = useRef(null);

  const [postOverrides, setPostOverrides] = useState(() =>
    db.load(STORAGE_POSTS_KEY, { custom: [], deletedIds: [] }) || { custom: [], deletedIds: [] }
  );
  const [metaState, setMetaState] = useState(() =>
    db.load(STORAGE_META_KEY, { reactions: {}, savedIds: [], comments: {} }) || {
      reactions: {},
      savedIds: [],
      comments: {},
    }
  );

  useEffect(() => {
    db.save(STORAGE_POSTS_KEY, postOverrides);
  }, [postOverrides]);

  useEffect(() => {
    db.save(STORAGE_META_KEY, metaState);
  }, [metaState]);

  useEffect(() => {
    setPage(1);
  }, [catTab, authorFilter, sortBy, effectiveLayer, projectFilter, externalQuery]);

  const docById = useMemo(() => new Map((docs || []).map((d) => [Number(d.id), d])), [docs]);
  const usersByName = useMemo(() => new Map((users || []).map((u) => [u.name, u])), [users]);

  const allNewsPosts = useMemo(() => {
    const deleted = new Set(postOverrides.deletedIds || []);
    const customMap = new Map((postOverrides.custom || []).map((p) => [p.id, p]));
    const base = [...QUICK_UPDATE_SEEDS, ...SEED_NEWS_POSTS]
      .filter((p) => !deleted.has(p.id))
      .map((p) => (customMap.has(p.id) ? customMap.get(p.id) : p));
    const extras = (postOverrides.custom || []).filter(
      (p) => !deleted.has(p.id) && ![...QUICK_UPDATE_SEEDS, ...SEED_NEWS_POSTS].some((b) => b.id === p.id)
    );
    return [...extras, ...base].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  }, [postOverrides]);

  // Live Datum KB Pulse entries (Approved Standards, Scripts & Tools, Starter Kits, Team Activities)
  const kbPulseEntries = useMemo(() => {
    const items = [];
    const standardDocs = (docs || [])
      .filter((d) => d && isDocType(d.type) && d.status === 'Approved' && d.title && String(d.title).trim())
      .sort((a, b) => String(b.upd || '').localeCompare(String(a.upd || '')))
      .slice(0, 10);

    standardDocs.forEach((doc) => {
      const diff = getDocDiffInfo(doc);
      const commentList = Array.isArray(doc.c) ? doc.c : [];
      items.push({
        id: `pulse-doc-${doc.id}`,
        feedType: 'standard-release',
        date: doc.upd || TODAY,
        author: diff.latestBy || doc.author || 'Planit Team',
        disc: doc.disc || 'VDC',
        project: doc.tags && doc.tags[0] ? doc.tags[0] : 'General',
        title: doc.title,
        summary: doc.desc || '',
        previewImg: extractDocCover(doc, imgs),
        diff,
        doc,
        commentCount: commentList.length,
        latestComment: commentList[commentList.length - 1] || null,
      });
    });

    (scriptLinks || []).slice(0, 4).forEach((entry) => {
      items.push({
        id: `pulse-script-${entry.id}`,
        feedType: 'script-release',
        date: (entry.upd || TODAY).slice(0, 10),
        author: entry.source === 'mine' ? userName || 'You' : entry.raw?.author || 'Andrii Lytvynov',
        disc: 'VDC',
        project: entry.project || 'General',
        title: entry.title,
        summary: entry.notes || entry.url || 'Automation script or resource link',
        snippet: entry.snippet || '',
        url: entry.url || '',
        entry,
      });
    });

    (activities || [])
      .filter((a) => a && a.targetTitle && !String(a.action || '').includes('Signed in'))
      .slice(0, 6)
      .forEach((act) => {
        const doc = act.targetType === 'item' ? docById.get(Number(act.targetId)) : null;
        items.push({
          id: `pulse-act-${act.id}`,
          feedType: 'activity',
          date: act.at || TODAY,
          author: act.actor || 'Team',
          disc: doc ? doc.disc : 'VDC',
          project: 'General',
          title: `${act.actor || 'Teammate'} ${String(act.action || '').toLowerCase()} “${act.targetTitle}”`,
          summary: act.note || (doc ? doc.desc : ''),
          doc,
          act,
        });
      });

    return items.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [docs, imgs, scriptLinks, activities, docById, userName]);

  const savedSet = useMemo(() => new Set(metaState.savedIds || []), [metaState.savedIds]);

  const getReactionState = (post) => {
    const entry = (metaState.reactions && metaState.reactions[post.id]) || null;
    if (entry) return entry;
    const seedCounts = post.featured ? { '🔥': 4, '👏': 3 } : {};
    return { counts: seedCounts, mine: [] };
  };

  const toggleReact = (postId, emoji) => {
    setMetaState((prev) => {
      const reactions = { ...(prev.reactions || {}) };
      const seedPost = allNewsPosts.find((p) => p.id === postId);
      const base = reactions[postId] || {
        counts: seedPost && seedPost.featured ? { '🔥': 4, '👏': 3 } : {},
        mine: [],
      };
      const mine = new Set(base.mine || []);
      const counts = { ...(base.counts || {}) };
      if (mine.has(emoji)) {
        mine.delete(emoji);
        counts[emoji] = Math.max(0, (counts[emoji] || 1) - 1);
      } else {
        mine.add(emoji);
        counts[emoji] = (counts[emoji] || 0) + 1;
      }
      reactions[postId] = { counts, mine: [...mine] };
      return { ...prev, reactions };
    });
  };

  const toggleSavePost = (postId) => {
    setMetaState((prev) => {
      const cur = Array.isArray(prev.savedIds) ? prev.savedIds : [];
      const next = cur.includes(postId) ? cur.filter((x) => x !== postId) : [postId, ...cur];
      return { ...prev, savedIds: next };
    });
  };

  const addPostComment = (postId, text) => {
    setMetaState((prev) => {
      const comments = { ...(prev.comments || {}) };
      const list = Array.isArray(comments[postId]) ? comments[postId] : [];
      comments[postId] = [
        ...list,
        { id: `nc-${Date.now().toString(36)}`, by: userName || 'Team', at: TODAY, text },
      ];
      return { ...prev, comments };
    });
  };

  const handleSaveCustomPost = (postObj) => {
    const fullPost = {
      ...postObj,
      author: postObj.author || userName || 'Team',
      dept: postObj.dept || 'VDC',
    };
    setPostOverrides((prev) => {
      const rest = (prev.custom || []).filter((x) => x.id !== fullPost.id);
      return {
        ...prev,
        custom: [fullPost, ...rest],
        deletedIds: (prev.deletedIds || []).filter((id) => id !== fullPost.id),
      };
    });
    flash && flash(postObj.id ? `Updated “${fullPost.title}”` : `Published “${fullPost.title}” to Newsfeed`);
  };

  const handleDeletePost = (postId) => {
    setPostOverrides((prev) => ({
      ...prev,
      custom: (prev.custom || []).filter((x) => x.id !== postId),
      deletedIds: [...new Set([...(prev.deletedIds || []), postId])],
    }));
    flash && flash('Post removed from Newsfeed');
  };

  const activeProjects = useMemo(() => {
    const s = new Set(['C10_INTERIOR']);
    allNewsPosts.forEach((p) => p.project && p.project !== 'General' && s.add(p.project));
    return [...s].sort();
  }, [allNewsPosts]);

  const qTrim = String(externalQuery || '').trim();
  const qLow = qTrim.toLowerCase();
  const activeProjLow = projectFilter && projectFilter !== 'all' ? projectFilter.trim().toLowerCase() : '';
  const userLow = String(userName || '').trim().toLowerCase();

  const matchesText = (obj) => {
    if (authorFilter && String(obj.author || '') !== authorFilter) return false;
    if (effectiveLayer === 'mine') {
      const isMineAuthor = userLow && String(obj.author || '').toLowerCase() === userLow;
      const isSaved = obj.id && savedSet.has(obj.id);
      if (!isMineAuthor && !isSaved) return false;
    }
    if (activeProjLow) {
      const hayProj = `${obj.project || ''} ${obj.title || ''} ${obj.summary || ''} ${(obj.tags || []).join(' ')}`.toLowerCase();
      if (!hayProj.includes(activeProjLow)) return false;
    }
    if (qLow) {
      const hayAll = `${obj.title || ''} ${obj.summary || ''} ${obj.author || ''} ${obj.category || ''} ${obj.disc || ''} ${(obj.tags || []).join(' ')} ${plain(obj.bodyHtml || '').slice(0, 2000)}`.toLowerCase();
      if (!hayAll.includes(qLow)) return false;
    }
    return true;
  };

  const filteredPosts = useMemo(() => {
    return allNewsPosts
      .filter((p) => {
        if (catTab === 'pulse') return false;
        if (catTab === 'saved') return savedSet.has(p.id);
        if (catTab !== 'all' && p.category !== catTab) return false;
        return true;
      })
      .filter(matchesText);
  }, [allNewsPosts, catTab, savedSet, authorFilter, effectiveLayer, userLow, activeProjLow, qLow]);

  const filteredPulse = useMemo(() => {
    const quickUpdates = allNewsPosts
      .filter((p) => p.kind === 'update')
      .filter(matchesText)
      .map((p) => ({
        id: p.id,
        feedType: 'quick-update',
        date: p.date,
        pinned: Boolean(p.pinned),
        post: p,
      }));
    const pulseMatched = kbPulseEntries.filter(matchesText);
    return [...quickUpdates, ...pulseMatched].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
  }, [allNewsPosts, kbPulseEntries, authorFilter, effectiveLayer, userLow, activeProjLow, qLow]);

  const showHeroBanner =
    catTab !== 'pulse' &&
    catTab !== 'saved' &&
    !qLow &&
    !authorFilter &&
    !activeProjLow &&
    effectiveLayer !== 'mine';

  // Top 4 Hero Slides using clean, un-texted wide photography (Horizone Blog pattern)
  const featuredStories = useMemo(() => {
    const pool = allNewsPosts.filter((p) => p.kind !== 'update' && (p.cover || findCleanBackdrop(p).isCleanPhoto));
    const sorted = [...pool].sort((a, b) => {
      const aClean = findCleanBackdrop(a).isCleanPhoto ? 1 : 0;
      const bClean = findCleanBackdrop(b).isCleanPhoto ? 1 : 0;
      if (aClean !== bClean) return bClean - aClean;
      const aProj = a.category === 'projects' && a.featured ? 1 : 0;
      const bProj = b.category === 'projects' && b.featured ? 1 : 0;
      if (aProj !== bProj) return bProj - aProj;
      if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
      return String(b.date || '').localeCompare(String(a.date || ''));
    });
    return sorted.slice(0, 4);
  }, [allNewsPosts]);

  const safeHeroIdx = featuredStories.length ? heroIdx % featuredStories.length : 0;
  const activeHeroPost = featuredStories[safeHeroIdx] || null;

  // Editorial 3x3 Grid Stories (excludes quick updates unless viewing Saved; excludes Hero slides on 'all')
  const gridStories = useMemo(() => {
    const heroIds =
      showHeroBanner && catTab === 'all' ? new Set(featuredStories.map((x) => x.id)) : new Set();
    const base = filteredPosts.filter(
      (p) => (catTab === 'saved' ? true : p.kind !== 'update') && !heroIds.has(p.id)
    );
    if (sortBy === 'featured') {
      return [...base].sort((a, b) => {
        if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
        return String(b.date || '').localeCompare(String(a.date || ''));
      });
    }
    if (sortBy === 'readtime') {
      return [...base].sort((a, b) => {
        const diff = parseReadMinutes(b.readTime) - parseReadMinutes(a.readTime);
        if (diff !== 0) return diff;
        return String(b.date || '').localeCompare(String(a.date || ''));
      });
    }
    return base;
  }, [filteredPosts, showHeroBanner, catTab, featuredStories, sortBy]);

  const totalPages = Math.max(1, Math.ceil(gridStories.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visibleGridStories = gridStories.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageNumbers = useMemo(() => getPageNumbers(safePage, totalPages), [safePage, totalPages]);

  const readingPost = useMemo(
    () => (readingPostId ? allNewsPosts.find((p) => p.id === readingPostId) || null : null),
    [readingPostId, allNewsPosts]
  );

  const canCreateOrEdit = role !== 'Guest' && !isGuest;

  const goToPage = (nextPage) => {
    const clamped = Math.max(1, Math.min(nextPage, totalPages));
    setPage(clamped);
    if (gridTopRef.current && gridTopRef.current.scrollIntoView) {
      gridTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const copySnippetText = (id, text) => {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId((cur) => (cur === id ? null : cur)), 1600);
    flash && flash('Copied to clipboard');
  };

  const savePostToNote = (post) => {
    if (isGuest) return;
    const linkedIds = Array.isArray(post.linkedDocIds) ? post.linkedDocIds : [];
    const payload = {
      mode: 'note',
      doc: linkedIds[0] ? docById.get(Number(linkedIds[0])) || null : null,
      note: {
        title: post.title,
        body: `${post.summary || ''}\n\n— ${post.author || 'Planit Team'} (${post.date || TODAY})`,
        project: post.project && post.project !== 'General' ? post.project : 'General',
        isPinned: false,
        linkedItemIds: linkedIds,
      },
    };
    if (onOpenBrainSheet) onOpenBrainSheet(payload);
    else if (onSaveToNote) onSaveToNote(payload.note);
  };

  const savePostToTask = (post) => {
    if (isGuest) return;
    const linkedIds = Array.isArray(post.linkedDocIds) ? post.linkedDocIds : [];
    const firstDoc = linkedIds[0] ? docById.get(Number(linkedIds[0])) || null : null;
    const payload = {
      mode: 'task',
      doc: firstDoc,
      task: {
        title: `Follow up: ${String(post.title || '').slice(0, 72)}`,
        notes: `${post.summary || ''}`.slice(0, 500),
        project: post.project && post.project !== 'General' ? post.project : 'General',
        dueDate: TODAY,
        linkedItemId: firstDoc ? firstDoc.id : null,
        linkedItemTitle: firstDoc ? firstDoc.title : '',
      },
    };
    if (onOpenBrainSheet) onOpenBrainSheet(payload);
    else if (onSaveToTask) onSaveToTask(payload.task);
  };

  const toggleDiffExpand = (id) => {
    setExpandedDiffIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderStoryCard = (p) => {
    const cat = CAT_BY_ID.get(p.category) || NEWS_CATEGORIES[3];
    const isSaved = savedSet.has(p.id);
    const authorUser = usersByName.get(p.author);
    return html`<article
      key=${p.id}
      className="nf-story-card"
      role="button"
      tabIndex="0"
      onClick=${(e) => {
        if (e.target.closest('button')) return;
        setReadingPostId(p.id);
      }}
      onKeyDown=${(e) => e.key === 'Enter' && setReadingPostId(p.id)}
    >
      <div className="nf-story-media" style=${{ '--cc': p.accentColor || cat.color }}>
        ${p.cover
          ? html`<img src=${p.cover} alt=${p.title} loading="lazy" />`
          : html`<div className="nf-fallback-cover" style=${{ '--cc': p.accentColor || cat.color }}>
              <${DatumMark} s=${26} />
              <span>${cat.label}</span>
            </div>`}
        <span className="nf-media-cat">${cat.label}</span>
        <div className="nf-media-top-right">
          ${!isGuest &&
          html`<button
            type="button"
            className=${'nf-story-save' + (isSaved ? ' on' : '')}
            aria-label=${isSaved ? 'Remove bookmark' : 'Save story'}
            onClick=${(e) => {
              e.stopPropagation();
              toggleSavePost(p.id);
            }}
          >
            <${Ic} n="star" s=${13} f=${isSaved} />
          </button>`}
          <span className="nf-media-arrow" aria-hidden="true">↗</span>
        </div>
      </div>

      <div className="nf-story-body">
        <div className="nf-story-meta">
          <span>${fmt(p.date)}</span>
          ${p.readTime &&
          html`<${Fragment}>
            <span className="nf-meta-dot">•</span>
            <span>${p.readTime} read</span>
          </${Fragment}>`}
        </div>
        <h3>${p.title}</h3>
        <p>${p.summary}</p>
        <div className="nf-story-foot">
          <button
            type="button"
            className="nf-story-author"
            title="Filter by author"
            onClick=${(e) => {
              e.stopPropagation();
              p.author && setAuthorFilter((cur) => (cur === p.author ? '' : p.author));
            }}
          >
            <${Avatar} user=${authorUser} name=${p.author} size="sm" />
            <span>${p.author}</span>
          </button>
        </div>
      </div>
    </article>`;
  };

  const activeCategoryObj = CAT_BY_ID.get(catTab);
  const gridHeading =
    catTab === 'pulse'
      ? 'Workspace Pulse'
      : catTab === 'saved'
      ? 'Saved Stories'
      : authorFilter
      ? `Stories by ${authorFilter}`
      : qTrim
      ? `Results for “${qTrim}”`
      : activeCategoryObj
      ? activeCategoryObj.label
      : 'Blog & Stories';

  const gridSubtitle =
    catTab === 'pulse'
      ? 'Live standard revisions, Revit automation releases, and team activity.'
      : authorFilter
      ? `${gridStories.length} published ${gridStories.length === 1 ? 'story' : 'stories'} by ${authorFilter} · Click again to reset.`
      : 'Behind-the-scenes project case studies, BIM engineering workflows, and team stories from across Planit.';

  return html`<div className="nf-shell">
    ${showHeroBanner &&
    activeHeroPost &&
    (() => {
      const p = activeHeroPost;
      const cat = CAT_BY_ID.get(p.category) || NEWS_CATEGORIES[0];
      const authorUser = usersByName.get(p.author);
      const isSaved = savedSet.has(p.id);
      const backdropSrc = resolveHeroBackdrop(p);
      return html`<section
        className="nf-hero-banner"
        aria-label="Featured editorial story"
        role="button"
        tabIndex="0"
        onClick=${(e) => {
          if (e.target.closest('button')) return;
          setReadingPostId(p.id);
        }}
        onKeyDown=${(e) => {
          if (e.key === 'Enter' && !e.target.closest('button')) setReadingPostId(p.id);
        }}
      >
        <img className="nf-hero-img" src=${backdropSrc} alt=${p.title} />
        <div className="nf-hero-shade" aria-hidden="true" />

        ${!isGuest &&
        html`<button
          type="button"
          className=${'nf-hero-save' + (isSaved ? ' on' : '')}
          aria-label=${isSaved ? 'Remove bookmark' : 'Save featured story'}
          onClick=${(e) => {
            e.stopPropagation();
            toggleSavePost(p.id);
          }}
        >
          <${Ic} n="star" s=${15} f=${isSaved} />
        </button>`}

        <div className="nf-hero-overlay">
          <div className="nf-hero-left">
            <span className="nf-hero-cat">${cat.label}</span>
            <h1>${p.title}</h1>
            <p>${p.summary}</p>
            ${featuredStories.length > 1 &&
            html`<div className="nf-hero-pager" role="group" aria-label="Featured story slides">
              <div className="nf-hero-dots" role="tablist" aria-label="Select featured story">
                ${featuredStories.map(
                  (fs, idx) => html`<button
                    key=${fs.id}
                    type="button"
                    role="tab"
                    aria-selected=${idx === safeHeroIdx}
                    aria-label=${`Featured story ${idx + 1}: ${fs.title}`}
                    className=${'nf-hero-dot' + (idx === safeHeroIdx ? ' on' : '')}
                    onClick=${(e) => {
                      e.stopPropagation();
                      setHeroIdx(idx);
                    }}
                  />`
                )}
              </div>
              <div className="nf-hero-arrows">
                <button
                  type="button"
                  className="nf-hero-arrow prev"
                  aria-label="Previous featured story"
                  onClick=${(e) => {
                    e.stopPropagation();
                    setHeroIdx((i) => (i - 1 + featuredStories.length) % featuredStories.length);
                  }}
                >
                  <${Ic} n="chev" s=${13} />
                </button>
                <button
                  type="button"
                  className="nf-hero-arrow next"
                  aria-label="Next featured story"
                  onClick=${(e) => {
                    e.stopPropagation();
                    setHeroIdx((i) => (i + 1) % featuredStories.length);
                  }}
                >
                  <${Ic} n="chev" s=${13} />
                </button>
              </div>
            </div>`}
          </div>

          <div className="nf-hero-right">
            <button
              type="button"
              className="nf-hero-author"
              title="Filter by author"
              onClick=${(e) => {
                e.stopPropagation();
                p.author && setAuthorFilter((cur) => (cur === p.author ? '' : p.author));
              }}
            >
              <${Avatar} user=${authorUser} name=${p.author} size="sm" />
              <b>${p.author}</b>
            </button>
            <div className="nf-hero-date">
              ${fmt(p.date)}${p.readTime ? ` • ${p.readTime} read` : ''}
            </div>
          </div>
        </div>
      </section>`;
    })()}

    <header ref=${gridTopRef} className="nf-blog-head">
      <div className="nf-blog-head-left">
        <h2>${gridHeading}</h2>
        <p className="nf-blog-sub">${gridSubtitle}</p>
      </div>

      ${authorFilter &&
      html`<div className="nf-head-acts">
        <button
          type="button"
          className="nf-filter-tag"
          onClick=${() => setAuthorFilter('')}
          title="Clear author filter"
        >
          <span>${authorFilter}</span>
          <${Ic} n="x" s=${11} />
        </button>
      </div>`}
    </header>

    <div className="nf-toolbar">
      <div className="nf-tabs" role="tablist" aria-label="Newsfeed categories">
        ${[
          ['all', 'All'],
          ['projects', 'Projects'],
          ['technical', 'Tech & Tools'],
          ['personalities', 'People & Inside'],
          ['company', 'Company'],
          ['pulse', 'KB Pulse'],
          ...(!isGuest ? [['saved', 'Saved']] : []),
        ].map(
          ([k, lbl]) => html`<button
            key=${k}
            type="button"
            role="tab"
            aria-selected=${catTab === k}
            className=${'nf-tab' + (catTab === k ? ' on' : '')}
            onClick=${() => setCatTab(k)}
          >
            ${lbl}
          </button>`
        )}
      </div>

      <div className="nf-sort-bar">
        ${catTab !== 'pulse' &&
        html`<div className="nf-sort-wrap">
          <span className="nf-sort-lbl">Sort by:</span>
          <${Select}
            variant="sort"
            className="nf-sort-asel"
            ariaLabel="Sort stories"
            value=${sortBy}
            options=${[
              ['newest', 'Newest'],
              ['featured', 'Featured'],
              ['readtime', 'Read time'],
            ]}
            minMenuWidth=${140}
            onChange=${(v) => setSortBy(v || 'newest')}
          />
        </div>`}

        ${canCreateOrEdit &&
        html`<button
          type="button"
          className="btn sm p nf-new-btn"
          onClick=${() => setComposerState({ post: null })}
        >
          <${Ic} n="plus" s=${14} />
          <span>New Post</span>
        </button>`}
      </div>
    </div>

    ${catTab === 'pulse'
      ? html`<section className="nf-pulse-sec" aria-label="Workspace Knowledge Base Pulse">
          ${filteredPulse.length > 0
            ? html`<div className="nf-pulse-stream">
                ${filteredPulse.map((entry) => {
                  if (entry.feedType === 'quick-update') {
                    const p = entry.post;
                    const cat = CAT_BY_ID.get(p.category) || NEWS_CATEGORIES[1];
                    const linked = (p.linkedDocIds || []).map((id) => docById.get(Number(id))).filter(Boolean);
                    const authorUser = usersByName.get(p.author);
                    return html`<article key=${p.id} className="nf-pulse-row is-update">
                      <div className="nf-pulse-row-top">
                        <div className="nf-author-mini">
                          <${Avatar} user=${authorUser} name=${p.author} size="sm" />
                          <span><b>${p.author}</b> · ${p.dept || 'Team'} · ${fmt(p.date)}</span>
                        </div>
                        <span className="nf-cat-pill" style=${{ '--cc': cat.color }}>${cat.label}</span>
                      </div>
                      <h3 onClick=${() => setReadingPostId(p.id)}>${p.title}</h3>
                      <p>${p.summary}</p>
                      ${p.codeSnippet &&
                      html`<div className="nf-snippet-row">
                        <code>${p.codeSnippet}</code>
                        <button
                          type="button"
                          className="kspace-mini-btn"
                          onClick=${() => copySnippetText(p.id, p.codeSnippet)}
                        >
                          ${copiedCodeId === p.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>`}
                      <div className="nf-pulse-row-foot">
                        <div className="nf-hero-tags">
                          ${linked.map(
                            (d) => html`<button
                              key=${d.id}
                              type="button"
                              className="nf-tag-lk"
                              onClick=${() => onOpenDoc && onOpenDoc(d.id)}
                            >
                              #${d.id} · ${d.title}
                            </button>`
                          )}
                        </div>
                        ${p.id === 'news-update-naming-137' &&
                        onOpenNamingStudio &&
                        html`<button type="button" className="btn sm p" onClick=${() => onOpenNamingStudio('')}>
                          Naming Studio ↗
                        </button>`}
                      </div>
                    </article>`;
                  }

                  if (entry.feedType === 'standard-release') {
                    const { doc, diff, previewImg, commentCount, latestComment } = entry;
                    const isExpanded = expandedDiffIds.has(entry.id);
                    const isBookmarked = favs.includes(doc.id);
                    return html`<article key=${entry.id} className="nf-pulse-row">
                      <div className="nf-pulse-row-top">
                        <div className="nf-pulse-id">
                          <span className="nf-pulse-tag">Standard · ${diff.verLabel}</span>
                          <span className="nf-cat-pill" style=${{ '--cc': DC[doc.disc] || '#0a84ff' }}>${doc.disc}</span>
                          <span className="nf-meta-txt">${fmt(doc.upd)}</span>
                        </div>
                        <${Pill} s=${doc.status} />
                      </div>
                      <div className=${'nf-pulse-grid' + (previewImg ? ' has-img' : '')}>
                        <div className="nf-pulse-body">
                          <h3 onClick=${() => onOpenDoc && onOpenDoc(doc.id)}>${doc.title}</h3>
                          <p>${doc.desc || diff.latestNote}</p>
                          ${(diff.latestNote || diff.changedLines.length > 0) &&
                          html`<button
                            type="button"
                            className=${'nf-diff-toggle' + (isExpanded ? ' on' : '')}
                            onClick=${() => toggleDiffExpand(entry.id)}
                          >
                            <span>What changed in ${diff.verLabel}</span>
                            <${Ic} n="chev" s=${11} />
                          </button>`}
                          ${isExpanded &&
                          html`<div className="nf-diff-box">
                            <div className="nf-diff-meta">
                              <strong>${diff.latestBy || doc.author}</strong> · ${diff.latestNote}
                            </div>
                            ${diff.changedLines.length > 0 &&
                            html`<ul>
                              ${diff.changedLines.map((line, i) => html`<li key=${i}>${line}</li>`)}
                            </ul>`}
                          </div>`}
                          ${latestComment &&
                          html`<div className="nf-pulse-cmt">
                            <b>${latestComment.by || 'Team'}:</b> ${latestComment.txt || latestComment.text || ''}
                          </div>`}
                        </div>
                        ${previewImg &&
                        html`<div className="nf-pulse-thumb" onClick=${() => onOpenDoc && onOpenDoc(doc.id)}>
                          <img src=${previewImg} alt=${doc.title} loading="lazy" />
                        </div>`}
                      </div>
                      <div className="nf-pulse-row-foot">
                        <span className="nf-meta-txt">
                          By ${diff.latestBy || doc.author || 'Owner'}${commentCount > 0 ? ` · ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}` : ''}
                        </span>
                        <div className="nf-pulse-acts">
                          ${!isGuest &&
                          onToggleFav &&
                          html`<button
                            type="button"
                            className=${'kspace-mini-btn' + (isBookmarked ? ' on' : '')}
                            onClick=${() => onToggleFav(doc.id)}
                          >
                            <${Ic} n="star" s=${11} f=${isBookmarked} />
                          </button>`}
                          <button type="button" className="btn sm p" onClick=${() => onOpenDoc && onOpenDoc(doc.id)}>
                            Open Standard ↗
                          </button>
                        </div>
                      </div>
                    </article>`;
                  }

                  if (entry.feedType === 'script-release') {
                    const { entry: sc, snippet, url } = entry;
                    const copyTarget = snippet || url || sc.notes || '';
                    return html`<article key=${entry.id} className="nf-pulse-row">
                      <div className="nf-pulse-row-top">
                        <div className="nf-pulse-id">
                          <span className="nf-pulse-tag is-scr">Script & Tool</span>
                          <span className="nf-meta-txt">${sc.project || 'VDC'} · ${fmt(entry.date)}</span>
                        </div>
                        <div className="nf-pulse-acts">
                          ${copyTarget &&
                          html`<button
                            type="button"
                            className="kspace-mini-btn"
                            onClick=${() => copySnippetText(entry.id, copyTarget)}
                          >
                            ${copiedCodeId === entry.id ? 'Copied!' : 'Copy Script'}
                          </button>`}
                          ${sc.source === 'team' &&
                          onOpenDoc &&
                          html`<button type="button" className="btn sm p" onClick=${() => onOpenDoc(sc.rawId)}>
                            Open ↗
                          </button>`}
                        </div>
                      </div>
                      <h3>${sc.title}</h3>
                      <p>${sc.notes || sc.url || 'Workspace automation resource'}</p>
                      ${snippet &&
                      html`<div className="nf-snippet-row">
                        <code>${snippet.split('\n').slice(0, 2).join(' · ')}</code>
                      </div>`}
                    </article>`;
                  }

                  return html`<article key=${entry.id} className="nf-act-row">
                    <i className="pl-std-dot" style=${{ background: DC[entry.disc] || 'var(--blue)' }} />
                    <div className="nf-act-mid">
                      <b>${entry.title}</b>
                      <span>${entry.summary || fmt(entry.date)}</span>
                    </div>
                    ${entry.doc &&
                    onOpenDoc &&
                    html`<button type="button" className="kspace-mini-btn" onClick=${() => onOpenDoc(entry.doc.id)}>
                      Open ↗
                    </button>`}
                  </article>`;
                })}
              </div>`
            : html`<div className="empty" style=${{ padding: '64px 20px' }}>
                <${Ic} n="feed" s=${30} />
                <b>No workspace updates match your filter</b>
              </div>`}
        </section>`
      : html`<section className="nf-grid-sec" aria-label=${gridHeading}>
          ${visibleGridStories.length > 0
            ? html`<div className="nf-stories-grid">
                ${visibleGridStories.map((p) => renderStoryCard(p))}
              </div>`
            : html`<div className="empty" style=${{ padding: '64px 20px' }}>
                <${Ic} n="feed" s=${32} />
                <b>No stories match this filter</b>
                <span>Try switching categories, clearing search, or publish a new update for the team.</span>
                <div style=${{ display: 'flex', gap: 8, marginTop: 10 }}>
                  ${(catTab !== 'all' || authorFilter) &&
                  html`<button
                    type="button"
                    className="btn"
                    onClick=${() => {
                      setCatTab('all');
                      setAuthorFilter('');
                    }}
                  >
                    Show all
                  </button>`}
                  ${canCreateOrEdit &&
                  html`<button type="button" className="btn p" onClick=${() => setComposerState({ post: null })}>
                    <${Ic} n="plus" s=${14} /> New Post
                  </button>`}
                </div>
              </div>`}

          ${totalPages > 1 &&
          html`<nav className="nf-pagination" aria-label="Newsfeed pages">
            <button
              type="button"
              className="nf-page-btn nf-page-nav prev"
              aria-label="Previous page"
              disabled=${safePage <= 1}
              onClick=${() => goToPage(safePage - 1)}
            >
              <${Ic} n="chev" s=${13} />
            </button>
            ${pageNumbers.map((item, idx) =>
              item === '…'
                ? html`<span key=${`dots-${idx}`} className="nf-page-dots" aria-hidden="true">…</span>`
                : html`<button
                    key=${item}
                    type="button"
                    aria-current=${item === safePage ? 'page' : undefined}
                    className=${'nf-page-btn' + (item === safePage ? ' on' : '')}
                    onClick=${() => goToPage(item)}
                  >
                    ${item}
                  </button>`
            )}
            <button
              type="button"
              className="nf-page-btn nf-page-nav next"
              aria-label="Next page"
              disabled=${safePage >= totalPages}
              onClick=${() => goToPage(safePage + 1)}
            >
              <${Ic} n="chev" s=${13} />
            </button>
          </nav>`}

          <section className="nf-bottom-bento" aria-label="Editorial highlights">
            <div className="nf-bento-col">
              <div className="nf-bento-dark">
                <div className="nf-bento-ico">
                  <${Ic} n="pencil" s=${16} />
                </div>
                <h3>Share a team story or project milestone</h3>
                <p>Publish a Behind the Project case study, career milestone, or engineering insight for the team.</p>
                <button
                  type="button"
                  className="nf-bento-cta"
                  onClick=${() => {
                    if (canCreateOrEdit) {
                      setComposerState({ post: null });
                    } else if (gridTopRef.current && gridTopRef.current.scrollIntoView) {
                      gridTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                >
                  <span>Write a Story</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>

              <div
                className="nf-bento-stat"
                role="button"
                tabIndex="0"
                onClick=${() => {
                  setCatTab('all');
                  goToPage(1);
                }}
                onKeyDown=${(e) => e.key === 'Enter' && setCatTab('all')}
              >
                <img src=${BENTO_STAT_PHOTO} alt="" loading="lazy" />
                <div className="nf-bento-stat-shade" aria-hidden="true" />
                <div className="nf-bento-stat-in">
                  <span>Published Stories & Case Studies</span>
                  <strong>${allNewsPosts.length}</strong>
                </div>
              </div>
            </div>

            <div className="nf-bento-wide">
              <img src=${BENTO_WIDE_PHOTO} alt="" loading="lazy" />
              <div className="nf-bento-wide-shade" aria-hidden="true" />
              <div className="nf-bento-wide-in">
                <h3>Behind the Project — how our teams coordinate and deliver landmark buildings</h3>
                <button
                  type="button"
                  className="nf-bento-wide-cta"
                  onClick=${() => {
                    setCatTab('projects');
                    if (gridTopRef.current && gridTopRef.current.scrollIntoView) {
                      gridTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }}
                >
                  <span>Explore Project Stories</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </div>
          </section>
        </section>`}

    <${ArticleReaderModal}
      post=${readingPost}
      allPosts=${allNewsPosts}
      docById=${docById}
      usersByName=${usersByName}
      imgs=${imgs}
      reactionState=${readingPost ? getReactionState(readingPost) : undefined}
      isSaved=${readingPost ? savedSet.has(readingPost.id) : false}
      comments=${readingPost ? (metaState.comments && metaState.comments[readingPost.id]) || [] : []}
      isGuest=${isGuest}
      canEdit=${Boolean(
        readingPost &&
          !isGuest &&
          (role === 'SuperAdmin' || role === 'Admin' || readingPost.author === userName || String(readingPost.id).startsWith('news-custom-'))
      )}
      onToggleReact=${toggleReact}
      onToggleSave=${toggleSavePost}
      onAddComment=${addPostComment}
      onOpenDoc=${onOpenDoc}
      onInspectDoc=${onInspectDoc}
      onSaveToNote=${savePostToNote}
      onSaveToTask=${savePostToTask}
      onEditPost=${(p) => {
        setReadingPostId(null);
        setComposerState({ post: p });
      }}
      onDeletePost=${handleDeletePost}
      onSelectPost=${(rp) => setReadingPostId(rp.id)}
      onClose=${() => setReadingPostId(null)}
    />

    <${NewsComposerModal}
      open=${Boolean(composerState)}
      initialPost=${composerState ? composerState.post : null}
      docs=${docs}
      projects=${activeProjects}
      onClose=${() => setComposerState(null)}
      onSave=${handleSaveCustomPost}
    />
  </div>`;
}
