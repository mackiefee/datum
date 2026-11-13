import { html, useState, useEffect, useRef } from '../../lib/react.js';
import { DC, TODAY, can, CITE } from '../../config/constants.js';
import { byId, buildFlat } from '../../data/spaces.js';
import { fmt, days } from '../../utils/format.js';
import { edgeClient } from '../../lib/edgeClient.js';
import { Ic } from '../../components/Icon.js';
import { NameGen } from './NameGen.js';
import { PubList } from './PubList.js';

export function Home(p) {
  const { res, tree, role, userName, req, acks, hist, seen, pinned = [] } = p;
  const [q, setQ] = useState("");
  const [ans, setAns] = useState(null);
  const ref = useRef(null);

  const flatCats = buildFlat(tree);
  const allowedCats = flatCats.filter((c) => can.viewCat(c, role, userName)).map((c) => c.id);

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

  const need = [];
  req
    .filter((id) => !acks[id])
    .forEach((id) => {
      const r = res.find((x) => x.id === id);
      r && need.push({ r, tag: "Required", note: "Read and confirm", c: "#ff3b30" });
    });

  res
    .filter((r) => {
      if (r.status !== "Review") return false;
      const cat = byId(r.node, tree);
      return can.status(role, cat, userName);
    })
    .forEach((r) => need.push({ r, tag: "Approval", note: "Awaiting your decision", c: "#ff9f0a" }));

  res
    .filter((r) => {
      const cat = byId(r.node, tree);
      const cycle = (cat && cat.reviewDays) || 90;
      return r.status === "Approved" && days(r.verified || r.upd) > cycle && (can.admin(role) || r.author === userName || can.catOwner(cat, userName));
    })
    .slice(0, 3)
    .forEach((r) => need.push({ r, tag: "Revisit", note: "Not verified for " + days(r.verified || r.upd) + " d.", c: "#0a84ff" }));

  const nw = res.filter((r) => r.status === "Approved" && r.upd > seen).sort((a, b) => b.upd.localeCompare(a.upd)).slice(0, 5);
  const cont = hist
    .filter((h) => h.pct > 0.02 && h.pct < 0.97)
    .map((h) => ({ h, r: res.find((x) => x.id === h.id) }))
    .filter((x) => x.r)
    .slice(0, 3);

  const officialHighlights = res.filter((r) => r.status === "Approved" && (r.id === 100 || r.id === 9 || r.id === 1)).slice(0, 3);
  const pinnedItems = pinned
    .map((id) => res.find((r) => r.id === id))
    .filter((r) => r && !officialHighlights.some((o) => o.id === r.id))
    .slice(0, 6);

  const Row = (r, tag, note, c) =>
    html`<button key=${r.id + tag + note} className="hr" onClick=${() => p.read(r.id)}>
      <span className="tile sm" style=${{ "--c": DC[r.disc] }}><${Ic} n=${r.type} s=${14} /></span>
      <span className="t"><b>${r.title}</b><small>${note}</small></span>
      ${tag && html`<span className="pill" style=${{ "--c": c }}>${tag}</span>`}
    </button>`;

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
      ${pinnedItems.length > 0 && html`<span className="pdl-pin-lbl" style=${{ marginLeft: officialHighlights.length ? 6 : 0 }}>Pinned</span>`}
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

    <div className="hg">
      <section className="hc">
        <h3>Needs attention${need.length > 0 && html`<span className="bdg">${need.length}</span>`}</h3>
        ${need.length ? need.map((x) => Row(x.r, x.tag, x.note, x.c)) : html`<p className="lead sm">All caught up, no pending actions.</p>`}
      </section>
      <section className="hc">
        <h3>What’s new${nw.length > 0 && html`<button className="mn" onClick=${p.markSeen}>Mark all as seen</button>`}</h3>
        ${nw.length
          ? nw.map((r) => {
              const v = r.v[r.v.length - 1];
              return Row(r, "", v.by + ": " + v.note + " · " + fmt(r.upd), DC[r.disc]);
            })
          : html`<p className="lead sm">No updates since your last visit.</p>`}
      </section>
    </div>

    ${cont.length > 0 &&
    html`<div>
      <h2>Continue reading</h2>
      <div className="hg3">
        ${cont.map(
          ({ h, r }) => html`<button key=${r.id} className="hc rc" onClick=${() => p.read(r.id)}>
            <b>${r.title}</b>
            <small>${(byId(r.node, tree) && byId(r.node, tree).path.join(" › ")) || "Library"}</small>
            <span className="bar2"><i style=${{ width: Math.round(h.pct * 100) + "%" }}></i></span>
          </button>`
        )}
      </div>
    </div>`}

    <h2>Working tools</h2>
    <div className="hg">
      <section className="hc">
        <h3>Standard file name</h3>
        <p className="lead sm">Project, originator, volume, level, type, number.</p>
        <${NameGen} flash=${p.flash} />
      </section>
      <section className="hc">
        <h3>Pre-publication checklist for the CDE</h3>
        <p className="lead sm">Your ticks are saved.</p>
        <${PubList} />
      </section>
    </div>
  </div>`;
}
