import { html, useState, useEffect } from '../lib/react.js';
import { ST, TY, DC, VIS, STG, DISC, RD, ROLES, TODAY, can, normRole } from '../config/constants.js';
import { buildFlat, byId } from '../data/spaces.js';
import { TPL } from '../data/templates.js';
import { fmt } from '../utils/format.js';
import { edgeClient } from '../lib/edgeClient.js';
import { Ic } from './Icon.js';
import { Pill, VisPill, Mn } from './Badge.js';
import { Select } from './Select.js';

function SwitchRow({ label, hint, checked, onToggle, disabled }) {
  return html`<div className="insp-row">
    <div className="insp-k">
      <span>${label}</span>
      ${hint && html`<small>${hint}</small>`}
    </div>
    <div className="insp-v">
      <button
        type="button"
        role="switch"
        aria-checked=${Boolean(checked)}
        aria-label=${label}
        disabled=${disabled}
        className=${"insp-switch" + (checked ? " on" : "")}
        onClick=${onToggle}
      >
        <span className="insp-switch-thumb"></span>
      </button>
    </div>
  </div>`;
}

export function Drawer(p) {
  const { r, res, role, tree, userName, users = [], shares = [] } = p;
  const [tab, setTab] = useState("o");
  const [cm, setCm] = useState("");
  const [sm, setSm] = useState(null);
  const [smBusy, setSmBusy] = useState(false);
  const [ln, setLn] = useState({ id: "", t: "soft" });
  const [preflight, setPreflight] = useState(null);
  const [shareTarget, setShareTarget] = useState("");
  const [urlDraft, setUrlDraft] = useState(r.url || "");
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [tplOpen, setTplOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [, setBridgeTick] = useState(0);

  useEffect(() => {
    setTab("o");
    setCm("");
    setSm(null);
    setSmBusy(false);
    setPreflight(null);
    setUrlDraft(r.url || "");
    setAddingTag(false);
    setNewTag("");
    setTplOpen(false);
    setConfirmDel(false);
  }, [r.id]);

  useEffect(() => {
    setUrlDraft(r.url || "");
  }, [r.url]);

  useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") p.close();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  const cat = byId(r.node, tree);
  const flatCats = buildFlat(tree);
  const canEditItem = Boolean(can.edit(role, r, cat, userName));
  const canPublishItem = Boolean(can.status(role, cat, userName));
  const canRollbackItem = Boolean(can.rollback(role, r, cat, userName));
  const canDeleteItem = Boolean(canEditItem && (canRollbackItem || r.author === userName));
  const canManageShares = Boolean(can.admin(role) || can.catOwner(cat, userName, role) || (can.createDraft(role) && r.author === userName));
  const isGuest = normRole(role) === "Guest";
  const bridge = p.isCurrentDoc && p.bridgeRef && p.bridgeRef.current && p.bridgeRef.current.docId === r.id ? p.bridgeRef.current : null;
  const nudgeBridge = () => setTimeout(() => setBridgeTick((n) => n + 1), 0);

  const inc = res.filter((x) => (x.links || []).some((l) => l[0] === r.id));
  const impact = (() => {
    const seen = new Set([r.id]),
      q = [r.id];
    while (q.length) {
      const c = q.shift();
      res.forEach((x) => {
        if (!seen.has(x.id) && (x.links || []).some((l) => l[0] === c && l[1] === "hard")) {
          seen.add(x.id);
          q.push(x.id);
        }
      });
    }
    seen.delete(r.id);
    return [...seen].map((i) => res.find((x) => x.id === i)).filter(Boolean);
  })();

  const free = res.filter((x) => x.id !== r.id && !(r.links || []).some((l) => l[0] === x.id));
  const itemShares = shares.filter((s) => s.targetType === "item" && s.targetId === r.id);

  const T = isGuest
    ? [["o", "Properties"]]
    : [
        ["o", "Properties"],
        ["l", "Connections · " + ((r.links || []).length + inc.length)],
        ["v", "Activity · " + ((r.v || []).length + (r.c || []).length)],
      ];

  const runSummary = async () => {
    if (smBusy) return;
    setSmBusy(true);
    try {
      const out = await edgeClient.ai({ action: "summarize", targetItem: r });
      setSm({ s: out.summary, t: out.suggestedTags || [] });
    } finally {
      setSmBusy(false);
    }
  };

  const handleVisChange = async (nextVis) => {
    if (nextVis === "Public") {
      const pf = await edgeClient.publicPreflight({
        item: r,
        allItems: res,
        categoryVis: (cat && cat.vis) || "Internal",
        clearedAttachmentIds: r.publicAttachments || [],
      });
      setPreflight(pf);
      if (!pf.eligible) return;
    } else {
      setPreflight(null);
    }
    p.onChangeVis && p.onChangeVis(r.id, nextVis);
  };

  const commitMeta = (patch) => {
    if (p.onInlineUpdate) p.onInlineUpdate(r.id, patch);
  };

  const addTag = (raw) => {
    const clean = (raw || "").trim().replace(/^#+/, "");
    if (clean && !(r.tags || []).includes(clean)) {
      commitMeta({ tags: [...(r.tags || []), clean] });
    }
    setNewTag("");
    setAddingTag(false);
  };

  const removeTag = (t) => {
    commitMeta({ tags: (r.tags || []).filter((x) => x !== t) });
  };

  const breadcrumb = cat && cat.vis === "Restricted" && !can.viewCat(cat, role, userName) ? "Restricted Space" : cat ? cat.path.join(" › ") : "Library";

  const ConnRow = ({ x, note, kind }) =>
    html`<div className="insp-row insp-conn-row">
      <i className="dd" style=${{ background: DC[x.disc] || "var(--blue)", flex: "none" }}></i>
      <div className="insp-conn-main">
        <button type="button" className="insp-link-btn" onClick=${() => p.pick(x.id)}>${x.title}</button>
        <small>${note}</small>
      </div>
      <div className="insp-conn-meta">
        ${kind && html`<span className=${"insp-strength" + (kind === "hard" ? " hard" : "")}>${kind === "hard" ? "Hard" : "Soft"}</span>`}
        <${Pill} s=${x.status} />
      </div>
    </div>`;

  return html`<div>
    <div className="ov" onClick=${p.close}></div>
    <aside className="dr insp-dr" role="dialog" aria-modal="true" aria-label=${(r.title || "Document") + " Inspector"}>
      <div className="dh insp-dh">
        <button type="button" className="x" aria-label="Close" onClick=${p.close}>${html`<${Ic} n="x" s=${14} />`}</button>
        <div className="insp-kicker">
          <span className="insp-dot" style=${{ background: DC[r.disc] || "var(--blue)" }}></span>
          <span>${TY[r.type] || "Document"} Inspector</span>
        </div>
        <h2 className="insp-title">${r.title || "Untitled standard"}</h2>
        <div className="insp-sub">
          <${Pill} s=${r.status} />
          ${r.vis && r.vis !== "Internal" && html`<${VisPill} v=${r.vis} />`}
          <span>v${(r.v || []).length || 1}</span>
          <span>·</span>
          <span>Verified ${fmt(r.verified || r.upd || TODAY)}</span>
          ${!p.isCurrentDoc &&
          html`<button type="button" className="btn sm p insp-open-btn" onClick=${() => p.read(r.id)}>Open</button>`}
        </div>
      </div>

      <div className="tabs insp-tabs" role="tablist">
        ${T.map(
          ([k, n]) => html`<button
            key=${k}
            type="button"
            role="tab"
            aria-selected=${tab === k}
            className=${tab === k ? "on" : ""}
            onClick=${() => setTab(k)}
          >
            ${n}
          </button>`
        )}
      </div>

      <div className="db insp-db">
        ${tab === "o" &&
        html`<div className="insp-sections">
          <section className="insp-sec">
            <div className="insp-sec-hdr">Classification</div>
            <div className="insp-group">
              <div className="insp-row">
                <span className="insp-k">Status</span>
                <div className="insp-v">
                  ${canPublishItem || canEditItem
                    ? html`<${Select}
                        variant="meta"
                        ariaLabel="Status"
                        color=${(ST[r.status] || ST.Draft)[1]}
                        value=${r.status}
                        options=${Object.entries(ST).map(([k, v]) => [
                          k,
                          v[0],
                          !canPublishItem && (k === "Approved" || k === "Archived"),
                          v[1],
                        ])}
                        onChange=${(v) => p.onStatus && p.onStatus(r.id, v)}
                        minMenuWidth=${175}
                      />`
                    : html`<${Pill} s=${r.status} />`}
                </div>
              </div>

              <div className="insp-row">
                <span className="insp-k">Category</span>
                <div className="insp-v">
                  ${canEditItem && p.onInlineUpdate
                    ? html`<${Select}
                        variant="inline"
                        ariaLabel="Category"
                        displayLabel=${breadcrumb}
                        value=${r.node}
                        options=${flatCats.map((n) => [n.id, n.path.join(" › ")])}
                        onChange=${(val) => {
                          const nextCat = byId(val, tree);
                          const nextDisc = nextCat && RD[nextCat.path[0]] ? RD[nextCat.path[0]] : r.disc;
                          commitMeta({ node: val, disc: nextDisc });
                        }}
                        minMenuWidth=${240}
                      />`
                    : html`<span className="insp-val-txt">${breadcrumb}</span>`}
                </div>
              </div>

              <div className="insp-row">
                <span className="insp-k">Type</span>
                <div className="insp-v">
                  ${canEditItem && p.onInlineUpdate
                    ? html`<${Select}
                        variant="inline"
                        ariaLabel="Type"
                        displayLabel=${TY[r.type] || "Document"}
                        value=${r.type || "doc"}
                        options=${Object.entries(TY)}
                        onChange=${(val) => commitMeta({ type: val })}
                        minMenuWidth=${165}
                      />`
                    : html`<span className="insp-val-txt">${TY[r.type] || "Document"}</span>`}
                </div>
              </div>

              <div className="insp-row">
                <span className="insp-k">Discipline</span>
                <div className="insp-v">
                  ${canEditItem && p.onInlineUpdate
                    ? html`<${Select}
                        variant="meta"
                        ariaLabel="Discipline"
                        color=${DC[r.disc] || "var(--blue)"}
                        displayLabel=${r.disc || "VDC"}
                        value=${r.disc || "VDC"}
                        options=${DISC.map((x) => [x, x, false, DC[x]])}
                        onChange=${(val) => commitMeta({ disc: val })}
                        minMenuWidth=${160}
                      />`
                    : html`<span className="insp-val-txt"><i className="dd" style=${{ background: DC[r.disc], marginRight: 6 }}></i>${r.disc}</span>`}
                </div>
              </div>

              <div className="insp-row">
                <span className="insp-k">Stage</span>
                <div className="insp-v">
                  ${canEditItem && p.onInlineUpdate
                    ? html`<${Select}
                        variant="inline"
                        ariaLabel="Stage"
                        displayLabel=${r.stage || STG[0]}
                        value=${r.stage || STG[0]}
                        options=${STG.map((x) => [x, x])}
                        onChange=${(val) => commitMeta({ stage: val })}
                        minMenuWidth=${160}
                      />`
                    : html`<span className="insp-val-txt">${r.stage || STG[0]}</span>`}
                </div>
              </div>

              ${(canEditItem || r.url) &&
              html`<div className="insp-row">
                <span className="insp-k">Target URL</span>
                <div className="insp-v insp-v-grow">
                  ${canEditItem && p.onInlineUpdate
                    ? html`<div className="insp-url-wrap">
                        <input
                          type="url"
                          className="insp-url-inp"
                          aria-label="Target URL"
                          placeholder="https://…"
                          value=${urlDraft}
                          onChange=${(e) => {
                            const val = e.target.value;
                            setUrlDraft(val);
                            commitMeta({ url: val });
                          }}
                        />
                        ${urlDraft.trim() &&
                        html`<a
                          className="insp-url-go"
                          href=${urlDraft.trim()}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open target URL"
                        >
                          <${Ic} n="openx" s=${13} />
                        </a>`}
                      </div>`
                    : html`<a className="insp-link-btn" href=${r.url} target="_blank" rel="noopener noreferrer">
                        Open resource <${Ic} n="openx" s=${12} />
                      </a>`}
                </div>
              </div>`}
            </div>
          </section>

          <section className="insp-sec">
            <div className="insp-sec-hdr">Tags</div>
            <div className="insp-group">
              <div className="insp-tags-wrap">
                ${(r.tags || []).map(
                  (t) => html`<span key=${t} className="insp-tag">
                    #${t}
                    ${canEditItem &&
                    html`<button
                      type="button"
                      className="insp-tag-x"
                      aria-label=${"Remove tag " + t}
                      onClick=${() => removeTag(t)}
                    >
                      ×
                    </button>`}
                  </span>`
                )}
                ${!(r.tags || []).length && !canEditItem && html`<span className="insp-empty-txt">No tags</span>`}
                ${canEditItem &&
                (addingTag
                  ? html`<input
                      autoFocus
                      className="insp-tag-inp"
                      placeholder="tag + Enter"
                      value=${newTag}
                      onChange=${(e) => setNewTag(e.target.value)}
                      onBlur=${() => addTag(newTag)}
                      onKeyDown=${(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                          e.preventDefault();
                          addTag(newTag);
                        } else if (e.key === "Escape") {
                          setNewTag("");
                          setAddingTag(false);
                        }
                      }}
                    />`
                  : html`<button type="button" className="insp-tag-add" onClick=${() => setAddingTag(true)}>+ Add tag</button>`)}
              </div>
            </div>
          </section>

          <section className="insp-sec">
            <div className="insp-sec-hdr">Access & Workspace</div>
            <div className="insp-group">
              <div className="insp-row">
                <span className="insp-k">Owner</span>
                <div className="insp-v">
                  ${can.admin(role) || can.catOwner(cat, userName, role)
                    ? html`<${Select}
                        variant="inline"
                        ariaLabel="Owner"
                        displayLabel=${r.author}
                        value=${r.author}
                        options=${users
                          .filter((u) => u.status === "active" && normRole(u.role) !== "Guest")
                          .map((u) => [u.name, u.name, false, null, ROLES[normRole(u.role)]])}
                        onChange=${(v) => p.onChangeOwner && p.onChangeOwner(r.id, v)}
                        minMenuWidth=${210}
                      />`
                    : html`<span className="insp-val-txt">${r.author}</span>`}
                </div>
              </div>

              <div className="insp-row">
                <span className="insp-k">Visibility</span>
                <div className="insp-v">
                  ${canEditItem || can.admin(role)
                    ? html`<${Select}
                        variant="meta"
                        ariaLabel="Visibility"
                        color=${(VIS[r.vis || "Internal"] || VIS.Internal)[1]}
                        value=${r.vis || "Internal"}
                        options=${[
                          ["Restricted", "Restricted (Overrides Category)", false, VIS.Restricted[1]],
                          ["Internal", "Internal (Company-wide)", false, VIS.Internal[1]],
                          ["Public", "Public (External Portal)", !can.publicize(role), VIS.Public[1]],
                        ]}
                        onChange=${(v) => handleVisChange(v)}
                        minMenuWidth=${240}
                      />`
                    : html`<${VisPill} v=${r.vis || "Internal"} />`}
                </div>
              </div>

              ${!isGuest &&
              html`<${SwitchRow}
                label="Bookmark"
                checked=${p.fav}
                onToggle=${() => p.tf && p.tf(r.id)}
              />`}

              ${!isGuest &&
              html`<${SwitchRow}
                label="Watch Updates"
                hint="Notify on edits or comments"
                checked=${p.watch}
                onToggle=${() => p.tw && p.tw(r.id)}
              />`}

              ${can.createDraft(role) &&
              p.onTogglePin &&
              html`<${SwitchRow}
                label="Pin to Dashboard"
                checked=${p.pinned}
                onToggle=${() => p.onTogglePin(r.id)}
              />`}

              ${(can.admin(role) || can.catOwner(cat, userName, role)) &&
              p.onToggleReq &&
              html`<${SwitchRow}
                label="Mandatory Reading"
                hint="Require read confirmation"
                checked=${p.isReq}
                onToggle=${() => p.onToggleReq(r.id)}
              />`}
            </div>

            ${preflight &&
            html`<div className="insp-preflight">
              <b>Public Preflight Check · ${preflight.eligible ? "Ready" : "Blocked"}</b>
              ${preflight.blockers.map((b, i) => html`<div key=${i} className="insp-pf-err">• ${b}</div>`)}
              ${preflight.attachments.length > 0 &&
              html`<div className="insp-pf-atts">
                <small>Clear attachments for public download:</small>
                ${preflight.attachments.map((att) => {
                  const checked = (r.publicAttachments || []).includes(att.id);
                  return html`<button
                    key=${att.id}
                    type="button"
                    className="pdl-ckrow"
                    onClick=${() => p.onTogglePublicAtt && p.onTogglePublicAtt(r.id, att.id)}
                  >
                    <span className=${"ckb" + (checked ? " on" : "")}>${checked ? html`<${Ic} n="check" s=${12} />` : null}</span>
                    <span>${att.caption} (${att.id})</span>
                  </button>`;
                })}
              </div>`}
            </div>`}

            ${canManageShares &&
            html`<div className="insp-group" style=${{ marginTop: 10 }}>
              <div className="insp-row">
                <div className="insp-k">
                  <span>Direct Access (${itemShares.length})</span>
                  <small>Grant view access without exposing parent category</small>
                </div>
              </div>
              ${itemShares.map(
                (s) => html`<div key=${s.id} className="insp-row">
                  <div className="insp-k">
                    <span>${s.grantee}</span>
                    <small>Direct Viewer</small>
                  </div>
                  <div className="insp-v">
                    <button type="button" className="mn" onClick=${() => p.onRevokeShare && p.onRevokeShare(s.id)}>Remove</button>
                  </div>
                </div>`
              )}
              <div className="insp-share-bar">
                <${Select}
                  variant="field"
                  ariaLabel="Share with user"
                  placeholder="Share with user…"
                  value=${shareTarget}
                  options=${[
                    ["", "Choose user…"],
                    ...users
                      .filter((u) => u.status === "active" && !itemShares.some((s) => s.grantee === u.name))
                      .map((u) => [u.name, u.name, false, null, ROLES[normRole(u.role)]]),
                  ]}
                  onChange=${setShareTarget}
                  style=${{ flex: 1, minWidth: 160, height: 34 }}
                  minMenuWidth=${220}
                />
                <button
                  type="button"
                  className="btn sm p"
                  disabled=${!shareTarget}
                  onClick=${() => {
                    p.onGrantShare && p.onGrantShare(r.id, shareTarget);
                    setShareTarget("");
                  }}
                >
                  Grant
                </button>
              </div>
            </div>`}
          </section>

          <section className="insp-sec">
            <div className="insp-sec-hdr">Actions & Tools</div>
            <div className="insp-group">
              ${!isGuest &&
              html`<button type="button" className="insp-act" onClick=${runSummary} disabled=${smBusy}>
                <span className="insp-act-ico" style=${{ color: "var(--blue)" }}><${Ic} n="spark" s=${15} /></span>
                <span className="insp-act-lbl">${smBusy ? "Generating summary…" : "AI Summary & Suggested Tags"}</span>
                <span className="insp-act-end"><${Ic} n="chev" s=${13} /></span>
              </button>`}

              ${(canEditItem || canPublishItem) &&
              p.onVerify &&
              html`<button type="button" className="insp-act" onClick=${() => p.onVerify(r.id)}>
                <span className="insp-act-ico" style=${{ color: "#34c759" }}><${Ic} n="check" s=${15} /></span>
                <span className="insp-act-lbl">Verify Up to Date</span>
              </button>`}

              ${!isGuest &&
              p.onFlagOutdated &&
              html`<button type="button" className="insp-act" onClick=${() => p.onFlagOutdated(r.id)}>
                <span className="insp-act-ico" style=${{ color: "#ff9f0a" }}><${Ic} n="clock" s=${15} /></span>
                <span className="insp-act-lbl">Flag as Outdated</span>
              </button>`}

              ${bridge &&
              canEditItem &&
              html`<button type="button" className="insp-act" onClick=${() => setTplOpen((v) => !v)}>
                <span className="insp-act-ico"><${Ic} n="template" s=${15} /></span>
                <span className="insp-act-lbl">Apply Template…</span>
                <span className="insp-act-end">${tplOpen ? "▾" : "▸"}</span>
              </button>`}

              ${bridge &&
              canEditItem &&
              tplOpen &&
              html`<div className="insp-tpl-list">
                ${Object.keys(TPL).map(
                  (tk) => html`<button
                    key=${tk}
                    type="button"
                    className="insp-tpl-chip"
                    onClick=${() => {
                      bridge.applyTemplate(tk);
                      setTplOpen(false);
                      nudgeBridge();
                    }}
                  >
                    ${tk}
                  </button>`
                )}
              </div>`}

              ${bridge &&
              canEditItem &&
              html`<button
                type="button"
                className="insp-act"
                disabled=${bridge.ib}
                onClick=${() => {
                  bridge.triggerDocx();
                  nudgeBridge();
                }}
              >
                <span className="insp-act-ico"><${Ic} n="doc" s=${15} /></span>
                <span className="insp-act-lbl">${bridge.ib ? "Importing .docx…" : "Import from .docx"}</span>
              </button>`}

              ${bridge &&
              canEditItem &&
              html`<button
                type="button"
                className="insp-act"
                onClick=${() => {
                  bridge.toggleSourceMode();
                  nudgeBridge();
                }}
              >
                <span className="insp-act-ico"><${Ic} n="code" s=${15} /></span>
                <span className="insp-act-lbl">${bridge.sourceMode ? "Switch to Visual Canvas" : "Switch to Raw Markdown"}</span>
                ${bridge.sourceMode && html`<span className="insp-act-badge">Markdown</span>`}
              </button>`}

              ${bridge &&
              canEditItem &&
              html`<button
                type="button"
                className="insp-act"
                onClick=${() => {
                  bridge.saveSnapshot();
                  nudgeBridge();
                }}
              >
                <span className="insp-act-ico"><${Ic} n="layers" s=${15} /></span>
                <span className="insp-act-lbl">Save Version Snapshot</span>
              </button>`}

              ${bridge &&
              canEditItem &&
              html`<button
                type="button"
                className="insp-act"
                onClick=${() => {
                  bridge.toggleSim();
                  nudgeBridge();
                }}
              >
                <span className="insp-act-ico"><${Ic} n="users" s=${15} /></span>
                <span className="insp-act-lbl">${bridge.simOn ? "Stop Co-Editor Simulation" : "Simulate Co-Editor"}</span>
                ${bridge.simOn && html`<span className="insp-act-badge live">Live</span>`}
              </button>`}

              ${r.vis === "Public" &&
              r.status === "Approved" &&
              p.onOpenPublic &&
              html`<button type="button" className="insp-act" onClick=${() => p.onOpenPublic({ kind: "item", data: r })}>
                <span className="insp-act-ico" style=${{ color: "var(--blue)" }}><${Ic} n="globe" s=${15} /></span>
                <span className="insp-act-lbl">Public Share Preview</span>
              </button>`}
            </div>

            ${sm &&
            html`<div className="insp-ai-box">
              <b>Edge AI Summary</b>
              <p>${sm.s}</p>
              ${sm.t.length > 0 &&
              html`<div className="insp-tags-wrap" style=${{ padding: "8px 0 0" }}>
                ${sm.t.map(
                  (st) => html`<button
                    key=${st}
                    type="button"
                    className="insp-tag insp-tag-sug"
                    title=${canEditItem ? "Add suggested tag" : "Suggested tag"}
                    onClick=${() => canEditItem && addTag(st)}
                  >
                    ${canEditItem && !(r.tags || []).includes(st) ? "+ #" + st : "#" + st}
                  </button>`
                )}
              </div>`}
            </div>`}

            ${canDeleteItem &&
            p.onDelete &&
            html`<div className="insp-group" style=${{ marginTop: 12 }}>
              <button
                type="button"
                className="insp-act dng"
                onClick=${() => {
                  if (confirmDel) p.onDelete(r.id);
                  else setConfirmDel(true);
                }}
              >
                <span className="insp-act-ico"><${Ic} n="trash" s=${15} /></span>
                <span className="insp-act-lbl">${confirmDel ? "Confirm Delete Document" : "Delete Document"}</span>
              </button>
            </div>`}
          </section>
        </div>`}

        ${tab === "l" &&
        html`<div className="insp-sections">
          <div className="insp-impact">
            <b>Impact Analysis</b>
            <span>
              ${impact.length
                ? `Edits affect ${impact.length} hard-dependent standard${impact.length === 1 ? "" : "s"}: ${impact.map((x) => x.title).join(", ")}.`
                : "No hard downstream dependencies found."}
            </span>
          </div>

          <section className="insp-sec">
            <div className="insp-sec-hdr">Depends On · ${(r.links || []).length}</div>
            <div className="insp-group">
              ${(r.links || []).length
                ? (r.links || []).map((l) => {
                    const x = res.find((y) => y.id === l[0]);
                    return x
                      ? html`<${ConnRow} key=${x.id + "-" + l[1]} x=${x} kind=${l[1]} note=${l[1] === "hard" ? "Required dependency" : "Related reference"} />`
                      : null;
                  })
                : html`<div className="insp-empty-row">No outgoing links</div>`}
            </div>
          </section>

          <section className="insp-sec">
            <div className="insp-sec-hdr">Referenced By (Backlinks) · ${inc.length}</div>
            <div className="insp-group">
              ${inc.length
                ? inc.map((x) => {
                    const edge = (x.links || []).find((l) => l[0] === r.id);
                    return html`<${ConnRow}
                      key=${x.id}
                      x=${x}
                      kind=${edge && edge[1]}
                      note=${edge && edge[1] === "hard" ? "Depends on this item" : "References this item"}
                    />`;
                  })
                : html`<div className="insp-empty-row">No incoming backlinks</div>`}
            </div>
          </section>

          ${canEditItem &&
          html`<section className="insp-sec">
            <div className="insp-sec-hdr">Add Connection</div>
            <div className="insp-group">
              <div className="insp-add-conn">
                <${Select}
                  variant="field"
                  ariaLabel="Add link target"
                  placeholder="Choose standard…"
                  value=${ln.id}
                  options=${[["", "Choose item…"], ...free.map((x) => [String(x.id), x.title])]}
                  onChange=${(v) => setLn({ ...ln, id: v })}
                  style=${{ flex: 1, minWidth: 160, height: 34 }}
                  minMenuWidth=${240}
                />
                <div className="insp-add-conn-row">
                  <${Select}
                    variant="field"
                    ariaLabel="Link strength"
                    value=${ln.t}
                    options=${[
                      ["soft", "Soft link"],
                      ["hard", "Hard dependency"],
                    ]}
                    onChange=${(v) => setLn({ ...ln, t: v })}
                    style=${{ flex: 1, height: 34 }}
                    minMenuWidth=${160}
                  />
                  <button
                    type="button"
                    className="btn sm p"
                    disabled=${!ln.id}
                    onClick=${() => {
                      p.onLink && p.onLink(r.id, +ln.id, ln.t);
                      setLn({ id: "", t: "soft" });
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          </section>`}
        </div>`}

        ${tab === "v" &&
        html`<div className="insp-sections">
          <section className="insp-sec">
            <div className="insp-sec-hdr">Comments · ${(r.c || []).length}</div>
            <div className="insp-group">
              ${(r.c || []).length
                ? (r.c || []).map(
                    (c, i) => html`<div className="insp-comment" key=${i}>
                      <div className="av sm">${(c.by || "?")[0]}</div>
                      <div className="insp-comment-b">
                        <div className="insp-comment-meta"><b>${c.by}</b><span>${fmt(c.d || TODAY)}</span></div>
                        <div className="insp-comment-t"><${Mn} t=${c.t} /></div>
                      </div>
                    </div>`
                  )
                : html`<div className="insp-empty-row">No comments yet</div>`}
              ${can.comment(role)
                ? html`<div className="insp-comment-form">
                    <textarea
                      value=${cm}
                      onChange=${(e) => setCm(e.target.value)}
                      placeholder="Write a comment… use @name to mention"
                      rows="2"
                    ></textarea>
                    <div className="insp-comment-acts">
                      <button
                        type="button"
                        className="btn sm p"
                        disabled=${!cm.trim()}
                        onClick=${() => {
                          p.onComment && p.onComment(r.id, cm.trim());
                          setCm("");
                        }}
                      >
                        Post
                      </button>
                    </div>
                  </div>`
                : html`<div className="insp-empty-row">External Guests cannot comment.</div>`}
            </div>
          </section>

          <section className="insp-sec">
            <div className="insp-sec-hdr-row">
              <span className="insp-sec-hdr" style=${{ padding: 0 }}>Version History · ${(r.v || []).length}</span>
              ${canEditItem &&
              (p.onSaveSnapshot || bridge) &&
              html`<button
                type="button"
                className="insp-hdr-action"
                onClick=${() => {
                  if (bridge) {
                    bridge.saveSnapshot();
                    nudgeBridge();
                  } else if (p.onSaveSnapshot) {
                    p.onSaveSnapshot(r.id, r.body || "");
                  }
                }}
              >
                + Save Snapshot
              </button>`}
            </div>
            <div className="insp-group">
              ${[...(r.v || [])]
                .reverse()
                .map(
                  (v, i) => html`<div className="insp-row insp-ver-row" key=${v.n + "-" + i}>
                    <div className="insp-ver-info">
                      <b>v${v.n} · ${v.note || "Revision"}</b>
                      <small>${v.by} · ${fmt(v.d || TODAY)}${i === 0 ? " · Current" : ""}</small>
                    </div>
                    ${i > 0 &&
                    html`<button
                      type="button"
                      className="btn sm"
                      disabled=${!canRollbackItem}
                      title=${canRollbackItem ? "Restore this version" : "Requires Owner or Admin"}
                      onClick=${() => p.onRollback && p.onRollback(r.id, v)}
                    >
                      Restore
                    </button>`}
                  </div>`
                )}
            </div>
          </section>
        </div>`}
      </div>
    </aside>
  </div>`;
}
