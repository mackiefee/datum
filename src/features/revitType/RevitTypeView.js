import { html, useMemo, useState } from '../../lib/react.js';
import { Assembly3DView } from '../assembly3d/Assembly3DView.js';
import { DetailWall } from '../wall/DetailWall.js';
import { LocalImpactGraph } from '../graph/LocalImpactGraph.js';
import { parseAndValidateWallName } from '../naming/namingEngine.js';
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
  onOpenNamingStudio,
  onToast,
}) {
  const category = (ctx && ctx.category) || 'Walls';
  const family = (ctx && ctx.family) || 'Basic Wall';
  const typeName = (ctx && ctx.typeName) || 'Selected Revit Type';

  const paramEntries = useMemo(() => {
    const out = [];
    if (ctx && ctx.fire) out.push(['Fire Rating', ctx.fire]);
    if (ctx && ctx.func) out.push(['Function', ctx.func]);
    if (ctx && ctx.width) out.push(['Width', ctx.width]);
    if (ctx && ctx.acoustic) out.push(['Acoustic Rating', ctx.acoustic]);
    return out;
  }, [ctx]);

  const liveAssembly = useMemo(() => buildLiveAssemblyFromCtx(ctx), [ctx]);

  const isSyntheticBanner =
    !ctx ||
    !ctx.typeName ||
    /^(3D Assembly & Wall Standards|Architectural Detail Reference|Selected Revit Type)$/i.test(ctx.typeName);

  const namingAudit = useMemo(() => {
    if (isSyntheticBanner) return null;
    const looksLikeWall = category.toLowerCase().includes('wall') || typeName.includes('_') || /^C\d{4}/i.test(typeName);
    if (!looksLikeWall) return null;
    return parseAndValidateWallName(typeName, ctx && ctx.layers, ctx && ctx.fire);
  }, [isSyntheticBanner, category, typeName, ctx]);

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
  const [rtTab, setRtTab] = useState(relatedDocs.length > 0 ? 'standards' : 'details');
  const activeRtTab = rtTab === 'standards' && relatedDocs.length === 0 ? 'details' : rtTab;

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
          ${onOpenNamingStudio &&
          html`<button
            type="button"
            className="rt-btn"
            onClick=${() => onOpenNamingStudio(isSyntheticBanner ? '' : typeName, ctx)}
          >
            <${Ic} n="sliders" s=${14} /> Open in Naming Studio
          </button>`}
        </div>
      </div>
      ${paramEntries.length > 0 &&
      html`<div className="rt-params">
        ${paramEntries.map(
          ([k, v]) => html`<div key=${k} className="rt-param">
            <small>${k}</small>
            <b>${v}</b>
          </div>`
        )}
      </div>`}
    </section>

    ${namingAudit &&
    html`<section className="rt-hero rt-audit">
      <div className="rt-audit-hd">
        <div style=${{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style=${{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Wall Naming Audit</span>
          <span className=${'nm-status ' + namingAudit.status}>
            <${Ic}
              n=${namingAudit.status === 'valid' ? 'check' : namingAudit.status === 'warn' ? 'spark' : 'x'}
              s=${12}
            />
            ${namingAudit.status === 'valid'
              ? 'Compliant'
              : namingAudit.status === 'warn'
              ? 'Needs Review'
              : `${namingAudit.issues.filter((i) => i.level === 'error').length} Issue(s)`}
          </span>
        </div>
        <div style=${{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          ${namingAudit.changedByFix &&
          namingAudit.autoFixed &&
          html`<button
            type="button"
            className="rt-btn pri"
            onClick=${() => {
              if (navigator && navigator.clipboard) {
                navigator.clipboard.writeText(namingAudit.autoFixed).catch(() => {});
              }
              if (onToast) onToast(`Copied auto-fixed: ${namingAudit.autoFixed}`);
            }}
          >
            <${Ic} n="dup" s=${14} /> Copy Auto-Fixed Name
          </button>`}
          ${onOpenNamingStudio &&
          html`<button type="button" className="rt-btn" onClick=${() => onOpenNamingStudio(typeName, ctx)}>
            <${Ic} n="sliders" s=${14} /> Edit Slots in 3D
          </button>`}
        </div>
      </div>

      ${namingAudit.slots &&
      namingAudit.slots.length > 0 &&
      html`<div className="nm-slots">
        ${namingAudit.slots.map(
          (s) => html`<span key=${s.num} className=${'nm-slot' + (s.muted ? ' muted' : '')}>
            <span className="nm-slot-n">${s.num}</span>
            <span className="nm-slot-k">${s.label}:</span>
            <span className="nm-slot-v">${s.value}</span>
          </span>`
        )}
      </div>`}

      ${namingAudit.issues && namingAudit.issues.length > 0
        ? html`<div className="nm-issue-list">
            ${namingAudit.issues.map(
              (iss, idx) => html`<div key=${idx} className=${'nm-issue ' + iss.level}>
                ${iss.slot ? html`<b>Slot ${iss.slot}: </b>` : null}${iss.message}
              </div>`
            )}
          </div>`
        : html`<p className="rt-sub" style=${{ margin: 0 }}>
            All 13 naming slots match the C1010/C1070 Interior Wall Naming Standard${ctx && ctx.layers && ctx.layers.length ? ' and live CompoundStructure layers' : ''}.
          </p>`}
    </section>`}

    ${liveAssembly &&
    html`<section className="rt-sec">
      <div className="rt-sec-head">
        <h2>Live 3D Model</h2>
        <span className="rt-pill">
          ${liveAssembly.layers.length} real Revit layers · ${liveAssembly.thickness}
        </span>
      </div>
      <${Assembly3DView}
        embedded=${true}
        customAssembly=${liveAssembly}
        onRead=${onRead}
        onToast=${onToast}
      />
    </section>`}

    <div className="rt-tabs-bar">
      <div className="nm-seg-pill rt-tabs" role="tablist" aria-label="Revit type references">
        ${relatedDocs.length > 0 &&
        html`<button
          type="button"
          role="tab"
          aria-selected=${activeRtTab === 'standards'}
          className=${activeRtTab === 'standards' ? 'on' : ''}
          onClick=${() => setRtTab('standards')}
        >
          Standards (${relatedDocs.length})
        </button>`}
        <button
          type="button"
          role="tab"
          aria-selected=${activeRtTab === 'impact'}
          className=${activeRtTab === 'impact' ? 'on' : ''}
          onClick=${() => setRtTab('impact')}
        >
          Impact Map
        </button>
        <button
          type="button"
          role="tab"
          aria-selected=${activeRtTab === 'details'}
          className=${activeRtTab === 'details' ? 'on' : ''}
          onClick=${() => setRtTab('details')}
        >
          2D Details · ${initialZone}
        </button>
      </div>
    </div>

    ${activeRtTab === 'standards' &&
    relatedDocs.length > 0 &&
    html`<section className="rt-sec rt-sec-tab">
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

    ${activeRtTab === 'impact' &&
    html`<section className="rt-sec rt-sec-tab">
      <${LocalImpactGraph}
        revitCtx=${{ category, family, typeName }}
        relatedDocs=${relatedDocs}
        res=${res}
        onRead=${onRead}
      />
    </section>`}

    ${activeRtTab === 'details' &&
    html`<section className="rt-sec rt-sec-tab">
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
    </section>`}
  </div>`;
}
