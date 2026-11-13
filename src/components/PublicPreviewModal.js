import { html, useState } from '../lib/react.js';
import { md } from '../utils/markdown.js';
import { fmt } from '../utils/format.js';
import { Ic } from './Icon.js';

export function PublicPreviewModal({ target, res, imgs, close }) {
  const [selectedDocId, setSelectedDocId] = useState(
    target.kind === "item" ? target.data.id : target.data.items?.[0]?.id || null
  );

  if (!target) return null;

  const isCollection = target.kind === "collection";
  const colItems = isCollection
    ? (target.data.items || [])
        .map((x) => res.find((r) => r.id === x.id))
        .filter((r) => r && r.status === "Approved" && r.vis === "Public")
    : [];

  const activeItem =
    target.kind === "item"
      ? target.data
      : colItems.find((r) => r.id === selectedDocId) || colItems[0] || null;

  // Sanitize body: omit attachments not explicitly cleared in publicAttachments
  const sanitizedBody = activeItem
    ? (activeItem.body || "").replace(/!\[([^\]]*)\]\(img:(\w+)\)/g, (full, caption, id) =>
        (activeItem.publicAttachments || []).includes(id)
          ? full
          : `> [!note] Attachment omitted on external view (${caption || id})`
      )
    : "";

  const rendered = activeItem ? md(sanitizedBody, imgs, []) : { h: "" };
  const activeLinks = activeItem
    ? (activeItem.links || [])
        .map(([tid, kind]) => {
          const t = res.find((x) => x.id === tid);
          return t ? { ...t, kind, isPublic: t.vis === "Public" && t.status === "Approved" } : null;
        })
        .filter(Boolean)
    : [];

  return html`<div className="pdl-pub" role="dialog" aria-modal="true" aria-label="Public External Portal Preview">
    <div className="pdl-pub-in">
      <div className="bar sc" style=${{ borderRadius: 20, marginBottom: 24, border: "1px solid var(--line)", padding: "10px 18px" }}>
        <div className="logo" style=${{ padding: 0 }}><i><${Ic} n="globe" s=${16} /></i>Planit Public Portal</div>
        <span className="pill" style=${{ "--c": "#34c759" }}>Sanitized External View</span>
        <span style=${{ marginLeft: "auto" }}></span>
        <button className="btn p" onClick=${close}><${Ic} n="x" s=${14} /> Exit Preview</button>
      </div>

      ${isCollection &&
      html`<div className="hc" style=${{ marginBottom: 20 }}>
        <h2>${target.data.name}</h2>
        <p className="lead sm">${target.data.desc}</p>
        <div className="btns" style=${{ margin: "12px 0 0" }}>
          ${colItems.length
            ? colItems.map(
                (item) => html`<button
                  key=${item.id}
                  className=${"btn" + (activeItem && activeItem.id === item.id ? " p" : "")}
                  onClick=${() => setSelectedDocId(item.id)}
                >
                  ${item.title}
                </button>`
              )
            : html`<p className="lead sm">No Public + Approved items inside this collection yet.</p>`}
        </div>
      </div>`}

      ${activeItem
        ? html`<article className="hc" style=${{ padding: 32 }}>
            <div className="crumb">Planit Data Library · Public Release · Updated ${fmt(activeItem.upd)}</div>
            <h1 style=${{ marginTop: 8 }}>${activeItem.title}</h1>
            <p className="lead" style=${{ marginBottom: 22 }}>${activeItem.desc}</p>
            ${activeItem.url &&
            html`<div className="btns"><a className="btn p" href=${activeItem.url} target="_blank" rel="noopener noreferrer"><${Ic} n="openx" s=${15} /> Open External Resource</a></div>`}
            <div className="prose" dangerouslySetInnerHTML=${{ __html: rendered.h }}></div>

            ${activeLinks.length > 0 &&
            html`<div className="box" style=${{ marginTop: 28 }}>
              <b>Referenced Materials (Internal links automatically sanitized)</b>
              ${activeLinks.map((lnk) =>
                lnk.isPublic
                  ? html`<div key=${lnk.id} style=${{ marginTop: 6 }}>
                      <button className="mn" onClick=${() => isCollection && setSelectedDocId(lnk.id)}>${lnk.title} (Public)</button>
                    </div>`
                  : html`<div key=${lnk.id} style=${{ marginTop: 6, color: "var(--sub)" }}>
                      ${lnk.title} — <i>Internal reference only (link disabled for external viewers)</i>
                    </div>`
              )}
            </div>`}

            <div className="row" style=${{ marginTop: 24, fontSize: 12 }}>
              Comments, @mentions, version history, and unapproved attachments are automatically stripped from this external view.
            </div>
          </article>`
        : html`<div className="empty"><b>Nothing publicly visible</b><span>Only Published items marked Public appear here.</span></div>`}
    </div>
  </div>`;
}
