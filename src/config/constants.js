export const TODAY = "2026-10-22", ME = "Maxim";

export const ST = {
  Draft: ["Draft", "#8e8e93"],
  Review: ["In review", "#ff9f0a"],
  Approved: ["Published", "#34c759"],
  Archived: ["Archived", "#636366"],
};

export const VIS = {
  Restricted: ["Restricted", "#ff375f"],
  Internal: ["Internal", "#0a84ff"],
  Public: ["Public", "#34c759"],
};

export const TY = {
  doc: "Document",
  report: "Report",
  service: "Tool / Service",
  link: "Link",
  media: "Media Asset",
  template: "Template",
};

export const isDocType = (t) => t === "doc" || t === "report";
export const isResType = (t) => !isDocType(t);

export const STG = ["Concept", "Design", "Construction"];
export const DISC = ["Architecture", "Structure", "MEP", "Interior", "VDC"];
export const DC = {
  Architecture: "#0071e3",
  Structure: "#ff375f",
  MEP: "#30b0c7",
  Interior: "#ff9f0a",
  VDC: "#8e5cf7",
};

export const ROLES = {
  SuperAdmin: "Super Admin",
  Admin: "Admin",
  Editor: "Editor",
  Member: "Member",
  Guest: "Guest / External",
};

export const normRole = (r) =>
  r === "Owner" || r === "super_admin"
    ? "SuperAdmin"
    : r === "Moderator" || r === "admin"
    ? "Admin"
    : r === "editor"
    ? "Editor"
    : r === "Reader" || r === "member"
    ? "Member"
    : r === "guest"
    ? "Guest"
    : ROLES[r]
    ? r
    : "Member";

export const can = {
  admin: (r) => {
    const x = normRole(r);
    return x === "SuperAdmin" || x === "Admin";
  },
  superAdmin: (r) => normRole(r) === "SuperAdmin",
  publicize: (r) => can.admin(r),
  createDraft: (r) => normRole(r) !== "Guest",
  catOwner: (cat, user) => Boolean(cat && user && cat.owner === user),
  viewCat: (cat, role, user, userTeams = []) => {
    if (!cat) return false;
    const x = normRole(role);
    if (x === "SuperAdmin" || x === "Admin") return true;
    if (x === "Guest") return false;
    if (cat.owner === user) return true;
    if (cat.vis === "Restricted") {
      return (cat.teams || []).some((t) => userTeams.includes(t)) || (cat.users || []).includes(user);
    }
    return true;
  },
  editCat: (cat, role, user, userTeams = []) => {
    const x = normRole(role);
    if (x === "SuperAdmin" || x === "Admin") return true;
    if (cat && cat.owner === user) return true;
    if (x !== "Editor") return false;
    if (cat && cat.editTeams && cat.editTeams.length) {
      return cat.editTeams.some((t) => userTeams.includes(t));
    }
    return true;
  },
  view: (item, role, user, cat, shares = [], userTeams = []) => {
    if (!item || item.status === "Deleted") return false;
    const x = normRole(role);
    if (x === "SuperAdmin" || x === "Admin") return true;
    const direct = shares.some(
      (s) => s.targetType === "item" && s.targetId === item.id && (s.grantee === user || userTeams.includes(s.grantee))
    );
    if (x === "Guest") return item.status === "Approved" && (item.vis === "Public" || direct);
    if (item.author === user || can.catOwner(cat, user)) return true;
    if (item.status !== "Approved") {
      return x === "Editor" && can.editCat(cat, x, user, userTeams);
    }
    if (direct) return true;
    if (item.vis === "Restricted") return false;
    return can.viewCat(cat, x, user, userTeams);
  },
  edit: (r, item, cat, user, userTeams = []) => {
    const x = normRole(r);
    if (x === "SuperAdmin" || x === "Admin") return true;
    if (can.catOwner(cat, user)) return true;
    if (item && item.author === user && (x === "Editor" || (x === "Member" && item.status === "Draft"))) return true;
    if (x === "Editor") return cat ? can.editCat(cat, x, user, userTeams) : true;
    return false;
  },
  status: (r, cat, user) => {
    const x = normRole(r);
    if (x === "SuperAdmin" || x === "Admin") return true;
    if (can.catOwner(cat, user)) return true;
    if (x === "Editor" && cat && !cat.reqApproval) return true;
    return false;
  },
  comment: (r) => normRole(r) !== "Guest",
  rollback: (r, item, cat, user) => {
    const x = normRole(r);
    return x === "SuperAdmin" || x === "Admin" || can.catOwner(cat, user) || (Boolean(item && item.author === user) && x === "Editor");
  },
};

export const KB = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
export const RC = { General: "#8e8e93", VDC: DC.VDC, Structural: DC.Structure, Interior: DC.Interior, "P&C": DC.Architecture };
export const RD = { General: "Architecture", VDC: "VDC", Structural: "Structure", Interior: "Interior", "P&C": "Architecture" };
export const CITE = /\[(\d+)\]/g;
