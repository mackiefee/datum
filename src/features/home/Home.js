import { html, useState, useEffect, useRef } from '../../lib/react.js';
import { DC, TODAY, can, normRole, CITE } from '../../config/constants.js';
import { buildFlat } from '../../data/spaces.js';
import { edgeClient } from '../../lib/edgeClient.js';
import { Ic } from '../../components/Icon.js';

export function Home(p) {
  const { res, tree, role, userName, pinned = [], cols = [], onOpenKit, onOpenAllKits } = p;
  const [q, setQ] = useState("");
  const [ans, setAns] = useState(null);
  const ref = useRef(null);

  const flatCats = buildFlat(tree);
  const allowedCats = flatCats.filter((c) => can.viewCat(c, role, userName)).map((c) => c.id);

  const visibleKits = cols.filter((c) => {
    if (c.tier !== "official" && c.tier !== "shared") return false;
    const r = normRole(role);
    if (r === "SuperAdmin" || r === "Admin") return true;
    if (r === "Guest") return c.vis === "Public";
    if (c.vis === "Restricted") return c.owner === userName || (c.coEditors || []).includes(userName);
    return true;
  });

  const run = async (question) => {
    const t = question.trim();
    if (!t) return;
    setAns({ q: t, src: [], text: "", busy: true });
    const out = await edgeClient.ai({
      action: "qa",
      query: t,
      userRole: role,
      userName,
      allowedCategories: allowedCats,
      items: res,
      today: TODAY,
    });
    setAns({
      q: t,
      src: out.sources || [],
      text: out.answer || "",
      busy: false,
    });
  };

  useEffect(() => {
    p.focus && ref.current && ref.current.focus();
  }, [p.focus]);

  useEffect(() => {
    if (p.aq) {
      setQ(p.aq.q);
      run(p.aq.q);
    }
  }, [p.aq]);

  const hr = new Date().getHours();
  const hi = hr < 5 ? "Good night" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
  const nd = new Date();
  const wd = nd.toLocaleDateString("en-US", { weekday: "long" });
  const dt = wd.charAt(0).toUpperCase() + wd.slice(1) + ", " + nd.toLocaleDateString("en-US", { day: "numeric", month: "long" });

  const officialHighlights = res.filter((r) => r.status === "Approved" && (r.id === 100 || r.id === 9 || r.id === 1)).slice(0, 3);
  const pinnedItems = pinned
    .map((id) => res.find((r) => r.id === id))
    .filter((r) => r && !officialHighlights.some((o) => o.id === r.id))
    .slice(0, 6);

  return html`<div className="home">
    <div className="crumb">${dt}</div>
    <h1>${hi}, ${userName}</h1>

    ${(officialHighlights.length > 0 || pinnedItems.length > 0) &&
    html`<div className="pdl-pin">
      ${officialHighlights.length > 0 && html`<span className="pdl-pin-lbl">Highlights</span>`}
      ${officialHighlights.map(
        (r) => html`<button key=${"ann-" + r.id} className="src" onClick=${() => (r.url && r.type === "service" ? window.open(r.url, "_blank", "noopener") : p.read(r.id))}>
          <b style=${{ background: DC[r.disc] }}><${Ic} n=${r.type} s=${12} /></b>
          <span>${r.title}</span>
        </button>`
      )}
      ${officialHighlights.length > 0 && pinnedItems.length > 0 && html`<span className="pdl-pin-sep" aria-hidden="true"></span>`}
      ${pinnedItems.length > 0 && html`<span className="pdl-pin-lbl">Pinned</span>`}
      ${pinnedItems.map(
        (r) => html`<button key=${"pin-" + r.id} className="src" onClick=${() => p.read(r.id)}>
          <b style=${{ background: "#bf5af2" }}><${Ic} n="star" s=${12} f=${true} /></b>
          <span>${r.title}</span>
        </button>`
      )}
    </div>`}

    <div className="askc">
      <div className="askr">
        <${Ic} n="spark" s=${20} />
        <input
          ref=${ref}
          value=${q}
          onChange=${(e) => setQ(e.target.value)}
          onKeyDown=${(e) => e.key === "Enter" && run(q)}
          placeholder="Ask the library (Published & permitted sources only): how should model files be named?"
        />
        <button className="btn p" onClick=${() => run(q)}>Ask</button>
      </div>
      ${!ans &&
      html`<div className="row" style=${{ marginTop: 12 }}>
        ${["How should model files be named?", "When is clash detection run?", "What is the BEP template?"].map(
          (x) => html`<button
            key=${x}
            className="chip"
            onClick=${() => {
              setQ(x);
              run(x);
            }}
          >
            ${x}
          </button>`
        )}
      </div>`}

      ${ans &&
      html`<div className="ans" style=${{ position: "relative" }}>
        <button className="x" style=${{ top: 10, right: 0 }} aria-label="Clear answer" onClick=${() => setAns(null)}>
          <${Ic} n="x" s=${13} />
        </button>
        <div className="aq" style=${{ paddingRight: 36 }}>${ans.q}</div>
        ${ans.busy && !ans.text
          ? html`<div className="dots"><i></i><i></i><i></i></div>`
          : html`<p>${ans.text.split(CITE).map((x, i) => (i % 2 ? html`<sup key=${i}>[${x}]</sup>` : x))}</p>`}
        <div className="srcs">
          ${ans.src.map(
            (s) => html`<button key=${s.id} className="src" onClick=${() => p.read(s.id)}>
              <b>${s.index}</b>
              <span>${s.title}${s.stale ? " (Needs review)" : ""}</span>
            </button>`
          )}
        </div>
      </div>`}
    </div>

    ${visibleKits.length > 0 &&
    html`<section className="home-kits-sec">
      <div className="home-kits-head">
        <div>
          <h2>Starter Kits & Playbooks</h2>
          <p>Curated standard sets for onboarding, project kickoff, and QA gates.</p>
        </div>
        ${onOpenAllKits &&
        html`<button type="button" className="btn sm" onClick=${onOpenAllKits}>
          All Kits (${visibleKits.length})
        </button>`}
      </div>
      <div className="home-kits-grid">
        ${visibleKits.slice(0, 3).map((c) => {
          const isOfficial = c.tier === "official";
          const count = (c.items || []).length;
          return html`<button
            key=${c.id}
            type="button"
            className="home-kit-card"
            onClick=${() => onOpenKit && onOpenKit(c.id)}
          >
            <div className="home-kit-top">
              <span className="pill" style=${{ "--c": isOfficial ? "#0a84ff" : "#34c759" }}>
                ${isOfficial ? "Official" : "Shared"}
              </span>
              <span className="pdl-cnt">${count} ${count === 1 ? "item" : "items"}</span>
            </div>
            <h3>${c.name}</h3>
            <p>${c.desc || "Curated resource and standard kit."}</p>
          </button>`;
        })}
      </div>
    </section>`}
  </div>`;
}
