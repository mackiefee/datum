import { html, Fragment, useState, useEffect, useRef } from '../../lib/react.js';
import { ST, TY, VIS, STG, DISC, DC, RD, can, normRole } from '../../config/constants.js';
import { buildFlat, byId } from '../../data/spaces.js';
import { TPL } from '../../data/templates.js';
import { esc, md, ewTx, ewMd } from '../../utils/markdown.js';
import { shrink, docxImport } from '../../utils/docx.js';
import { Ic } from '../../components/Icon.js';
import { Select } from '../../components/Select.js';
import { db } from '../../lib/db.js';
import { EW_TBL, EW_SL, EW_CL, TURN } from './editorConfig.js';

export function Editor(p){
const flatCats=buildFlat(p.tree);
const i=p.init,n0=i.node||(byId(p.cur,p.tree)?p.cur:"c10-ovw-std");
const catObj=byId(n0,p.tree)||flatCats[0];
const [t,setT]=useState(i.title||""),[ds,setDs]=useState(i.desc||""),[nd,setNd]=useState(n0),[ty,setTy]=useState(i.type||"doc"),[st,setSt]=useState(i.status||"Draft"),[vs,setVs]=useState(i.vis||(catObj&&catObj.vis)||"Internal"),[url,setUrl]=useState(i.url||""),[sg,setSg]=useState(i.stage||STG[0]),[dc,setDc]=useState(i.disc||RD[catObj?.path?.[0]]||"VDC"),[tg,setTg]=useState((i.tags||[]).join(", ")),[m,setM]=useState("w"),[dl,setDl]=useState(false),[emp,setEmp]=useState(!i.body),[fb,setFb]=useState(null),[inT,setInT]=useState(false),[sl,setSl]=useState(null),[toc,setToc]=useState([]),[hd,setHd]=useState(null),[bm,setBm]=useState(null),[dp,setDp]=useState(null),[tb,setTb]=useState(null),[lk,setLk]=useState(null),[fa,setFa]=useState({});
const wrap=useRef(null),drag=useRef(null),lt=useRef(0);
const tocK=useRef(""),selR=useRef(null);
const root=useRef(null),fi=useRef(null),dx=useRef(null),bdr=useRef(i.body||""),loc=useRef({});
const [ib,setIb]=useState(false);

const curCat=byId(nd,p.tree)||catObj;
const canPublishCat=can.status(p.role,curCat,p.userName);
const dupMatch=(p.res||[]).find(r=>r.id!==i.id&&((url.trim()&&r.url&&r.url.trim().toLowerCase()===url.trim().toLowerCase())||(t.trim().length>5&&r.title.trim().toLowerCase()===t.trim().toLowerCase())));

const up=s=>{const n=getSelection().anchorNode,e=n&&(n.nodeType===1?n:n.parentElement),r=root.current;return e&&r&&r.contains(e)?e.closest(s):null};
const blockOf=()=>{const s=getSelection(),r=root.current;if(!s.rangeCount||!r)return null;let n=s.anchorNode;while(n&&n.parentNode!==r)n=n.parentNode;return n&&n.nodeType===1?n:null};
const caret=(e,end)=>{const r=document.createRange();r.selectNodeContents(e);r.collapse(!end);const s=getSelection();s.removeAllRanges();s.addRange(r);root.current&&root.current.focus()};
const sync=()=>{const r=root.current;if(!r)return;const l=r.lastElementChild;if(!l||/^(FIGURE|TABLE|HR|PRE|BLOCKQUOTE)$/.test(l.tagName)||l.classList.contains("tw"))r.insertAdjacentHTML("beforeend","<p><br></p>");bdr.current=ewMd(r,{...p.imgs,...loc.current});setEmp(!r.textContent.trim()&&!r.querySelector("img,table,hr"));const tc=[...r.querySelectorAll("h1,h2,h3")].map(h=>({t:h.textContent.trim(),l:h.tagName==="H3"?3:2})).filter(x=>x.t),k=JSON.stringify(tc);if(k!==tocK.current){tocK.current=k;setToc(tc)}};
const toDom=s=>{const d=document.createElement("div");d.innerHTML=md(s,{...p.imgs,...loc.current}).h||"<p><br></p>";
d.querySelectorAll("[id]").forEach(e=>e.removeAttribute("id"));d.querySelectorAll("figure").forEach(f=>{f.contentEditable="false";let c=f.querySelector("figcaption");if(!c){c=document.createElement("figcaption");f.appendChild(c)}c.contentEditable="true"});
d.querySelectorAll("blockquote").forEach(q=>{const b=q.querySelector("b");b&&(b.contentEditable="false");const x=document.createElement("div");[...q.childNodes].forEach(c=>{if(c!==b)x.appendChild(c)});if(!x.textContent)x.innerHTML="<br>";q.appendChild(x)});
d.querySelectorAll("td,th").forEach(c=>{if(!c.textContent)c.textContent="\u200b"});return d};const load=s=>{const r=root.current;if(!r)return;r.innerHTML=toDom(s).innerHTML;sync()};
useEffect(()=>{document.execCommand("defaultParagraphSeparator",false,"p");document.body.classList.add("editing");scrollTo(0,0);return()=>document.body.classList.remove("editing")},[]);
useEffect(()=>{if(m==="w"){load(bdr.current);scrollTo(0,0)}},[m]);
useEffect(()=>{const f=()=>{const r=root.current,s=getSelection();if(!r||!s.rangeCount||!r.contains(s.anchorNode)){setFb(null);setInT(false);setTb(null);return}setInT(!!up("td,th"));r.querySelectorAll(".ewc").forEach(x=>x.classList.remove("ewc"));const cb=blockOf();cb&&/^(P|H[1-3])$/.test(cb.tagName)&&cb.classList.add("ewc");const tt=up("table");if(tt){const q=tt.getBoundingClientRect();setTb({x:Math.min(Math.max(q.left+q.width/2,200),innerWidth-200),y:Math.max(q.top-46,62)})}else setTb(null);if(s.isCollapsed||up("figure")){setFb(null);return}const qs=c=>{try{return document.queryCommandState(c)}catch(e){return false}},nf={b:qs("bold"),i:qs("italic"),s:qs("strikeThrough"),c:!!up("code"),a:!!up("a")};setFa(o=>JSON.stringify(o)===JSON.stringify(nf)?o:nf);const b=s.getRangeAt(0).getBoundingClientRect();b.width||b.height?setFb({x:Math.min(Math.max(b.left+b.width/2,170),innerWidth-170),y:Math.max(b.top-46,58)}):setFb(null)};document.addEventListener("selectionchange",f);return()=>document.removeEventListener("selectionchange",f)},[m]);
const exec=(c,v)=>{root.current.focus();document.execCommand(c,false,v);sync()};
const put=(h,sel)=>{const r=root.current,b=blockOf(),tp=document.createElement("template");tp.innerHTML=h;const f=tp.content,first=f.firstElementChild;
if(b&&/^(P|DIV)$/.test(b.tagName)&&!b.textContent.trim()&&!b.querySelector("img"))b.replaceWith(f);else if(b)b.after(f);else r.appendChild(f);sync();if(first){if(first.tagName==="HR"&&first.nextElementSibling)caret(first.nextElementSibling);else caret(sel&&first.querySelector(sel)||first)}};
const fmt=k=>{const b=blockOf();if(b&&b.tagName.toLowerCase()===k&&k!=="p")k="p";exec("formatBlock","<"+k+">")};
const list=k=>{root.current.focus();const li=up("li"),T=k==="ol"?"OL":"UL",c=k==="ol"?"insertOrderedList":"insertUnorderedList";
if(li&&li.parentNode.tagName===T){k==="ck"?li.classList.toggle("ck"):document.execCommand(c)}else{document.execCommand(c);const l2=up("li");k==="ck"&&l2&&l2.classList.add("ck")}sync()};
const call=k=>{const b=blockOf();if(!b)return;
if(b.tagName==="BLOCKQUOTE"){if(b.classList.contains(k)){const x=document.createElement("p");x.textContent=[...b.childNodes].filter(n=>!(n.nodeType===1&&n.tagName==="B")).map(n=>n.textContent).join(" ").replace(/\u200b/g,"");if(!x.textContent)x.innerHTML="<br>";b.replaceWith(x);caret(x,true)}else{b.className=k;b.querySelector("b").textContent=EW_CL[k]}sync();return}
if(!/^(P|DIV|H\d)$/.test(b.tagName))return;const q=document.createElement("blockquote");q.className=k;q.innerHTML='<b contenteditable="false">'+EW_CL[k]+"</b><div></div>";const d=q.lastChild;d.textContent=b.textContent;if(!d.textContent)d.innerHTML="<br>";b.replaceWith(q);caret(d,true);sync()};
const codeB=()=>{const b=blockOf();if(!b)return;if(b.tagName==="PRE"){const x=document.createElement("p");x.textContent=ewTx(b);b.replaceWith(x);caret(x,true);sync();return}const pr=document.createElement("pre"),c=document.createElement("code");c.textContent=b.textContent||"\n";pr.appendChild(c);b.replaceWith(pr);caret(c,true);sync()};
const inlCode=()=>{const s=getSelection();if(!s.rangeCount||s.isCollapsed)return;const c=up("code");if(c)c.replaceWith(...c.childNodes);else{const r=s.getRangeAt(0),e=document.createElement("code");e.appendChild(r.extractContents());r.insertNode(e)}sync()};
const link=()=>{if(up("a")){exec("unlink");return}const s=getSelection();if(!s.rangeCount||s.isCollapsed||!root.current||!root.current.contains(s.anchorNode))return;const r=s.getRangeAt(0);selR.current=r.cloneRange();const b=r.getBoundingClientRect();setLk({x:Math.min(Math.max(b.left+b.width/2,180),innerWidth-180),y:Math.max(b.top-52,58),v:""})};
const applyLink=v=>{let u=(v||"").trim();if(u&&!/^https?:\/\//i.test(u))u="https://"+u;const r=selR.current;setLk(null);if(!r||!/^https?:\/\/[^\s.\/]+\.\S+/.test(u))return;const s=getSelection();root.current.focus();s.removeAllRanges();s.addRange(r);exec("createLink",u)};
useEffect(()=>{if(!lk)return;const f=e=>{if(!e.target.closest||!e.target.closest(".ewlk"))setLk(null)};document.addEventListener("mousedown",f);return()=>document.removeEventListener("mousedown",f)},[!!lk]);
const addRow=c=>{const tr=c.parentNode,n=document.createElement("tr");[...tr.cells].forEach(()=>{const d=document.createElement("td");d.textContent="\u200b";n.appendChild(d)});tr.after(n);sync();return n};
const addCol=()=>{const c=up("td,th");if(!c)return;const k=c.cellIndex;[...c.closest("table").rows].forEach(r=>{const x=r.cells[k];if(!x)return;const d=document.createElement(x.tagName);d.textContent="\u200b";x.after(d)});sync()};
const delRow=()=>{const c=up("td,th");if(!c)return;const tb=c.closest("table");tb.rows.length<2?delTbl():(c.parentNode.remove(),sync())};
const delCol=()=>{const c=up("td,th");if(!c)return;const k=c.cellIndex,tb=c.closest("table");tb.rows[0].cells.length<2?delTbl():([...tb.rows].forEach(r=>r.cells[k]&&r.cells[k].remove()),sync())};
const delTbl=()=>{const c=up("table");if(!c)return;const w=c.closest(".tw")||c,x=document.createElement("p");x.innerHTML="<br>";w.replaceWith(x);caret(x);sync()};
const quoteB=()=>{const b=blockOf();if(!b)return;if(b.tagName==="BLOCKQUOTE"&&!/\b(note|tip|warn)\b/.test(b.className)){const x=document.createElement("p");x.textContent=b.textContent.replace(/\u200b/g,"");if(!x.textContent)x.innerHTML="<br>";b.replaceWith(x);caret(x,true);sync();return}if(!/^(P|DIV|H\d)$/.test(b.tagName))return;const q=document.createElement("blockquote"),d=document.createElement("div");d.textContent=b.textContent;if(!d.textContent)d.innerHTML="<br>";q.appendChild(d);b.replaceWith(q);caret(d,true);sync()};
const dateI=()=>{const d=new Date().toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});root.current.focus();document.execCommand("insertText",false,d);sync()};
const inlMd=()=>{const s=getSelection();if(!s.rangeCount||!s.isCollapsed)return false;const n=s.anchorNode;if(!n||n.nodeType!==3||(n.parentElement&&n.parentElement.closest("code,pre")))return false;const o=s.anchorOffset,bf=n.data.slice(0,o);
const P=[[/(^|[^*\w])\*\*([^*\s](?:[^*]*[^*\s])?)\*\*$/,"b"],[/(^|[^*\w])\*([^*\s](?:[^*]*[^*\s])?)\*$/,"i"],[/(^|[^`])`([^`\s](?:[^`]*[^`\s])?)`$/,"code"],[/(^|[^~])~~([^~\s](?:[^~]*[^~\s])?)~~$/,"s"]];
for(const[re,tag]of P){const m=bf.match(re);if(!m)continue;const st=o-m[0].length+m[1].length,el=document.createElement(tag);el.textContent=m[2];const aft=n.data.slice(o);n.data=n.data.slice(0,st);const z=document.createTextNode("\u200b"+aft);n.after(el);el.after(z);const r=document.createRange();r.setStart(z,1);r.collapse(true);s.removeAllRanges();s.addRange(r);return true}return false};
const A={p:()=>fmt("p"),h1:()=>fmt("h1"),quote:quoteB,date:dateI,h2:()=>fmt("h2"),h3:()=>fmt("h3"),ul:()=>list("ul"),ol:()=>list("ol"),ck:()=>list("ck"),note:()=>call("note"),tip:()=>call("tip"),warn:()=>call("warn"),code:codeB,tbl:()=>put(EW_TBL,"th"),img:()=>fi.current.click(),hr:()=>put("<hr>")};
const addImgs=async fs=>{for(const f of fs){if(!/^image\//.test(f.type))continue;const u=await shrink(f);if(!u)continue;const id="i"+Math.random().toString(36).slice(2,8);loc.current[id]=u;p.setImgs(o=>({...o,[id]:u}));const im=document.createElement("img");im.src=u;im.setAttribute("data-id",id);im.alt="";const fg=document.createElement("figure");fg.contentEditable="false";fg.appendChild(im);const c=document.createElement("figcaption");c.contentEditable="true";fg.appendChild(c);put(fg.outerHTML,"figcaption");db.uploadImage(id,u).then(remoteUrl=>{if(remoteUrl&&remoteUrl!==u){loc.current[id]=remoteUrl;p.setImgs(o=>({...o,[id]:remoteUrl}));const liveImg=root.current&&root.current.querySelector('img[data-id="'+id+'"]');if(liveImg)liveImg.setAttribute("src",remoteUrl)}})}};
const impDocx=async f=>{if(!f||ib)return;if(!/\.docx$/i.test(f.name)){alert("A .docx file is required (Word 2007 or newer).");return}
if(m==="w")sync();if(bdr.current.trim()&&!confirm("Replace the current text with the document contents?"))return;
setIb(true);try{const r=await docxImport(f);loc.current={...loc.current,...r.imgs};p.setImgs(o=>({...o,...r.imgs}));
if(!t.trim())setT(r.title);if(!ds.trim())setDs(r.desc);
const b=t.trim()&&r.h1?"## "+r.h1+"\n\n"+r.body:r.body;bdr.current=b;
if(m==="w")load(b);else{setM("w")}
db.uploadImagesMap(r.imgs).then(uploaded=>{if(!uploaded||!Object.keys(uploaded).length)return;loc.current={...loc.current,...uploaded};p.setImgs(o=>({...o,...uploaded}));if(root.current){Object.entries(uploaded).forEach(([id,url])=>{const liveImg=root.current.querySelector('img[data-id="'+id+'"]');if(liveImg&&url)liveImg.setAttribute("src",url)})}});
}catch(e){alert(e&&e.message==="lib"?"Failed to load the import library. Check your internet connection and try again.":"Could not read the file. Make sure it is a genuine .docx (not .doc and not password-protected).")}setIb(false)};
const flt=sl?EW_SL.filter(x=>!sl.q||(x[1]+" "+x[5]).toLowerCase().includes(sl.q)):[];
const cTxt=()=>{const s=getSelection();if(!s.rangeCount||!s.isCollapsed)return null;let n=s.anchorNode,o=s.anchorOffset;if(n&&n.nodeType===1&&o>0&&n.childNodes[o-1]&&n.childNodes[o-1].nodeType===3){n=n.childNodes[o-1];o=n.data.length}return n&&n.nodeType===3?[n,o]:null};
const pick=k=>{const c=cTxt();if(c){const [n,o]=c,mm=n.data.slice(0,o).replace(/\u00a0/g," ").match(/(^|\s)\/\S*$/);if(mm){const st=o-mm[0].length+mm[1].length;n.data=n.data.slice(0,st)+n.data.slice(o);const r=document.createRange();r.setStart(n,st);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r)}}const b=blockOf();if(b&&/^(P|H[1-3])$/.test(b.tagName)&&!b.textContent.replace(/\u200b/g,"").trim()){b.innerHTML="<br>";caret(b)}setSl(null);A[k]()};
const slash=b=>{const c=cTxt();if(!b||!c||!/^(P|H[1-3])$/.test(b.tagName)){setSl(null);return}const [n,o]=c,mm=n.data.slice(0,o).replace(/\u00a0/g," ").match(/(?:^|\s)\/(\S*)$/);if(!mm){setSl(null);return}const sr=getSelection().rangeCount?getSelection().getRangeAt(0).getBoundingClientRect():null,bb=b.getBoundingClientRect();setSl({x:Math.min((sr&&sr.left)||bb.left,innerWidth-340),y:Math.max(8,Math.min(((sr&&sr.bottom)||bb.bottom)+8,innerHeight-450)),q:mm[1].toLowerCase(),i:0})};
useEffect(()=>{const e=document.querySelector(".ewsl button.on");e&&e.scrollIntoView({block:"nearest"})},[sl&&sl.i]);
const blkAt=y=>{const r=root.current;if(!r)return null;for(const c of r.children){const b=c.getBoundingClientRect();if(y>=b.top-6&&y<=b.bottom+6)return c}return null};
const onMove=e=>{if(drag.current)return;const b=blkAt(e.clientY),w=wrap.current;if(!b||!w)return;const top=b.getBoundingClientRect().top-w.getBoundingClientRect().top+(b.tagName==="H2"?10:b.tagName==="H3"?5:2);if(!hd||hd.el!==b||Math.abs(hd.top-top)>1)setHd({el:b,top})};
const plus=()=>{if(!hd)return;const b=hd.el;let n=b;if(!(b.tagName==="P"&&!b.textContent.trim())){n=document.createElement("p");b.after(n)}n.textContent="/";caret(n,true);slash(n);sync()};
const grip=e=>{if(!hd)return;const r=e.currentTarget.getBoundingClientRect();setBm({el:hd.el,x:r.left,y:r.bottom+6,mode:"all"})};
const into=el=>{let t=el;if(el.tagName==="BLOCKQUOTE")t=el.lastElementChild;else if(el.tagName==="UL"||el.tagName==="OL")t=el.querySelector("li");else if(el.tagName==="PRE")t=el.querySelector("code")||el;caret(t||el)};
const turn=k=>{const el=bm.el;setBm(null);if(!el||!el.isConnected)return;into(el);const c=el.tagName==="BLOCKQUOTE"&&["note","tip","warn"].find(x=>el.classList.contains(x));
if(el.tagName==="BLOCKQUOTE"&&!c){if(k==="quote")return;quoteB();k!=="p"&&A[k]();return}
if(c){if(EW_CL[k])call(k);else{call(c);k!=="p"&&A[k]()}return}
if(el.tagName==="PRE"){if(k==="code")return;codeB();k!=="p"&&A[k]();return}
if(el.tagName==="UL"||el.tagName==="OL"){if(k==="p"){exec(el.tagName==="UL"?"insertUnorderedList":"insertOrderedList");return}if(k==="ul"&&el.tagName==="UL"){el.querySelectorAll("li").forEach(l=>l.classList.remove("ck"));sync();return}}
if(k==="p")fmt("p");else A[k]()};
const dup=el=>{const c=el.cloneNode(true);c.classList&&c.classList.remove("ewc");el.after(c);sync()};
const mv=(el,d)=>{const t=d<0?el.previousElementSibling:el.nextElementSibling;if(!t)return;d<0?t.before(el):t.after(el);sync()};
const rm=el=>{el.remove();if(!root.current.children.length)root.current.innerHTML="<p><br></p>";sync();setHd(null)};
const dStart=e=>{if(!hd)return;drag.current=hd.el;e.dataTransfer.effectAllowed="move";e.dataTransfer.setData("text/plain"," ");e.dataTransfer.setDragImage(hd.el,0,0)};
const dOver=e=>{e.preventDefault();if(!drag.current)return;const t=blkAt(e.clientY);if(!t)return;const b=t.getBoundingClientRect(),after=e.clientY>b.top+b.height/2;setDp({el:t,after,y:(after?b.bottom:b.top)-wrap.current.getBoundingClientRect().top})};
const dEnd=()=>{drag.current=null;setDp(null)};
const dDrop=e=>{const d=drag.current;if(d){e.preventDefault();if(dp&&dp.el!==d){dp.after?dp.el.after(d):dp.el.before(d);sync()}dEnd();return}if(e.dataTransfer.files.length){e.preventDefault();const fs=[...e.dataTransfer.files],dc=fs.find(x=>/\.docx$/i.test(x.name));if(dc)impDocx(dc);else addImgs(fs)}};
useEffect(()=>{if(!bm)return;const f=e=>{if(!e.target.closest||!e.target.closest(".ewbm"))setBm(null)};document.addEventListener("mousedown",f);return()=>document.removeEventListener("mousedown",f)},[bm]);
const onInput=e=>{const ne=e&&e.nativeEvent,b=blockOf(),tx=b&&b.tagName==="P"?b.textContent.replace(/\u00a0/g," "):"",mm=tx.match(/^(#{1,3}|-|\*|\+|1\.|>|"|\[ ?\]) $/);
if(mm){b.innerHTML="<br>";caret(b);const mp={"#":"h1","##":"h2","###":"h3","-":"ul","*":"ul","+":"ul","1.":"ol",">":"quote",'"':"quote"};A[mp[mm[1]]||"ck"]();return}
if(b&&b.tagName==="P"&&(tx==="---"||tx==="___")){b.innerHTML="<br>";caret(b);A.hr();return}
if(b&&b.tagName==="P"&&tx==="```"){b.innerHTML="<br>";caret(b);A.code();return}
if(ne&&ne.inputType==="insertText"&&/[*`~]/.test(ne.data||"")&&inlMd()){sync();return}
slash(b);sync()};
const bkp=e=>{const s=getSelection();if(!s.rangeCount||!s.isCollapsed)return false;const b=blockOf();if(!b)return false;let el=null;if(/^H[1-3]$/.test(b.tagName))el=b;else if(b.tagName==="BLOCKQUOTE"){let c=s.anchorNode;while(c&&c.parentNode!==b)c=c.parentNode;if(c&&c.nodeType===1&&c.tagName==="DIV")el=c}if(!el)return false;const r0=document.createRange();r0.selectNodeContents(el);r0.setEnd(s.anchorNode,s.anchorOffset);if(r0.toString().replace(/\u200b/g,""))return false;e.preventDefault();if(el===b)fmt("p");else{const x=document.createElement("p");x.innerHTML=el.innerHTML||"<br>";if(b.querySelectorAll(":scope>div").length>1){el.remove();b.before(x)}else b.replaceWith(x);caret(x)}sync();return true};
const onKey=e=>{
const mod=e.metaKey||e.ctrlKey;
if(e.key==="Backspace"&&!sl&&bkp(e))return;
if(mod&&e.altKey&&/^Digit[0-3]$/.test(e.code)){e.preventDefault();A[["p","h1","h2","h3"][+e.code.slice(5)]]();return}
if(mod&&e.shiftKey&&!e.altKey&&/^Digit[789]$/.test(e.code)){e.preventDefault();A[{Digit7:"ol",Digit8:"ul",Digit9:"ck"}[e.code]]();return}
if(mod&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==="e"){e.preventDefault();inlCode();return}
if(mod&&e.shiftKey&&!e.altKey&&e.key.toLowerCase()==="s"){e.preventDefault();exec("strikeThrough");return}
if(sl&&flt.length){if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();setSl({...sl,i:(sl.i+(e.key==="ArrowDown"?1:-1)+flt.length)%flt.length});return}if(e.key==="Enter"){e.preventDefault();pick(flt[sl.i][0]);return}}
if(sl&&e.key==="Escape"){e.preventDefault();e.stopPropagation();setSl(null);return}
if(e.key==="Tab"){const c=up("td,th");if(c){e.preventDefault();const n=c.nextElementSibling||(c.parentNode.nextElementSibling&&c.parentNode.nextElementSibling.cells[0]);caret(n||addRow(c).cells[0])}}
if(e.key==="Enter"&&!e.shiftKey){const q=up("blockquote");if(q){let c=getSelection().anchorNode;while(c&&c.parentNode!==q)c=c.parentNode;if(c&&c.nodeType===1&&c.tagName==="DIV"&&!c.textContent.trim()){e.preventDefault();c.remove();const x=document.createElement("p");x.innerHTML="<br>";q.after(x);caret(x);sync()}}}
if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==="k"){e.preventDefault();link()}
if((e.metaKey||e.ctrlKey)&&e.shiftKey&&(e.key==="ArrowUp"||e.key==="ArrowDown")){e.preventDefault();const b=blockOf();if(b){mv(b,e.key==="ArrowUp"?-1:1);caret(b,true)}}
if((e.metaKey||e.ctrlKey)&&!e.shiftKey&&e.key.toLowerCase()==="d"){e.preventDefault();const b=blockOf();b&&dup(b)}};
const onClick=e=>{if(e.target===root.current){const l=root.current.lastElementChild;if(l&&l.tagName==="P"&&!l.textContent.trim())caret(l);else{const n=document.createElement("p");n.innerHTML="<br>";root.current.appendChild(n);caret(n)}return}const li=e.target.closest&&e.target.closest("li.ck");if(li&&e.clientX-li.getBoundingClientRect().left<26){li.classList.toggle("on");sync()}};
const save=overrideStatus=>{m==="w"&&sync();const finalStatus=overrideStatus||st;const finalVis=finalStatus!=="Approved"&&vs==="Public"?"Internal":vs;p.save({id:i.id,title:t.trim(),desc:ds.trim(),url:url.trim(),body:bdr.current,node:nd,type:ty,status:finalStatus,vis:finalVis,stage:sg,disc:dc,tags:tg.split(",").map(x=>x.trim()).filter(Boolean)})};
const Bt=(l,fn,tt,on)=>html`<button key=${(typeof l==="string"?l:"")+(tt||"")} className=${on?"on":""} title=${tt||(typeof l==="string"?l:"")} onMouseDown=${e=>e.preventDefault()} onClick=${fn}>${l}</button>`;
const V=k=>html`<i key=${k} className="ewv"></i>`;
const MP=(lb,v,o,set,c,isBtn)=>html`<${Select} key=${lb} variant=${isBtn?"pill":"meta"} color=${c} ariaLabel=${lb} displayLabel=${v} value=${o.find(x=>x[2])?.[0]??""} options=${o.map(x=>[x[0],x[1],Boolean(x[3])])} onChange=${set} minMenuWidth=${185} style=${isBtn?{height:36,padding:"0 14px",borderRadius:18,fontSize:14,background:"transparent",boxShadow:"0 0 0 1px var(--line)"}:undefined} />`;
const so=(l,cur,set,c)=>MP(l[0],l[1],l[2].map(x=>[x[0],x[1],x[0]===cur,x[2]]),set,c);
return html`<div className="ed-root">
<article className="rd">
<button className="back" onClick=${p.close}><${Ic} n="chev" s=${16}/>Back</button>
<header className="rdh">
<div className="ch2" style=${{paddingRight:0,marginBottom:16}}><span className="tl" style=${{"--c":DC[dc]}}><${Ic} n=${ty} s=${18}/></span><span className="who"><${Select} variant="inline" ariaLabel="Category" displayLabel=${curCat?curCat.path.join(" › "):"Category"} value=${nd} options=${flatCats.map(n=>[n.id,n.path.join(" › ")])} onChange=${val=>{const next=byId(val,p.tree);setNd(val);!i.id&&next&&setDc(RD[next.path[0]]||"VDC")}} minMenuWidth=${240} /></span></div>
<h1><input className="ewh1" placeholder="Title" value=${t} onChange=${e=>setT(e.target.value)} onKeyDown=${e=>{if(e.key==="Enter"){e.preventDefault();m==="w"&&caret(root.current)}}} autoFocus=${!i.id}/></h1>
<p className="lead"><textarea className="ewl" rows="1" placeholder="Short summary (required to publish)" value=${ds} ref=${el=>{if(el){el.style.height="auto";el.style.height=el.scrollHeight+"px"}}} onChange=${e=>setDs(e.target.value)} onKeyDown=${e=>{if(e.key==="Enter"){e.preventDefault();m==="w"&&caret(root.current)}}}></textarea></p>
${(["service","link","media","template"].includes(ty)||url)&&html`<div style=${{marginTop:10}}><input className="inp" placeholder="Target URL (https://... for tools, links or external templates)" value=${url} onChange=${e=>setUrl(e.target.value)}/></div>`}
${dupMatch&&html`<div className="box" style=${{marginTop:10}}><b>Possible Duplicate Detected</b>Matches existing item: “${dupMatch.title}” (${dupMatch.url||dupMatch.author}). Review before creating a duplicate.</div>`}
<div className="row" style=${{marginTop:14}}>
${so(["Status",(ST[st]||ST.Draft)[0],Object.entries(ST).map(([k,v])=>[k,v[0],!canPublishCat&&(k==="Approved"||k==="Archived")])],st,setSt,(ST[st]||ST.Draft)[1])}
${so(["Visibility",(VIS[vs]||VIS.Internal)[0],Object.entries(VIS).map(([k,v])=>[k,v[0],k==="Public"&&!can.publicize(p.role)])],vs,setVs,(VIS[vs]||VIS.Internal)[1])}
${so(["Type","Type: "+(TY[ty]||"Document"),Object.entries(TY)],ty,setTy)}
${so(["Stage","Stage: "+sg,STG.map(x=>[x,x])],sg,setSg)}
${so(["Discipline","Discipline: "+dc,DISC.map(x=>[x,x])],dc,setDc,DC[dc])}</div>
<div className="btns"><button className="btn p" disabled=${!t.trim()||(st==="Approved"&&ds.trim().length<5)} onClick=${()=>save()}>${normRole(p.role)==="Member"?"Save Draft":"Save"}</button>
${!canPublishCat&&st==="Draft"&&html`<button className="btn p" disabled=${!t.trim()||ds.trim().length<5} onClick=${()=>save("Review")}>Submit for Review</button>`}
<button className="btn" onClick=${p.close}>Cancel</button>
<button className="btn" disabled=${ib} title="Create an article from a Word document" onClick=${()=>dx.current.click()}>${ib?"Importing…":"Import .docx"}</button>
<button className=${"btn"+(m==="s"?" on":"")} onClick=${()=>{m==="w"&&sync();setM(m==="w"?"s":"w")}}>${m==="w"?"Markdown":"Visual editor"}</button>
${!i.id&&MP("Template","Template…",[["","Select template…",true,true],...Object.keys(TPL).map(k=>[k,k])],v=>{if(!v)return;if(bdr.current.trim()&&!confirm("Replace the current text with the template?"))return;bdr.current=TPL[v];m==="w"?load(TPL[v]):setM("w")},null,true)}
${i.id&&can.rollback(p.role,i,curCat,p.userName)&&html`<button className="btn" style=${{color:"#ff3b30"}} onClick=${()=>dl?p.del(i.id):setDl(true)}>${dl?"Really delete?":"Delete"}</button>`}</div></header>
<div className=${"rdl"+(toc.length>1?"":" one")}><div>
<div className="ewbw" ref=${wrap} onMouseMove=${onMove} onMouseEnter=${()=>clearTimeout(lt.current)} onMouseLeave=${()=>{lt.current=setTimeout(()=>setHd(null),300)}} onDragOver=${dOver} onDrop=${dDrop} onDragEnd=${dEnd}>${m==="w"?html`<div ref=${root} className="prose ewb" contentEditable="true" suppressContentEditableWarning=${true} spellCheck="true" role="textbox" aria-multiline="true" aria-label="Article text"
onInput=${onInput} onKeyDown=${onKey} onClick=${onClick}
onPaste=${e=>{const fs=[...e.clipboardData.files];e.preventDefault();if(fs.length){addImgs(fs);return}const tx=e.clipboardData.getData("text/plain");if(!tx)return;const u=tx.trim();if(/^https?:\/\/\S+$/.test(u)){const s=getSelection();if(s.rangeCount&&!s.isCollapsed)document.execCommand("createLink",false,u);else document.execCommand("insertHTML",false,'<a href="'+esc(u)+'">'+esc(u)+"</a>");sync();return}if(/\n/.test(u)&&/^(#{1,3} |[-*] |\d+\. |> |```|\|)/m.test(u)){put(toDom(u).innerHTML);return}document.execCommand("insertText",false,tx)}}
></div>
${hd&&html`<div className="ewh" style=${{top:hd.top}}><button title="Add block below" onClick=${plus}>+</button><button title="Drag to move · click for menu" draggable="true" onDragStart=${dStart} onDragEnd=${dEnd} onClick=${grip}><svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor"><circle cx="2" cy="3" r="1.4"/><circle cx="8" cy="3" r="1.4"/><circle cx="2" cy="8" r="1.4"/><circle cx="8" cy="8" r="1.4"/><circle cx="2" cy="13" r="1.4"/><circle cx="8" cy="13" r="1.4"/></svg></button></div>`}
${dp&&html`<div className="ewdp" style=${{top:dp.y-1}}></div>`}`:
html`<textarea key="src" className="ewsrc" defaultValue=${bdr.current} onChange=${e=>{bdr.current=e.target.value}} spellCheck="false"></textarea>`}</div>
<div className="row" style=${{marginTop:32}}><input className="ewg" placeholder="# tags separated by commas" value=${tg} onChange=${e=>setTg(e.target.value)}/></div>
</div>${toc.length>1&&html`<nav className="toc" aria-label="Contents"><b>Contents</b>${toc.map((x,k)=>html`<a key=${k} className=${x.l===3?"l3":""} onClick=${()=>{const h=root.current&&root.current.querySelectorAll("h1,h2,h3")[k];h&&h.scrollIntoView({behavior:"smooth",block:"center"})}}>${x.t}</a>`)}</nav>`}</div>
</article>
<input ref=${dx} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange=${e=>{impDocx(e.target.files[0]);e.target.value=""}}/>
<input ref=${fi} type="file" accept="image/*" multiple hidden onChange=${e=>{addImgs([...e.target.files]);e.target.value=""}}/>
${fb&&m==="w"&&html`<div className="ewf gx-g" style=${{left:fb.x,top:fb.y}}>${Bt("Text ▾",()=>{const b=blockOf();b&&setBm({el:b,x:fb.x-110,y:fb.y+42,mode:"turn"})},"Turn into")}${V(0)}${Bt(html`<b>B</b>`,()=>exec("bold"),"Bold (Ctrl+B)",fa.b)}${Bt(html`<i style=${{fontFamily:"serif"}}>I</i>`,()=>exec("italic"),"Italic (Ctrl+I)",fa.i)}${Bt(html`<s>S</s>`,()=>exec("strikeThrough"),"Strikethrough (Ctrl+Shift+S)",fa.s)}${Bt("<>",inlCode,"Code (Ctrl+E)",fa.c)}${V(1)}${Bt(fa.a?"Unlink":"Link",link,"Link (Ctrl+K)",fa.a)}</div>`}
${lk&&html`<div className="ewf ewlk gx-g" style=${{left:lk.x,top:lk.y}}><input autoFocus placeholder="Paste a link and press Enter" value=${lk.v} onChange=${e=>setLk({...lk,v:e.target.value})} onKeyDown=${e=>{if(e.key==="Enter"){e.preventDefault();applyLink(lk.v)}if(e.key==="Escape"){e.preventDefault();e.stopPropagation();setLk(null);const r=selR.current;if(r){root.current.focus();const s=getSelection();s.removeAllRanges();s.addRange(r)}}}}/><button onClick=${()=>applyLink(lk.v)}>Link</button></div>`}
${tb&&m==="w"&&html`<div className="ewf gx-g" style=${{left:tb.x,top:tb.y}}>${Bt("+ Row",()=>{const c=up("td,th");c&&caret(addRow(c).cells[0])})}${Bt("+ Column",addCol)}${V(1)}${Bt("− Row",delRow)}${Bt("− Column",delCol)}${V(2)}${Bt("Delete table",delTbl)}</div>`}
${bm&&html`<div className="ewbm gx-g" style=${{left:Math.max(8,Math.min(bm.x,innerWidth-250)),top:Math.max(8,Math.min(bm.y,innerHeight-(bm.mode==="all"?470:380)))}}><small>Turn into</small>${TURN.map(x=>html`<button key=${x[0]} onClick=${()=>turn(x[0])}><i>${x[2]}</i>${x[1]}</button>`)}
${bm.mode==="all"&&html`<hr/><button onClick=${()=>{dup(bm.el);setBm(null)}}><i>⧉</i>Duplicate<span className="ewk">Ctrl+D</span></button><button onClick=${()=>{mv(bm.el,-1);setBm(null)}}><i>↑</i>Up</button><button onClick=${()=>{mv(bm.el,1);setBm(null)}}><i>↓</i>Down</button><button className="dng" onClick=${()=>{rm(bm.el);setBm(null)}}><i>✕</i>Delete</button>`}</div>`}
${sl&&html`<div className="ewsl gx-g" style=${{left:sl.x,top:sl.y}} onMouseDown=${e=>e.preventDefault()}>${flt.length?flt.map((x,k)=>html`<${Fragment} key=${x[0]}>${!sl.q&&(k===0||flt[k-1][4]!==x[4])&&html`<div className="ewsh">${x[4]}</div>`}<button className=${k===sl.i?"on":""} onMouseEnter=${()=>setSl(o=>o&&o.i!==k?{...o,i:k}:o)} onClick=${()=>pick(x[0])}><i className="ewi">${x[3]}</i><span><b>${x[1]}</b><small>${x[2]}</small></span></button><//>`):html`<div className="ewno">No results</div>`}</div>`}
</div>`}