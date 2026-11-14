import { html, useState, useMemo, useEffect, useRef } from '../../lib/react.js';
import { ASSEMBLIES_3D } from '../../data/assemblies3d.js';
import { Ic } from '../../components/Icon.js';

function degToRad(d) {
  return (d * Math.PI) / 180;
}

function projectPoint(x, y, z, yawRad, pitchRad, zoom, cx, cy) {
  // Rotate around Y (yaw)
  const cosY = Math.cos(yawRad);
  const sinY = Math.sin(yawRad);
  const x1 = x * cosY + z * sinY;
  const z1 = -x * sinY + z * cosY;

  // Rotate around X (pitch)
  const cosP = Math.cos(pitchRad);
  const sinP = Math.sin(pitchRad);
  const y2 = y * cosP - z1 * sinP;
  const z2 = y * sinP + z1 * cosP;

  // Mild perspective projection
  const fov = 760;
  const scale = (fov / (fov + z2)) * zoom;
  return {
    sx: cx + x1 * scale,
    sy: cy - y2 * scale,
    depth: z2,
  };
}

function shadeHex(hex, factor) {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = Math.min(255, Math.max(0, Math.round(parseInt(clean.slice(0, 2), 16) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(parseInt(clean.slice(2, 4), 16) * factor)));
  const b = Math.min(255, Math.max(0, Math.round(parseInt(clean.slice(4, 6), 16) * factor)));
  return `rgb(${r}, ${g}, ${b})`;
}

function buildLayerFaces(layer, zCenter, yawRad, pitchRad, zoom, cx, cy) {
  const hw = layer.width / 2;
  const hh = layer.height / 2;
  const hd = layer.depth / 2;
  const z0 = zCenter - hd;
  const z1 = zCenter + hd;

  // 8 corners of the 3D prism
  const pts = [
    [-hw, -hh, z0], // 0: back-bottom-left
    [hw, -hh, z0],  // 1: back-bottom-right
    [hw, hh, z0],   // 2: back-top-right
    [-hw, hh, z0],  // 3: back-top-left
    [-hw, -hh, z1], // 4: front-bottom-left
    [hw, -hh, z1],  // 5: front-bottom-right
    [hw, hh, z1],   // 6: front-top-right
    [-hw, hh, z1],  // 7: front-top-left
  ].map(([x, y, z]) => projectPoint(x, y, z, yawRad, pitchRad, zoom, cx, cy));

  const facesDef = [
    { idx: [4, 5, 6, 7], shade: 1.0, name: 'front' },
    { idx: [1, 0, 3, 2], shade: 0.72, name: 'back' },
    { idx: [5, 1, 2, 6], shade: 0.76, name: 'right' },
    { idx: [0, 4, 7, 3], shade: 0.84, name: 'left' },
    { idx: [3, 7, 6, 2], shade: 1.16, name: 'top' },
    { idx: [0, 1, 5, 4], shade: 0.56, name: 'bottom' },
  ];

  // Back-face culling in 2D screen space (signed area) + painter depth
  const visibleFaces = [];
  for (const f of facesDef) {
    const p = f.idx.map((i) => pts[i]);
    const cross =
      (p[1].sx - p[0].sx) * (p[2].sy - p[0].sy) -
      (p[1].sy - p[0].sy) * (p[2].sx - p[0].sx);
    if (cross < 0) {
      const avgDepth = p.reduce((s, pt) => s + pt.depth, 0) / 4;
      visibleFaces.push({
        layerId: layer.id,
        points: p.map((pt) => `${pt.sx.toFixed(1)},${pt.sy.toFixed(1)}`).join(' '),
        depth: avgDepth,
        fill: shadeHex(layer.color, f.shade),
        edge: layer.edgeColor,
        opacity: layer.opacity,
        faceName: f.name,
        pts: p,
      });
    }
  }
  visibleFaces.sort((a, b) => b.depth - a.depth);

  // Optional CAD internal detail lines on the front face (studs / channels / insulation)
  const detailLines = [];
  const frontFace = visibleFaces.find((f) => f.faceName === 'front');
  if (frontFace && layer.pattern === 'studs') {
    for (let x = -hw + 36; x <= hw - 36; x += 48) {
      const top = projectPoint(x, hh - 4, zCenter + hd + 0.5, yawRad, pitchRad, zoom, cx, cy);
      const bot = projectPoint(x, -hh + 4, zCenter + hd + 0.5, yawRad, pitchRad, zoom, cx, cy);
      detailLines.push({ x1: top.sx, y1: top.sy, x2: bot.sx, y2: bot.sy });
    }
  } else if (frontFace && layer.pattern === 'channel') {
    for (let y = -hh + 28; y <= hh - 28; y += 38) {
      const lft = projectPoint(-hw + 4, y, zCenter + hd + 0.5, yawRad, pitchRad, zoom, cx, cy);
      const rgt = projectPoint(hw - 4, y, zCenter + hd + 0.5, yawRad, pitchRad, zoom, cx, cy);
      detailLines.push({ x1: lft.sx, y1: lft.sy, x2: rgt.sx, y2: rgt.sy });
    }
  } else if (frontFace && layer.pattern === 'insulation') {
    for (let y = -hh + 26; y <= hh - 26; y += 28) {
      const lft = projectPoint(-hw + 14, y, zCenter + hd + 0.5, yawRad, pitchRad, zoom, cx, cy);
      const rgt = projectPoint(hw - 14, y + 10, zCenter + hd + 0.5, yawRad, pitchRad, zoom, cx, cy);
      detailLines.push({ x1: lft.sx, y1: lft.sy, x2: rgt.sx, y2: rgt.sy });
    }
  }

  const centerProj = projectPoint(0, 0, zCenter, yawRad, pitchRad, zoom, cx, cy);
  return { prismDepth: centerProj.depth, visibleFaces, detailLines };
}

export function Assembly3DView({ initialAssemblyId = null, customAssembly = null, embedded = false, onRead, onToast }) {
  const [assemblyId, setAssemblyId] = useState(
    () => initialAssemblyId || ASSEMBLIES_3D[0].id
  );
  const assembly = useMemo(
    () => customAssembly || ASSEMBLIES_3D.find((a) => a.id === assemblyId) || ASSEMBLIES_3D[0],
    [customAssembly, assemblyId]
  );

  useEffect(() => {
    if (initialAssemblyId && ASSEMBLIES_3D.some((a) => a.id === initialAssemblyId)) {
      setAssemblyId(initialAssemblyId);
    }
  }, [initialAssemblyId]);

  const [selectedLayerId, setSelectedLayerId] = useState(assembly.layers[0].id);
  const [hiddenLayers, setHiddenLayers] = useState({});
  const [explode, setExplode] = useState(55);
  const [yaw, setYaw] = useState(-34);
  const [pitch, setPitch] = useState(20);
  const [zoom, setZoom] = useState(1.05);
  const dragRef = useRef(null);

  useEffect(() => {
    setSelectedLayerId(assembly.layers[0].id);
    setHiddenLayers({});
  }, [assembly.id]);

  const selectedLayer = useMemo(
    () => assembly.layers.find((l) => l.id === selectedLayerId) || assembly.layers[0],
    [assembly, selectedLayerId]
  );

  const renderedPrimitives = useMemo(() => {
    const yawRad = degToRad(yaw);
    const pitchRad = degToRad(pitch);
    const cx = 340;
    const cy = 225;
    const gap = (explode / 100) * 44;

    const totalDepth =
      assembly.layers.reduce((acc, l) => acc + l.depth, 0) +
      Math.max(0, assembly.layers.length - 1) * gap;
    let cursorZ = -totalDepth / 2;

    const prisms = [];

    assembly.layers.forEach((layer) => {
      const zCenter = cursorZ + layer.depth / 2;
      cursorZ += layer.depth + gap;
      if (hiddenLayers[layer.id]) return;

      const { prismDepth, visibleFaces, detailLines } = buildLayerFaces(
        layer,
        zCenter,
        yawRad,
        pitchRad,
        zoom,
        cx,
        cy
      );
      prisms.push({
        layerId: layer.id,
        prismDepth,
        visibleFaces,
        detailLines,
        edgeColor: layer.edgeColor,
      });
    });

    // Sort prisms far-to-near so closer layers cleanly occlude back layers & their detail lines
    prisms.sort((a, b) => b.prismDepth - a.prismDepth);
    return prisms;
  }, [assembly, explode, yaw, pitch, zoom, hiddenLayers]);

  const onPointerDown = (e) => {
    dragRef.current = { x: e.clientX, y: e.clientY, yaw, pitch };
  };

  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.x;
    const dy = e.clientY - dragRef.current.y;
    setYaw(dragRef.current.yaw + dx * 0.45);
    setPitch(Math.max(-55, Math.min(55, dragRef.current.pitch + dy * 0.35)));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const toggleLayerVis = (id, e) => {
    e.stopPropagation();
    setHiddenLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyRevitType = () => {
    try {
      navigator.clipboard.writeText(assembly.revitType);
      if (onToast) onToast(`Copied Revit Type: ${assembly.revitType}`);
    } catch {
      if (onToast) onToast(assembly.revitType);
    }
  };

  return html`<div className=${embedded ? 'a3d-wrap a3d-emb' : 'a3d-wrap'}>
    ${!customAssembly &&
    html`<div className="a3d-top">
      ${!embedded &&
      html`<div className="a3d-title">
        <h1><${Ic} n="layers" s=${20} /> Interactive 3D Assemblies</h1>
        <p>Drag to orbit, explode layers apart, and click any component to inspect Datum standards & Revit parameters.</p>
      </div>`}
      <div className="a3d-tabs">
        ${ASSEMBLIES_3D.map(
          (a) => html`<button
            key=${a.id}
            className=${`a3d-tab ${a.id === assembly.id ? 'on' : ''}`}
            onClick=${() => setAssemblyId(a.id)}
          >
            <span className="a3d-tab-code">${a.code}</span>
            <span>${a.title}</span>
          </button>`
        )}
      </div>
    </div>`}

    <div className="a3d-grid">
      <div className="a3d-stage-card">
        <div className="a3d-toolbar">
          <label className="a3d-explode">
            <span>Explode Layers</span>
            <input
              type="range"
              min="0"
              max="100"
              value=${explode}
              onInput=${(e) => setExplode(Number(e.target.value))}
            />
            <span>${explode}%</span>
          </label>
          <div className="a3d-cam-btns">
            <button className="btn sm" onClick=${() => setZoom((z) => Math.max(0.65, +(z - 0.15).toFixed(2)))}>
              <${Ic} n="minus" s=${13} />
            </button>
            <button className="btn sm" onClick=${() => setZoom((z) => Math.min(1.75, +(z + 0.15).toFixed(2)))}>
              <${Ic} n="plus" s=${13} />
            </button>
            <button
              className="btn sm"
              onClick=${() => {
                setYaw(-34);
                setPitch(20);
                setZoom(1.05);
                setExplode(55);
              }}
            >
              Reset View
            </button>
          </div>
        </div>

        <div
          className="a3d-viewport"
          onPointerDown=${onPointerDown}
          onPointerMove=${onPointerMove}
          onPointerUp=${onPointerUp}
          onPointerLeave=${onPointerUp}
        >
          <svg className="a3d-svg" viewBox="0 0 680 450" preserveAspectRatio="xMidYMid meet">
            ${renderedPrimitives.map((prism) => {
              const isSel = prism.layerId === selectedLayer.id;
              return html`<g key=${prism.layerId}>
                ${prism.visibleFaces.map(
                  (face, idx) => html`<polygon
                    key=${`${prism.layerId}-f-${idx}`}
                    points=${face.points}
                    fill=${face.fill}
                    fillOpacity=${isSel ? 1 : Math.max(0.96, face.opacity || 1)}
                    stroke=${isSel ? '#38bdf8' : face.edge}
                    strokeOpacity=${isSel ? 1 : 0.65}
                    strokeWidth=${isSel ? 2.1 : 1.0}
                    strokeLinejoin="round"
                    style=${{ cursor: 'pointer' }}
                    onClick=${(e) => {
                      e.stopPropagation();
                      setSelectedLayerId(prism.layerId);
                    }}
                  />`
                )}
                ${prism.detailLines.map(
                  (ln, i) => html`<line
                    key=${`${prism.layerId}-ln-${i}`}
                    x1=${ln.x1}
                    y1=${ln.y1}
                    x2=${ln.x2}
                    y2=${ln.y2}
                    stroke=${prism.edgeColor}
                    strokeWidth="1"
                    strokeOpacity="0.32"
                    strokeDasharray="4 3"
                    pointerEvents="none"
                  />`
                )}
              </g>`;
            })}
          </svg>
          <div className="a3d-hud">
            <span className="a3d-hud-pill">Drag to Orbit · Click Layer to Inspect</span>
            <span className="a3d-hud-pill">Revit Type: ${assembly.revitType}</span>
          </div>
        </div>

        <div className="a3d-specs">
          <div className="a3d-spec">
            <span>Fire Rating</span>
            <strong>${assembly.fireRating}</strong>
          </div>
          <div className="a3d-spec">
            <span>Acoustic</span>
            <strong>${assembly.stc}</strong>
          </div>
          <div className="a3d-spec">
            <span>Total Thickness</span>
            <strong>${assembly.thickness}</strong>
          </div>
        </div>
      </div>

      <div className="a3d-side">
        <div className="a3d-panel">
          <div className="a3d-panel-hd">
            <div>
              <h2>${assembly.title}</h2>
            </div>
            <span className="pill">${assembly.code}</span>
          </div>
          <p className="a3d-summary">${assembly.summary}</p>
          <div className="a3d-actions">
            ${onRead &&
            assembly.docId &&
            html`<button className="btn pri sm" onClick=${() => onRead(assembly.docId)}>
              <${Ic} n="openx" s=${13} /> Open Standard (#${assembly.docId})
            </button>`}
            <button className="btn sm" onClick=${copyRevitType}>
              Copy Revit Type
            </button>
          </div>
        </div>

        <div className="a3d-panel">
          <div className="a3d-panel-hd">
            <h2>Assembly Layers (${assembly.layers.length})</h2>
          </div>
          <div className="a3d-layers">
            ${assembly.layers.map((layer) => {
              const isSel = layer.id === selectedLayer.id;
              const isHidden = !!hiddenLayers[layer.id];
              return html`<div
                key=${layer.id}
                className=${`a3d-layer-row ${isSel ? 'on' : ''} ${isHidden ? 'hidden-layer' : ''}`}
                onClick=${() => setSelectedLayerId(layer.id)}
              >
                <span className="a3d-swatch" style=${{ background: layer.color }}></span>
                <div className="a3d-layer-meta">
                  <b>${layer.name}</b>
                  <small>${layer.role} · ${layer.thicknessMm} mm</small>
                </div>
                <button
                  type="button"
                  className="a3d-eye"
                  onClick=${(e) => toggleLayerVis(layer.id, e)}
                >
                  ${isHidden ? 'Show' : 'Hide'}
                </button>
              </div>`;
            })}
          </div>

          <div className="a3d-inspector">
            <span className="a3d-inspector-tag">Selected Layer Rule</span>
            <h3>${selectedLayer.name}</h3>
            <div className="a3d-kv">
              <div>Revit Material: <code>${selectedLayer.revitMaterial}</code></div>
              <div>Parameter: <code>${selectedLayer.param}</code></div>
            </div>
            <p className="a3d-rule">${selectedLayer.rule}</p>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}
