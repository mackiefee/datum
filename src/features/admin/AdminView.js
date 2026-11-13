import { createPortal } from 'react-dom';
import { html, useState } from '../../lib/react.js';
import { ROLES, ST, VIS, TODAY, can, normRole } from '../../config/constants.js';
import { buildFlat } from '../../data/spaces.js';
import { days } from '../../utils/format.js';
import { edgeClient } from '../../lib/edgeClient.js';
import { Ic } from '../../components/Icon.js';
import { Pill, VisPill } from '../../components/Badge.js';
import { Select } from '../../components/Select.js';

export function AdminView(p) {
  const {
    res,
    tree,
    setTree,
    users,
    setUsers,
    cols,
    activities,
    searchLogs,
    acks,
    req,
    role,
    userName,
    flaggedIds,
    onRead,
    onApprove,
    onReject,
    onVerify,
    onRevokePublic,
    onOpenPublic,
    onRenameTag,
    onDeleteTag,
    onDeactivateUser,
    onCreateForTopic,
    flash,
  } = p;

  const [tab, setTab] = useState("gov");
  const [scan, setScan] = useState(null);
  const [busyScan, setBusyScan] = useState(false);

  // Category creation state
  const [creatingCat, setCreatingCat] = useState(false);
  const [newCat, setNewCat] = useState({ name: "", parentId: "", owner: userName, vis: "Internal", reqApproval: true, reviewDays: 90 });

  // Tag rename/merge state
  const [editTag, setEditTag] = useState(null);
  const [tagTarget, setTagTarget] = useState("");

  // Deactivate modal state
  const [deactUser, setDeactUser] = useState(null);
  const [fallbackOwner, setFallbackOwner] = useState("");

  const flatCats = buildFlat(tree);
  const isAdmin = can.admin(role);

  // Filter items that belong to categories the user can govern
  const governedItems = res.filter((r) => {
    if (isAdmin) return true;
    const cat = flatCats.find((c) => c.id === r.node);
    return cat && cat.owner === userName;
  });

  const inReview = governedItems.filter((r) => r.status === "Review");
  const staleItems = governedItems.filter((r) => {
    const cat = flatCats.find((c) => c.id === r.node);
    const cycle = (cat && cat.reviewDays) || 90;
    return r.status === "Approved" && days(r.verified || r.upd) > cycle;
  });
  const flaggedItems = governedItems.filter((r) => flaggedIds.includes(r.id));
  const publicItems = res.filter((r) => r.vis === "Public" && r.status === "Approved");
  const publicCols = cols.filter((c) => c.vis === "Public");

  // Tag usage map
  const tagCounts = {};
  res.forEach((r) => (r.tags || []).forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1)));
  const allTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);

  // Analytics calculations
  const approvedCount = res.filter((r) => r.status === "Approved").length;
  const stalePct = approvedCount ? Math.round((staleItems.length / approvedCount) * 100) : 0;
  const reqDone = req.filter((id) => Boolean(acks[id])).length;
  const zeroSearches = searchLogs.filter((l) => l.resultCount === 0);

  const runEdgeGovernance = async () => {
    setBusyScan(true);
    const out = await edgeClient.governance({
      items: res,
      categories: flatCats,
      today: TODAY,
      requiredIds: req,
      acks,
    });
    setScan(out);
    setBusyScan(false);
    flash("Governance Edge scan completed");
  };

  const addCategory = () => {
    if (!newCat.name.trim()) return;
    const id = newCat.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 18) + "-" + Date.now().toString(36).slice(-3);
    const entry = {
      id,
      name: newCat.name.trim(),
      owner: newCat.owner || userName,
      vis: newCat.vis,
      reqApproval: newCat.reqApproval,
      reviewDays: Number(newCat.reviewDays) || 90,
      kids: [],
    };
    if (!newCat.parentId) {
      setTree([...tree, { ...entry, color: "#0a84ff" }]);
    } else {
      const insertChild = (nodes) =>
        nodes.map((n) =>
          n.id === newCat.parentId
            ? { ...n, kids: [...(n.kids || []), entry] }
            : n.kids
            ? { ...n, kids: insertChild(n.kids) }
            : n
        );
      setTree(insertChild(tree));
    }
    setNewCat({ name: "", parentId: "", owner: userName, vis: "Internal", reqApproval: true, reviewDays: 90 });
    flash("Category created");
  };

  const updateCatProp = (catId, patch) => {
    const walk = (nodes) =>
      nodes.map((n) =>
        n.id === catId ? { ...n, ...patch } : n.kids ? { ...n, kids: walk(n.kids) } : n
      );
    setTree(walk(tree));
    flash("Category updated");
  };

  const eligibleParents = flatCats.filter((c) => c.level < 3 && (isAdmin || c.owner === userName));
  const activeUsers = users.filter((u) => u.status === "active");

  return html`<div>
    <div className="pdl-top">
      <div className="pdl-top-l">
        <h1>Administration</h1>
      </div>
      <div className="pdl-top-r">
        <div className="seg">
          ${[
            ["gov", `Governance (${inReview.length + staleItems.length})`],
            ["cats", "Categories & Tags"],
            ["users", "Users & Teams"],
            ["pub", `External (${publicItems.length + publicCols.length})`],
            ["anl", "Analytics & Audit"],
          ].map(([k, lb]) => html`<button key=${k} className=${tab === k ? "on" : ""} onClick=${() => setTab(k)}>${lb}</button>`)}
        </div>
      </div>
    </div>

    ${tab === "gov" &&
    html`<div>
      <div className="btns">
        <button className="btn p" disabled=${busyScan} onClick=${runEdgeGovernance}>
          <${Ic} n="shield" s=${15} /> ${busyScan ? "Scanning via Edge Function…" : "Run Edge Governance Scan"}
        </button>
      </div>

      ${scan &&
      html`<div className="box" style=${{ marginTop: 12 }}>
        <b>Edge Governance Report · ${scan.totalActive} active items scanned</b>
        <div className="pdl-scan-grid">
          <div className="pdl-scan-card"><b style=${{ color: scan.staleItems.length ? "#ff9f0a" : "#34c759" }}>${scan.staleItems.length}</b><small>Stale Items</small></div>
          <div className="pdl-scan-card"><b>${scan.missingSummaryItems.length}</b><small>Missing Summaries</small></div>
          <div className="pdl-scan-card"><b>${scan.duplicateUrls.length}</b><small>Duplicate URLs</small></div>
          <div className="pdl-scan-card"><b>${scan.brokenDependencies.length}</b><small>Broken Hard Links</small></div>
          <div className="pdl-scan-card"><b>${scan.requiredCompliance.acknowledgedCount}/${scan.requiredCompliance.requiredCount}</b><small>Required Confirmed</small></div>
        </div>
      </div>`}

      <div className="pdl-grid2">
        <section className="hc">
          <h3>Awaiting Approval (In Review)${inReview.length > 0 && html`<span className="bdg">${inReview.length}</span>`}</h3>
          ${inReview.length
            ? inReview.map(
                (r) => html`<div key=${r.id} className="li">
                  <div className="t">
                    <button onClick=${() => onRead(r.id)}>${r.title}</button>
                    <small>${r.author} · Updated ${r.upd}</small>
                  </div>
                  <button className="btn p" style=${{ height: 30, padding: "0 12px", fontSize: 13 }} onClick=${() => onApprove(r.id)}>Publish</button>
                  <button className="btn" style=${{ height: 30, padding: "0 12px", fontSize: 13 }} onClick=${() => onReject(r.id)}>Draft</button>
                </div>`
              )
            : html`<p className="lead sm">No items pending review.</p>`}
        </section>

        <section className="hc">
          <h3>Stale / Needs Verification${staleItems.length > 0 && html`<span className="bdg">${staleItems.length}</span>`}</h3>
          ${staleItems.length
            ? staleItems.map(
                (r) => html`<div key=${r.id} className="li">
                  <div className="t">
                    <button onClick=${() => onRead(r.id)}>${r.title}</button>
                    <small>${r.author} · ${days(r.verified || r.upd)} days since verification</small>
                  </div>
                  <button className="btn" style=${{ height: 30, padding: "0 12px", fontSize: 13 }} onClick=${() => onVerify(r.id)}>Verify Up to Date</button>
                </div>`
              )
            : html`<p className="lead sm">All published items are within their review cycle.</p>`}
        </section>
      </div>

      ${flaggedItems.length > 0 &&
      html`<section className="hc" style=${{ marginTop: 16 }}>
        <h3>Flagged as Outdated / Broken Link</h3>
        ${flaggedItems.map(
          (r) => html`<div key=${r.id} className="li">
            <div className="t">
              <button onClick=${() => onRead(r.id)}>${r.title}</button>
              <small>Owner: ${r.author}</small>
            </div>
            <button className="btn" onClick=${() => onVerify(r.id)}>Mark Resolved</button>
          </div>`
        )}
      </section>`}
    </div>`}

    ${tab === "cats" &&
    html`<div className="pdl-grid2">
      <section className="hc">
        <div style=${{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <h3 style=${{ margin: 0 }}>Categories (Max 3 Levels)</h3>
          ${(isAdmin || eligibleParents.length > 0) &&
          html`<button className="btn p" style=${{ height: 30, padding: "0 12px", fontSize: 13 }} onClick=${() => setCreatingCat(true)}>
            <${Ic} n="plus" s=${13} /> New
          </button>`}
        </div>
        ${flatCats.map(
          (c) => html`<div key=${c.id} className="li" style=${{ paddingLeft: (c.level - 1) * 14 }}>
            <div className="t">
              <b>${c.name}</b>
              <small>Owner: ${c.owner} · Review: ${c.reviewDays}d · ${c.reqApproval ? "Approval required" : "Direct publish"}</small>
            </div>
            ${isAdmin
              ? html`<${Select}
                  variant="meta"
                  ariaLabel=${"Visibility " + c.name}
                  color=${(VIS[c.vis] || VIS.Internal)[1]}
                  value=${c.vis}
                  options=${[
                    ["Internal", "Internal", false, VIS.Internal[1]],
                    ["Restricted", "Restricted", false, VIS.Restricted[1]],
                  ]}
                  onChange=${(v) => updateCatProp(c.id, { vis: v })}
                  minMenuWidth=${150}
                />`
              : html`<${VisPill} v=${c.vis} />`}
          </div>`
        )}

        ${creatingCat &&
        createPortal(
          html`<div
            className="pdl-composer-ov"
            onMouseDown=${(e) => {
              if (e.target === e.currentTarget) setCreatingCat(false);
            }}
            onKeyDown=${(e) => {
              if (e.key === "Escape") setCreatingCat(false);
            }}
          >
            <form
              className="pdl-composer"
              role="dialog"
              aria-modal="true"
              aria-label="Create Category"
              onSubmit=${(e) => {
                e.preventDefault();
                if (!newCat.name.trim()) return;
                addCategory();
                setCreatingCat(false);
              }}
            >
              <div className="pdl-comp-head">
                <span className="pdl-comp-tag"><${Ic} n="folder" s=${13} /> New Category</span>
                <button type="button" className="x" style=${{ position: "static" }} aria-label="Close" onClick=${() => setCreatingCat(false)}>
                  <${Ic} n="x" s=${14} />
                </button>
              </div>
              <div className="pdl-comp-body">
                <input
                  className="pdl-comp-title"
                  placeholder="Category name (e.g. BIM Automation)"
                  value=${newCat.name}
                  onChange=${(e) => setNewCat({ ...newCat, name: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="pdl-comp-foot">
                <div className="pdl-comp-pills">
                  <${Select}
                    variant="field"
                    ariaLabel="Parent Space"
                    value=${newCat.parentId}
                    minMenuWidth=${220}
                    options=${[
                      ...(isAdmin ? [["", "Root (Level 1)"]] : []),
                      ...eligibleParents.map((c) => [c.id, c.path.join(" › ")]),
                    ]}
                    onChange=${(v) => setNewCat({ ...newCat, parentId: v })}
                  />
                  <${Select}
                    variant="field"
                    ariaLabel="Category Owner"
                    value=${newCat.owner}
                    minMenuWidth=${200}
                    options=${activeUsers
                      .filter((u) => normRole(u.role) !== "Guest" && normRole(u.role) !== "Member")
                      .map((u) => [u.name, u.name, false, null, ROLES[normRole(u.role)]])}
                    onChange=${(v) => setNewCat({ ...newCat, owner: v })}
                  />
                  <${Select}
                    variant="field"
                    ariaLabel="Default Visibility"
                    value=${newCat.vis}
                    minMenuWidth=${160}
                    options=${[
                      ["Internal", "Internal", false, VIS.Internal[1]],
                      ["Restricted", "Restricted", false, VIS.Restricted[1]],
                    ]}
                    onChange=${(v) => setNewCat({ ...newCat, vis: v })}
                  />
                </div>
                <div className="pdl-comp-acts">
                  <button type="button" className="btn" onClick=${() => setCreatingCat(false)}>Cancel</button>
                  <button type="submit" className="btn p" disabled=${!newCat.name.trim()}>Create</button>
                </div>
              </div>
            </form>
          </div>`,
          document.body
        )}
      </section>

      <section className="hc">
        <h3>Tag Governance (${allTags.length} tags)</h3>
        <p className="lead sm">Rename or merge duplicate tags across all Documents and Resources.</p>
        ${allTags.map(
          ([t, cnt]) => html`<div key=${t} className="li">
            <div className="t">
              <b>#${t}</b>
              <small>${cnt} items</small>
            </div>
            ${editTag === t
              ? html`<div className="pdl-row">
                  <input
                    className="inp"
                    style=${{ width: 130, minHeight: 30, padding: "4px 10px" }}
                    value=${tagTarget}
                    onChange=${(e) => setTagTarget(e.target.value)}
                  />
                  <button
                    className="btn p"
                    style=${{ height: 30, padding: "0 10px", fontSize: 12 }}
                    onClick=${() => {
                      onRenameTag(t, tagTarget.trim());
                      setEditTag(null);
                    }}
                  >
                    Merge
                  </button>
                  <button className="btn" style=${{ height: 30, padding: "0 10px", fontSize: 12 }} onClick=${() => setEditTag(null)}>Cancel</button>
                </div>`
              : html`<div className="pdl-row">
                  <button
                    className="btn"
                    style=${{ height: 28, padding: "0 10px", fontSize: 12 }}
                    onClick=${() => {
                      setEditTag(t);
                      setTagTarget(t);
                    }}
                  >
                    Rename / Merge
                  </button>
                  ${isAdmin &&
                  html`<button
                    className="btn"
                    style=${{ height: 28, padding: "0 10px", fontSize: 12, color: "#ff3b30" }}
                    onClick=${() => onDeleteTag(t)}
                  >
                    Remove
                  </button>`}
                </div>`}
          </div>`
        )}
      </section>
    </div>`}

    ${tab === "users" &&
    html`<div>
      <section className="hc" style=${{ marginTop: 16 }}>
        <h3>Users & Access Lifecycle</h3>
        <p className="lead sm">Deactivating a user immediately revokes access and requires ownership handover so zero content becomes orphaned.</p>
        ${users.map((u) => {
          const ownedCount = res.filter((r) => r.author === u.name).length;
          return html`<div key=${u.id} className="li">
            <div className="av">${u.name[0]}</div>
            <div className="t">
              <b>${u.name} ${u.status === "deactivated" ? "(Deactivated)" : ""}</b>
              <small>${u.email} · ${u.dept}${(u.teams || []).length ? " · Teams: " + u.teams.join(", ") : ""} · Owns ${ownedCount} items</small>
            </div>
            ${isAdmin && u.status === "active"
              ? html`<div className="pdl-row">
                  <${Select}
                    variant="field"
                    ariaLabel=${"Role " + u.name}
                    value=${u.role}
                    options=${Object.entries(ROLES).map(([k, v]) => [k, v])}
                    onChange=${(nextRole) => {
                      if (nextRole === "SuperAdmin" && !can.superAdmin(role)) {
                        flash("Only Super Admin can assign Super Admin role");
                        return;
                      }
                      setUsers(users.map((x) => (x.id === u.id ? { ...x, role: nextRole } : x)));
                      flash(`Updated ${u.name} role to ${ROLES[nextRole]}`);
                    }}
                    style=${{ width: 170, height: 34 }}
                    minMenuWidth=${180}
                  />
                  ${u.name !== userName &&
                  html`<button
                    className="btn"
                    style=${{ color: "#ff3b30", height: 34 }}
                    onClick=${() => {
                      const cand = activeUsers.find((x) => x.name !== u.name && normRole(x.role) !== "Guest");
                      setFallbackOwner(cand ? cand.name : userName);
                      setDeactUser(u);
                    }}
                  >
                    Deactivate
                  </button>`}
                </div>`
              : html`<span className="pill" style=${{ "--c": u.status === "deactivated" ? "#ff3b30" : "#8e8e93" }}>${u.status === "deactivated" ? "Deactivated" : ROLES[u.role]}</span>`}
          </div>`;
        })}
      </section>
    </div>`}

    ${tab === "pub" &&
    html`<div className="pdl-grid2">
      <section className="hc">
        <h3>Public Documents & Resources (${publicItems.length})</h3>
        ${publicItems.length
          ? publicItems.map(
              (r) => html`<div key=${r.id} className="li">
                <div className="t">
                  <button onClick=${() => onRead(r.id)}>${r.title}</button>
                  <small>Cleared attachments: ${(r.publicAttachments || []).length} · Owner: ${r.author}</small>
                </div>
                <button className="btn" style=${{ height: 30, padding: "0 12px", fontSize: 13 }} onClick=${() => onOpenPublic({ kind: "item", data: r })}>Preview</button>
                ${isAdmin &&
                html`<button className="btn" style=${{ height: 30, padding: "0 12px", fontSize: 13, color: "#ff3b30" }} onClick=${() => onRevokePublic("item", r.id)}>Revoke</button>`}
              </div>`
            )
          : html`<p className="lead sm">No items currently published externally.</p>`}
      </section>

      <section className="hc">
        <h3>Public Collections (${publicCols.length})</h3>
        ${publicCols.length
          ? publicCols.map(
              (c) => html`<div key=${c.id} className="li">
                <div className="t">
                  <b>${c.name}</b>
                  <small>${(c.items || []).length} items · Owner: ${c.owner}</small>
                </div>
                <button className="btn" style=${{ height: 30, padding: "0 12px", fontSize: 13 }} onClick=${() => onOpenPublic({ kind: "collection", data: c })}>Preview Portal</button>
                ${isAdmin &&
                html`<button className="btn" style=${{ height: 30, padding: "0 12px", fontSize: 13, color: "#ff3b30" }} onClick=${() => onRevokePublic("collection", c.id)}>Revoke</button>`}
              </div>`
            )
          : html`<p className="lead sm">No public collections active.</p>`}
      </section>
    </div>`}

    ${tab === "anl" &&
    html`<div>
      <div className="pdl-stat">
        <div className="hc"><b>${approvedCount}</b><small>Published Items</small></div>
        <div className="hc"><b>${stalePct}%</b><small>Stale Ratio (>Review Cycle)</small></div>
        <div className="hc"><b>${reqDone}/${req.length}</b><small>Required Reading Confirmed</small></div>
        <div className="hc"><b>${zeroSearches.length}</b><small>Zero-Result Search Gaps</small></div>
      </div>

      <div className="pdl-grid2">
        <section className="hc">
          <h3>Zero-Result Search Gaps</h3>
          <p className="lead sm">Queries employees searched for that returned nothing — strong candidates for new guides or resources.</p>
          ${zeroSearches.length
            ? zeroSearches.map(
                (l, idx) => html`<div key=${idx} className="li">
                  <div className="t"><b>“${l.query}”</b><small>${l.at}</small></div>
                  <button className="btn p" style=${{ height: 30, padding: "0 12px", fontSize: 13 }} onClick=${() => onCreateForTopic(l.query)}>+ Create Article</button>
                </div>`
              )
            : html`<p className="lead sm">No zero-result search gaps recorded yet. Try searching for a missing term to log a gap.</p>`}
        </section>

        <section className="hc">
          <h3>Activity Audit Log</h3>
          ${activities.slice(0, 12).map(
            (a) => html`<div key=${a.id} className="li pdl-log-li">
              <div className="av sm">${(a.actor || "S")[0]}</div>
              <div className="t">
                <b>${a.actor} · ${a.action}</b>
                <small>${a.targetTitle}${a.note ? " — " + a.note : ""} · ${a.at}</small>
              </div>
            </div>`
          )}
        </section>
      </div>
    </div>`}

    ${deactUser &&
    html`<div>
      <div className="ov" style=${{ zIndex: 80 }} onClick=${() => setDeactUser(null)}></div>
      <div className="pdl-modal" role="dialog" aria-modal="true">
        <h3>Deactivate User & Transfer Ownership</h3>
        <p className="lead" style=${{ fontSize: 14, margin: "8px 0 16px" }}>
          Deactivating <b>${deactUser.name}</b> immediately revokes access while preserving historical version attribution. All owned active Documents, Resources, Categories, and Collections must be transferred.
        </p>
        <div className="box">
          <b>Reassign ownership to active Editor / Admin:</b>
          <${Select}
            variant="field"
            ariaLabel="Reassign ownership"
            value=${fallbackOwner}
            options=${activeUsers
              .filter((u) => u.name !== deactUser.name && normRole(u.role) !== "Guest" && normRole(u.role) !== "Member")
              .map((u) => [u.name, u.name, false, null, ROLES[normRole(u.role)]])}
            onChange=${setFallbackOwner}
            style=${{ marginTop: 8 }}
          />
        </div>
        <div className="btns" style=${{ marginBottom: 0 }}>
          <button
            className="btn p"
            style=${{ background: "#ff3b30" }}
            onClick=${() => {
              onDeactivateUser(deactUser.id, deactUser.name, fallbackOwner);
              setDeactUser(null);
            }}
          >
            Confirm Deactivation & Handover
          </button>
          <button className="btn" onClick=${() => setDeactUser(null)}>Cancel</button>
        </div>
      </div>
    </div>`}
  </div>`;
}
