# Knowledge Library

Internal BIM Knowledge Library built with React 18, `htm`, and native ES Modules — zero build step required.

## Features

- **Home Dashboard**: AI-assisted Q&A search, Needs Attention tasks, What's New feed, Continue Reading progress, Standard File Name Generator, and CDE Pre-Publication Checklist.
- **Library & Spaces**: Hierarchical folder tree (`General`, `VDC`, `Structural`, `Interior`, `P&C`), status/type/stage/discipline/tag filtering, favorites, watched items, and command palette (`Cmd+K` / `Ctrl+K`).
- **Article Reader**: Scroll progress bar, sticky Table of Contents spy, full-screen image zoom, interactive checklists, and mandatory reading acknowledgements.
- **Notion-Style Block Editor**: WYSIWYG rich editor with `/` slash menu, inline markdown shortcuts (`**bold**`, `*italic*`, `` `code` ``, `~~strike~~`), floating selection toolbar, drag-and-drop block handles, tables, callouts, `.docx` import via Mammoth, and raw Markdown toggle.
- **Dependency Graph**: Force-directed Canvas 2D graph with local graph focus, physics controls, and node inspector.
- **Visual Link Boards**: Infinite canvas board editor with pan/zoom, snap guides, auto-layout, minimap, and SVG card previews.

## Project Structure

```text
├── index.html                  # Clean HTML shell & stylesheet/module entry
├── package.json                # Project metadata & dev server scripts
├── README.md                   # Documentation
└── src/
    ├── main.js                 # Application entry point
    ├── App.js                  # Root state, routing, and layout shell
    ├── lib/
    │   └── react.js            # React hooks + bound htm helper
    ├── config/
    │   └── constants.js        # Domain constants, statuses, roles & permissions
    ├── data/
    │   ├── spaces.js           # Space hierarchy & tree lookup helpers
    │   ├── templates.js        # Article templates & CDE checklist items
    │   └── seed.js             # Initial seed articles, teams & notifications
    ├── utils/
    │   ├── storage.js          # Safe localStorage wrapper
    │   ├── format.js           # Date formatting & pluralization helpers
    │   ├── markdown.js         # Markdown <-> HTML/DOM parser & serializer
    │   ├── search.js           # Local search ranker, summarizer & tag suggester
    │   └── docx.js             # Image resizer & Mammoth .docx importer
    ├── components/
    │   ├── Icon.js             # Unified SVG icon paths & <Ic /> component
    │   ├── Badge.js            # Status pill & @mention highlighter
    │   ├── SpaceTree.js        # Recursive sidebar space tree node
    │   ├── CommandPalette.js   # Quick-jump command palette modal
    │   ├── ResourceDrawer.js   # Resource metadata, versions, links & comments drawer
    │   └── AiDrawer.js         # Local Q&A assistant drawer
    ├── features/
    │   ├── home/               # Home dashboard, NameGen & PubList widgets
    │   ├── reader/             # Article reader view
    │   ├── editor/             # Notion-style WYSIWYG & Markdown editor
    │   ├── graph/              # Force-directed Canvas 2D dependency graph
    │   └── boards/             # Link boards gallery & infinite canvas editor
    └── styles/                 # Domain-scoped CSS stylesheets in cascade order
```

## Running Locally

Serve the project root with any static HTTP server:

```bash
npm start
# or
python -m http.server 8080
```

Then open [http://localhost:8080/index.html](http://localhost:8080/index.html).
