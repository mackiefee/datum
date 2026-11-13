import { html, useState } from '../lib/react.js';
import { VIS, ROLES, can, normRole } from '../config/constants.js';
import { buildFlat, sub } from '../data/spaces.js';
import { Ic } from './Icon.js';
import { Select } from './Select.js';

const CAT_COLORS = ["#0071e3", "#8e5cf7", "#ff375f", "#ff9f0a", "#34c759", "#30b0c7", "#8e8e93"];

export function CategoryModal({ modal, tree, res, users, role, userName, onClose, onSave, onDelete }) {
  const flatCats = buildFlat(tree);
  const isAdmin = can.admin(role);
  const mode = modal.mode; // "create" | "edit" | "delete"
  const target = modal.cat || null;

  const [form, setForm] = useState(() => ({
    name: mode === "edit" && target ? target.name : "",
    parentId:
      mode === "create"
        ? (modal.parentId || "")
        : mode === "edit" && target && target.path.length > 1
        ? (() => {
            const pPath = target.path.slice(0, -1).join("›");
            const pNode = flatCats.find((c) => c.path.join("›") === pPath);
            return pNode ? pNode.id : "";
          })()
        : "",
    owner: (mode === "edit" && target && target.owner) || userName,
    vis: (mode === "edit" && target && target.vis) || "Internal",
    color: (mode === "edit" && target && target.color) || "#0a84ff",
    reqApproval: mode === "edit" && target ? Boolean(target.reqApproval) : true,
    reviewDays: (mode === "edit" && target && target.reviewDays) || 90,
  }));

  const descendantIds = target ? sub(target) : [];
  const affectedCount = target ? res.filter((r) => descendantIds.includes(r.node)).length : 0;

  const reassignChoices = flatCats.filter((c) => !descendantIds.includes(c.id));
  const [reassignTo, setReassignTo] = useState(
    (reassignChoices[0] && reassignChoices[0].id) || "c10-ovw-std"
  );

  const eligibleOwners = users
    .filter((u) => u.status === "active" && normRole(u.role) !== "Guest" && normRole(u.role) !== "Member")
    .map((u) => [u.name, u.name, false, null, ROLES[normRole(u.role)]]);

  const eligibleParents = flatCats.filter(
    (c) => c.level < 3 && !descendantIds.includes(c.id) && (isAdmin || c.owner === userName)
  );

  if (mode === "delete" && target) {
    const canRemoveLast = flatCats.length > descendantIds.length;
    return html`<div>
      <div className="ov" style=${{ zIndex: 85 }} onClick=${onClose}></div>
      <div className="pdl-modal" style=${{ zIndex: 90 }} role="dialog" aria-modal="true" aria-label="Delete Category">
        <button className="x" aria-label="Close" onClick=${onClose}><${Ic} n="x" s=${14} /></button>
        <h3>Delete “${target.name}”?</h3>
        <p className="lead" style=${{ fontSize: 14, margin: "8px 0 14px" }}>
          This will remove <b>${target.path.join(" › ")}</b>${descendantIds.length > 1 ? ` and its ${descendantIds.length - 1} subcategorie(s)` : ""}.
        </p>
        ${!canRemoveLast
          ? html`<div className="box" style=${{ color: "#ff3b30" }}>
              Cannot delete the only remaining category in the library. Create another category first.
            </div>`
          : affectedCount > 0
          ? html`<div className="box">
              <b>Safe Reassignment (${affectedCount} item${affectedCount === 1 ? "" : "s"} inside)</b>
              <div style=${{ margin: "6px 0 10px", color: "var(--sub)" }}>
                Choose where to move all existing Documents and Resources so nothing becomes orphaned:
              </div>
              <${Select}
                variant="field"
                ariaLabel="Move items to category"
                value=${reassignTo}
                options=${reassignChoices.map((c) => [c.id, c.path.join(" › ")])}
                onChange=${setReassignTo}
              />
            </div>`
          : html`<div className="box">No documents or resources currently live inside this category.</div>`}
        <div className="btns" style=${{ marginBottom: 0 }}>
          ${canRemoveLast &&
          html`<button
            type="button"
            className="btn p"
            style=${{ background: "#ff3b30" }}
            onClick=${() => onDelete(target.id, reassignTo)}
          >
            <${Ic} n="trash" s=${14} /> Delete & Reassign
          </button>`}
          <button type="button" className="btn" onClick=${onClose}>Cancel</button>
        </div>
      </div>
    </div>`;
  }

  return html`<div>
    <div className="ov" style=${{ zIndex: 85 }} onClick=${onClose}></div>
    <div className="pdl-modal" style=${{ zIndex: 90 }} role="dialog" aria-modal="true" aria-label=${mode === "edit" ? "Edit Category" : "Create Category"}>
      <button className="x" aria-label="Close" onClick=${onClose}><${Ic} n="x" s=${14} /></button>
      <h3>${mode === "edit" ? `Edit Category · ${target.name}` : "Create Category"}</h3>
      <p className="lead" style=${{ fontSize: 14, margin: "6px 0 14px" }}>
        Organize documents & tools up to 3 levels deep with an explicit owner and review cycle.
      </p>

      <div className="pdl-form-grid">
        <label className="pdl-field">
          <span>Category Name</span>
          <input
            className="inp"
            placeholder="e.g. BIM Automation"
            value=${form.name}
            onChange=${(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
          />
        </label>
        <div className="pdl-field">
          <span>Parent Space</span>
          <${Select}
            variant="field"
            ariaLabel="Parent Space"
            value=${form.parentId}
            disabled=${mode === "edit" && Boolean(target && target.kids && target.kids.length && form.parentId)}
            options=${[
              ...(isAdmin ? [["", "Root (Level 1)"]] : []),
              ...eligibleParents.map((c) => [c.id, c.path.join(" › ")]),
            ]}
            onChange=${(v) => setForm({ ...form, parentId: v })}
            minMenuWidth=${220}
          />
        </div>
        <div className="pdl-field">
          <span>Category Owner</span>
          <${Select}
            variant="field"
            ariaLabel="Category Owner"
            value=${form.owner}
            options=${eligibleOwners}
            onChange=${(v) => setForm({ ...form, owner: v })}
          />
        </div>
        <div className="pdl-field">
          <span>Default Visibility</span>
          <${Select}
            variant="field"
            ariaLabel="Default Visibility"
            value=${form.vis}
            options=${[
              ["Internal", "Internal (Company-wide)", false, VIS.Internal[1]],
              ["Restricted", "Restricted (Team / Invited)", false, VIS.Restricted[1]],
            ]}
            onChange=${(v) => setForm({ ...form, vis: v })}
          />
        </div>
        <div className="pdl-field">
          <span>Review Cycle (days)</span>
          <${Select}
            variant="field"
            ariaLabel="Review cycle"
            value=${String(form.reviewDays)}
            options=${[
              ["30", "30 days (Strict)"],
              ["60", "60 days"],
              ["90", "90 days (Standard)"],
              ["180", "180 days (Annual)"],
            ]}
            onChange=${(v) => setForm({ ...form, reviewDays: Number(v) })}
          />
        </div>
        <div className="pdl-field">
          <span>Folder Color</span>
          <div className="ctx-swatches" style=${{ padding: "7px 2px" }}>
            ${CAT_COLORS.map(
              (sw) => html`<button
                key=${sw}
                type="button"
                className=${"ctx-sw" + (form.color.toLowerCase() === sw.toLowerCase() ? " on" : "")}
                style=${{ background: sw }}
                onClick=${() => setForm({ ...form, color: sw })}
              ></button>`
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="pdl-ckrow"
        style=${{ marginTop: 12, padding: "10px 12px", borderRadius: 12, background: "var(--fill)" }}
        onClick=${() => setForm({ ...form, reqApproval: !form.reqApproval })}
      >
        <span className=${"ckb" + (form.reqApproval ? " on" : "")}>${form.reqApproval ? html`<${Ic} n="check" s=${12} />` : null}</span>
        <span>Require Admin / Category Owner approval before publishing inside this category</span>
      </button>

      <div className="btns" style=${{ marginBottom: 0 }}>
        <button
          type="button"
          className="btn p"
          disabled=${!form.name.trim()}
          onClick=${() => onSave({ mode, id: target && target.id, ...form, name: form.name.trim() })}
        >
          ${mode === "edit" ? "Save Changes" : "Create Category"}
        </button>
        <button type="button" className="btn" onClick=${onClose}>Cancel</button>
      </div>
    </div>
  </div>`;
}
