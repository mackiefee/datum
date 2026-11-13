import { html } from '../lib/react.js';
import { ST, VIS } from '../config/constants.js';

export const Mn=({t})=>t.split(/(@[\p{L}.]+)/u).map((p,i)=>p[0]==="@"?html`<span key=${i} className="mn">${p}</span>`:p);
export const Pill=({s})=>html`<span className="pill" style=${{"--c":(ST[s]||ST.Draft)[1]}}>${(ST[s]||ST.Draft)[0]}</span>`;
export const VisPill=({v="Internal"})=>html`<span className="pill" style=${{"--c":(VIS[v]||VIS.Internal)[1]}}>${(VIS[v]||VIS.Internal)[0]}</span>`;

export function Avatar({ user, name, avatar, size = "" }) {
  const n = (user && user.name) || name || "U";
  const src = (user && user.avatar) || avatar || "";
  const cls = "av" + (size ? " " + size : "");
  const initial = n
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return html`<div className=${cls}>
    ${src ? html`<img src=${src} alt=${n} referrerPolicy="no-referrer" />` : initial}
  </div>`;
}
