import { html, useState, useEffect } from '../../lib/react.js';
import { ls } from '../../utils/storage.js';
import { PUB } from '../../data/templates.js';
import { Ic } from '../../components/Icon.js';

export function PubList(){const [c,setC]=useState(()=>ls.get("kb2-pub")||[]);useEffect(()=>{ls.set("kb2-pub",c)},[c]);
const tg=i=>setC(a=>a.includes(i)?a.filter(x=>x!==i):[...a,i]);
return html`<div><ul className="pl">${PUB.map((t,i)=>html`<li key=${i}><button className=${"ckb"+(c.includes(i)?" on":"")} aria-label=${t} onClick=${()=>tg(i)}>${c.includes(i)&&html`<${Ic} n="check" s=${12}/>`}</button><span className=${c.includes(i)?"dn":""}>${t}</span></li>`)}</ul>
<div className="row" style=${{marginTop:10}}><span>${c.length} of ${PUB.length}${c.length===PUB.length?" · Ready to publish":""}</span><button className="mn" style=${{marginLeft:"auto"}} onClick=${()=>setC([])}>Reset</button></div></div>`}
