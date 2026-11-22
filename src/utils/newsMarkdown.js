import { STG, DISC, TODAY } from '../config/constants.js';
import { SEED_NEWS_POSTS, QUICK_UPDATE_SEEDS } from '../data/newsPosts.js';
import { md, inl, plain } from './markdown.js';

export const NEWS_SEED_ID_BASE = 10000;

const WEBFLOW_QUOTE_IMG_RE = /_Quote(?:%20|\s|\(|\)|_|\d)*\.(?:jpg|jpeg|png|webp)$/i;
const MD_IMAGE_LINE_RE = /^!\[([^\]]*)\]\((img:\w+|(?:https?:\/\/|data:image\/)(?:[^\s|()]|\([^)\s]*\))+)(?:\|(\d+))?\)\s*$/;

export function isWebflowQuoteGraphic(src = '') {
  return WEBFLOW_QUOTE_IMG_RE.test(String(src || '').trim());
}

export function resolveMediaUrl(src = '', imgs = {}) {
  const s = String(src || '').trim();
  if (!s) return '';
  if (s.startsWith('img:')) {
    const id = s.slice(4);
    return (imgs && imgs[id]) || '';
  }
  return s;
}

export function estimateReadTime(text = '') {
  const stripped = plain(String(text || '').replace(/<[^>]+>/g, ' '));
  const words = stripped ? stripped.split(/\s+/).filter(Boolean).length : 0;
  return `${Math.max(1, Math.round(words / 180))} min`;
}

export function extractLinkedDocIds(markdown = '') {
  const ids = [];
  const seen = new Set();
  const re = /\[\[[^|\]]+\|(\d+)\]\]/g;
  let m;
  while ((m = re.exec(String(markdown || ''))) !== null) {
    const id = Number(m[1]);
    if (Number.isFinite(id) && !seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export function cleanCaptionMarker(raw = '') {
  return String(raw || '')
    .replace(/\[(single|slide-[^\]]+|comment-[^\]]+|video)\]/gi, '')
    .replace(/\u200d|\u00a0/g, ' ')
    .replace(/^\s*\|\s*/, '')
    .trim();
}

export function extractQuoteBlockData(bqEl, pendingPhoto = '') {
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
  if (/<p[\s>]/i.test(workingHtml) && typeof DOMParser !== 'undefined') {
    const tmpDoc = new DOMParser().parseFromString(workingHtml, 'text/html');
    paragraphs = Array.from(tmpDoc.body.children)
      .map((el) => sanitizeNodeLinks(el).trim())
      .filter(Boolean);
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
        const cleaned = chunk.replace(/<\/?em>/gi, (tag, _off, str) => {
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

export function sanitizeNodeLinks(node) {
  const clone = node.cloneNode(true);
  if (clone.querySelectorAll) {
    clone.querySelectorAll('a').forEach((a) => {
      const href = a.getAttribute('href') || '';
      if (/^https?:/i.test(href) || /^mailto:/i.test(href)) {
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }
  return clone.outerHTML || '';
}

export function parseListFeatureItems(ulNode) {
  if (!ulNode || ulNode.querySelector('ul, ol')) return null;
  const lis = Array.from(ulNode.children).filter((el) => el.tagName && el.tagName.toLowerCase() === 'li');
  if (lis.length < 2 || lis.length > 8) return null;

  const items = lis.map((li) => {
    const clone = li.cloneNode(true);
    if (clone.querySelectorAll) {
      clone.querySelectorAll('a').forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (/^https?:/i.test(href) || /^mailto:/i.test(href)) {
          a.setAttribute('target', '_blank');
          a.setAttribute('rel', 'noopener noreferrer');
        }
      });
    }

    let title = '';
    const firstEl = clone.firstElementChild;
    const onlyWhitespaceBefore =
      firstEl &&
      (!firstEl.previousSibling ||
        (firstEl.previousSibling.nodeType === 3 && !firstEl.previousSibling.textContent.trim()));
    if (firstEl && onlyWhitespaceBefore && /^(strong|b)$/i.test(firstEl.tagName)) {
      title = (firstEl.textContent || '').replace(/\u200d|\u00a0/g, ' ').replace(/[:\s]+$/, '').trim();
      firstEl.remove();
    }

    const bodyHtml = (clone.innerHTML || '')
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

function inlineNodeToMarkdown(node) {
  if (!node) return '';
  if (node.nodeType === 3) return node.nodeValue.replace(/\u200d|\u00a0/g, ' ');
  if (node.nodeType !== 1) return '';
  const tag = node.tagName.toLowerCase();
  if (tag === 'br') return '\n';
  let inner = Array.from(node.childNodes).map(inlineNodeToMarkdown).join('');
  if (tag === 'strong' || tag === 'b') {
    const t = inner.trim();
    return t ? `**${t}**` : '';
  }
  if (tag === 'em' || tag === 'i') {
    const t = inner.trim();
    return t ? `*${t}*` : '';
  }
  if (tag === 'code') {
    const t = inner.trim();
    return t ? '`' + t + '`' : '';
  }
  if (tag === 'a') {
    const href = node.getAttribute('href') || '';
    const wid = node.getAttribute('data-wiki-id');
    const lbl = inner.trim() || href;
    if (wid) return `[[${lbl}|${wid}]]`;
    if (href) return `[${lbl}](${href})`;
    return lbl;
  }
  return inner;
}

function pElementToMarkdown(pEl) {
  if (!pEl) return '';
  const nonEmpty = Array.from(pEl.childNodes).filter(
    (n) => !(n.nodeType === 3 && !n.nodeValue.replace(/\u200d|\u00a0/g, '').trim())
  );
  if (
    nonEmpty.length === 1 &&
    nonEmpty[0].nodeType === 1 &&
    /^(em|i)$/i.test(nonEmpty[0].tagName)
  ) {
    const txt = nonEmpty[0].textContent.replace(/\u200d|\u00a0/g, ' ').trim();
    if (!(txt.length < 60 && /^[-–—]/.test(txt))) {
      return Array.from(nonEmpty[0].childNodes).map(inlineNodeToMarkdown).join('').replace(/\s+/g, ' ').trim();
    }
  }
  return Array.from(pEl.childNodes)
    .map(inlineNodeToMarkdown)
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export function isQuestionHeadingNode(node) {
  if (!node || node.nodeType !== 1) return null;
  const tag = node.tagName.toLowerCase();
  const txt = (node.textContent || '').replace(/\u200d|\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
  if (!txt) return null;
  if (/^h[2-5]$/.test(tag)) {
    return { level: tag, text: txt, isQuestion: /\?\s*$/.test(txt) };
  }
  if (tag === 'p') {
    const nonEmpty = Array.from(node.childNodes).filter(
      (n) => !(n.nodeType === 3 && !n.nodeValue.replace(/\u200d|\u00a0/g, '').trim())
    );
    if (
      nonEmpty.length === 1 &&
      nonEmpty[0].nodeType === 1 &&
      /^(strong|b)$/i.test(nonEmpty[0].tagName) &&
      !node.querySelector('a') &&
      txt.length <= 140 &&
      !/[.!]$/.test(txt)
    ) {
      return { level: 'h3', text: txt, isQuestion: /\?\s*$/.test(txt) };
    }
  }
  return null;
}

export function htmlToNewsMarkdown(bodyHtml = '') {
  const raw = String(bodyHtml || '').trim();
  if (!raw) return '';
  if (!/<[a-z][\s\S]*>/i.test(raw)) return raw;
  if (typeof DOMParser === 'undefined') {
    return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const doc = new DOMParser().parseFromString(raw, 'text/html');
  const children = Array.from(doc.body.childNodes);
  const out = [];
  let pendingPhoto = '';

  const flushPhotoIfUnused = () => {
    if (pendingPhoto) {
      out.push(`![](${pendingPhoto})`);
      pendingPhoto = '';
    }
  };

  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.nodeType === 3) {
      const txt = node.nodeValue.replace(/\u200d|\u00a0/g, ' ').trim();
      if (txt) {
        flushPhotoIfUnused();
        out.push(txt);
      }
      continue;
    }
    if (node.nodeType !== 1) continue;
    const tag = node.tagName.toLowerCase();

    if (tag === 'figure') {
      const iframe = node.querySelector('iframe');
      if (iframe && iframe.getAttribute('src')) {
        flushPhotoIfUnused();
        out.push(`[${iframe.getAttribute('title') || 'Watch video'}](${iframe.getAttribute('src')})`);
        continue;
      }
      const img = node.querySelector('img');
      if (img && img.getAttribute('src')) {
        const src = img.getAttribute('src');
        if (isWebflowQuoteGraphic(src)) continue;
        const capText = (node.querySelector('figcaption')?.textContent || '').trim();
        if (/\[comment-photo[^\]]*\]/i.test(capText)) {
          flushPhotoIfUnused();
          pendingPhoto = src;
          continue;
        }
        flushPhotoIfUnused();
        if (/\[video\]/i.test(capText) || node.getAttribute('data-video-url')) {
          const capLink = node.querySelector('figcaption a')?.getAttribute('href') || '';
          const videoUrl = node.getAttribute('data-video-url') || capLink;
          const cleanCap = cleanCaptionMarker(capText).replace(videoUrl, '').trim() || 'Watch video';
          if (videoUrl) {
            out.push(`[${cleanCap}](${videoUrl})`);
            continue;
          }
        }
        const caption = cleanCaptionMarker(capText).replace(/[\[\]]/g, '');
        out.push(`![${caption}](${src})`);
        continue;
      }
    }

    if (tag === 'blockquote') {
      const q = extractQuoteBlockData(node, pendingPhoto);
      pendingPhoto = '';
      const qLines = q.paragraphs
        .map((pHtml) => {
          const tmp = new DOMParser().parseFromString(pHtml, 'text/html');
          return Array.from(tmp.body.childNodes).map(inlineNodeToMarkdown).join('').replace(/\s+/g, ' ').trim();
        })
        .filter(Boolean);
      if (qLines.length) {
        if (q.authorName || q.variant === 'basic' || q.variant === 'photo') {
          const head = [q.authorName, q.authorRole].filter(Boolean).join(' | ');
          out.push(`:::quote${head ? ' ' + head : ''}\n${qLines.join('\n\n')}\n:::`);
        } else {
          out.push(qLines.map((l) => `> ${l}`).join('\n'));
        }
      }
      continue;
    }

    if (tag === 'ul' || tag === 'ol') {
      flushPhotoIfUnused();
      if (tag === 'ul') {
        const feat = parseListFeatureItems(node);
        if (feat && feat.items.length) {
          const lines = feat.items.map((it) => {
            const tmp = new DOMParser().parseFromString(it.bodyHtml || '', 'text/html');
            const desc = Array.from(tmp.body.childNodes).map(inlineNodeToMarkdown).join('').replace(/\s+/g, ' ').trim();
            if (it.title && desc) return `**${it.title}** :: ${desc}`;
            if (it.title) return `**${it.title}** :: `;
            return desc;
          });
          out.push(`:::cards\n${lines.join('\n')}\n:::`);
          continue;
        }
      }
      const lis = Array.from(node.children).filter((el) => el.tagName && el.tagName.toLowerCase() === 'li');
      const items = lis
        .map((li) => {
          const txt = Array.from(li.childNodes).map(inlineNodeToMarkdown).join('').replace(/\s+/g, ' ').trim();
          return txt ? (tag === 'ol' ? `1. ${txt}` : `- ${txt}`) : '';
        })
        .filter(Boolean);
      if (items.length) out.push(items.join('\n'));
      continue;
    }

    if (tag === 'hr') {
      flushPhotoIfUnused();
      out.push('---');
      continue;
    }

    const headInfo = isQuestionHeadingNode(node);
    if (headInfo) {
      flushPhotoIfUnused();
      if (headInfo.isQuestion) {
        const ans = [];
        let j = i + 1;
        while (j < children.length) {
          const nxt = children[j];
          if (nxt.nodeType === 3) {
            const nt = nxt.nodeValue.replace(/\u200d|\u00a0/g, ' ').trim();
            if (nt) ans.push(nt);
            j++;
            continue;
          }
          if (nxt.nodeType !== 1) {
            j++;
            continue;
          }
          const nTag = nxt.tagName.toLowerCase();
          if (nTag !== 'p' || isQuestionHeadingNode(nxt)) break;
          const pTxt = pElementToMarkdown(nxt);
          if (pTxt) ans.push(pTxt);
          j++;
        }
        if (ans.length) {
          out.push(`:::qa ${headInfo.text}\n${ans.join('\n\n')}\n:::`);
          i = j - 1;
          continue;
        }
      }
      const prefix = headInfo.level === 'h2' ? '## ' : '### ';
      out.push(prefix + headInfo.text);
      continue;
    }

    if (tag === 'p') {
      const pTxt = pElementToMarkdown(node);
      if (pTxt) {
        flushPhotoIfUnused();
        out.push(pTxt);
      }
      continue;
    }

    const fallbackTxt = (node.textContent || '').replace(/\u200d|\u00a0/g, ' ').trim();
    if (fallbackTxt) {
      flushPhotoIfUnused();
      out.push(fallbackTxt);
    }
  }

  flushPhotoIfUnused();
  return out.join('\n\n');
}

export function groupSequentialBlocks(rawBlocks = []) {
  const withSections = [];
  let qaCount = 0;

  for (let i = 0; i < rawBlocks.length; i++) {
    const blk = rawBlocks[i];
    if (blk.type === 'qa') {
      qaCount += 1;
      withSections.push({ ...blk, index: qaCount });
      continue;
    }
    if (blk.type === 'heading' && !blk.isQuestion) {
      const sectionParts = [];
      let j = i + 1;
      while (j < rawBlocks.length && rawBlocks[j].type === 'prose') {
        sectionParts.push(rawBlocks[j].html);
        j++;
      }
      if (sectionParts.length) {
        withSections.push({
          type: 'section',
          heading: blk.text,
          level: blk.level || 'h2',
          bodyHtml: sectionParts.join(''),
        });
        i = j - 1;
        continue;
      }
      withSections.push({ type: 'html', html: `<${blk.level || 'h3'}>${blk.html || blk.text}</${blk.level || 'h3'}>` });
      continue;
    }
    if (blk.type === 'prose') {
      const proseParts = [blk.html];
      while (i + 1 < rawBlocks.length && rawBlocks[i + 1].type === 'prose') {
        proseParts.push(rawBlocks[++i].html);
      }
      withSections.push({ type: 'html', html: proseParts.join('') });
      continue;
    }
    withSections.push(blk);
  }

  // Group 2+ consecutive quotes into a 2-column Bento quote grid & number multi-section narratives
  const sectionTotal = withSections.filter((x) => x.type === 'section').length;
  let secIdx = 0;
  const finalBlocks = [];
  for (let i = 0; i < withSections.length; i++) {
    const blk = withSections[i];
    if (blk.type === 'section') {
      secIdx += 1;
      finalBlocks.push({ ...blk, index: sectionTotal >= 2 ? secIdx : 0 });
      continue;
    }
    if (blk.type === 'quote') {
      const run = [blk];
      while (i + 1 < withSections.length && withSections[i + 1].type === 'quote') {
        run.push(withSections[++i]);
      }
      if (run.length >= 2) finalBlocks.push({ type: 'quoteGroup', quotes: run });
      else finalBlocks.push(run[0]);
      continue;
    }
    finalBlocks.push(blk);
  }

  return finalBlocks;
}

export function parseNewsMarkdownBlocks(markdown = '', imgs = {}) {
  const lines = String(markdown || '').split('\n');
  const rawBlocks = [];
  let proseBuf = [];

  const flushProse = () => {
    const joined = proseBuf.join('\n').trim();
    proseBuf = [];
    if (!joined) return;
    const html = md(joined, imgs).h;
    if (html) rawBlocks.push({ type: 'prose', html });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (/^```/.test(line)) {
      proseBuf.push(line);
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) proseBuf.push(lines[i++]);
      if (i < lines.length) proseBuf.push(lines[i]);
      continue;
    }

    if (/^:::cards\s*$/i.test(line)) {
      flushProse();
      const cardLines = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) {
        cardLines.push(lines[i++]);
      }
      const items = cardLines
        .map((cl) => cl.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean)
        .map((cl) => {
          const sp = cl.match(/^\*\*(.+?)\*\*\s*::\s*(.*)$/) || cl.match(/^([^:]{1,90}?)\s*::\s*(.*)$/);
          if (sp) {
            return { title: sp[1].trim(), bodyHtml: inl(sp[2].trim()) };
          }
          return { title: '', bodyHtml: inl(cl) };
        });
      if (items.length) rawBlocks.push({ type: 'featureList', items });
      continue;
    }

    const qMatch = line.match(/^:::quote\s*(.*)$/i);
    if (qMatch) {
      flushProse();
      const header = qMatch[1].trim();
      const [authorName = '', authorRole = ''] = header ? header.split('|').map((x) => x.trim()) : ['', ''];
      const qLines = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) {
        qLines.push(lines[i++]);
      }
      const paras = qLines
        .join('\n')
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${inl(p.replace(/\n+/g, '<br>'))}</p>`);
      const bodyHtml = paras.join('');
      const plainLength = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
      if (paras.length) {
        rawBlocks.push({
          type: 'quote',
          variant: 'basic',
          photoSrc: '',
          authorName,
          authorRole,
          paragraphs: paras,
          plainLength,
          bodyHtml,
        });
      }
      continue;
    }

    const qaMatch = line.match(/^:::qa\s*(.*)$/i);
    if (qaMatch) {
      flushProse();
      const question = qaMatch[1].trim();
      const ansLines = [];
      i++;
      while (i < lines.length && !/^:::\s*$/.test(lines[i])) {
        ansLines.push(lines[i++]);
      }
      const paras = ansLines
        .join('\n')
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${inl(p.replace(/\n+/g, ' '))}</p>`);
      const bodyHtml = paras.join('');
      const plainLength = bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length;
      rawBlocks.push({
        type: 'qa',
        question,
        paragraphs: paras,
        plainLength,
        bodyHtml,
      });
      continue;
    }

    const imgMatch = line.match(MD_IMAGE_LINE_RE);
    if (imgMatch) {
      const resolved = resolveMediaUrl(imgMatch[2], imgs);
      if (resolved && !resolved.startsWith('idb:')) {
        flushProse();
        rawBlocks.push({ type: 'image', src: resolved, caption: imgMatch[1].trim() });
      }
      continue;
    }

    if (/^>/.test(line)) {
      flushProse();
      const bq = [];
      while (i < lines.length && /^>/.test(lines[i])) {
        bq.push(lines[i++].replace(/^>\s?/, ''));
      }
      i--;
      const joined = bq.join('\n');
      const callMatch = joined.match(/^\[!(note|tip|warn)\]\s*([\s\S]*)$/i);
      if (callMatch) {
        const variant = callMatch[1].toLowerCase();
        const bodyHtml = md(callMatch[2].trim(), imgs).h;
        rawBlocks.push({ type: 'callout', variant, bodyHtml });
      } else {
        const paras = joined
          .split(/\n{2,}/)
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => `<p>${inl(p.replace(/\n+/g, '<br>'))}</p>`);
        const bodyHtml = paras.join('');
        rawBlocks.push({
          type: 'quote',
          variant: 'accent',
          photoSrc: '',
          authorName: '',
          authorRole: '',
          paragraphs: paras,
          plainLength: bodyHtml.replace(/<[^>]+>/g, '').length,
          bodyHtml,
        });
      }
      continue;
    }

    const headMatch = line.match(/^(#{2,3})\s+(.+)$/);
    if (headMatch) {
      flushProse();
      const lvl = headMatch[1].length === 2 ? 'h2' : 'h3';
      const cleanTxt = headMatch[2].trim();
      if (/\?\s*$/.test(cleanTxt)) {
        const ansParas = [];
        let j = i + 1;
        let cur = [];
        while (j < lines.length) {
          const nl = lines[j];
          if (/^(#{1,3}\s|:::|!\[|>|---|```|\s*(?:[-*]|\d+\.)\s)/.test(nl)) break;
          if (!nl.trim()) {
            if (cur.length) {
              ansParas.push(`<p>${inl(cur.join(' ').trim())}</p>`);
              cur = [];
            }
          } else {
            cur.push(nl.trim());
          }
          j++;
        }
        if (cur.length) ansParas.push(`<p>${inl(cur.join(' ').trim())}</p>`);
        if (ansParas.length) {
          const bodyHtml = ansParas.join('');
          rawBlocks.push({
            type: 'qa',
            question: cleanTxt,
            paragraphs: ansParas,
            plainLength: bodyHtml.replace(/<[^>]+>/g, '').length,
            bodyHtml,
          });
          i = j - 1;
          continue;
        }
      }
      rawBlocks.push({ type: 'heading', level: lvl, text: cleanTxt, html: inl(cleanTxt), isQuestion: false });
      continue;
    }

    proseBuf.push(line);
  }

  flushProse();
  return groupSequentialBlocks(rawBlocks);
}

export const NEWS_TPL = {
  'Blank story': '',
  'Team Interview (Q&A)': [
    'Introduce who this conversation is with and what makes their experience unique.',
    '',
    ':::qa How did your journey in BIM and engineering begin?',
    'Share the story behind your first projects, mentors, or turning point.',
    ':::',
    '',
    ':::qa What workflow or principle helps you most today?',
    'Describe practical lessons, coordination habits, or favorite tools.',
    ':::',
    '',
    ':::quote Teammate Name | Role',
    'Add a memorable takeaway or endorsement from the conversation.',
    ':::',
  ].join('\n\n'),
  'Project Case Study': [
    '## About the project',
    'Briefly outline the building scope, location, disciplines involved, and key deliverables.',
    '',
    ':::cards',
    '**Project Scope** :: Discipline deliverables, LOD targets, and coordination milestones.',
    '**Key Challenge** :: Complex geometry, tight schedule, or field constraint overcome.',
    '**Standards Used** :: [[C10_INTERIOR]] or core naming & clash rules applied.',
    '**Outcome** :: Impact on accuracy, turnaround speed, and team collaboration.',
    ':::',
    '',
    '## Engineering Takeaways',
    'Document decisions worth reusing on future projects.',
    '',
    ':::quote Project Lead | VDC Team',
    'Capture what made delivery smooth or what the team would repeat next time.',
    ':::',
  ].join('\n\n'),
  'Team Milestone': [
    'Celebrate a promotion, new role, team launch, or studio milestone.',
    '',
    ':::cards',
    '**Focus Areas** :: Core responsibilities and standards owned.',
    '**Collaboration** :: How this connects with teams and ongoing projects.',
    ':::',
    '',
    ':::quote Teammate Name | Role',
    'Share a short note from colleagues who work closely together.',
    ':::',
  ].join('\n\n'),
};

export function buildSeedNewsResources(seedPosts = SEED_NEWS_POSTS, quickUpdates = QUICK_UPDATE_SEEDS) {
  const combined = [...(Array.isArray(quickUpdates) ? quickUpdates : []), ...(Array.isArray(seedPosts) ? seedPosts : [])];
  return combined.map((post, idx) => {
    const id = NEWS_SEED_ID_BASE + idx + 1;
    const status = post.status === 'Draft' ? 'Draft' : 'Approved';
    const upd = post.date || TODAY;
    return {
      id,
      newsSeedKey: post.id || `news-seed-${id}`,
      slug: post.slug || '',
      node: 'c10-ovw-std',
      type: 'news',
      status,
      vis: 'Internal',
      stage: STG[0],
      disc: DISC.includes(post.dept) ? post.dept : 'VDC',
      title: post.title || '',
      desc: post.summary || '',
      url: '',
      cover: post.cover || '',
      accentColor: post.accentColor || '',
      feedCategory: post.category || 'company',
      feedKind: post.kind || 'article',
      project: post.project || 'General',
      featured: Boolean(post.featured),
      pinned: Boolean(post.pinned),
      codeSnippet: post.codeSnippet || '',
      readTime: post.readTime || '2 min',
      body: post.body || '',
      bodyHtml: post.bodyHtml || '',
      bodyFormat: post.body ? 'markdown' : 'html',
      tags: Array.isArray(post.tags) ? post.tags : [],
      links: Array.isArray(post.linkedDocIds)
        ? post.linkedDocIds.map((d) => [Number(d), 'soft']).filter(([n]) => Number.isFinite(n))
        : [],
      c: [],
      publicAttachments: [],
      author: post.author || 'Planit Team',
      upd,
      verified: upd,
      v: [{ n: 1, by: post.author || 'Planit Team', d: upd, note: 'Published', body: post.body || '' }],
    };
  });
}

export function mergeSeedNewsIntoRes(list = [], { legacyOverrides = null, deletedNewsKeys = [] } = {}) {
  const baseList = Array.isArray(list) ? [...list] : [];
  const deleted = new Set([
    ...(Array.isArray(deletedNewsKeys) ? deletedNewsKeys : []).map(String),
    ...(Array.isArray(legacyOverrides?.deletedIds) ? legacyOverrides.deletedIds : []).map(String),
  ]);

  const seenIds = new Set(baseList.map((x) => x && Number(x.id)).filter(Number.isFinite));
  const seenKeys = new Set(baseList.map((x) => x && x.newsSeedKey).filter(Boolean).map(String));
  const seedItems = buildSeedNewsResources();
  const seedByKey = new Map(seedItems.map((s) => [s.newsSeedKey, s]));

  const customList = Array.isArray(legacyOverrides?.custom) ? legacyOverrides.custom : [];
  const migratedCustom = [];
  let customOffset = 1;
  for (const raw of customList) {
    if (!raw || deleted.has(String(raw.id))) continue;
    const rawKey = String(raw.newsSeedKey || raw.id || '');
    if (seenKeys.has(rawKey)) continue;

    // Preserve seed deterministic numeric ID when custom override modified a seeded article
    const seedMatch = seedByKey.get(rawKey);
    const numId = seedMatch
      ? seedMatch.id
      : Number.isFinite(Number(raw.id))
      ? Number(raw.id)
      : Date.now() + customOffset++;

    if (seenIds.has(numId)) continue;
    seenIds.add(numId);
    if (rawKey) seenKeys.add(rawKey);

    const status =
      raw.status === 'Published' || raw.status === 'Approved' ? 'Approved' : raw.status || 'Draft';
    const upd = raw.date || TODAY;
    const linkedDocIds = Array.isArray(raw.linkedDocIds)
      ? raw.linkedDocIds
      : extractLinkedDocIds(raw.body || '');

    migratedCustom.push({
      id: numId,
      newsSeedKey: rawKey || undefined,
      slug: raw.slug || '',
      node: 'c10-ovw-std',
      type: 'news',
      status,
      vis: 'Internal',
      stage: STG[0],
      disc: DISC.includes(raw.dept) ? raw.dept : 'VDC',
      title: raw.title || '',
      desc: raw.summary !== undefined ? raw.summary : raw.desc || '',
      url: '',
      cover: raw.cover || '',
      accentColor: raw.accentColor || '',
      feedCategory: raw.category || raw.feedCategory || 'technical',
      feedKind: raw.kind || raw.feedKind || 'article',
      project: raw.project || 'General',
      featured: Boolean(raw.featured),
      pinned: Boolean(raw.pinned),
      codeSnippet: raw.codeSnippet || '',
      readTime: raw.readTime || estimateReadTime(raw.body || raw.bodyHtml || ''),
      body: raw.body || '',
      bodyHtml: raw.bodyHtml || '',
      bodyFormat: raw.body ? 'markdown' : raw.bodyFormat || 'html',
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      links: linkedDocIds.map((d) => [Number(d), 'soft']).filter(([n]) => Number.isFinite(n)),
      c: Array.isArray(raw.c) ? raw.c : [],
      publicAttachments: [],
      author: raw.author || 'Team',
      upd,
      verified: upd,
      v: [{ n: 1, by: raw.author || 'Team', d: upd, note: status === 'Approved' ? 'Published' : 'Draft', body: raw.body || '' }],
    });
  }

  const additions = [];
  for (const seedItem of seedItems) {
    if (deleted.has(seedItem.newsSeedKey) || deleted.has(String(seedItem.id))) continue;
    if (seenIds.has(seedItem.id) || seenKeys.has(seedItem.newsSeedKey)) continue;
    seenIds.add(seedItem.id);
    seenKeys.add(seedItem.newsSeedKey);
    additions.push(seedItem);
  }

  return [...migratedCustom, ...baseList, ...additions];
}
