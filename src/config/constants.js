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
  createDraft: (r) => {
    const x = normRole(r);
    return x === "SuperAdmin" || x === "Admin" || x === "Editor";
  },
  catOwner: (cat, user, role) => {
    if (!cat || !user || cat.owner !== user) return false;
    if (role !== undefined) {
      const x = normRole(role);
      if (x === "Member" || x === "Guest") return false;
    }
    return true;
  },
  viewCat: (cat, role, user, userTeams = []) => {
    if (!cat) return false;
    const x = normRole(role);
    if (x === "SuperAdmin" || x === "Admin") return true;
    if (x === "Guest") return false;
    if (x === "Editor" && cat.owner === user) return true;
    if (cat.vis === "Restricted") {
      return (cat.teams || []).some((t) => userTeams.includes(t)) || (cat.users || []).includes(user);
    }
    return true;
  },
  editCat: (cat, role, user, userTeams = []) => {
    const x = normRole(role);
    if (x === "SuperAdmin" || x === "Admin") return true;
    if (x !== "Editor") return false;
    if (cat && cat.owner === user) return true;
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
    if (x === "Editor" && (item.author === user || can.catOwner(cat, user, x))) return true;
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
    if (x !== "Editor") return false;
    if (can.catOwner(cat, user, x) || (item && item.author === user)) return true;
    return cat ? can.editCat(cat, x, user, userTeams) : true;
  },
  status: (r, cat, user) => {
    const x = normRole(r);
    if (x === "SuperAdmin" || x === "Admin") return true;
    if (x !== "Editor") return false;
    if (can.catOwner(cat, user, x)) return true;
    return Boolean(cat && !cat.reqApproval);
  },
  comment: (r) => normRole(r) !== "Guest",
  rollback: (r, item, cat, user) => {
    const x = normRole(r);
    if (x === "SuperAdmin" || x === "Admin") return true;
    if (x !== "Editor") return false;
    return can.catOwner(cat, user, x) || Boolean(item && item.author === user);
  },
};

export const KB = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
export const RC = {
  General: "#8e8e93",
  VDC: DC.VDC,
  Structural: DC.Structure,
  Interior: DC.Interior,
  "P&C": DC.Architecture,
  "Overview & Standards": DC.Interior,
  "Documentation & Codes": DC.Architecture,
  "Modeling & Families": DC.VDC,
  "Coordination & QA": DC.MEP,
  "Drawings & Schedules": "#34c759",
};
export const RD = {
  General: "Architecture",
  VDC: "VDC",
  Structural: "Structure",
  Interior: "Interior",
  "P&C": "Architecture",
  "Overview & Standards": "Interior",
  "Documentation & Codes": "Architecture",
  "Modeling & Families": "Interior",
  "Coordination & QA": "VDC",
  "Drawings & Schedules": "Interior",
};
export const CITE = /\[(\d+)\]/g;
