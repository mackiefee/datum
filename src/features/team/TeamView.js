import { createPortal } from 'react-dom';
import { html, useState } from '../../lib/react.js';
import { ROLES, can, normRole } from '../../config/constants.js';
import { buildFlat } from '../../data/spaces.js';
import { makeGooglePhotoFallback } from '../../lib/auth.js';
import { Ic } from '../../components/Icon.js';
import { Avatar } from '../../components/Badge.js';
import { Select } from '../../components/Select.js';

const ROLE_COL = {
  SuperAdmin: "#8e5cf7",
  Admin: "#0071e3",
  Editor: "#34c759",
  Member: "#8e8e93",
  Guest: "#ff9f0a",
};

export function TeamView({
  users = [],
  setUsers,
  teams = [],
  setTeams,
  res = [],
  tree = [],
  role,
  userName,
  onFilterByOwner,
  onSelectCat,
  flash,
}) {
  const [tab, setTab] = useState("people");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [inviting, setInviting] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [invite, setInvite] = useState({ name: "", email: "", title: "", dept: "VDC", role: "Member", avatar: "" });
  const [newTeam, setNewTeam] = useState({ name: "", desc: "", color: "#0071e3", lead: userName });

  const isAdmin = can.admin(role);
  const flatCats = buildFlat(tree);

  const activeUsers = users.filter((u) => u.status !== "deactivated");
  const filteredUsers = activeUsers.filter((u) => {
    const q = search.trim().toLowerCase();
    if (teamFilter && u.dept !== teamFilter && !(u.teams || []).includes(teamFilter)) return false;
    if (!q) return true;
    return `${u.name} ${u.email} ${u.title || ""} ${u.dept} ${ROLES[normRole(u.role)]}`.toLowerCase().includes(q);
  });

  const handleInvite = (e) => {
    e && e.preventDefault && e.preventDefault();
    const email = invite.email.trim().toLowerCase();
    const name = invite.name.trim() || email.split("@")[0];
    if (!email || users.some((u) => u.email.toLowerCase() === email)) {
      flash("A member with this Google email already exists");
      return;
    }
    const created = {
      id: "u-" + Date.now(),
      name,
      email,
      title: invite.title.trim() || "Team Member",
      role: invite.role === "SuperAdmin" && !can.superAdmin(role) ? "Admin" : invite.role,
      dept: invite.dept,
      teams: [invite.dept],
      status: "active",
      provider: "google",
      emailVerified: true,
      googleSub: "g-pre-" + Date.now(),
      avatar: invite.avatar.trim() || makeGooglePhotoFallback(name, "#0a84ff"),
    };
    setUsers((prev) => [...prev, created]);
    setTeams((prev) =>
      prev.map((tm) => (tm.name === invite.dept && !tm.members.includes(name) ? { ...tm, members: [...tm.members, name] } : tm))
    );
    setInviting(false);
    setInvite({ name: "", email: "", title: "", dept: "VDC", role: "Member", avatar: "" });
    flash(`Invited ${name} (${email}) — Google SSO ready`);
  };

  const handleCreateTeam = (e) => {
    e && e.preventDefault && e.preventDefault();
    const name = newTeam.name.trim();
    if (!name || teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
      flash("Team name is empty or already exists");
      return;
    }
    setTeams((prev) => [
      ...prev,
      {
        id: "t-" + Date.now(),
        name,
        desc: newTeam.desc.trim() || "Workspace department & content contributors.",
        color: newTeam.color,
        lead: newTeam.lead,
        members: [newTeam.lead],
      },
    ]);
    setCreatingTeam(false);
    setNewTeam({ name: "", desc: "", color: "#0071e3", lead: userName });
    flash(`Created team “${name}”`);
  };

  const toggleTeamMember = (teamId, memberName) => {
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    const exists = team.members.includes(memberName);
    setTeams((prev) =>
      prev.map((t) =>
        t.id === teamId
          ? { ...t, members: exists ? t.members.filter((m) => m !== memberName) : [...t.members, memberName] }
          : t
      )
    );
    setUsers((prev) =>
      prev.map((u) => {
        if (u.name !== memberName) return u;
        const curT = u.teams || [];
        return {
          ...u,
          teams: exists ? curT.filter((tn) => tn !== team.name) : [...new Set([...curT, team.name])],
        };
      })
    );
  };

  return html`<div>
    <div className="pdl-top">
      <div className="pdl-top-l">
        <h1>People & Teams</h1>
        <span className="pdl-cnt">${tab === "people" ? filteredUsers.length : teams.length}</span>
      </div>
      <div className="pdl-top-r">
        <div className="seg">
          ${[
            ["people", `People (${activeUsers.length})`],
            ["teams", `Teams (${teams.length})`],
            ["roles", "Roles"],
          ].map(([k, lb]) => html`<button key=${k} className=${tab === k ? "on" : ""} onClick=${() => setTab(k)}>${lb}</button>`)}
        </div>
        ${tab === "people" &&
        html`<input
          className="inp"
          placeholder="Search people…"
          value=${search}
          onChange=${(e) => setSearch(e.target.value)}
        />`}
        ${tab === "people" &&
        html`<${Select}
          variant="filter"
          placeholder="Team"
          ariaLabel="Filter by team"
          value=${teamFilter}
          options=${[["", "All Teams"], ...teams.map((t) => [t.name, t.name])]}
          onChange=${setTeamFilter}
          minMenuWidth=${175}
        />`}
        ${tab === "people" &&
        (search || teamFilter) &&
        html`<button type="button" className="clr" onClick=${() => { setSearch(""); setTeamFilter(""); }}>Reset</button>`}
        ${isAdmin &&
        tab === "people" &&
        html`<button type="button" className="btn p" onClick=${() => setInviting((v) => !v)}>
          <${Ic} n="plus" s=${14} /> Invite
        </button>`}
        ${isAdmin &&
        tab === "teams" &&
        html`<button type="button" className="btn p" onClick=${() => setCreatingTeam((v) => !v)}>
          <${Ic} n="plus" s=${14} /> New Team
        </button>`}
      </div>
    </div>

    ${tab === "people" &&
    html`<div>
      ${inviting &&
      createPortal(
        html`<div
          className="pdl-composer-ov"
          onMouseDown=${(e) => {
            if (e.target === e.currentTarget) setInviting(false);
          }}
          onKeyDown=${(e) => {
            if (e.key === "Escape") setInviting(false);
          }}
        >
          <form className="pdl-composer" role="dialog" aria-modal="true" aria-label="Invite Member" onSubmit=${handleInvite}>
            <div className="pdl-comp-head">
              <span className="pdl-comp-tag"><${Ic} n="users" s=${13} /> Invite Member · Google Workspace</span>
              <button type="button" className="x" style=${{ position: "static" }} aria-label="Close" onClick=${() => setInviting(false)}>
                <${Ic} n="x" s=${14} />
              </button>
            </div>
            <div className="pdl-comp-body">
              <input
                className="pdl-comp-title"
                type="email"
                placeholder="Google email (e.g. kateryna@planit.studio)"
                value=${invite.email}
                onChange=${(e) => setInvite({ ...invite, email: e.target.value })}
                required
                autoFocus
              />
              <div className="pdl-comp-row">
                <input
                  className="pdl-comp-mini"
                  placeholder="Full name (e.g. Kateryna M.)"
                  value=${invite.name}
                  onChange=${(e) => setInvite({ ...invite, name: e.target.value })}
                  required
                />
                <input
                  className="pdl-comp-mini"
                  placeholder="Title / position (optional)"
                  value=${invite.title}
                  onChange=${(e) => setInvite({ ...invite, title: e.target.value })}
                />
              </div>
            </div>
            <div className="pdl-comp-foot">
              <div className="pdl-comp-pills">
                <${Select}
                  variant="field"
                  ariaLabel="Department"
                  value=${invite.dept}
                  minMenuWidth=${180}
                  options=${teams.map((t) => [t.name, t.name])}
                  onChange=${(v) => setInvite({ ...invite, dept: v })}
                />
                <${Select}
                  variant="field"
                  ariaLabel="Role"
                  value=${invite.role}
                  minMenuWidth=${170}
                  options=${Object.entries(ROLES).filter(([k]) => k !== "SuperAdmin" || can.superAdmin(role)).map(([k, v]) => [k, v])}
                  onChange=${(v) => setInvite({ ...invite, role: v })}
                />
              </div>
              <div className="pdl-comp-acts">
                <button type="button" className="btn" onClick=${() => setInviting(false)}>Cancel</button>
                <button type="submit" className="btn p">Send Invite</button>
              </div>
            </div>
          </form>
        </div>`,
        document.body
      )}

      <div className="tm-grid">
        ${filteredUsers.map((u) => {
          const rKey = normRole(u.role);
          const ownedCount = res.filter((r) => r.author === u.name && r.status !== "Archived").length;
          const catOwnedCount = flatCats.filter((c) => c.owner === u.name).length;
          return html`<div key=${u.id} className="hc tm-card">
            <div className="tm-top">
              <${Avatar} user=${u} size="lg" />
              <div className="tm-meta">
                <div className="pdl-row" style=${{ gap: 6 }}>
                  <b>${u.name}</b>
                  ${u.provider === "google" &&
                  html`<span className="tm-gbadge" title="Verified Google Identity">G</span>`}
                </div>
                <span className="tm-title">${u.title || ROLES[rKey]}</span>
                <small>${u.email}</small>
              </div>
            </div>
            <div className="row" style=${{ marginTop: 12 }}>
              <span className="pill" style=${{ "--c": ROLE_COL[rKey] || "#8e8e93" }}>${ROLES[rKey]}</span>
              <span className="pill" style=${{ background: "var(--fill)" }}>${u.dept}</span>
              ${(u.teams || [])
                .filter((t) => t !== u.dept)
                .map((t) => html`<span key=${t} className="pill" style=${{ background: "var(--fill)" }}>${t}</span>`)}
            </div>
            <div className="tm-foot">
              <small>${ownedCount} items · ${catOwnedCount} spaces</small>
              <button
                type="button"
                className="mn"
                onClick=${() => onFilterByOwner && onFilterByOwner(u.name)}
              >
                View items ›
              </button>
            </div>
          </div>`;
        })}
      </div>
    </div>`}

    ${tab === "teams" &&
    html`<div>
      ${creatingTeam &&
      createPortal(
        html`<div
          className="pdl-composer-ov"
          onMouseDown=${(e) => {
            if (e.target === e.currentTarget) setCreatingTeam(false);
          }}
          onKeyDown=${(e) => {
            if (e.key === "Escape") setCreatingTeam(false);
          }}
        >
          <form className="pdl-composer" role="dialog" aria-modal="true" aria-label="New Team" onSubmit=${handleCreateTeam}>
            <div className="pdl-comp-head">
              <span className="pdl-comp-tag"><${Ic} n="users" s=${13} /> New Team</span>
              <button type="button" className="x" style=${{ position: "static" }} aria-label="Close" onClick=${() => setCreatingTeam(false)}>
                <${Ic} n="x" s=${14} />
              </button>
            </div>
            <div className="pdl-comp-body">
              <input
                className="pdl-comp-title"
                placeholder="Team name (e.g. MEP Coordination)"
                value=${newTeam.name}
                onChange=${(e) => setNewTeam({ ...newTeam, name: e.target.value })}
                required
                autoFocus
              />
              <input
                className="pdl-comp-sub"
                placeholder="Focus area and responsibilities..."
                value=${newTeam.desc}
                onChange=${(e) => setNewTeam({ ...newTeam, desc: e.target.value })}
              />
              <div className="pdl-comp-sw" role="radiogroup" aria-label="Team color">
                ${[
                  ["#0071e3", "Blue"],
                  ["#8e5cf7", "Purple"],
                  ["#ff375f", "Pink / Red"],
                  ["#34c759", "Green"],
                  ["#ff9f0a", "Orange"],
                  ["#30b0c7", "Teal"],
                ].map(
                  ([hex, label]) => html`<button
                    key=${hex}
                    type="button"
                    className=${newTeam.color === hex ? "on" : ""}
                    style=${{ background: hex }}
                    title=${label}
                    aria-label=${label}
                    aria-checked=${newTeam.color === hex}
                    onClick=${() => setNewTeam({ ...newTeam, color: hex })}
                  ></button>`
                )}
              </div>
            </div>
            <div className="pdl-comp-foot">
              <div className="pdl-comp-pills">
                <${Select}
                  variant="field"
                  ariaLabel="Team Lead"
                  value=${newTeam.lead}
                  minMenuWidth=${200}
                  options=${activeUsers.filter((u) => normRole(u.role) !== "Guest").map((u) => [u.name, u.name])}
                  onChange=${(v) => setNewTeam({ ...newTeam, lead: v })}
                />
              </div>
              <div className="pdl-comp-acts">
                <button type="button" className="btn" onClick=${() => setCreatingTeam(false)}>Cancel</button>
                <button type="submit" className="btn p" disabled=${!newTeam.name.trim()}>Create</button>
              </div>
            </div>
          </form>
        </div>`,
        document.body
      )}

      <div className="pdl-grid2">
        ${teams.map((tm) => {
          const teamUsers = activeUsers.filter((u) => tm.members.includes(u.name));
          const teamCats = flatCats.filter(
            (c) => c.name === tm.name || (c.teams || []).includes(tm.name) || c.path[0] === tm.name
          );
          const candidates = activeUsers.filter(
            (u) => normRole(u.role) !== "Guest" && !tm.members.includes(u.name)
          );
          return html`<section key=${tm.id} className="hc">
            <div className="ch2" style=${{ paddingRight: 0, marginBottom: 10 }}>
              <span className="tl" style=${{ "--c": tm.color }}><${Ic} n="teams" s=${18} /></span>
              <div className="who">
                <b>${tm.name}</b>
                <small>Lead: ${tm.lead} · ${teamUsers.length} members</small>
              </div>
            </div>
            <p className="lead sm" style=${{ margin: "6px 0 12px" }}>${tm.desc}</p>

            ${teamCats.length > 0 &&
            html`<div className="row" style=${{ marginBottom: 12 }}>
              <span style=${{ fontSize: 12, color: "var(--sub)" }}>Spaces:</span>
              ${teamCats.slice(0, 4).map(
                (c) => html`<button
                  key=${c.id}
                  type="button"
                  className="pill"
                  style=${{ "--c": tm.color, cursor: "pointer" }}
                  onClick=${() => onSelectCat && onSelectCat(c.id)}
                >
                  ${c.name}
                </button>`
              )}
            </div>`}

            <div>
              ${teamUsers.map(
                (u) => html`<div key=${u.id} className="li" style=${{ padding: "8px 0" }}>
                  <${Avatar} user=${u} size="sm" />
                  <div className="t">
                    <b>${u.name}</b>
                    <small>${u.title || ROLES[normRole(u.role)]}</small>
                  </div>
                  <span className="pill" style=${{ "--c": ROLE_COL[normRole(u.role)] || "#8e8e93" }}>${ROLES[normRole(u.role)]}</span>
                  ${isAdmin &&
                  u.name !== tm.lead &&
                  html`<button
                    type="button"
                    className="ib"
                    style=${{ width: 28, height: 28 }}
                    title=${`Remove ${u.name} from ${tm.name}`}
                    onClick=${() => toggleTeamMember(tm.id, u.name)}
                  >
                    <${Ic} n="x" s=${12} />
                  </button>`}
                </div>`
              )}
            </div>

            ${isAdmin &&
            candidates.length > 0 &&
            html`<div style=${{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
              <${Select}
                variant="field"
                ariaLabel=${`Add member to ${tm.name}`}
                placeholder="+ Add member to team…"
                value=""
                options=${[["", "Choose person…"], ...candidates.map((u) => [u.name, u.name, false, null, ROLES[normRole(u.role)]])]}
                onChange=${(v) => v && toggleTeamMember(tm.id, v)}
                style=${{ height: 34 }}
              />
            </div>`}
          </section>`;
        })}
      </div>
    </div>`}

    ${tab === "roles" &&
    html`<div className="hc" style=${{ marginTop: 8 }}>
      <h3>5-Tier Access Control & Google Auth Policy</h3>
      <p className="lead sm">Roles enforce least privilege across Knowledge Base, Resource Library, Edge AI, and PostgreSQL RLS.</p>
      <div className="tw" style=${{ marginTop: 14 }}>
        <table>
          <thead>
            <tr>
              <th>Capability</th>
              ${Object.values(ROLES).map((n) => html`<th key=${n}>${n}</th>`)}
            </tr>
          </thead>
          <tbody>
            ${[
              ["Read Public & External Portal", [1, 1, 1, 1, 1]],
              ["Read Internal & Restricted (if Permitted)", [1, 1, 1, 1, 0]],
              ["Comment, Bookmark & Ask Edge AI", [1, 1, 1, 1, 0]],
              ["Create Drafts & Edit Owned Items", [1, 1, 1, 0, 0]],
              ["Edit Category Content & Subcategories", [1, 1, 1, 0, 0]],
              ["Approve / Publish / Archive Content", [1, 1, 0, 0, 0]],
              ["Publish Externally (Public Portal)", [1, 1, 0, 0, 0]],
              ["Manage Users, Deactivate & Handover", [1, 1, 0, 0, 0]],
              ["Assign Super Admin & Root Governance", [1, 0, 0, 0, 0]],
            ].map(
              ([label, flags]) => html`<tr key=${label}>
                <td>${label}</td>
                ${flags.map((ok, idx) => html`<td key=${idx}>${ok ? html`<span className="ok"><${Ic} n="check" s=${16} /></span>` : html`<span className="no">–</span>`}</td>`)}
              </tr>`
            )}
          </tbody>
        </table>
      </div>
      <div className="box" style=${{ marginTop: 18 }}>
        <b>Conflict Resolution Security Rules</b>
        Item Restricted overrides an Open Category · Direct Pinpoint Share unlocks an item without exposing its Restricted parent category name · Public documents strip non-cleared attachments and disable links to Internal targets · Google Auth verifies email ownership and blocks deactivated sessions across Supabase RLS.
      </div>
    </div>`}
  </div>`;
}
