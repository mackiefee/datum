import { html, useMemo, useState } from '../../lib/react.js';
import { DC, ST, TY } from '../../config/constants.js';
import { Ic } from '../../components/Icon.js';
import { Graph } from './GraphView.js';

function getNeighbors(doc, res) {
  const map = new Map(res.map((r) => [r.id, r]));
  const upstream = (doc.links || [])
    .map(([toId, kind]) => ({ item: map.get(toId), kind: kind || 'soft' }))
    .filter((x) => x.item && x.item.id !== doc.id);

  const downstream = res
    .filter((r) => r.id !== doc.id && (r.links || []).some(([toId]) => toId === doc.id))
    .map((r) => {
      const link = (r.links || []).find(([toId]) => toId === doc.id);
      return { item: r, kind: (link && link[1]) || 'soft' };
    });

  const seenIds = new Set([
    doc.id,
    ...upstream.map((x) => x.item.id),
    ...downstream.map((x) => x.item.id),
  ]);

  const related = res
    .filter(
      (r) =>
        !seenIds.has(r.id) &&
        (r.node === doc.node || (r.tags || []).some((t) => (doc.tags || []).includes(t)))
    )
    .slice(0, 4)
    .map((item) => ({ item, kind: 'related' }));

  return { upstream, downstream, related };
}

function ImpactList({ title, subtitle, entries, emptyText, onRead }) {
  return html`<div className="lig-col">
    <div className="lig-col-h">
      <div>
        <b>${title} <span className="lig-cnt">(${entries.length})</span></b>
        ${subtitle && html`<p className="lig-col-sub">${subtitle}</p>`}
      </div>
    </div>
    ${entries.length > 0
      ? html`<div className="lig-list">
          ${entries.map(({ item, kind }) => {
            const st = ST[item.status] || ST.Approved;
            return html`<button
              key=${item.id}
              type="button"
              className="lig-node"
              onClick=${() => onRead && onRead(item.id)}
            >
              <span className="tile sm" style=${{ "--c": DC[item.disc] || "#8e8e93" }}>
                <${Ic} n=${item.type || "doc"} s=${14} />
              </span>
              <span className="lig-node-body">
                <b>${item.title}</b>
                <small>${item.disc} · ${TY[item.type] || "Document"}</small>
              </span>
              <span
                className="pill"
                style=${{ "--c": kind === "hard" ? "#ff375f" : kind === "related" ? "#8e8e93" : st[1] }}
              >
                ${kind === "hard" ? "Hard" : kind === "soft" ? "Soft" : "Related"}
              </span>
            </button>`;
          })}
        </div>`
      : html`<div className="lig-empty">${emptyText}</div>`}
  </div>`;
}

export function LocalImpactGraph({ item, revitCtx, relatedDocs = [], res = [], onRead, onInfo }) {
  const [mode, setMode] = useState('flow');

  const model = useMemo(() => {
    if (item) {
      const { upstream, downstream, related } = getNeighbors(item, res);
      const allOut = downstream.length > 0 ? downstream : related;
      const outTitle = downstream.length > 0 ? 'Used In / Impacts' : 'Related Standards';
      const outSub =
        downstream.length > 0
          ? 'Documents that depend on changes here'
          : 'Same discipline or shared tags';

      const subIds = new Set([
        item.id,
        ...upstream.map((x) => x.item.id),
        ...downstream.map((x) => x.item.id),
        ...related.map((x) => x.item.id),
      ]);
      const rawSub = res.filter((r) => subIds.has(r.id));
      const hasExplicit = upstream.length + downstream.length > 0;
      const localRes = hasExplicit
        ? rawSub
        : rawSub.map((r) =>
            r.id === item.id ? { ...r, links: related.map((x) => [x.item.id, 'soft']) } : r
          );

      return {
        focusId: item.id,
        focusLabel: item.title,
        focusMeta: `${item.disc} · ${TY[item.type] || 'Document'}`,
        focusColor: DC[item.disc] || '#0a84ff',
        upstream,
        outEntries: allOut,
        outTitle,
        outSub,
        totalCount: upstream.length + allOut.length,
        localRes,
      };
    }

    if (revitCtx) {
      const upstream = (relatedDocs || []).map((doc) => ({ item: doc, kind: 'hard' }));
      const upIds = new Set(upstream.map((x) => x.item.id));
      const seenDown = new Set(upIds);
      const downstream = [];
      for (const r of res) {
        if (seenDown.has(r.id)) continue;
        const hitsUp =
          (r.links || []).some(([toId]) => upIds.has(toId)) ||
          upstream.some((u) => (u.item.links || []).some(([toId]) => toId === r.id));
        if (hitsUp) {
          seenDown.add(r.id);
          downstream.push({ item: r, kind: 'soft' });
        }
        if (downstream.length >= 6) break;
      }

      const focusId = 'revit-focus';
      const virtualNode = {
        id: focusId,
        title: revitCtx.typeName || 'Selected Revit Type',
        desc: `${revitCtx.category || 'Element'}${revitCtx.family ? ' · ' + revitCtx.family : ''}`,
        disc: (upstream[0] && upstream[0].item.disc) || 'VDC',
        type: 'template',
        status: 'Approved',
        upd: '2026-11-14',
        v: [{ n: 1 }],
        tags: [],
        links: upstream.map((x) => [x.item.id, 'hard']),
      };
      const localRes = [virtualNode, ...res.filter((r) => seenDown.has(r.id))];

      return {
        focusId,
        focusLabel: revitCtx.typeName || 'Selected Revit Type',
        focusMeta: `${revitCtx.category || 'Revit'}${revitCtx.family ? ' · ' + revitCtx.family : ''}`,
        focusColor: '#0a84ff',
        upstream,
        outEntries: downstream,
        outTitle: 'Downstream Impacts',
        outSub: 'Adjacent standards & QA rules linked to these specs',
        totalCount: upstream.length + downstream.length,
        localRes,
      };
    }

    return null;
  }, [item, revitCtx, relatedDocs, res]);

  if (!model || model.totalCount === 0) return null;

  return html`<section className="lig-wrap" id="impact-graph">
    <div className="lig-head">
      <div className="lig-head-l">
        <h3>Dependency & Impact Map</h3>
        <p className="lig-sub">${model.upstream.length} upstream · ${model.outEntries.length} downstream</p>
      </div>
      <div className="lig-head-r">
        <div className="seg" role="tablist" aria-label="Dependency view mode">
          <button
            type="button"
            className=${mode === 'flow' ? 'on' : ''}
            onClick=${() => setMode('flow')}
          >
            Flow
          </button>
          <button
            type="button"
            className=${mode === 'graph' ? 'on' : ''}
            onClick=${() => setMode('graph')}
          >
            Graph
          </button>
        </div>
        ${item &&
        onInfo &&
        html`<button type="button" className="btn sm" onClick=${() => onInfo(item.id)}>
          <${Ic} n="layers" s=${14} /> Manage links
        </button>`}
      </div>
    </div>

    ${mode === 'flow'
      ? html`<div className="lig-grid">
          <${ImpactList}
            title=${item ? 'Depends On' : 'Governing Standards'}
            subtitle=${item ? 'Upstream codes & specs required' : 'Core Datum specs matched to this type'}
            entries=${model.upstream}
            emptyText="No upstream dependencies"
            onRead=${onRead}
          />
          <${ImpactList}
            title=${model.outTitle}
            subtitle=${model.outSub}
            entries=${model.outEntries}
            emptyText="No downstream impacts yet"
            onRead=${onRead}
          />
        </div>`
      : html`<div className="lig-canvas">
          <${Graph}
            res=${model.localRes}
            selId=${model.focusId}
            pick=${(id) => {
              if (id && id !== 'revit-focus' && onRead) onRead(id);
            }}
          />
        </div>`}
  </section>`;
}
