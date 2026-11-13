import { html, useState, useEffect } from '../lib/react.js';
import { ST, TY, DC, VIS, ROLES, can, normRole } from '../config/constants.js';
import { byId } from '../data/spaces.js';
import { edgeClient } from '../lib/edgeClient.js';
import { Ic } from './Icon.js';
import { Pill, VisPill, Mn } from './Badge.js';
import { Select } from './Select.js';

export function Drawer(p) {
  const { r, res, role, tree, userName, users = [], shares = [] } = p;
  const [tab, setTab] = useState("o");
  const [ed, setEd] = useState(false);
  const [dr, setDr] = useState(r.body);
  const [cm, setCm] = useState("");
  const [sm, setSm] = useState(null);
  const [ln, setLn] = useState({ id: "", t: "soft" });
  const [preflight, setPreflight] = useState(null);
  const [shareTarget, setShareTarget] = useState("");

  useEffect(() => {
    setTab("o");
    setEd(false);
    setDr(r.body);
    setSm(null);
    setPreflight(null);
  }, [r.id]);

  useEffect(() => {
    const k = (e) => e.key === "Escape" && p.close();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  const cat = byId(r.node, tree);
  const canEditItem = can.edit(role, r, cat, userName);
  const canPublishItem = can.status(role, cat, userName);
  const canRollbackItem = can.rollback(role, r, cat, userName);
  const isGuest = normRole(role) === "Guest";

  const inc = res.filter((x) => x.links.some((l) => l[0] === r.id));
  const impact = (() => {
    const seen = new Set([r.id]),
      q = [r.id];
    while (q.length) {
      const c = q.shift();
      res.forEach((x) => {
        if (!seen.has(x.id) && x.links.some((l) => l[0] === c && l[1] === "hard")) {
          seen.add(x.id);
          q.push(x.id);
        }
      });
    }
    seen.delete(r.id);
    return [...seen].map((i) => res.find((x) => x.id === i)).filter(Boolean);
  })();

  const free = res.filter((x) => x.id !== r.id && !r.links.some((l) => l[0] === x.id));
  const itemShares = shares.filter((s) => s.targetType === "item" && s.targetId === r.id);

  const T = isGuest
    ? [["o", "Overview"]]
    : [
        ["o", "Overview"],
        ["v", "Versions · " + r.v.length],
        ["l", "Links · " + (r.links.length + inc.length)],
        ["c", "Comments · " + r.c.length],
        ["a", "Access"],
      ];

  const runSummary = async () => {
    const out = await edgeClient.ai({ action: "summarize", targetItem: r });
    setSm({ s: out.summary, t: out.suggestedTags });
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

  const Row = ({ x, note }) =>
    html`<div className="li">
      <i className="dd" style=${{ background: DC[x.disc] }}></i>
      <div className="t">
        <button onClick=${() => p.pick(x.id)}>${x.title}</button>
        <small>${note}</small>
      </div>
      <${Pill} s=${x.status} />
    </div>`;

  const breadcrumb = cat && cat.vis === "Restricted" && !can.viewCat(cat, role, userName) ? "Restricted Space" : cat ? cat.path.join(" › ") : "Library";

  return html`<div>
    <div className="ov" onClick=${p.close}></div>
    <aside className="dr" role="dialog" aria-modal="true">
      <div className="dh">
        <button className="x" aria-label="Close" onClick=${p.close}>${html`<${Ic} n="x" s=${14} />`}</button>
        <div className="crumb">${breadcrumb}</div>
        <h2>${r.title}</h2>
        <div className="row" style=${{ marginBottom: 8 }}>
          <${Pill} s=${r.status} />
          <${VisPill} v=${r.vis || "Internal"} />
          <span>${TY[r.type] || "Document"}</span>
          <span>· v${r.v.length}</span>
          <span>· Verified ${r.verified || r.upd}</span>
        </div>
      </div>

      <div className="tabs">
        ${T.map(([k, n]) => html`<button key=${k} className=${tab === k ? "on" : ""} onClick=${() => setTab(k)}>${n}</button>`)}
      </div>

      <div className="db">
        ${tab === "o" &&
        html`<div>
          <dl className="kv">
            <dt>Status</dt>
            <dd>
              <${Select}
                variant="meta"
                ariaLabel="Status"
                color=${(ST[r.status] || ST.Draft)[1]}
                value=${r.status}
                disabled=${!canPublishItem && !canEditItem}
                options=${Object.entries(ST).map(([k, v]) => [
                  k,
                  v[0],
                  !canPublishItem && (k === "Approved" || k === "Archived"),
                  v[1],
                ])}
                onChange=${(v) => p.onStatus(r.id, v)}
                minMenuWidth=${175}
              />
            </dd>
            <dt>Stage</dt>
            <dd>${r.stage}</dd>
            <dt>Discipline</dt>
            <dd><i className="dd" style=${{ background: DC[r.disc] }}></i> ${r.disc}</dd>
            <dt>Owner</dt>
            <dd>${r.author}</dd>
            <dt>Visibility</dt>
            <dd>${(VIS[r.vis || "Internal"] || VIS.Internal)[0]}</dd>
          </dl>

          ${ed
            ? html`<div>
                <textarea value=${dr} onChange=${(e) => setDr(e.target.value)} rows="7"></textarea>
                <div className="btns">
                  <button
                    className="btn p"
                    onClick=${() => {
                      p.onSave(r.id, dr);
                      setEd(false);
                    }}
                  >
                    Save new version
                  </button>
                  <button
                    className="btn"
                    onClick=${() => {
                      setEd(false);
                      setDr(r.body);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>`
            : html`<p className="body">${r.desc}</p>`}

          ${sm &&
          html`<div className="box">
            <b>Edge AI · Summary</b>${sm.s}
            <div style=${{ marginTop: 8, color: "var(--sub)" }}>Suggested tags: ${sm.t.join(", ")}</div>
          </div>`}

          <div className="row" style=${{ marginTop: 14 }}>
            ${r.tags.map((t) => html`<span key=${t} className="pill" style=${{ background: "var(--fill)" }}>#${t}</span>`)}
          </div>

          <div className="btns">
            <button className="btn p" onClick=${() => p.read(r.id)}>Read</button>
            ${r.url &&
            html`<a className="btn" href=${r.url} target="_blank" rel="noopener noreferrer"><${Ic} n="openx" s=${15} /> Open resource</a>`}
            ${!isGuest && html`<button className="btn" onClick=${runSummary}><${Ic} n="spark" s=${15} /> Summary</button>`}
            ${canEditItem &&
            html`<button className="btn" disabled=${ed} onClick=${() => p.edit(r.id)}>Edit</button>`}
            ${(canEditItem || canPublishItem) &&
            p.onVerify &&
            html`<button className="btn" onClick=${() => p.onVerify(r.id)}><${Ic} n="check" s=${15} /> Verify Up to Date</button>`}
            ${!isGuest &&
            html`<button className="btn" onClick=${() => p.tw(r.id)}><${Ic} n="eye" s=${15} /> ${p.watch ? "Unwatch" : "Watch"}</button>`}
            ${!isGuest &&
            html`<button className="btn" onClick=${() => p.tf(r.id)}><${Ic} n="star" s=${15} f=${p.fav} /> ${p.fav ? "In bookmarks" : "Bookmark"}</button>`}
            ${r.vis === "Public" &&
            r.status === "Approved" &&
            p.onOpenPublic &&
            html`<button className="btn" onClick=${() => p.onOpenPublic({ kind: "item", data: r })}><${Ic} n="globe" s=${15} /> Public preview</button>`}
          </div>
        </div>`}

        ${tab === "v" &&
        html`<div>
          ${[...r.v]
            .reverse()
            .map(
              (v, i) => html`<div className="li" key=${v.n}>
                <div className="t">
                  <b>v${v.n}</b> · ${v.note}<small>${v.by} · ${v.d}${i === 0 ? " · current" : ""}</small>
                </div>
                ${i > 0 &&
                html`<button className="btn" disabled=${!canRollbackItem} onClick=${() => p.onRollback(r.id, v)}>Roll back</button>`}
              </div>`
            )}
          ${!canRollbackItem && html`<div className="box">Rollback is available to Content Owners, Category Owners, and Admins.</div>`}
        </div>`}

        ${tab === "l" &&
        html`<div>
          <div className="box">
            <b>Impact of changes</b>
            ${impact.length
              ? "Changing this resource will affect: " + impact.map((x) => x.title).join(", ") + "."
              : "There are no hard-dependent resources."}
          </div>
          <h4 style=${{ margin: "16px 0 4px" }}>Depends on / related</h4>
          ${r.links.length
            ? r.links.map((l) => {
                const x = res.find((y) => y.id === l[0]);
                return x ? html`<${Row} key=${x.id} x=${x} note=${l[1] === "hard" ? "hard link" : "soft link"} />` : null;
              })
            : html`<div className="lead">None</div>`}
          <h4 style=${{ margin: "16px 0 4px" }}>Backlinks</h4>
          ${inc.length
            ? inc.map((x) =>
                html`<${Row}
                  key=${x.id}
                  x=${x}
                  note=${x.links.find((l) => l[0] === r.id)[1] === "hard" ? "depends on this" : "references this"}
                />`
              )
            : html`<div className="lead">None</div>`}
          ${canEditItem &&
          html`<div className="btns" style=${{ marginTop: 18 }}>
            <${Select}
              variant="field"
              ariaLabel="Add link target"
              placeholder="Add link…"
              value=${ln.id}
              options=${[["", "Choose item…"], ...free.map((x) => [String(x.id), x.title])]}
              onChange=${(v) => setLn({ ...ln, id: v })}
              style=${{ flex: 1, minWidth: 160 }}
              minMenuWidth=${240}
            />
            <${Select}
              variant="field"
              ariaLabel="Link strength"
              value=${ln.t}
              options=${[
                ["soft", "Soft link"],
                ["hard", "Hard dependency"],
              ]}
              onChange=${(v) => setLn({ ...ln, t: v })}
              style=${{ width: 150 }}
              minMenuWidth=${160}
            />
            <button
              className="btn p"
              disabled=${!ln.id}
              onClick=${() => {
                p.onLink(r.id, +ln.id, ln.t);
                setLn({ id: "", t: "soft" });
              }}
            >
              Add
            </button>
          </div>`}
        </div>`}

        ${tab === "c" &&
        html`<div>
          ${r.c.length
            ? r.c.map(
                (c, i) => html`<div className="cm" key=${i}>
                  <div className="av">${c.by[0]}</div>
                  <div>
                    <b>${c.by}</b> <span className="crumb">${c.d}</span>
                    <div><${Mn} t=${c.t} /></div>
                  </div>
                </div>`
              )
            : html`<div className="lead" style=${{ marginBottom: 16 }}>No comments yet</div>`}
          ${can.comment(role)
            ? html`<div>
                <textarea value=${cm} onChange=${(e) => setCm(e.target.value)} placeholder="Comment… use @name to mention someone" rows="3"></textarea>
                <div className="btns">
                  <button
                    className="btn p"
                    disabled=${!cm.trim()}
                    onClick=${() => {
                      p.onComment(r.id, cm.trim());
                      setCm("");
                    }}
                  >
                    Send
                  </button>
                </div>
              </div>`
            : html`<div className="box">External Guests cannot comment.</div>`}
        </div>`}

        ${tab === "a" &&
        html`<div>
          <dl className="kv">
            <dt>Owner</dt>
            <dd>
              ${can.admin(role) || can.catOwner(cat, userName, role)
                ? html`<${Select}
                    variant="field"
                    ariaLabel="Owner"
                    value=${r.author}
                    options=${users
                      .filter((u) => u.status === "active" && normRole(u.role) !== "Guest")
                      .map((u) => [u.name, u.name, false, null, ROLES[normRole(u.role)]])}
                    onChange=${(v) => p.onChangeOwner && p.onChangeOwner(r.id, v)}
                    style=${{ maxWidth: 230, height: 34 }}
                    minMenuWidth=${210}
                  />`
                : r.author}
            </dd>
            <dt>Category</dt>
            <dd>${breadcrumb}${cat ? ` (Owner: ${cat.owner})` : ""}</dd>
            <dt>Visibility</dt>
            <dd>
              <${Select}
                variant="meta"
                ariaLabel="Visibility"
                color=${(VIS[r.vis || "Internal"] || VIS.Internal)[1]}
                value=${r.vis || "Internal"}
                disabled=${!(canEditItem || can.admin(role))}
                options=${[
                  ["Restricted", "Restricted (Overrides Category)", false, VIS.Restricted[1]],
                  ["Internal", "Internal (Company-wide)", false, VIS.Internal[1]],
                  ["Public", "Public (External Portal)", !can.publicize(role), VIS.Public[1]],
                ]}
                onChange=${(v) => handleVisChange(v)}
                minMenuWidth=${240}
              />
            </dd>
            <dt>Your role</dt>
            <dd><b>${ROLES[normRole(role)]}</b>${can.catOwner(cat, userName, role) ? " · Category Owner" : ""}</dd>
          </dl>

          ${preflight &&
          html`<div className="box">
            <b>Edge Public Preflight Check (${preflight.eligible ? "Ready" : "Blocked"})</b>
            ${preflight.blockers.length > 0 &&
            preflight.blockers.map((b, i) => html`<div key=${i} style=${{ color: "#ff3b30", marginTop: 4 }}>• ${b}</div>`)}
            ${preflight.attachments.length > 0 &&
            html`<div style=${{ marginTop: 8 }}>
              <small style=${{ display: "block", marginBottom: 4 }}>Clear attachments for public download:</small>
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
            ${preflight.nonPublicLinks.length > 0 &&
            html`<div style=${{ marginTop: 8, color: "var(--sub)" }}>
              Non-public outgoing links (${preflight.nonPublicLinks.length}) will automatically render as plain text for external viewers.
            </div>`}
          </div>`}

          ${(can.admin(role) || can.catOwner(cat, userName, role) || (can.createDraft(role) && r.author === userName)) &&
          html`<div className="box">
            <b>Direct Pinpoint Shares (${itemShares.length})</b>
            <div style=${{ color: "var(--sub)", fontSize: 12, marginBottom: 6 }}>
              Granting direct access lets a user view this item without exposing its parent Restricted category.
            </div>
            ${itemShares.map(
              (s) => html`<div key=${s.id} className="li" style=${{ padding: "6px 0" }}>
                <div className="t"><b>${s.grantee}</b><small>Direct Viewer</small></div>
                <button className="mn" onClick=${() => p.onRevokeShare && p.onRevokeShare(s.id)}>Remove</button>
              </div>`
            )}
            <div className="btns" style=${{ margin: "8px 0 0" }}>
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
                style=${{ flex: 1, minWidth: 180, height: 36 }}
                minMenuWidth=${220}
              />
              <button
                className="btn p"
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

          <div className="pdl-perm-wrap">
            <table>
              <thead>
                <tr>
                  <th>Permission</th>
                  ${["Super", "Admin", "Editor", "Member", "Guest"].map((n) => html`<th key=${n}>${n}</th>`)}
                </tr>
              </thead>
              <tbody>
                ${[
                  ["View Public", () => true],
                  ["Comment", can.comment],
                  ["Edit", (k) => k !== "Member" && k !== "Guest"],
                  ["Publish", (k) => k === "SuperAdmin" || k === "Admin"],
                  ["Rollback", (k) => k === "SuperAdmin" || k === "Admin"],
                ].map(
                  ([n, f]) => html`<tr key=${n}>
                    <td>${n}</td>
                    ${Object.keys(ROLES).map(
                      (k) => html`<td key=${k}>
                        ${f(k) ? html`<span className="ok"><${Ic} n="check" s=${15} /></span>` : html`<span className="no">–</span>`}
                      </td>`
                    )}
                  </tr>`
                )}
              </tbody>
            </table>
          </div>
        </div>`}
      </div>
    </aside>
  </div>`;
}
