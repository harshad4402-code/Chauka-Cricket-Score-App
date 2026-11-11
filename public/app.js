const $=s=>document.querySelector(s),uid=()=>Math.random().toString(36).slice(2,9),K='gullyscore.v1';
const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const BRAND='Gully Live',WM=()=>{const[a,...r]=BRAND.split(' ');return E(a)+(r.length?'<span>'+E(r.join(' '))+'</span>':'')};
/* NOTE: inline onclick handlers look names up on document first. Never name a global open/close/write/title/location etc, or the handler calls the document method instead (this is what caused the white screen). */
addEventListener('error',e=>{const a=$('#app');if(a&&!a.children.length)fail(e.error||e.message)});
addEventListener('unhandledrejection',e=>console.error('Unhandled promise rejection',e.reason));
let RESTORE=false,op=[],S,view='home',cur=null,tab='score',tsel=null,mod='',modOpen=false,skipPop=false,q='',tf='',px=null,nm={a:'',b:'',o:5,f:0,tid:null,fi:null};
let syncMsg='',pend=null,pushing=false,again=false,polling=false,noPoll=false,tc=0,bgRefresh=false;
const DK=K+'.dirty',TK='gullylive.theme',KK='gullylive.keys',XK='gullylive.del',MK='gullylive.dm';
const lsGet=k=>{try{return localStorage.getItem(k)}catch(e){return null}},lsSet=(k,v)=>{try{localStorage.setItem(k,v);return true}catch(e){return false}},lsDel=k=>{try{localStorage.removeItem(k)}catch(e){}};
const okS=d=>!!d&&typeof d=='object'&&Array.isArray(d.teams)&&Array.isArray(d.matches)&&Array.isArray(d.tours);
const isWipe=(d,l)=>!!l&&okS(d)&&!d.teams.length&&!d.matches.length&&!d.tours.length&&!!(l.teams.length||l.matches.length||l.tours.length);
/* the server came back empty (restart on a host without disk, or lost file) but this device still has the data: send it back */
function restore(){RESTORE=true;syncMsg='Restoring your data to the server…';lsSet(DK,'1');push()}
const ft=(u,o,ms)=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),ms||8000);return fetch(u,{...o,signal:c.signal}).finally(()=>clearTimeout(t))};
/* ---- scorer keys: only the device that holds a match's key can score or delete it. The server checks this too. ---- */
const lj=(k,d)=>{try{const v=JSON.parse(lsGet(k));return v&&typeof v=='object'?v:d}catch(e){return d}};
let KEYS=lj(KK,{}),DM=lj(MK,{}),DEL=(d=>({teams:d.teams||[],matches:d.matches||[],tours:d.tours||[]}))(lj(XK,{}));
let EVN={},PREV={},force=null,netBad=0,off=false,nextTry=0,backoff=0,lastChange=Date.now(),holdT=null,keyIn=false,warned=false;
const saveKeys=()=>lsSet(KK,JSON.stringify(KEYS)),saveDel=()=>lsSet(XK,JSON.stringify(DEL)),saveDM=()=>lsSet(MK,JSON.stringify(DM));
const newKey=()=>{const a=new Uint8Array(18);try{crypto.getRandomValues(a)}catch(e){for(let i=0;i<18;i++)a[i]=Math.random()*256}return[...a].map(b=>b.toString(36).padStart(2,'0')).join('')};
const setKey=(id,k)=>{KEYS[id]=k;saveKeys()};
/* a match with no owner on the server yet (created before this update) can be claimed by whoever scores it first */
const can=m=>!!m&&(!!KEYS[m.id]||!m.lk);
function auth(m){if(!can(m)){toast('View only: only the scorer can change this match');return false}if(!KEYS[m.id])setKey(m.id,newKey());m.ver=(m.ver||0)+1;DM[m.id]=m.ver;saveDM();return true}
/* ---- connection pill ---- */
function netShow(msg,kind,ms){const n=$('#net');if(!n)return;clearTimeout(netShow.t);n.textContent=msg;n.className='net show'+(kind?' '+kind:'');if(ms)netShow.t=setTimeout(netHide,ms)}
function netHide(){const n=$('#net');if(n)n.className='net'}
const netText=()=>lsGet(DK)?'Offline · scores are saved on this device and will sync when you are back online':view=='watch'||(view=='match'&&cur&&!can(cur_()))?'Offline · showing the last score. It updates when you are back online':'Offline · everything is saved on this device';
function markOff(){netBad++;if(!off&&(netBad>=2||navigator.onLine===false)){off=true;netShow(netText())}}
function markOn(){netBad=0;if(off){off=false;netShow(lsGet(DK)?'Back online · syncing…':'Back online','ok',2200)}}
function warn(){if(warned)return;warned=true;toast('Phone storage is full. Free some space so scores are not lost')}
/* ---- saving ---- */
function flush(){pend=null;if(!lsSet(K,JSON.stringify(S)))warn();lsSet(DK,'1');push()}
const save=()=>{clearTimeout(pend);syncMsg='Saving…';const s=$('#sy');if(s)s.textContent=syncMsg;pend=setTimeout(flush,400)};
/* only matches changed on this device are sent, and never their undo history */
function body(){const ms=S.matches.filter(m=>(KEYS[m.id]&&DM[m.id]!==undefined)||(RESTORE&&(KEYS[m.id]||!m.lk))),keys={},sent={v:{},d:{teams:[...DEL.teams],matches:[...DEL.matches],tours:[...DEL.tours]}};
ms.forEach(m=>{keys[m.id]=KEYS[m.id];sent.v[m.id]=DM[m.id]});DEL.matches.forEach(i=>{if(KEYS[i])keys[i]=KEYS[i]});
return{json:JSON.stringify({teams:S.teams,matches:ms,tours:S.tours,keys,del:sent.d},(k,v)=>k=='h'?undefined:v),sent}}
async function push(){if(pushing){again=true;return}pushing=true;
try{const{json,sent}=body(),r=await ft('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:json},15000);
if(r.status==503||r.status==404){noPoll=true;if(!again&&!pend)lsDel(DK);syncMsg='Saved on this device';markOn()}
else{if(!r.ok)throw 0;const j=await r.json().catch(()=>({})),rj=Array.isArray(j.rej)?j.rej:[];RESTORE=false;
if(j&&j.rev&&j.prev===S.rev)S.rev=j.rev;
Object.keys(sent.v).forEach(id=>{if(DM[id]===sent.v[id])delete DM[id]});
['teams','matches','tours'].forEach(k=>DEL[k]=DEL[k].filter(i=>!sent.d[k].includes(i)));sent.d.matches.forEach(i=>{delete KEYS[i];delete DM[i]});
if(rj.length){force=force||new Set();rj.forEach(x=>{if(!x||!x.id)return;force.add(x.id);delete DM[x.id];if(x.why=='key')delete KEYS[x.id]});S.rev=0;toast('Another device is scoring this match. Showing its latest score.');setTimeout(()=>poll(true),50)}
saveKeys();saveDM();saveDel();if(!again&&!pend)lsDel(DK);syncMsg='Saved';backoff=0;markOn()}}
catch(e){syncMsg='Offline: saved on this device';markOff();backoff=Math.min(30000,(backoff||1500)*2);nextTry=Date.now()+backoff}
pushing=false;if(again){again=false;return push()}const s=$('#sy');if(s)s.textContent=syncMsg}
addEventListener('online',()=>{netBad=2;nextTry=0;if(lsGet(DK))push();else poll(true)});
addEventListener('offline',()=>{netBad=2;markOff()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){if(pend){clearTimeout(pend);flush()}}else{nextTry=0;poll(true)}});
addEventListener('pagehide',()=>{if(pend){clearTimeout(pend);lsSet(K,JSON.stringify(S));lsSet(DK,'1')}});
/* ---- live sync: other devices see scores update on their own ---- */
const busy=()=>{const a=document.activeElement;return!!a&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)};
const fixH=m=>m.inn.forEach(n=>{if(!Array.isArray(n.h))n.h=[]}),trimH=m=>{if(m.status=='done')m.inn.forEach(n=>{if(n.h&&n.h.length>3)n.h=n.h.slice(-3)})};
/* keep this device's undo history, and its own newer unsynced scoring, when server data comes in */
function adopt(d){const old=new Map((S?S.matches:[]).map(m=>[m.id,m]));
d.matches.forEach((m,i)=>{const l=old.get(m.id);
if(l&&!(force&&force.has(m.id))){if(KEYS[m.id]&&(l.ver||0)>(m.ver||0)){d.matches[i]=l;return}
if((l.ver||0)==(m.ver||0))m.inn.forEach((n,j)=>{if(l.inn[j]&&Array.isArray(l.inn[j].h))n.h=l.inn[j].h})}
fixH(d.matches[i]);trimH(d.matches[i])});force=null}
/* new ball events (from the scorer's phone) that this viewer has not seen yet */
function evSync(silent){let r=null;const m=cur&&S.matches.find(x=>x.id==cur);
S.matches.forEach(x=>{const n=x.evn||0,o=EVN[x.id];if(!silent&&m&&x.id==m.id&&o!==undefined&&n>o){const l=(x.evl||[]).filter(e=>e.n>o);if(l.length)r={m:x,list:l}}EVN[x.id]=n});return r}
function apply(d,silent){if(isWipe(d,S)){restore();return}adopt(d);S=d;lsSet(K,JSON.stringify(S));lastChange=Date.now();
if(cur&&!S.matches.some(m=>m.id==cur)){cur=null;if(view=='watch')view='home';try{history.replaceState(null,'',path())}catch(e){}}
if(tsel&&!S.tours.some(t=>t.id==tsel))tsel=null;syncMsg='Saved';
const ev=evSync(silent);clearTimeout(holdT);
/* a new ball: celebrate first, then let the scoreboard roll to the new numbers (not an instant jump) */
if(ev&&(view=='watch'||view=='match')){fresh=true;play(ev.m,ev.list);holdT=setTimeout(render,700)}else render()}
async function poll(silent){if(!S||noPoll||polling||pushing||pend||document.hidden||mod||busy()||lsGet(DK))return;if(view=='teams'||(view=='match'&&!cur))return;polling=true;
try{const r=await ft('/api/state?since='+(S.rev||0),{cache:'no-store'},6000);if(r.status==503||r.status==404){noPoll=true;return}if(!r.ok)throw 0;markOn();const d=await r.json();
if(d&&d.same)return;if(!okS(d)||pushing||pend||mod||busy()||lsGet(DK))return;apply(d,silent===true)}catch(e){markOff()}finally{polling=false}}
function tick(){if(!S)return;tc++;if(!pushing&&!pend&&lsGet(DK)&&Date.now()>=nextTry)push();if(noPoll)return;
const w=view=='watch'||(view=='match'&&cur),fast=Date.now()-lastChange<12e4;
if(w?(fast||tc%2==0):view=='home'&&S.matches.some(m=>m.status=='live')?tc%2==0:tc%10==0)poll()}
const T=id=>S.teams.find(t=>t.id==id)||{name:'?',players:[]};
const ovs=b=>Math.floor(b/6)+'.'+b%6,rr=(r,b)=>b?(r*6/b).toFixed(2):'0.00';
const B=(n,k)=>n.bats[k]||(n.bats[k]={r:0,b:0,f:0,s:0,o:0}),W=(n,k)=>n.bowls[k]||(n.bowls[k]={b:0,r:0,w:0});
function newInn(m,i){return{bat:m.teams[i],bowl:m.teams[1-i],runs:0,wk:0,b:0,ex:0,st:null,ns:null,nx:0,bats:{},bowls:{},bw:null,lb:null,ov:[],h:[]}}
function ball(n,e){n.h.push(JSON.stringify(n,(k,v)=>k=='h'?undefined:v));if(n.h.length>40)n.h.shift();const nw=T(n.bat).players.length,bs=B(n,n.st),bw=W(n,n.bw),x=e.x,r=e.r;let add=r,leg=1;
if(x=='wd'){add=r+1;leg=0;n.ex+=add;bw.r+=add}else if(x=='nb'){add=r+1;leg=0;n.ex++;bw.r+=add;bs.r+=r;bs.b++;r==4&&bs.f++;r==6&&bs.s++}
else if(x=='by'||x=='lb'){n.ex+=r;bs.b++}else{bs.r+=r;bw.r+=r;bs.b++;r==4&&bs.f++;r==6&&bs.s++}
n.runs+=add;n.oruns=(n.oruns||0)+add;if(leg){n.b++;bw.b++}
n.ov.push(e.w?'W':x?({wd:'Wd',nb:'Nb',by:'B',lb:'Lb'}[x])+(r||''):String(r));
if(e.w){bs.o=1;n.wk++;n.owk=(n.owk||0)+1;bw.w++;if(n.wk<nw-1)n.st=null}
if(r%2)[n.st,n.ns]=[n.ns,n.st];if(leg&&n.b%6==0){[n.st,n.ns]=[n.ns,n.st];n.lb=n.bw;n.bw=null;n.ov=[];n.lor=n.oruns;n.lwk=n.owk||0;n.oruns=0;n.owk=0}}
function undo(m){if(!m)return;if(!can(m))return toast('View only: only the scorer can change this match');let n=m.inn[m.ci];if(!n.h.length&&m.ci==1){m.inn.pop();m.ci=0;n=m.inn[0]}if(!n.h.length)return toast('Nothing to undo');if(!auth(m))return;const o=JSON.parse(n.h.pop());o.h=n.h;Object.assign(n,o);m.evl=(m.evl||[]).slice(0,-1);m.evn=(m.evn||0)+1;EVN[m.id]=m.evn;if(m.status=='done'){m.status='live';delete m.potm;delete m.win;delete m.res;delete m.mt;delete m.mg}try{SS&&speechSynthesis.cancel()}catch(e){}save();render()}
function chk(m){const n=m.inn[m.ci],nw=T(n.bat).players.length,end=n.b>=m.overs*6||n.wk>=nw-1;
if(!m.ci){if(end){m.ci=1;m.inn.push(newInn(m,1));toast('Innings break')}}
else if(end||n.runs>m.inn[0].runs){m.status='done';const a=m.inn[0].runs,b=n.runs;
if(b>a){m.win=n.bat;const w=nw-1-n.wk;m.mt='wickets';m.mg=w;m.res=T(n.bat).name+' won by '+w+' wicket'+(w==1?'':'s')}
else if(a>b){m.win=m.inn[0].bat;m.mt='runs';m.mg=a-b;m.res=T(m.win).name+' won by '+(a-b)+' run'+(a-b==1?'':'s')}else{m.win=null;m.res='Match tied';m.mt=null}m.potm=tp(m);trimH(m)}}
function mk(a,b,o,f,d,tid,fi){const m={id:uid(),teams:f?[b,a]:[a,b],overs:+o,inn:[],ci:0,status:'live',date:d||Date.now(),tid,fi};m.inn.push(newInn(m,0));return m}
async function load(){let l,hv='';try{l=JSON.parse(lsGet(K))}catch(e){}
try{hv=decodeURIComponent(location.hash.replace(/^#\/?/,'').split('/')[1]||'')}catch(e){}
if(okS(l)&&lsGet(DK)){S=l;syncMsg='Syncing…';push()}
else if(okS(l)&&(!hv||l.matches.some(m=>m.id==hv)||l.tours.some(t=>t.id==hv))){S=l;syncMsg='Saved';bgRefresh=true}   /* show saved data at once, refresh in the background: works with no internet */
else{try{const r=await ft('/api/state',{cache:'no-store'},8000);if(!r.ok)throw 0;const d=await r.json();if(!okS(d))throw 0;markOn();if(isWipe(d,l)){S=l;RESTORE=true;syncMsg='Restoring…';lsSet(DK,'1');push()}else{S=d;syncMsg='Saved'}}catch(e){S=okS(l)?l:null;syncMsg='Offline: saved on this device'}}
if(!okS(S))S={rev:0,teams:[],matches:[],tours:[],theme:null};
S.matches.forEach(m=>{fixH(m);trimH(m)});evSync(true)}
function tp(m){const o={},k=(x,t)=>o[x+t]||(o[x+t]={n:x,t,r:0,b:0,f:0,s:0,w:0,rc:0,bb:0});
m.inn.forEach(n=>{for(const x in n.bats){const p=k(x,n.bat),b=n.bats[x];p.r+=b.r;p.b+=b.b;p.f+=b.f;p.s+=b.s}for(const x in n.bowls){const p=k(x,n.bowl),b=n.bowls[x];p.w+=b.w;p.rc+=b.r;p.bb+=b.b}});
const l=Object.values(o).map(p=>({...p,pts:p.r+p.f+2*p.s+(p.b>=6&&p.r*100/p.b>=150?5:0)+25*p.w+(p.w>=3?10:0)+(p.bb>=6&&p.rc*6/p.bb<=6?5:0)+(m.status=='done'&&p.t==m.win&&p.r+p.w>0?10:0)})).sort((a,b)=>b.pts-a.pts||b.w-a.w||b.r-a.r);
const x=l[0];return x&&x.pts>0?{...x,txt:[x.b?x.r+' ('+x.b+')':'',x.w?x.w+'/'+x.rc:''].filter(Boolean).join(' & ')}:null}
const pm=m=>m.potm||tp(m);
function lb(ms,title){const o={},seen={},k=(x,t)=>o[x+t]||(o[x+t]={n:x,t,m:0,r:0,w:0,a:0});
ms.filter(m=>m.status=='done').forEach(m=>{const mark=p=>{const s=m.id+p.n+p.t;if(!seen[s]){seen[s]=1;p.m++}};
m.inn.forEach(n=>{for(const x in n.bats){const p=k(x,n.bat);mark(p);p.r+=n.bats[x].r}for(const x in n.bowls){const p=k(x,n.bowl);mark(p);p.w+=n.bowls[x].w}});const p=pm(m);if(p)k(p.n,p.t).a++});
const l=Object.values(o).sort((a,b)=>b.a-a.a||(b.r+25*b.w)-(a.r+25*a.w)).slice(0,5);if(!l.length)return '';
return `<h3>${title}</h3><div class="card tw"><table><tr><th>Player</th><th>M</th><th>Runs</th><th>Wkts</th><th>POTM</th></tr>${l.map(p=>`<tr><td><b>${E(p.n)}</b><div class="sub">${E(T(p.t).name)}</div></td><td>${p.m}</td><td>${p.r}</td><td>${p.w}</td><td><b>${p.a}</b></td></tr>`).join('')}</table></div>`}
const dt=d=>new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
const sc=(m,i)=>{const n=m.inn[i];return n?n.runs+'/'+n.wk+' <span class=sub>('+ovs(n.b)+')</span>':'<span class=sub>Yet to bat</span>'};
function mcard(m,fn){const tpf=m.status=='done'&&pm(m);return `<div class="card mc" onclick="${fn}('${m.id}')"><div class="row sp"><span class="sub">${dt(m.date)} · ${m.overs} overs${m.prev?' · Rematch':''}</span><span class="badge ${m.status=='live'?'lv':''}">${m.status=='live'?'LIVE':'Final'}</span></div>
${[0,1].map(i=>`<div class="ln ${m.inn[i]?'':'l'}"><span>${E(T(m.teams[i]).name)}</span><span>${sc(m,i)}</span></div>`).join('')}
<div class="row sp" style="margin-top:6px"><div class="sub">${m.status=='done'?E(m.res)+(tpf?' · ⭐ POTM '+E(tpf.n)+' '+tpf.txt:''):E(T((m.inn[m.ci]||m.inn[0]||{}).bat).name)+' batting'}</div>${m.status=='live'?`<button class="btn o s" aria-label="Watch live" onclick="event.stopPropagation();openWatch('${m.id}')">👁 Watch</button>`:''}</div></div>`}
const toast=t=>{const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.append(d);setTimeout(()=>d.remove(),1800)};
const VIEWS=['home','teams','match','hist','tour','watch'];
const path=()=>'#/'+view+((view=='match'||view=='watch')&&cur?'/'+encodeURIComponent(cur):view=='tour'&&tsel?'/'+encodeURIComponent(tsel):'');
function route(){const h=location.hash.replace(/^#\/?/,'').split('/');let i='';try{i=h[1]?decodeURIComponent(h[1]):''}catch(e){}
view=VIEWS.includes(h[0])?h[0]:'home';cur=null;tsel=null;
if(view=='match'||view=='watch'){if(i&&S.matches.some(m=>m.id==i))cur=i;else if(view=='watch')view='home';
if(view=='match'&&cur&&h[2]){let k='';try{k=decodeURIComponent(h[2])}catch(e){}if(k.length>=8&&k.length<=128){setKey(cur,k);keyIn=true}}}
else if(view=='tour'&&i&&S.tours.some(t=>t.id==i))tsel=i;
PREV={};
if(keyIn){keyIn=false;try{history.replaceState(null,'',path())}catch(e){}const m=cur&&cur_();if(m){DM[m.id]=m.ver||0;saveDM();lsSet(DK,'1');push()}setTimeout(()=>toast('You can now score this match'),400)}}
const go=(v,keep,rep)=>{const was=view;op=[];view=v;if(v=='tour'&&!keep)tsel=null;if(was=='watch'&&v!='watch'&&!keep)cur=null;
if((v=='match'||v=='watch')&&cur&&!S.matches.some(m=>m.id==cur))cur=null;if(v=='watch'&&!cur)view='home';
const p=path();if(modOpen){modOpen=false;rep=1}mod='';
try{if(location.hash!==p||rep)history[rep?'replaceState':'pushState'](null,'',p)}catch(e){}
PREV={};scrollTo(0,0);anim=true;render()};
const openMatch=id=>{cur=id;tab='score';go('match')},openWatch=id=>{cur=id;tab='score';go('watch')};
addEventListener('popstate',()=>{if(skipPop){skipPop=false;return}modOpen=false;mod='';PREV={};if(!S)return;route();scrollTo(0,0);anim=true;render()});
function Home(){const lv=S.matches.filter(m=>m.status=='live'),dn=S.matches.filter(m=>m.status=='done').sort((a,b)=>b.date-a.date).slice(0,3);
return `<div class="hero"><h2>Play it. Score it. Settle it.</h2><div class="st"><div><b>${S.matches.length}</b><span>matches</span></div><div><b>${S.teams.length}</b><span>teams</span></div><div><b>${S.tours.length}</b><span>tournaments</span></div></div></div>
<button class="btn ball-b w" onclick="nm.tid=null;cur=null;go('match')">Start new match</button>
<h3>Ongoing matches</h3><div class="gl">${lv.map(m=>mcard(m,can(m)?'openMatch':'openWatch')).join('')||'<div class="card sub">No live match. Start one above.</div>'}</div>
<h3>Recent matches</h3><div class="gl">${dn.map(m=>mcard(m,'showSC')).join('')||'<div class="card sub">Finished matches show up here.</div>'}</div>
<h3>Tournaments</h3><div class="gl">${S.tours.map(t=>`<div class="card mc row sp" onclick="tsel='${t.id}';go('tour',1)"><div><b>${E(t.name)}</b><div class="sub">${t.fx.length} fixtures · ${t.overs} overs</div></div><span class="badge">${t.fx.filter(f=>f.mid&&S.matches.find(m=>m.id==f.mid&&m.status=='done')).length}/${t.fx.length} played</span></div>`).join('')||'<div class="card sub">Create a tournament for your colony.</div>'}</div>`}
const MINP=2,MAXP=15,PRE=[5,6,7,8,11];let nt={name:'',n:11,p:[]},et=null;
const clamp=n=>Math.max(MINP,Math.min(MAXP,Math.round(+n)||11)),inLive=id=>S.matches.some(m=>m.status=='live'&&m.teams.includes(id));
const er=(e,m,f)=>{const x=$('#'+e);if(x)x.textContent=m;const i=f&&$('#'+f);if(i)i.focus()};
const pin=(a,pre,ref,rm)=>a.map((v,i)=>`<div class="row" style="gap:8px"><input id="${pre}${i}" value="${E(v||'')}" placeholder="Player ${i+1}" maxlength="24" autocomplete="off" aria-label="Player ${i+1} name" oninput="${ref}[${i}]=this.value" onkeydown="nx(event,'${pre}',${i})">${rm?`<button class="btn o s" aria-label="Remove player ${i+1}" ${a.length<=MINP?'disabled':''} onclick="rmEP(${i})">✕</button>`:''}</div>`).join('');
function Teams(){nt.p=Array.from({length:nt.n},(_,i)=>nt.p[i]||'');
return `<h2>Teams</h2><div class="card" style="margin-top:12px"><label>Team name</label><input id="tn" value="${E(nt.name)}" maxlength="24" autocomplete="off" placeholder="e.g. Block C Warriors" oninput="nt.name=this.value">
<label>How many players?</label><div style="margin:6px 0 10px">${PRE.map(c=>`<span class="chip ${nt.n==c?'on':''}" onclick="setN(${c})">${c}</span>`).join('')}<input type="number" inputmode="numeric" min="${MINP}" max="${MAXP}" placeholder="Other" value="${PRE.includes(nt.n)?'':nt.n}" onchange="setN(this.value)" style="width:100px;display:inline-block;margin:0 0 0 6px"></div>
<div class="row sp"><label>Player names (${nt.n})</label><button class="btn o s" onclick="fillN()">Auto-fill names</button></div><div class="pl">${pin(nt.p,'np','nt.p',0)}</div>
<div class="sub" id="te" role="alert" style="color:var(--r);min-height:20px;margin:6px 0"></div><button class="btn w" onclick="addTeam()">Add team</button></div>
${S.teams.length?'<h3>Your teams</h3>':''}<div class="gl">${S.teams.map(teamCard).join('')}</div>`}
function teamCard(t){const lk=inLive(t.id);
if(et&&et.id==t.id)return `<div class="card" style="grid-column:1/-1"><label>Team name</label><input id="en" value="${E(et.name)}" maxlength="24" autocomplete="off" oninput="et.name=this.value"><div class="row sp"><label>Players (${et.p.length})</label><span class="sub">${MINP} to ${MAXP}</span></div><div class="pl">${pin(et.p,'ep','et.p',1)}</div><div class="sub" id="ee" role="alert" style="color:var(--r);min-height:20px;margin:6px 0"></div><button class="btn o w" style="margin-bottom:8px" onclick="addEP()">+ Add player</button><div class="row"><button class="btn g" onclick="saveT()">Save changes</button><button class="btn o g" onclick="et=null;render()">Cancel</button></div></div>`;
return `<div class="card"><div class="row sp"><div><b>${E(t.name)}</b><div class="sub">${t.players.length} players${lk?' · playing now':''}</div></div><div class="row"><button class="btn o s" ${lk?'disabled':''} onclick="editT('${t.id}')">Edit</button><button class="btn o s" ${lk?'disabled':''} onclick="delTeam('${t.id}')">Delete</button></div></div><div style="margin-top:8px">${t.players.map((p,i)=>`<span class="chip">${i+1}. ${E(p)}</span>`).join('')}</div></div>`}
function vt(name,arr,self,pre,eid,nid){const n=name.trim().replace(/\s+/g,' ');if(!n)return er(eid,'Enter a team name',nid),null;
if(S.teams.some(t=>t.id!=self&&t.name.toLowerCase()==n.toLowerCase()))return er(eid,'A team named "'+n+'" already exists',nid),null;
const p=arr.map(x=>x.trim().replace(/\s+/g,' ')),bi=p.findIndex(x=>!x);if(bi>-1)return er(eid,'Enter a name for player '+(bi+1)+', or use Auto-fill names',pre+bi),null;
const s={};for(let i=0;i<p.length;i++){const k=p[i].toLowerCase();if(k in s)return er(eid,'Each player needs a different name. "'+p[i]+'" appears twice',pre+i),null;s[k]=1}
if(p.length<MINP)return er(eid,'A team needs at least '+MINP+' players'),null;return{name:n,players:p}}
const setN=v=>{nt.n=clamp(v);render()},fillN=()=>{nt.p=nt.p.map((v,i)=>v.trim()||'Player '+(i+1));render()};
function nx(e,pre,i){if(e.key!='Enter')return;e.preventDefault();const t=$('#'+pre+(i+1));t?t.focus():pre=='np'?addTeam():saveT()}
function addTeam(){const v=vt(nt.name,nt.p,null,'np','te','tn');if(!v)return;S.teams.push({id:uid(),...v,u:Date.now()});nt={name:'',n:nt.n,p:[]};save();render();toast('Team added')}
const editT=id=>{const t=T(id);et={id,name:t.name,p:[...t.players]};render()};
function addEP(){if(et.p.length>=MAXP)return toast('Maximum '+MAXP+' players');et.p.push('');render();const i=$('#ep'+(et.p.length-1));i&&i.focus()}
function rmEP(i){if(et.p.length<=MINP)return;et.p.splice(i,1);render()}
function saveT(){const v=vt(et.name,et.p,et.id,'ep','ee','en');if(!v)return;const t=T(et.id);t.name=v.name;t.players=v.players;t.u=Date.now();et=null;save();render();toast('Team saved')}
function delTeam(id){const t=T(id);if(inLive(id))return toast('Finish the live match first');if(S.matches.some(m=>m.teams.includes(id))||S.tours.some(x=>x.fx.some(f=>f.a==id||f.b==id)))return toast('Team has matches or a tournament, so it cannot be deleted');if(!confirm('Delete team "'+t.name+'"?'))return;S.teams=S.teams.filter(x=>x.id!=id);DEL.teams.push(id);saveDel();save();render()}
function Match(){const m=S.matches.find(x=>x.id==cur);if(m)return m.status=='live'?Live(m,!can(m)):Done(m,!can(m));
if(S.teams.length<2)return '<div class=card><b>Add two teams to start scoring</b><p class=sub>Create your teams and players first.</p><button class="btn w" onclick="go(\'teams\')">Add teams</button></div>';
nm.a=nm.a||S.teams[0].id;nm.b=nm.b&&nm.b!=nm.a?nm.b:S.teams.find(t=>t.id!=nm.a).id;const so=t=>S.teams.map(x=>`<option value="${x.id}" ${x.id==t?'selected':''}>${E(x.name)}</option>`).join('');
return `<h2>New match</h2><div class="card" style="margin-top:12px"><label>Team A</label><select onchange="nm.a=this.value;render()" ${nm.tid?'disabled':''}>${so(nm.a)}</select><label>Team B</label><select onchange="nm.b=this.value;render()" ${nm.tid?'disabled':''}>${so(nm.b)}</select>
<label>Overs</label><div style="margin:6px 0 10px">${[2,5,10,20].map(o=>`<span class="chip ${nm.o==o?'on':''}" onclick="nm.o=${o};render()">${o}</span>`).join('')}<input type="number" min="1" max="50" placeholder="Custom" value="${[2,5,10,20].includes(+nm.o)?'':nm.o}" oninput="nm.o=+this.value||5" style="width:110px;display:inline-block;margin:0 0 0 6px"></div>
<label>Batting first</label><select onchange="nm.f=+this.value"><option value="0" ${!nm.f?'selected':''}>${E(T(nm.a).name)}</option><option value="1" ${nm.f?'selected':''}>${E(T(nm.b).name)}</option></select><button class="btn ball-b w" onclick="startM()">Play ball</button></div>${h2h()}`}
function rematch(id){const m=S.matches.find(x=>x.id==id);if(!m)return;nm={a:m.teams[0],b:m.teams[1],o:m.overs,f:1,tid:null,fi:null,prev:id};cur=null;go('match');toast('Rematch ready: the other team bats first')}
/* Head to head, worked out from the innings themselves (not from stored flags), so old, undone or edited matches always count correctly. */
const wnr=m=>{const x=m.inn[0],y=m.inn[1];if(!x||!y)return m.win||null;return y.runs>x.runs?y.bat:x.runs>y.runs?x.bat:null};
function h2h(){const a=nm.a,b=nm.b;if(!a||!b||a==b)return '';
const l=S.matches.filter(m=>m.status=='done'&&m.inn.length>1&&m.teams.includes(a)&&m.teams.includes(b)).sort((x,y)=>y.date-x.date),A=T(a).name,Bn=T(b).name;
if(!l.length)return `<div class="card h2h"><div class="hh"><div class="ht"><span class="tav">${E(A[0]||'?')}</span><b>${E(A)}</b></div><div class="hv">VS</div><div class="ht r"><b>${E(Bn)}</b><span class="tav b">${E(Bn[0]||'?')}</span></div></div><div class="sub" style="text-align:center;margin-top:8px">First meeting between these teams. Their record will show here.</div></div>`;
const st=id=>{let w=0,rf=0,hi=0,n=0;l.forEach(m=>{if(wnr(m)==id)w++;m.inn.forEach(i=>{if(i.bat==id){rf+=i.runs;n++;hi=Math.max(hi,i.runs)}})});return{w,rf,hi,avg:n?Math.round(rf/n):0}};
const X=st(a),Y=st(b),tot=l.length,t=l.filter(m=>wnr(m)==null).length,pc=v=>(v*100/tot).toFixed(1);
const row=(p,q,k)=>`<div class="hr"><b class="${p>q?'lead':''}">${p}</b><span>${k}</span><b class="${q>p?'lead':''}">${q}</b></div>`;
return `<div class="card h2h"><div class="hh"><div class="ht"><span class="tav">${E(A[0]||'?')}</span><div><b>${E(A)}</b><div class="hw">${X.w} ${X.w==1?'win':'wins'}</div></div></div><div class="hv">VS<small>${tot} played${t?' · '+t+' tied':''}</small></div><div class="ht r"><div><b>${E(Bn)}</b><div class="hw">${Y.w} ${Y.w==1?'win':'wins'}</div></div><span class="tav b">${E(Bn[0]||'?')}</span></div></div>
<div class="hbar" role="img" aria-label="${E(A)} ${X.w} wins, ${E(Bn)} ${Y.w} wins"><i class="a" style="width:${pc(X.w)}%"></i><i class="t" style="width:${pc(t)}%"></i><i class="b" style="width:${pc(Y.w)}%"></i></div>
${row(X.rf,Y.rf,'Total runs')}${row(X.hi,Y.hi,'Highest score')}${row(X.avg,Y.avg,'Avg per innings')}
<div class="hf"><span class="sub">Last ${Math.min(5,tot)}</span>${l.slice(0,5).map(m=>{const k=wnr(m);return `<span class="fm ${k==a?'a':k==b?'b':'t'}" title="${E(k?T(k).name+' won':'Tied')}">${k==a?E(A[0]):k==b?E(Bn[0]):'T'}</span>`}).join('')}</div></div>
<h3>Recent meetings</h3><div class="gl">${l.slice(0,4).map(m=>mcard(m,'showSC')).join('')}</div>`}
function startM(){if(nm.a==nm.b)return toast('Pick two different teams');if(T(nm.a).players.length<2||T(nm.b).players.length<2)return toast('Each team needs 2+ players');
const m=mk(nm.a,nm.b,nm.o,nm.f,0,nm.tid,nm.fi);m.ver=1;m.evn=0;m.evl=[];setKey(m.id,newKey());DM[m.id]=1;saveDM();EVN[m.id]=0;if(nm.prev)m.prev=nm.prev;nm.prev=null;S.matches.push(m);if(nm.tid){const t=S.tours.find(t=>t.id==nm.tid);t.fx[nm.fi].mid=m.id;t.u=Date.now()}nm.tid=null;cur=m.id;tab='score';save();go('match',0,1)}
const IC=(n,c)=>`<svg class="ic ${c||''}" viewBox="0 0 64 64" aria-hidden="true"><use href="#i-${n}"/></svg>`;
function Live(m,ro){const n=m.inn[m.ci],mb=m.overs*6,left=mb-n.b,tg=m.ci?m.inn[0].runs+1:0;
const tabs=`<div class="tabs"><button class="btn s ${tab=='score'?'':'o'}" onclick="tab='score';render()">Score</button><button class="btn s ${tab=='card'?'':'o'}" onclick="tab='card';render()">Scorecard</button><button class="btn o s" aria-label="Share live link" onclick="shareLive()">🔗 Share</button></div>${ro?'<div class="wb"><span class="dot"></span>'+(view=='watch'?'Watching live · updates automatically':'View only · updates automatically')+'</div>':''}`;
if(tab=='card')return tabs+scard(m);
const z={r:0,b:0,f:0,s:0},bs=n.st&&n.bats[n.st]||z,bn=n.ns&&n.bats[n.ns]||z,bw=n.bw&&n.bowls[n.bw]||null;
const dk=(role,nmx,b,on,c)=>`<div class="dk${on?' on':''}"><div class="dkt"><div class="dr">${role}${on?' <i class="sd">●</i>':''}</div><div class="dn">${nmx?E(nmx):'<span class="sub">Selecting…</span>'}</div><div class="dsr"><b data-k="${E(nmx||'')}|r">${b.r}</b><small>(<span data-k="${E(nmx||'')}|b">${b.b}</span>)</small></div><div class="dm">${b.f}×4 · ${b.s}×6 · SR ${b.b?(b.r*100/b.b).toFixed(0):0}</div></div><span class="dki ${c}" role="img" aria-label="${role}">${IC('batter')}</span></div>`;
const bwc=`<div class="dk bw"><div class="dkt"><div class="dr">Bowling</div><div class="dn">${n.bw?E(n.bw):ro?'Between overs':'Pick bowler'}</div><div class="dsr"><b data-k="bwf">${bw?bw.w+'/'+bw.r:'0/0'}</b><small data-k="bwo">${bw?ovs(bw.b)+' ov':''}</small></div><div class="dm">${bw?'Eco '+rr(bw.r,bw.b):'Next over'}</div></div><span class="dki bo" role="img" aria-label="Bowler">${IC('bowler')}</span></div>`;
const pad=`<div class="pad">${[0,1,2,3,4,6].map(r=>`<button class="${r==4?'f':r==6?'six':''}" onclick="run(${r},0)">${r}</button>`).join('')}
<button class="wk" style="grid-column:1/-1" onclick="run(0,1)">Wicket</button>${[['wd','Wide'],['nb','No ball'],['by','Bye'],['lb','Leg bye']].map(([k,l])=>`<button class="ex ${px==k?'on':''}" onclick="px=px=='${k}'?null:'${k}';render()">${l}</button>`).join('')}<button class="ac" onclick="undo(cur_())">↶ Undo</button><button class="ac" onclick="swap()">⇄ Swap</button></div>
<div class="sub${px?' xh':''}" style="text-align:center;margin-top:10px">${px?'<b>'+XL[px]+'</b> selected: now tap the runs scored (0 if none)':'For Wide, No ball, Bye or Leg bye tap it first, then the runs'}</div><div class="sub" style="text-align:center;margin-top:12px"><button class="btn o s" onclick="shareScorer()">👥 Let another phone score</button></div>`;
const ctl=ro?'':`<div class="ctl">${!n.st||!n.ns||!n.bw?Pick(m,n):pad}</div>`;
return `${tabs}<div class="live${ro?' ro':''}"><div class="score"><div class="sub" style="color:#bfe9f5">${E(T(n.bat).name)} · Innings ${m.ci+1}</div><div class="big${fresh?' nw':''}"><span data-k="r">${n.runs}</span><small>/<span data-k="w">${n.wk}</span></small></div><div class="row sp" style="margin-top:6px"><span><span data-k="ov">${ovs(n.b)}</span> / ${m.overs} ov</span><span>CRR <span data-k="crr">${rr(n.runs,n.b)}</span></span><span>Extras <span data-k="ex">${n.ex}</span></span></div>
${m.ci?`<div class="tgt" data-k="tgt">Need ${Math.max(tg-n.runs,0)} from ${left} balls · RRR ${rr(Math.max(tg-n.runs,0),left)}</div>`:''}</div>
<div class="deck">${dk('Striker',n.st,bs,1,'st')}${dk('Non-striker',n.ns,bn,0,'ns')}${bwc}</div>
<div class="card ovc"><div class="row sp"><b>${IC('ball','sm')} This over</b><span class="sub">${n.bw?E(n.bw):''}</span></div><div class="ov">${n.ov.map((x,i)=>`<span class="b ${x=='W'?'wk':x=='4'?'f':x=='6'?'six':isNaN(x)?'e':''}${fresh&&i==n.ov.length-1?' nw':''}">${x}</span>`).join('')||'<span class=sub>New over</span>'}</div></div>${ctl}</div>`}
/* Selection deck: openers at the start of an innings, the next batter after a wicket, and the bowler for each over. */
const ini=s=>E(String(s).trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase());
function Pick(m,n){const P=T(n.bat).players,BP=T(n.bowl).players,opn=!Object.keys(n.bats).length,nb=!n.st||!n.ns;let t,h,l,f,src;
if(nb){src=P;f='selP';if(opn){t='Choose openers';h=!op.length?'Tap the striker first':'Now tap the non-striker';l=P.map((p,i)=>i)}else{t='Next batter in';h=(n.lo?n.lo+' is out · ':'')+(!n.st?'takes strike':'non-striker end');l=P.map((p,i)=>i).filter(i=>!n.bats[P[i]])}}
else{src=BP;f='selB';t='Who bowls the '+(n.b?'next':'first')+' over?';h=T(n.bowl).name;l=BP.map((p,i)=>i).filter(i=>BP[i]!=n.lb)}
const un=!opn&&(n.h.length||m.ci);
return `<div class="card pk"><div class="pkh"><div><div class="pkt">${t}</div><div class="sub">${E(h)}</div></div><span class="step">${nb?(opn?'Openers':'Wicket'):'Bowler'}</span></div><div class="pkg">${l.map(i=>`<button class="pp${nb&&opn&&op.includes(i)?' on':''}" onclick="${f}(${i})"><span class="av">${IC(nb?'batter':'bowler')}</span><span class="pn">${E(src[i])}</span>${nb&&opn&&op[0]==i?'<em>On strike</em>':nb&&opn&&op[1]==i?'<em>Non-striker</em>':''}</button>`).join('')}</div><div class="row" style="margin-top:12px">${nb&&opn&&op.length?'<button class="btn o s" onclick="op=[];render()">Reset</button>':''}${un?'<button class="btn o s" onclick="undo(cur_())">↶ Undo last ball</button>':''}</div></div>`}
function selP(i){const m=cur_();if(!m||view=='watch'||m.status!='live')return;const n=m.inn[m.ci],P=T(n.bat).players,p=P[i];const opn=!Object.keys(n.bats).length;if(p===undefined||(!opn&&n.bats[p]))return;
if(opn){if(op.includes(i))op=op.filter(x=>x!=i);else op.push(i);if(op.length<2)return render();if(!auth(m)){op=[];return render()}n.st=P[op[0]];n.ns=P[op[1]];B(n,n.st);B(n,n.ns);op=[]}
else{if(n.st&&n.ns||!auth(m))return;if(!n.st)n.st=p;else n.ns=p;B(n,p);n.lo=null}
save();render();navigator.vibrate&&navigator.vibrate(12);fx('tap')}
function selB(i){const m=cur_();if(!m||view=='watch'||m.status!='live')return;const n=m.inn[m.ci],p=T(n.bowl).players[i];if(p===undefined||!n.st||!n.ns||n.bw||!auth(m))return;n.bw=p;save();render();fx('tap')}
const cur_=()=>S.matches.find(x=>x.id==cur),XL={wd:'Wide',nb:'No ball',by:'Bye',lb:'Leg bye'};
function cele(t,c,o){o=o||{};document.querySelectorAll('.cele').forEach(e=>e.remove());const d=document.createElement('div');d.className='cele '+(o.k||'');d.style.setProperty('--cc',c);let p='';
if(o.k=='bd')for(let i=0;i<30;i++){const a=Math.random()*6.283,r=140+Math.random()*240;p+=`<i style="--dx:${Math.cos(a)*r|0}px;--dy:${Math.sin(a)*r|0}px;--bg:${['#ff4d6d','#2ee6c5','#ffd60a','#3b82ff','#a78bfa'][i%5]};--dl:${(Math.random()*.15).toFixed(2)}s"></i>`}
d.innerHTML=`<div class="ct">${E(t)}</div>${o.s?`<div class="cs">${E(o.s)}</div>`:''}${p}`;document.body.append(d);setTimeout(()=>d.remove(),1350)}
let VS={on:true,fx:true,every:true,ann:true,lang:'en-IN',voice:'',g:'f',vol:1,rate:1};try{Object.assign(VS,JSON.parse(localStorage.getItem('chauka.voice3')||'{}'))}catch(e){}
const lg=()=>VS.lang.startsWith('hi')?'hi':'en',SS='speechSynthesis' in window;let VO=[];const lv=()=>{VO=SS?speechSynthesis.getVoices():[]};lv();SS&&(speechSynthesis.onvoiceschanged=lv);
const LX={en:{four:'Four',six:'Six',wk:n=>`Wicket, ${n} is out`,wd:r=>r?`Wide ball, and ${r} ${r==1?'run':'runs'} more`:'Wide ball',nb:r=>r?`No ball, and ${r} ${r==1?'run':'runs'} off the bat`:'No ball',by:r=>r?`${r} ${r==1?'bye':'byes'}`:'Bye',lb:r=>r?`${r} leg ${r==1?'bye':'byes'}`:'Leg bye',dot:'Dot ball',run:r=>['','One run','Two runs','Three runs'][r]||r+' runs',
over:(o,x,w,r,k)=>`Over ${o} complete. ${x} ${x==1?'run':'runs'}${w?', '+w+(w==1?' wicket':' wickets'):''}. Score ${r} for ${k}.`,inn:(t,r,w)=>`Innings over. ${t}, ${r} for ${w}.`,res:m=>m.res+'.',potm:n=>`Player of the match, ${n}.`,test:BRAND+' commentary is ready.'},
hi:{four:'चौका',six:'छक्का',wk:n=>`विकेट, ${n} आउट`,wd:r=>r?`वाइड बॉल, और ${r} रन`:'वाइड बॉल',nb:r=>r?`नो बॉल, और ${r} रन`:'नो बॉल',by:r=>r?`${r} बाई`:'बाई',lb:r=>r?`${r} लेग बाई`:'लेग बाई',dot:'डॉट बॉल',run:r=>r+' रन',
over:(o,x,w,r,k)=>`ओवर ${o} समाप्त। ${x} रन${w?', '+w+' विकेट':''}। स्कोर ${k} विकेट पर ${r}।`,inn:(t,r,w)=>`पारी समाप्त। ${t}, ${w} विकेट पर ${r} रन।`,res:m=>m.win?`${T(m.win).name} ${m.mg} ${m.mt=='runs'?'रन':'विकेट'} से जीता।`:'मैच टाई रहा।',potm:n=>`प्लेयर ऑफ द मैच, ${n}।`,test:'गली लाइव कमेंट्री तैयार है।'}};
const FEM=/\b(female|woman|zira|heera|hazel|susan|linda|catherine|samantha|karen|moira|tessa|veena|lekha|kalpana|neerja|swara|aditi|raveena|priya|kajal|sangeeta|natasha|libby|sonia|jenny|aria|ava|emma|allison|nicky|fiona|victoria|serena|kate|joanna|ivy|salli|kendra|kimberly|google us english|google \u0939\u093f\u0928\u094d\u0926\u0940|google hindi)\b|google \u0939\u093f\u0928\u094d\u0926\u0940/i,MAL=/\b(male|david|mark|ravi|hemant|prabhat|rishi|madhur|daniel|alex|fred|george|james|guy|ryan|william|thomas|oliver|arthur|aaron|gordon|bruce|albert|ralph|alok|kumar)\b/i;
const isF=n=>FEM.test(n)&&!/\bmale\b/i.test(n),isM=n=>!isF(n)&&MAL.test(n);
function gs(v){const f=isF(v.name),m=isM(v.name);return VS.g=='m'?(m?10:f?-10:0):(f?10:m?-10:0)}
function pick(){const f=VO.find(v=>v.name==VS.voice);if(f)return f;const p=VS.lang.slice(0,2).toLowerCase(),all=VO.filter(v=>v.lang.slice(0,2).toLowerCase()==p);if(!all.length)return null;
return all.map(v=>({v,s:gs(v)+(v.lang.replace('_','-').toLowerCase()==VS.lang.toLowerCase()?5:0)+(/natural|online|neural/i.test(v.name)?2:0)+(/google/i.test(v.name)?1:0)})).sort((a,b)=>b.s-a.s)[0].v}
let UQ=[],sk=0,un=0;
addEventListener('pointerdown',()=>{if(un||!SS)return;un=1;try{const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u)}catch(e){}},{passive:true});
function say(a){if(!VS.on||!SS||!a.length)return;const s=speechSynthesis,k=++sk;lv();
const go=()=>{if(k!=sk)return;try{s.resume()}catch(e){}const v=pick();UQ=[];a.forEach(t=>{const u=new SpeechSynthesisUtterance(t);u.lang=v?v.lang:VS.lang;if(v)u.voice=v;u.rate=VS.rate;u.pitch=VS.g=='f'?(v&&isF(v.name)?1.05:1.25):1;u.volume=VS.vol;
u.onerror=e=>{if(!u.voice||/cancel|interrupt/.test(e.error))return;const n=new SpeechSynthesisUtterance(t);n.lang=VS.lang;n.rate=VS.rate;n.pitch=u.pitch;n.volume=VS.vol;UQ.push(n);s.speak(n)};UQ.push(u);s.speak(u)})};
if(s.speaking||s.pending){s.cancel();setTimeout(go,120)}else setTimeout(go,VS.fx?200:30)}
let AC;const ac=()=>{try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();AC.state=='suspended'&&AC.resume()}catch(e){}return AC};addEventListener('pointerdown',ac);
function tn(f,d,t,at,v){const c=ac();if(!c)return;at=at||0;const o=c.createOscillator(),g=c.createGain(),s=c.currentTime+at;o.type=t||'sine';o.frequency.setValueAtTime(f,s);g.gain.setValueAtTime(.0001,s);g.gain.linearRampToValueAtTime((v||.12)*VS.vol,s+.012);g.gain.exponentialRampToValueAtTime(.0001,s+d);o.connect(g);g.connect(c.destination);o.start(s);o.stop(s+d+.02)}
function fx(k){if(!VS.fx)return;const F={tap:()=>tn(480,.07,'triangle',0,.06),four:()=>{tn(660,.12,'triangle');tn(880,.2,'triangle',.1)},six:()=>[523,659,784,1047].forEach((f,i)=>tn(f,.18,'triangle',i*.08)),wk:()=>{tn(240,.3,'sawtooth',0,.07);tn(160,.35,'sawtooth',.14,.07)},over:()=>{tn(784,.18);tn(988,.28,'sine',.14)},ex:()=>{tn(520,.12,'square',0,.05);tn(390,.2,'square',.1,.05)},end:()=>[523,659,784,659,784,1047].forEach((f,i)=>tn(f,.2,'triangle',i*.12))};F[k]&&F[k]()}
function vsHtml(){const sw=(k,t,d)=>`<div class="card row sp"><div><b>${t}</b><div class="sub">${d}</div></div><button class="btn s ${VS[k]?'ball-b':'o'}" onclick="setVS('${k}',${!VS[k]})">${VS[k]?'On':'Off'}</button></div>`;
const vl=VO.filter(v=>v.lang.slice(0,2)==VS.lang.slice(0,2));
return `<div class="mod" onclick="if(event.target==this)closeM()"><div><div class="row sp"><h3 style="margin:0">Sound and commentary</h3><button class="btn o s" onclick="closeM()">Done</button></div><div style="margin-top:12px">
${SS?'':'<div class="card sub">This browser cannot speak. Sound effects still work.</div>'}
${sw('on','Voice commentary','Speaks every ball, and the runs and wickets after each over')}${sw('every','Call every ball','Runs, wicket, wide, no ball, bye and leg bye')}${sw('ann','Match announcements','Innings over, result and Player of the Match')}${sw('fx','Sound effects','Taps, boundaries, wickets and the end of the match')}
<div class="card"><b>Language</b><div style="margin:8px 0 4px">${[['en-IN','English (India)'],['en-GB','English (UK)'],['hi-IN','हिन्दी']].map(([c,l])=>`<span class="chip ${VS.lang==c?'on':''}" onclick="setVS('lang','${c}');setVS('voice','')">${l}</span>`).join('')}</div>
<label>Voice type</label><div style="margin:6px 0 8px">${[['f','👩 Woman'],['m','👨 Man']].map(([c,l])=>`<span class="chip ${VS.g==c?'on':''}" onclick="setVS('g','${c}');setVS('voice','')">${l}</span>`).join('')}</div>
${SS?(vl.length?`<label>Voice</label><select onchange="setVS('voice',this.value)"><option value="">Automatic (${VS.g=='f'?'woman':'man'})</option>${vl.map(v=>`<option value="${E(v.name)}" ${VS.voice==v.name?'selected':''}>${E(v.name)}${isF(v.name)?' ♀':isM(v.name)?' ♂':''}</option>`).join('')}</select>`:'<div class="sub" style="margin:8px 0">No voice for this language on this device. Pick another language, or add one in your device text-to-speech settings.</div>'):''}
<label>Volume</label><input type="range" min="0.2" max="1" step="0.1" value="${VS.vol}" onchange="setVS('vol',+this.value)"><label>Speed</label><input type="range" min="0.7" max="1.4" step="0.1" value="${VS.rate}" onchange="setVS('rate',+this.value)">
<button class="btn w" onclick="say([LX[lg()].test]);fx('four')">Test voice</button></div></div></div></div>`}
const openVS=()=>{lv();mod=vsHtml();render()};
function setVS(k,v){VS[k]=v;try{localStorage.setItem('chauka.voice3',JSON.stringify(VS))}catch(e){}mod=vsHtml();render()}
/* One ball event. The scorer's phone builds it; every watcher plays the same event through play(), so they see the same celebration, sound and commentary. */
const PRI=e=>e.w?5:!e.x&&e.r==6?4:!e.x&&e.r==4?3:e.x?2:e.r?1:0;
function showCele(e){const x=e.x,r=e.r,pl=k=>k+(k==1?' run':' runs');
if(e.w)cele('WICKET','#ff4d6d',{k:'wk',s:e.o+' is out'});
else if(x=='wd')cele('WIDE','#f59e0b',{k:'ex',s:'+'+pl(r+1)});
else if(x=='nb')cele('NO BALL','#f97316',{k:'ex',s:'+'+pl(r+1)});
else if(x=='by')cele('BYE','#06b6d4',{k:'ex',s:r?'+'+pl(r):''});
else if(x=='lb')cele('LEG BYE','#06b6d4',{k:'ex',s:r?'+'+pl(r):''});
else if(r==4)cele('FOUR','#3b82f6',{k:'bd'});else if(r==6)cele('SIX','#8b5cf6',{k:'bd'})}
function play(m,list){if(!list||!list.length)return;const l=LX[lg()],q=[],top=list.reduce((a,b)=>PRI(b)>=PRI(a)?b:a),last=list[list.length-1];
if(PRI(top)>=2)showCele(top);
fx(top.w?'wk':top.x=='wd'||top.x=='nb'?'ex':!top.x&&top.r==4?'four':!top.x&&top.r==6?'six':'tap');
list.forEach(e=>{const r=e.r,x=e.x;
if(VS.every)q.push(e.w?l.wk(e.o):x=='wd'?l.wd(r):x=='nb'?l.nb(r):x=='by'?l.by(r):x=='lb'?l.lb(r):r==4?l.four:r==6?l.six:r?l.run(r):l.dot);
if(e.ov)q.push(l.over(e.ov.o,e.ov.x,e.ov.w,e.ov.r,e.ov.k))});
if(list.some(e=>e.ov))fx('over');
if(last.brk){if(VS.ann)q.push(l.inn(last.brk.t,last.brk.r,last.brk.w))}
else if(last.end&&m.status=='done'){if(VS.ann){q.push(l.res(m));const p=pm(m);if(p)q.push(l.potm(p.n))}fx('end');toast(m.res)}
say(q)}
function run(r,w){const m=cur_();if(!m||view=='watch'||m.status!="live")return;const n=m.inn[m.ci];if(!n.bw||!n.st||!n.ns||!auth(m))return;
const x=px,ob=n.b,oc=m.ci,out=n.st;ball(n,{r,w,x});if(w)n.lo=out;px=null;fresh=true;chk(m);
const e={n:(m.evn||0)+1,r,w:w?1:0,x:x||'',o:out};
if(n.b>ob&&n.b%6==0)e.ov={o:n.b/6,x:n.lor||0,w:n.lwk||0,r:n.runs,k:n.wk};
if(m.ci>oc){const f=m.inn[0];e.brk={t:T(f.bat).name,r:f.runs,w:f.wk}}else if(m.status=='done')e.end=1;
m.evn=e.n;m.evl=(m.evl||[]).concat(e).slice(-4);EVN[m.id]=e.n;
save();render();navigator.vibrate&&navigator.vibrate(w?40:12);play(m,[e])}
function setB(p){const m=cur_();if(!m||view=='watch'||!auth(m))return;m.inn[m.ci].bw=p;save();render()}
function swap(){const m=cur_();if(!m||m.status!='live'||view=='watch'||!auth(m))return;const n=m.inn[m.ci];if(!n.st||!n.ns)return toast('Select the batters first');[n.st,n.ns]=[n.ns,n.st];save();render()}
let SL='';
function shareScorer(){const m=cur_();if(!m||!can(m))return toast('View only');if(!KEYS[m.id]&&!auth(m))return;SL=location.origin+location.pathname+'#/match/'+encodeURIComponent(m.id)+'/'+encodeURIComponent(KEYS[m.id]);
mod=`<div class="mod" onclick="if(event.target==this)closeM()"><div><h3 style="margin:0 0 8px">Let another phone score</h3><p class="sub">Anyone who opens this link can score this match, so send it only to the person who will score. To let people just watch, use the Share button instead.</p><pre style="white-space:pre-wrap;word-break:break-all;user-select:text">${E(SL)}</pre><div class="row"><button class="btn g" onclick="copyScorer()">Copy link</button><button class="btn o g" onclick="closeM()">Done</button></div></div></div>`;render()}
function copyScorer(){try{navigator.clipboard.writeText(SL).then(()=>toast('Scorer link copied'),()=>toast('Press and hold the link to copy'))}catch(e){toast('Press and hold the link to copy')}}
/* watch mode: numbers roll to their new value and changed cells flash, instead of jumping */
function tween(el,a,b){const t0=performance.now(),d=Math.min(900,380+Math.abs(b-a)*45);el.textContent=a;const f=t=>{const p=Math.min(1,(t-t0)/d);el.textContent=p<1?Math.round(a+(b-a)*(1-Math.pow(1-p,3))):b;p<1&&requestAnimationFrame(f)};requestAnimationFrame(f)}
function track(ro){const m=cur&&cur_(),ns=(m?m.id+'|'+m.ci:'')+'|';document.querySelectorAll('#app [data-k]').forEach(el=>{const k=ns+el.dataset.k,v=el.textContent,o=PREV[k];PREV[k]=v;if(!ro||o===undefined||o===v)return;el.classList.add('chg');if(/^\d+$/.test(o)&&/^\d+$/.test(v))tween(el,+o,+v)})}
function scard(m){return '<div class="gl">'+m.inn.map(n=>`<div class="card tw"><div class="row sp"><b>${E(T(n.bat).name)}</b><b class="num">${n.runs}/${n.wk} (${ovs(n.b)})</b></div><table><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>${Object.keys(n.bats).map(k=>{const b=n.bats[k];return `<tr><td>${E(k)}<div class="sub">${b.o?'out':(k==n.st||k==n.ns)&&m.status=='live'?'batting':'not out'}</div></td><td><b>${b.r}</b></td><td>${b.b}</td><td>${b.f}</td><td>${b.s}</td><td>${b.b?(b.r*100/b.b).toFixed(0):0}</td></tr>`}).join('')}</table>
<table style="margin-top:10px"><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th><th>Eco</th></tr>${Object.keys(n.bowls).map(k=>{const b=n.bowls[k];return `<tr><td>${E(k)}</td><td>${ovs(b.b)}</td><td>${b.r}</td><td><b>${b.w}</b></td><td>${rr(b.r,b.b)}</td></tr>`}).join('')}</table><div class="sub" style="margin-top:8px">Extras: ${n.ex}${(()=>{const y=T(n.bat).players.filter(p=>!n.bats[p]);return y.length?' · Yet to bat: '+E(y.join(', ')):''})()}</div></div>`).join('')+'</div>'}
function Done(m,ro){const x=pm(m);return `<div class="score"><span class="badge">Result</span><h2 style="margin:10px 0;font-size:26px">${E(m.res)}</h2>${[0,1].map(i=>`<div class="row sp"><span>${E(T(m.teams[i]).name)}</span><b>${sc(m,i)}</b></div>`).join('')}${x?`<div class="tgt" style="font-size:15px">⭐ Player of the match<div class="num" style="font-size:26px;margin:4px 0 2px">${E(x.n)}</div>${E(T(x.t).name)} · ${x.txt}</div>`:''}</div>
${ro?'':`<button class="btn ball-b w" style="margin-bottom:10px" onclick="rematch('${m.id}')">🔁 Rematch</button>`}<div class="row" style="margin-bottom:12px"><button class="btn g" onclick="share('${m.id}')">Share image</button><button class="btn o g" onclick="copyS('${m.id}')">Copy summary</button></div>${ro?'':`<button class="btn o w" style="margin-bottom:12px" onclick="undo(cur_())">↶ Undo last ball</button>`}<button class="btn o w" style="margin-bottom:12px;color:var(--r)" onclick="delM('${m.id}')">🔒 Delete match (secret key)</button>${scard(m)}${ro?`<button class="btn o w" onclick="go('home')">Back to home</button>`:`<button class="btn ball-b w" onclick="cur=null;go('match')">New match</button>`}`}
function summ(m){const x=pm(m);return `${BRAND} · ${dt(m.date)} · ${m.overs} overs\n${[0,1].map(i=>T(m.teams[i]).name+': '+(m.inn[i]?m.inn[i].runs+'/'+m.inn[i].wk+' ('+ovs(m.inn[i].b)+')':'-')).join('\n')}\n${m.res||'In progress'}${x?'\nPlayer of the match: '+x.n+' '+x.txt:''}`}
function copyS(id){const m=S.matches.find(x=>x.id==id);if(!m)return;const fb=()=>{mod=`<div class="mod" onclick="if(event.target==this)closeM()"><div><pre style="white-space:pre-wrap;user-select:text">${E(summ(m))}</pre><button class="btn w" onclick="closeM()">Done</button></div></div>`;render()};try{navigator.clipboard.writeText(summ(m)).then(()=>toast('Summary copied'),fb)}catch(e){fb()}}
function mark(x,X,Y,z){const g=x.createLinearGradient(0,0,512,512);g.addColorStop(0,'#0b1d4a');g.addColorStop(.6,'#0d6b8a');g.addColorStop(1,'#0fa88f');x.save();x.translate(X,Y);x.scale(z/512,z/512);x.fillStyle=g;x.beginPath();x.moveTo(116,0);x.arcTo(512,0,512,512,116);x.arcTo(512,512,0,512,116);x.arcTo(0,512,0,0,116);x.arcTo(0,0,512,0,116);x.closePath();x.fill();
x.fillStyle='#2ee6c5';x.beginPath();x.arc(236,286,144,0,7);x.fill();x.save();x.beginPath();x.arc(236,286,144,0,7);x.clip();x.strokeStyle='#0b1d4a';x.lineWidth=9;[-14,30].forEach(d=>{x.stroke(new Path2D('M '+(176+d)+' 132 C '+(282+d)+' 218 '+(282+d)+' 354 '+(176+d)+' 440'))});x.restore();
x.fillStyle='rgba(255,255,255,.16)';x.beginPath();x.arc(396,118,58,0,7);x.fill();x.fillStyle='#ff4d6d';x.strokeStyle='#fff';x.lineWidth=9;x.beginPath();x.arc(396,118,36,0,7);x.fill();x.stroke();x.restore()}
function shareLive(){const m=S.matches.find(x=>x.id==cur);if(!m)return;const u=location.origin+location.pathname+'#/watch/'+encodeURIComponent(m.id),t=BRAND+': '+T(m.teams[0]).name+' vs '+T(m.teams[1]).name;
if(navigator.share){navigator.share({title:t,text:t+' (live)',url:u}).catch(()=>{});return}
const fb=()=>{mod=`<div class="mod" onclick="if(event.target==this)closeM()"><div><h3 style="margin:0 0 8px">Live link</h3><p class="sub">Anyone with this link can watch the match live.</p><pre style="white-space:pre-wrap;word-break:break-all;user-select:text">${E(u)}</pre><button class="btn w" onclick="closeM()">Done</button></div></div>`;render()};
navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(u).then(()=>toast('Live link copied'),fb):fb()}
function Watch(){const m=S.matches.find(x=>x.id==cur);return!m?Home():m.status=='live'?Live(m,1):Done(m,1)}
function share(id){const m=S.matches.find(x=>x.id==id),c=document.createElement('canvas');c.width=1080;c.height=1080;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,1080,1080);g.addColorStop(0,'#0b1d4a');g.addColorStop(1,'#0fa88f');x.fillStyle=g;x.fillRect(0,0,1080,1080);x.fillStyle='#2ee6c5';x.beginPath();x.arc(960,120,150,0,7);x.fill();
const F='Bricolage Grotesque,system-ui,sans-serif';mark(x,70,58,84);x.fillStyle='#fff';x.font='800 64px '+F;x.fillText(BRAND,176,130);x.font='34px '+F;x.fillStyle='#bfe9f5';x.fillText(dt(m.date)+' · '+m.overs+' overs',70,185);
[0,1].forEach(i=>{const n=m.inn[i],y=380+i*190;x.fillStyle='#fff';x.font='700 50px '+F;x.fillText(T(m.teams[i]).name,70,y);x.font='800 90px '+F;x.textAlign='right';x.fillStyle='#2ee6c5';x.fillText(n?n.runs+'/'+n.wk:'-',1010,y+10);x.font='32px '+F;x.fillStyle='#bfe9f5';x.fillText(n?ovs(n.b)+' overs':'',1010,y+55);x.textAlign='left'});
x.fillStyle='#fff';x.font='700 46px '+F;x.fillText(m.res||'Live match',70,800);const t=pm(m);if(t){x.fillStyle='#bfe9f5';x.font='30px '+F;x.fillText('Player of the match',70,870);x.fillStyle='#2ee6c5';x.font='800 54px '+F;x.fillText('⭐ '+t.n,70,935);x.fillStyle='#fff';x.font='32px '+F;x.fillText(T(t.t).name+' · '+t.txt,70,980)}x.fillStyle='#bfe9f5';x.font='28px '+F;x.fillText('Scored on '+BRAND,70,1052);
mod=`<div class="mod" onclick="if(event.target==this)closeM()"><div><img class="sh" src="${c.toDataURL('image/png')}"><p class="sub">Press and hold the image to save or share it.</p><button class="btn w" onclick="closeM()">Done</button></div></div>`;render()}
async function delM(id){const m=S.matches.find(x=>x.id==id);if(!m)return;let adm=false;
try{const r=await ft('/api/health',{cache:'no-store'},5000);adm=!!(await r.json()).admin}catch(e){}
if(adm){const k=prompt('Enter the secret key to delete this match');if(!k)return;
try{const r=await ft('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({teams:[],matches:[],tours:[],keys:{},del:{teams:[],matches:[id],tours:[]},admin:k})},10000),j=await r.json().catch(()=>({}));
if(r.status==429)return toast('Too many wrong keys. Try again in 10 minutes');if(r.status==503)return toast('Server storage is not set up, cannot delete');if(!r.ok||(j.rej&&j.rej.length))return toast('Wrong secret key. Match not deleted')}catch(e){return toast('No connection. Deleting needs the server')}}
else{if(!can(m))return toast('Only the scorer can delete this match');if(!confirm('Delete this match permanently?'))return}
S.matches=S.matches.filter(x=>x.id!=id);S.tours.forEach(t=>t.fx.forEach(f=>{if(f.mid==id){f.mid=null;t.u=Date.now()}}));if(!adm){DEL.matches.push(id);saveDel()}delete DM[id];delete KEYS[id];saveKeys();saveDM();cur=null;mod='';save();toast('Match deleted');['hist','home','tour'].includes(view)?render():go('match',0,1)}
const closeM=()=>{mod='';render()};
function showSC(id){const m=S.matches.find(x=>x.id==id);mod=`<div class="mod" onclick="if(event.target==this)closeM()"><div><div class="row sp"><h3 style="margin:0">${E(T(m.teams[0]).name)} vs ${E(T(m.teams[1]).name)}</h3><button class="btn o s" onclick="closeM()">Close</button></div><p class="sub">${E(m.res||'In progress')} · ${dt(m.date)}</p>${scard(m)}${m.status=='done'?`<button class="btn ball-b w" style="margin-bottom:10px" onclick="rematch('${m.id}')">🔁 Rematch</button>`:''}<div class="row"><button class="btn g" onclick="share('${m.id}')">Share image</button><button class="btn o g" onclick="copyS('${m.id}')">Copy summary</button></div>${m.status=='done'?`<button class="btn o w" style="margin-top:10px;color:var(--r)" onclick="delM('${m.id}')">🔒 Delete match (secret key)</button>`:''}</div></div>`;render()}
function Hist(){return `<h2>Match history</h2>${lb(S.matches,'Top players')}<div class="row" style="margin-top:12px"><input placeholder="Search team, result, date" value="${E(q)}" oninput="q=this.value;hl()"><select onchange="tf=this.value;hl()" style="width:140px"><option value="">All teams</option>${S.teams.map(t=>`<option value="${t.id}" ${tf==t.id?'selected':''}>${E(t.name)}</option>`).join('')}</select></div><div id="hl">${hlist()}</div>`}
function hlist(){const s=q.toLowerCase(),a=S.matches.filter(m=>m.status=='done'&&(!tf||m.teams.includes(tf))&&(!s||(m.teams.map(t=>T(t).name).join(' ')+m.res+dt(m.date)).toLowerCase().includes(s))).sort((a,b)=>b.date-a.date);return '<div class="gl">'+(a.map(m=>mcard(m,'showSC')).join('')||'<div class="card sub">No matches found. Try another search.</div>')+'</div>'}
const hl=()=>$('#hl').innerHTML=hlist();
function table(t){const r={};t.fx.forEach(f=>[f.a,f.b].forEach(i=>r[i]=r[i]||{id:i,p:0,w:0,l:0,t:0,rf:0,bf:0,ra:0,ba:0}));
t.fx.forEach(f=>{const m=S.matches.find(x=>x.id==f.mid);if(!m||m.status!='done')return;m.inn.forEach((n,i)=>{const o=m.inn[1-i],a=r[n.bat],b=r[n.bowl],fb=n.wk>=T(n.bat).players.length-1?m.overs*6:n.b;a.rf+=n.runs;a.bf+=fb;b.ra+=n.runs;b.ba+=fb});[f.a,f.b].forEach(i=>{r[i].p++;m.win==null?r[i].t++:m.win==i?r[i].w++:r[i].l++})});
return Object.values(r).map(x=>({...x,pts:x.w*2+x.t,nrr:(x.bf?x.rf*6/x.bf:0)-(x.ba?x.ra*6/x.ba:0)})).sort((a,b)=>b.pts-a.pts||b.nrr-a.nrr)}
function Tour(){const t=S.tours.find(x=>x.id==tsel);if(t)return `<button class="btn o s" onclick="go('tour')">← All</button><h2 style="margin:12px 0">${E(t.name)}</h2><div class="card tw"><table><tr><th>Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>NRR</th></tr>${table(t).map(x=>`<tr><td><b>${E(T(x.id).name)}</b></td><td>${x.p}</td><td>${x.w}</td><td>${x.l}</td><td><b>${x.pts}</b></td><td>${x.nrr>=0?'+':''}${x.nrr.toFixed(2)}</td></tr>`).join('')}</table></div>
${lb(t.fx.map(f=>S.matches.find(x=>x.id==f.mid)).filter(Boolean),'Player of the tournament race')}<h3>Fixtures</h3><div class="gl">${t.fx.map((f,i)=>{const m=S.matches.find(x=>x.id==f.mid);return `<div class="card row sp"><div><b>${E(T(f.a).name)} vs ${E(T(f.b).name)}</b><div class="sub">${m?E(m.res||'Live now'):'Scheduled'}</div></div>${m?`<button class="btn o s" onclick="${m.status=='live'?`${can(m)?'openMatch':'openWatch'}('${m.id}')`:`showSC('${m.id}')`}">${m.status=='live'?(can(m)?'Resume':'Watch'):'View'}</button>`:`<button class="btn s" onclick="nm={a:'${f.a}',b:'${f.b}',o:${t.overs},f:0,tid:'${t.id}',fi:${i}};cur=null;go('match')">Play</button>`}</div>`}).join('')}</div><button class="btn d w" style="margin-top:14px" onclick="delT('${t.id}')">Delete tournament</button>`;
return `<h2>Tournaments</h2>${S.tours.map(t=>`<div class="card mc row sp" style="margin-top:12px" onclick="tsel='${t.id}';go('tour',1)"><b>${E(t.name)}</b><span class="badge">${t.fx.length} fixtures</span></div>`).join('')}<h3>Create tournament</h3><div class="card"><label>Name</label><input id="tt" placeholder="Summer Cup"><label>Overs per match</label><select id="to"><option>2</option><option selected>5</option><option>10</option><option>20</option></select><label>Teams (pick 3 or more)</label><div style="margin:6px 0 12px">${S.teams.map(x=>`<span class="chip" data-id="${x.id}" onclick="this.classList.toggle('on')">${E(x.name)}</span>`).join('')}</div><button class="btn w" onclick="addT()">Create and schedule</button></div>`}
function addT(){const n=$('#tt').value.trim(),ids=[...document.querySelectorAll('.chip.on')].map(c=>c.dataset.id);if(!n||ids.length<3)return toast('Add a name and pick 3+ teams');const t={id:uid(),name:n,overs:+$('#to').value,fx:[],u:Date.now()};for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)t.fx.push({a:ids[i],b:ids[j],mid:null});S.tours.push(t);tsel=t.id;save();go('tour',1)}
function delT(id){S.tours=S.tours.filter(t=>t.id!=id);DEL.tours.push(id);saveDel();tsel=null;save();go('tour',0,1)}
function theme(){const f=()=>{lsSet(TK,themeNow()=='dark'?'light':'dark');render()};document.startViewTransition?document.startViewTransition(f):f()}
let lastV=null,anim=false,fresh=false;
const themeNow=()=>lsGet(TK)||(S&&S.theme)||'dark';
function recover(){mod='';modOpen=false;cur=null;tsel=null;view='home';try{history.replaceState(null,'','#/home')}catch(e){}render()}
function fail(e){console.error(e);const a=$('#app');mod='';if(a)a.innerHTML=`<div class="top"><a class="logo" href="#/home"><img class="lg" src="/logo.svg" alt="" width="36" height="36"><span class="wm">${WM()}</span></a></div><div class="card" style="text-align:center;margin-top:30px"><b>Something went wrong</b><p class="sub">Your matches are safe on this device. Tap below to continue.</p><button class="btn w" style="margin-bottom:8px" onclick="recover()">Back to home</button><button class="btn o w" onclick="location.reload()">Reload app</button></div>`;const m=$('#mod');if(m)m.innerHTML=''}
function render(){try{draw()}catch(e){fail(e)}}
function draw(){
if(mod&&!modOpen){modOpen=true;try{history.pushState({m:1},'',location.href)}catch(e){}}
else if(!mod&&modOpen){modOpen=false;try{skipPop=true;history.back()}catch(e){skipPop=false}}
const th=themeNow(),tm=document.querySelector('meta[name=theme-color]');document.documentElement.dataset.theme=th;if(tm)tm.content=th=='dark'?'#05080f':'#eef3fb';
const V={home:Home,teams:Teams,match:Match,hist:Hist,tour:Tour,watch:Watch},dk=th=='dark';
$('#app').innerHTML=`<div class="top"><a class="logo" href="#/home" aria-label="${E(BRAND)} home" onclick="event.preventDefault();go('home')"><img class="lg" src="/logo.svg" alt="" width="36" height="36"><span class="wm">${WM()}</span></a><div class="row"><span class="sub" id="sy">${E(syncMsg)}</span><button class="btn o s" aria-label="Sound settings" onclick="openVS()">${VS.on?'🔊':'🔇'}</button><button class="btn o s" aria-label="Toggle theme" onclick="theme()">${dk?'☀️ Light':'🌙 Dark'}</button></div></div><div class="view${anim?' in':''}">`+V[view]()+'</div>';anim=false;fresh=false;
const mm=cur&&cur_();track((view=='watch'||view=='match')&&!!mm&&mm.status=='live'&&(view=='watch'||!can(mm)));if(off)netShow(netText());
if(lastV!==view||!$('#nav').firstChild){lastV=view;$('#nav').innerHTML=[['home','🏠','Home'],['match','🏏','Match'],['hist','📜','History'],['tour','🏆','Cups'],['teams','👥','Teams']].map(([k,i,l])=>`<button class="${view==k?'on':''}" aria-label="${l}" onclick="go('${k}')"><i>${i}</i>${l}</button>`).join('')}
$('#mod').innerHTML=mod}
load().then(()=>{route();render();setInterval(tick,3000);if(bgRefresh)poll(true)});
/* offline support: cache the app so it opens with no internet, and ask the browser not to clear saved matches */
if('serviceWorker' in navigator)addEventListener('load',()=>{navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{})});
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
