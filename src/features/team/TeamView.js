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
    <p className="lead">Company directory, Google Workspace verified identities, team ownership, and role governance.</p>

    <div className="pdl-seg-row" style=${{ marginBottom: 16 }}>
      <div className="seg">
        ${[
          ["people", `People (${activeUsers.length})`],
          ["teams", `Teams (${teams.length})`],
          ["roles", "Roles & Permissions"],
        ].map(([k, lb]) => html`<button key=${k} className=${tab === k ? "on" : ""} onClick=${() => setTab(k)}>${lb}</button>`)}
      </div>
      ${isAdmin &&
      tab === "people" &&
      html`<div className="btns" style=${{ margin: "0 0 0 auto" }}>
        <button type="button" className="btn p" onClick=${() => setInviting((v) => !v)}>
          <${Ic} n="plus" s=${15} /> Invite Google Member
        </button>
      </div>`}
      ${isAdmin &&
      tab === "teams" &&
      html`<div className="btns" style=${{ margin: "0 0 0 auto" }}>
        <button type="button" className="btn p" onClick=${() => setCreatingTeam((v) => !v)}>
          <${Ic} n="plus" s=${15} /> New Team
        </button>
      </div>`}
    </div>

    ${tab === "people" &&
    html`<div>
      ${inviting &&
      html`<form className="hc" style=${{ marginBottom: 18 }} onSubmit=${handleInvite}>
        <h3>Pre-Provision Google Workspace Member</h3>
        <p className="lead sm">When this person signs in via Google OAuth, they automatically receive their assigned role and team access.</p>
        <div className="pdl-form-grid">
          <label className="pdl-field">
            <span>Full Name</span>
            <input className="inp" placeholder="e.g. Kateryna M." value=${invite.name} onChange=${(e) => setInvite({ ...invite, name: e.target.value })} required />
          </label>
          <label className="pdl-field">
            <span>Google Email</span>
            <input className="inp" type="email" placeholder="kateryna@planit.studio" value=${invite.email} onChange=${(e) => setInvite({ ...invite, email: e.target.value })} required />
          </label>
          <label className="pdl-field">
            <span>Title / Position</span>
            <input className="inp" placeholder="e.g. MEP Coordinator" value=${invite.title} onChange=${(e) => setInvite({ ...invite, title: e.target.value })} />
          </label>
          <div className="pdl-field">
            <span>Department</span>
            <${Select}
              variant="field"
              ariaLabel="Department"
              value=${invite.dept}
              options=${teams.map((t) => [t.name, t.name])}
              onChange=${(v) => setInvite({ ...invite, dept: v })}
            />
          </div>
          <div className="pdl-field">
            <span>Role</span>
            <${Select}
              variant="field"
              ariaLabel="Role"
              value=${invite.role}
              options=${Object.entries(ROLES).filter(([k]) => k !== "SuperAdmin" || can.superAdmin(role)).map(([k, v]) => [k, v])}
              onChange=${(v) => setInvite({ ...invite, role: v })}
            />
          </div>
          <label className="pdl-field">
            <span>Photo URL (optional)</span>
            <input className="inp" placeholder="https://lh3.googleusercontent.com/..." value=${invite.avatar} onChange=${(e) => setInvite({ ...invite, avatar: e.target.value })} />
          </label>
        </div>
        <div className="btns" style=${{ marginBottom: 0 }}>
          <button type="submit" className="btn p">Send Invite & Enable SSO</button>
          <button type="button" className="btn" onClick=${() => setInviting(false)}>Cancel</button>
        </div>
      </form>`}

      <div className="fl" style=${{ marginBottom: 8 }}>
        <input
          className="inp"
          style=${{ maxWidth: 320, height: 34, minHeight: 0, padding: "0 12px" }}
          placeholder="Search people, emails, titles…"
          value=${search}
          onChange=${(e) => setSearch(e.target.value)}
        />
        <${Select}
          variant="filter"
          placeholder="Team"
          ariaLabel="Filter by team"
          value=${teamFilter}
          options=${[["", "All Teams"], ...teams.map((t) => [t.name, t.name])]}
          onChange=${setTeamFilter}
          minMenuWidth=${175}
        />
        ${(search || teamFilter) &&
        html`<button type="button" className="clr" onClick=${() => { setSearch(""); setTeamFilter(""); }}>Reset</button>`}
      </div>

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
      html`<form className="hc" style=${{ marginBottom: 18 }} onSubmit=${handleCreateTeam}>
        <h3>Create Department / Team</h3>
        <div className="pdl-form-grid">
          <label className="pdl-field">
            <span>Team Name</span>
            <input className="inp" placeholder="e.g. MEP Coordination" value=${newTeam.name} onChange=${(e) => setNewTeam({ ...newTeam, name: e.target.value })} required />
          </label>
          <label className="pdl-field">
            <span>Description</span>
            <input className="inp" placeholder="Focus area and responsibilities" value=${newTeam.desc} onChange=${(e) => setNewTeam({ ...newTeam, desc: e.target.value })} />
          </label>
          <div className="pdl-field">
            <span>Team Lead</span>
            <${Select}
              variant="field"
              ariaLabel="Team Lead"
              value=${newTeam.lead}
              options=${activeUsers.filter((u) => normRole(u.role) !== "Guest").map((u) => [u.name, u.name])}
              onChange=${(v) => setNewTeam({ ...newTeam, lead: v })}
            />
          </div>
          <div className="pdl-field">
            <span>Accent Color</span>
            <${Select}
              variant="field"
              ariaLabel="Team color"
              value=${newTeam.color}
              options={[
                ["#0071e3", "Blue", false, "#0071e3"],
                ["#8e5cf7", "Purple", false, "#8e5cf7"],
                ["#ff375f", "Pink / Red", false, "#ff375f"],
                ["#34c759", "Green", false, "#34c759"],
                ["#ff9f0a", "Orange", false, "#ff9f0a"],
                ["#30b0c7", "Teal", false, "#30b0c7"],
              ]}
              onChange=${(v) => setNewTeam({ ...newTeam, color: v })}
            />
          </div>
        </div>
        <div className="btns" style=${{ marginBottom: 0 }}>
          <button type="submit" className="btn p">Create Team</button>
          <button type="button" className="btn" onClick=${() => setCreatingTeam(false)}>Cancel</button>
        </div>
      </form>`}

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
              ["Create Drafts & Edit Owned Items", [1, 1, 1, 1, 0]],
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
