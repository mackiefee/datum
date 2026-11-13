import { ME, TODAY } from '../config/constants.js';

const avSvg = (bg, fg, init) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="${fg}"/></linearGradient></defs><rect width="80" height="80" rx="40" fill="url(#g)"/><circle cx="40" cy="31" r="13" fill="#fff" fill-opacity=".28"/><path d="M18 70c3-14 14-20 22-20s19 6 22 20" fill="#fff" fill-opacity=".28"/><text x="40" y="47" text-anchor="middle" fill="#fff" font-family="-apple-system,Inter,sans-serif" font-weight="700" font-size="24">${init}</text></svg>`
  );

export const USERS = [
  { id: "u1", name: "Maxim", email: "maxim@planit.studio", title: "Head of VDC & BIM Lead", role: "SuperAdmin", dept: "VDC", teams: ["VDC", "Interior PE", "P&C"], status: "active", provider: "google", emailVerified: true, googleSub: "g-1048291001", avatar: avSvg("#0a84ff", "#5e5ce6", "M") },
  { id: "u2", name: "Elena Khlivetskaya", email: "elena@planit.studio", title: "Interior PE Standard Owner", role: "Admin", dept: "Interior", teams: ["Interior PE", "P&C"], status: "active", provider: "google", emailVerified: true, googleSub: "g-1048291002", avatar: avSvg("#ff9f0a", "#ff375f", "EK") },
  { id: "u3", name: "Iryna P.", email: "iryna@planit.studio", title: "Senior Interior PE Coordinator", role: "Editor", dept: "Interior", teams: ["Interior PE", "P&C"], status: "active", provider: "google", emailVerified: true, googleSub: "g-1048291003", avatar: avSvg("#8e5cf7", "#30b0c7", "IP") },
  { id: "u4", name: "Andrii Lytvynov", email: "andrii@planit.studio", title: "BIM Automation & Planit Tools Lead", role: "Editor", dept: "VDC", teams: ["VDC", "Interior PE", "MEP", "Structural"], status: "active", provider: "google", emailVerified: true, googleSub: "g-1048291004", avatar: avSvg("#34c759", "#0a84ff", "AL") },
  { id: "u5", name: "Sofiia L.", email: "sofiia@planit.studio", title: "Interior PE Specialist", role: "Member", dept: "Interior", teams: ["Interior PE"], status: "active", provider: "google", emailVerified: true, googleSub: "g-1048291005", avatar: avSvg("#ff375f", "#bf5af2", "SL") },
  { id: "u6", name: "External Partner", email: "partner@client.example", title: "Design Team / GC Reviewer", role: "Guest", dept: "External", teams: [], status: "active", provider: "guest", emailVerified: false, googleSub: "", avatar: avSvg("#8e8e93", "#48484a", "EP") },
];

export const SEED_TEAMS = [
  { id: "t-int", name: "Interior PE", desc: "C10_INTERIOR modeling, ADA & code compliance, CL-RFI layouts and QA.", color: "#ff9f0a", lead: "Elena Khlivetskaya", members: ["Elena Khlivetskaya", "Iryna P.", "Maxim", "Andrii Lytvynov", "Sofiia L."] },
  { id: "t-vdc", name: "VDC", desc: "Revit Warehouse families, Planit Tools / pyPlanIt, Dusty Robotics & naming rules.", color: "#8e5cf7", lead: "Maxim", members: ["Maxim", "Andrii Lytvynov", "Elena Khlivetskaya"] },
  { id: "t-pc", name: "P&C", desc: "Plan & Control standards, revision workflows, Input/Output checklists & client handoff.", color: "#0071e3", lead: "Elena Khlivetskaya", members: ["Elena Khlivetskaya", "Iryna P.", "Maxim"] },
  { id: "t-mep", name: "MEP", desc: "Plumbing wet-wall coordination, risers, shafts and ceiling access panels.", color: "#30b0c7", lead: "Andrii Lytvynov", members: ["Andrii Lytvynov", "Maxim", "Elena Khlivetskaya"] },
  { id: "t-str", name: "Structural", desc: "Concrete slab/column tolerances, CMU lintels, shear walls and weld embeds.", color: "#ff375f", lead: "Andrii Lytvynov", members: ["Andrii Lytvynov", "Maxim"] },
];

export const TEAMS = [
  ["Interior PE", [["Elena Khlivetskaya", "Admin"], ["Iryna P.", "Editor"], ["Maxim", "SuperAdmin"], ["Andrii Lytvynov", "Editor"], ["Sofiia L.", "Member"]]],
  ["VDC", [["Maxim", "SuperAdmin"], ["Andrii Lytvynov", "Editor"], ["Elena Khlivetskaya", "Admin"]]],
  ["P&C", [["Elena Khlivetskaya", "Admin"], ["Iryna P.", "Editor"], ["Maxim", "SuperAdmin"]]],
  ["MEP", [["Andrii Lytvynov", "Editor"], ["Maxim", "SuperAdmin"], ["Elena Khlivetskaya", "Admin"]]],
  ["Structural", [["Andrii Lytvynov", "Editor"], ["Maxim", "SuperAdmin"]]],
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
        { n: 1, by: o.author, d: "2026-08-12", note: "Created from C10_INTERIOR", body: o.prev },
        { n: 2, by: o.author, d: o.upd, note: "Updated", body: o.body },
      ]
    : [{ n: 1, by: o.author, d: o.upd, note: "Imported from C10_INTERIOR.pptx", body: o.body }],
});

export const IMG0 = {
  c10_image59: "/c10-media/image59.png",
  c10_image65: "/c10-media/image65.png",
  c10_image67: "/c10-media/image67.png",
  c10_image68: "/c10-media/image68.jpg",
  c10_image70: "/c10-media/image70.png",
  c10_image73: "/c10-media/image73.png",
  c10_image75: "/c10-media/image75.jpg",
  c10_image77: "/c10-media/image77.jpg",
  c10_image78: "/c10-media/image78.png",
  c10_image82: "/c10-media/image82.png",
  c10_image86: "/c10-media/image86.png",
  c10_image95: "/c10-media/image95.png",
  c10_image139: "/c10-media/image139.png",
  c10_image140: "/c10-media/image140.png",
  c10_image142: "/c10-media/image142.png",
  c10_image160: "/c10-media/image160.png",
  c10_image167: "/c10-media/image167.png",
  c10_image176: "/c10-media/image176.png",
  c10_image183: "/c10-media/image183.png",
  c10_image200: "/c10-media/image200.png",
  c10_image208: "/c10-media/image208.png",
  c10_image209: "/c10-media/image209.png",
  c10_image211: "/c10-media/image211.png",
  c10_image215: "/c10-media/image215.png",
  c10_image243: "/c10-media/image243.png",
  c10_image245: "/c10-media/image245.png",
  c10_image260: "/c10-media/image260.png",
  c10_image279: "/c10-media/image279.png",
  c10_image280: "/c10-media/image280.png",
  c10_image295: "/c10-media/image295.png",
  c10_image298: "/c10-media/image298.png",
  c10_image302: "/c10-media/image302.png",
  c10_image305: "/c10-media/image305.png",
  c10_image306: "/c10-media/image306.png",
  c10_image315: "/c10-media/image315.png",
  c10_image327: "/c10-media/image327.png",
  c10_image330: "/c10-media/image330.png",
  c10_image333: "/c10-media/image333.png",
  c10_image343: "/c10-media/image343.png",
  c10_image347: "/c10-media/image347.png",
  c10_image359: "/c10-media/image359.png",
  c10_image367: "/c10-media/image367.png",
  c10_image380: "/c10-media/image380.png",
  c10_image385: "/c10-media/image385.png",
  c10_image409: "/c10-media/image409.png",
  c10_image410: "/c10-media/image410.png",
  c10_image425: "/c10-media/image425.png",
  c10_image442: "/c10-media/image442.png",
  c10_image455: "/c10-media/image455.png",
  c10_image470: "/c10-media/image470.png",
  c10_image474: "/c10-media/image474.png",
  c10_image478: "/c10-media/image478.png",
  c10_image480: "/c10-media/image480.png",
  c10_image499: "/c10-media/image499.png",
  c10_image500: "/c10-media/image500.png",
  c10_image501: "/c10-media/image501.png",
  c10_image511: "/c10-media/image511.png",
  c10_image542: "/c10-media/image542.png",
  c10_image543: "/c10-media/image543.png",
  c10_image549: "/c10-media/image549.png",
  c10_image551: "/c10-media/image551.png",
  c10_image563: "/c10-media/image563.jpg",
  c10_image580: "/c10-media/image580.png",
  c10_image584: "/c10-media/image584.jpg",
  c10_image595: "/c10-media/image595.png",
  c10_image597: "/c10-media/image597.jpg",
  c10_image602: "/c10-media/image602.png",
  c10_image606: "/c10-media/image606.jpg",
  c10_image610: "/c10-media/image610.jpg",
  c10_image625: "/c10-media/image625.jpg",
  c10_image633: "/c10-media/image633.jpg",
  c10_image635: "/c10-media/image635.png",
  c10_image639: "/c10-media/image639.png",
  c10_image650: "/c10-media/image650.png",
  c10_image661: "/c10-media/image661.png",
  c10_image669: "/c10-media/image669.png",
  c10_image675: "/c10-media/image675.png",
  c10_image683: "/c10-media/image683.png",
  c10_image689: "/c10-media/image689.png",
  c10_image723: "/c10-media/image723.png",
  c10_image728: "/c10-media/image728.png",
  c10_image733: "/c10-media/image733.png",
  c10_image741: "/c10-media/image741.png",
  c10_image750: "/c10-media/image750.png",
  c10_image767: "/c10-media/image767.png",
  c10_image785: "/c10-media/image785.png",
  c10_image790: "/c10-media/image790.png",
  c10_image812: "/c10-media/image812.jpg",
  c10_image821: "/c10-media/image821.jpg",
  c10_image833: "/c10-media/image833.jpg",
  c10_image846: "/c10-media/image846.png",
  c10_image852: "/c10-media/image852.jpg",
  c10_image884: "/c10-media/image884.jpg",
  c10_image886: "/c10-media/image886.png",
  c10_image887: "/c10-media/image887.jpg",
  c10_image893: "/c10-media/image893.jpg",
  c10_image897: "/c10-media/image897.jpg",
  c10_image898: "/c10-media/image898.png",
  c1010_image3: "/c10-media/c1010_image3.jpg",
  c1010_image4: "/c10-media/c1010_image4.png",
  c1010_image6: "/c10-media/c1010_image6.png",
  c1010_image7: "/c10-media/c1010_image7.png",
  c1010_image11: "/c10-media/c1010_image11.png",
  c1010_image12: "/c10-media/c1010_image12.png",
  c1010_image15: "/c10-media/c1010_image15.png",
  c1010_image16: "/c10-media/c1010_image16.png",
  c1010_image21: "/c10-media/c1010_image21.png",
  c1010_image24: "/c10-media/c1010_image24.png",
  c1010_image25: "/c10-media/c1010_image25.png",
  c1010_image27: "/c10-media/c1010_image27.png",
  c1010_image28: "/c10-media/c1010_image28.jpg",
  c1010_image34: "/c10-media/c1010_image34.png",
  c1010_image42: "/c10-media/c1010_image42.png",
  c1010_image47: "/c10-media/c1010_image47.png",
  c1010_image62: "/c10-media/c1010_image62.png",
  c1010_image63: "/c10-media/c1010_image63.png",
  c1010_image64: "/c10-media/c1010_image64.png",
  c1010_image66: "/c10-media/c1010_image66.png",
  c1010_image67: "/c10-media/c1010_image67.png",
  c1010_image70: "/c10-media/c1010_image70.png",
  c1010_image73: "/c10-media/c1010_image73.png",
  c1010_image75: "/c10-media/c1010_image75.png",
  c1010_image78: "/c10-media/c1010_image78.png",
  c1010_image82: "/c10-media/c1010_image82.png",
  c1010_image83: "/c10-media/c1010_image83.png",
  c1010_image89: "/c10-media/c1010_image89.png",
  c1010_image90: "/c10-media/c1010_image90.png",
};

export const GUIDE = mk({
  id: 100,
  node: "c10-ovw-std",
  type: "doc",
  vis: "Public",
  publicAttachments: ["c10_image140"],
  title: "C10_INTERIOR — Master Standard & Navigation Guide",
  desc: "Complete Planit Interior PE Knowledge Base structured from the 465-slide C10_INTERIOR manual into 5 engineering divisions.",
  status: "Approved",
  stage: "Construction",
  disc: "Interior",
  tags: ["C10_INTERIOR", "standard", "onboarding", "overview"],
  author: ME,
  upd: TODAY,
  links: [[101, "hard"], [102, "hard"], [104, "soft"], [128, "soft"]],
  body: `## Purpose & Scope of C10_INTERIOR
The **C10_INTERIOR** engineering manual governs all interior BIM detailing, code compliance verification, cross-discipline coordination, and **CL-RFI** deliverable preparation across Planit projects. The full 465-slide knowledge base has been organized in Datum into five engineering divisions.

![C10_INTERIOR Uniformat & Workflow Overview](img:c10_image140)

## Knowledge Base Structure
| Division | Focus Areas | Slide Coverage |
|---|---|---|
| Overview & Standards | Revisions, abbreviations, project start, Warehouse R21 | Slides 1–35 |
| Documentation & Codes | Reading A-sets, naming, fire resistance, ADA clearances | Slides 36–128 |
| Modeling & Families | GWB/wood/metal walls, wire mesh, doors, kitchens, baths, blocking | Slides 129–305 |
| Coordination & QA | Concrete tolerances, MEP/STR sync, Dusty Robotics, QA audit | Slides 306–325 & 390–465 |
| Drawings & Schedules | CL-RFI 1/1.1/1.4/1.5/4/4.1, B/B/R tags, schedules, markups | Slides 326–389 |

> [!tip] Sections marked OUTDATED in legacy slides now link directly to live Actual Google Docs inside the Documentation & Standards hub.

## Quick Onboarding Checklist
- [x] Verify Revit version (2019–2026) and install **Planit Tools** (\`\\\\srv\\install\\RUN\`)
- [ ] Review Project Input/Output Checklist before opening any model
- [ ] Confirm applicable building codes (IBC / CBC Ch. 7 & Ch. 11A/11B)
- [ ] Run common-mistakes pre-check prior to submitting CL-RFI sheets to QA
`,
});

export const SEED = [
  mk({
    id: 101,
    node: "c10-ovw-std",
    type: "doc",
    vis: "Internal",
    title: "Revision History, Standard Owners & Contacts",
    desc: "Document governance, process owners, contributor roster and chronological revision log of C10_INTERIOR.",
    status: "Approved",
    stage: "Construction",
    disc: "Interior",
    tags: ["governance", "contacts", "revisions"],
    author: "Elena Khlivetskaya",
    upd: "2026-10-18",
    links: [[100, "hard"], [102, "hard"]],
    body: `## Document Governance
**C10_INTERIOR Owner:** Elena Khlivetskaya  
**C1010 Interior Partition Contact Point:** Oleksii Hirdvoin (\`gia@uateam.com.ua\`) — Version #2 (UPD 05/21/2026: *CMU Wall Modeling Adjacent to Structural Elements*)  
**Maintained by:** P&C PE Team & Interior PE Team

> [!note] Legacy wall slides in C10_INTERIOR.pptx are superseded by the **C1010 Interior Partition** specification (articles #111, #133–#136) and the live Google Docs hub (#102).

## Contributors Roster
| Area | Contributors |
|---|---|
| General Standards, Codes & Appliances | Elena Khlivetskaya, Oksana Denysiuk, Svetlana Schmidt |
| C1010 Interior Partitions Standard | Oleksii Hirdvoin (Aleksey Girdvoin), P&C Team |
| Modeling (Walls, Ceilings, 3D Room Tags) | Dmytro Kryshchuk, Nikita Mishchenko |
| Doors, Kitchens & Bathrooms | Maksim Borisov, Daria Levchenko, Artem Honchar |
| Coordination & Concrete Tolerances | Anton Kolmykov, Anastasia Batechko |
| CL-RFI Drawings & Planit Tools | Aleksey Girdvoin, Aleksandr Kuchma, Andrii Lytvynov (ALI) |

![Standard Governance and Update Tracking](img:c10_image77)

![Process Update Summary Table](img:c10_image75)

![Revision History Log Part 1](img:c10_image68)

![Revision History Log Part 2](img:c10_image65)
`,
  }),

  mk({
    id: 102,
    node: "c10-ovw-std",
    type: "link",
    vis: "Public",
    title: "Actual Interior Standards & P&C Google Docs Hub",
    desc: "Direct portal to live Google Docs: Interior Partitions, Wire Mesh, Interior Doors, Parking Control, NF Standard & Concrete Tolerances.",
    url: "https://docs.google.com/document/d/1vSa4jYwxz6ltsmDjm2AOhATwWZXIZaDNq6m_x9ZzdlM/edit",
    status: "Approved",
    stage: "Construction",
    disc: "Interior",
    tags: ["google-docs", "actual-standard", "links", "NF-standard"],
    author: "Elena Khlivetskaya",
    upd: "2026-10-21",
    links: [[100, "hard"], [111, "hard"], [115, "hard"], [129, "hard"], [133, "hard"]],
    body: `## Active Google Docs Standards (Supersedes Legacy Slides)
Whenever a slide displays the **OUTDATED / SUPERSEDED** badge, engineers must use these authoritative living documents:

| Standard Document | Status | Direct URL |
|---|---|---|
| **C1010 Actual Interior Walls Standard** | Active (v2) | https://docs.google.com/document/d/1vSa4jYwxz6ltsmDjm2AOhATwWZXIZaDNq6m_x9ZzdlM/edit |
| **Chain-Link & Wire Mesh Partitions Standard** | Active | https://docs.google.com/document/d/18vfb2HUIVXFYD00ell66yt-k6L04nnzxde0gn4yQWg0/edit |
| **Interior Doors Standard** | Active | https://docs.google.com/document/d/1GY7rxmEqB6CbE9ruBXyMqFdJXMPsiQlD3oXHKheDTGI/edit |
| **Parking Control Modeling & Detailing** | Active | https://docs.google.com/document/d/15ker8RuPV26e23PgLOLOFRI8mM5Y1-39Ypq7cwgqw4g/edit |
| **P&C Planit Revision Standard** | Active | https://docs.google.com/document/d/1bHDuWqf-1rCZZhi4HcVbzyGfWUTd4tf8PHHWfYujRm0/edit |
| **P&C Planit NF Standard** | Active | https://docs.google.com/document/d/1ExDYdsSxGcnO6bBdPGf7cbJvtFBjnAy0Tb3gy_swcgU/edit |
| **CMU Wall Connections & Openings (Sec. 2.4.2)** | Active | https://docs.google.com/document/d/15AnMQalHUGOrwRCd0dHm0QyANd1miXBBoy7Sb3fuCww/edit |
| **Concrete Walls Tolerance Standard (ACI 117-10)** | Active | https://docs.google.com/document/d/1xL9OJNSPJUGOYc7E2R0ZoYwu7BARFdgJyngoDwpPZWg/edit |
| **NF Examples — Interior Spreadsheet** | Reference | https://docs.google.com/spreadsheets/d/1znnZsl-Nsueu1GUJImRvziOGAPkXm5TrAgAF3yO77_k/edit |

> [!warn] Never issue CL-RFI revision clouds or markup PDFs using superseded title-block notes; follow the **P&C Planit Revision Standard** and **P&C Planit NF Standard** directly.
`,
  }),

  mk({
    id: 103,
    node: "c10-ovw-std",
    type: "doc",
    vis: "Public",
    title: "Abbreviations, Scope Boundaries & Uniformat C10",
    desc: "Studio abbreviations (PE, PL, ET, NF, iRFI, oRFI), Uniformat C1010–C1030 classification and in-scope/out-of-scope rules.",
    status: "Approved",
    stage: "Concept",
    disc: "Interior",
    tags: ["abbreviations", "uniformat", "C10", "scope"],
    author: "Iryna P.",
    upd: "2026-10-10",
    links: [[100, "soft"], [104, "hard"]],
    body: `## Key Studio & Deliverable Abbreviations
| Code | Meaning |
|---|---|
| **PE / PL / PM** | Project Engineer / Project Lead / Project Manager |
| **DD / CD** | Design Documents / Construction Documents |
| **CL / CL-RFI** | Coordinated Layout / Coordinated Layout Request for Information |
| **NF / iRFI / oRFI** | Notification (Internal Request) / Internal RFI / Official RFI |
| **ET** | Estimated Time allocated per Redmine task |
| **TOS / AFF** | Top of Slab / Above Finish Floor |
| **B/B/R** | Black (per DD), Blue (confirmed/updated), Red (missing info / RFI) |

## Uniformat C10 Scope Matrix
![Uniformat C10 Breakdown](img:c10_image59)

![Scope Inclusion vs Exclusion Chart](img:c10_image70)

> [!important] Wall finishes thinner than 1/8" (skim coat plaster, paint) and wall bases are excluded from modeling scope unless explicitly added to the Project Input/Output Checklist.
`,
  }),

  mk({
    id: 104,
    node: "c10-ovw-start",
    type: "doc",
    vis: "Internal",
    title: "Project Start — Input Analysis, Checklists & Warehouse",
    desc: "Step-by-step intake workflow for new Interior projects: Redmine review, DD folders, Input/Output Checklist & Warehouse R21.",
    status: "Approved",
    stage: "Concept",
    disc: "Interior",
    tags: ["project-start", "redmine", "warehouse", "intake"],
    author: "Iryna P.",
    upd: "2026-10-16",
    links: [[105, "hard"], [106, "hard"], [114, "soft"]],
    body: `## Mandatory First Steps When Assigned a Project
1. Read the **Redmine task description** carefully and verify the assigned **ET** (Estimated Time).
2. Inspect the **Project Input/Output Checklist** before raising any missing-information RFI(NF).
3. Collect all baseline documents: Architectural Set, Structural Drawings (Steel/Concrete/Wood Framing), Project Manual (Divisions 05, 06, 08, 09, 10, 11, 12), Submittals, and LOD Report.
4. Link **Warehouse Model R21+** families from \`\\\\SRV\\_P&C_ProcessDoc\\01 FAMILIES WAREHOUSE\\03. C Interiors\`.

![Project Start Input Verification Flow](img:c10_image73)

![Revit Setup and Warehouse Paths](img:c10_image67)

## Pre-Modeling Verification Checklist
- [ ] Verify whether floor finishes are included in budget (doors must rest on finished floor!)
- [ ] Confirm dimensioning logic in DD (Face of Stud vs Face of Finish)
- [ ] Check Communal Areas & Typical Units boundaries
- [ ] Verify official RFIs already answered prior to CL start
`,
  }),

  mk({
    id: 105,
    node: "c10-ovw-start",
    type: "template",
    vis: "Internal",
    title: "Project Input/Output, Naming & Communal Checklists",
    desc: "Master Google Sheets templates for Input/Output tracking, Element/Material Naming, Model Naming & Communal Areas.",
    url: "https://docs.google.com/spreadsheets/d/12SthUlO2i9DI_x0Ypn1SMEOPryrVr_GkDb0jfWGMqSM/edit",
    status: "Approved",
    stage: "Concept",
    disc: "VDC",
    tags: ["template", "checklist", "google-sheets", "naming"],
    author: "Andrii Lytvynov",
    upd: "2026-10-19",
    links: [[104, "hard"], [107, "hard"]],
    body: `## Official Google Sheets Templates
| Sheet | Purpose | Link |
|---|---|---|
| **Project Input/Output Checklist** | Required DD/submittal inputs & deliverable outputs per category | https://docs.google.com/spreadsheets/d/12SthUlO2i9DI_x0Ypn1SMEOPryrVr_GkDb0jfWGMqSM/edit |
| **T/U_Interior Naming (Elements & Materials)** | Partition, door, finish and material naming formulas | https://docs.google.com/spreadsheets/d/1tFoVT60ILi13fFpUo3GIbYBPys9JZi3MxT_UEMotU-s/edit |
| **Project Browser & Model Naming** | Standard view browser grouping & RVT file names | https://docs.google.com/spreadsheets/d/1HEBzL-OPx7mZmfqcyhWQZenbsMPf2oFx2pP4ubGCe78/edit |
| **Communal Areas Checklist** | Corridor, lobby, amenity & restroom scope matrix | https://docs.google.com/spreadsheets/d/1JAzba9f_FbAfJdJexWpqZDRUqx25vEigrfuk0aBF90Y/edit |

> [!tip] Always check the Input Checklist row for a category (e.g., Wire Mesh or Appliances) before flagging \`NF\`: if filled in the checklist without drawings, treat as pending submittal rather than missing-drawing RFI.
`,
  }),

  mk({
    id: 106,
    node: "c10-doc-read",
    type: "doc",
    vis: "Internal",
    title: "How to Read Design Documents — Plans, Enlarged & Specs",
    desc: "Guide to reading Architectural sets, Partition Type sheets, Enlarged Unit Plans, Elevations, Schedules & Project Manual.",
    status: "Approved",
    stage: "Design",
    disc: "Architecture",
    tags: ["design-documents", "A-series", "specifications", "reading"],
    author: "Andrii Lytvynov",
    upd: "2026-10-14",
    links: [[104, "soft"], [108, "hard"], [109, "hard"]],
    body: `## Reading Sequence for Architectural Packages
1. **G-Series / Life Safety Plans**: Exit routes, fire-rated corridors, occupancy loads, ADA diagrams.
2. **A0 / Partition Type Sheets**: Wall assembly composition, STC rating, HR fire rating, framing gage/width.
3. **Overall Floor Plans & Reflected Ceiling Plans**: Grid references, matchlines, ceiling heights (AFF vs TOS).
4. **Enlarged Unit Plans, Restrooms & Interior Elevations**: Grab bars, millwork, backing heights, outlets.
5. **Schedules & Project Manual**: Door/Hardware Schedule (08 10 00), Room Finish Schedule (09), Cold-Formed Metal Framing (05 40 00).

![Reading Overall and Enlarged Floor Plans](img:c10_image78)

![Partition Type Legend Interpretation](img:c10_image82)

![Interior Elevations and Detail Cross-Referencing](img:c10_image86)

![Room Finish and Door Schedule Cross-Check](img:c10_image95)

> [!warn] Contract plumbing drawings are diagrammatic only — never rely solely on plumbing symbols for wet-wall thickness without verifying pipe diameters and fixture rough-ins.
`,
  }),

  mk({
    id: 107,
    node: "c10-doc-read",
    type: "doc",
    vis: "Internal",
    title: "Naming Conventions, Worksets & Shared Parameters",
    desc: "Revit naming formulas for walls, doors, ceilings, materials, worksets (3D Room Tags, Plumbing Fixtures) & shared parameters.",
    status: "Approved",
    stage: "Design",
    disc: "VDC",
    tags: ["naming", "worksets", "shared-parameters", "Revit"],
    author: "Andrii Lytvynov",
    upd: "2026-10-15",
    links: [[105, "hard"], [130, "hard"]],
    body: `## Element & Material Naming Rules
Every Revit family type, wall assembly, door type, and material in the **C10_INTERIOR** model must conform strictly to \`T/U_Interior_Naming of the Elements/Materials\`.

![Revit Wall and Material Naming Structure](img:c10_image142)

![Workset and Shared Parameter Assignment](img:c10_image139)

## Standard Interior Worksets
| Workset Name | Assigned Elements | Visibility in CL-RFI |
|---|---|---|
| **Interior Partitions** | GWB, Metal Stud, Wood Stud, CMU, Shaft walls | Visible |
| **Interior Doors** | Frames, Panels, Clear Zones, ADA Zones | Visible |
| **Plumbing Fixtures** | Lavs, WCs, Tubs, Showers, Residential W/D | Visible on Floor Plan |
| **3D Room Tags** | Dynamo-generated 3D Room Tag families | Turned OFF on sheets |
| **Hidden / Tolerance** | Concrete pouring tolerance envelopes | Visible for QA only |
`,
  }),

  mk({
    id: 108,
    node: "c10-doc-codes",
    type: "doc",
    vis: "Public",
    title: "Building Codes — Fire Resistance, Rated Walls & Shafts",
    desc: "IBC/CBC Chapter 7 rules for 1-HR/2-HR fire barriers, shaft enclosures (Sec. 713.4), corridors, Type X GWB & head-of-wall joints.",
    status: "Approved",
    stage: "Design",
    disc: "Architecture",
    tags: ["fire-rating", "CBC", "IBC", "shafts", "Chapter-7"],
    author: "Elena Khlivetskaya",
    upd: "2026-10-20",
    links: [[109, "hard"], [110, "hard"], [111, "hard"], [135, "hard"]],
    body: `## Fire-Resistance Classification (IBC / CBC Chapter 7)
| Classification | Code Section | Primary Use & Continuity Rule |
|---|---|---|
| **Fire Walls** | Sec. 706 | Building separations / fire areas; structurally stable; vertically aligned across levels; openings protected |
| **Fire Barriers** | Sec. 707 | Shaft enclosures (Sec. 713), exit stairways/ramps, exit passageways, atriums; continuous floor-to-floor through concealed spaces |
| **Fire Partitions** | Sec. 708 | Dwelling unit separations & corridors; openings protected; may terminate at rated floor/ceiling assemblies |
| **Smoke Barriers** | Sec. 709 | Fire-resistant shell; continuous from floor through concealed space |
| **Smoke Partitions** | Sec. 710 | Non-fire-resistant smoke control; may terminate at floor/ceiling/roof assembly |

## Shaft & Corridor Rules
- **Shaft Enclosures (Sec. 713.4)**: Modeled as Fire Barriers (Sec. 707) — minimum **2-hour** rating when connecting 4 or more stories; minimum **1-hour** when connecting fewer than 4 stories.
- **Wood 2-HR Shaft Walls**: Type X 5/8" GWB provides 1-HR per layer (1/2" provides 3/4-HR) -> 2-HR wood shaft walls require **two Type X GWB layers on each side**.
- **Rated Corridors & Exit Access**: Wall fire rating must match adjacent door fire rating (\`20 min\`, \`45 min\`, \`60 min\`, \`90 min\`). Issue NF for any discrepancy between wall and door fire ratings.
- **Penetrations & Risers**: Piping shown outside a shaft assembly cannot penetrate rated floors/walls unprotected without an additional 2-HR chase enclosure.

![Chapter 7 Wall Fire Rating Classification Chart](img:c1010_image24)

![Fire-Rated Wall and Shaft Assembly Diagram](img:c10_image176)

![Penetration and Corridor Fire Barrier Check](img:c10_image160)

> [!important] Always verify shaft vertical stacking across all levels via CL overlays or longitudinal sections before locking partition layout.
`,
  }),

  mk({
    id: 109,
    node: "c10-doc-codes",
    type: "doc",
    vis: "Public",
    title: "Accessibility & Egress — ADA Doors, Clearances & Holds",
    desc: "ADAAG 403.5 corridor pinch & 180-turn widths, 60-in / T-turn spaces, Ch. 10 Occupant Load formula & door maneuvering zones.",
    status: "Approved",
    stage: "Design",
    disc: "Architecture",
    tags: ["ADA", "ADAAG-403", "CBC-11B", "egress", "clearances"],
    author: "Elena Khlivetskaya",
    upd: "2026-10-20",
    links: [[108, "soft"], [110, "hard"], [117, "hard"]],
    body: `## Accessible Route Widths (ADAAG 403.5 / ADASAD 2010 / ICC A117.1)
- **Standard Minimums**: Dwelling unit interior corridors > **36"**; public corridors > **44"**; corridors exceeding 200 ft often require **60"** (56") passing space depending on State code.
- **Localized Reduction (403.5.1)**: Clear width may narrow to **32" min** for max **24" length**, provided segments are separated by sections at least **48" long × 36" wide**.
- **180° Turn Around Element <48" Wide (403.5.2)**: Clear width must be **42" min** approaching turn, **48" min** at turn, and **42" min** leaving turn.
- **Turning Spaces**: Minimum **60" diameter circle** OR **T-shaped space** within 60" square (36" arms/base, 12" arm clearance, 24" base clearance) required in accessible restrooms, corridors (every 200 ft), and dwelling units.

## Egress Width Formula (BC Chapter 10)
\`\`\`
Corridor Width (inches) = Occupant Load × 0.2"  (must be ≥ minimum required corridor width)
\`\`\`
Concrete pouring tolerances must NEVER shrink an accessible route or Chapter 10 egress corridor width below code minimum (+NF required).

![ADAAG 403.5.1 and 403.5.2 Corridor Turning Diagram](img:c1010_image27)

![ADA Pull and Push Maneuvering Clearances](img:c10_image167)

![CBC Figure 11B-404.2 Pocket and Sliding Door Clearances](img:c10_image200)

![Appliance and Restroom Turning Circle Verification](img:c10_image183)

## Key Modeling Rules
- **Door Frame Alignment**: Place Door Clear Zone and ADA Clear Zone flush with the **door frame** (not raw wall), except with non-standard offset hinges.
- **8-Inch Wall Offset Allowance**: ADA door clear zones may sit up to **8"** from the frame to clear thin wall finishes, trim ledges, or grab bars — confirm no downstream wall/fixture clash occurs.
- **HOLD Dimensions**: Egress corridor widths and ADA clearances marked as **HOLD** must never be compromised by slab/column tolerances.
`,
  }),

  mk({
    id: 110,
    node: "c10-doc-codes",
    type: "link",
    vis: "Public",
    title: "Building Codes Portal — ICC, UpCodes & ADA 2010",
    desc: "External legal code references used during Design Document verification and RFI preparation.",
    url: "https://codes.iccsafe.org/",
    status: "Approved",
    stage: "Concept",
    disc: "Architecture",
    tags: ["codes", "iccsafe", "upcodes", "ada"],
    author: "Elena Khlivetskaya",
    upd: "2026-10-08",
    links: [[108, "hard"], [109, "hard"]],
    body: `## Authorized Code Portals
Always verify the **project jurisdiction & adoption year** in the Title Sheet Code Summary before citing sections in an RFI:

- **ICC Digital Codes (IBC / CBC)**: https://codes.iccsafe.org/
- **UpCodes General & State Library**: https://up.codes/codes/general
- **2010 ADA Standards for Accessible Design**: https://www.ada.gov/law-and-regs/design-standards/2010-stds/
- **ClarkDietrich Structural Stud Height Calculator**: https://www.itools.clarkdietrich.com/structural_stud.php
`,
  }),

  mk({
    id: 111,
    node: "c10-mod-wall",
    type: "doc",
    vis: "Internal",
    title: "GWB & Metal Stud Walls — C1010 Framing, Boards & Height Limits",
    desc: "GWB board varieties (Type X/C, Shaftliner, Moisture/Impact), 16/24 OC dead-space screw access, 1HR priority & Spec 05 40 00 height checks.",
    status: "Approved",
    stage: "Design",
    disc: "Interior",
    tags: ["walls", "metal-stud", "GWB", "shaft", "furring", "C1010"],
    author: "Iryna P.",
    upd: "2026-10-19",
    links: [[102, "hard"], [108, "hard"], [133, "hard"], [134, "hard"], [135, "hard"]],
    body: `## GWB Board Varieties (C1010.10.06)
| Board Type | Standard Thickness | Field Application |
|---|---|---|
| **Regular / Type X / Type C** | 1/2", 5/8" (1/4", 3/8" rare) | Standard & fire-rated partition assemblies |
| **Moisture-Resistant GWB** | 1/2", 5/8" | Bathrooms, wet zones, laundry closets |
| **Impact-Resistant GWB** | 1/2", 5/8" | High-traffic public corridors & service rooms |
| **Tile Backing Panels** | 1/2", 5/8" | Ceramic tile substrates around tubs/showers |
| **Shaftliner** | 1" | Stairwells, elevator shafts & utility raceways |

## Field Installation Sequence & Dead-Space Checks
- **Rated Priority**: On site, **1-HR rated walls** have studs and GWB installed first; non-rated (NR) partitions follow afterward.
- **Screw Access (16" / 24" OC)**: Every GWB panel (except shaftliner) must leave clear tool access to screw sheets into studs at 16" or 24" OC.
- **Dead Spaces**: Narrow gaps near concrete columns, structural steel assemblies, or staircases that block GWB screwing require an **NF for record**.

![GWB Installation Clear Space Near Structural Columns](img:c1010_image47)

![GWB Dead Space in Staircase Framing Detail](img:c1010_image42)

## Metal Stud & Furring Profiles
Interior metal partitions are categorized into four primary frame geometries:
- **C-Stud (S)**: Standard partition and structural stud framing.
- **CH-Stud (CH)**: Cavity shaftwall framing.
- **U-Furring / Hat Channel (U)**: Furring strip attached over concrete/CMU.
- **Z-Furring (Z)**: Insulation standoff furring at exterior/concrete interfaces.

![Metal Stud Frame Profiles C CH U Z](img:c10_image333)

![Wet Wall Width and Plumbing Box Coordination](img:c10_image330)

## Wall Height Limits & RFIs
When partition height exceeds the manufacturer limit for the scheduled gage/spacing in **Spec 05 40 00**:
1. Highlight the wall on **CL-RFI** and issue a **GENERAL RFI**.
2. Proposed assumptions: reduce stud spacing, increase stud depth/gage, or add lateral bracing above the ceiling.

![Stud Height Limits and Deflection Table](img:c10_image343)

![Shaft Wall Alignment Verification Across Levels](img:c10_image347)
`,
  }),

  mk({
    id: 112,
    node: "c10-mod-wall",
    type: "doc",
    vis: "Internal",
    title: "Wood Stud Walls, Sheathing & Shear Wall Alignment",
    desc: "Actual vs nominal lumber sizing (2x4/2x6), OSB/Plywood sheathing rules across non-rated/1HR/2HR walls & tie-rod shear alignment.",
    status: "Approved",
    stage: "Design",
    disc: "Structure",
    tags: ["wood-stud", "sheathing", "OSB", "plywood", "shear-wall"],
    author: "Iryna P.",
    upd: "2026-10-15",
    links: [[102, "soft"], [111, "soft"]],
    body: `## Actual vs Nominal Wood Stud Dimensions
The CL model always uses **actual lumber dimensions** (e.g., \`1-1/2" x 3-1/2"\` for nominal 2x4, \`1-1/2" x 5-1/2"\` for nominal 2x6) to guarantee field fabrication accuracy. If Design Documents sum nominal sizes, submit an RFI immediately.

![Wood Stud Actual Dimensions and Sheathing Placement](img:c10_image359)

## Plywood (P) & OSB (O) Sheathing Rules
Check Wood Structural Drawings and Sheet Notes carefully:
- **Non-rated walls**: Add sheathing as an additional layer attached to the wood studs.
- **1-HR rated walls**: Sheathing replaces one layer of 5/8" Type X GWB unless rated assembly states otherwise — clarify via RFI.
- **2-HR rated walls**: Add sheathing outside studs or verify GWB backing per structural engineer notes.
- **Shear Walls with Tie Rods**: Vertically align shear walls by **wall centerline** across all levels.
`,
  }),

  mk({
    id: 113,
    node: "c10-mod-wall",
    type: "doc",
    vis: "Internal",
    title: "Ceilings, Floors, Soffits & Wire Mesh Partitions",
    desc: "RCP soffit modeling, finish hosting rules, Chain-Link & Wire Mesh C1010.10.07 Curtain Wall detailing & HILTI/embed anchors.",
    status: "Approved",
    stage: "Design",
    disc: "Interior",
    tags: ["ceilings", "floors", "wire-mesh", "C1010", "curtain-wall"],
    author: "Maxim",
    upd: "2026-10-21",
    links: [[102, "hard"], [123, "hard"], [131, "hard"]],
    body: `## Ceilings, Soffits & Finishes
- Verify ceiling datum convention in DD: **AFF** (Above Finish Floor) vs **TOS** (Top of Slab).
- Model dropped soffits and bulkheads above cabinetry, HVAC trunks, and smoke curtains.
- Finishes thinner than **1/8"** (paint, skim coat) and rubber wall bases are out of modeling scope; model finishes around bathtubs and shower pans per tile submittals.

![Ceiling Types Soffits and Finishes](img:c10_image209)

![Floor Finish Transitions at Doors and Wet Areas](img:c10_image211)

## Chain-Link & Wire Mesh Partitions (Uniformat C1010.10.07)
- **Revit Tool**: Model using **Curtain Wall** families in parking, retail, and storage levels.
- **Base Plates**: Standard posts anchored to concrete via **HILTI** mechanical/chemical anchors do not require modeled base plates; if welded to slab **embeds**, notify Structural to add embeds to the STR model.

![Chain-Link Fence and Wire Mesh Curtain Wall Assembly](img:c10_image367)
`,
  }),

  mk({
    id: 114,
    node: "c10-mod-wall",
    type: "service",
    vis: "Internal",
    title: "3D Room Tag Generation — pyPlanIt & Planit Tools",
    desc: "Automated generation and updating of 3D Room Tags in Revit 2019–2026 without shifting annotated room centers.",
    url: "https://docs.google.com/presentation/d/1x0Aokj-TbT9uIWm7Cb7j48lFIGF26asOMOejSWsBdY0/edit",
    status: "Approved",
    stage: "Construction",
    disc: "VDC",
    tags: ["automation", "Planit-Tools", "pyPlanIt", "3D-Room-Tag"],
    author: "Andrii Lytvynov",
    upd: "2026-10-20",
    links: [[104, "soft"], [107, "hard"]],
    body: `## Revit Version Tool Matrix
| Revit Version | Tool | Family Source Path |
|---|---|---|
| **Revit 2019–2021** | pyPlanIt (Dynamo script) | \`\\\\SRV\\_P&C_ProcessDoc\\02 LIBRARY\\DYNAMO\\3D Room Tags Generation\` |
| **Revit 2022–2026** | Planit Tools (\`\\\\srv\\install\\RUN\`) | \`\\\\SRV\\_P&C_ProcessDoc\\01 FAMILIES WAREHOUSE\\17. Dynamo scripts\\3D Room Tags Generation\` |

![3D Room Tag Generation via Planit Tools](img:c10_image385)

![Bounded vs Unbounded Room Tag Placement](img:c10_image380)

## Execution Rules
- Ensure rooms are fully enclosed by walls or Room Separation Lines before execution.
- Use **"Preserve existing tag position"** when updating room numbers so manually adjusted 2D/3D tags stay aligned.
- Assign all generated tags to the **3D Room Tags** workset and keep it turned **OFF** on final CL-RFI sheets.
`,
  }),

  mk({
    id: 115,
    node: "c10-mod-door",
    type: "doc",
    vis: "Internal",
    title: "Interior Door Modeling — Rules, Rough Openings & Sizes",
    desc: "Core door modeling requirements: Actual vs Nominal sizes, CMU +1/4\" sealant tolerance, Hardware Set & swing angles.",
    status: "Approved",
    stage: "Design",
    disc: "Interior",
    tags: ["doors", "rough-opening", "nominal", "hardware"],
    author: "Maxim",
    upd: "2026-10-18",
    links: [[102, "hard"], [116, "hard"], [117, "hard"]],
    body: `## Core Modeling Rules
- **Floor Hosting**: All interior doors rest on **Finish Floor** — verify floor finishes are complete before door placement.
- **Actual vs Nominal**: Nominal schedule widths include frame-to-leaf operating gaps; confirm via RFI if Door Schedule lists actual leaf vs nominal opening.
- **CMU Walls**: Add **1/4" clearance on each side** of rough opening for frame mount and acoustic/fire sealant.
- **Hardware Set Parameter**: Always populate the **Hardware Set** parameter (LOD 300 non-graphic requirement) and verify handle projection does not clash with perpendicular walls.
- **Open Angle**: Model door panel open at maximum swing (**90°–180°**) for clear coordination checks.

![Door Frame Leaf Rough Opening Anatomy](img:c10_image409)

![Actual vs Nominal Door Size Comparison](img:c10_image410)

![Door Offset and Hinge Analysis Diagram](img:c10_image425)
`,
  }),

  mk({
    id: 116,
    node: "c10-mod-door",
    type: "doc",
    vis: "Internal",
    title: "Door Types — Swinging, Pivot, Pocket, Sliding & Specialty",
    desc: "Detailing specifications for all 11 door categories including elevator doors, Smoke Guard curtains, coiling grilles & Won-Doors.",
    status: "Approved",
    stage: "Design",
    disc: "Interior",
    tags: ["pocket-door", "sliding", "smoke-curtain", "won-door", "elevator"],
    author: "Maxim",
    upd: "2026-10-19",
    links: [[115, "hard"], [117, "hard"]],
    body: `## Supported Door Categories & Special Rules
| Door Type | Required Sub-Elements & Clearances |
|---|---|
| **Swinging / Double / Unequal** | Frame, panel(s), threshold if required, swing clear zone, ADA pull/push |
| **Pivot Door** | Panel, pivot hinge location + overhead/floor backing check, curved clear zone |
| **Pocket Door** | Leaf width > nominal schedule width; track clear zone above frame; CBC 11B-404.2 ADA |
| **Bi-Fold / Folding** | Fold stack zone + floor/head track clearance |
| **Sliding & Barn Door** | Leaf overlap in closed position + freestanding/wall track mount verification |
| **Elevator Door** | Coordinated shaft opening, infill grout clearance in concrete walls, car track |
| **Smoke Guard Curtain** | Head casing + side guide channels + ceiling/wall maintenance access clear zone |
| **Coiling Doors / Grilles** | Barrel casing + side guides + Hardware Set non-graphic LOD300 parameters |
| **Access Doors & Panels** | Wall/ceiling hatch framed clear zone per MEP elevations & submittals |
| **Accordion Won-Door** | Fire-rated niche pocket & ceiling envelope matching barrier rating (\`wondoor.com\`) |

![Pocket and Bi-Fold Door Modeling Zones](img:c10_image442)

![Sliding and Barn Door Overlap and Track Clearances](img:c10_image455)

![Smoke Guard Curtain and Coiling Grille Detail](img:c10_image470)

![Accordion Won-Door and Niche Fire Envelope](img:c10_image478)
`,
  }),

  mk({
    id: 117,
    node: "c10-mod-door",
    type: "doc",
    vis: "Internal",
    title: "Door Family Assembly — Nested Families, ADA & Threshold",
    desc: "6-step Revit family assembly workflow: Frame/Mullion, Panel, Door Opening Zone, ADA Clear Zone, Threshold & L#_ADA view.",
    status: "Approved",
    stage: "Construction",
    disc: "VDC",
    tags: ["Revit-family", "ADA-zone", "threshold", "nested-family"],
    author: "Maxim",
    upd: "2026-10-21",
    links: [[115, "hard"], [109, "hard"], [132, "soft"]],
    body: `## 6-Step Door Family Construction
1. **Frame Family (\`Frame/Mullion\`)**: Opening cut for Rough Opening + sweep frame + Width/Height/Material bindings.
2. **Door Leaf Family (\`Panel\`)**: Extrusion panel, 2D plan swing lines, \`Frame Type\`, \`ADA Pull Side\`, \`ADA Push Side\`, \`Offset from wall\`.
3. **Door Opening Zone (\`Door Clear Zone\`)**: Extruded swing volume locked to leaf face.
4. **ADA Clear Zone & Tolerance**: Nested ADA zone + 8" tolerance solid (subcategory assigned for view toggles).
5. **Nest & Lock**: Align and lock Frame, Opening Zone, and ADA Zone to host reference planes.
6. **Project Parameter Fill**: Populate Leaf/Frame materials, Fire Rating, Mark, Type Mark, Rough W/H, Hardware Set.

![Threshold Components and Non-Graphic LOD300 Rule](img:c10_image474)

![Nested Door Frame Leaf and Opening Zone Hierarchy](img:c10_image500)

![CL-RFI Visibility Settings for ADA Zones and L#_ADA 3D View](img:c10_image480)

> [!tip] On **CL-RFI** sheets, keep **ADA Tolerances** and **Door Clear Zones** hidden, **Required ADA Zones** visible, and door linework set to **Black**.
`,
  }),

  mk({
    id: 118,
    node: "c10-mod-eqp",
    type: "doc",
    vis: "Internal",
    title: "Unit Kitchens, Millwork & Casework Detailing",
    desc: "Kitchen cabinetry layout, appliance bays, countertop clearances, wet-wall stacking & millwork door swing zones.",
    status: "Approved",
    stage: "Design",
    disc: "Interior",
    tags: ["kitchens", "casework", "millwork", "clearances"],
    author: "Andrii Lytvynov",
    upd: "2026-10-17",
    links: [[119, "hard"], [120, "hard"], [123, "soft"]],
    body: `## Kitchen & Casework Modeling Workflow
- Review Architectural Enlarged Unit Kitchen Plans, Interior Elevations, and Casework Shop Drawings / Submittals.
- Model **opening clearances** (18"–24" swing/drawer zones) for all upper/lower cabinets, dishwashers, and refrigerators.
- Verify receptacle/plumbing boxes inside the kitchen backing wall match sink centerline and range hood ducting.

![Unit Kitchen Plan and Elevation Alignment](img:c10_image501)

![Base and Upper Cabinet Clearance Zones](img:c10_image499)

![Kitchen Appliance Integration and Sink Backing](img:c10_image511)

![Casework ADA Approach and Countertop Height Check](img:c10_image543)

![Kitchen Dimensioning Example for CL-RFI Plans](img:c10_image542)
`,
  }),

  mk({
    id: 119,
    node: "c10-mod-eqp",
    type: "doc",
    vis: "Internal",
    title: "Bathrooms, Plumbing Fixtures & Wet-Wall Coordination",
    desc: "WC, lavatories, bathtubs, shower pans, wall-carrier brackets & wet-wall thickness verification against MEP risers.",
    status: "Approved",
    stage: "Design",
    disc: "Interior",
    tags: ["bathrooms", "plumbing-fixtures", "wet-wall", "grab-bars"],
    author: "Iryna P.",
    upd: "2026-10-18",
    links: [[111, "hard"], [120, "hard"], [123, "hard"]],
    body: `## Bathroom & Restroom Detailing
- Place WC, lavatories, shower pans, and tubs accurately from Architectural Enlarged Restroom Plans and Fixture Cut Sheets.
- Confirm **wet-wall width** accommodates both horizontal drain branches and vertical vent/waste stacks between stacked unit floors.
- Verify accessible restroom turning radius (60" circle / T-turn) and grab-bar height/length compliance before issuing for MEP sync.

![Enlarged Bathroom Plan and Fixture Placement](img:c10_image551)

![Accessible Restroom Clearances and Grab Bar Zones](img:c10_image549)

![Wet Wall Thickness and Carrier Bracket Coordination](img:c10_image602)
`,
  }),

  mk({
    id: 120,
    node: "c10-mod-eqp",
    type: "doc",
    vis: "Internal",
    title: "Wall Backings & Blocking Families (Warehouse R21)",
    desc: "Nesting blocking families inside fixtures/casework, 2x6 lumber assumptions, 'Moves With Nearby Elements' & 'Layers quantity'.",
    status: "Approved",
    stage: "Construction",
    disc: "Interior",
    tags: ["backings", "blocking", "Warehouse-R21", "grab-bars"],
    author: "Elena Khlivetskaya",
    upd: "2026-10-20",
    links: [[118, "hard"], [119, "hard"], [131, "hard"]],
    body: `## Elements Requiring Wall Blocking Analysis
- Restroom grab bars, toilet partitions, wall-hung carriers & accessories
- TVs, heavy wall equipment (mini-splits, heaters), curtain rails & ceiling shades
- Stair handrails, wall-mounted FEC cabinets, heavy mirrors & artwork

![Wall Backing Requirements for Mounted Equipment](img:c10_image563)

![Blocking Family Type Selection in Warehouse R21](img:c10_image584)

## Mandatory Family Rules ("Warehouse Model - R21")
- **Nest Inside Host Families**: Load blocking families directly inside plumbing/kitchen/casework families so copying typical units never leaves orphan or shifted blockings!
- **Moves With Nearby Elements**: Enable this parameter so shifting a partition automatically pulls embedded blockings.
- **Layers quantity**: Offsets only the **2D color hatch** on Studs & Backing layouts when multiple blockings stack vertically, while keeping the **3D lumber geometry (assumed 2x6)** flush against the wall stud face.

![Moves With Nearby Elements and Mount Side Mark](img:c10_image580)

![Layers Quantity Offset Parameter Behavior](img:c10_image597)

![Backing Elevation and Stud-to-Stud Length Example](img:c10_image595)
`,
  }),

  mk({
    id: 121,
    node: "c10-mod-eqp",
    type: "doc",
    vis: "Internal",
    title: "Residential Appliances, FECs & Interior Specialties",
    desc: "Stacked/side-by-side Washer/Dryer Specialty Equipment rules, 30x48 FEC maneuvering zones, trash chutes, railings & shades.",
    status: "Approved",
    stage: "Design",
    disc: "Interior",
    tags: ["appliances", "washer-dryer", "FEC", "specialties"],
    author: "Elena Khlivetskaya",
    upd: "2026-10-16",
    links: [[105, "soft"], [109, "hard"], [111, "soft"]],
    body: `## Residential Appliances (W/D)
- **Category & Workset**: Model Washers and Dryers as **Specialty Equipment** assigned to the **Plumbing Fixtures** workset.
- **Clearances**: Model manufacturer installation clearances plus door swing opening zone and **ADA 30"×48" maneuvering approach**.
- **Outlet Boxes**: Verify whether the W/D cut sheet locks drain/valve boxes to left/right sidewall vs free placement behind unit.

![Stacked and Side-by-Side Washer Dryer Clearances](img:c10_image610)

![Appliance Cut Sheet Hookup and Outlet Box Check](img:c10_image606)

## Interior Specialties Coverage
- **Fire Extinguisher Cabinets (FEC)**: Recessed rated contour & framing rough opening + **30"×48"** floor clear zone.
- **Postal Equipment, Trash Chutes & Waste/Recycling Bins**: Coordinate chute slab openings and ADA reach range.
- **Interior Railings & Roller Shades**: Coordinate pocket ceiling depths and handrail backing height.

![FEC Recessed Rough Opening and Maneuvering Zone](img:c10_image625)

![Postal and Waste Specialty Room Layout](img:c10_image633)

![Interior Guardrail and Handrail Detailing](img:c10_image635)

![Ceiling Pocket for Motorized Roller Shades](img:c10_image639)
`,
  }),

  mk({
    id: 122,
    node: "c10-crd-sys",
    type: "doc",
    vis: "Internal",
    title: "Concrete Pouring Tolerances & NF Simulation Workflow",
    desc: "Preventing ADA & clear-zone clashes caused by slab/wall concrete tolerances; mandatory NF simulation prior to CL edits.",
    status: "Approved",
    stage: "Construction",
    disc: "VDC",
    tags: ["tolerances", "concrete", "NF", "ADA-clash"],
    author: "Anton Kolmykov / Anastasia Batechko",
    upd: "2026-10-19",
    links: [[109, "hard"], [123, "hard"], [125, "soft"]],
    body: `## Tolerance Impact on Interior Walls
When an interior furring or GWB partition aligns to a cast-in-place concrete wall or column, permissible **concrete pouring deviations** can push the GWB face inward — causing critical clashes with **door ADA maneuvering zones** or **HOLD corridor dimensions**.

![Concrete Tolerance Shift vs Door ADA Clear Zone Clash](img:c10_image650)

## Mandatory Resolution Protocol
1. **Simulate in NF**: Model the worst-case concrete tolerance envelope and capture the resulting ADA/door clash.
2. **Present Options**: Propose clear alternatives (shift furred wall away, swap to thinner U/hat-furring assembly, adjust door swing/hardware).
3. **Wait for Approval**: **Never** permanently relocate partitions for concrete tolerances until confirmed via **NF / RFI response**.
`,
  }),

  mk({
    id: 123,
    node: "c10-crd-sys",
    type: "doc",
    vis: "Internal",
    title: "Workflow with MEP, Structural & Plumbing Systems",
    desc: "Cross-discipline change notification rules for fixtures, ceiling offsets, wet walls, shafts & cloud-tracked revisions.",
    status: "Approved",
    stage: "Construction",
    disc: "MEP",
    tags: ["MEP", "plumbing", "coordination", "Navisworks", "communication"],
    author: "Anton Kolmykov / Anastasia Batechko",
    upd: "2026-10-20",
    links: [[119, "hard"], [122, "hard"], [125, "soft"]],
    body: `## Four Changes That Must Always Notify Plumber / MEP
1. **Plumbing Fixture Moved / Added / Deleted**: Unconnected sanitary stubs or orphaned pipes on site.
2. **Ceiling Height Adjusted or Removed**: Plumbing access panels and horizontal mains left exposed below the ceiling plane.
3. **Wet-Wall Position or Thickness Reduced**: Vertical risers protruding out through finished gypsum surfaces.
4. **Shaft Deleted / Shifted / Resized**: Unenclosed vertical pipe chases running mid-room.

![MEP Coordination Checklist Fixtures Ceilings Wet Walls and Shafts](img:c10_image661)

> [!important] Load all active MEP and Structural Revit links (or inspect federated **Navisworks** weekly builds) and cloud every interior geometry update in the title block before publishing.
`,
  }),

  mk({
    id: 124,
    node: "c10-crd-sys",
    type: "template",
    vis: "Internal",
    title: "Dusty Robotics Field-Print Export Checklist",
    desc: "Mandatory Revit wall layer order, continuous segments, stud-to-stud RO & TOS elevations required before Dusty Robotics export.",
    status: "Approved",
    stage: "Construction",
    disc: "VDC",
    tags: ["Dusty-Robotics", "layout-printing", "export", "checklist"],
    author: "Andrii Lytvynov",
    upd: "2026-10-18",
    links: [[111, "hard"], [115, "hard"], [125, "soft"]],
    body: `## Mandatory Pre-Export Modeling Rules
Before exporting any **Interior CL** model to **Dusty Robotics** automated floor layout printers, verify every item below:

- [ ] **Wall Layer Ordering**: Inside Revit Edit Assembly, **Finish 1** must immediately border **Structure** (Core), and **Finish 2** follows outside Finish 1.
- [ ] **No Split Collinear Segments**: Never break one continuous wall type into multiple co-linear wall segments without a structural reason.
- [ ] **Door Rough Openings**: Detailed accurately **stud-to-stud**, with Type/Instance parameters matching physical model geometry.
- [ ] **Recessed Niches & Cabinets**: Wall opening modeled **stud-to-stud** with **Elevation to RO from T.O.S.** populated.
- [ ] **Backings**: Exact \`LENGTH × WIDTH\` dimensions and **Elevation from T.O.S.** entered in instance properties.

![Dusty Robotics Wall Layer Structure Rule](img:c10_image669)

![Dusty Robotics Door and Niche Stud-to-Stud Rough Opening](img:c10_image675)
`,
  }),

  mk({
    id: 125,
    node: "c10-crd-qa",
    type: "report",
    vis: "Internal",
    title: "Interior CL & CL-RFI Quality Assurance Protocol",
    desc: "QA return thresholds (-1 rule), Bluebeam/Revit markup legends, Ctrl+F5 navigation & tolerance view toggling before issue.",
    status: "Approved",
    stage: "Construction",
    disc: "VDC",
    tags: ["QA", "quality-assurance", "markup", "tolerances"],
    author: "Elena Khlivetskaya",
    upd: "2026-10-21",
    links: [[126, "hard"], [127, "hard"], [128, "hard"]],
    body: `## QA Review & Rework Policy
- **Systemic / Repeating Errors**: If a submission contains widespread repeating errors across typical units, QA must return the task immediately for rework (**Quality cannot exceed -1**) rather than logging dozens of identical comments.
- **QA Markup Legend**: For non-blocking repeating observations, group annotations under the **QA Clouds / Marks Legend** and step through comments using \`Ctrl + F5\`.
- **Dual Template Rule**: Maintain two View Templates — **With Tolerances** (printed for QA review) and **Clean CL** (tolerances hidden prior to final upload to Scheduler / Procore / Box).

![QA Markup Legend and Pre-Print View Check](img:c10_image689)
`,
  }),

  mk({
    id: 126,
    node: "c10-crd-qa",
    type: "doc",
    vis: "Internal",
    title: "Common Mistakes — Part 1: Partitions, Shafts & Levels",
    desc: "Visual catalog of frequent PE audit failures in wall assemblies, shaft vertical stacking, nominal lumber & typical unit overlays.",
    status: "Approved",
    stage: "Construction",
    disc: "Interior",
    tags: ["mistakes", "QA", "shafts", "partitions", "audit"],
    author: "Maxim",
    upd: "2026-10-22",
    links: [[125, "hard"], [127, "hard"], [111, "soft"]],
    body: `## Critical Errors Observed in CL Audits (Slides 390–430)
1. **Unstacked Shaft Walls**: Mechanical/stair shafts shifted between floors due to uncoordinated level overlays.
2. **Wrong Fire Rating Assembly**: Missing second Type X GWB layer on 2-HR wood-framed shafts or corridor penetrations.
3. **Nominal vs Actual Wood Studs**: Modeling 2.0"×4.0" nominal walls instead of 1-1/2"×3-1/2" actual framing.
4. **Misaligned Typical Units**: Vertical offset between typical dwelling floors causing sleeve and riser collisions.

![Audit Case 1 Shaft Stacking Mismatch](img:c10_image812)

![Audit Case 2 Partition Type and Layer Order Error](img:c10_image821)

![Audit Case 3 Wood Framing Sheathing and Furring Gap](img:c10_image852)

![Audit Case 4 Typical Unit Overlay Displacement](img:c10_image833)
`,
  }),

  mk({
    id: 127,
    node: "c10-crd-qa",
    type: "doc",
    vis: "Internal",
    title: "Common Mistakes — Part 2: Doors, ADA, Fixtures & Annotations",
    desc: "Visual catalog of PE audit errors in door ADA clearances, swing angles, fixture disconnects, mixed F.F./Stud notes & stale clouds.",
    status: "Approved",
    stage: "Construction",
    disc: "Interior",
    tags: ["mistakes", "ADA", "doors", "annotations", "QA"],
    author: "Maxim",
    upd: "2026-10-22",
    links: [[125, "hard"], [126, "hard"], [129, "hard"]],
    body: `## Door, Fixture & Documentation Errors (Slides 431–465)
1. **ADA Zone Clipped by Wall / Fixture**: Push/pull zone overlapping toilet bowl, millwork edge, or adjacent partition.
2. **Inconsistent Stud vs Finish Dimensions**: Mixing face-of-stud and face-of-finish strings on the same sheet violates field readability.
3. **Disconnected Plumbing Risers**: Moving WC/sink in INT without notifying MEP.
4. **Uncoordinated Hardware / Swing Angle**: Doors overlapping or handles colliding with adjacent concrete walls.

![Audit Case 5 Door ADA Maneuvering Overlap](img:c10_image846)

![Audit Case 6 Pocket and Sliding Track Clearance Miss](img:c10_image886)

![Audit Case 7 Mixed Stud vs Finish Dimension String](img:c10_image884)

![Audit Case 8 Restroom Grab Bar and Fixture Spacing](img:c10_image887)

![Audit Case 9 Ceiling Height vs Plumbing Access Panel](img:c10_image898)

![Audit Case 10 Missing B/B/R Annotation Color Coding](img:c10_image897)

![Audit Case 11 Revision Cloud and Overlay Mismatch](img:c10_image893)
`,
  }),

  mk({
    id: 128,
    node: "c10-drw-gen",
    type: "doc",
    vis: "Internal",
    title: "CL-RFI Package Architecture & View Configuration",
    desc: "Standard sheet numbering (1, 1.1, 1.4, 1.5, 4, 4.1), View Range, Object Styles 1 Black, STR Solid Grey 192 & Dependent views.",
    status: "Approved",
    stage: "Construction",
    disc: "Interior",
    tags: ["CL-RFI", "view-settings", "object-styles", "visibility"],
    author: "Aleksey Girdvoin",
    upd: "2026-10-19",
    links: [[129, "hard"], [130, "hard"], [131, "hard"]],
    body: `## Standard CL-RFI Deliverable Sheets
| Sheet Code | Deliverable Title |
|---|---|
| \`CL-RFI L##.1\` | Coordinated Partition Layout (General & Enlarged Dependent Areas) |
| \`CL-RFI L##.1.1\` | Egress and Holds Plan |
| \`CL-RFI L##.1.4\` | Studs & Backing Layout |
| \`CL-RFI L##.1.5\` | Interior Door Schedule |
| \`CL-RFI L##.4\` | Coordinated Ceiling Plan (RCP) |
| \`CL-RFI L##.4.1\` | Revised Ceiling Devices Plan |

## Mandatory View & Visibility Rules
- **Object Styles**: Set Walls, Doors, Ceilings, Plumbing Fixtures, and Generic Models line color/weight to **\`1 Black\`**.
- **Transparency & Scale**: Match Architectural scale with **20% transparency**; create Enlarged Area plans as **Dependent Views** bounded by Matchlines & View References.
- **Links**: All CL links **Halftone**; STR concrete columns/walls **Solid Fill Grey (192,192,192)** with metal assemblies & slabs White and embeds/studrails hidden.
- **B/B/R Color Logic**: Use uniform text heights (\`1/8"\`, \`1/16"\`, \`3/64"\`, \`1/32"\`) per **Black/Blue/Red Annotation Logic**.

![CL-RFI Visibility Graphics and Object Styles Settings](img:c10_image683)
`,
  }),

  mk({
    id: 129,
    node: "c10-drw-gen",
    type: "doc",
    vis: "Internal",
    title: "Title Blocks, Legends, General Notes & Revision Markups",
    desc: "CL RFI Title_30x42 setup, Guide Grids, Stud vs FF general notes, B/B/R legends, blue/red PDF overlay & Planit Revision Standard.",
    status: "Approved",
    stage: "Construction",
    disc: "Interior",
    tags: ["title-block", "legends", "revisions", "Planit-Comments", "B/B/R"],
    author: "Aleksey Girdvoin",
    upd: "2026-10-21",
    links: [[102, "hard"], [128, "hard"], [130, "soft"]],
    body: `## Sheets, Guide Grids & Legends
- **Standard Title Block**: \`CL RFI Title_30x42 - Interior\` with shared text parameters \`Sheet Type\` and \`Sheet Subtype\`.
- **Guide Grids**: Share one Guide Grid across all General Plans and one per Enlarged Area so floor-to-floor PDF overlays register cleanly.
- **Separate Legends**: Never include Tag Decoding legends on General overall plans where partition/door tags are hidden.
- **General Notes Consistency**: Align dimension reference note (*Face of Stud* vs *Face of Finish*) and ceiling datum (*AFF* vs *TOS*) strictly with DD, and **never mix Stud and Finish dimensions** on the same sheet.

![CL-RFI Sheet Layout Guide Grid and Key Plan](img:c10_image208)

![General Notes Stud vs Finish Consistency](img:c10_image215)

## Revision Block & Markups (Per P&C Planit Revision Standard)
- Include revision reason (RFI / DD / Submittal), area location, and concise action summary.
- When producing **\`- Planit Comments\`** markups: append a **Blue (Previous) / Red (Current)** overall-plan overlay (except R0), list Open/Returned RFIs, and cloud every changed geometry element.

![B/B/R Legend and Revision Cloud Styling](img:c10_image245)

![Typical Level-to-Level Overlay Comparison Check](img:c10_image243)
`,
  }),

  mk({
    id: 130,
    node: "c10-drw-lay",
    type: "doc",
    vis: "Internal",
    title: "CL-RFI L##.1 — Coordinated Partition Layout & Tagging",
    desc: "Composite ARCH + PLANIT wall tags (1.S.4-PB), nominal thickness coding, Black/Blue/Red tag families & typical area hatching.",
    status: "Approved",
    stage: "Construction",
    disc: "Interior",
    tags: ["L##.1", "wall-tag", "door-tag", "partition-layout", "tagging"],
    author: "Elena Khlivetskaya",
    upd: "2026-10-21",
    links: [[107, "hard"], [128, "hard"], [129, "hard"]],
    body: `## Composite Wall Tag Anatomy
Every partition tag in \`CL-RFI L##.1\` displays **ARCH** (original DD tag at top) over **PLANIT** composite code (e.g., \`1.S.4-PB\`):
1. **Fire Rating**: \`0\`, \`1\`, \`2\` (CBC Ch. 7)
2. **Framing Type**: \`S\` (Structural/C Stud), \`CH\`, \`U\` (Hat), \`Z\`, \`F\` (Wood), \`CMU\` — use \`/\` for composite dual-framing walls (e.g., \`U/F\`, \`3/5\`)
3. **Nominal Stud Thickness**: Drop \`,1\` / \`,2\` decimals if intermediate stud sizes are unused on the project
4. **Additional Layer Suffixes**: Insulation code + modified layers (\`-PB\`, Plywood, Moisture-resistant \`G\`, \`2G\`)

![Composite Wall Tag ARCH over PLANIT Anatomy](img:c10_image723)

![Partition Layer Color Code and Hatching Legend](img:c10_image728)

## Wall Tag Color Variants & Typical Zones
- **Black (\`Wall Tag - 1x16 - Black\`)**: Matches Contract Documents.
- **Blue**: Changed partition type after initial approval.
- **Red**: Missing wall/layer information in Contract Documents.
- **Door Tags**: Numeric fire rating only (\`20\`, \`180\`, \`-\` without "min").
- **Typical Floor Hatching**: Hide interior dimensions/tags inside typical repeat areas and note \`"SIMILAR LEVEL 8 / CL-RFI L08.1A"\`.

![Wall Tag B/B/R Types and Shared Parameters](img:c10_image733)

![Door Tag Legend and Elevation Tags for Half-Walls](img:c10_image741)

![Enlarged Partition Layout Annotation and HOLD Check](img:c10_image750)
`,
  }),

  mk({
    id: 131,
    node: "c10-drw-lay",
    type: "doc",
    vis: "Internal",
    title: "CL-RFI L##.4, Studs/Backing Layout & Parking Control",
    desc: "Coordinated Ceiling Plans (4), Ceiling Devices (4.1), Studs & Backing Layouts (1.4), Interior Elevations & Parking Control plans.",
    status: "Approved",
    stage: "Construction",
    disc: "Interior",
    tags: ["RCP", "studs-backing", "elevations", "parking-control"],
    author: "Iryna P.",
    upd: "2026-10-20",
    links: [[102, "hard"], [113, "hard"], [120, "hard"]],
    body: `## Coordinated Ceiling Plans (\`L##.4\` & \`L##.4.1\`)
- Show only **Ceilings** and **Walls** categories on \`L##.4\`; display ceiling types, datum heights (AFF/TOS), bulkhead drops, and soffit framing.
- Coordinate \`L##.4.1 Revised Ceiling Devices Plan\` with lighting fixtures, diffusers, smoke detectors, and plumbing access panels.

![Coordinated Ceiling Plan RCP Tagging and Datum](img:c10_image767)

![Revised Ceiling Devices Plan Sync with MEP Lighting](img:c10_image785)

## Studs & Backing Layout (\`L##.1.4\`) & Elevations
- Display nested 2x6 lumber backings with distinct \`Layers quantity\` 2D color hatches and T.O.S. mounting elevations.
- Verify **Parking Control** gates, arms, islands, and sensors using the dedicated Actual Google Doc standard.

![Studs and Backing Layout L##.1.4 Annotation](img:c10_image790)

![Ceiling Height and Soffit Section Callout](img:c10_image260)

![Enlarged Kitchen and Restroom Elevation Detailing](img:c10_image279)

![Parking Control Equipment Layout Coordination](img:c10_image280)
`,
  }),

  mk({
    id: 132,
    node: "c10-drw-sch",
    type: "doc",
    vis: "Internal",
    title: "Schedules, Finish Legends, 3D Views & Batch Printing",
    desc: "GWB Partition Schedule, Interior Door Schedule (L##.1.5), Warehouse Legend pruning, L#_ADA 3D views & Bluebeam/Bullzip print sets.",
    status: "Approved",
    stage: "Construction",
    disc: "Interior",
    tags: ["schedules", "door-schedule", "printing", "Bluebeam", "3D-views"],
    author: "Andrii Lytvynov",
    upd: "2026-10-22",
    links: [[117, "hard"], [128, "hard"], [129, "hard"]],
    body: `## GWB Partition Schedule & Door Schedule (\`L##.1.5\`)
- **Partition Schedule**: Synchronize Warehouse GWB assemblies with project partition tags; remove unused types from the **Project Legend** (never modify standard designations).
- **Door Schedule**: Include Door Mark, Type Mark, Nominal/Rough W×H, Leaf/Frame Materials, Fire Rating, Threshold Type, and **Hardware Set**.

![GWB Partition Schedule Sample](img:c10_image302)

![Interior Door Schedule L##.1.5 Formatting](img:c10_image295)

## Legends, 3D Views & Print Settings
- Maintain both \`Partition Tag Legend - Standard\` (reference) and \`Partition Tag Legend - [Project]\` (sheet legend).
- Configure **\`L#_ADA\` 3D Coordination Views** to inspect door/fixture/restroom maneuvering envelopes visually.
- **Batch Print**: Output combined PDFs via **Bluebeam** or **Bullzip** using saved sets named \`CL - L02 - RPL\` / \`CL - L16 - RCP\`.

![Material Finish Matrix and Legend Cleanup](img:c10_image305)

![Warehouse Standard vs Project Legend Filtering](img:c10_image298)

![3D ADA Coordination View Template Setup](img:c10_image306)

![Bluebeam and Bullzip Batch Print Set Naming](img:c10_image327)

![Final Combined CL-RFI PDF Deliverable Structure](img:c10_image315)
`,
  }),

  mk({
    id: 133,
    node: "c10-mod-wall",
    type: "doc",
    vis: "Internal",
    title: "C1010.10.06 — CMU Walls, Lintels, Reinforcing & Pre-Pour",
    desc: "Actual vs nominal CMU sizes (GC NF rule), slab-to-slab & cutting rules, pit-wall scope, Pre-Pour penetrations, embeds/dowels & Sec. 2.4.2 reinforcing.",
    status: "Approved",
    stage: "Construction",
    disc: "Structure",
    tags: ["CMU", "C1010", "pre-pour", "lintels", "embeds", "dowels"],
    author: "Aleksey Girdvoin",
    upd: "2026-10-22",
    links: [[102, "hard"], [111, "hard"], [115, "soft"], [135, "hard"]],
    body: `## Actual vs Nominal CMU Sizes (GC NF Rule)
Before starting CMU partition modeling, confirm whether Design Documents dimension **actual** or **nominal** block sizes.
- **Standard Rule**: Always model CMU partitions using **actual unit dimensions** (e.g., \`7-5/8"\` for nominal \`8"\`) and issue a **Notification (NF)** for record assigned to the **General Contractor (GC)**.
- Using nominal dimensions when DD uses actual sizes creates compounding layout clashes at doors, corridors, and slab edges.

![CMU Actual vs Nominal Masonry Unit Dimensions](img:c1010_image73)

![Top CMU Connection Slab-to-Slab and Steel Deck](img:c1010_image63)

## Height, Cutting & Pit-Wall Scope Boundary
- **Height**: CMU partitions extend **slab to slab** unless terminated by metal deck, structural steel beams, or modeled as half-height / bottom tier of a Stacked Wall.
- **Cutting**: Concrete masonry blocks may be cut in any direction where geometry requires.
- **Pit-Wall Exception**: Bearing CMU pit walls located below levels without CL-RFI drawings belong to the **Structural scope**, not Interior.

![Bearing Pit Wall Structural Scope Exception](img:c1010_image70)

## Workflow with Structural & MEP (Pre-Pour, Embeds, Dowels)
- **Pre-Pour Drawings**: CMU walls appear on Pre-Pour drawings; MEP penetrations require CMU wall elevations showing **blockouts or sleeves**.
- **Top & Bottom Restraints**: Top-of-wall slab-bottom **embeds** are modeled by Structural; bottom-of-wall **dowels** are cast during concrete pours — notify STR immediately before shifting any CMU wall!
- **Lintels, Bond Beams & Reinforcing (UPD 05/21/2026)**: Clarify with Structural whether concrete shop drawings require CMU reinforcing and adjacent wall heights per **Section 2.4.2 — CMU Wall Connection Detailing Requirements** (#102).

![Pre-Pour CMU Wall MEP Penetrations and Blockouts](img:c1010_image75)

![CMU Top Embeds and Field Slab Dowels](img:c1010_image6)
`,
  }),

  mk({
    id: 134,
    node: "c10-mod-wall",
    type: "doc",
    vis: "Internal",
    title: "C1010.10.02–05 — Furred, Shaft, Demising & Stacked Walls",
    desc: "Resilient/Hat/Z-Furring channels, ACI 117.1R-14 NF options, CH-stud shafts, Elevator Utilities Exclusion Zone (R23), Demising, Staggered & Pony walls.",
    status: "Approved",
    stage: "Design",
    disc: "Interior",
    tags: ["furred-wall", "shaft-wall", "demising", "exclusion-zone", "pony-wall", "C1010"],
    author: "Aleksey Girdvoin",
    upd: "2026-10-22",
    links: [[111, "hard"], [108, "hard"], [122, "hard"], [135, "hard"]],
    body: `## Pony Wall Scope Rule
If Unit Kitchens are excluded from project scope or placed on long-term hold, **kitchen pony walls must still be modeled inside the Interior Partitions task**.

## C1010.10.04 — Furred Walls (Resilient, Hat & Z-Furring)
| Furring Type | Application & Modeling Rule |
|---|---|
| **Resilient Channel** | Acoustic decoupling mounted perpendicular to studs/joists; drywall screws must penetrate channel **only** (never underlying studs) |
| **Hat Channel** | \`7/8"\` or \`1-1/2"\` leveling channel over concrete; create a 2-option NF citing **ACI 117.1R-14**: (1) place at tolerance zone, or (2) fasten direct to concrete ignoring tolerance |
| **Z-Furring** | \`1"\`, \`1-1/2"\`, \`2"\`, \`2-1/2"\`, \`3"\` profiles over masonry/concrete at 16"–24" OC with rigid cavity insulation |

![Resilient Channel Acoustic Decoupling Assembly](img:c1010_image28)

![Hat Channel Concrete Surface Leveling Detail](img:c1010_image12)

![Z-Furring Profile over Masonry and Concrete](img:c1010_image16)

## C1010.10.03 — Shaft Walls & Elevator Utilities Exclusion Zone
- **CH-Stud Framing**: Specialized cavity shaftliner assembly for stairwells, mechanical chases, and elevator shafts; verify edge-of-slab conditions and vertical stacking via overlays and sections.
- **Utilities Exclusion Zone**: Hatch zone around elevator equipment/anchorage that must remain **completely free of concealed utilities** (plumbing, electrical conduit, sleeves, piping, ductwork, embeds).
  - *Concrete core / shear walls around elevator*: **Structural** details exclusion zone and notifies Interior.
  - *Framing shaft walls around elevator*: **Interior** is responsible using Generic Models from \`C Interiors - Warehouse Model - R23\`.

![CH Stud Shaft Wall Framing Profile](img:c1010_image64)

![Shaft Wall Interface at Concrete Slab Edge](img:c1010_image78)

![Elevator Utilities Exclusion Zone Plan and Limits](img:c1010_image83)

![Utilities Exclusion Zone Revit Generic Model Family](img:c1010_image4)

## Demising, Double Stud, Staggered Stud & Stacked Walls
- **C1010.10.02 Demising Wall**: Separates multi-tenant units/occupancies with continuous acoustic/fire separation.
- **C1010.10.05 Double & Staggered Stud**: Dual stud rows or staggered 16"–24" OC framing for serpentine acoustic insulation.
- **Stacked Walls**: Combined multi-material vertical assemblies (e.g., CMU masonry base below upper metal/wood GWB) or partial-height transitions.

![Demising Wall Acoustic and Fire Separation](img:c1010_image89)

![Double Stud Wall Assembly Diagram](img:c1010_image90)

![Stacked Wall CMU and Framing Transition](img:c1010_image67)

![Staggered Stud Acoustic Snaking Insulation](img:c1010_image11)
`,
  }),

  mk({
    id: 135,
    node: "c10-mod-wall",
    type: "doc",
    vis: "Internal",
    title: "C1010 Revit Guidelines — Layers [1–5], Joins & Filters",
    desc: "LOD 300 layer colors, RGB 187/249/57 step-align NR GWB rule, Fire Rating \"-\"/\"1\"/\"2\", BI/AI/0I insulation, Layer functions & Disallow Join.",
    status: "Approved",
    stage: "Construction",
    disc: "VDC",
    tags: ["Revit-guidelines", "layer-function", "fire-rating", "insulation", "LOD300"],
    author: "Aleksey Girdvoin",
    upd: "2026-10-22",
    links: [[107, "hard"], [108, "hard"], [133, "hard"], [134, "hard"]],
    body: `## LOD 300 Material & Color Standards
- Assign a distinct Revit material to every wall layer so wall types are visually unmistakable in Plan, Section, and 3D Coordination views.
- Wall surface color must correspond to its **Fire Rating** (except CMU).
- **Additional NR GWB for Flush Alignment**: Set **Cut Pattern** to unrated green (**RGB \`187 249 57\`**), while **Surface Pattern & 3D Generic Appearance** match the host wall's overall Fire Rating.

![C1010 Standard Wall Assembly Layer Stack](img:c1010_image25)

![Interior Partition Fire Rating Color Coding LOD300](img:c1010_image62)

## Fire Rating Properties & Broken-Contour View Filters
- Enter Fire Rating strictly as numeric strings **\`-\`**, **\`1\`**, **\`2\`**, etc. — **never** write \`"NR"\`, \`"1HR"\`, or \`"2HR"\`.
- Run self-check **View Filters** before QA to verify every fire-rated perimeter contour is closed; log an NF for any wall-to-door fire-rating mismatch.

![Fire Rating Contradiction Detection Example](img:c1010_image21)

![Revit View Filters for Broken Fire-Rated Contours](img:c1010_image66)

## Insulation Designations & Acoustic Thicknesses
| Code | Meaning | Standard Cavities & Materials |
|---|---|---|
| **BI** | Batt Insulation | Fiberglass Batts (\`3.5"\` R-11..R-15 in 2x4; \`5.5"\` R-19..R-21 in 2x6) |
| **AI** | Acoustical Insulation | Mineral Wool (\`3.5"\` / \`5.5"\`) — sound absorption + fire resistance |
| **0I** | No Insulation | Uninsulated standard partition |
| *Special* | Spray Foam | Open/closed-cell \`3.5"\` full or partial cavity per spec |

![Insulated CMU and Partition Insulation Schedule](img:c1010_image82)

## Wall Layer Functions & Joining Rules ([1] to [5])
Configure layer priorities cleanly so intersecting GWB and framing join automatically without Wrap errors:
1. **Structure \`[1]\`**: Main framing studs, plywood sheathing, core air gaps in load-bearing/demising walls.
2. **Structure \`[2]\`**: Secondary framing studs and furring channels.
3. **Thermal/Air Layer \`[3]\`**: Cavity gaps / thermal breaks.
4. **Finish 1 \`[4]\`**: Fire-rated Type X / Type C GWB boards.
5. **Finish 2 \`[5]\`**: Non-rated GWB layers and surface finishes.

> [!warn] **Never use Revit "Wrap"** (creates duplicate wall types and broken joins). Use **Disallow Join** + separate grouped layer walls for complex rated corners, and issue **one global NF** up front if DD omits dimensions/wall tags (assumed tags will render Red on CL-RFI).

![Corridor Hold Width and Concrete Tolerance Analysis](img:c1010_image15)
`,
  }),

  mk({
    id: 136,
    node: "c10-crd-sys",
    type: "doc",
    vis: "Internal",
    title: "C1010 3D Coordination Views (L## - A), Parts & QA",
    desc: "Mandatory Create Parts on L## - A before Navis/3D export, Base Point Marker, 3D Room Tags, Door Clear Zones toggle & Redmine QA checklists.",
    status: "Approved",
    stage: "Construction",
    disc: "VDC",
    tags: ["3D-coordination", "Create-Parts", "L##-A", "Redmine-QA", "C1010"],
    author: "Aleksey Girdvoin",
    upd: "2026-10-22",
    links: [[114, "hard"], [123, "hard"], [125, "hard"], [135, "hard"]],
    body: `## Mandatory Rules for \`L## - A\` Architecture Coordination Views
Preparing \`L## - A\` coordination views is part of every modeling task's scope:
- **Show**: **Base Point Marker** (set at project start), **3D Room Tags** (generated via Planit Tools on \`L## - A\`), and all wall/ceiling geometry **converted to Parts**.
- **Hide**: Sections, Scope Boxes, Revit **Room** geometry volume, ADA maneuvering zones, plumbing/kitchen/appliance clearance solids.
- **Door Zones Toggle**: Keep **\`Door Clear Zones\`** and **\`Door Clear Handle\`** **ENABLED** in \`L## - A\` (even though ADA zones stay off!).

## Mandatory \`Create Parts\` Workflow Before Every Upload
1. Switch to the target partition/ceiling workset in \`L## - A\`.
2. Select all walls and ceilings in the view and execute **Create Parts**.
3. Verify **every** wall has been divided into Parts prior to **each** Navisworks / coordination view upload.

![L## - A 3D Coordination View with Base Point and 3D Room Tags](img:c1010_image3)

![Revit Create Parts Execution Check on Partitions](img:c1010_image7)

![Visible vs Hidden Elements on L## - A Coordination View](img:c1010_image34)

## Elements Included in \`L## - A\`
Interior partitions, doors (with \`Door Clear Zones\` & \`Door Clear Handle\`), interior windows, floorings & wall finishes, plumbing fixtures, kitchens & food-service equipment, caseworks & furniture, residential appliances, equipment work clearances (non-ADA), shades, parking lots & clearances, elevators, and headroom clearances.

## C1010 Quality Assurance & Redmine Checklists
- Follow the **Wood** or **Metal** Redmine QA checklist matching the building's primary partition stud type (both checklists also audit CMU and Glazed/Storefront walls).
- Cross-check Input Checklist, Procore, Input Log, and Coordination Log dates against C1010 LOD, Model Naming, Project Browser Standards, and **P&C Planit NF Standard**.

> [!important] Initial **model setup time is NOT included** inside the interior partitions modeling ET — log it under a dedicated setup task in Redmine.
`,
  }),
];

export const NOTES = [
  { id: "a", text: "Elena Khlivetskaya flagged Actual Interior Walls Doc on #102", rid: 102, t: "2 h ago", un: 1 },
  { id: "b", text: "Maxim added Common Mistakes Parts 1 & 2 to QA Protocol", rid: 126, t: "yesterday", un: 1 },
  { id: "c", text: "Andrii Lytvynov updated Planit Tools 3D Room Tags guide for Revit 2026", rid: 114, t: "3 days ago", un: 0 },
];

export const SEED_COLLECTIONS = [
  {
    id: "col-c10-onboarding",
    name: "Interior PE Onboarding Kit (C10_INTERIOR)",
    desc: "Essential 5-step track for new Interior PE specialists before starting their first CL-RFI project.",
    tier: "official",
    mode: "list",
    owner: "Elena Khlivetskaya",
    vis: "Internal",
    coEditors: ["Maxim", "Iryna P.", "Andrii Lytvynov"],
    at: Date.now() - 86400000 * 3,
    items: [
      { id: 100, note: "Start here: 465-slide C10_INTERIOR division map." },
      { id: 102, note: "Bookmark Actual Google Docs & C1010 NF Standard." },
      { id: 104, note: "Follow Project Start Intake & Input/Output Checklist." },
      { id: 108, note: "Verify IBC/CBC Chapter 7 fire & shaft ratings." },
      { id: 135, note: "Learn Revit Layer Functions [1–5] & Fire Rating rules." },
      { id: 115, note: "Master interior door modeling & Hardware Set rules." },
    ],
    nodes: [],
    edges: [],
    vp: null,
  },
  {
    id: "col-clrfi-release",
    name: "CL-RFI Deliverable & QA Release Gate",
    desc: "Pre-issue verification sequence before exporting CL-RFI PDFs, L## - A 3D Parts or Dusty Robotics layout files.",
    tier: "official",
    mode: "list",
    owner: "Maxim",
    vis: "Internal",
    coEditors: ["Elena Khlivetskaya", "Andrii Lytvynov"],
    at: Date.now() - 86400000 * 2,
    items: [
      { id: 136, note: "Run Create Parts & check L## - A coordination visibility." },
      { id: 124, note: "Verify Dusty Robotics Finish 1 / Core / Finish 2 order." },
      { id: 125, note: "Run QA check & toggle tolerance view templates." },
      { id: 126, note: "Check common shaft, stud & typical-unit mistakes." },
      { id: 129, note: "Validate B/B/R legends, General Notes & Revision Clouds." },
      { id: 132, note: "Export combined PDF sets via Bluebeam/Bullzip." },
    ],
    nodes: [],
    edges: [],
    vp: null,
  },
  {
    id: "col-codes-public",
    name: "Design Team & Client Code Reference",
    desc: "Public standards, code portals, and ADA maneuvering guidelines shared with external partners.",
    tier: "official",
    mode: "list",
    owner: "Elena Khlivetskaya",
    vis: "Public",
    coEditors: ["Maxim"],
    at: Date.now() - 86400000,
    items: [
      { id: 100, note: "Master C10_INTERIOR Knowledge Base overview." },
      { id: 102, note: "Live Google Docs Standards index." },
      { id: 108, note: "Chapter 7 Fire-Resistance & Shaft rules." },
      { id: 109, note: "Chapter 11A/11B ADA door & approach clearances." },
      { id: 110, note: "Direct links to ICC, UpCodes & ADA 2010." },
    ],
    nodes: [],
    edges: [],
    vp: null,
  },
];

export const SEED_ACTIVITIES = [
  { id: "act-1", actor: "Maxim", action: "Published", targetType: "document", targetId: "133", targetTitle: "C1010.10.06 — CMU Walls, Lintels, Reinforcing & Pre-Pour", note: "Integrated C1010 Interior Partitions.docx (v2 UPD 05/21/2026) into Interior", at: "2026-10-22" },
  { id: "act-2", actor: "Elena Khlivetskaya", action: "Verified", targetType: "document", targetId: "102", targetTitle: "Actual Interior Standards & P&C Google Docs Hub", note: "Added P&C NF Standard, CMU Sec. 2.4.2 & Concrete Tolerance links", at: "2026-10-21" },
  { id: "act-3", actor: "Andrii Lytvynov", action: "Published", targetType: "document", targetId: "136", targetTitle: "C1010 3D Coordination Views (L## - A), Parts & QA", note: "Added mandatory Create Parts workflow & Wood/Metal Redmine QA checklists", at: "2026-10-20" },
  { id: "act-4", actor: "Iryna P.", action: "Published", targetType: "document", targetId: "131", targetTitle: "CL-RFI L##.4, Studs/Backing Layout & Parking Control", note: "Linked Parking Control Google Doc & RCP device sync rules", at: "2026-10-20" },
];

export const DEFAULT_URLS = {
  Redmine: "https://www.redmine.org",
  Jira: "https://www.atlassian.com/software/jira",
  Contacts: "https://contacts.google.com",
};
