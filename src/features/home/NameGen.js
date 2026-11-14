import { html, useState } from '../../lib/react.js';
import { Select } from '../../components/Select.js';

export function NameGen(p){const [f,setF]=useState({p:"PRJ01",o:"ARC",v:"ZZ",l:"L01",t:"M3",n:"0001"});
const nm=[f.p,f.o,f.v,f.l,f.t,f.n].map(x=>x.trim().toUpperCase()).join("-")+(f.t==="M3"?".rvt":f.t==="DR"?".pdf":".xlsx");
const S=(k,lb,o)=>html`<div className="fg"><small>${lb}</small><${Select} variant="field" ariaLabel=${lb} value=${f[k]} options=${o} onChange=${val=>setF({...f,[k]:val})} minMenuWidth=${160} /></div>`;
const I=(k,lb)=>html`<label className="fg"><small>${lb}</small><input className="inp" value=${f[k]} onChange=${e=>setF({...f,[k]:e.target.value})}/></label>`;
const cp=()=>{try{navigator.clipboard.writeText(nm).then(()=>p.flash("Copied: "+nm),()=>p.flash("Could not copy"))}catch(e){p.flash("Could not copy")}};
return html`<div><div className="ng">${I("p","Project")}${S("o","Originator",[["ARC","Architecture"],["STR","Structure"],["MEP","Engineering"],["INT","Interior"],["VDC","VDC"]])}${S("v","Volume",[["ZZ","Entire site"],["Z1","Zone 1"],["Z2","Zone 2"]])}${S("l","Level",["L00","L01","L02","L03","L04","ZZ"].map(x=>[x,x]))}${S("t","Type",[["M3","3D model"],["DR","Drawing"],["SH","Schedule"]])}${I("n","Number")}</div>
<div className="nout"><code>${nm}</code><button className="btn p" onClick=${cp}>Copy</button></div></div>`}
