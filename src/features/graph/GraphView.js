import { html, useState, useMemo, useEffect, useRef } from '../../lib/react.js';
import { ST, TY, DISC, DC } from '../../config/constants.js';
import { ls } from '../../utils/storage.js';
import { fmt, gPl } from '../../utils/format.js';
import { Ic } from '../../components/Icon.js';
import { Pill } from '../../components/Badge.js';
import { GD, gHex, gTheme, gEngine, gHit, gTick, gFit, gInit, gZoom, gFocus, gAnim, gDraw, gCut } from './graphEngine.js';

export function Graph({res,selId,pick}){
const [S,setS]=useState(()=>({...GD,...(ls.get("kb2-gset")||{})})),[q,setQ]=useState(""),[sel,setSel]=useState(selId||null),[hov,setHov]=useState(null),[dg,setDg]=useState(false),[pn,setPn]=useState(false),[zm,setZm]=useState(100);
const wrap=useRef(null),cv=useRef(null),tip=useRef(null),pt=useRef({m:new Map(),mode:null,n:null}),E=useRef(null);if(!E.current)E.current=gEngine();
const up=(k,v)=>setS(s=>({...s,[k]:v})),setD=(d,on)=>setS(s=>({...s,hid:on?s.hid.filter(x=>x!==d):[...s.hid,d]}));
useEffect(()=>{ls.set("kb2-gset",S);E.current.S=S;E.current.dirty=true},[S]);
const graph=useMemo(()=>{const ids=new Map();const vis=res.filter(r=>!S.hid.includes(r.disc));vis.forEach(r=>ids.set(r.id,r));const em=new Map();
vis.forEach(r=>r.links.forEach(([to,k])=>{const t=ids.get(to);if(!t||to===r.id)return;const hard=k==="hard";if(hard?!S.hard:!S.soft)return;const key=r.id<to?r.id+"|"+to:to+"|"+r.id,o=em.get(key);
if(!o)em.set(key,{a:r.id,b:to,from:r.id,to,k:hard?"hard":"soft",both:false});else if(hard&&o.k==="soft"){o.k="hard";o.from=r.id;o.to=to}else if(hard&&o.k==="hard"&&o.from!==r.id)o.both=true}));
let edges=[...em.values()],nodes=vis;const adj=new Map();edges.forEach(e=>{(adj.get(e.a)||adj.set(e.a,[]).get(e.a)).push(e.b);(adj.get(e.b)||adj.set(e.b,[]).get(e.b)).push(e.a)});
if(!S.orph)nodes=nodes.filter(r=>adj.has(r.id));
if(S.loc&&sel&&ids.has(sel)){const keep=new Set([sel]);let fr=[sel];for(let d=0;d<S.dp;d++){const nx=[];fr.forEach(x=>(adj.get(x)||[]).forEach(y=>{if(!keep.has(y)){keep.add(y);nx.push(y)}}));fr=nx}nodes=nodes.filter(r=>keep.has(r.id))}
const ks=new Set(nodes.map(r=>r.id));return{nodes,edges:edges.filter(e=>ks.has(e.a)&&ks.has(e.b))}},[res,S.hid,S.hard,S.soft,S.orph,S.loc,S.dp,sel]);
const match=useMemo(()=>{const s=q.trim().toLowerCase();return s?res.filter(r=>(r.title+" "+r.desc+" "+(r.tags||[]).join(" ")+" "+r.disc).toLowerCase().includes(s)).map(r=>r.id):null},[q,res]);
const flyTo=id=>{const e=E.current,n=e.map.get(id);if(!n){e.fly=id;return}e.fly=null;const k=Math.max(e.tgt.k,1);e.tgt={k,x:-n.x*k+e.offx,y:-n.y*k};e.dirty=true};
const goTo=id=>{const r=res.find(x=>x.id===id);if(r&&S.hid.includes(r.disc))setD(r.disc,true);setSel(id);flyTo(id)};
useEffect(()=>{const e=E.current,old=e.map,map=new Map(),nodes=[],dg2=new Map();
graph.edges.forEach(x=>{dg2.set(x.a,(dg2.get(x.a)||0)+1);dg2.set(x.b,(dg2.get(x.b)||0)+1)});
if(!e.mctx)e.mctx=document.createElement("canvas").getContext("2d");const th=e.th||(wrap.current&&gTheme(wrap.current)),m=e.mctx;m.font="500 12px "+(th?th.font:"sans-serif");const m6=m;
graph.nodes.forEach((r,i)=>{let n=old.get(r.id);if(!n){const nb=graph.edges.find(x=>(x.a===r.id&&old.has(x.b))||(x.b===r.id&&old.has(x.a)));let bx,by,rd;
if(nb){const o=old.get(nb.a===r.id?nb.b:nb.a);bx=o.x;by=o.y;rd=46}else{bx=0;by=0;rd=30*Math.sqrt(i+1)}const an=nb?Math.random()*6.283:i*2.399963;
n={id:r.id,x:bx+Math.cos(an)*rd,y:by+Math.sin(an)*rd,vx:0,vy:0,fx:null,fy:null,hl:1,sr:0,hv:0}}
n.deg=dg2.get(r.id)||0;n.r=(4+S.ns*9)*(.78+.2*Math.sqrt(n.deg));n.disc=r.disc;n.col=gHex(DC[r.disc]);n.title=r.title;n.tl=gCut(m6,r.title,170);n.tf=gCut(m6,r.title,280);n.bw=Math.max(n.r*2,m6.measureText(n.tl).width)+14;n.bh=n.r*2+30;map.set(r.id,n);nodes.push(n)});
e.map=map;e.nodes=nodes;e.adj=new Map();
e.edges=graph.edges.map(x=>{const s=map.get(x.a),t=map.get(x.b);(e.adj.get(x.a)||e.adj.set(x.a,new Set()).get(x.a)).add(x.b);(e.adj.get(x.b)||e.adj.set(x.b,new Set()).get(x.b)).add(x.a);return{s,t,from:x.from,to:x.to,k:x.k,both:x.both,hot:0,bias:s.deg/(s.deg+t.deg)}});
const key=nodes.map(n=>n.id).join(",");if(e.inited){e.alpha=Math.max(e.alpha,.55);if(key!==e.key)e.refit=50}e.key=key;
if(e.fly&&map.has(e.fly))flyTo(e.fly);gFocus(e);gInit(e);e.dirty=true},[graph,S.ns]);
useEffect(()=>{const e=E.current;e.alpha=Math.max(e.alpha,.45)},[S.cf,S.rf,S.lf,S.ld]);
useEffect(()=>{const e=E.current;e.match=match?new Set(match):null;gFocus(e)},[match]);
useEffect(()=>{const e=E.current;e.sel=sel;e.offx=sel&&window.innerWidth>900?170:0;gFocus(e)},[sel]);
useEffect(()=>{const e=E.current,w=wrap.current,c=cv.current;e.ctx=c.getContext("2d");e.th=gTheme(w);
const mq=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)");e.reduce=!!(mq&&mq.matches);
const resize=()=>{const r=w.getBoundingClientRect(),d=Math.min(window.devicePixelRatio||1,2.5);e.dpr=d;e.w=r.width;e.h=r.height;c.width=Math.round(r.width*d);c.height=Math.round(r.height*d);gInit(e);e.dirty=true};
const ro=new ResizeObserver(resize);ro.observe(w);resize();
const th=()=>{e.th=gTheme(w);e.dirty=true},mo=new MutationObserver(th);mo.observe(document.documentElement,{attributes:true,attributeFilter:["data-theme","class"]});
const dm=window.matchMedia&&matchMedia("(prefers-color-scheme: dark)");dm&&dm.addEventListener&&dm.addEventListener("change",th);
const wh=ev=>{ev.preventDefault();const r=c.getBoundingClientRect(),dy=ev.deltaMode===1?ev.deltaY*16:ev.deltaY;gZoom(e,ev.clientX-r.left,ev.clientY-r.top,Math.exp(-dy*(ev.ctrlKey?.01:.0018)))};
c.addEventListener("wheel",wh,{passive:false});
let raf=0,lz=100;const loop=()=>{if(e.alpha>.0015||e.target>0){gTick(e);e.dirty=true}
if(e.refit>0&&--e.refit===0)gFit(e,false);gAnim(e);const z=Math.round(e.view.k*100);if(z!==lz){lz=z;setZm(z)}
if(e.dirty){e.dirty=false;gDraw(e)}raf=requestAnimationFrame(loop)};loop();
return()=>{cancelAnimationFrame(raf);ro.disconnect();mo.disconnect();dm&&dm.removeEventListener&&dm.removeEventListener("change",th);c.removeEventListener("wheel",wh)}},[]);
const loc=ev=>{const r=cv.current.getBoundingClientRect();return[ev.clientX-r.left,ev.clientY-r.top]};
const onDown=ev=>{const e=E.current,p=pt.current,[x,y]=loc(ev);wrap.current.focus({preventScroll:true});cv.current.setPointerCapture(ev.pointerId);p.m.set(ev.pointerId,[x,y]);
if(p.m.size===2){const[a,b]=[...p.m.values()];p.mode="pinch";p.pd=Math.hypot(a[0]-b[0],a[1]-b[1]);p.pc=[(a[0]+b[0])/2,(a[1]+b[1])/2];if(p.n){p.n.fx=null;p.n.fy=null;e.target=0}p.n=null;return}
const n=gHit(e,x,y);p.sx=p.lx=x;p.sy=p.ly=y;p.moved=false;
if(n){p.mode="node";p.n=n;e.target=.3;n.fx=n.x;n.fy=n.y;e.hov=n.id;gFocus(e);setHov(n.id)}else{p.mode="pan";p.n=null;cv.current.style.cursor="grabbing"}};
const onMove=ev=>{const e=E.current,p=pt.current,[x,y]=loc(ev);
if(p.m.has(ev.pointerId)){p.m.set(ev.pointerId,[x,y]);
if(p.mode==="pinch"&&p.m.size>=2){const[a,b]=[...p.m.values()],d=Math.hypot(a[0]-b[0],a[1]-b[1]),c2=[(a[0]+b[0])/2,(a[1]+b[1])/2];
gZoom(e,c2[0],c2[1],d/(p.pd||d));e.tgt.x+=c2[0]-p.pc[0];e.tgt.y+=c2[1]-p.pc[1];e.view={...e.tgt};p.pd=d;p.pc=c2;return}
if(p.mode){if(!p.moved&&Math.hypot(x-p.sx,y-p.sy)>4){p.moved=true;if(p.mode==="node")setDg(true)}
if(p.moved&&p.mode==="node"){const k=e.view.k;p.n.fx=(x-e.w/2-e.view.x)/k;p.n.fy=(y-e.h/2-e.view.y)/k;e.dirty=true}
else if(p.moved&&p.mode==="pan"){const dx=x-p.lx,dy=y-p.ly;e.view.x+=dx;e.view.y+=dy;e.tgt.x+=dx;e.tgt.y+=dy;e.dirty=true}
p.lx=x;p.ly=y}return}
if(ev.pointerType!=="mouse")return;const n=gHit(e,x,y),id=n?n.id:null;
if(id!==e.hov){e.hov=id;gFocus(e);setHov(id);cv.current.style.cursor=n?"pointer":"grab"}
const t=tip.current,W=e.w;e.mt="translate("+Math.min(x+16,W-250)+"px,"+(y+18>e.h-96?y-84:y+18)+"px)";if(t)t.style.transform=e.mt};
const onUp=ev=>{const e=E.current,p=pt.current;p.m.delete(ev.pointerId);
if(p.mode==="pinch"){if(p.m.size<2)p.mode=null;return}
if(p.mode==="node"){const n=p.n;n.fx=null;n.fy=null;e.target=0;if(!p.moved)setSel(n.id);e.hov=null;gFocus(e);setHov(null);setDg(false)}
else if(p.mode==="pan"){cv.current.style.cursor="grab";if(!p.moved)setSel(null)}
p.mode=null;p.n=null};
const onLeave=ev=>{const e=E.current;if(pt.current.mode||ev.pointerType!=="mouse")return;e.hov=null;gFocus(e);setHov(null)};
const onKey=ev=>{if(ev.target.tagName==="INPUT")return;const e=E.current;
if(ev.key==="Escape"){if(pn)setPn(false);else if(sel)setSel(null)}
else if(ev.key==="0")gFit(e,false);else if(ev.key==="+"||ev.key==="=")gZoom(e,e.w/2,e.h/2,1.3);else if(ev.key==="-")gZoom(e,e.w/2,e.h/2,1/1.3)};
const zin=f=>{const e=E.current;gZoom(e,e.w/2,e.h/2,f)};
const relayout=()=>{const e=E.current;e.nodes.forEach((n,i)=>{const a=i*2.399963,r=30*Math.sqrt(i+1);n.x=Math.cos(a)*r;n.y=Math.sin(a)*r;n.vx=n.vy=0});e.alpha=1;e.refit=110;e.dirty=true};
const sr=sel&&res.find(r=>r.id===sel),hn=hov&&res.find(r=>r.id===hov);
const outL=sr?sr.links.map(l=>({r:res.find(x=>x.id===l[0]),k:l[1]})).filter(x=>x.r):[],inL=sr?res.flatMap(r=>r.links.filter(l=>l[0]===sr.id).map(l=>({r,k:l[1]}))):[];
const Tg=(l,k)=>html`<button className=${"gx-row"+(S[k]?" on":"")} role="switch" aria-checked=${!!S[k]} onClick=${()=>up(k,!S[k])}><span>${l}</span><i className="gx-sw"><b></b></i></button>`;
const Rg=(l,k)=>html`<label className="gx-row"><span>${l}</span><input className="gx-rg" type="range" min="0" max="1" step=".01" value=${S[k]} style=${{"--p":S[k]*100+"%"}} onChange=${e=>up(k,+e.target.value)}/></label>`;
const Ch=d=>{const on=!S.hid.includes(d);return html`<button key=${d} className=${"gx-c"+(on?"":" off")} style=${{"--c":DC[d]}} aria-pressed=${on} onClick=${()=>setD(d,!on)}><i></i>${d}</button>`};
const Rows=(t,L)=>L.length?html`<div className="gx-lt">${t}</div>${L.map(x=>html`<button key=${x.r.id+x.k} className="gx-lr" onClick=${()=>goTo(x.r.id)}><i style=${{background:DC[x.r.disc]}}></i><span>${x.r.title}</span><em>${x.k==="hard"?"hard":"soft"}</em></button>`)}`:null;
const cnt=d=>res.filter(r=>r.disc===d).length;
return html`<div className="gx" ref=${wrap} tabIndex="0" role="application" aria-label="Dependency graph" onKeyDown=${onKey}>
<canvas ref=${cv} onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp} onPointerLeave=${onLeave} onDoubleClick=${ev=>{const n=gHit(E.current,...loc(ev));if(n)pick(n.id)}}></canvas>
<ul className="gx-sr">${graph.nodes.map(r=>html`<li key=${r.id}><button onClick=${()=>goTo(r.id)}>${r.title}, ${r.disc}</button></li>`)}</ul>
<div className="gx-top">
<div className="gx-g gx-s"><${Ic} n="search" s=${16}/><input value=${q} placeholder="Find in graph" aria-label="Search in graph" onChange=${e=>setQ(e.target.value)} onKeyDown=${e=>{if(e.key==="Escape"){setQ("");e.target.blur()}if(e.key==="Enter"&&match&&match.length)goTo(match[0])}}/>${match&&html`<span className="gx-n">${match.length}</span>`}${q&&html`<button className="gx-x" aria-label="Clear" onClick=${()=>setQ("")}><${Ic} n="x" s=${13}/></button>`}</div>
<div className="gx-g gx-chip">${gPl(graph.nodes.length,["node","nodes","nodes"])} · ${gPl(graph.edges.length,["link","links","links"])}</div>
<div className="gx-sp"></div>
${S.loc&&sr&&html`<button className="gx-g gx-chip gx-lc" onClick=${()=>up("loc",false)}><${Ic} n="target" s=${14}/>Local graph · ${S.dp}<${Ic} n="x" s=${12}/></button>`}
<button className=${"gx-g gx-ib"+(pn?" on":"")} aria-label="Graph settings" aria-expanded=${pn} onClick=${()=>setPn(!pn)}><${Ic} n="sliders" s=${18}/></button>
</div>
${sr&&html`<div className="gx-g gx-in" key=${sr.id}>
<div className="gx-ih"><span className="gx-tl" style=${{"--c":DC[sr.disc]}}><${Ic} n=${sr.type} s=${19}/></span><span className="gx-who"><b>${sr.disc}</b><small>${TY[sr.type]}</small></span><button className="gx-x" aria-label="Close" onClick=${()=>setSel(null)}><${Ic} n="x" s=${15}/></button></div>
<h3>${sr.title}</h3><p>${sr.desc}</p>
<div className="gx-meta"><${Pill} s=${sr.status}/><span>v${sr.v.length}</span><span>${fmt(sr.upd)}</span></div>
<div className="gx-stt"><div><b>${outL.length}</b><small>Depends on</small></div><div><b>${inL.length}</b><small>Used in</small></div></div>
<div className="gx-sc">${Rows("Depends on",outL)}${Rows("Used in",inL)}</div>
<div className="gx-act"><button className="btn p" onClick=${()=>pick(sr.id)}>Open</button><button className=${"btn"+(S.loc?" on":"")} onClick=${()=>up("loc",!S.loc)}><${Ic} n="target" s=${15}/> Local graph</button></div></div>`}
<div className=${"gx-g gx-pn"+(pn?" open":"")} aria-hidden=${!pn}>
<div className="gx-ph"><b>Settings</b><button onClick=${()=>setS(GD)}>Reset</button></div>
<div className="gx-h">Filters</div><div className="gx-grp">${Tg("Hard dependencies","hard")}${Tg("Soft links","soft")}${Tg("No links","orph")}<div className="gx-chips">${DISC.map(Ch)}</div></div>
<div className="gx-h">Local graph</div><div className="gx-grp">${Tg("Only around selected","loc")}<div className="gx-row"><span>Depth</span><div className="gx-seg">${[1,2,3].map(d=>html`<button key=${d} className=${S.dp===d?"on":""} onClick=${()=>up("dp",d)}>${d}</button>`)}</div></div></div>
<div className="gx-h">Display</div><div className="gx-grp">${Tg("Direction arrows","arrows")}${Rg("Labels","lbl")}${Rg("Node size","ns")}${Rg("Line thickness","lw")}</div>
<div className="gx-h">Forces</div><div className="gx-grp">${Rg("Center","cf")}${Rg("Repulsion","rf")}${Rg("Link strength","lf")}${Rg("Link length","ld")}<button className="gx-row gx-lk" onClick=${relayout}>Re-layout</button></div></div>
<div className="gx-g gx-lg">${DISC.map(d=>{const on=!S.hid.includes(d);return html`<button key=${d} className=${"gx-c"+(on?"":" off")} style=${{"--c":DC[d]}} aria-pressed=${on} onClick=${()=>setD(d,!on)}><i></i>${d}<small>${cnt(d)}</small></button>`})}</div>
<div className="gx-g gx-zm"><button className="gx-ib" aria-label="Zoom out" onClick=${()=>zin(1/1.3)}><${Ic} n="minus" s=${16}/></button><span>${zm}%</span><button className="gx-ib" aria-label="Zoom in" onClick=${()=>zin(1.3)}><${Ic} n="plus" s=${16}/></button><i className="gx-vr"></i><button className="gx-ib" aria-label="Fit all" onClick=${()=>gFit(E.current,false)}><${Ic} n="fit" s=${17}/></button></div>
${hn&&!dg&&html`<div className="gx-g gx-tip" ref=${el=>{tip.current=el;if(el)el.style.transform=E.current.mt}}><b>${hn.title}</b><small>${hn.disc} · ${TY[hn.type]}</small><span className="gx-st" style=${{"--c":ST[hn.status][1]}}>${ST[hn.status][0]}</span></div>`}
${!graph.nodes.length&&html`<div className="gx-em"><${Ic} n="graph" s=${34}/><b>No nodes</b><span>Nothing to show with the current filters.</span><button className="btn" onClick=${()=>setS(GD)}>Reset settings</button></div>`}
</div>`}
