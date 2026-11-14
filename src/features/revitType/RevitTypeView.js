import { html, useMemo } from '../../lib/react.js';
import { Assembly3DView } from '../assembly3d/Assembly3DView.js';
import { DetailWall } from '../wall/DetailWall.js';
import { LocalImpactGraph } from '../graph/LocalImpactGraph.js';
import { Ic } from '../../components/Icon.js';

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
}

const CAT_HINTS = {
  walls: ['wall', 'partition', 'gwb', 'stud', 'shaft', 'furring', 'fire', 'acoustic', 'clad', 'timber'],
  doors: ['door', 'ada', 'threshold', 'frame', 'opening'],
  ceilings: ['ceiling', 'soffit', 'plenum', 'grid'],
  floors: ['floor', 'slab', 'finish'],
};

function inferInitialZone(category = '') {
  const c = category.toLowerCase();
  if (c.includes('door')) return 'Doors & Openings';
  if (c.includes('ceiling')) return 'Ceilings & Plenums';
  if (c.includes('wall')) return 'Partitions & Walls';
  return 'All';
}

const FN_PALETTE = {
  Finish1: { color: '#C8A97E', edge: '#E5C89C', opacity: 0.92, pattern: 'solid' },
  Finish2: { color: '#D6DEE8', edge: '#93C5FD', opacity: 0.9, pattern: 'solid' },
  Substrate: { color: '#94A3B8', edge: '#CBD5E1', opacity: 0.88, pattern: 'solid' },
  ThermalOrAir: { color: '#E89B9B', edge: '#FCA5A5', opacity: 0.72, pattern: 'insulation' },
  Structure: { color: '#64748B', edge: '#94A3B8', opacity: 0.86, pattern: 'studs' },
  Membrane: { color: '#38BDF8', edge: '#7DD3FC', opacity: 0.85, pattern: 'solid' },
};

function inferPattern(name = '', fn = '') {
  const hay = `${name} ${fn}`.toLowerCase();
  if (/insul|batt|wool|thermal|air/.test(hay)) return 'insulation';
  if (/stud|framing|joist|timber|wood|metal/.test(hay)) return 'studs';
  return (FN_PALETTE[fn] && FN_PALETTE[fn].pattern) || 'solid';
}

function buildLiveAssemblyFromCtx(ctx) {
  if (!ctx) return null;
  const rawLayers = Array.isArray(ctx.layers) ? ctx.layers : [];
  const category = ctx.category || 'Revit Element';
  const family = ctx.family || '';
  const typeName = ctx.typeName || 'Selected Revit Type';

  if (rawLayers.length > 0) {
    const totalMm = rawLayers.reduce((s, l) => s + (Number(l.mm) || 0), 0);
    const layers = rawLayers.map((l, idx) => {
      const fn = l.f || 'Structure';
      const pal = FN_PALETTE[fn] || FN_PALETTE.Structure;
      const color = /^#[0-9A-Fa-f]{6}$/.test(l.c || '') ? l.c : pal.color;
      const mm = Number(l.mm) || 0;
      const depth = Math.max(8, Math.min(54, Math.round(mm * 0.42)));
      const matName = l.n || fn;
      return {
        id: `revit-ly-${idx}`,
        name: matName,
        role: `${fn}${l.core ? ' (Core)' : ''}`,
        thicknessMm: mm,
        width: 260,
        height: 190,
        depth,
        color,
        edgeColor: pal.edge,
        opacity: pal.opacity,
        pattern: inferPattern(matName, fn),
        revitMaterial: matName,
        param: `Function = ${fn} · Width = ${mm} mm`,
        rule: `Live Revit CompoundStructure layer #${idx + 1} (${l.core ? 'Core Boundary' : 'Non-Core'}).`,
      };
    });

    return {
      id: 'revit-live',
      code: category.toUpperCase(),
      title: typeName,
      revitCategory: category,
      revitType: family ? `${family}: ${typeName}` : typeName,
      fireRating: ctx.fire || 'Not specified',
      stc: ctx.acoustic || 'Not specified',
      thickness: `${Math.round(totalMm)} mm`,
      summary: `Live 3D assembly generated directly from Revit CompoundStructure (${layers.length} layers${family ? ` · ${family}` : ''}).`,
      layers,
    };
  }

  const parsedW = parseFloat(String(ctx.width || '').replace(/[^0-9.]/g, '')) || 0;
  if (parsedW > 0 || ctx.typeName) {
    const mm = parsedW > 0 ? Math.round(parsedW) : 150;
    return {
      id: 'revit-live-single',
      code: category.toUpperCase(),
      title: typeName,
      revitCategory: category,
      revitType: family ? `${family}: ${typeName}` : typeName,
      fireRating: ctx.fire || 'Not specified',
      stc: ctx.acoustic || 'Not specified',
      thickness: parsedW > 0 ? `${mm} mm` : 'From Revit Model',
      summary: `Live 3D preview from selected Revit element (${family || category}). Select a CompoundStructure element for multi-layer breakdown.`,
      layers: [
        {
          id: 'revit-ly-0',
          name: typeName,
          role: family || category,
          thicknessMm: mm,
          width: 240,
          height: 190,
          depth: Math.max(18, Math.min(54, Math.round(mm * 0.25))),
          color: '#64748B',
          edgeColor: '#93C5FD',
          opacity: 0.88,
          pattern: 'solid',
          revitMaterial: family || typeName,
          param: `Type = ${typeName}`,
          rule: `Live Revit element type (${category}).`,
        },
      ],
    };
  }

  return null;
}

export function RevitTypeView({
  ctx,
  res = [],
  imgs = {},
  tree = [],
  favs = [],
  onToggleFav,
  onRead,
  onToast,
}) {
  const category = (ctx && ctx.category) || 'Walls';
  const family = (ctx && ctx.family) || 'Basic Wall';
  const typeName = (ctx && ctx.typeName) || 'Selected Revit Type';

  const paramEntries = useMemo(() => {
    const out = [
      ['Category', category],
      ['Family', family],
      ['Type Name', typeName],
    ];
    if (ctx && ctx.fire) out.push(['Fire Rating', ctx.fire]);
    if (ctx && ctx.func) out.push(['Function', ctx.func]);
    if (ctx && ctx.width) out.push(['Width', ctx.width]);
    if (ctx && ctx.acoustic) out.push(['Acoustic Rating', ctx.acoustic]);
    return out;
  }, [ctx, category, family, typeName]);

  const liveAssembly = useMemo(() => buildLiveAssemblyFromCtx(ctx), [ctx]);

  const relatedDocs = useMemo(() => {
    const tokens = tokenize(`${category} ${family} ${typeName}`);
    const hints = CAT_HINTS[category.trim().toLowerCase()] || [];
    return (res || [])
      .map((doc) => {
        const hay = `${doc.title || ''} ${doc.desc || doc.sum || ''} ${(doc.tags || []).join(' ')}`.toLowerCase();
        let score = 0;
        for (const t of tokens) if (hay.includes(t)) score += 5;
        for (const h of hints) if (hay.includes(h)) score += 2;
        return { doc, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.doc);
  }, [res, category, family, typeName]);

  const copyType = () => {
    const label = family ? `${family}: ${typeName}` : typeName;
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(label).catch(() => {});
    }
    onToast && onToast(`Copied Revit type: ${label}`);
  };

  const initialZone = useMemo(() => inferInitialZone(category), [category]);

  return html`<div className="rt-wrap">
    <section className="rt-hero">
      <div className="rt-badges">
        <span className="rt-pill blue">Revit Type</span>
        <span className="rt-pill">${category}</span>
        ${family && html`<span className="rt-pill">${family}</span>`}
      </div>
      <div className="rt-head">
        <div>
          <h1 className="rt-title">${typeName}</h1>
          <p className="rt-sub">
            Live Revit element model, CompoundStructure layers & relative Datum items.
          </p>
        </div>
        <div className="rt-actions">
          <button type="button" className="rt-btn pri" onClick=${copyType}>
            <${Ic} n="copy" s=${14} /> Copy Type Name
          </button>
        </div>
      </div>
      <div className="rt-params">
        ${paramEntries.map(
          ([k, v]) => html`<div key=${k} className="rt-param">
            <small>${k}</small>
            <b>${v}</b>
          </div>`
        )}
      </div>
    </section>

    <section className="rt-sec">
      <div className="rt-sec-head">
        <h2>Live 3D Model</h2>
        <span className="rt-pill">
          ${liveAssembly ? `${liveAssembly.layers.length} real Revit layers · ${liveAssembly.thickness}` : 'From Revit Selection'}
        </span>
      </div>
      ${liveAssembly
        ? html`<${Assembly3DView}
            embedded=${true}
            customAssembly=${liveAssembly}
            onRead=${onRead}
            onToast=${onToast}
          />`
        : html`<div className="rt-hero">
            <p className="rt-sub" style=${{ margin: 0 }}>
              Select an element in Revit and press <b>Ctrl+K</b> to inspect its live 3D layers.
            </p>
          </div>`}
    </section>

    ${relatedDocs.length > 0 &&
    html`<section className="rt-sec">
      <div className="rt-sec-head">
        <h2>Relative Standards</h2>
        <span className="rt-pill">${relatedDocs.length} linked</span>
      </div>
      <div className="rt-grid">
        ${relatedDocs.map(
          (doc) => html`<button
            key=${'doc-' + doc.id}
            type="button"
            className="rt-card"
            onClick=${() => onRead && onRead(doc.id)}
          >
            <div className="rt-card-top">
              <span className="rt-card-kind">Standard · ${doc.disc || 'BIM'}</span>
              <span className="rt-pill">${doc.status || doc.st || 'Approved'}</span>
            </div>
            <h3 className="rt-card-title">${doc.title}</h3>
            <p className="rt-card-desc">${doc.desc || doc.sum || 'Open standard document in Datum Reader.'}</p>
          </button>`
        )}
      </div>
    </section>`}

    <section className="rt-sec">
      <${LocalImpactGraph}
        revitCtx=${{ category, family, typeName }}
        relatedDocs=${relatedDocs}
        res=${res}
        onRead=${onRead}
      />
    </section>

    <section className="rt-sec">
      <div className="rt-sec-head">
        <h2>Relative 2D Details</h2>
        <span className="rt-pill">${initialZone}</span>
      </div>
      <${DetailWall}
        embedded=${true}
        initialZone=${initialZone}
        res=${res}
        imgs=${imgs}
        tree=${tree}
        favs=${favs}
        onToggleFav=${onToggleFav}
        onRead=${onRead}
      />
    </section>
  </div>`;
}
