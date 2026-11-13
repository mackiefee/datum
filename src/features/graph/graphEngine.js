export const GD={hid:[],hard:true,soft:true,orph:true,arrows:true,loc:false,dp:1,lbl:.7,ns:.5,lw:.3,cf:.15,rf:.45,lf:.6,ld:.45};
export const gHex=s=>{s=(s||"").trim();if(s[0]!=="#")return[128,128,128];if(s.length===4)s="#"+s[1]+s[1]+s[2]+s[2]+s[3]+s[3];return[parseInt(s.slice(1,3),16),parseInt(s.slice(3,5),16),parseInt(s.slice(5,7),16)]};
export const gA=(c,a)=>"rgba("+c[0]+","+c[1]+","+c[2]+","+Math.max(0,Math.min(1,a)).toFixed(3)+")";
export const gMix=(c,t)=>"rgb("+c.map(v=>Math.round(v+(255-v)*t)).join(",")+")";
export const gCl=(v,a,b)=>Math.min(b,Math.max(a,v));
export const gTheme=el=>{const cs=getComputedStyle(el),v=k=>gHex(cs.getPropertyValue(k));return{ink:v("--text"),bg:v("--surface"),blue:v("--blue"),sub:v("--sub"),font:getComputedStyle(document.body).fontFamily}};
export const gEngine=()=>({nodes:[],edges:[],map:new Map(),adj:new Map(),order:[],alpha:1,target:0,view:{x:0,y:0,k:1},tgt:{x:0,y:0,k:1},w:0,h:0,dpr:1,ctx:null,th:null,S:GD,dirty:true,inited:false,hov:null,sel:null,match:null,fset:null,fid:null,offx:0,refit:0,key:"",reduce:false,fly:null,mt:"",mctx:null,bs:1});
export const gScr=(E,n)=>[E.w/2+E.view.x+n.x*E.view.k,E.h/2+E.view.y+n.y*E.view.k];
export const gRad=(E,n)=>n.r*gCl(Math.sqrt(E.view.k),.5,1.7);
export function gHit(E,x,y){const N=E.nodes;for(let i=N.length-1;i>=0;i--){const n=N[i],p=gScr(E,n),r=gRad(E,n)+5;if((x-p[0])**2+(y-p[1])**2<r*r)return n}return null}
export function gTick(E){const S=E.S,N=E.nodes,a=E.alpha,ld=30+S.ld*220,ls=.1+S.lf*1.3,ch=40+S.rf*900,g=S.cf*.22,as=gCl(E.w/Math.max(E.h,1),.6,2.4);
for(const e of E.edges){const s=e.s,t=e.t;let dx=t.x+t.vx-s.x-s.vx,dy=t.y+t.vy-s.y-s.vy,l=Math.hypot(dx,dy)||1e-6;l=(l-ld)/l*a*ls/Math.min(s.deg,t.deg);dx*=l;dy*=l;t.vx-=dx*e.bias;t.vy-=dy*e.bias;s.vx+=dx*(1-e.bias);s.vy+=dy*(1-e.bias)}
for(let i=0;i<N.length;i++){const A=N[i];for(let j=i+1;j<N.length;j++){const B=N[j];let dx=B.x-A.x,dy=B.y-A.y,d2=dx*dx+dy*dy;if(d2<1){dx=Math.random()-.5;dy=Math.random()-.5;d2=dx*dx+dy*dy+.001}
if(d2<250000){const w=ch*a/d2;A.vx-=dx*w;A.vy-=dy*w;B.vx+=dx*w;B.vy+=dy*w}
const ox=(A.bw+B.bw)/2*E.bs-Math.abs(dx),oy=(A.bh+B.bh)/2*E.bs-Math.abs(dy);if(ox>0&&oy>0){if(ox<oy){const f=ox*.18*(dx<0?-1:1);A.vx-=f;B.vx+=f}else{const f=oy*.18*(dy<0?-1:1);A.vy-=f;B.vy+=f}}}}
for(const n of N){n.vx-=n.x*g*a/as;n.vy-=n.y*g*a*as;if(n.fx!=null){n.x=n.fx;n.y=n.fy;n.vx=n.vy=0}else{n.vx*=.6;n.vy*=.6;n.x+=n.vx;n.y+=n.vy}}
E.alpha+=(E.target-E.alpha)*.0228}
export function gWarm(E,n){E.alpha=1;for(let i=0;i<n;i++)gTick(E);E.alpha=0}
export function gFit(E,instant){const N=E.nodes;if(!N.length||!E.w)return;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const n of N){x0=Math.min(x0,n.x-n.r);x1=Math.max(x1,n.x+n.r);y0=Math.min(y0,n.y-n.r);y1=Math.max(y1,n.y+n.r+16)}
const pad=Math.min(110,Math.min(E.w,E.h)*.15),k=gCl(Math.min((E.w-pad*2-E.offx*2)/Math.max(x1-x0,80),(E.h-pad*2)/Math.max(y1-y0,80)),.2,1.5);
E.tgt={k,x:-(x0+x1)/2*k+E.offx,y:-(y0+y1)/2*k};if(instant)E.view={...E.tgt};E.dirty=true}
export function gInit(E){if(E.inited||!E.w||!E.nodes.length)return;for(let i=0;i<3;i++){gWarm(E,i?140:260);gFit(E,true);E.bs=gCl(1/E.tgt.k,1,1.8)}gWarm(E,60);gFit(E,true);E.inited=true}
export function gZoom(E,mx,my,f){const t=E.tgt,nk=gCl(t.k*f,.15,5),wx=(mx-E.w/2-t.x)/t.k,wy=(my-E.h/2-t.y)/t.k;t.k=nk;t.x=mx-E.w/2-wx*nk;t.y=my-E.h/2-wy*nk;E.dirty=true}
export function gFocus(E){const f=E.hov||E.sel;let s=null;if(E.match){s=new Set(E.match);if(f&&E.map.has(f)){s.add(f);(E.adj.get(f)||[]).forEach(x=>s.add(x))}}else if(f&&E.map.has(f)){s=new Set([f]);(E.adj.get(f)||[]).forEach(x=>s.add(x))}
E.fset=s;E.fid=f&&E.map.has(f)?f:null;E.dirty=true}
export function gAnim(E){let ch=false;const s=E.fset,L=(o,k,t,sp)=>{const d=t-o[k];if(Math.abs(d)>.004){o[k]+=d*sp;ch=true}else o[k]=t};
for(const n of E.nodes){L(n,"hl",s?(s.has(n.id)?1:0):1,.22);L(n,"sr",n.id===E.sel?1:0,.25);L(n,"hv",n.id===E.hov?1:0,.3)}
for(const e of E.edges)L(e,"hot",E.fid&&(e.s.id===E.fid||e.t.id===E.fid)?1:0,.25);
const v=E.view,t=E.tgt,f=E.reduce?1:.2,dx=t.x-v.x,dy=t.y-v.y,dk=t.k-v.k;
if(Math.abs(dx)>.05||Math.abs(dy)>.05||Math.abs(dk)>.0004){v.x+=dx*f;v.y+=dy*f;v.k+=dk*f;ch=true}else{v.x=t.x;v.y=t.y;v.k=t.k}
if(ch)E.dirty=true}
export function gArrow(c,x1,y1,x2,y2,rt,sz){const dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy);if(l<rt*2+sz*2)return;const ux=dx/l,uy=dy/l,tx=x2-ux*(rt+3),ty=y2-uy*(rt+3);c.beginPath();c.moveTo(tx,ty);c.lineTo(tx-ux*sz+uy*sz*.52,ty-uy*sz-ux*sz*.52);c.lineTo(tx-ux*sz-uy*sz*.52,ty-uy*sz+ux*sz*.52);c.closePath();c.fill()}
export function gDraw(E){const c=E.ctx;if(!c||!E.w||!E.th)return;const{w,h,view:v,th,S}=E,k=v.k;
c.setTransform(E.dpr,0,0,E.dpr,0,0);c.clearRect(0,0,w,h);
let gs=40;while(gs*k<24)gs*=2;while(gs*k>=48)gs/=2;const st=gs*k,ox=((w/2+v.x)%st+st)%st,oy=((h/2+v.y)%st+st)%st;
c.fillStyle=gA(th.ink,.1);for(let x=ox;x<w;x+=st)for(let y=oy;y<h;y+=st)c.fillRect(x-.75,y-.75,1.5,1.5);
c.lineCap="round";const lw0=S.lw*2.4+.6;
for(const e of E.edges){const A=gScr(E,e.s),B=gScr(E,e.t),hard=e.k==="hard",vis=Math.min(e.s.hl,e.t.hl),lw=lw0*(hard?1.35:1),base=(hard?.34:.2)*(.12+.88*vis)*(1-e.hot);
c.setLineDash(hard?[]:[2+lw*1.5,4+lw*1.5]);
if(base>.004){c.strokeStyle=gA(th.ink,base);c.lineWidth=lw;c.beginPath();c.moveTo(A[0],A[1]);c.lineTo(B[0],B[1]);c.stroke()}
if(e.hot>.01){c.strokeStyle=gA(th.blue,.92*e.hot);c.lineWidth=lw+.9*e.hot;c.beginPath();c.moveTo(A[0],A[1]);c.lineTo(B[0],B[1]);c.stroke()}
if(S.arrows&&(base>.03||e.hot>.05)){c.setLineDash([]);c.fillStyle=e.hot>.05?gA(th.blue,.92*e.hot+.0):gA(th.ink,Math.min(.55,base*1.5));const sz=5+lw*1.2,toT=e.to===e.t.id;
if(toT||e.both)gArrow(c,A[0],A[1],B[0],B[1],gRad(E,e.t),sz);if(!toT||e.both)gArrow(c,B[0],B[1],A[0],A[1],gRad(E,e.s),sz)}}
c.setLineDash([]);
const O=E.order;O.length=0;for(const n of E.nodes)O.push(n);O.sort((a,b)=>(a.hl+a.sr*2+a.hv*2)-(b.hl+b.sr*2+b.hv*2));
for(const n of O){const p=gScr(E,n),r=gRad(E,n),ga=.16+.84*n.hl,act=Math.max(n.sr,n.hv);
if(p[0]<-60||p[1]<-60||p[0]>w+60||p[1]>h+60)continue;
c.globalAlpha=ga;
if(act>.02){c.shadowColor=gA(n.col,.65*act);c.shadowBlur=26*act}
const g=c.createRadialGradient(p[0]-r*.32,p[1]-r*.38,r*.08,p[0],p[1],r);g.addColorStop(0,gMix(n.col,.42));g.addColorStop(1,gA(n.col,1));
c.fillStyle=g;c.beginPath();c.arc(p[0],p[1],r,0,6.2832);c.fill();c.shadowBlur=0;c.shadowColor="transparent";
c.lineWidth=1.25;c.strokeStyle=gA(th.bg,.85);c.stroke();
if(n.hv>.02&&n.sr<.5){c.strokeStyle=gA(n.col,.45*n.hv);c.lineWidth=2;c.beginPath();c.arc(p[0],p[1],r+3.5,0,6.2832);c.stroke()}
if(n.sr>.02){c.strokeStyle=gA(th.blue,n.sr);c.lineWidth=2.25;c.beginPath();c.arc(p[0],p[1],r+4.5,0,6.2832);c.stroke()}}
c.globalAlpha=1;c.textAlign="center";c.textBaseline="alphabetic";c.lineJoin="round";
const thr=1.5*(1-S.lbl),s=E.fset;
for(const n of O){const p=gScr(E,n),r=gRad(E,n);if(p[0]<-120||p[1]<-60||p[0]>w+120||p[1]>h+60)continue;
let la=S.lbl>.985?1:gCl((k*(1+.12*n.deg)-thr)/.25,0,1);const inF=s&&s.has(n.id),big=n.hv>.3||n.sr>.3;
if(s)la=inF?Math.max(la,.96):la*.22;if(la<.02)continue;
c.font=(inF?600:500)+" 12px "+th.font;const tx=big?n.tf:n.tl,y=p[1]+r+16;
c.lineWidth=4;c.strokeStyle=gA(th.bg,.82*la);c.strokeText(tx,p[0],y);c.fillStyle=gA(th.ink,la*(inF||!s?1:.9));c.fillText(tx,p[0],y)}}
export function gCut(m,t,max){if(m.measureText(t).width<=max)return t;let a=0,b=t.length;while(a<b){const i=(a+b+1)>>1;m.measureText(t.slice(0,i)+"…").width<=max?a=i:b=i-1}return t.slice(0,a).trimEnd()+"…"}
