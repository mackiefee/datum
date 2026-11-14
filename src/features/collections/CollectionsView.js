import { createPortal } from 'react-dom';
import { html, useState, useEffect } from '../../lib/react.js';
import { DC, can, normRole } from '../../config/constants.js';
import { fmt } from '../../utils/format.js';
import { Ic } from '../../components/Icon.js';
import { Pill, VisPill } from '../../components/Badge.js';
import { Select } from '../../components/Select.js';

const TIER_LABEL = { official: "Official", shared: "Shared", personal: "Personal" };
const TIER_COL = { official: "#0a84ff", shared: "#34c759", personal: "#bf5af2" };

export function CollectionsView(p) {
  const {
    cols,
    res,
    role,
    userName,
    embedded = false,
    hideSubbar = false,
    externalTab,
    onExternalTabChange,
    externalCreating,
    onExternalCreatingChange,
    initialColId = null,
    onClearInitialCol,
    onAddCol,
    onSaveCol,
    onDelCol,
    onRead,
    onOpenPublic,
  } = p;
  const [tab, setTab] = useState("all");
  const [openColId, setOpenColId] = useState(initialColId || null);
  const [creating, setCreating] = useState(false);
  const curTab = externalTab !== undefined ? externalTab : tab;
  const setCurTab = (v) => {
    setTab(v);
    onExternalTabChange && onExternalTabChange(v);
  };
  const isCreating = externalCreating !== undefined ? externalCreating : creating;
  const setIsCreating = (v) => {
    const next = typeof v === "function" ? v(isCreating) : v;
    setCreating(next);
    onExternalCreatingChange && onExternalCreatingChange(next);
  };
  const [draft, setDraft] = useState({ name: "", desc: "", tier: "personal", vis: "Restricted" });
  const [addItemId, setAddItemId] = useState("");
  const [addNote, setAddNote] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    setOpenColId(initialColId || null);
  }, [initialColId]);

  const closeActiveCol = () => {
    setOpenColId(null);
    onClearInitialCol && onClearInitialCol();
  };

  const visibleCols = cols.filter((c) => {
    const r = normRole(role);
    if (r === "SuperAdmin" || r === "Admin") return true;
    if (r === "Guest") return c.vis === "Public";
    if (c.tier === "personal") return c.owner === userName;
    if (c.vis === "Restricted") return c.owner === userName || (c.coEditors || []).includes(userName);
    return true;
  });

  const filtered = visibleCols.filter((c) => {
    if (curTab !== "all") return c.tier === curTab;
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
      mode: "list",
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
    setIsCreating(false);
    setDraft({ name: "", desc: "", tier: "personal", vis: "Restricted" });
    setOpenColId(col.id);
  };

  const canEditCol = (c) => {
    if (!c) return false;
    if (can.admin(role)) return true;
    if (c.tier === "official") return false;
    if (c.tier === "shared") return can.createDraft(role) && (c.owner === userName || (c.coEditors || []).includes(userName));
    return normRole(role) !== "Guest" && c.owner === userName;
  };

  const renderKitPreview = (c) => {
    const entries = (c.items || [])
      .map((entry) => ({ ...entry, res: resMap[entry.id] }))
      .filter((x) => x.res);
    if (!entries.length) {
      return html`<span className="bpe"><${Ic} n="layers" s=${28} /><small>Empty kit · Add documents inside</small></span>`;
    }
    return html`<div className="kit-prev">
      ${entries.slice(0, 3).map(
        (entry, i) => html`<div key=${entry.id} className="kit-prev-row">
          <span className="kit-prev-idx">${i + 1}</span>
          <i className="kit-prev-dot" style=${{ background: DC[entry.res.disc] || "#8e8e93" }}></i>
          <span>${entry.res.title}</span>
        </div>`
      )}
      ${entries.length > 3 && html`<span className="kit-prev-more">+${entries.length - 3} more items</span>`}
    </div>`;
  };

  if (activeCol) {
    const colItems = (activeCol.items || []).map((entry) => ({ ...entry, res: resMap[entry.id] })).filter((x) => x.res);
    const availableToAdd = res.filter((r) => !(activeCol.items || []).some((x) => x.id === r.id));
    const editable = canEditCol(activeCol);
    return html`<div>
      <div className="pdl-top">
        <div className="pdl-top-l">
          <button className="btn sm" onClick=${closeActiveCol}>
            <span style=${{ display: "inline-flex", transform: "rotate(180deg)" }}><${Ic} n="chev" s=${14} /></span>
            <span>All Kits</span>
          </button>
          <h1>${activeCol.name}</h1>
          <span className="pill" style=${{ "--c": TIER_COL[activeCol.tier] }}>${TIER_LABEL[activeCol.tier]}</span>
          <${VisPill} v=${activeCol.vis} />
        </div>
        <div className="pdl-top-r">
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
            style=${{ flex: 1, minWidth: 180 }}
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
    ${embedded
      ? !hideSubbar &&
        html`<div className="pdl-subbar">
          <div className="seg">
            ${[
              ["all", "All"],
              ["official", "Official"],
              ["shared", "Shared"],
              ["personal", "Personal"],
            ].map(([k, lb]) => html`<button key=${k} className=${curTab === k ? "on" : ""} onClick=${() => setCurTab(k)}>${lb}</button>`)}
          </div>
          <div className="pdl-subbar-r">
            <span className="pdl-cnt">${filtered.length} ${filtered.length === 1 ? "kit" : "kits"}</span>
            ${normRole(role) !== "Guest" &&
            html`<button className="btn p" onClick=${() => setIsCreating((v) => !v)}><${Ic} n="plus" s=${14} /> New Kit</button>`}
          </div>
        </div>`
      : html`<div className="pdl-top">
          <div className="pdl-top-l">
            <h1>Playbooks & Kits</h1>
            <span className="pdl-cnt">${filtered.length}</span>
          </div>
          <div className="pdl-top-r">
            <div className="seg">
              ${[
                ["all", "All"],
                ["official", "Official"],
                ["shared", "Shared"],
                ["personal", "Personal"],
              ].map(([k, lb]) => html`<button key=${k} className=${curTab === k ? "on" : ""} onClick=${() => setCurTab(k)}>${lb}</button>`)}
            </div>
            ${normRole(role) !== "Guest" &&
            html`<button className="btn p" onClick=${() => setIsCreating((v) => !v)}><${Ic} n="plus" s=${14} /> New Kit</button>`}
          </div>
        </div>`}

    ${isCreating &&
    createPortal(
      html`<div
        className="pdl-composer-ov"
        onMouseDown=${(e) => {
          if (e.target === e.currentTarget) setIsCreating(false);
        }}
        onKeyDown=${(e) => {
          if (e.key === "Escape") setIsCreating(false);
        }}
      >
        <form
          className="pdl-composer"
          role="dialog"
          aria-modal="true"
          aria-label="New Kit"
          onSubmit=${(e) => {
            e.preventDefault();
            if (draft.name.trim()) handleCreate();
          }}
        >
          <div className="pdl-comp-head">
            <span className="pdl-comp-tag"><${Ic} n="folder" s=${13} /> New Kit / Playbook</span>
            <button type="button" className="x" style=${{ position: "static" }} aria-label="Close" onClick=${() => setIsCreating(false)}>
              <${Ic} n="x" s=${14} />
            </button>
          </div>
          <div className="pdl-comp-body">
            <input
              className="pdl-comp-title"
              placeholder="Kit title (e.g. Revit Onboarding Kit)"
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
                ariaLabel="Kit tier"
                value=${draft.tier}
                minMenuWidth=${190}
                options=${[
                  ["personal", "Personal (Private)"],
                  ...(can.createDraft(role) ? [["shared", "Shared Team Kit"]] : []),
                  ...(can.admin(role) ? [["official", "Official Company Kit"]] : []),
                ]}
                onChange=${(v) => setDraft({ ...draft, tier: v })}
              />
              ${draft.tier !== "personal" &&
              html`<${Select}
                variant="field"
                ariaLabel="Kit visibility"
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
              <button type="button" className="btn" onClick=${() => setIsCreating(false)}>Cancel</button>
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
            const count = (c.items || []).length;
            return html`<div
              key=${c.id}
              className="bcard"
              role="button"
              tabIndex="0"
              onClick=${() => setOpenColId(c.id)}
              onKeyDown=${(e) => e.key === "Enter" && setOpenColId(c.id)}
            >
              <div className="bprev">${renderKitPreview(c)}</div>
              <div className="bmeta">
                <div className="row" style=${{ marginBottom: 4 }}>
                  <span className="pill" style=${{ "--c": TIER_COL[c.tier] || "#8e8e93" }}>${TIER_LABEL[c.tier] || "Shared"}</span>
                  <${VisPill} v=${c.vis} />
                </div>
                <b>${c.name}</b>
                <small>${c.owner} · ${count} ${count === 1 ? "item" : "items"} · ${fmt(new Date(c.at || Date.now()).toISOString().slice(0, 10))}</small>
              </div>
              <div className="pdl-bcard-acts">
                ${canEditCol(c) &&
                html`<button
                  className=${confirmDel === c.id ? "dng" : ""}
                  title="Delete kit"
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
      : html`<div className="empty"><${Ic} n="layers" s=${34} /><b>No kits in this view</b><span>Create a personal kit, shared team playbook, or official onboarding guide.</span></div>`}
  </div>`;
}
