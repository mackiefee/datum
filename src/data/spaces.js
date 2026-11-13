export const TREE = [
  {
    id: "int",
    name: "Interior",
    color: "#ff9f0a",
    owner: "Elena Khlivetskaya",
    vis: "Internal",
    reqApproval: true,
    reviewDays: 90,
    editTeams: ["Interior PE", "VDC", "P&C"],
    kids: [
      {
        id: "c10-ovw",
        name: "Overview & Standards",
        color: "#ff9f0a",
        owner: "Elena Khlivetskaya",
        vis: "Internal",
        reqApproval: true,
        reviewDays: 90,
        editTeams: ["Interior PE", "VDC", "P&C"],
        kids: [
          { id: "c10-ovw-std", name: "General Standards & Revisions", owner: "Elena Khlivetskaya", vis: "Internal", reqApproval: true, reviewDays: 90 },
          { id: "c10-ovw-start", name: "Project Start & Setup", owner: "Iryna P.", vis: "Internal", reqApproval: false, reviewDays: 90 },
        ],
      },
      {
        id: "c10-doc",
        name: "Documentation & Codes",
        color: "#0071e3",
        owner: "Andrii Lytvynov",
        vis: "Internal",
        reqApproval: true,
        reviewDays: 90,
        editTeams: ["Interior PE", "P&C", "VDC"],
        kids: [
          { id: "c10-doc-read", name: "Project Reading & Naming", owner: "Andrii Lytvynov", vis: "Internal", reqApproval: false, reviewDays: 90 },
          { id: "c10-doc-codes", name: "Codes, Fire & Egress", owner: "Elena Khlivetskaya", vis: "Internal", reqApproval: true, reviewDays: 60 },
        ],
      },
      {
        id: "c10-mod",
        name: "Modeling & Families",
        color: "#8e5cf7",
        owner: "Maxim",
        vis: "Internal",
        reqApproval: true,
        reviewDays: 90,
        editTeams: ["Interior PE", "VDC"],
        kids: [
          { id: "c10-mod-wall", name: "Walls, Ceilings & Floors", owner: "Iryna P.", vis: "Internal", reqApproval: true, reviewDays: 90 },
          { id: "c10-mod-door", name: "Doors, Openings & Access", owner: "Maxim", vis: "Internal", reqApproval: false, reviewDays: 90 },
          { id: "c10-mod-eqp", name: "Equipment, Casework & Specialties", owner: "Andrii Lytvynov", vis: "Internal", reqApproval: false, reviewDays: 120 },
        ],
      },
      {
        id: "c10-crd",
        name: "Coordination & QA",
        color: "#30b0c7",
        owner: "Elena Khlivetskaya",
        vis: "Internal",
        reqApproval: true,
        reviewDays: 60,
        editTeams: ["Interior PE", "VDC", "MEP", "Structural"],
        kids: [
          { id: "c10-crd-sys", name: "MEP, Structural & Lighting Sync", owner: "Elena Khlivetskaya", vis: "Internal", reqApproval: true, reviewDays: 60 },
          { id: "c10-crd-qa", name: "QA Checks & Common Mistakes", owner: "Maxim", vis: "Internal", reqApproval: false, reviewDays: 60 },
        ],
      },
      {
        id: "c10-drw",
        name: "Drawings & Schedules",
        color: "#34c759",
        owner: "Iryna P.",
        vis: "Internal",
        reqApproval: true,
        reviewDays: 90,
        editTeams: ["Interior PE", "P&C"],
        kids: [
          { id: "c10-drw-gen", name: "General Notes, Specs & Sheets", owner: "Iryna P.", vis: "Internal", reqApproval: true, reviewDays: 90 },
          { id: "c10-drw-lay", name: "Floor Plans, RCP & Elevations", owner: "Elena Khlivetskaya", vis: "Internal", reqApproval: false, reviewDays: 90 },
          { id: "c10-drw-sch", name: "Schedules, Material Matrix & 3D", owner: "Andrii Lytvynov", vis: "Internal", reqApproval: true, reviewDays: 90 },
        ],
      },
    ],
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
