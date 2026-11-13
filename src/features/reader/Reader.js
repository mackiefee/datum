import { html, useState, useMemo, useEffect } from '../../lib/react.js';
import { TY, DC, can, normRole } from '../../config/constants.js';
import { byId } from '../../data/spaces.js';
import { fmt, days } from '../../utils/format.js';
import { plain, md } from '../../utils/markdown.js';
import { Ic } from '../../components/Icon.js';
import { Pill, VisPill } from '../../components/Badge.js';

export function Reader(p) {
  const { r, res, imgs, tree, userName } = p;
  const isGuest = normRole(p.role) === "Guest";

  // In Guest view, strip attachments that are not cleared for public
  const bodyToRender = useMemo(() => {
    if (!isGuest) return r.body;
    return (r.body || "").replace(/!\[([^\]]*)\]\(img:(\w+)\)/g, (full, caption, id) =>
      (r.publicAttachments || []).includes(id) ? full : `> [!note] Internal attachment omitted (${caption || id})`
    );
  }, [r.body, isGuest, r.publicAttachments]);

  const m = useMemo(() => md(bodyToRender, imgs, p.chk[r.id]), [bodyToRender, imgs, p.chk, r.id]);
  const [pg, setPg] = useState(0);
  const [act, setAct] = useState("");
  const [zm, setZm] = useState(null);

  useEffect(() => {
    p.rec(r.id, pg);
  }, [r.id, Math.round(pg * 10)]);

  const min = Math.max(1, Math.round(plain(r.body).split(" ").length / 170));

  useEffect(() => {
    const f = () => {
      const d = document.documentElement;
      setPg(d.scrollTop / (d.scrollHeight - d.clientHeight || 1));
    };
    addEventListener("scroll", f, { passive: true });
    f();
    const k = (e) => {
      if (e.key === "Escape") {
        zm ? setZm(null) : p.back();
      }
    };
    document.addEventListener("keydown", k);
    return () => {
      removeEventListener("scroll", f);
      document.removeEventListener("keydown", k);
    };
  }, [r.id, zm]);

  useEffect(() => {
    const hs = [...document.querySelectorAll(".prose h1,.prose h2,.prose h3")];
    if (!hs.length) return;
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && setAct(e.target.id)),
      { rootMargin: "-90px 0px -65% 0px" }
    );
    hs.forEach((h) => io.observe(h));
    return () => io.disconnect();
  }, [m]);

  const cat = byId(r.node, tree);
  const reviewDays = (cat && cat.reviewDays) || 90;
  const ageDays = days(r.verified || r.upd);
  const isStale = ageDays > reviewDays;
  const canEditItem = can.edit(p.role, r, cat, userName);
  const canVerify = canEditItem || can.status(p.role, cat, userName);
  const canToggleReq = can.admin(p.role) || can.catOwner(cat, userName, p.role);

  // Pinpoint access rule: do not leak Restricted category name to users without category access
  const breadcrumb =
    cat && cat.vis === "Restricted" && !can.viewCat(cat, p.role, userName)
      ? "Restricted Space"
      : cat
      ? cat.path.join(" › ")
      : "Knowledge Library";

  const rel = res
    .filter((x) => x.id !== r.id && (x.node === r.node || x.tags.some((t) => r.tags.includes(t))))
    .slice(0, 4);

  const go = (id) => {
    const e = document.getElementById(id);
    e && e.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const TL = (t) =>
    html`<a key=${t.id} className=${(t.l === 3 ? "l3 " : "") + (act === t.id ? "on" : "")} onClick=${() => go(t.id)}>${t.t}</a>`;

  return html`<article className="rd">
    <div className="pg" style=${{ width: pg * 100 + "%" }}></div>
    <button className="back" onClick=${p.back}><${Ic} n="chev" s=${16} />Back</button>
    <header className="rdh">
      <div className="ch2" style=${{ paddingRight: 0, marginBottom: 16 }}>
        <span className="tl" style=${{ "--c": DC[r.disc] }}><${Ic} n=${r.type} s=${18} /></span>
        <span className="who"><b>${breadcrumb}</b><small>${TY[r.type] || "Document"}</small></span>
      </div>
      <h1>${r.title}</h1>
      <p className="lead">${r.desc}</p>
      <div className="row" style=${{ marginTop: 14 }}>
        <${Pill} s=${r.status} />
        <${VisPill} v=${r.vis || "Internal"} />
        <span>${r.author}</span>
        <span>Updated ${fmt(r.upd)}</span>
        <span>v${r.v.length}</span>
        <span>${min} min read</span>
        <span className=${isStale ? "stale" : "fresh"}>${isStale ? `Needs review (${ageDays}d)` : "Up to date"}</span>
        ${p.req.includes(r.id) && html`<span className="pill" style=${{ "--c": "#ff3b30" }}>Required</span>`}
      </div>

      ${r.status === "Archived" &&
      html`<div className="box" style=${{ marginTop: 14 }}>
        <b>Archived Content</b>This item is archived and kept only for historical reference. Verify with your Category Owner before using in active projects.
      </div>`}

      <div className="rd-actions">
        <div className="btns">
          ${r.url &&
          html`<a className="btn p" href=${r.url} target="_blank" rel="noopener noreferrer"><${Ic} n="openx" s=${15} /> Open Resource</a>`}
          ${canEditItem &&
          html`<button className=${r.url ? "btn" : "btn p"} onClick=${p.edit}><${Ic} n="pencil" s=${14} /> Edit</button>`}
          ${isStale &&
          canVerify &&
          p.onVerify &&
          html`<button className="btn" onClick=${() => p.onVerify(r.id)}><${Ic} n="check" s=${15} /> Verify Up to Date</button>`}
          ${!isGuest &&
          html`<button className="btn" onClick=${() => p.info(r.id)}><${Ic} n="layers" s=${14} /> History, links & access</button>`}
          ${r.vis === "Public" &&
          r.status === "Approved" &&
          p.onOpenPublic &&
          html`<button className="btn" onClick=${() => p.onOpenPublic({ kind: "item", data: r })}><${Ic} n="globe" s=${15} /> Public portal preview</button>`}
        </div>
        ${!isGuest &&
        html`<div className="btns">
          <button className=${"btn" + (p.fav ? " on" : "")} onClick=${() => p.tf(r.id)}><${Ic} n="star" s=${14} f=${p.fav} /> ${p.fav ? "In bookmarks" : "Bookmark"}</button>
          <button className=${"btn" + (p.watch ? " on" : "")} onClick=${() => p.tw(r.id)}><${Ic} n="eye" s=${14} /> ${p.watch ? "Watching" : "Watch"}</button>
          ${can.createDraft(p.role) &&
          p.onTogglePin &&
          html`<button className=${"btn" + (p.pinned ? " on" : "")} onClick=${() => p.onTogglePin(r.id)}><${Ic} n="target" s=${14} /> ${p.pinned ? "Pinned to Home" : "Pin to Home"}</button>`}
          ${canToggleReq &&
          html`<button className=${"btn" + (p.req.includes(r.id) ? " on" : "")} onClick=${() => p.togReq(r.id)}><${Ic} n="shield" s=${14} /> ${p.req.includes(r.id) ? "Required reading" : "Make required"}</button>`}
          ${p.onFlagOutdated &&
          html`<button className="btn warn" onClick=${() => p.onFlagOutdated(r.id)}><${Ic} n="clock" s=${14} /> Flag outdated</button>`}
        </div>`}
      </div>
    </header>

    <div className=${"rdl" + (m.toc.length > 1 ? "" : " one")}>
      <div>
        ${m.toc.length > 1 && html`<details className="mtoc"><summary>Contents</summary>${m.toc.map(TL)}</details>`}
        ${m.h
          ? html`<div
              className="prose"
              onClick=${(e) => {
                const t = e.target;
                if (t.tagName === "IMG") setZm(t.src);
                else {
                  const li = t.closest && t.closest("li.ck");
                  li && p.togChk(r.id, +li.dataset.k);
                }
              }}
              dangerouslySetInnerHTML=${{ __html: m.h }}
            ></div>`
          : html`<div className="empty"><b>Article is empty</b><span>Add text or resource usage notes in the editor.</span></div>`}

        ${!isGuest &&
        p.req.includes(r.id) &&
        html`<div className="ackb">
          ${p.acks[r.id]
            ? html`<span className="okk"><${Ic} n="check" s=${18} /> Read & confirmed ${fmt(p.acks[r.id])}</span>`
            : html`<span>This document is marked as mandatory reading.</span><button className="btn p" onClick=${() => p.ack(r.id)}>Confirm I have read it</button>`}
        </div>`}

        <div className="row" style=${{ marginTop: 32 }}>
          ${r.tags.map((t) => html`<span key=${t} className="pill" style=${{ background: "var(--fill)" }}>#${t}</span>`)}
        </div>

        ${rel.length > 0 &&
        html`<div>
          <h3 className="relh">See also</h3>
          ${rel.map(
            (x) => html`<div className="li" key=${x.id}>
              <i className="dd" style=${{ background: DC[x.disc] }}></i>
              <div className="t">
                <button onClick=${() => p.go(x.id)}>${x.title}</button>
                <small>${x.desc}</small>
              </div>
            </div>`
          )}
        </div>`}
      </div>
      ${m.toc.length > 1 && html`<nav className="toc" aria-label="Contents"><b>Contents</b>${m.toc.map(TL)}</nav>`}
    </div>
    ${zm && html`<div className="zoom" onClick=${() => setZm(null)}><img src=${zm} alt="" /></div>`}
  </article>`;
}
