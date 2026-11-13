import { html, useState, useEffect } from '../../lib/react.js';
import { DC } from '../../config/constants.js';
import { fmt } from '../../utils/format.js';
import { Ic } from '../../components/Icon.js';
import { BC, bbox, anc, bez } from './boardUtils.js';

export function BoardsList(p){const [mn,setMn]=useState(null),[dl,setDl]=useState(false),[rn,setRn]=useState(null),[rv,setRv]=useState("");
useEffect(()=>{if(!mn)return;const c=()=>{setMn(null);setDl(false)};window.addEventListener("pointerdown",c);return()=>window.removeEventListener("pointerdown",c)},[mn]);
const RS=Object.fromEntries(p.res.map(r=>[r.id,r]));
const pv=b=>{if(!b.nodes.length)return html`<span className="bpe"><${Ic} n="boards" s=${30}/><small>Empty board</small></span>`;
const P={};b.nodes.forEach(n=>P[n.id]=n);const B=bbox(b.nodes),m=50;
return html`<svg className="pv" viewBox=${[B.x0-m,B.y0-m,B.w+2*m,B.h+2*m].join(" ")} preserveAspectRatio="xMidYMid meet">${b.edges.map(e=>{const a=P[e.a],c=P[e.b];if(!a||!c)return null;const[st,t,d]=anc(a,c);return html`<path key=${e.id} d=${bez(st,t,d)} fill="none" style=${{stroke:"var(--sub)",strokeOpacity:.5}} strokeWidth="4" strokeLinecap="round" strokeDasharray=${e.dash?"10 10":""}/>`})}${b.nodes.map(n=>{const r=n.t==="res"?RS[n.rid]:null,col=r?DC[r.disc]:BC[n.c||0];
if(n.t==="res"||n.t==="folder"){const cy=n.y+n.h/2,tw=n.w-86;return html`<g key=${n.id}><rect x=${n.x} y=${n.y} width=${n.w} height=${n.h} rx="20" style=${{fill:"var(--surface)",stroke:"var(--line)"}} strokeWidth="2"/><rect x=${n.x+14} y=${cy-19} width="38" height="38" rx="12" fill=${col}/><rect x=${n.x+64} y=${cy-12} width=${tw*.85} height="9" rx="4.5" style=${{fill:"var(--text)",fillOpacity:.55}}/><rect x=${n.x+64} y=${cy+6} width=${tw*.5} height="7" rx="3.5" style=${{fill:"var(--sub)",fillOpacity:.4}}/></g>`}
if(n.t==="note")return html`<rect key=${n.id} x=${n.x} y=${n.y} width=${n.w} height=${n.h} rx="18" fill=${col} fillOpacity=".22" stroke=${col} strokeOpacity=".5" strokeWidth="2.5"/>`;
return html`<rect key=${n.id} x=${n.x} y=${n.y} width=${n.w} height=${n.h} rx="22" fill=${col} fillOpacity=".16" stroke=${col} strokeWidth="3"/>`})}</svg>`};
const sorted=[...p.boards].sort((a,b)=>b.at-a.at);
const commit=b=>{const v=rv.trim();if(v&&v!==b.name)p.ren(b.id,v);setRn(null)};
return html`<div><p className="lead">Visualize dependencies between articles, processes and teams.</p>
<div className="btns"><button className="btn p" onClick=${()=>p.add({id:"b"+Date.now(),name:"New board",at:Date.now(),nodes:[],edges:[],vp:null})}><${Ic} n="plus" s=${15}/> New board</button><button className="btn" onClick=${p.lib}><${Ic} n="graph" s=${15}/> Build from library</button></div>
${!sorted.length?html`<div className="empty"><${Ic} n="boards" s=${34}/><b>No boards yet</b><span>Create your first board or build it from the library links.</span></div>`:html`<div className="bl">${sorted.map((b,i)=>html`<div key=${b.id} className="bcard" style=${{animationDelay:Math.min(i,8)*40+"ms"}} role="button" tabIndex="0" onClick=${()=>rn!==b.id&&p.open(b.id)} onKeyDown=${e=>e.key==="Enter"&&e.target===e.currentTarget&&p.open(b.id)}>
<div className="bprev">${pv(b)}</div>
<div className="bmeta">${rn===b.id?html`<input autoFocus value=${rv} aria-label="Board name" onClick=${e=>e.stopPropagation()} onChange=${e=>setRv(e.target.value)} onBlur=${()=>commit(b)} onKeyDown=${e=>{if(e.key==="Enter")commit(b);if(e.key==="Escape")setRn(null)}}/>`:html`<b>${b.name||"Untitled"}</b>`}<small>${b.nodes.length} objects, ${b.edges.length} links · ${fmt(new Date(b.at).toISOString().slice(0,10))}</small></div>
<button className=${"bmn bgl"+(mn===b.id?" on":"")} aria-label="Board actions" aria-haspopup="menu" onPointerDown=${e=>e.stopPropagation()} onClick=${e=>{e.stopPropagation();setDl(false);setMn(mn===b.id?null:b.id)}}><${Ic} n="more" s=${17}/></button>
${mn===b.id&&html`<div className="bpop bgl" role="menu" onPointerDown=${e=>e.stopPropagation()} onClick=${e=>e.stopPropagation()}><button role="menuitem" onClick=${()=>{setMn(null);setRv(b.name||"");setRn(b.id)}}><${Ic} n="pencil" s=${16}/>Rename</button><button role="menuitem" onClick=${()=>{setMn(null);p.dup(b)}}><${Ic} n="dup" s=${16}/>Duplicate</button><hr/><button role="menuitem" className="dng" onClick=${()=>{if(dl){setMn(null);p.del(b.id)}else setDl(true)}}><${Ic} n="trash" s=${16}/>${dl?"Really delete?":"Delete"}</button></div>`}</div>`)}</div>`}</div>`}
