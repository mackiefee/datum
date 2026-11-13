import { React, html, Fragment, useState, useEffect, useRef } from '../../lib/react.js';
import { DC } from '../../config/constants.js';
import { byId } from '../../data/spaces.js';
import { ls } from '../../utils/storage.js';
import { fmt } from '../../utils/format.js';
import { hay } from '../../utils/search.js';
import { Ic } from '../../components/Icon.js';
import { Pill } from '../../components/Badge.js';
import { BC, EC, NS, MIN, bbox, nid, sn, anc, bez, lay } from './boardUtils.js';

export function BoardEd(p){const {res}=p;
const [bd,setBd]=useState(p.b),[sel,setSel]=useState(null),[tool,setTool]=useState("v"),[ed,setEd]=useState(null),[pk,setPk]=useState(false),[pq,setPq]=useState(""),[vp,setVp]=useState(p.b.vp||{x:0,y:0,z:1}),[cn,setCn]=useState(null),[gd,setGd]=useState([]),[mq,setMq]=useState(null),[sz,setSz]=useState({w:1000,h:700}),[spc,setSpc]=useState(false),[pan,setPan]=useState(false),[drg,setDrg]=useState(false),[mm,setMm]=useState(()=>ls.get("kb2-mm")!==false),[hs,setHs]=useState([0,0]);
const cv=useRef(null),dr=useRef(null),past=useRef([]),fut=useRef([]),clip=useRef(null),ptr=useRef(new Map()),bdr=useRef(bd),vpr=useRef(vp);bdr.current=bd;vpr.current=vp;
const atR=useRef(p.b.at),sgR=useRef(JSON.stringify([p.b.nodes,p.b.edges,p.b.name]));
const stamp=()=>{const s=JSON.stringify([bdr.current.nodes,bdr.current.edges,bdr.current.name]);if(s!==sgR.current){sgR.current=s;atR.current=Date.now()}return atR.current};
useEffect(()=>{const t=setTimeout(()=>p.save({...bd,vp,at:stamp()}),500);return()=>clearTimeout(t)},[bd,vp]);
const back=()=>{p.save({...bdr.current,vp:vpr.current,at:stamp()});p.close()};
const ids=sel&&sel.k==="n"?sel.ids:[],setIds=a=>setSel(a.length?{k:"n",ids:a}:null);
const sync=()=>setHs([past.current.length,fut.current.length]);
const snap=()=>({nodes:bdr.current.nodes,edges:bdr.current.edges});
const rec=()=>{past.current.push(snap());if(past.current.length>80)past.current.shift();fut.current=[];sync()};
const up=fn=>{rec();setBd(b=>({...b,...fn(b)}))};
const undo=()=>{const x=past.current.pop();if(!x)return;fut.current.push(snap());setBd(b=>({...b,...x}));setSel(null);sync()};
const redo=()=>{const x=fut.current.pop();if(!x)return;past.current.push(snap());setBd(b=>({...b,...x}));setSel(null);sync()};
const rect=()=>cv.current.getBoundingClientRect();
const W=()=>{const r=rect();return[r.width/2,r.height/2]};
const ctr=()=>{const r=rect(),v=vpr.current;return[(r.width/2-v.x)/v.z,(r.height/2-v.y)/v.z]};
const zoom=(z,cx,cy)=>setVp(v=>{const nz=Math.min(3,Math.max(.1,z));return{z:nz,x:cx-(cx-v.x)*(nz/v.z),y:cy-(cy-v.y)*(nz/v.z)}});
const fit=()=>{const N=bdr.current.nodes,r=rect();if(!N.length){setVp({x:r.width/2,y:r.height/2,z:1});return}const B=bbox(N),z=Math.min(1.2,(r.width-160)/B.w,(r.height-260)/B.h);setVp({z,x:(r.width-B.w*z)/2-B.x0*z,y:(r.height-B.h*z)/2-B.y0*z-10})};
useEffect(()=>{if(!p.b.vp)setTimeout(fit,30);const el=cv.current,f=e=>{if(e.target.closest&&e.target.closest(".pkl"))return;e.preventDefault();const r=el.getBoundingClientRect();if(e.ctrlKey||e.metaKey)zoom(vpr.current.z*Math.exp(-e.deltaY*.012),e.clientX-r.left,e.clientY-r.top);else setVp(v=>({...v,x:v.x-e.deltaX,y:v.y-e.deltaY}))};el.addEventListener("wheel",f,{passive:false});const ro=new ResizeObserver(()=>{const r=el.getBoundingClientRect();setSz({w:r.width,h:r.height})});ro.observe(el);return()=>{el.removeEventListener("wheel",f);ro.disconnect()}},[]);
const add=o=>{const[w,h]=NS[o.t],c=ctr(),k=bdr.current.nodes.length%5*24,n={id:nid(),w,h,x:sn(c[0]-w/2+k),y:sn(c[1]-h/2+k),c:0,txt:"",...o};up(b=>({nodes:[...b.nodes,n]}));setIds([n.id]);return n};
const addText=(t,at)=>{const o={t,txt:t==="note"?"Note":t==="folder"?"Group":"Stage",c:t==="note"?2:t==="folder"?0:5};if(at){const[w,h]=NS[t];o.x=sn(at[0]-w/2);o.y=sn(at[1]-h/2)}const n=add(o);setEd(n.id)};
const onBoard=new Set(bd.nodes.filter(n=>n.t==="res").map(n=>n.rid));
const addRes=r=>{const ex=bdr.current.nodes.find(n=>n.t==="res"&&n.rid===r.id);setPk(false);setPq("");if(ex){setIds([ex.id]);p.flash("This article is already on the board");return}add({t:"res",rid:r.id})};
const del=()=>{if(!sel)return;if(sel.k==="n"){const S=sel.ids;up(b=>({nodes:b.nodes.filter(n=>!S.includes(n.id)),edges:b.edges.filter(e=>!S.includes(e.a)&&!S.includes(e.b))}))}else up(b=>({edges:b.edges.filter(e=>e.id!==sel.id)}));setSel(null)};
const pn=(id,o,r)=>{r&&rec();setBd(b=>({...b,nodes:b.nodes.map(n=>n.id===id?{...n,...o}:n)}))};
const pe=(id,o,r)=>{r&&rec();setBd(b=>({...b,edges:b.edges.map(e=>e.id===id?{...e,...o}:e)}))};
const paste=(nodes,edges,off)=>{if(!nodes.length)return;const m={};const nn=nodes.map(n=>{m[n.id]=nid();return{...n,id:m[n.id],x:n.x+off,y:n.y+off}});const ee=edges.filter(e=>m[e.a]&&m[e.b]).map(e=>({...e,id:nid(),a:m[e.a],b:m[e.b]}));up(b=>({nodes:[...b.nodes,...nn],edges:[...b.edges,...ee]}));setIds(nn.map(n=>n.id))};
const grab=()=>({nodes:bdr.current.nodes.filter(n=>ids.includes(n.id)),edges:bdr.current.edges.filter(e=>ids.includes(e.a)&&ids.includes(e.b))});
const dup=()=>{const g=grab();paste(g.nodes,g.edges,32)};
const copy=()=>{if(!ids.length)return;clip.current={...grab(),k:0};p.flash("Copied")};
const pasteC=()=>{const c=clip.current;if(!c)return;c.k++;paste(c.nodes,c.edges,32*c.k)};
const selN=bd.nodes.filter(n=>ids.includes(n.id));
const align=k=>{if(selN.length<2)return;const B=bbox(selN);up(b=>({nodes:b.nodes.map(n=>{if(!ids.includes(n.id))return n;const o={};if(k==="l")o.x=B.x0;if(k==="c")o.x=Math.round(B.x0+(B.w-n.w)/2);if(k==="r")o.x=B.x1-n.w;if(k==="t")o.y=B.y0;if(k==="m")o.y=Math.round(B.y0+(B.h-n.h)/2);if(k==="b")o.y=B.y1-n.h;return{...n,...o}})}))};
const dist=k=>{const S=[...selN].sort((a,b)=>k==="h"?a.x-b.x:a.y-b.y);if(S.length<3)return;const B=bbox(S),tot=S.reduce((t,n)=>t+(k==="h"?n.w:n.h),0),gap=((k==="h"?B.w:B.h)-tot)/(S.length-1);let c=k==="h"?B.x0:B.y0;const P={};S.forEach(n=>{P[n.id]=Math.round(c);c+=(k==="h"?n.w:n.h)+gap});up(b=>({nodes:b.nodes.map(n=>P[n.id]===undefined?n:{...n,[k==="h"?"x":"y"]:P[n.id]})}))};
const colorAll=i=>up(b=>({nodes:b.nodes.map(n=>ids.includes(n.id)&&n.t!=="res"?{...n,c:i}:n)}));
const layout=()=>{up(b=>({nodes:lay(b.nodes,b.edges)}));setTimeout(fit,60)};
const expand=n=>{const r=res.find(x=>x.id===n.rid);if(!r)return;const B=bdr.current,have=new Map(B.nodes.filter(x=>x.t==="res").map(x=>[x.rid,x.id])),L=[...r.links.map(l=>[l[0],l[1],1]),...res.filter(x=>x.links.some(l=>l[0]===r.id)).map(x=>[x.id,x.links.find(l=>l[0]===r.id)[1],0])].filter(l=>res.some(x=>x.id===l[0]));
const nodes=[],edges=[],cnt=[0,0];L.forEach(l=>{if(!have.has(l[0]))cnt[l[2]?1:0]++});const k=[0,0];
L.forEach(([id,kind,out])=>{let t=have.get(id);if(!t){t=nid();have.set(id,t);const i=k[out]++,c=cnt[out];nodes.push({id:t,t:"res",rid:id,w:250,h:76,x:out?n.x+n.w+110:n.x-250-110,y:sn(n.y+(i-(c-1)/2)*100)})}
if(!B.edges.some(e=>(e.a===n.id&&e.b===t)||(e.a===t&&e.b===n.id))&&!edges.some(e=>(e.a===n.id&&e.b===t)||(e.a===t&&e.b===n.id)))edges.push({id:nid(),a:out?n.id:t,b:out?t:n.id,lab:kind==="hard"?"depends on":"see also",dash:kind!=="hard",c:kind==="hard"?0:1})});
if(!nodes.length&&!edges.length){p.flash("No new links in the library");return}up(b=>({nodes:[...b.nodes,...nodes],edges:[...b.edges,...edges]}))};
useEffect(()=>{const k=e=>{const t=e.target.tagName;if(t==="INPUT"||t==="TEXTAREA")return;const m=e.metaKey||e.ctrlKey,c=e.key.toLowerCase();
if(e.key===" "){if(t==="BUTTON")return;e.preventDefault();if(!e.repeat)setSpc(true);return}
if(m&&c==="z"){e.preventDefault();e.shiftKey?redo():undo()}else if(m&&c==="y"){e.preventDefault();redo()}
else if(m&&c==="a"){e.preventDefault();setIds(bdr.current.nodes.map(n=>n.id))}
else if(m&&c==="d"){e.preventDefault();dup()}else if(m&&c==="c"){copy()}else if(m&&c==="v"){pasteC()}
else if(m&&e.key==="0"){e.preventDefault();fit()}else if(m&&(e.key==="="||e.key==="+")){e.preventDefault();zoom(vpr.current.z*1.2,...W())}else if(m&&e.key==="-"){e.preventDefault();zoom(vpr.current.z/1.2,...W())}
else if(e.key==="Delete"||e.key==="Backspace"){e.preventDefault();del()}
else if(e.key==="Escape"){if(pk)setPk(false);else if(sel)setSel(null);else back()}
else if(e.key.startsWith("Arrow")&&ids.length){e.preventDefault();const d=e.shiftKey?40:8,dx=e.key==="ArrowLeft"?-d:e.key==="ArrowRight"?d:0,dy=e.key==="ArrowUp"?-d:e.key==="ArrowDown"?d:0;rec();setBd(b=>({...b,nodes:b.nodes.map(n=>ids.includes(n.id)?{...n,x:n.x+dx,y:n.y+dy}:n)}))}
else if(!m){if(c==="v")setTool("v");else if(c==="h")setTool("h");else if(c==="n")addText("note");else if(c==="g")addText("folder");else if(c==="e")addText("shape");else if(c==="a"){setPk(x=>!x);setPq("")}}};
const ku=e=>{if(e.key===" ")setSpc(false)};window.addEventListener("keydown",k);window.addEventListener("keyup",ku);return()=>{window.removeEventListener("keydown",k);window.removeEventListener("keyup",ku)}});
const pt=e=>{const r=rect(),v=vpr.current;return[(e.clientX-r.left-v.x)/v.z,(e.clientY-r.top-v.y)/v.z]};
const down=e=>{if(e.button>1)return;const t=e.target;if(t.closest("textarea,input,button,.bkb"))return;const r=rect();ptr.current.set(e.pointerId,[e.clientX,e.clientY]);cv.current.setPointerCapture(e.pointerId);
if(ptr.current.size===2){const[a,b]=[...ptr.current.values()],v=vpr.current;dr.current={k:"z",d0:Math.hypot(a[0]-b[0],a[1]-b[1])||1,z0:v.z,cx:(a[0]+b[0])/2-r.left,cy:(a[1]+b[1])/2-r.top,vx:v.x,vy:v.y};setMq(null);setCn(null);return}
const hE=t.closest("[data-h]"),rE=t.closest("[data-rs]"),nE=t.closest("[data-nid]"),eE=t.closest("[data-eid]"),v=vpr.current;
if(e.button===1||tool==="h"||spc){e.preventDefault();dr.current={k:"p",sx:e.clientX,sy:e.clientY,vx:v.x,vy:v.y};setPan(true);return}
if(hE){const sd=(hE.className.match(/hd-(\w)/)||[])[1]||"r";dr.current={k:"c",id:hE.dataset.h,sd};setIds([hE.dataset.h]);setCn({a:hE.dataset.h,p:pt(e),sd});return}
if(rE){const n=bdr.current.nodes.find(x=>x.id===rE.dataset.rs);rec();dr.current={k:"r",id:n.id,sx:e.clientX,sy:e.clientY,ow:n.w,oh:n.h};return}
if(nE){const id=nE.dataset.nid;let S=ids;if(e.shiftKey||e.metaKey||e.ctrlKey){S=S.includes(id)?S.filter(x=>x!==id):[...S,id];setIds(S);if(!S.includes(id)){dr.current=null;return}}else if(!S.includes(id)){S=[id];setIds(S)}
setPk(false);const O={};bdr.current.nodes.forEach(x=>{if(S.includes(x.id))O[x.id]=[x.x,x.y]});dr.current={k:"n",S,O,sx:e.clientX,sy:e.clientY,mv:false};return}
if(eE){setSel({k:"e",id:eE.dataset.eid});setPk(false);return}
setPk(false);if(e.pointerType==="touch"){setSel(null);dr.current={k:"p",sx:e.clientX,sy:e.clientY,vx:v.x,vy:v.y};setPan(true);return}
const base=e.shiftKey?ids:[];if(!e.shiftKey)setSel(null);dr.current={k:"m",sx:e.clientX,sy:e.clientY,base}};
const move=e=>{if(ptr.current.has(e.pointerId))ptr.current.set(e.pointerId,[e.clientX,e.clientY]);const d=dr.current;if(!d)return;const r=rect();
if(d.k==="z"){const P=[...ptr.current.values()];if(P.length<2)return;const dd=Math.hypot(P[0][0]-P[1][0],P[0][1]-P[1][1]),nz=Math.min(3,Math.max(.1,d.z0*dd/d.d0)),cx=(P[0][0]+P[1][0])/2-r.left,cy=(P[0][1]+P[1][1])/2-r.top;setVp({z:nz,x:cx-(d.cx-d.vx)*(nz/d.z0),y:cy-(d.cy-d.vy)*(nz/d.z0)});return}
if(d.k==="p")setVp(v=>({...v,x:d.vx+e.clientX-d.sx,y:d.vy+e.clientY-d.sy}));
else if(d.k==="n"){const z=vpr.current.z,dx=(e.clientX-d.sx)/z,dy=(e.clientY-d.sy)/z;if(!d.mv&&Math.abs(dx)+Math.abs(dy)<3)return;
if(!d.mv){d.mv=true;rec();setDrg(true);d.G=bbox(d.S.map(i=>{const n=bdr.current.nodes.find(x=>x.id===i);return{...n,x:d.O[i][0],y:d.O[i][1]}}))}
const G=d.G;let nx=G.x0+dx,ny=G.y0+dy;const g=[];
if(!e.altKey){const th=6/z,oth=bdr.current.nodes.filter(n=>!d.S.includes(n.id));let bx=null,by=null;
oth.forEach(o=>{const X=[o.x,o.x+o.w/2,o.x+o.w],Y=[o.y,o.y+o.h/2,o.y+o.h],mx=[nx,nx+G.w/2,nx+G.w],my=[ny,ny+G.h/2,ny+G.h];
mx.forEach(a=>X.forEach(b=>{const df=b-a;if(Math.abs(df)<th&&(!bx||Math.abs(df)<Math.abs(bx)))bx=df}));my.forEach(a=>Y.forEach(b=>{const df=b-a;if(Math.abs(df)<th&&(!by||Math.abs(df)<Math.abs(by)))by=df}))});
nx=bx!==null?nx+bx:sn(nx);ny=by!==null?ny+by:sn(ny);
oth.forEach(o=>{const X=[o.x,o.x+o.w/2,o.x+o.w],Y=[o.y,o.y+o.h/2,o.y+o.h],mx=[nx,nx+G.w/2,nx+G.w],my=[ny,ny+G.h/2,ny+G.h];
mx.forEach(a=>X.forEach(b=>{if(Math.abs(a-b)<.5)g.push({o:"v",p:b,a:Math.min(ny,o.y),b:Math.max(ny+G.h,o.y+o.h)})}));my.forEach(a=>Y.forEach(b=>{if(Math.abs(a-b)<.5)g.push({o:"h",p:b,a:Math.min(nx,o.x),b:Math.max(nx+G.w,o.x+o.w)})}))})}
setGd(g);const ax=nx-G.x0,ay=ny-G.y0;setBd(b=>({...b,nodes:b.nodes.map(n=>d.O[n.id]?{...n,x:d.O[n.id][0]+ax,y:d.O[n.id][1]+ay}:n)}))}
else if(d.k==="r"){const z=vpr.current.z,n=bdr.current.nodes.find(x=>x.id===d.id),mn=MIN[n.t];pn(d.id,{w:Math.max(mn[0],sn(d.ow+(e.clientX-d.sx)/z)),h:Math.max(mn[1],sn(d.oh+(e.clientY-d.sy)/z))})}
else if(d.k==="c"){const el=document.elementFromPoint(e.clientX,e.clientY),tn=el&&el.closest("[data-nid]");setCn({a:d.id,p:pt(e),sd:d.sd,t:tn&&tn.dataset.nid!==d.id?tn.dataset.nid:null})}
else if(d.k==="m"){if(!mq&&Math.abs(e.clientX-d.sx)+Math.abs(e.clientY-d.sy)<4)return;const x=Math.min(d.sx,e.clientX)-r.left,y=Math.min(d.sy,e.clientY)-r.top,w=Math.abs(e.clientX-d.sx),h=Math.abs(e.clientY-d.sy),v=vpr.current,x0=(x-v.x)/v.z,y0=(y-v.y)/v.z,x1=(x+w-v.x)/v.z,y1=(y+h-v.y)/v.z;setMq({x,y,w,h});
const hit=bdr.current.nodes.filter(n=>n.x<x1&&n.x+n.w>x0&&n.y<y1&&n.y+n.h>y0).map(n=>n.id);setIds([...new Set([...d.base,...hit])])}};
const upp=e=>{ptr.current.delete(e.pointerId);const d=dr.current;if(d&&d.k==="z"){if(ptr.current.size<2)dr.current=null;return}dr.current=null;setPan(false);setGd([]);setMq(null);setDrg(false);
if(d&&d.k==="c"){const el=document.elementFromPoint(e.clientX,e.clientY),tn=el&&el.closest("[data-nid]");setCn(null);if(tn&&tn.dataset.nid!==d.id&&!bdr.current.edges.some(x=>x.a===d.id&&x.b===tn.dataset.nid))up(b=>({edges:[...b.edges,{id:nid(),a:d.id,b:tn.dataset.nid,lab:"",dash:false,c:0}]}))}};
const dbl=e=>{if(e.target.closest("textarea,input,button,.bkb"))return;const nE=e.target.closest("[data-nid]"),eE=e.target.closest("[data-eid]");if(nE){const n=bdr.current.nodes.find(x=>x.id===nE.dataset.nid);if(n.t==="res")p.openRes(n.rid);else{rec();setEd(n.id)}}else if(eE){rec();setSel({k:"e",id:eE.dataset.eid});setEd("e"+eE.dataset.eid)}else if(tool==="v"){addText("note",pt(e))}};
const NM=Object.fromEntries(bd.nodes.map(n=>[n.id,n]));
const E=bd.edges.map(e=>{const a=NM[e.a],b=NM[e.b];if(!a||!b)return null;const[s0,t,d]=anc(a,b);return{e,path:bez(s0,t,d),s0,m:[(s0[0]+t[0])/2,(s0[1]+t[1])/2]}}).filter(Boolean);
const se=sel&&sel.k==="e"?bd.edges.find(e=>e.id===sel.id):null,S1=selN.length===1?selN[0]:null,hot=new Set(ids);
const SB=selN.length?bbox(selN):null,sbS=SB&&{x:vp.x+SB.x0*vp.z,y:vp.y+SB.y0*vp.z,w:SB.w*vp.z,h:SB.h*vp.z};
const pr=(pq.trim()?res.filter(r=>hay(r).toLowerCase().includes(pq.trim().toLowerCase())):res).slice(0,30);
const TA=n=>html`<textarea autoFocus onFocus=${e=>e.target.select()} className="ined" value=${n.txt} onChange=${e=>pn(n.id,{txt:e.target.value})} onBlur=${()=>setEd(null)} onKeyDown=${e=>{if(e.key==="Escape"||(e.key==="Enter"&&!e.shiftKey)){e.preventDefault();setEd(null)}}}></textarea>`;
const TB=(k,ic,lb,on,fn,sc)=>html`<button key=${k} className=${"tb2"+(on?" on":"")} title=${lb+(sc?" ("+sc+")":"")} onClick=${fn}><${Ic} n=${ic} s=${21}/><span>${lb}</span></button>`;
const CB=(ic,lb,fn,cls)=>html`<button className=${"cb "+(cls||"")} title=${lb} aria-label=${lb} onClick=${fn}><${Ic} n=${ic} s=${17}/></button>`;
const Sw=(arr,cur,fn)=>html`<div className="csw">${arr.map((c,i)=>html`<button key=${c} aria-label=${"Color "+(i+1)} className=${cur===i?"on":""} style=${{background:c}} onClick=${()=>fn(i)}></button>`)}</div>`;
const Fr=(...a)=>React.createElement(React.Fragment,null,...a);
const cpos=(ax,ay,by)=>{let t=ay-54;if(t<66)t=by+14;t=Math.min(t,sz.h-130);return{left:Math.min(sz.w-170,Math.max(170,ax)),top:Math.max(8,t)}};
let ctx=null;
if(!drg&&!mq&&!cn){if(se){const ee=E.find(x=>x.e.id===se.id);if(ee){const ax=vp.x+ee.m[0]*vp.z,ay=vp.y+ee.m[1]*vp.z;ctx={pos:cpos(ax,ay-12,ay+14),body:html`${CB("pencil","Caption",()=>{rec();setEd("e"+se.id)})}${CB(se.dash?"dash":"solid",se.dash?"Make solid":"Make dashed",()=>pe(se.id,{dash:!se.dash},true),se.dash?"on":"")}${CB("swap","Reverse direction",()=>pe(se.id,{a:se.b,b:se.a},true))}<i className="cdv"></i>${Sw(EC,se.c||0,i=>pe(se.id,{c:i},true))}<i className="cdv"></i>${CB("trash","Delete",del,"dg")}`}}}
else if(sbS){const pos=cpos(sbS.x+sbS.w/2,sbS.y-12,sbS.y+sbS.h);
if(S1&&S1.t==="res")ctx={pos,body:html`<button className="cb pr" onClick=${()=>p.openRes(S1.rid)}><${Ic} n="openx" s=${16}/>Open</button><button className="cb" onClick=${()=>expand(S1)}><${Ic} n="expand" s=${16}/>Links</button><i className="cdv"></i>${CB("dup","Duplicate (⌘D)",dup)}${CB("trash","Delete",del,"dg")}`};
else if(S1)ctx={pos,body:html`${Sw(BC,S1.c||0,i=>pn(S1.id,{c:i},true))}<i className="cdv"></i>${CB("pencil","Edit text",()=>{rec();setEd(S1.id)})}${CB("dup","Duplicate (⌘D)",dup)}${CB("trash","Delete",del,"dg")}`};
else ctx={pos,body:html`<span className="ccnt">${selN.length} objects</span><i className="cdv"></i>${CB("alL","Align left",()=>align("l"))}${CB("alC","Align center",()=>align("c"))}${CB("alR","Align right",()=>align("r"))}${CB("alT","Align top",()=>align("t"))}${CB("alM","Align middle",()=>align("m"))}${CB("alB","Align bottom",()=>align("b"))}${selN.length>2&&Fr(CB("dsH","Distribute horizontally",()=>dist("h")),CB("dsV","Distribute vertically",()=>dist("v")))}<i className="cdv"></i>${selN.some(n=>n.t!=="res")&&Fr(Sw(BC,-1,colorAll),html`<i className="cdv"></i>`)}${CB("dup","Duplicate (⌘D)",dup)}${CB("trash","Delete",del,"dg")}`}}}
const MMV=()=>{const Wd=184,Hd=120,vw=sz.w/vp.z,vh=sz.h/vp.z,vx=-vp.x/vp.z,vy=-vp.y/vp.z,B=bd.nodes.length?bbox(bd.nodes):{x0:vx,y0:vy,x1:vx+vw,y1:vy+vh},x0=Math.min(B.x0,vx)-60,y0=Math.min(B.y0,vy)-60,x1=Math.max(B.x1,vx+vw)+60,y1=Math.max(B.y1,vy+vh)+60,bw=x1-x0,bh=y1-y0,s=Math.min(Wd/bw,Hd/bh),ox=(Wd-bw*s)/2,oy=(Hd-bh*s)/2;
const go=e=>{const r=e.currentTarget.getBoundingClientRect(),wx=(e.clientX-r.left-ox)/s+x0,wy=(e.clientY-r.top-oy)/s+y0;setVp(v=>({...v,x:sz.w/2-wx*v.z,y:sz.h/2-wy*v.z}))};
return html`<div className="mm bgl bkb" aria-hidden="true" onPointerDown=${e=>{e.currentTarget.setPointerCapture(e.pointerId);go(e)}} onPointerMove=${e=>{if(e.buttons)go(e)}}><svg viewBox=${"0 0 "+Wd+" "+Hd}>${bd.nodes.map(n=>{const r=n.t==="res"?res.find(x=>x.id===n.rid):null;return html`<rect key=${n.id} x=${(n.x-x0)*s+ox} y=${(n.y-y0)*s+oy} width=${Math.max(2,n.w*s)} height=${Math.max(2,n.h*s)} rx="2" fill=${r?DC[r.disc]:BC[n.c||0]} fillOpacity=${hot.has(n.id)?1:.6}/>`})}<rect x=${(vx-x0)*s+ox} y=${(vy-y0)*s+oy} width=${vw*s} height=${vh*s} rx="3" style=${{fill:"var(--blue)",fillOpacity:.1,stroke:"var(--blue)"}} strokeWidth="1.2"/></svg></div>`};
return html`<div className="be" role="dialog" aria-label="Board">
<div className="bhd"><button className="bgl bb" onClick=${back}><${Ic} n="chev" s=${14}/><span className="lb">Boards</span></button><input className="bgl btt" value=${bd.name} onChange=${e=>setBd(b=>({...b,name:e.target.value}))} aria-label="Board name"/><span className="sp"></span>
<div className="bgl bgrp"><button aria-label="Undo" title="Undo (⌘Z)" disabled=${!hs[0]} onClick=${undo}><${Ic} n="undo" s=${17}/></button><button aria-label="Redo" title="Redo (⇧⌘Z)" disabled=${!hs[1]} onClick=${redo}><${Ic} n="redo" s=${17}/></button></div>
<button className="bgl bb bbl" onClick=${layout} title="Auto-arrange"><${Ic} n="layout" s=${15}/><span className="lb">Arrange</span></button>
<div className="bgl bgrp"><button aria-label="Zoom out" title="Zoom out (⌘−)" onClick=${()=>zoom(vp.z/1.2,...W())}>−</button><button className="zp" onClick=${fit} title="Fit all (⌘0)">${Math.round(vp.z*100)}%</button><button aria-label="Zoom in" title="Zoom in (⌘+)" onClick=${()=>zoom(vp.z*1.2,...W())}>+</button><span className="bgd"></span><button className=${"mmb"+(mm?" on":"")} aria-label="Minimap" aria-pressed=${mm} title="Minimap" onClick=${()=>{ls.set("kb2-mm",!mm);setMm(!mm)}}><${Ic} n="map" s=${17}/></button></div></div>
<div className=${"cv"+(tool==="h"||spc?" hand":"")+(pan?" pan":"")} ref=${cv} tabIndex="-1" onPointerDown=${down} onPointerMove=${move} onPointerUp=${upp} onPointerCancel=${upp} onDoubleClick=${dbl}>
<div className="cvg" style=${{backgroundSize:24*vp.z+"px "+24*vp.z+"px",backgroundPosition:vp.x+"px "+vp.y+"px",opacity:Math.max(0,Math.min(1,(vp.z-.35)*4))}}></div>
<div className="world" style=${{transform:"translate("+vp.x+"px,"+vp.y+"px) scale("+vp.z+")"}}>
<svg className="esv" width="1" height="1"><defs>${EC.map((c,i)=>html`<marker key=${i} id=${"m"+i} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1.5L9 5L1 8.5z" fill=${c}/></marker>`)}</defs>
${E.map(({e,path,s0})=>{const on=sel&&sel.k==="e"&&sel.id===e.id,ci=e.c||0,dim=ids.length&&!(ids.includes(e.a)||ids.includes(e.b));return html`<g key=${e.id} style=${{opacity:dim?.28:1,transition:"opacity .2s"}}>${on&&html`<path d=${path} fill="none" stroke="#0a84ff" strokeOpacity=".22" strokeWidth="10" strokeLinecap="round"/>`}<path className="el" d=${path} fill="none" stroke=${EC[ci]} strokeOpacity=${ci===0?.8:1} strokeWidth=${on?2.6:2} strokeLinecap="round" strokeDasharray=${e.dash?"7 7":""} markerEnd=${"url(#m"+ci+")"}/><circle cx=${s0[0]} cy=${s0[1]} r="3.2" fill=${EC[ci]} fillOpacity=${ci===0?.8:1}/><path data-eid=${e.id} d=${path} fill="none" stroke="transparent" strokeWidth="18" style=${{pointerEvents:"stroke",cursor:"pointer"}}/></g>`})}
${cn&&NM[cn.a]&&(()=>{const a=NM[cn.a],sd=cn.sd,sx=sd==="l"?a.x:sd==="r"?a.x+a.w:a.x+a.w/2,sy=sd==="t"?a.y:sd==="b"?a.y+a.h:a.y+a.h/2;return html`<path d=${"M"+[sx,sy]+"L"+cn.p} stroke="#0a84ff" strokeWidth="2.2" strokeDasharray="1 7" strokeLinecap="round" fill="none"/>`})()}
${gd.map((g,i)=>g.o==="v"?html`<line key=${i} x1=${g.p} x2=${g.p} y1=${g.a-14} y2=${g.b+14} stroke="#ff375f" strokeWidth=${1.25/vp.z}/>`:html`<line key=${i} y1=${g.p} y2=${g.p} x1=${g.a-14} x2=${g.b+14} stroke="#ff375f" strokeWidth=${1.25/vp.z}/>`)}</svg>
${SB&&selN.length>1&&html`<div className="gbox" style=${{left:SB.x0-12,top:SB.y0-12,width:SB.w+24,height:SB.h+24,borderWidth:1.5/vp.z}}></div>`}
${E.map(({e,m})=>(e.lab||ed==="e"+e.id)&&html`<div key=${"l"+e.id} className="elab" style=${{left:m[0],top:m[1]}}>${ed==="e"+e.id?html`<input autoFocus value=${e.lab} onChange=${x=>pe(e.id,{lab:x.target.value})} onBlur=${()=>setEd(null)} onKeyDown=${k=>(k.key==="Enter"||k.key==="Escape")&&setEd(null)}/>`:html`<span data-eid=${e.id}>${e.lab}</span>`}</div>`)}
${bd.nodes.map(n=>{const on=hot.has(n.id),r=n.t==="res"?res.find(x=>x.id===n.rid):null,col=BC[n.c||0];
return html`<div key=${n.id} data-nid=${n.id} className=${"bn "+n.t+(on?" on":"")+(on&&ids.length===1?" solo":"")+(cn&&cn.t===n.id?" tg":"")} style=${{left:n.x,top:n.y,width:n.w,height:n.h,"--c":col}}>
${n.t==="res"&&r&&html`<${React.Fragment}><span className="tl" style=${{"--c":DC[r.disc]}}><${Ic} n=${r.type} s=${18}/></span><span className="bt2"><b>${r.title}</b><small><${Pill} s=${r.status}/><em>${fmt(r.upd)}</em></small></span><//>`}
${n.t==="res"&&!r&&html`<span className="bt2"><b>Article deleted</b></span>`}
${n.t==="folder"&&html`<${React.Fragment}><span className="tl" style=${{"--c":col}}><${Ic} n="folder" s=${19}/></span><span className="bt2">${ed===n.id?TA(n):html`<b>${n.txt}</b>`}<small>${bd.edges.filter(x=>x.a===n.id).length} links</small></span><//>`}
${(n.t==="note"||n.t==="shape")&&(ed===n.id?TA(n):html`<span className="ntx">${n.txt}</span>`)}
${tool==="v"&&!spc&&ed!==n.id&&["r","l","t","b"].map(h=>html`<i key=${h} className=${"hd hd-"+h} data-h=${n.id}></i>`)}
${n.t!=="res"&&html`<i className="rz" data-rs=${n.id}></i>`}</div>`})}</div>
${mq&&html`<div className="mq" style=${{left:mq.x,top:mq.y,width:mq.w,height:mq.h}}></div>`}
${!bd.nodes.length&&html`<div className="bhint"><${Ic} n="boards" s=${40}/><b>Empty board</b><span>Add articles, groups and notes, then connect them<br/>by dragging a dot on the object’s edge.</span><div className="btns"><button className="btn p" onClick=${()=>{setPk(true);setPq("")}}><${Ic} n="doc" s=${15}/> Add article</button><button className="btn" onClick=${()=>addText("note")}><${Ic} n="note" s=${15}/> Note</button></div></div>`}
${ctx&&html`<div className="bctx bgl bkb" style=${ctx.pos}>${Fr(...[].concat(ctx.body))}</div>`}
${pk&&html`<div className="pick bgl bkb"><input className="inp" autoFocus placeholder="Find an article…" value=${pq} onChange=${e=>setPq(e.target.value)} onKeyDown=${e=>{if(e.key==="Enter"&&pr[0])addRes(pr[0]);if(e.key==="Escape"){e.stopPropagation();setPk(false)}}}/><div className="pkl">${pr.length?pr.map(r=>html`<button key=${r.id} className="pki" onClick=${()=>addRes(r)}><span className="tl" style=${{"--c":DC[r.disc]}}><${Ic} n=${r.type} s=${16}/></span><span className="t"><b>${r.title}</b><small>${byId(r.node,p.tree)?.path.join(" › ")||"Library"}</small></span>${onBoard.has(r.id)&&html`<span className="ck2">On board</span>`}</button>`):html`<div className="pke">Nothing found</div>`}</div></div>`}
<div className="btb bgl bkb">${TB("v","cursor","Select",tool==="v"&&!pk,()=>setTool("v"),"V")}${TB("h","hand","Hand",tool==="h",()=>setTool("h"),"H")}<i className="dv"></i>${TB("a","doc","Article",pk,()=>{setPk(x=>!x);setPq("")},"A")}${TB("f","folder","Group",false,()=>addText("folder"),"G")}${TB("n","note","Note",false,()=>addText("note"),"N")}${TB("s","shape","Stage",false,()=>addText("shape"),"E")}</div>
${mm&&MMV()}
</div></div>`}
