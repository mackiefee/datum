import { html, useState } from '../lib/react.js';
import { TODAY, can } from '../config/constants.js';
import { buildFlat } from '../data/spaces.js';
import { edgeClient } from '../lib/edgeClient.js';
import { Ic } from './Icon.js';

export function AI({ res, tree, role, userName, close, pick }) {
  const [q, setQ] = useState("");
  const [a, setA] = useState(null);
  const [busy, setBusy] = useState(false);

  const allowedCats = buildFlat(tree)
    .filter((c) => can.viewCat(c, role, userName))
    .map((c) => c.id);

  const go = async (overrideQ) => {
    const query = (overrideQ !== undefined ? overrideQ : q).trim();
    if (!query) return;
    setBusy(true);
    const out = await edgeClient.ai({
      action: "qa",
      query,
      userRole: role,
      userName,
      allowedCategories: allowedCats,
      items: res,
      today: TODAY,
    });
    setA({ q: query, answer: out.answer, r: out.sources || [] });
    setBusy(false);
  };

  return html`<div>
    <div className="ov" onClick=${close}></div>
    <aside className="dr" role="dialog">
      <div className="dh">
        <button className="x" aria-label="Close" onClick=${close}>${html`<${Ic} n="x" s=${14} />`}</button>
        <div className="crumb">Edge AI Assistant</div>
        <h2>Ask the knowledge base</h2>
        <p className="lead" style=${{ fontSize: 15, marginBottom: 14 }}>
          Pre-filtered to Published items your role is permitted to access, with inline citations.
        </p>
      </div>
      <div className="db">
        <div style=${{ display: "flex", gap: 8 }}>
          <input
            className="inp"
            value=${q}
            onChange=${(e) => setQ(e.target.value)}
            onKeyDown=${(e) => e.key === "Enter" && go()}
            placeholder="E.g.: how to name files?"
            autoFocus
          />
          <button className="btn p" disabled=${busy} onClick=${() => go()}>${busy ? "…" : "Ask"}</button>
        </div>
        <div className="row" style=${{ margin: "12px 0" }}>
          ${["file naming", "clashes", "BEP template", "documentation issue"].map(
            (s) => html`<button
              key=${s}
              className="chip"
              onClick=${() => {
                setQ(s);
                go(s);
              }}
            >
              ${s}
            </button>`
          )}
        </div>
        ${a &&
        html`<div>
          <div className="box"><b>Answer</b>${a.answer}</div>
          ${a.r.map(
            (s) => html`<div className="box" key=${s.id}>
              <b>[${s.index}] ${s.title}${s.stale ? " · Needs review" : ""}</b>
              ${s.excerpt}
              <div style=${{ marginTop: 8 }}>
                <button className="mn" onClick=${() => pick(s.id)}>Open resource</button>
              </div>
            </div>`
          )}
        </div>`}
      </div>
    </aside>
  </div>`;
}
