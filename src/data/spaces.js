export const TREE = [
  {
    id: "gen",
    name: "General",
    color: "#8e8e93",
    owner: "Maxim",
    vis: "Internal",
    reqApproval: true,
    reviewDays: 90,
    editTeams: ["VDC", "Structural", "P&C"],
    kids: [
      { id: "gen-pol", name: "Policies", owner: "Maxim", vis: "Internal", reqApproval: true, reviewDays: 90 },
      { id: "gen-link", name: "Services and links", owner: "Olena K.", vis: "Internal", reqApproval: false, reviewDays: 180 },
    ],
  },
  {
    id: "vdc",
    name: "VDC",
    color: "#8e5cf7",
    owner: "Maxim",
    vis: "Internal",
    reqApproval: true,
    reviewDays: 90,
    editTeams: ["VDC"],
    kids: [
      {
        id: "vdc-bim",
        name: "BIM standards",
        owner: "Maxim",
        vis: "Internal",
        reqApproval: true,
        reviewDays: 90,
        editTeams: ["VDC"],
        kids: [{ id: "vdc-name", name: "Naming", owner: "Iryna P.", vis: "Internal", reqApproval: true, reviewDays: 90, editTeams: ["VDC"] }],
      },
      { id: "vdc-proc", name: "Processes", owner: "Maxim", vis: "Internal", reqApproval: true, reviewDays: 90, editTeams: ["VDC"] },
      { id: "vdc-tool", name: "Revit tools", owner: "Maxim", vis: "Internal", reqApproval: false, reviewDays: 120, editTeams: ["VDC"] },
    ],
  },
  {
    id: "str",
    name: "Structural",
    color: "#ff375f",
    owner: "Olena K.",
    vis: "Internal",
    reqApproval: true,
    reviewDays: 90,
    editTeams: ["Structural"],
    kids: [
      { id: "str-std", name: "Standards", owner: "Olena K.", vis: "Internal", reqApproval: true, reviewDays: 90, editTeams: ["Structural"] },
      { id: "str-tpl", name: "Templates", owner: "Olena K.", vis: "Internal", reqApproval: false, reviewDays: 180, editTeams: ["Structural"] },
    ],
  },
  {
    id: "int",
    name: "Interior",
    color: "#ff9f0a",
    owner: "Sofiia L.",
    vis: "Internal",
    reqApproval: false,
    reviewDays: 90,
    editTeams: ["Interior"],
    kids: [
      { id: "int-fam", name: "Families", owner: "Sofiia L.", vis: "Internal", reqApproval: false, reviewDays: 180, editTeams: ["Interior"] },
      { id: "int-std", name: "Standards", owner: "Sofiia L.", vis: "Internal", reqApproval: true, reviewDays: 90, editTeams: ["Interior"] },
    ],
  },
  {
    id: "pc",
    name: "P&C",
    color: "#0071e3",
    owner: "Olena K.",
    vis: "Restricted",
    teams: ["P&C", "Structural"],
    reqApproval: true,
    reviewDays: 90,
    editTeams: ["P&C"],
    kids: [{ id: "pc-proc", name: "Processes", owner: "Olena K.", vis: "Restricted", teams: ["P&C", "Structural"], reqApproval: true, reviewDays: 90, editTeams: ["P&C"] }],
  },
];

export function buildFlat(tree = TREE) {
  const out = [];
  function walk(nodes, path, inherited) {
    (nodes || []).forEach((n) => {
      const merged = {
        ...n,
        path: [...path, n.name],
        level: path.length + 1,
        color: n.color || inherited.color || "#8e8e93",
        owner: n.owner || inherited.owner || "Maxim",
        vis: n.vis || inherited.vis || "Internal",
        teams: n.teams || inherited.teams || [],
        editTeams: n.editTeams || inherited.editTeams || [],
        reqApproval: n.reqApproval !== undefined ? n.reqApproval : Boolean(inherited.reqApproval),
        reviewDays: n.reviewDays || inherited.reviewDays || 90,
      };
      out.push(merged);
      if (n.kids && n.kids.length) walk(n.kids, merged.path, merged);
    });
  }
  walk(tree, [], {});
  return out;
}

export const flat = buildFlat(TREE);

export const sub = (n) => {
  if (!n) return [];
  let o = [n.id];
  (n.kids || []).forEach((k) => {
    o = o.concat(sub(k));
  });
  return o;
};

export const byId = (id, tree) => {
  const list = tree ? buildFlat(tree) : flat;
  return list.find((n) => n.id === id);
};
