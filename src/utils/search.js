import { plain } from './markdown.js';

export const tok=s=>s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/).filter(w=>w.length>2);
export const hay=r=>r.title+" "+r.desc+" "+r.body+" "+r.tags.join(" ")+" "+r.author;
export const ask=(q,res)=>{const t=tok(q);return res.map(r=>{const h=tok(hay(r));let s=0;t.forEach(w=>{const st=w.slice(0,Math.max(3,w.length-2));h.forEach(x=>{if(x.startsWith(st))s++})});return[r,s]}).filter(x=>x[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0])};
export const summ=r=>{const b=plain(r.body);return((b.match(/[^.!?]+[.!?]/g)||[b]).slice(0,2).join(" ")).trim()};
export const sugTags=r=>{const c={};tok(r.title+" "+r.body).forEach(w=>{if(w.length>5)c[w]=(c[w]||0)+1});return Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,4).map(x=>x[0])};
