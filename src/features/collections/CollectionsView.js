import { createPortal } from 'react-dom';
import { html, useState } from '../../lib/react.js';
import { DC, VIS, can, normRole } from '../../config/constants.js';
import { fmt } from '../../utils/format.js';
import { Ic } from '../../components/Icon.js';
import { Pill, VisPill } from '../../components/Badge.js';
import { Select } from '../../components/Select.js';
import { BC, bbox, anc, bez } from '../boards/boardUtils.js';

const TIER_LABEL = { official: "Official", shared: "Shared", personal: "Personal" };
const TIER_COL = { official: "#0a84ff", shared: "#34c759", personal: "#bf5af2" };

export function CollectionsView(p) {
  const { cols, res, role, userName, onOpenBoard, onAddCol, onSaveCol, onDelCol, onRead, onOpenPublic } = p;
  const [tab, setTab] = useState("all");
  const [openColId, setOpenColId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ name: "", desc: "", tier: "personal", mode: "list", vis: "Restricted" });
  const [addItemId, setAddItemId] = useState("");
  const [addNote, setAddNote] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  const visibleCols = cols.filter((c) => {
    const r = normRole(role);
    if (r === "SuperAdmin" || r === "Admin") return true;
    if (r === "Guest") return c.vis === "Public";
    if (c.tier === "personal") return c.owner === userName;
    if (c.vis === "Restricted") return c.owner === userName || (c.coEditors || []).includes(userName);
    return true;
  });

  const filtered = visibleCols.filter((c) => {
    if (tab === "boards") return c.mode === "board" || (c.nodes && c.nodes.length > 0);
    if (tab !== "all") return c.tier === tab;
    return true;
  });

  const activeCol = visibleCols.find((c) => c.id === openColId);
  const resMap = Object.fromEntries(res.map((r) => [r.id, r]));

  const handleCreate = () => {
    if (!draft.name.trim()) return;
    const isOfficial = draft.tier === "official" && (can.admin(role) || normRole(role) === "Editor");
    const finalTier = isOfficial ? "official" : draft.tier === "official" ? "shared" : draft.tier;
    const col = {
      id: "col-" + Date.now(),
      name: draft.name.trim(),
      desc: draft.desc.trim() || "Curated resource and document kit.",
      tier: finalTier,
      mode: draft.mode,
      owner: userName,
      vis: finalTier === "personal" ? "Restricted" : draft.vis === "Public" && can.publicize(role) ? "Public" : "Internal",
      coEditors: [],
      at: Date.now(),
      items: [],
      nodes: [],
      edges: [],
      vp: null,
    };
    onAddCol(col);
    setCreating(false);
    setDraft({ name: "", desc: "", tier: "personal", mode: "list", vis: "Restricted" });
    if (col.mode === "board") onOpenBoard(col.id);
    else setOpenColId(col.id);
  };

  const canEditCol = (c) => {
    if (!c) return false;
    if (can.admin(role)) return true;
    if (c.tier === "official") return false;
    if (c.tier === "shared") return can.createDraft(role) && (c.owner === userName || (c.coEditors || []).includes(userName));
    return normRole(role) !== "Guest" && c.owner === userName;
  };

  const renderBoardThumb = (b) => {
    if (!b.nodes || !b.nodes.length) {
      return html`<span className="bpe"><${Ic} n="layers" s=${28} /><small>${(b.items || []).length} items</small></span>`;
    }
    const P = {};
    b.nodes.forEach((n) => (P[n.id] = n));
    const B = bbox(b.nodes);
    const m = 50;
    return html`<svg className="pv" viewBox=${[B.x0 - m, B.y0 - m, B.w + 2 * m, B.h + 2 * m].join(" ")} preserveAspectRatio="xMidYMid meet">
      ${(b.edges || []).map((e) => {
        const a = P[e.a],
          c = P[e.b];
        if (!a || !c) return null;
        const [st, t, d] = anc(a, c);
        return html`<path key=${e.id} d=${bez(st, t, d)} fill="none" style=${{ stroke: "var(--sub)", strokeOpacity: 0.5 }} strokeWidth="4" strokeLinecap="round" />`;
      })}
      ${b.nodes.map((n) => {
        const r = n.t === "res" ? resMap[n.rid] : null;
        const col = r ? DC[r.disc] : BC[n.c || 0];
        return html`<rect key=${n.id} x=${n.x} y=${n.y} width=${n.w} height=${n.h} rx="18" fill=${col} fillOpacity=".24" stroke=${col} strokeWidth="2.5" />`;
      })}
    </svg>`;
  };

  if (activeCol) {
    const colItems = (activeCol.items || []).map((entry) => ({ ...entry, res: resMap[entry.id] })).filter((x) => x.res);
    const availableToAdd = res.filter((r) => !(activeCol.items || []).some((x) => x.id === r.id));
    const editable = canEditCol(activeCol);
    return html`<div>
      <div className="pdl-top">
        <div className="pdl-top-l">
          <button className="btn" style=${{ height: 32, padding: "0 11px", fontSize: 13, borderRadius: 16 }} onClick=${() => setOpenColId(null)}>
            <span style=${{ display: "inline-flex", transform: "rotate(180deg)" }}><${Ic} n="chev" s=${14} /></span>
            <span>All</span>
          </button>
          <h1>${activeCol.name}</h1>
          <span className="pill" style=${{ "--c": TIER_COL[activeCol.tier] }}>${TIER_LABEL[activeCol.tier]}</span>
          <${VisPill} v=${activeCol.vis} />
        </div>
        <div className="pdl-top-r">
          <button className="btn p" onClick=${() => onOpenBoard(activeCol.id)}><${Ic} n="boards" s=${14} /> Board</button>
          ${activeCol.vis === "Public" && html`<button className="btn" onClick=${() => onOpenPublic({ kind: "collection", data: activeCol })}><${Ic} n="globe" s=${14} /> Public</button>`}
          ${editable &&
          can.publicize(role) &&
          activeCol.tier === "official" &&
          html`<button
            className="btn"
            onClick=${() =>
              onSaveCol({ ...activeCol, vis: activeCol.vis === "Public" ? "Internal" : "Public" })
            }
          >
            ${activeCol.vis === "Public" ? "Make Internal" : "Publish"}
          </button>`}
        </div>
      </div>
      ${activeCol.desc && html`<p className="lead" style=${{ marginBottom: 14, fontSize: 14.5 }}>${activeCol.desc}</p>`}

      <div className="hc" style=${{ marginTop: 16 }}>
        <h3>Playbook Items (${colItems.length})</h3>
        ${colItems.length
          ? colItems.map(
              (entry, idx) => html`<div key=${entry.id} className="li">
                <span className="tile sm" style=${{ "--c": DC[entry.res.disc] }}><${Ic} n=${entry.res.type} s=${14} /></span>
                <div className="t">
                  <button onClick=${() => onRead(entry.res.id)}>${idx + 1}. ${entry.res.title}</button>
                  <small>${entry.note || entry.res.desc}</small>
                </div>
                <${Pill} s=${entry.res.status} />
                ${entry.res.url &&
                html`<a className="btn" href=${entry.res.url} target="_blank" rel="noopener noreferrer" title="Launch resource"><${Ic} n="openx" s=${14} /></a>`}
                ${editable &&
                html`<button
                  className="ib"
                  title="Remove from collection"
                  onClick=${() =>
                    onSaveCol({
                      ...activeCol,
                      items: activeCol.items.filter((x) => x.id !== entry.id),
                      at: Date.now(),
                    })
                  }
                >
                  <${Ic} n="x" s=${14} />
                </button>`}
              </div>`
            )
          : html`<p className="lead sm">No items in this collection yet.</p>`}

        ${editable &&
        html`<div className="btns" style=${{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          <${Select}
            variant="field"
            ariaLabel="Add Document or Resource"
            placeholder="Add Document or Resource…"
            value=${addItemId}
            options=${[["", "Choose item…"], ...availableToAdd.map((r) => [String(r.id), r.title])]}
            onChange=${setAddItemId}
            style=${{ flex: 1, minWidth: 200 }}
            minMenuWidth=${260}
          />
          <input
            className="inp"
            style=${{ flex: 1, minWidth: 180, height: 38, minHeight: 0, padding: "0 12px" }}
            placeholder="Curator note (optional)"
            value=${addNote}
            onChange=${(e) => setAddNote(e.target.value)}
          />
          <button
            className="btn p"
            disabled=${!addItemId}
            onClick=${() => {
              onSaveCol({
                ...activeCol,
                items: [...(activeCol.items || []), { id: Number(addItemId), note: addNote.trim() }],
                at: Date.now(),
              });
              setAddItemId("");
              setAddNote("");
            }}
          >
            Add
          </button>
        </div>`}
      </div>
    </div>`;
  }

  return html`<div>
    <div className="pdl-top">
      <div className="pdl-top-l">
        <h1>Collections & Boards</h1>
        <span className="pdl-cnt">${filtered.length}</span>
      </div>
      <div className="pdl-top-r">
        <div className="seg">
          ${[
            ["all", "All"],
            ["official", "Official"],
            ["shared", "Shared"],
            ["personal", "Personal"],
            ["boards", "Boards"],
          ].map(([k, lb]) => html`<button key=${k} className=${tab === k ? "on" : ""} onClick=${() => setTab(k)}>${lb}</button>`)}
        </div>
        ${normRole(role) !== "Guest" &&
        html`<button className="btn p" onClick=${() => setCreating((v) => !v)}><${Ic} n="plus" s=${14} /> New</button>`}
        ${can.createDraft(role) &&
        html`<button className="btn" onClick=${p.onBuildLibBoard}><${Ic} n="graph" s=${14} /> From links</button>`}
      </div>
    </div>

    ${creating &&
    createPortal(
      html`<div
        className="pdl-composer-ov"
        onMouseDown=${(e) => {
          if (e.target === e.currentTarget) setCreating(false);
        }}
        onKeyDown=${(e) => {
          if (e.key === "Escape") setCreating(false);
        }}
      >
        <form
          className="pdl-composer"
          role="dialog"
          aria-modal="true"
          aria-label="New Collection"
          onSubmit=${(e) => {
            e.preventDefault();
            if (draft.name.trim()) handleCreate();
          }}
        >
          <div className="pdl-comp-head">
            <span className="pdl-comp-tag"><${Ic} n="folder" s=${13} /> New Collection</span>
            <button type="button" className="x" style=${{ position: "static" }} aria-label="Close" onClick=${() => setCreating(false)}>
              <${Ic} n="x" s=${14} />
            </button>
          </div>
          <div className="pdl-comp-body">
            <input
              className="pdl-comp-title"
              placeholder="Collection title (e.g. Revit Onboarding Kit)"
              value=${draft.name}
              onChange=${(e) => setDraft({ ...draft, name: e.target.value })}
              autoFocus
            />
            <input
              className="pdl-comp-sub"
              placeholder="Add short description or purpose..."
              value=${draft.desc}
              onChange=${(e) => setDraft({ ...draft, desc: e.target.value })}
            />
          </div>
          <div className="pdl-comp-foot">
            <div className="pdl-comp-pills">
              <${Select}
                variant="field"
                ariaLabel="Collection tier"
                value=${draft.tier}
                minMenuWidth=${190}
                options=${[
                  ["personal", "Personal (Private)"],
                  ...(can.createDraft(role) ? [["shared", "Shared Team Kit"]] : []),
                  ...(can.admin(role) ? [["official", "Official Company Kit"]] : []),
                ]}
                onChange=${(v) => setDraft({ ...draft, tier: v })}
              />
              <${Select}
                variant="field"
                ariaLabel="Collection mode"
                value=${draft.mode}
                minMenuWidth=${170}
                options=${[
                  ["list", "Playbook List"],
                  ["board", "Visual Link Board"],
                ]}
                onChange=${(v) => setDraft({ ...draft, mode: v })}
              />
              ${draft.tier !== "personal" &&
              html`<${Select}
                variant="field"
                ariaLabel="Collection visibility"
                value=${draft.vis}
                minMenuWidth=${200}
                options=${[
                  ["Internal", "Internal (Company-wide)"],
                  ...(can.publicize(role) ? [["Public", "Public (External Portal)"]] : []),
                ]}
                onChange=${(v) => setDraft({ ...draft, vis: v })}
              />`}
            </div>
            <div className="pdl-comp-acts">
              <button type="button" className="btn" onClick=${() => setCreating(false)}>Cancel</button>
              <button type="submit" className="btn p" disabled=${!draft.name.trim()}>Create</button>
            </div>
          </div>
        </form>
      </div>`,
      document.body
    )}

    ${filtered.length
      ? html`<div className="bl">
          ${filtered.map((c) => {
            const count = c.mode === "board" || (c.nodes && c.nodes.length) ? c.nodes.length : (c.items || []).length;
            return html`<div
              key=${c.id}
              className="bcard"
              role="button"
              tabIndex="0"
              onClick=${() => (c.mode === "board" ? onOpenBoard(c.id) : setOpenColId(c.id))}
              onKeyDown=${(e) => e.key === "Enter" && (c.mode === "board" ? onOpenBoard(c.id) : setOpenColId(c.id))}
            >
              <div className="bprev">${renderBoardThumb(c)}</div>
              <div className="bmeta">
                <div className="row" style=${{ marginBottom: 4 }}>
                  <span className="pill" style=${{ "--c": TIER_COL[c.tier] || "#8e8e93" }}>${TIER_LABEL[c.tier] || "Shared"}</span>
                  <${VisPill} v=${c.vis} />
                </div>
                <b>${c.name}</b>
                <small>${c.owner} · ${count} items · ${fmt(new Date(c.at || Date.now()).toISOString().slice(0, 10))}</small>
              </div>
              <div className="pdl-bcard-acts">
                ${c.mode !== "board" &&
                html`<button
                  title="Open as Visual Board"
                  onClick=${(e) => {
                    e.stopPropagation();
                    onOpenBoard(c.id);
                  }}
                >
                  <${Ic} n="boards" s=${14} />
                </button>`}
                ${canEditCol(c) &&
                html`<button
                  className=${confirmDel === c.id ? "dng" : ""}
                  title="Delete collection"
                  onClick=${(e) => {
                    e.stopPropagation();
                    if (confirmDel === c.id) {
                      onDelCol(c.id);
                      setConfirmDel(null);
                    } else setConfirmDel(c.id);
                  }}
                >
                  <${Ic} n="trash" s=${14} />${confirmDel === c.id ? "Confirm?" : null}
                </button>`}
              </div>
            </div>`;
          })}
        </div>`
      : html`<div className="empty"><${Ic} n="layers" s=${34} /><b>No collections in this view</b><span>Create a personal kit, shared team board, or official onboarding guide.</span></div>`}
  </div>`;
}
