export const esc=t=>String(t||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
export const inl=t=>esc(t).replace(/\[\[([^|\]]+)\|(\d+)\]\]/g,'<a href="#doc-$2" data-wiki-id="$2" class="datum-wiki-lk">$1</a>').replace(/\[\[([^|\]]+)\]\]/g,'<span class="datum-wiki-unresolved">$1</span>').replace(/\[([^\]]+)\]\(((?:utk:\/\/open\?|(?:https?:\/\/[^)\s]+)?\/open[?#]|https?:)[^)\s]+)\)/gi,(a,l,u)=>/^(?:utk:\/\/open\?|(?:https?:\/\/[^)\s]+)?\/open[?#])/i.test(u)?'<a href="'+u+'" class="rvt-lk">'+l+'</a>':'<a href="'+u+'" target="_blank" rel="noopener noreferrer">'+l+'</a>').replace(/`([^`]+)`/g,"<code>$1</code>").replace(/==(?:\[([a-z]+)\])?([^=]+)==/g,(a,c,x)=>c?'<mark data-hl="'+c+'">'+x+'</mark>':'<mark>'+x+'</mark>').replace(/%%\[([a-z]+)\]([^%]+)%%/g,'<span data-c="$1">$2</span>').replace(/\+\+([^+]+)\+\+/g,"<u>$1</u>").replace(/~~([^~]+)~~/g,"<s>$1</s>").replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>").replace(/\*([^*\s][^*]*)\*/g,"<i>$1</i>");
export const plain=b=>String(b||"").replace(/\[\[([^|\]]+)\|[^\]]*\]\]/g,"$1").replace(/\[\[([^\]]+)\]\]/g,"$1").replace(/!\[[^\]]*\]\([^)]*\)/g,"").replace(/^:::(?:toggle|cards|quote|qa)\s*/gim," ").replace(/^:::\s*$/gim," ").replace(/\s*::\s*/g," ").replace(/\{align=(?:center|right|left)\}\s*/g,"").replace(/%%\[[a-z]+\]|%%/g,"").replace(/==\[[a-z]+\]/g,"==").replace(/[#>*`|]/g," ").replace(/\s+/g," ").trim();

const bodyToPars=lines=>{
  const joined=lines.join("\n").trim();
  if(!joined)return "";
  return joined.split(/\n{2,}/).map(ch=>ch.trim()).filter(Boolean).map(ch=>"<p>"+inl(ch.replace(/\n+/g,"<br>"))+"</p>").join("");
};

export function md(src,im,chk){
  chk=chk||[];
  let ck=0,imgCount=0;
  const L=(src||"").split("\n"),o=[],toc=[];
  let i=0,p=[];
  const fl=()=>{if(!p.length)return;let tx=p.join(" "),al="";tx=tx.replace(/^\{align=(center|right)\}\s*/,(a,x)=>(al=' style="text-align:'+x+'"',""));o.push("<p"+al+">"+inl(tx)+"</p>");p=[]};
  const LI=/^\s*([-*]|\d+\.)\s/;
  while(i<L.length){
    const l=L[i];
    let m;
    if(/^```/.test(l)){fl();const b=[];i++;while(i<L.length&&!/^```/.test(L[i]))b.push(L[i++]);o.push("<pre><code>"+esc(b.join("\n"))+"</code></pre>")}
    else if(/^:::cards\s*$/i.test(l)){
      fl();
      const b=[];i++;
      while(i<L.length&&!/^:::\s*$/.test(L[i]))b.push(L[i++]);
      const items=b.map(cl=>cl.replace(/^\s*[-*]\s+/,"").trim()).filter(Boolean).map(cl=>{
        const sp=cl.match(/^\*\*(.+?)\*\*\s*::\s*(.*)$/)||cl.match(/^([^:]{1,90}?)\s*::\s*(.*)$/);
        return sp?{t:sp[1].trim(),d:sp[2].trim()}:{t:"",d:cl};
      });
      if(!items.length)items.push({t:"",d:""});
      o.push('<div class="ed-cards" data-blk="cards" contenteditable="false"><div class="ed-cards-grid">'+items.map(it=>'<div class="ed-card"><span class="ed-card-dot" contenteditable="false"></span><div class="ed-card-body"><div class="ed-card-t" data-ph="Card title" contenteditable="true">'+(it.t?inl(it.t):"")+'</div><div class="ed-card-d" data-ph="Description…" contenteditable="true">'+(it.d?inl(it.d):"")+'</div></div><button type="button" class="ed-card-rm" contenteditable="false" aria-label="Remove card">×</button></div>').join("")+'</div><button type="button" class="ed-card-add" contenteditable="false">+ Add card</button></div>');
    }
    else if(m=l.match(/^:::quote\s*(.*)/i)){
      fl();
      const hdr=(m[1]||"").trim();
      const pts=hdr?hdr.split("|").map(x=>x.trim()):["",""];
      const au=pts[0]||"",rl=pts[1]||"";
      const b=[];i++;
      while(i<L.length&&!/^:::\s*$/.test(L[i]))b.push(L[i++]);
      o.push('<div class="ed-qcard" data-blk="qcard" contenteditable="false"><div class="ed-q-head"><div class="ed-q-meta"><div class="ed-q-author" data-ph="Author name" contenteditable="true">'+(au?inl(au):"")+'</div><div class="ed-q-role" data-ph="Role or team" contenteditable="true">'+(rl?inl(rl):"")+'</div></div><span class="ed-q-mark" contenteditable="false">“</span></div><div class="ed-q-body" data-ph="Write quote or highlight…" contenteditable="true">'+bodyToPars(b)+'</div></div>');
    }
    else if(m=l.match(/^:::qa\s*(.*)/i)){
      fl();
      const q=(m[1]||"").trim();
      const b=[];i++;
      while(i<L.length&&!/^:::\s*$/.test(L[i]))b.push(L[i++]);
      o.push('<div class="ed-qa" data-blk="qa" contenteditable="false"><div class="ed-qa-head"><span class="ed-qa-badge" contenteditable="false">Q</span><div class="ed-qa-q" data-ph="Write interview question…" contenteditable="true">'+(q?inl(q):"")+'</div></div><div class="ed-qa-a" data-ph="Write answer…" contenteditable="true">'+bodyToPars(b)+'</div></div>');
    }
    else if(m=l.match(/^:::toggle\s*(.*)/i)){fl();const sum=m[1]||"Toggle";const b=[];i++;while(i<L.length&&!/^:::\s*$/.test(L[i]))b.push(L[i++]);o.push('<details class="tgl" open><summary>'+inl(sum)+'</summary><div class="tgl-b">'+inl(b.join(" ")||" ")+"</div></details>")}
    else if(m=l.match(/^(?:\{align=(center|right)\}\s*)?(#{1,3})\s+(.*)/)){fl();const al=m[1]?' style="text-align:'+m[1]+'"':"",lv=m[2].length,id="s"+toc.length,cleanT=m[3].replace(/\[\[([^|\]]+)\|[^\]]*\]\]/g,"$1").replace(/\[\[([^\]]+)\]\]/g,"$1").replace(/`([^`]+)`/g,"$1").replace(/==(?:\[[a-z]+\])?([^=]+)==/g,"$1").replace(/%%\[[a-z]+\]([^%]+)%%/g,"$1").replace(/\+\+([^+]+)\+\+/g,"$1").replace(/\*\*([^*]+)\*\*/g,"$1").replace(/\*([^*]+)\*/g,"$1").replace(/~~([^~]+)~~/g,"$1").trim();toc.push({id,t:cleanT,l:lv});o.push("<h"+lv+' id="'+id+'"'+al+">"+inl(m[3])+"</h"+lv+">")}
    else if(/^---+$/.test(l)){fl();o.push("<hr>")}
    else if(m=l.match(/^!\[([^\]]*)\]\((img:\w+|(?:https?:\/\/|data:image\/)(?:[^\s|()]|\([^)\s]*\))+)(?:\|(\d+))?\)\s*$/)){
      fl();
      const ref=m[2],w=m[3]&&m[3]!=="100"?m[3]:"";
      let u=ref,idAttr="";
      if(ref.startsWith("img:")){const k=ref.slice(4);u=im&&im[k];idAttr=' data-id="'+k+'"';}
      if(u&&!u.startsWith("idb:")){const ld=imgCount++===0?"eager":"lazy";o.push("<figure"+(w?' data-w="'+w+'"':"")+'><img src="'+esc(u)+'"'+idAttr+(w?' data-w="'+w+'"':"")+' alt="'+esc(m[1])+'" loading="'+ld+'" decoding="async">'+(m[1]?"<figcaption>"+esc(m[1])+"</figcaption>":"")+"</figure>")}
    }
    else if(/^>/.test(l)){fl();const b=[];while(i<L.length&&/^>/.test(L[i]))b.push(L[i++].replace(/^>\s?/,""));i--;let k="";const t=b.join(" ").replace(/^\[!(note|tip|warn)\]\s*/i,(a,x)=>(k=x.toLowerCase(),""));o.push('<blockquote class="'+k+'">'+(k?"<b>"+{note:"Note",tip:"Tip",warn:"Warning"}[k]+"</b>":"")+inl(t)+"</blockquote>")}
    else if(LI.test(l)){fl();const ord=/^\s*\d+\./.test(l),b=[];while(i<L.length&&LI.test(L[i]))b.push(L[i++].replace(/^\s*([-*]|\d+\.)\s+/,""));i--;const T=ord?"ol":"ul";o.push("<"+T+">"+b.map(x=>{const c=x.match(/^\[( |x)\]\s+(.*)/i);if(c){const k=ck++,on=(c[1]!==" ")!==chk.includes(k);return'<li class="ck'+(on?" on":"")+'" data-k="'+k+'">'+inl(c[2])+"</li>"}return"<li>"+inl(x)+"</li>"}).join("")+"</"+T+">")}
    else if(/^\|/.test(l)){fl();const b=[];while(i<L.length&&/^\|/.test(L[i]))b.push(L[i++]);i--;const rw=b.filter(x=>!/^\|[\s:|-]+\|?$/.test(x)).map(x=>x.replace(/^\||\|\s*$/g,"").split("|").map(c=>c.trim()));o.push('<div class="tw"><table>'+rw.map((r,k)=>"<tr>"+r.map(c=>(k?"<td>":"<th>")+inl(c)+(k?"</td>":"</th>")).join("")+"</tr>").join("")+"</table></div>")}
    else if(!l.trim())fl();else p.push(l.trim());
    i++
  }
  fl();
  return{h:o.join(""),toc}
}

export const ewW=(x,a,b)=>{const m=x.match(/^(\s*)([\s\S]*?)(\s*)$/);return m[2]?m[1]+a+m[2]+b+m[3]:x};
export function ewInl(n){let s="";n.childNodes.forEach(c=>{if(c.nodeType===3){s+=c.nodeValue.replace(/\u200b/g,"").replace(/\u00a0/g," ");return}if(c.nodeType!==1)return;const t=c.tagName;
if(t==="UL"||t==="OL"||(t==="B"&&c.getAttribute("contenteditable")==="false"))return;if(t==="BR"){s+=" ";return}let x=ewInl(c);
if(t==="B"||t==="STRONG")x=ewW(x,"**","**");else if(t==="I"||t==="EM")x=ewW(x,"*","*");else if(t==="U")x=ewW(x,"++","++");else if(t==="MARK"){const h=c.getAttribute("data-hl");x=ewW(x,"=="+(h?"["+h+"]":""),"==")}else if(t==="SPAN"&&c.getAttribute("data-c")){x=ewW(x,"%%["+c.getAttribute("data-c")+"]","%%")}else if(t==="CODE")x=ewW(x,"`","`");else if(t==="S"||t==="STRIKE"||t==="DEL")x=ewW(x,"~~","~~");
else if(t==="A"){const wid=c.getAttribute("data-wiki-id"),h=c.getAttribute("href")||"";x=wid?"[["+x+"|"+wid+"]]":/^(?:https?:|utk:\/\/open\?|\/open[?#])/i.test(h)?"["+x+"]("+h+")":x}else if(/^(P|DIV|LI|H[1-6]|BLOCKQUOTE|TR)$/.test(t))x=" "+x+" ";s+=x});return s}
export function ewTx(n){let s="";n.childNodes.forEach(c=>{if(c.nodeType===3)s+=c.nodeValue.replace(/\u200b/g,"");else if(c.tagName==="BR")s+="\n";else{const x=ewTx(c);s+=(/^(DIV|P)$/.test(c.tagName)&&s&&!/\n$/.test(s)?"\n":"")+x}});return s}
export function ewMd(root,imgs){
  const o=[];let rev=null;
  const par=n=>n?ewInl(n).replace(/\s+/g," ").trim():"";
  const al=n=>{const a=n.style&&n.style.textAlign;return a==="center"||a==="right"?"{align="+a+"} ":""};
  const multiPar=el=>{
    if(!el)return "";
    const ps=[];let cur=[];
    el.childNodes.forEach(c=>{
      if(c.nodeType===1&&/^(P|DIV)$/.test(c.tagName)){
        if(cur.length){const s=cur.join("").replace(/[ \t]+/g," ").trim();s&&ps.push(s);cur=[];}
        const t=par(c);t&&ps.push(t);
      }else if(c.nodeType===1&&c.tagName==="BR"){
        cur.push("\n");
      }else if(c.nodeType===3){
        cur.push(c.nodeValue.replace(/\u200b/g,"").replace(/\u00a0/g," "));
      }else if(c.nodeType===1){
        cur.push(ewInl(c));
      }
    });
    if(cur.length){const s=cur.join("").replace(/\n{2,}/g,"\n\n").replace(/[ \t]+/g," ").trim();s&&ps.push(s);}
    return ps.join("\n\n");
  };
  const blk=n=>{
    if(n.nodeType===3){const t=n.nodeValue.replace(/\s+/g," ").trim();t&&o.push(t);return}
    if(n.nodeType!==1)return;
    const t=n.tagName,cls=n.classList;
    if(cls&&(cls.contains("ed-cards")||n.getAttribute("data-blk")==="cards")){
      const lines=[];
      n.querySelectorAll(".ed-card").forEach(card=>{
        const ct=par(card.querySelector(".ed-card-t")),cd=par(card.querySelector(".ed-card-d"));
        if(ct&&cd)lines.push("**"+ct+"** :: "+cd);
        else if(ct)lines.push("**"+ct+"** :: ");
        else if(cd)lines.push(cd);
      });
      o.push(":::cards\n"+lines.join("\n")+"\n:::");
      return;
    }
    if(cls&&(cls.contains("ed-qcard")||n.getAttribute("data-blk")==="qcard")){
      const au=par(n.querySelector(".ed-q-author")),rl=par(n.querySelector(".ed-q-role")),bd=multiPar(n.querySelector(".ed-q-body"));
      const hd=[au,rl].filter(Boolean).join(" | ");
      o.push(":::quote"+(hd?" "+hd:"")+"\n"+bd+"\n:::");
      return;
    }
    if(cls&&(cls.contains("ed-qa")||n.getAttribute("data-blk")==="qa")){
      const qq=par(n.querySelector(".ed-qa-q")),aa=multiPar(n.querySelector(".ed-qa-a"));
      o.push(":::qa"+(qq?" "+qq:"")+"\n"+aa+"\n:::");
      return;
    }
    if(t==="H1"){const x=par(n);x&&o.push(al(n)+"# "+x)}
    else if(t==="H2"){const x=par(n);x&&o.push(al(n)+"## "+x)}
    else if(/^H[3-6]$/.test(t)){const x=par(n);x&&o.push(al(n)+"### "+x)}
    else if(t==="UL"||t==="OL"){const r=[];n.querySelectorAll("li").forEach(li=>{const x=par(li);if(!x)return;r.push((t==="OL"?"1. ":li.classList.contains("ck")?"- ["+(li.classList.contains("on")?"x":" ")+"] ":"- ")+x)});r.length&&o.push(r.join("\n"))}
    else if(t==="BLOCKQUOTE"){const k=["note","tip","warn"].find(c=>n.classList.contains(c))||"",x=par(n);x&&o.push("> "+(k?"[!"+k+"] ":"")+x)}
    else if(t==="PRE"){o.push("```\n"+ewTx(n).replace(/\n+$/,"")+"\n```")}
    else if(t==="DETAILS"){const sm=n.querySelector("summary");const st=(sm?par(sm):"Toggle")||"Toggle";let bx="";n.childNodes.forEach(c=>{if(c!==sm)bx+=(bx?" ":"")+par(c)});o.push(":::toggle "+st+"\n"+(bx.trim()||" ")+"\n:::")}
    else if(t==="TABLE"){const R=[...n.rows].map(r=>[...r.cells].map(c=>par(c).replace(/\|/g,"/")||"\u200b"));if(R.length){const L=R.map(r=>"| "+r.join(" | ")+" |");L.splice(1,0,"|"+R[0].map(()=>"---").join("|")+"|");o.push(L.join("\n"))}}
    else if(t==="HR")o.push("---");
    else if(t==="FIGURE"){
      const im=n.querySelector("img");if(!im)return;
      rev=rev||new Map(Object.entries(imgs||{}).map(([k,v])=>[v,k]));
      const src=im.getAttribute("src")||"",id=im.getAttribute("data-id")||rev.get(src),c=n.querySelector("figcaption"),w=n.getAttribute("data-w")||im.getAttribute("data-w");
      const cap=(c?par(c):"").replace(/[\[\]]/g,"");
      const ref=id?"img:"+id:/^(?:https?:\/\/|data:image\/)/i.test(src)?src:"";
      ref&&o.push("!["+cap+"]("+ref+(w&&w!=="100"?"|"+w:"")+")");
    }
    else if((t==="DIV"||t==="P")&&[...n.children].some(c=>/^(DIV|P|H\d|UL|OL|TABLE|PRE|BLOCKQUOTE|DETAILS|FIGURE|HR)$/.test(c.tagName)))n.childNodes.forEach(blk);
    else{const x=par(n);x&&o.push(al(n)+x)}
  };
  root.childNodes.forEach(blk);
  return o.join("\n\n")
}
