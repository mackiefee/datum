export const esc=t=>t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
export const inl=t=>esc(t).replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>').replace(/`([^`]+)`/g,"<code>$1</code>").replace(/~~([^~]+)~~/g,"<s>$1</s>").replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>").replace(/\*([^*\s][^*]*)\*/g,"<i>$1</i>");
export const plain=b=>b.replace(/!\[[^\]]*\]\([^)]*\)/g,"").replace(/[#>*`|]/g," ").replace(/\s+/g," ").trim();
export function md(src,im,chk){chk=chk||[];let ck=0,imgCount=0;const L=(src||"").split("\n"),o=[],toc=[];let i=0,p=[];const fl=()=>{p.length&&o.push("<p>"+inl(p.join(" "))+"</p>");p=[]};const LI=/^\s*([-*]|\d+\.)\s/;
while(i<L.length){const l=L[i];let m;
if(/^```/.test(l)){fl();const b=[];i++;while(i<L.length&&!/^```/.test(L[i]))b.push(L[i++]);o.push("<pre><code>"+esc(b.join("\n"))+"</code></pre>")}
else if(m=l.match(/^(#{1,3})\s+(.*)/)){fl();const lv=m[1].length,id="s"+toc.length;toc.push({id,t:m[2],l:lv});o.push("<h"+lv+' id="'+id+'">'+inl(m[2])+"</h"+lv+">")}
else if(/^---+$/.test(l)){fl();o.push("<hr>")}
else if(m=l.match(/^!\[([^\]]*)\]\(img:(\w+)\)\s*$/)){fl();const u=im[m[2]];if(u&&!u.startsWith("idb:")){const ld=imgCount++===0?"eager":"lazy";o.push('<figure><img src="'+u+'" data-id="'+m[2]+'" alt="'+esc(m[1])+'" loading="'+ld+'" decoding="async">'+(m[1]?"<figcaption>"+esc(m[1])+"</figcaption>":"")+"</figure>")}}
else if(/^>/.test(l)){fl();const b=[];while(i<L.length&&/^>/.test(L[i]))b.push(L[i++].replace(/^>\s?/,""));i--;let k="";const t=b.join(" ").replace(/^\[!(note|tip|warn)\]\s*/i,(a,x)=>(k=x.toLowerCase(),""));o.push('<blockquote class="'+k+'">'+(k?"<b>"+{note:"Note",tip:"Tip",warn:"Warning"}[k]+"</b>":"")+inl(t)+"</blockquote>")}
else if(LI.test(l)){fl();const ord=/^\s*\d+\./.test(l),b=[];while(i<L.length&&LI.test(L[i]))b.push(L[i++].replace(/^\s*([-*]|\d+\.)\s+/,""));i--;const T=ord?"ol":"ul";o.push("<"+T+">"+b.map(x=>{const c=x.match(/^\[( |x)\]\s+(.*)/i);if(c){const k=ck++,on=(c[1]!==" ")!==chk.includes(k);return'<li class="ck'+(on?" on":"")+'" data-k="'+k+'">'+inl(c[2])+"</li>"}return"<li>"+inl(x)+"</li>"}).join("")+"</"+T+">")}
else if(/^\|/.test(l)){fl();const b=[];while(i<L.length&&/^\|/.test(L[i]))b.push(L[i++]);i--;const rw=b.filter(x=>!/^\|[\s:|-]+\|?$/.test(x)).map(x=>x.replace(/^\||\|\s*$/g,"").split("|").map(c=>c.trim()));o.push('<div class="tw"><table>'+rw.map((r,k)=>"<tr>"+r.map(c=>(k?"<td>":"<th>")+inl(c)+(k?"</td>":"</th>")).join("")+"</tr>").join("")+"</table></div>")}
else if(!l.trim())fl();else p.push(l.trim());
i++}
fl();return{h:o.join(""),toc}}
export const ewW=(x,a,b)=>{const m=x.match(/^(\s*)([\s\S]*?)(\s*)$/);return m[2]?m[1]+a+m[2]+b+m[3]:x};
export function ewInl(n){let s="";n.childNodes.forEach(c=>{if(c.nodeType===3){s+=c.nodeValue.replace(/\u200b/g,"").replace(/\u00a0/g," ");return}if(c.nodeType!==1)return;const t=c.tagName;
if(t==="UL"||t==="OL"||(t==="B"&&c.getAttribute("contenteditable")==="false"))return;if(t==="BR"){s+=" ";return}let x=ewInl(c);
if(t==="B"||t==="STRONG")x=ewW(x,"**","**");else if(t==="I"||t==="EM")x=ewW(x,"*","*");else if(t==="CODE")x=ewW(x,"`","`");else if(t==="S"||t==="STRIKE"||t==="DEL")x=ewW(x,"~~","~~");
else if(t==="A"){const h=c.getAttribute("href")||"";x=/^https?:/.test(h)?"["+x+"]("+h+")":x}else if(/^(P|DIV|LI|H[1-6]|BLOCKQUOTE|TR)$/.test(t))x=" "+x+" ";s+=x});return s}
export function ewTx(n){let s="";n.childNodes.forEach(c=>{if(c.nodeType===3)s+=c.nodeValue.replace(/\u200b/g,"");else if(c.tagName==="BR")s+="\n";else{const x=ewTx(c);s+=(/^(DIV|P)$/.test(c.tagName)&&s&&!/\n$/.test(s)?"\n":"")+x}});return s}
export function ewMd(root,imgs){const o=[];let rev=null;const par=n=>ewInl(n).replace(/\s+/g," ").trim();
const blk=n=>{if(n.nodeType===3){const t=n.nodeValue.replace(/\s+/g," ").trim();t&&o.push(t);return}if(n.nodeType!==1)return;const t=n.tagName;
if(t==="H1"){const x=par(n);x&&o.push("# "+x)}
else if(t==="H2"){const x=par(n);x&&o.push("## "+x)}
else if(/^H[3-6]$/.test(t)){const x=par(n);x&&o.push("### "+x)}
else if(t==="UL"||t==="OL"){const r=[];n.querySelectorAll("li").forEach(li=>{const x=par(li);if(!x)return;r.push((t==="OL"?"1. ":li.classList.contains("ck")?"- ["+(li.classList.contains("on")?"x":" ")+"] ":"- ")+x)});r.length&&o.push(r.join("\n"))}
else if(t==="BLOCKQUOTE"){const k=["note","tip","warn"].find(c=>n.classList.contains(c))||"",x=par(n);x&&o.push("> "+(k?"[!"+k+"] ":"")+x)}
else if(t==="PRE"){o.push("```\n"+ewTx(n).replace(/\n+$/,"")+"\n```")}
else if(t==="TABLE"){const R=[...n.rows].map(r=>[...r.cells].map(c=>par(c).replace(/\|/g,"/")||"\u200b"));if(R.length){const L=R.map(r=>"| "+r.join(" | ")+" |");L.splice(1,0,"|"+R[0].map(()=>"---").join("|")+"|");o.push(L.join("\n"))}}
else if(t==="HR")o.push("---");
else if(t==="FIGURE"){const im=n.querySelector("img");if(!im)return;rev=rev||new Map(Object.entries(imgs).map(([k,v])=>[v,k]));const id=im.getAttribute("data-id")||rev.get(im.getAttribute("src")),c=n.querySelector("figcaption");id&&o.push("!["+(c?par(c):"").replace(/[\[\]]/g,"")+"](img:"+id+")")}
else if((t==="DIV"||t==="P")&&[...n.children].some(c=>/^(DIV|P|H\d|UL|OL|TABLE|PRE|BLOCKQUOTE|FIGURE|HR)$/.test(c.tagName)))n.childNodes.forEach(blk);
else{const x=par(n);x&&o.push(x)}};
root.childNodes.forEach(blk);return o.join("\n\n")}
