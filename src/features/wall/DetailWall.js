import { html, useState, useMemo, useEffect, useRef } from '../../lib/react.js';
import { Ic } from '../../components/Icon.js';
import { byId } from '../../data/spaces.js';
import { fmt } from '../../utils/format.js';
import { DC } from '../../config/constants.js';

const ZONES = [
  'All',
  'Partitions & Walls',
  'Doors & Openings',
  'Shafts & Stairs',
  'Ceilings & Plenums',
  'Revit & Modeling',
  'Standards & QA',
];

function cleanMd(text) {
  return String(text || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferZone(title, section, r) {
  const hay = `${title} ${section} ${r.title || ''} ${(r.tags || []).join(' ')}`.toLowerCase();
  if (/door|won-door|opening|frame|jamb|hinge|hardware|access panel/.test(hay)) return 'Doors & Openings';
  if (/shaft|stair|elevator|duct|chase|core|vertical/.test(hay)) return 'Shafts & Stairs';
  if (/ceiling|plenum|soffit|bulkhead|brace|kicker|deck|slab|deflection/.test(hay)) return 'Ceilings & Plenums';
  if (/revit|model|family|parameter|view|schedule|tag|workset|phase|link|create parts|offset|join/.test(hay)) return 'Revit & Modeling';
  if (/partition|wall|stud|gypsum|gwb|furring|hat channel|masonry|cmu|demising|acoustic|fire|rating|layer|finish/.test(hay)) return 'Partitions & Walls';
  return 'Standards & QA';
}

function catPathOf(id, nodes, trail = []) {
  for (const n of nodes || []) {
    const next = [...trail, n.name];
    if (n.id === id) return next;
    if (n.c && n.c.length) {
      const found = catPathOf(id, n.c, next);
      if (found) return found;
    }
  }
  return null;
}

function extractDetails(res, imgs, tree) {
  const map = new Map();

  for (const r of res || []) {
    if (!r || !r.body) continue;
    const lines = String(r.body).split(/\r?\n/);
    let curSection = '';

    const catNode = r.catId ? byId(r.catId, tree) : null;
    const catPath = (r.catId && catPathOf(r.catId, tree)?.join(' / ')) || r.disc || 'General';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const hm = line.match(/^#{1,4}\s+(.+)/);
      if (hm) {
        curSection = cleanMd(hm[1]);
        continue;
      }

      const imgRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
      let m;
      while ((m = imgRe.exec(line)) !== null) {
        const rawAlt = cleanMd(m[1]);
        const target = m[2].trim();
        const src = target.startsWith('img:') ? imgs?.[target.slice(4)] : target;
        if (!src) continue;

        // Gather 1-3 surrounding non-empty text lines for context
        const ctxLines = [];
        for (let j = Math.max(0, i - 3); j <= Math.min(lines.length - 1, i + 3); j++) {
          if (j === i) continue;
          const candidate = lines[j].trim();
          if (!candidate || /^#{1,4}\s+/.test(candidate) || /^!\[/.test(candidate) || /^\|[-:| ]+\|$/.test(candidate)) continue;
          const cleaned = cleanMd(candidate);
          if (cleaned.length > 8) ctxLines.push(cleaned);
          if (ctxLines.length >= 3) break;
        }

        const isGenericAlt = !rawAlt || /^(image|picture|img|fig|figure)\s*\d*$/i.test(rawAlt);
        const title = isGenericAlt ? (curSection || r.title) : rawAlt;
        const excerpt = ctxLines.join(' ').slice(0, 240) || cleanMd(r.desc);
        const zone = inferZone(title, curSection, r);

        const existing = map.get(src);
        if (!existing || excerpt.length > existing.excerpt.length) {
          map.set(src, {
            id: `${r.id}-${i}-${src}`,
            src,
            title,
            section: curSection,
            excerpt,
            zone,
            catName: catNode ? catNode.name : r.disc || 'General',
            catPath,
            resource: r,
          });
        }
      }
    }
  }

  return Array.from(map.values());
}

export const DetailWall = ({ res, imgs, tree, favs, onToggleFav, onRead, embedded = false, initialZone = 'All' }) => {
  const [q, setQ] = useState('');
  const [zone, setZone] = useState(initialZone || 'All');
  const [activeId, setActiveId] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ active: false, sx: 0, sy: 0, px: 0, py: 0 });

  const allDetails = useMemo(() => extractDetails(res, imgs, tree), [res, imgs, tree]);

  const zoneCounts = useMemo(() => {
    const c = { All: allDetails.length };
    for (const d of allDetails) c[d.zone] = (c[d.zone] || 0) + 1;
    return c;
  }, [allDetails]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return allDetails.filter((d) => {
      if (zone !== 'All' && d.zone !== zone) return false;
      if (!query) return true;
      const hay = `${d.title} ${d.section} ${d.excerpt} ${d.zone} ${d.catPath} ${d.resource.title} ${(d.resource.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(query);
    });
  }, [allDetails, zone, q]);

  const activeIdx = useMemo(
    () => (activeId ? filtered.findIndex((d) => d.id === activeId) : -1),
    [filtered, activeId]
  );

  const activeItem = useMemo(() => {
    if (!activeId) return null;
    return filtered[activeIdx] || allDetails.find((d) => d.id === activeId) || null;
  }, [activeId, filtered, activeIdx, allDetails]);

  const related = useMemo(() => {
    if (!activeItem) return [];
    const sameRes = allDetails.filter((d) => d.id !== activeItem.id && d.resource.id === activeItem.resource.id);
    const sameZone = allDetails.filter((d) => d.id !== activeItem.id && d.resource.id !== activeItem.resource.id && d.zone === activeItem.zone);
    return [...sameRes, ...sameZone].slice(0, 4);
  }, [activeItem, allDetails]);

  const openItem = (id) => {
    setActiveId(id);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const closeModal = () => {
    setActiveId(null);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const stepItem = (dir) => {
    if (!filtered.length) return;
    const base = activeIdx >= 0 ? activeIdx : 0;
    const next = (base + dir + filtered.length) % filtered.length;
    openItem(filtered[next].id);
  };

  useEffect(() => {
    if (!activeItem) return;
    const onKey = (e) => {
      if (e.key === 'Escape') closeModal();
      else if (e.key === 'ArrowRight') stepItem(1);
      else if (e.key === 'ArrowLeft') stepItem(-1);
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(4, +(z + 0.35).toFixed(2)));
      else if (e.key === '-') setZoom((z) => Math.max(0.75, +(z - 0.35).toFixed(2)));
      else if (e.key === '0') {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeItem, activeIdx, filtered]);

  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoom((z) => Math.min(4, Math.max(0.75, +(z + delta).toFixed(2))));
  };

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragRef.current.active) return;
    setPan({
      x: dragRef.current.px + (e.clientX - dragRef.current.sx),
      y: dragRef.current.py + (e.clientY - dragRef.current.sy),
    });
  };

  const onPointerUp = () => {
    dragRef.current.active = false;
    setDragging(false);
  };

  return html`<div className=${embedded ? 'dw-wrap dw-emb' : 'dw-wrap'}>
    <div className="dw-head">
      ${!embedded &&
      html`<div className="dw-title-row">
        <div className="dw-title-l">
          <h1>Detail Wall</h1>
          <span className="pdl-cnt">${filtered.length}</span>
          <span className="dw-sub">Visual BIM & Interior detail reference across ${res.length} standards</span>
        </div>
        <div className="dw-search">
          <${Ic} n="search" s=${15} />
          <input
            type="text"
            value=${q}
            placeholder="Search details, wall types, doors, Revit rules…"
            aria-label="Search Detail Wall"
            onInput=${(e) => setQ(e.target.value)}
          />
          ${q &&
          html`<button className="dw-clr" aria-label="Clear search" onClick=${() => setQ('')}>
            <${Ic} n="x" s=${13} />
          </button>`}
        </div>
      </div>`}

      <div className="dw-pills" role="tablist" aria-label="Filter by zone">
        ${ZONES.filter((z) => z === 'All' || (zoneCounts[z] || 0) > 0).map(
          (z) => html`<button
            key=${z}
            type="button"
            className=${'dw-pill' + (zone === z ? ' on' : '')}
            onClick=${() => setZone(z)}
          >
            <span>${z}</span>
            <span className="dw-pill-ct">${zoneCounts[z] || 0}</span>
          </button>`
        )}
      </div>
    </div>

    ${filtered.length
      ? html`<div className="dw-masonry">
          ${filtered.map(
            (d) => html`<article
              key=${d.id}
              className="dw-card"
              tabIndex="0"
              role="button"
              onClick=${() => openItem(d.id)}
              onKeyDown=${(e) => e.key === 'Enter' && openItem(d.id)}
            >
              <div className="dw-thumb">
                <img src=${d.src} alt=${d.title} loading="lazy" />
                <span className="dw-zoom-badge">
                  <${Ic} n="expand" s=${13} />
                </span>
              </div>
              <div className="dw-meta">
                <div className="dw-card-title">${d.title}</div>
                <div className="dw-card-foot">
                  <span className="dw-zone">${d.zone}</span>
                  <span className="dw-src-name">${d.resource.title}</span>
                </div>
              </div>
            </article>`
          )}
        </div>`
      : html`<div className="empty">
          <${Ic} n="media" s=${34} />
          <b>No matching details</b>
          <span>Try another keyword or switch zone filter.</span>
          ${(q || zone !== 'All') &&
          html`<button className="btn" onClick=${() => { setQ(''); setZone('All'); }}>Reset filters</button>`}
        </div>`}

    ${activeItem &&
    html`<div className="dw-lb-ov" role="dialog" aria-modal="true" aria-label=${activeItem.title} onClick=${closeModal}>
      <div className="dw-lb" onClick=${(e) => e.stopPropagation()}>
        <div className="dw-lb-stage" onWheel=${onWheel}>
          <div
            className=${'dw-lb-canvas' + (dragging ? ' drag' : '')}
            onPointerDown=${onPointerDown}
            onPointerMove=${onPointerMove}
            onPointerUp=${onPointerUp}
            onPointerCancel=${onPointerUp}
            onDoubleClick=${() => {
              if (zoom > 1.1) {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              } else {
                setZoom(2);
              }
            }}
          >
            <img
              src=${activeItem.src}
              alt=${activeItem.title}
              draggable="false"
              style=${{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
              }}
            />
          </div>

          ${filtered.length > 1 &&
          html`<button className="dw-nav prev" title="Previous (Left arrow)" aria-label="Previous detail" onClick=${() => stepItem(-1)}>
            <span style=${{ display: 'inline-flex', transform: 'rotate(180deg)' }}><${Ic} n="chev" s=${18} /></span>
          </button>`}
          ${filtered.length > 1 &&
          html`<button className="dw-nav next" title="Next (Right arrow)" aria-label="Next detail" onClick=${() => stepItem(1)}>
            <${Ic} n="chev" s=${18} />
          </button>`}

          <div className="dw-zoom-bar">
            <button type="button" title="Zoom out (-)" onClick=${() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))}>
              <${Ic} n="minus" s=${14} />
            </button>
            <span className="dw-zoom-val">${Math.round(zoom * 100)}%</span>
            <button type="button" title="Zoom in (+)" onClick=${() => setZoom((z) => Math.min(4, +(z + 0.25).toFixed(2)))}>
              <${Ic} n="plus" s=${14} />
            </button>
            <button
              type="button"
              className="dw-zoom-fit"
              title="Reset view (0)"
              onClick=${() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
            >
              <${Ic} n="fit" s=${14} />
            </button>
          </div>
        </div>

        <aside className="dw-lb-side">
          <div className="dw-lb-top">
            <div className="dw-lb-crumbs">
              <span className="dw-zone on">${activeItem.zone}</span>
              <span className="dw-crumb">${activeItem.catPath}</span>
            </div>
            <button type="button" className="ib" aria-label="Close inspector" onClick=${closeModal}>
              <${Ic} n="x" s=${16} />
            </button>
          </div>

          <h2 className="dw-lb-title">${activeItem.title}</h2>
          ${activeItem.section &&
          activeItem.section !== activeItem.title &&
          html`<div className="dw-lb-sec">Section: ${activeItem.section}</div>`}

          <div className="dw-passport">
            <div className="dw-pass-lbl">Key Context & Rule</div>
            <p className="dw-pass-txt">${activeItem.excerpt || 'Referenced detail diagram from the Knowledge Base standard.'}</p>
          </div>

          <div className="dw-src-card">
            <div className="dw-src-meta">
              <span className="dw-disc-dot" style=${{ '--c': DC[activeItem.resource.disc] || '#0a84ff' }}></span>
              <span>${activeItem.resource.disc}</span>
              <span>·</span>
              <span>Updated ${fmt(activeItem.resource.upd)}</span>
            </div>
            <div className="dw-src-title">${activeItem.resource.title}</div>
            <div className="dw-src-actions">
              <button
                type="button"
                className="btn p"
                onClick=${() => {
                  const id = activeItem.resource.id;
                  closeModal();
                  onRead(id);
                }}
              >
                <${Ic} n="book" s=${14} />
                <span>Open in Reader</span>
              </button>
              ${onToggleFav &&
              html`<button
                type="button"
                className=${'btn' + (favs?.includes(activeItem.resource.id) ? ' on' : '')}
                title="Bookmark source document"
                onClick=${() => onToggleFav(activeItem.resource.id)}
              >
                <${Ic} n="star" s=${14} f=${favs?.includes(activeItem.resource.id)} />
              </button>`}
            </div>
          </div>

          ${related.length > 0 &&
          html`<div className="dw-rel">
            <div className="dw-pass-lbl">Related Details</div>
            <div className="dw-rel-grid">
              ${related.map(
                (rel) => html`<button key=${rel.id} type="button" className="dw-rel-item" onClick=${() => openItem(rel.id)}>
                  <div className="dw-rel-img"><img src=${rel.src} alt=${rel.title} /></div>
                  <span>${rel.title}</span>
                </button>`
              )}
            </div>
          </div>`}
        </aside>
      </div>
    </div>`}
  </div>`;
};
