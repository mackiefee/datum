import { html, Fragment, useState, useMemo, useEffect, useRef } from '../../lib/react.js';
import {
  BUILTIN_NAMING_SCHEMAS,
  WALL_TYPES,
  LAYER_THICKNESSES,
  LAYER_CODES,
  STUD_CODES,
  INSULATION_CODES,
  OC_CODES,
  WALL_EXAMPLES,
  WALL_NOTES,
  WALL_CSV_DISCREPANCIES,
  importNamingSchemaFromCsv,
} from '../../data/namingSchemas.js';
import {
  DEFAULT_WALL_STATE,
  findWallTypeDef,
  parseLayerToken,
  parseStudPart,
  buildWallTypeName,
  parseAndValidateWallName,
  buildAssemblyFromWallState,
  batchAuditWallNames,
  batchAuditToCsv,
} from './namingEngine.js';
import { Assembly3DView } from '../assembly3d/Assembly3DView.js';
import { Select } from '../../components/Select.js';
import { Ic } from '../../components/Icon.js';
import { ls } from '../../utils/storage.js';

const STORAGE_SCHEMAS_KEY = 'datum-naming-custom-schemas-v1';

const SAMPLE_BATCH_AUDIT = [
  'C1010.10.01_PartitionWall_2HR/SR_0_5/8G_5/8G_6S_AI_5/8G_5/8G_0_16OC - B6 Smoke',
  'С1010.10.01_PartitionWall_NR_0_0_5/8G_2x6W_BI_5/8G_0_0_16OC - 23',
  'C1010.10.06_CMUWall_1HR_0_0_0_7-5/8CMU_BI_0_0_0_16OC - 70B',
  'C1010.10.05_DoubleStudWall_1HR_0_5/8G_5/8G_2-1/2S/1AG/2-1/2S_AI_5/8G_5/8G_0_16OC/16OC - 1MG2',
  'C1070.20.03_InteriorGWB Soffits_NR_0_0_5/8G_3-5/8S_0I_0_0_0_16OC - ',
  'C1010.90.05_GypsumLayer_2HR_0_5/8G_5/8G_0_0_0_0_0_0',
].join('\n');

const QUICK_PRESETS = [
  { id: 'std', label: 'Standard Partition', state: { ...DEFAULT_WALL_STATE } },
  { id: 'ex-1', label: '2HR Corridor', state: WALL_EXAMPLES[0].state },
  { id: 'ex-2', label: 'CMU Masonry', state: WALL_EXAMPLES[1].state },
  { id: 'ex-3', label: 'Double Stud', state: WALL_EXAMPLES[2].state },
  { id: 'ex-5b', label: 'Wood 2x6', state: WALL_EXAMPLES[5].state },
  { id: 'ex-6', label: 'GWB Soffit', state: WALL_EXAMPLES[6].state },
  { id: 'ex-7', label: 'Gypsum Layer', state: WALL_EXAMPLES[7].state },
];

const QUICK_FIRE_CODES = ['NR', '1/2HR', '1HR', '2HR', '3HR'];

function copyText(text, label, onToast) {
  const clean = String(text || '');
  try {
    if (navigator && navigator.clipboard) {
      navigator.clipboard.writeText(clean).catch(() => {});
    }
  } catch {}
  if (onToast) onToast(label || `Copied: ${clean}`);
}

function downloadTextFile(filename, content, mime = 'text/csv;charset=utf-8') {
  try {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {}
}

function getSideTokens(state, side) {
  const keys = side === 'ext' ? ['ext1', 'ext2', 'ext3'] : ['int1', 'int2', 'int3'];
  return keys
    .map((k) => ({ key: k, val: state[k] || '0' }))
    .filter((x) => x.val && x.val !== '0');
}

function applySideList(state, side, values) {
  const clean = values.filter((v) => v && v !== '0').slice(0, 3);
  if (side === 'ext') {
    const padded = [...Array(3 - clean.length).fill('0'), ...clean];
    return { ...state, ext1: padded[0], ext2: padded[1], ext3: padded[2] };
  }
  const padded = [...clean, ...Array(3 - clean.length).fill('0')];
  return { ...state, int1: padded[0], int2: padded[1], int3: padded[2] };
}

function DynamicLayerRow({ val, onChange, onRemove }) {
  const parsed = parseLayerToken(val);
  const thickVal = parsed.isZero ? '5/8' : parsed.thickness || '5/8';
  const codeVal = parsed.isZero ? 'G' : parsed.code || 'G';

  const thickOpts = LAYER_THICKNESSES.filter((t) => t !== '0').map((t) => [t, `${t}"`]);
  if (!LAYER_THICKNESSES.includes(thickVal)) {
    thickOpts.push([thickVal, `${thickVal}"`]);
  }
  const codeOpts = LAYER_CODES.filter((c) => c.code !== '0').map((c) => [c.code, `${c.code} · ${c.label}`, false, c.color]);

  return html`<div className="nm-dyn-row">
    <${Select}
      variant="field"
      ariaLabel="Board Thickness"
      value=${thickVal}
      options=${thickOpts}
      onChange=${(nextT) => onChange(`${nextT}${codeVal}`)}
      minMenuWidth=${105}
    />
    <${Select}
      variant="field"
      ariaLabel="Board Material"
      value=${codeVal}
      options=${codeOpts}
      onChange=${(nextC) => onChange(`${thickVal}${nextC}`)}
      minMenuWidth=${215}
    />
    <button type="button" className="nm-dyn-del" title="Remove layer" onClick=${onRemove}>
      <${Ic} n="x" s=${13} />
    </button>
  </div>`;
}

function StudPicker({ label, value, onChange, excludeCodes = [] }) {
  const parsed = parseStudPart(value);
  const codeVal = parsed.isZero ? '0S' : parsed.code || 'S';
  const studDef = STUD_CODES.find((x) => x.code === codeVal) || STUD_CODES[0];
  const sizeVal = codeVal === '0S' ? '0' : parsed.size || studDef.defaultSizes[0] || '3-5/8';

  const sizeOpts = (studDef.defaultSizes || ['3-5/8']).map((sz) => [sz, sz === '0' ? '0 (None)' : `${sz}"`]);
  if (sizeVal !== '0' && !sizeOpts.some(([v]) => v === sizeVal)) {
    sizeOpts.push([sizeVal, `${sizeVal}"`]);
  }

  const codeOpts = STUD_CODES.filter((c) => !excludeCodes.includes(c.code)).map((c) => [
    c.code,
    `${c.code} · ${c.label}`,
    false,
    c.color,
  ]);

  const handleCode = (nextCode) => {
    if (nextCode === '0S') {
      onChange('0S');
      return;
    }
    const def = STUD_CODES.find((x) => x.code === nextCode);
    const nextSize = def && def.defaultSizes ? def.defaultSizes[0] : '3-5/8';
    onChange(`${nextSize}${nextCode}`);
  };

  return html`<div className="nm-two-col">
    <${Select}
      variant="field"
      ariaLabel=${`${label} Framing Type`}
      value=${codeVal}
      options=${codeOpts}
      onChange=${handleCode}
      minMenuWidth=${225}
    />
    ${codeVal !== '0S' &&
    html`<${Select}
      variant="field"
      ariaLabel=${`${label} Size`}
      value=${sizeVal}
      options=${sizeOpts}
      onChange=${(nextS) => onChange(`${nextS}${codeVal}`)}
      minMenuWidth=${125}
    />`}
  </div>`;
}

export function NamingStudioView({
  initialTypeName = '',
  revitCtx = null,
  customSchemas: externalSchemas,
  onChangeCustomSchemas,
  onReadDoc,
  onToast,
}) {
  const [mode, setMode] = useState('builder');
  const [state, setState] = useState(() => ({ ...DEFAULT_WALL_STATE }));

  const [barDraft, setBarDraft] = useState('');
  const [customDraftActive, setCustomDraftActive] = useState(false);
  const [copiedJustNow, setCopiedJustNow] = useState(false);

  const [batchText, setBatchText] = useState(SAMPLE_BATCH_AUDIT);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTab, setSheetTab] = useState('codes');
  const [refQuery, setRefQuery] = useState('');

  const [localSchemas, setLocalSchemas] = useState(() => {
    const saved = ls.get(STORAGE_SCHEMAS_KEY);
    return Array.isArray(saved) ? saved : [];
  });
  const customSchemas = Array.isArray(externalSchemas) ? externalSchemas : localSchemas;
  const setCustomSchemas = (updater) => {
    const next = typeof updater === 'function' ? updater(customSchemas) : updater;
    ls.set(STORAGE_SCHEMAS_KEY, next);
    if (onChangeCustomSchemas) onChangeCustomSchemas(next);
    else setLocalSchemas(next);
  };
  const [activeSchemaId, setActiveSchemaId] = useState('walls-soffits');
  const [csvDraft, setCsvDraft] = useState('');
  const [csvPreview, setCsvPreview] = useState(null);

  const batchFileRef = useRef(null);
  const csvSchemaRef = useRef(null);

  useEffect(() => {
    if (!initialTypeName || !String(initialTypeName).trim()) return;
    const clean = String(initialTypeName).trim();
    const audit = parseAndValidateWallName(clean, revitCtx && revitCtx.layers, revitCtx && revitCtx.fire);
    if (audit && audit.parsedState) {
      setState(audit.parsedState);
    }
    setBarDraft(clean);
    setCustomDraftActive(true);
    setMode('builder');
  }, [initialTypeName, revitCtx]);

  const built = useMemo(() => buildWallTypeName(state), [state]);
  const def = useMemo(() => findWallTypeDef(state.partitionType) || WALL_TYPES[0], [state.partitionType]);
  const isCmu = def.type === 'CMUWall';
  const isShort = Boolean(def.shortFormat);

  const activeBarText = customDraftActive ? barDraft : built.name;
  const barAudit = useMemo(
    () => parseAndValidateWallName(activeBarText, revitCtx && revitCtx.layers, revitCtx && revitCtx.fire),
    [activeBarText, revitCtx]
  );

  const liveAssembly = useMemo(() => buildAssemblyFromWallState(state, built.name), [state, built.name]);
  const batchResults = useMemo(() => batchAuditWallNames(batchText), [batchText]);
  const batchStats = useMemo(() => {
    const valid = batchResults.filter((r) => r.status === 'valid').length;
    const warn = batchResults.filter((r) => r.status === 'warn').length;
    const error = batchResults.filter((r) => r.status === 'error').length;
    return { total: batchResults.length, valid, warn, error };
  }, [batchResults]);

  const activeCustomSchema = useMemo(
    () => customSchemas.find((s) => s.id === activeSchemaId) || null,
    [customSchemas, activeSchemaId]
  );

  const updateState = (updater) => {
    setCustomDraftActive(false);
    setState((prev) => (typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }));
  };

  const applyPartitionType = (nextType) => {
    const d = findWallTypeDef(nextType) || WALL_TYPES[0];
    const nextIsCmu = d.type === 'CMUWall';
    const nextIsDouble = d.type === 'DoubleStudWall';
    updateState((prev) => ({
      ...prev,
      unicode: d.unicode,
      partitionType: d.type,
      doubleStudMode: nextIsDouble ? true : nextIsCmu ? false : prev.doubleStudMode,
      stud1: nextIsCmu ? '7-5/8CMU' : prev.stud1.endsWith('CMU') ? '3-5/8S' : prev.stud1,
      stud2: nextIsDouble && !prev.stud2 ? '2-1/2S' : prev.stud2,
      airGap: nextIsDouble && !prev.airGap ? '1AG' : prev.airGap,
      insulation: nextIsCmu ? '0I' : prev.insulation === '0I' && nextIsDouble ? 'AI' : prev.insulation,
      oc: nextIsCmu ? '0OC' : nextIsDouble ? '16OC/16OC' : prev.oc === '0OC' ? '16OC' : prev.oc,
    }));
  };

  const handleBarInput = (val) => {
    setBarDraft(val);
    setCustomDraftActive(true);
    const audit = parseAndValidateWallName(val, revitCtx && revitCtx.layers, revitCtx && revitCtx.fire);
    if (audit && audit.parsedState && val.includes('_')) {
      setState(audit.parsedState);
    }
  };

  const handleAutoFix = () => {
    if (barAudit && barAudit.parsedState) {
      setState(barAudit.parsedState);
    }
    setCustomDraftActive(false);
    if (onToast && barAudit) onToast(`Auto-fixed: ${barAudit.autoFixed}`);
  };

  const handleCopyBar = () => {
    const target = barAudit && barAudit.changedByFix && customDraftActive ? activeBarText : built.name;
    copyText(target, `Copied: ${target}`, onToast);
    setCopiedJustNow(true);
    setTimeout(() => setCopiedJustNow(false), 1400);
  };

  const extLayers = useMemo(() => getSideTokens(state, 'ext'), [state]);
  const intLayers = useMemo(() => getSideTokens(state, 'int'), [state]);

  const handleSchemaCsvUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const txt = String(reader.result || '');
      setCsvDraft(txt);
      setCsvPreview(importNamingSchemaFromCsv(txt, file.name));
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleBatchUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setBatchText(String(reader.result || ''));
    reader.readAsText(file);
    e.target.value = '';
  };

  const saveImportedSchema = () => {
    if (!csvPreview) return;
    setCustomSchemas((prev) => [csvPreview, ...prev.filter((x) => x.id !== csvPreview.id)]);
    setActiveSchemaId(csvPreview.id);
    setSheetOpen(false);
    if (onToast) onToast(`Saved schema: ${csvPreview.name}`);
  };

  const filteredRefQ = refQuery.trim().toLowerCase();

  return html`<div className="nm-wrap">
    <div className="pdl-top pdl-top-sub" style=${{ marginBottom: 0 }}>
      <div className="pdl-top-l">
        ${activeCustomSchema && html`<span style=${{ fontSize: 15, fontWeight: 650, color: 'var(--text)' }}>${activeCustomSchema.name}</span>`}
        <span className="pdl-cnt">
          ${activeCustomSchema ? `${activeCustomSchema.slots.length} slots` : `${liveAssembly.thickness.split(' ')[0]} mm`}
        </span>
      </div>

      <div className="pdl-top-r">
        ${customSchemas.length > 0 &&
        html`<${Select}
          variant="filter"
          ariaLabel="Naming Schema"
          value=${activeSchemaId}
          options=${[
            ...BUILTIN_NAMING_SCHEMAS.map((s) => [s.id, s.name]),
            ...customSchemas.map((cs) => [cs.id, cs.name]),
          ]}
          onChange=${(id) => setActiveSchemaId(id)}
          minMenuWidth=${220}
        />`}

        <div className="nm-seg-pill" role="tablist" aria-label="Naming Studio modes">
          <button
            type="button"
            role="tab"
            aria-selected=${mode === 'builder'}
            className=${mode === 'builder' ? 'on' : ''}
            onClick=${() => setMode('builder')}
          >
            Builder
          </button>
          <button
            type="button"
            role="tab"
            aria-selected=${mode === 'batch'}
            className=${mode === 'batch' ? 'on' : ''}
            onClick=${() => setMode('batch')}
          >
            Batch Audit${batchStats.error > 0 ? ` (${batchStats.error})` : ''}
          </button>
        </div>

        ${onReadDoc &&
        html`<button type="button" className="btn" onClick=${() => onReadDoc(137)}>
          Spec #137 ↗
        </button>`}

        <button
          type="button"
          className="btn"
          onClick=${() => {
            setSheetTab('codes');
            setSheetOpen(true);
          }}
        >
          <${Ic} n="book" s=${14} /> Codes & CSV
        </button>
      </div>
    </div>

    ${activeCustomSchema &&
    html`<div className="nm-card">
      <div className="nm-out-top">
        <div>
          <h3 className="nm-sec-title">${activeCustomSchema.name}</h3>
          <p className="nm-sub">${activeCustomSchema.slots.length} slots · ${activeCustomSchema.codes.length} legend codes extracted from CSV</p>
        </div>
        <div className="nm-seg-row">
          ${activeCustomSchema.typeCandidates &&
          activeCustomSchema.typeCandidates.length > 0 &&
          html`<button
            type="button"
            className="btn sm p"
            onClick=${() => {
              setBatchText(activeCustomSchema.typeCandidates.join('\n'));
              setMode('batch');
            }}
          >
            Audit ${activeCustomSchema.typeCandidates.length} Examples
          </button>`}
          <button
            type="button"
            className="btn sm"
            onClick=${() => {
              setCustomSchemas((prev) => prev.filter((x) => x.id !== activeCustomSchema.id));
              setActiveSchemaId('walls-soffits');
            }}
          >
            <${Ic} n="trash" s=${13} /> Remove
          </button>
          <button type="button" className="btn sm" onClick=${() => setActiveSchemaId('walls-soffits')}>
            Back to Wall Builder
          </button>
        </div>
      </div>
      <div className="nm-slots">
        ${activeCustomSchema.slots.map(
          (sl) => html`<span key=${sl.key} className="nm-slot">
            <span className="nm-slot-n">${sl.num}</span>
            <span className="nm-slot-v">${sl.label}</span>
          </span>`
        )}
      </div>
      ${activeCustomSchema.codes &&
      activeCustomSchema.codes.length > 0 &&
      html`<table className="nm-ref-table">
        <thead><tr><th>Code</th><th>Meaning</th></tr></thead>
        <tbody>
          ${activeCustomSchema.codes.map(
            (c, i) => html`<tr key=${i}><td><code>${c.code}</code></td><td>${c.meaning}</td></tr>`
          )}
        </tbody>
      </table>`}
    </div>`}

    ${!activeCustomSchema &&
    mode === 'builder' &&
    html`<${Fragment}>
      <div className="nm-typebar-wrap">
        <div
          className=${`nm-typebar ${
            barAudit.status === 'error' ? 'has-issue' : barAudit.status === 'warn' ? 'has-warn' : ''
          }`}
        >
          <span className=${`nm-status ${barAudit.status}`}>
            <span className="nm-dot"></span>
            ${barAudit.status === 'valid'
              ? 'Valid'
              : barAudit.status === 'warn'
              ? 'Review'
              : `${barAudit.issues.filter((i) => i.level === 'error').length} Issue`}
          </span>

          <input
            type="text"
            className="nm-bar-inp"
            aria-label="Revit Type Name (build or paste to validate)"
            placeholder="Paste an existing Revit type name or build below..."
            value=${activeBarText}
            onInput=${(e) => handleBarInput(e.target.value)}
            spellcheck=${false}
          />

          <div className="nm-bar-acts">
            ${barAudit.changedByFix &&
            html`<button type="button" className="btn sm" onClick=${handleAutoFix}>
              Auto-Fix
            </button>`}
            <button type="button" className="btn sm p" onClick=${handleCopyBar}>
              <${Ic} n=${copiedJustNow ? 'check' : 'dup'} s=${13} /> ${copiedJustNow ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        ${barAudit.issues.filter((i) => i.level === 'error' || i.level === 'warn').length > 0 &&
        html`<div className=${`nm-bar-alert ${barAudit.status === 'warn' ? 'warn' : ''}`}>
          <span>
            ${barAudit.issues
              .filter((i) => i.level === 'error' || i.level === 'warn')
              .map((i) => i.message)
              .join(' · ')}
          </span>
          ${barAudit.changedByFix &&
          html`<button type="button" className="btn sm" onClick=${handleAutoFix}>
            Apply Fix
          </button>`}
        </div>`}

        <div className="nm-quick-row">
          ${QUICK_PRESETS.map((pr) => {
            const prName = buildWallTypeName(pr.state).name;
            return html`<button
              key=${pr.id}
              type="button"
              className=${`nm-quick-chip ${!customDraftActive && built.name === prName ? 'on' : ''}`}
              onClick=${() => updateState(() => ({ ...pr.state }))}
            >
              ${pr.label}
            </button>`;
          })}
        </div>
      </div>

      <div className="nm-workspace">
        <div className="nm-canvas-col">
          <${Assembly3DView}
            embedded=${true}
            compact=${true}
            customAssembly=${liveAssembly}
            onRead=${onReadDoc}
            onToast=${onToast}
          />
        </div>

        <aside className="nm-inspector" aria-label="Wall Properties">
          <section className="nm-group">
            <div className="nm-group-hd">
              <span className="nm-group-title">Wall & Fire Rating</span>
              <span className="nm-group-code">${def.unicode} · ${def.type}</span>
            </div>

            <${Select}
              variant="field"
              ariaLabel="Wall Type"
              value=${state.partitionType}
              options=${WALL_TYPES.map((t) => [t.type, `${t.label} (${t.type})`, false, null, t.unicode])}
              onChange=${applyPartitionType}
              minMenuWidth=${275}
            />

            <div className="nm-seg-row">
              <div className="nm-seg-pill compact" role="group" aria-label="Fire Rating">
                ${QUICK_FIRE_CODES.map(
                  (fc) => html`<button
                    key=${fc}
                    type="button"
                    className=${state.fireRating === fc ? 'on' : ''}
                    onClick=${() => updateState((p) => ({ ...p, fireRating: fc }))}
                  >
                    ${fc}
                  </button>`
                )}
              </div>
              <button
                type="button"
                className=${`nm-sr-btn ${state.smokeResistant ? 'on' : ''}`}
                title="Smoke Resistant (/SR)"
                onClick=${() => updateState((p) => ({ ...p, smokeResistant: !p.smokeResistant }))}
              >
                + /SR
              </button>
            </div>
          </section>

          <section className="nm-group">
            <div className="nm-group-hd">
              <span className="nm-group-title">Side 1 · Finish</span>
              ${extLayers.length < 3 &&
              html`<button
                type="button"
                className="btn sm"
                style=${{ height: '28px', fontSize: '12px', padding: '0 10px' }}
                onClick=${() => updateState((p) => applySideList(p, 'ext', [...extLayers.map((x) => x.val), '5/8G']))}
              >
                <${Ic} n="plus" s=${12} /> Add Layer
              </button>`}
            </div>

            ${extLayers.length > 0
              ? html`<div className="nm-dyn-list">
                  ${extLayers.map(
                    (item, idx) => html`<${DynamicLayerRow}
                      key=${item.key}
                      val=${item.val}
                      onChange=${(nextV) => {
                        const arr = extLayers.map((x, i) => (i === idx ? nextV : x.val));
                        updateState((p) => applySideList(p, 'ext', arr));
                      }}
                      onRemove=${() => {
                        const arr = extLayers.filter((_, i) => i !== idx).map((x) => x.val);
                        updateState((p) => applySideList(p, 'ext', arr));
                      }}
                    />`
                  )}
                </div>`
              : html`<div className="nm-empty-line">No Side 1 boards (<code>0</code>)</div>`}
          </section>

          ${isShort
            ? html`<section className="nm-group">
                <div className="nm-lock-note">
                  <strong>Short 6-slot standard:</strong> <code>GypsumLayer</code> stops right after Side 1 layers (Core, Insulation, Side 2 and O.C. are omitted).
                </div>
              </section>`
            : html`<${Fragment}>
                <section className="nm-group">
                  <div className="nm-group-hd">
                    <span className="nm-group-title">Framing & Insulation</span>
                    ${!isCmu &&
                    html`<div className="nm-seg-pill compact" style=${{ flex: 'none', width: '148px' }}>
                      <button
                        type="button"
                        className=${!state.doubleStudMode ? 'on' : ''}
                        onClick=${() => updateState((p) => ({ ...p, doubleStudMode: false }))}
                      >
                        Single
                      </button>
                      <button
                        type="button"
                        className=${state.doubleStudMode ? 'on' : ''}
                        onClick=${() =>
                          updateState((p) => ({
                            ...p,
                            doubleStudMode: true,
                            stud2: p.stud2 || p.stud1,
                            airGap: p.airGap || '1AG',
                          }))
                        }
                      >
                        Double
                      </button>
                    </div>`}
                  </div>

                  <${StudPicker}
                    label="Primary"
                    value=${state.stud1}
                    excludeCodes=${['AG']}
                    onChange=${(v) => updateState((p) => ({ ...p, stud1: v }))}
                  />

                  ${state.doubleStudMode &&
                  !isCmu &&
                  html`<${Fragment}>
                    <${StudPicker}
                      label="Secondary"
                      value=${state.stud2 || '2-1/2S'}
                      excludeCodes=${['AG', 'CMU']}
                      onChange=${(v) => updateState((p) => ({ ...p, stud2: v }))}
                    />
                    <div className="nm-two-col" style=${{ alignItems: 'center' }}>
                      <${Select}
                        variant="field"
                        ariaLabel="Air Gap"
                        value=${state.airGap || '1AG'}
                        options=${[
                          ['', 'No Air Gap'],
                          ['1AG', '1AG (1" Gap)'],
                          ['1-1/2AG', '1-1/2AG'],
                          ['2AG', '2AG (2" Gap)'],
                        ]}
                        onChange=${(v) => updateState((p) => ({ ...p, airGap: v }))}
                        minMenuWidth=${165}
                      />
                      <button
                        type="button"
                        className="nm-switch-row"
                        onClick=${() => updateState((p) => ({ ...p, fiveDBd: !p.fiveDBd }))}
                      >
                        <span>5D&BD (strip AG)</span>
                        <span className=${`nm-switch-pill ${state.fiveDBd ? 'on' : ''}`}></span>
                      </button>
                    </div>
                  </${Fragment}>`}

                  ${isCmu
                    ? html`<div className="nm-lock-note">
                        <code>CMUWall</code> enforces Insulation = <code>0I</code> and Spacing = <code>0OC</code>.
                      </div>`
                    : html`<${Fragment}>
                        <div className="nm-seg-row">
                          <div className="nm-seg-pill compact" role="group" aria-label="Insulation">
                            ${INSULATION_CODES.map(
                              (ins) => html`<button
                                key=${ins.code}
                                type="button"
                                className=${state.insulation === ins.code ? 'on' : ''}
                                title=${ins.desc}
                                onClick=${() => updateState((p) => ({ ...p, insulation: ins.code }))}
                              >
                                ${ins.code}
                              </button>`
                            )}
                          </div>
                        </div>
                        <div className="nm-seg-row">
                          <div className="nm-seg-pill compact" role="group" aria-label="Stud Spacing">
                            ${(state.doubleStudMode
                              ? ['16OC/16OC', '16OC/24OC', '16OC', '24OC']
                              : ['16OC', '24OC', '12OC', '0OC']
                            ).map(
                              (oc) => html`<button
                                key=${oc}
                                type="button"
                                className=${state.oc === oc ? 'on' : ''}
                                onClick=${() => updateState((p) => ({ ...p, oc }))}
                              >
                                ${oc}
                              </button>`
                            )}
                          </div>
                        </div>
                      </${Fragment}>`}
                </section>

                <section className="nm-group">
                  <div className="nm-group-hd">
                    <span className="nm-group-title">Side 2 · Finish & DD Tag</span>
                    <div style=${{ display: 'flex', gap: '6px' }}>
                      ${extLayers.length > 0 &&
                      html`<button
                        type="button"
                        className="btn sm"
                        style=${{ height: '28px', fontSize: '12px', padding: '0 10px' }}
                        title="Copy Side 1 boards cleanly onto Side 2"
                        onClick=${() =>
                          updateState((p) =>
                            applySideList(
                              p,
                              'int',
                              [...extLayers].reverse().map((x) => x.val)
                            )
                          )
                        }
                      >
                        Mirror Side 1
                      </button>`}
                      ${intLayers.length < 3 &&
                      html`<button
                        type="button"
                        className="btn sm"
                        style=${{ height: '28px', fontSize: '12px', padding: '0 10px' }}
                        onClick=${() => updateState((p) => applySideList(p, 'int', [...intLayers.map((x) => x.val), '5/8G']))}
                      >
                        <${Ic} n="plus" s=${12} /> Add Layer
                      </button>`}
                    </div>
                  </div>

                  ${intLayers.length > 0
                    ? html`<div className="nm-dyn-list">
                        ${intLayers.map(
                          (item, idx) => html`<${DynamicLayerRow}
                            key=${item.key}
                            val=${item.val}
                            onChange=${(nextV) => {
                              const arr = intLayers.map((x, i) => (i === idx ? nextV : x.val));
                              updateState((p) => applySideList(p, 'int', arr));
                            }}
                            onRemove=${() => {
                              const arr = intLayers.filter((_, i) => i !== idx).map((x) => x.val);
                              updateState((p) => applySideList(p, 'int', arr));
                            }}
                          />`
                        )}
                      </div>`
                    : html`<div className="nm-empty-line">No Side 2 boards (<code>0</code>)</div>`}

                  <button
                    type="button"
                    className="nm-switch-row"
                    onClick=${() => updateState((p) => ({ ...p, byAssumption: !p.byAssumption }))}
                  >
                    <span>${state.byAssumption ? 'By Assumption (DD Tag omitted)' : 'Tagged on DD (` - <Tag>`)'}</span>
                    <span className=${`nm-switch-pill ${!state.byAssumption ? 'on' : ''}`}></span>
                  </button>

                  ${!state.byAssumption &&
                  html`<div className="nm-two-col">
                    <input
                      type="text"
                      className="inp"
                      placeholder="DD Tag (e.g. B6, 1MG2)"
                      value=${state.tag}
                      onInput=${(e) => updateState((p) => ({ ...p, tag: e.target.value }))}
                    />
                    <input
                      type="text"
                      className="inp"
                      placeholder="Optional Note (e.g. Smoke)"
                      value=${state.tagNote}
                      onInput=${(e) => updateState((p) => ({ ...p, tagNote: e.target.value }))}
                    />
                  </div>`}
                </section>
              </${Fragment}>`}
        </aside>
      </div>
    <//>`}

    ${!activeCustomSchema &&
    mode === 'batch' &&
    html`<section className="nm-card">
      <div className="nm-out-top">
        <div>
          <h3 className="nm-sec-title">Batch Schedule Audit</h3>
        </div>
        <div className="nm-seg-row">
          <input ref=${batchFileRef} type="file" accept=".csv,.tsv,.txt" hidden onChange=${handleBatchUpload} />
          <button type="button" className="btn sm" onClick=${() => batchFileRef.current && batchFileRef.current.click()}>
            Upload CSV
          </button>
          <button type="button" className="btn sm" onClick=${() => setBatchText(SAMPLE_BATCH_AUDIT)}>
            Load Sample Bugs
          </button>
          <button
            type="button"
            className="btn sm"
            onClick=${() =>
              copyText(
                batchResults.map((r) => r.autoFixed || r.raw).join('\n'),
                `Copied ${batchResults.length} fixed names`,
                onToast
              )
            }
          >
            <${Ic} n="dup" s=${13} /> Copy All Fixed
          </button>
          <button
            type="button"
            className="btn sm p"
            onClick=${() => downloadTextFile('datum-wall-naming-audit.csv', batchAuditToCsv(batchResults))}
          >
            Export CSV
          </button>
        </div>
      </div>

      <textarea
        className="nm-batch-ta"
        placeholder="Paste Revit Wall Type names (one per line) or CSV schedule export..."
        value=${batchText}
        onInput=${(e) => setBatchText(e.target.value)}
      />

      <div className="nm-stats-pills">
        <span className="nm-status valid">${batchStats.valid} Valid</span>
        <span className="nm-status warn">${batchStats.warn} Warnings</span>
        <span className="nm-status error">${batchStats.error} Errors</span>
      </div>

      <div className="nm-batch-list">
        ${batchResults.map(
          (r) => html`<div key=${r.rowNum} className="nm-batch-row">
            <div className="nm-batch-row-hd">
              <div style=${{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span className="nm-sub">#${r.rowNum}</span>
                <span className=${`nm-status ${r.status}`}>
                  ${r.status === 'valid' ? 'Valid' : r.status === 'warn' ? 'Review' : 'Error'}
                </span>
                <span className="nm-batch-row-code">${r.raw}</span>
              </div>
              <div style=${{ display: 'flex', gap: '6px' }}>
                ${r.changedByFix &&
                html`<button
                  type="button"
                  className="btn sm"
                  onClick=${() => copyText(r.autoFixed, `Copied fixed: ${r.autoFixed}`, onToast)}
                >
                  Copy Fixed
                </button>`}
                <button
                  type="button"
                  className="btn sm"
                  onClick=${() => {
                    if (r.parsedState) setState(r.parsedState);
                    setBarDraft(r.raw);
                    setCustomDraftActive(r.changedByFix);
                    setMode('builder');
                  }}
                >
                  Edit in Builder
                </button>
              </div>
            </div>
            ${r.issues.length > 0 &&
            html`<div className="nm-issue-list">
              ${r.issues.map(
                (iss, i) => html`<div key=${i} className=${`nm-issue ${iss.level}`}>${iss.message}</div>`
              )}
            </div>`}
          </div>`
        )}
      </div>
    </section>`}

    ${sheetOpen &&
    html`<div
      className="nm-sheet-ov"
      onClick=${(e) => {
        if (e.target === e.currentTarget) setSheetOpen(false);
      }}
    >
      <div className="nm-sheet" role="dialog" aria-modal="true" aria-label="Codes and CSV Schemas">
        <div className="nm-sheet-hd">
          <div className="nm-seg-pill">
            <button
              type="button"
              className=${sheetTab === 'codes' ? 'on' : ''}
              onClick=${() => setSheetTab('codes')}
            >
              Code Reference
            </button>
            <button
              type="button"
              className=${sheetTab === 'csv' ? 'on' : ''}
              onClick=${() => setSheetTab('csv')}
            >
              CSV Import
            </button>
          </div>
          <div style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            ${onReadDoc &&
            html`<button
              type="button"
              className="btn sm"
              onClick=${() => {
                setSheetOpen(false);
                onReadDoc(137);
              }}
            >
              Open Doc #137 ↗
            </button>`}
            <button type="button" className="btn sm" aria-label="Close" onClick=${() => setSheetOpen(false)}>
              <${Ic} n="x" s=${14} />
            </button>
          </div>
        </div>

        <div className="nm-sheet-body">
          ${sheetTab === 'codes' &&
          html`<${Fragment}>
            <input
              type="search"
              className="inp"
              placeholder="Filter short codes (e.g. CH, BI, 0I, AG, GL, CMU)..."
              value=${refQuery}
              onInput=${(e) => setRefQuery(e.target.value)}
            />

            <table className="nm-ref-table">
              <thead><tr><th>Code</th><th>Category</th><th>Meaning</th></tr></thead>
              <tbody>
                ${[
                  ...STUD_CODES.map((x) => ({ code: x.code, cat: 'Stud / Core', desc: x.desc })),
                  ...LAYER_CODES.map((x) => ({ code: x.code, cat: 'Finish Layer', desc: x.desc })),
                  ...INSULATION_CODES.map((x) => ({ code: x.code, cat: 'Insulation', desc: x.desc })),
                  ...OC_CODES.map((x) => ({ code: x.code, cat: 'O.C. Spacing', desc: x.desc })),
                  ...WALL_TYPES.map((x) => ({ code: x.unicode, cat: x.type, desc: x.label })),
                ]
                  .filter(
                    (row) => !filteredRefQ || `${row.code} ${row.cat} ${row.desc}`.toLowerCase().includes(filteredRefQ)
                  )
                  .map(
                    (row, i) => html`<tr key=${i}>
                      <td><code>${row.code}</code></td>
                      <td>${row.cat}</td>
                      <td>${row.desc}</td>
                    </tr>`
                  )}
              </tbody>
            </table>

            <div>
              <h3 className="nm-sec-title" style=${{ marginBottom: '8px' }}>CSV Audit Discrepancies & Standard Rules</h3>
              <div className="nm-issue-list">
                ${WALL_NOTES.filter(
                  (n) => !filteredRefQ || `${n.title} ${n.text}`.toLowerCase().includes(filteredRefQ)
                ).map(
                  (n) => html`<div key=${n.id} className="nm-issue">
                    <strong>${n.title}: </strong>${n.text}
                  </div>`
                )}
                ${WALL_CSV_DISCREPANCIES.filter(
                  (d) => !filteredRefQ || `${d.row} ${d.issue}`.toLowerCase().includes(filteredRefQ)
                ).map(
                  (d, i) => html`<div key=${i} className="nm-issue warn">
                    <strong>${d.row}: </strong>${d.issue}
                  </div>`
                )}
              </div>
            </div>
          </${Fragment}>`}

          ${sheetTab === 'csv' &&
          html`<${Fragment}>
            <div className="nm-out-top">
              <div>
                <h3 className="nm-sec-title">Import Naming Schema CSV</h3>
                <p className="nm-sub">Add Doors, Ceilings, Floors or Materials CSV tables formatted with slots & legend codes.</p>
              </div>
              <input ref=${csvSchemaRef} type="file" accept=".csv,.txt" hidden onChange=${handleSchemaCsvUpload} />
              <button type="button" className="btn sm p" onClick=${() => csvSchemaRef.current && csvSchemaRef.current.click()}>
                <${Ic} n="plus" s=${13} /> Choose .CSV File
              </button>
            </div>

            <textarea
              className="nm-batch-ta"
              placeholder="Or paste raw .csv naming table contents here..."
              value=${csvDraft}
              onInput=${(e) => {
                const val = e.target.value;
                setCsvDraft(val);
                setCsvPreview(val.trim() ? importNamingSchemaFromCsv(val, 'Pasted Naming CSV') : null);
              }}
            />

            ${csvPreview &&
            html`<div className="nm-card" style=${{ background: 'var(--fill)' }}>
              <div className="nm-out-top">
                <div>
                  <strong>${csvPreview.name}</strong>
                  <div className="nm-sub">
                    ${csvPreview.slots.length} slots · ${csvPreview.codes.length} legend codes · ${csvPreview.examples.length} examples
                  </div>
                </div>
                <button type="button" className="btn sm p" onClick=${saveImportedSchema}>
                  Save Schema
                </button>
              </div>
              <div className="nm-slots">
                ${csvPreview.slots.map(
                  (sl) => html`<span key=${sl.key} className="nm-slot">
                    <span className="nm-slot-n">${sl.num}</span>
                    <span className="nm-slot-v">${sl.label}</span>
                  </span>`
                )}
              </div>
            </div>`}
          </${Fragment}>`}
        </div>
      </div>
    </div>`}
  </div>`;
}
