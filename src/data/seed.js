import { ME, TODAY } from '../config/constants.js';

const avSvg = (bg, fg, init) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${fg}"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#g)"/><circle cx="40" cy="31" r="13" fill="#fff" fill-opacity=".28"/><path d="M18 70c3-14 14-20 22-20s19 6 22 20" fill="#fff" fill-opacity=".28"/><text x="40" y="47" text-anchor="middle" fill="#fff" font-family="-apple-system,Inter,sans-serif" font-weight="700" font-size="24">${init}</text></svg>`
  );

export const USERS = [
  { id: "u1", name: "Maxim", email: "maxim@planit.studio", title: "Head of VDC & BIM Lead", role: "SuperAdmin", dept: "VDC", teams: ["VDC", "General"], status: "active", provider: "google", emailVerified: true, googleSub: "g-1048291001", avatar: avSvg("#0a84ff", "#5e5ce6", "M") },
  { id: "u2", name: "Olena K.", email: "olena@planit.studio", title: "Principal Structural Engineer", role: "Admin", dept: "Structural", teams: ["Structural", "P&C"], status: "active", provider: "google", emailVerified: true, googleSub: "g-1048291002", avatar: avSvg("#ff375f", "#bf5af2", "OK") },
  { id: "u3", name: "Iryna P.", email: "iryna@planit.studio", title: "Senior BIM Coordinator", role: "Editor", dept: "VDC", teams: ["VDC", "Interior"], status: "active", provider: "google", emailVerified: true, googleSub: "g-1048291003", avatar: avSvg("#8e5cf7", "#30b0c7", "IP") },
  { id: "u4", name: "Andrii B.", email: "andrii@planit.studio", title: "BIM Modeler & Dynamo Specialist", role: "Editor", dept: "Structural", teams: ["Structural", "VDC"], status: "active", provider: "google", emailVerified: true, googleSub: "g-1048291004", avatar: avSvg("#34c759", "#0a84ff", "AB") },
  { id: "u5", name: "Sofiia L.", email: "sofiia@planit.studio", title: "Interior Architect", role: "Member", dept: "Interior", teams: ["Interior"], status: "active", provider: "google", emailVerified: true, googleSub: "g-1048291005", avatar: avSvg("#ff9f0a", "#ff375f", "SL") },
  { id: "u6", name: "External Partner", email: "partner@client.example", title: "External Reviewer", role: "Guest", dept: "External", teams: [], status: "active", provider: "guest", emailVerified: false, googleSub: "", avatar: avSvg("#8e8e93", "#48484a", "EP") },
];

export const SEED_TEAMS = [
  { id: "t-vdc", name: "VDC", desc: "BIM standards, CDE coordination, model health & automation.", color: "#8e5cf7", lead: "Maxim", members: ["Maxim", "Iryna P.", "Andrii B."] },
  { id: "t-str", name: "Structural", desc: "Load-bearing standards, foundations, stiffness cores & Revit templates.", color: "#ff375f", lead: "Olena K.", members: ["Olena K.", "Andrii B.", "Sofiia L."] },
  { id: "t-int", name: "Interior", desc: "Interior drawing presentation, schedules & family libraries.", color: "#ff9f0a", lead: "Sofiia L.", members: ["Sofiia L.", "Iryna P.", "Maxim"] },
  { id: "t-pc", name: "P&C", desc: "Project delivery, quality assurance & restricted client documentation issue.", color: "#0071e3", lead: "Olena K.", members: ["Olena K.", "Maxim", "Iryna P."] },
];

export const TEAMS = [
  ["VDC", [["Maxim", "SuperAdmin"], ["Iryna P.", "Editor"], ["Andrii B.", "Editor"]]],
  ["Structural", [["Olena K.", "Admin"], ["Andrii B.", "Editor"], ["Sofiia L.", "Member"]]],
  ["Interior", [["Sofiia L.", "Member"], ["Iryna P.", "Editor"], ["Maxim", "SuperAdmin"]]],
  ["P&C", [["Olena K.", "Admin"], ["Maxim", "SuperAdmin"], ["Iryna P.", "Member"]]],
];

export const mk = (o) => ({
  links: [],
  c: [],
  vis: "Internal",
  verified: o.upd,
  publicAttachments: [],
  url: o.type === "service" || o.type === "link" ? o.url || "https://drive.google.com" : o.url || "",
  ...o,
  v: o.prev
    ? [
        { n: 1, by: o.author, d: "2026-08-12", note: "Created", body: o.prev },
        { n: 2, by: o.author, d: o.upd, note: "Updated", body: o.body },
      ]
    : [{ n: 1, by: o.author, d: o.upd, note: "Created", body: o.body }],
});

export const SEED = [
  mk({
    id: 1,
    node: "vdc-bim",
    type: "doc",
    vis: "Internal",
    title: "BIM Execution Plan — template",
    desc: "BEP basis for every new project: roles, CDE, exchange schedule.",
    body: "The BEP defines roles, responsibilities, exchange formats and project checkpoints. It is filled in at the start and updated at every stage. All changes are recorded in versions.",
    prev: "The BEP defines roles and exchange formats.",
    status: "Approved",
    stage: "Concept",
    disc: "VDC",
    tags: ["BEP", "BIM", "start"],
    author: "Maxim",
    upd: "2026-10-14",
    links: [[2, "hard"], [12, "soft"]],
  }),
  mk({
    id: 2,
    node: "vdc-name",
    type: "doc",
    vis: "Public",
    title: "File and model naming",
    desc: "Unified code scheme: project-originator-volume-level-type-number.",
    body: "All files in the CDE are named using the project-originator-volume-level-type-number scheme. Discipline codes are listed in the appendix. Files with incorrect names are not accepted for publication.",
    status: "Approved",
    stage: "Design",
    disc: "VDC",
    tags: ["naming", "CDE"],
    author: "Iryna P.",
    upd: "2026-09-30",
  }),
  mk({
    id: 3,
    node: "vdc-proc",
    type: "doc",
    vis: "Internal",
    title: "Model coordination and clash detection",
    desc: "Procedure for weekly clash checks between disciplines.",
    body: "Every week by Friday the disciplines publish their models to the CDE. VDC assembles the federated model, runs the clash check and sends the report to the responsible people. Critical clashes are closed before the next meeting.",
    status: "Review",
    stage: "Design",
    disc: "VDC",
    tags: ["Navisworks", "clashes"],
    author: "Maxim",
    upd: "2026-10-20",
    links: [[1, "hard"], [13, "soft"]],
    c: [{ by: "Andrii B.", d: "2026-10-20", t: "@Maxim add clash priority criteria." }],
  }),
  mk({
    id: 4,
    node: "str-std",
    type: "doc",
    vis: "Internal",
    title: "Design loads — standard",
    desc: "Baseline loads and factors for structural models.",
    body: "The document defines baseline loads, reliability factors and load combinations. It is used as input data for load-bearing elements and foundations.",
    status: "Approved",
    stage: "Design",
    disc: "Structure",
    tags: ["loads", "calculation"],
    author: "Olena K.",
    upd: "2026-09-12",
  }),
  mk({
    id: 5,
    node: "str-tpl",
    type: "doc",
    vis: "Internal",
    title: "Foundation — typical solution",
    desc: "Typical slab and strip foundations with details.",
    body: "Typical slab and strip foundation solutions with wall junction details. Before use, compliance with the design loads is verified.",
    status: "Draft",
    stage: "Design",
    disc: "Structure",
    tags: ["foundation", "details"],
    author: "Olena K.",
    upd: "2026-10-18",
    links: [[4, "hard"]],
  }),
  mk({
    id: 6,
    node: "int-fam",
    type: "media",
    vis: "Internal",
    title: "Furniture family library",
    desc: "Verified furniture and equipment families for Revit.",
    body: "The families have been checked for naming, parameters and file size. Do not upload third-party families without a check by the VDC team.",
    status: "Approved",
    stage: "Construction",
    disc: "Interior",
    tags: ["families", "Revit"],
    author: "Sofiia L.",
    upd: "2026-09-22",
    url: "https://drive.google.com",
  }),
  mk({
    id: 7,
    node: "int-std",
    type: "doc",
    vis: "Internal",
    title: "Interior drawing presentation",
    desc: "Title blocks, scales, line weights and schedules for interiors.",
    body: "A0-A3 formats, title block, line and fill styles, rules for placing plans, elevations and schedules on sheets.",
    status: "Review",
    stage: "Construction",
    disc: "Interior",
    tags: ["sheets", "graphics"],
    author: "Sofiia L.",
    upd: "2026-10-16",
    links: [[2, "soft"]],
  }),
  mk({
    id: 8,
    node: "pc-proc",
    type: "doc",
    vis: "Restricted",
    title: "Issuing the documentation set",
    desc: "Preparing, checking and issuing sheets to the client.",
    body: "The model is frozen and versioned. Sheets are checked against a checklist, PDF and DWG are exported, and the issue is recorded in the register. The package is uploaded to the CDE and the team is notified.",
    status: "Approved",
    stage: "Construction",
    disc: "Architecture",
    tags: ["issue", "QA"],
    author: "Olena K.",
    upd: "2026-10-02",
    links: [[1, "hard"], [2, "hard"]],
  }),
  mk({
    id: 9,
    node: "vdc-tool",
    type: "service",
    vis: "Internal",
    title: "pyRevit — corporate extension",
    desc: "Custom scripts for sheets, annotations and model checking.",
    body: "pyRevit extension with tools for managing sheets, transferring annotations and checking the model. Updated weekly from the repository.",
    status: "Approved",
    stage: "Design",
    disc: "VDC",
    tags: ["pyRevit", "Python", "automation"],
    author: "Maxim",
    upd: "2026-10-19",
    url: "https://pyrevitlabs.io",
    links: [[3, "soft"]],
  }),
  mk({
    id: 10,
    node: "gen-link",
    type: "service",
    vis: "Internal",
    title: "Redmine — project tasks",
    desc: "Tracker of tasks and deadlines by project.",
    body: "Tasks, deadlines and owners by project. Every model change that affects the issue must have a task.",
    status: "Approved",
    stage: "Design",
    disc: "Architecture",
    tags: ["tasks", "tracker"],
    author: "Olena K.",
    upd: "2026-08-30",
    url: "https://www.redmine.org",
  }),
  mk({
    id: 11,
    node: "gen-link",
    type: "link",
    vis: "Public",
    title: "DBN regulatory framework",
    desc: "Current building codes of Ukraine.",
    body: "Check the edition and effective date of the codes before starting a stage.",
    status: "Approved",
    stage: "Concept",
    disc: "Architecture",
    tags: ["DBN", "codes"],
    author: "Andrii B.",
    upd: "2026-06-15",
    url: "https://dbn.co.ua",
  }),
  mk({
    id: 12,
    node: "gen-pol",
    type: "doc",
    vis: "Internal",
    title: "CDE access policy",
    desc: "Who can see and edit what, and at which level.",
    body: "Access is granted at the department, folder or individual document level. Roles: Super Admin, Admin, Editor, Member, Guest. Permissions are reviewed quarterly.",
    status: "Draft",
    stage: "Concept",
    disc: "VDC",
    tags: ["access", "CDE", "roles"],
    author: "Maxim",
    upd: "2026-10-21",
  }),
  mk({
    id: 13,
    node: "vdc-proc",
    type: "report",
    vis: "Internal",
    title: "Report: model quality for the month",
    desc: "Trends in warnings, duplicates and clashes by project.",
    body: "Monthly report: number of Revit warnings, duplicates, open clashes and deviations from the naming standard by project.",
    status: "Review",
    stage: "Design",
    disc: "VDC",
    tags: ["QA", "report", "clashes"],
    author: "Iryna P.",
    upd: "2026-10-10",
    links: [[3, "soft"]],
  }),
  mk({
    id: 14,
    node: "str-std",
    type: "doc",
    vis: "Internal",
    title: "Elevator shaft — requirements",
    desc: "Geometry, loads and coordination of the stiffness core.",
    body: "Requirements for shaft geometry, anchors and loads from elevator equipment. The stiffness core is coordinated with the walls and foundation.",
    status: "Draft",
    stage: "Design",
    disc: "Structure",
    tags: ["elevator", "core"],
    author: "Andrii B.",
    upd: "2026-10-17",
    links: [[15, "hard"], [5, "soft"]],
  }),
  mk({
    id: 15,
    node: "str-std",
    type: "doc",
    vis: "Internal",
    title: "Load-bearing wall — standard",
    desc: "Thicknesses, reinforcement, openings and junctions with the foundation.",
    body: "Minimum thicknesses, reinforcement layouts and rules for forming openings. The wall rests on the foundation and interacts with the elevator shaft core.",
    status: "Approved",
    stage: "Design",
    disc: "Structure",
    tags: ["wall", "reinforcement"],
    author: "Olena K.",
    upd: "2026-09-25",
    links: [[5, "hard"], [14, "soft"]],
  }),
  mk({
    id: 16,
    node: "str-tpl",
    type: "template",
    vis: "Internal",
    title: "Revit Project Starter Template (BEP v3)",
    desc: "Clean .rte template with shared parameters, view templates and title blocks.",
    body: "Use this starter template for all new Revit 2026 architectural and structural models. Purge unused families before first CDE publication.",
    status: "Approved",
    stage: "Concept",
    disc: "VDC",
    tags: ["template", "Revit", "start"],
    author: "Maxim",
    upd: "2026-10-15",
    url: "https://drive.google.com/starter-template",
    links: [[1, "hard"], [2, "hard"]],
  }),
];

export const NOTES = [
  { id: "a", text: "Andrii B. left a comment on “Model coordination and clash detection”", rid: 3, t: "2 h ago", un: 1 },
  { id: "b", text: "“Interior drawing presentation” submitted for approval", rid: 7, t: "yesterday", un: 1 },
  { id: "c", text: "Olena K. updated “Foundation — typical solution”", rid: 5, t: "4 days ago", un: 0 },
];

export const IMG0 = {
  demo:
    "data:image/svg+xml," +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 260"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0a84ff"/><stop offset="1" stop-color="#8e5cf7"/></linearGradient></defs><rect width="720" height="260" fill="url(#g)"/><g fill="#fff" font-family="sans-serif" font-size="20" text-anchor="middle"><rect x="50" y="95" width="170" height="70" rx="16" fill-opacity=".22"/><rect x="275" y="95" width="170" height="70" rx="16" fill-opacity=".22"/><rect x="500" y="95" width="170" height="70" rx="16" fill-opacity=".22"/><text x="135" y="137">Draft</text><text x="360" y="137">Approval</text><text x="585" y="137">Published</text></g></svg>'
    ),
};

export const GUIDE = mk({
  id: 100,
  node: "gen-pol",
  type: "doc",
  vis: "Public",
  publicAttachments: ["demo"],
  title: "How to use the Knowledge Library",
  desc: "Quick guide: creating articles, markup, images, table of contents and templates.",
  status: "Approved",
  stage: "Concept",
  disc: "VDC",
  tags: ["guide", "markup"],
  author: ME,
  upd: TODAY,
  body: `## What it is
The library keeps the studio’s standards, procedures and instructions in one place. Every article has versions, links and comments.

## Creating an article
1. Click **Create** in the top bar.
2. Choose a template, a space and enter a title.
3. Write on the left — the result is shown immediately on the right.

![Article lifecycle](img:demo)

## Markup
### Headings and table of contents
Headings ## and ### automatically build the table of contents on the side.
### Images
Add an image with the “Image” button, drag a file in, or paste from the clipboard with Ctrl+V.

> [!tip] Click an image in an article to open it full screen.

> [!warn] Images are stored in this browser. A server is required for shared work.

## Tables and checklist
| Type | When to use |
|---|---|
| Instruction | Step-by-step actions |
| Procedure | Rules and responsibility |

- [ ] Check naming
- [x] Publish the model to the CDE
`,
});

export const SEED_COLLECTIONS = [
  {
    id: "col-onboarding",
    name: "New Hire BIM Onboarding Kit",
    desc: "Essential standards, naming rules and tools every new engineer completes during Week 1.",
    tier: "official",
    mode: "list",
    owner: "Maxim",
    vis: "Internal",
    coEditors: ["Iryna P.", "Olena K."],
    at: Date.now() - 86400000 * 3,
    items: [
      { id: 100, note: "Start here to learn the workspace." },
      { id: 1, note: "Core BEP framework for all projects." },
      { id: 2, note: "Mandatory CDE naming conventions." },
      { id: 9, note: "Install pyRevit before joining a project model." },
      { id: 16, note: "Clone the project starter template." },
    ],
    nodes: [],
    edges: [],
    vp: null,
  },
  {
    id: "col-client-public",
    name: "Client BIM Handover Package",
    desc: "Curated public standards and regulatory references cleared for external clients and partners.",
    tier: "official",
    mode: "list",
    owner: "Maxim",
    vis: "Public",
    coEditors: ["Olena K."],
    at: Date.now() - 86400000 * 2,
    items: [
      { id: 2, note: "Shared file & model naming specification." },
      { id: 11, note: "Ukrainian building regulatory codes reference." },
      { id: 100, note: "Library reader walkthrough." },
    ],
    nodes: [],
    edges: [],
    vp: null,
  },
  {
    id: "col-my-kit",
    name: "My VDC Weekly Coordination Kit",
    desc: "Personal quick-access kit for Friday clash detection reviews.",
    tier: "personal",
    mode: "list",
    owner: "Maxim",
    vis: "Restricted",
    coEditors: [],
    at: Date.now() - 86400000,
    items: [
      { id: 3, note: "Weekly clash procedure." },
      { id: 13, note: "Monthly model quality report." },
      { id: 10, note: "Open Redmine issues before meeting." },
    ],
    nodes: [],
    edges: [],
    vp: null,
  },
];

export const SEED_ACTIVITIES = [
  { id: "act-1", actor: "Maxim", action: "Published", targetType: "document", targetId: "100", targetTitle: "How to use the Knowledge Library", note: "Marked Public with attachment demo cleared", at: "2026-10-22" },
  { id: "act-2", actor: "Iryna P.", action: "Published", targetType: "document", targetId: "2", targetTitle: "File and model naming", note: "Updated naming appendix", at: "2026-09-30" },
  { id: "act-3", actor: "Andrii B.", action: "Commented", targetType: "document", targetId: "3", targetTitle: "Model coordination and clash detection", note: "Requested clash priority criteria", at: "2026-10-20" },
  { id: "act-4", actor: "Olena K.", action: "Verified", targetType: "document", targetId: "15", targetTitle: "Load-bearing wall — standard", note: "Verified up to date", at: "2026-09-25" },
];

export const DEFAULT_URLS = {
  Redmine: "https://www.redmine.org",
  Jira: "https://www.atlassian.com/software/jira",
  Contacts: "https://contacts.google.com",
};
