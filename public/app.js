const $=s=>document.querySelector(s),uid=()=>Math.random().toString(36).slice(2,9),K='gullyscore.v1';
const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let S,view='home',cur=null,tab='score',tsel=null,mod='',q='',tf='',px=null,nm={a:'',b:'',o:5,f:0,tid:null,fi:null};
let syncMsg='',pend=null;
function flush(){pend=null;try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}push()}
const save=()=>{clearTimeout(pend);syncMsg='Saving…';const s=$('#sy');if(s)s.textContent=syncMsg;pend=setTimeout(flush,400)};
async function push(){try{const r=await fetch('/api/state',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(S)});if(!r.ok)throw 0;syncMsg='Saved'}catch(e){syncMsg='Offline: saved on this device'}const s=$('#sy');if(s)s.textContent=syncMsg}
addEventListener('online',push);document.addEventListener('visibilitychange',()=>{if(document.hidden&&pend){clearTimeout(pend);flush()}});
addEventListener('pagehide',()=>{if(pend){clearTimeout(pend);try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}}});
const T=id=>S.teams.find(t=>t.id==id)||{name:'?',players:[]};
const ovs=b=>Math.floor(b/6)+'.'+b%6,rr=(r,b)=>b?(r*6/b).toFixed(2):'0.00';
const B=(n,k)=>n.bats[k]||(n.bats[k]={r:0,b:0,f:0,s:0,o:0}),W=(n,k)=>n.bowls[k]||(n.bowls[k]={b:0,r:0,w:0});
function newInn(m,i){const bt=m.teams[i],P=T(bt).players,n={bat:bt,bowl:m.teams[1-i],runs:0,wk:0,b:0,ex:0,st:P[0],ns:P[1],nx:2,bats:{},bowls:{},bw:null,lb:null,ov:[],h:[]};B(n,P[0]);B(n,P[1]);return n}
function ball(n,e){n.h.push(JSON.stringify(n,(k,v)=>k=='h'?undefined:v));if(n.h.length>40)n.h.shift();const nw=T(n.bat).players.length,bs=B(n,n.st),bw=W(n,n.bw),x=e.x,r=e.r;let add=r,leg=1;
if(x=='wd'){add=r+1;leg=0;n.ex+=add;bw.r+=add}else if(x=='nb'){add=r+1;leg=0;n.ex++;bw.r+=add;bs.r+=r;bs.b++;r==4&&bs.f++;r==6&&bs.s++}
else if(x=='by'||x=='lb'){n.ex+=r;bs.b++}else{bs.r+=r;bw.r+=r;bs.b++;r==4&&bs.f++;r==6&&bs.s++}
n.runs+=add;n.oruns=(n.oruns||0)+add;if(leg){n.b++;bw.b++}
n.ov.push(e.w?'W':x?({wd:'Wd',nb:'Nb',by:'B',lb:'Lb'}[x])+(r||''):String(r));
if(e.w){bs.o=1;n.wk++;n.owk=(n.owk||0)+1;bw.w++;if(n.wk<nw-1){n.st=T(n.bat).players[n.nx++];B(n,n.st)}}
if(r%2)[n.st,n.ns]=[n.ns,n.st];if(leg&&n.b%6==0){[n.st,n.ns]=[n.ns,n.st];n.lb=n.bw;n.bw=null;n.ov=[];n.lor=n.oruns;n.lwk=n.owk||0;n.oruns=0;n.owk=0}}
function undo(m){let n=m.inn[m.ci];if(!n.h.length&&m.ci==1){m.inn.pop();m.ci=0;n=m.inn[0]}if(!n.h.length)return toast('Nothing to undo');const o=JSON.parse(n.h.pop());o.h=n.h;Object.assign(n,o);if(m.status=='done'){m.status='live';delete m.potm;delete m.win;delete m.res;delete m.mt;delete m.mg}speechSynthesis&&speechSynthesis.cancel&&speechSynthesis.cancel();save();render()}
function chk(m){const n=m.inn[m.ci],nw=T(n.bat).players.length,end=n.b>=m.overs*6||n.wk>=nw-1;
if(!m.ci){if(end){m.ci=1;m.inn.push(newInn(m,1));toast('Innings break')}}
else if(end||n.runs>m.inn[0].runs){m.status='done';const a=m.inn[0].runs,b=n.runs;
if(b>a){m.win=n.bat;const w=nw-1-n.wk;m.mt='wickets';m.mg=w;m.res=T(n.bat).name+' won by '+w+' wicket'+(w==1?'':'s')}
else if(a>b){m.win=m.inn[0].bat;m.mt='runs';m.mg=a-b;m.res=T(m.win).name+' won by '+(a-b)+' run'+(a-b==1?'':'s')}else{m.win=null;m.res='Match tied';m.mt=null}m.potm=tp(m)}}
function mk(a,b,o,f,d,tid,fi){const m={id:uid(),teams:f?[b,a]:[a,b],overs:+o,inn:[],ci:0,status:'live',date:d||Date.now(),tid,fi};m.inn.push(newInn(m,0));return m}
async function load(){let l;try{l=JSON.parse(localStorage.getItem(K))}catch(e){}try{const r=await fetch('/api/state');if(!r.ok)throw 0;S=await r.json();syncMsg='Saved'}catch(e){S=l;syncMsg='Offline: saved on this device'}if(!S||!S.teams)S={teams:[],matches:[],tours:[],theme:null}}
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
<div class="sub" style="margin-top:6px">${m.status=='done'?E(m.res)+(tpf?' · ⭐ POTM '+E(tpf.n)+' '+tpf.txt:''):E(T(m.inn[m.ci].bat).name)+' batting'}</div></div>`}
const toast=t=>{const d=document.createElement('div');d.className='toast';d.textContent=t;document.body.append(d);setTimeout(()=>d.remove(),1800)};
const go=v=>{view=v;if(v=='tour')tsel=null;if(v=='match'&&cur&&!S.matches.find(m=>m.id==cur))cur=null;scrollTo(0,0);anim=true;render()};
const open=id=>{cur=id;tab='score';go('match')};
function Home(){const lv=S.matches.filter(m=>m.status=='live'),dn=S.matches.filter(m=>m.status=='done').sort((a,b)=>b.date-a.date).slice(0,3);
return `<div class="hero"><h2>Play it. Score it. Settle it.</h2><div class="st"><div><b>${S.matches.length}</b><span>matches</span></div><div><b>${S.teams.length}</b><span>teams</span></div><div><b>${S.tours.length}</b><span>tournaments</span></div></div></div>
<button class="btn ball-b w" onclick="nm.tid=null;cur=null;go('match')">Start new match</button>
<h3>Ongoing matches</h3><div class="gl">${lv.map(m=>mcard(m,'open')).join('')||'<div class="card sub">No live match. Start one above.</div>'}</div>
<h3>Recent matches</h3><div class="gl">${dn.map(m=>mcard(m,'showSC')).join('')||'<div class="card sub">Finished matches show up here.</div>'}</div>
<h3>Tournaments</h3><div class="gl">${S.tours.map(t=>`<div class="card mc row sp" onclick="tsel='${t.id}';go('tour')"><div><b>${E(t.name)}</b><div class="sub">${t.fx.length} fixtures · ${t.overs} overs</div></div><span class="badge">${t.fx.filter(f=>f.mid&&S.matches.find(m=>m.id==f.mid&&m.status=='done')).length}/${t.fx.length} played</span></div>`).join('')||'<div class="card sub">Create a tournament for your colony.</div>'}</div>`}
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
function addTeam(){const v=vt(nt.name,nt.p,null,'np','te','tn');if(!v)return;S.teams.push({id:uid(),...v});nt={name:'',n:nt.n,p:[]};save();render();toast('Team added')}
const editT=id=>{const t=T(id);et={id,name:t.name,p:[...t.players]};render()};
function addEP(){if(et.p.length>=MAXP)return toast('Maximum '+MAXP+' players');et.p.push('');render();const i=$('#ep'+(et.p.length-1));i&&i.focus()}
function rmEP(i){if(et.p.length<=MINP)return;et.p.splice(i,1);render()}
function saveT(){const v=vt(et.name,et.p,et.id,'ep','ee','en');if(!v)return;const t=T(et.id);t.name=v.name;t.players=v.players;et=null;save();render();toast('Team saved')}
function delTeam(id){const t=T(id);if(inLive(id))return toast('Finish the live match first');if(S.matches.some(m=>m.teams.includes(id))||S.tours.some(x=>x.fx.some(f=>f.a==id||f.b==id)))return toast('Team has matches or a tournament, so it cannot be deleted');if(!confirm('Delete team "'+t.name+'"?'))return;S.teams=S.teams.filter(x=>x.id!=id);save();render()}
function Match(){const m=S.matches.find(x=>x.id==cur);if(m)return m.status=='live'?Live(m):Done(m);
if(S.teams.length<2)return '<div class=card><b>Add two teams to start scoring</b><p class=sub>Create your teams and players first.</p><button class="btn w" onclick="go(\'teams\')">Add teams</button></div>';
nm.a=nm.a||S.teams[0].id;nm.b=nm.b&&nm.b!=nm.a?nm.b:S.teams.find(t=>t.id!=nm.a).id;const so=t=>S.teams.map(x=>`<option value="${x.id}" ${x.id==t?'selected':''}>${E(x.name)}</option>`).join('');
return `<h2>New match</h2><div class="card" style="margin-top:12px"><label>Team A</label><select onchange="nm.a=this.value;render()" ${nm.tid?'disabled':''}>${so(nm.a)}</select><label>Team B</label><select onchange="nm.b=this.value;render()" ${nm.tid?'disabled':''}>${so(nm.b)}</select>
<label>Overs</label><div style="margin:6px 0 10px">${[2,5,10,20].map(o=>`<span class="chip ${nm.o==o?'on':''}" onclick="nm.o=${o};render()">${o}</span>`).join('')}<input type="number" min="1" max="50" placeholder="Custom" value="${[2,5,10,20].includes(+nm.o)?'':nm.o}" oninput="nm.o=+this.value||5" style="width:110px;display:inline-block;margin:0 0 0 6px"></div>
<label>Batting first</label><select onchange="nm.f=+this.value"><option value="0" ${!nm.f?'selected':''}>${E(T(nm.a).name)}</option><option value="1" ${nm.f?'selected':''}>${E(T(nm.b).name)}</option></select><button class="btn ball-b w" onclick="startM()">Play ball</button></div>${h2h()}`}
function rematch(id){const m=S.matches.find(x=>x.id==id);if(!m)return;mod='';nm={a:m.teams[0],b:m.teams[1],o:m.overs,f:1,tid:null,fi:null,prev:id};cur=null;go('match');toast('Rematch ready: the other team bats first')}
function h2h(){const a=nm.a,b=nm.b,l=S.matches.filter(m=>m.status=='done'&&m.teams.includes(a)&&m.teams.includes(b)).sort((x,y)=>y.date-x.date);
if(!l.length)return '<div class="card sub" style="margin-top:12px">No earlier matches between these teams. This will be their first.</div>';
const w=id=>l.filter(m=>m.win==id).length,t=l.filter(m=>m.win==null).length;
return `<h3>Head to head</h3><div class="card"><div class="row sp"><b>${E(T(a).name)} ${w(a)}</b><span class="sub">${l.length} played${t?' · '+t+' tied':''}</span><b>${w(b)} ${E(T(b).name)}</b></div></div><div class="gl">${l.slice(0,4).map(m=>mcard(m,'showSC')).join('')}</div>`}
function startM(){if(nm.a==nm.b)return toast('Pick two different teams');if(T(nm.a).players.length<2||T(nm.b).players.length<2)return toast('Each team needs 2+ players');
const m=mk(nm.a,nm.b,nm.o,nm.f,0,nm.tid,nm.fi);if(nm.prev)m.prev=nm.prev;nm.prev=null;S.matches.push(m);if(nm.tid)S.tours.find(t=>t.id==nm.tid).fx[nm.fi].mid=m.id;nm.tid=null;cur=m.id;tab='score';save();render()}
function Live(m){const n=m.inn[m.ci],mb=m.overs*6,left=mb-n.b,tg=m.ci?m.inn[0].runs+1:0;
const tabs=`<div class="tabs"><button class="btn s ${tab=='score'?'':'o'}" onclick="tab='score';render()">Score</button><button class="btn s ${tab=='card'?'':'o'}" onclick="tab='card';render()">Scorecard</button></div>`;
if(tab=='card')return tabs+scard(m);
const bs=B(n,n.st),bn=B(n,n.ns),bw=n.bw&&W(n,n.bw);
const picker=n.bw?'':`<div class="mod"><div><h3 style="margin-top:0">Who bowls the ${n.b?'next':'first'} over?</h3>${T(n.bowl).players.filter(p=>p!=n.lb).map(p=>`<button class="btn o w" style="margin-bottom:8px" onclick="setB('${E(p).replace(/'/g,"\\'")}')">${E(p)}</button>`).join('')}</div></div>`;
return `${tabs}<div class="live"><div class="score"><div class="sub" style="color:#bfe9f5">${E(T(n.bat).name)} · Innings ${m.ci+1}</div><div class="big${fresh?' nw':''}">${n.runs}<small>/${n.wk}</small></div><div class="row sp" style="margin-top:6px"><span>${ovs(n.b)} / ${m.overs} ov</span><span>CRR ${rr(n.runs,n.b)}</span><span>Extras ${n.ex}</span></div>
${m.ci?`<div class="tgt">Need ${Math.max(tg-n.runs,0)} from ${left} balls · RRR ${rr(Math.max(tg-n.runs,0),left)}</div>`:''}</div>
<div class="card tw"><table><tr><th>Batting</th><th>R</th><th>B</th><th>4s</th><th>6s</th></tr><tr><td><b>${E(n.st)}*</b></td><td>${bs.r}</td><td>${bs.b}</td><td>${bs.f}</td><td>${bs.s}</td></tr><tr><td>${E(n.ns)}</td><td>${bn.r}</td><td>${bn.b}</td><td>${bn.f}</td><td>${bn.s}</td></tr></table>
<div class="row sp" style="margin-top:10px"><span>🎯 <b>${n.bw?E(n.bw):'Pick bowler'}</b></span><span class="sub">${bw?ovs(bw.b)+' ov · '+bw.r+' runs · '+bw.w+' wkts':''}</span></div><div class="ov">${n.ov.map((x,i)=>`<span class="b ${x=='W'?'wk':x=='4'?'f':x=='6'?'six':isNaN(x)?'e':''}${fresh&&i==n.ov.length-1?' nw':''}">${x}</span>`).join('')||'<span class=sub>New over</span>'}</div></div>
<div class="pad">${[0,1,2,3,4,6].map(r=>`<button class="${r==4?'f':r==6?'six':''}" onclick="run(${r},0)">${r}</button>`).join('')}
<button class="wk" style="grid-column:1/-1" onclick="run(0,1)">Wicket</button>${[['wd','Wide'],['nb','No ball'],['by','Bye'],['lb','Leg bye']].map(([k,l])=>`<button class="ex ${px==k?'on':''}" onclick="px=px=='${k}'?null:'${k}';render()">${l}</button>`).join('')}<button class="ac" onclick="undo(cur_())">↶ Undo</button><button class="ac" onclick="swap()">⇄ Swap</button></div>
<div class="sub${px?' xh':''}" style="text-align:center;margin-top:10px">${px?'<b>'+XL[px]+'</b> selected: now tap the runs scored (0 if none)':'For Wide, No ball, Bye or Leg bye tap it first, then the runs'}</div></div>${picker}`}
const cur_=()=>S.matches.find(x=>x.id==cur),XL={wd:'Wide',nb:'No ball',by:'Bye',lb:'Leg bye'};
function cele(t,c,o){o=o||{};document.querySelectorAll('.cele').forEach(e=>e.remove());const d=document.createElement('div');d.className='cele '+(o.k||'');d.style.setProperty('--cc',c);let p='';
if(o.k=='bd')for(let i=0;i<30;i++){const a=Math.random()*6.283,r=140+Math.random()*240;p+=`<i style="--dx:${Math.cos(a)*r|0}px;--dy:${Math.sin(a)*r|0}px;--bg:${['#ff4d6d','#2ee6c5','#ffd60a','#3b82ff','#a78bfa'][i%5]};--dl:${(Math.random()*.15).toFixed(2)}s"></i>`}
d.innerHTML=`<div class="ct">${E(t)}</div>${o.s?`<div class="cs">${E(o.s)}</div>`:''}${p}`;document.body.append(d);setTimeout(()=>d.remove(),1350)}
let VS={on:true,fx:true,every:true,ann:true,lang:'en-IN',voice:'',g:'f',vol:1,rate:1};try{Object.assign(VS,JSON.parse(localStorage.getItem('chauka.voice3')||'{}'))}catch(e){}
const lg=()=>VS.lang.startsWith('hi')?'hi':'en',SS='speechSynthesis' in window;let VO=[];const lv=()=>{VO=SS?speechSynthesis.getVoices():[]};lv();SS&&(speechSynthesis.onvoiceschanged=lv);
const LX={en:{four:'Four',six:'Six',wk:n=>`Wicket, ${n} is out`,wd:r=>r?`Wide ball, and ${r} ${r==1?'run':'runs'} more`:'Wide ball',nb:r=>r?`No ball, and ${r} ${r==1?'run':'runs'} off the bat`:'No ball',by:r=>r?`${r} ${r==1?'bye':'byes'}`:'Bye',lb:r=>r?`${r} leg ${r==1?'bye':'byes'}`:'Leg bye',dot:'Dot ball',run:r=>['','One run','Two runs','Three runs'][r]||r+' runs',
over:(o,x,w,r,k)=>`Over ${o} complete. ${x} ${x==1?'run':'runs'}${w?', '+w+(w==1?' wicket':' wickets'):''}. Score ${r} for ${k}.`,inn:(t,r,w)=>`Innings over. ${t}, ${r} for ${w}.`,res:m=>m.res+'.',potm:n=>`Player of the match, ${n}.`,test:'Chauka commentary is ready.'},
hi:{four:'चौका',six:'छक्का',wk:n=>`विकेट, ${n} आउट`,wd:r=>r?`वाइड बॉल, और ${r} रन`:'वाइड बॉल',nb:r=>r?`नो बॉल, और ${r} रन`:'नो बॉल',by:r=>r?`${r} बाई`:'बाई',lb:r=>r?`${r} लेग बाई`:'लेग बाई',dot:'डॉट बॉल',run:r=>r+' रन',
over:(o,x,w,r,k)=>`ओवर ${o} समाप्त। ${x} रन${w?', '+w+' विकेट':''}। स्कोर ${k} विकेट पर ${r}।`,inn:(t,r,w)=>`पारी समाप्त। ${t}, ${w} विकेट पर ${r} रन।`,res:m=>m.win?`${T(m.win).name} ${m.mg} ${m.mt=='runs'?'रन':'विकेट'} से जीता।`:'मैच टाई रहा।',potm:n=>`प्लेयर ऑफ द मैच, ${n}।`,test:'चौका कमेंट्री तैयार है।'}};
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
function run(r,w){const m=cur_(),n=m.inn[m.ci];if(!n.bw||m.status!="live")return;const x=px,ob=n.b,oc=m.ci,out=n.st,l=LX[lg()];ball(n,{r,w,x});px=null;fresh=true;chk(m);save();render();navigator.vibrate&&navigator.vibrate(w?40:12);const q=[],pl=k=>k+(k==1?' run':' runs');
if(w)cele('WICKET','#ff4d6d',{k:'wk',s:out+' is out'});
else if(x=='wd')cele('WIDE','#f59e0b',{k:'ex',s:'+'+pl(r+1)});
else if(x=='nb')cele('NO BALL','#f97316',{k:'ex',s:'+'+pl(r+1)});
else if(x=='by')cele('BYE','#06b6d4',{k:'ex',s:r?'+'+pl(r):''});
else if(x=='lb')cele('LEG BYE','#06b6d4',{k:'ex',s:r?'+'+pl(r):''});
else if(r==4)cele('FOUR','#3b82f6',{k:'bd'});else if(r==6)cele('SIX','#8b5cf6',{k:'bd'});
fx(w?'wk':x=='wd'||x=='nb'?'ex':!x&&r==4?'four':!x&&r==6?'six':'tap');
if(VS.every)q.push(w?l.wk(out):x=='wd'?l.wd(r):x=='nb'?l.nb(r):x=='by'?l.by(r):x=='lb'?l.lb(r):r==4?l.four:r==6?l.six:r?l.run(r):l.dot);
if(n.b>ob&&n.b%6==0){q.push(l.over(n.b/6,n.lor||0,n.lwk||0,n.runs,n.wk));fx('over')}
if(m.ci>oc){if(VS.ann){const f=m.inn[0];q.push(l.inn(T(f.bat).name,f.runs,f.wk))}}
else if(m.status=='done'){if(VS.ann){q.push(l.res(m));const p=pm(m);if(p)q.push(l.potm(p.n))}fx('end');toast(m.res)}
say(q)}
function setB(p){cur_().inn[cur_().ci].bw=p;save();render()}
function swap(){const n=cur_().inn[cur_().ci];[n.st,n.ns]=[n.ns,n.st];save();render()}
function scard(m){return '<div class="gl">'+m.inn.map(n=>`<div class="card tw"><div class="row sp"><b>${E(T(n.bat).name)}</b><b class="num">${n.runs}/${n.wk} (${ovs(n.b)})</b></div><table><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr>${Object.keys(n.bats).map(k=>{const b=n.bats[k];return `<tr><td>${E(k)}<div class="sub">${b.o?'out':(k==n.st||k==n.ns)&&m.status=='live'?'batting':'not out'}</div></td><td><b>${b.r}</b></td><td>${b.b}</td><td>${b.f}</td><td>${b.s}</td><td>${b.b?(b.r*100/b.b).toFixed(0):0}</td></tr>`}).join('')}</table>
<table style="margin-top:10px"><tr><th>Bowler</th><th>O</th><th>R</th><th>W</th><th>Eco</th></tr>${Object.keys(n.bowls).map(k=>{const b=n.bowls[k];return `<tr><td>${E(k)}</td><td>${ovs(b.b)}</td><td>${b.r}</td><td><b>${b.w}</b></td><td>${rr(b.r,b.b)}</td></tr>`}).join('')}</table><div class="sub" style="margin-top:8px">Extras: ${n.ex}</div></div>`).join('')+'</div>'}
function Done(m){const x=pm(m);return `<div class="score"><span class="badge">Result</span><h2 style="margin:10px 0;font-size:26px">${E(m.res)}</h2>${[0,1].map(i=>`<div class="row sp"><span>${E(T(m.teams[i]).name)}</span><b>${sc(m,i)}</b></div>`).join('')}${x?`<div class="tgt" style="font-size:15px">⭐ Player of the match<div class="num" style="font-size:26px;margin:4px 0 2px">${E(x.n)}</div>${E(T(x.t).name)} · ${x.txt}</div>`:''}</div>
<button class="btn ball-b w" style="margin-bottom:10px" onclick="rematch('${m.id}')">🔁 Rematch</button><div class="row" style="margin-bottom:12px"><button class="btn g" onclick="share('${m.id}')">Share image</button><button class="btn o g" onclick="copyS('${m.id}')">Copy summary</button></div><button class="btn o w" style="margin-bottom:12px" onclick="undo(cur_())">↶ Undo last ball</button><button class="btn o w" style="margin-bottom:12px;color:var(--r)" onclick="delM('${m.id}')">Delete match</button>${scard(m)}<button class="btn ball-b w" onclick="cur=null;go('match')">New match</button>`}
function summ(m){const x=pm(m);return `Chauka · ${dt(m.date)} · ${m.overs} overs\n${[0,1].map(i=>T(m.teams[i]).name+': '+(m.inn[i]?m.inn[i].runs+'/'+m.inn[i].wk+' ('+ovs(m.inn[i].b)+')':'-')).join('\n')}\n${m.res||'In progress'}${x?'\nPlayer of the match: '+x.n+' '+x.txt:''}`}
function copyS(id){const m=S.matches.find(x=>x.id==id);try{navigator.clipboard.writeText(summ(m));toast('Summary copied')}catch(e){mod=`<div class="mod" onclick="if(event.target==this)closeM()"><div><pre style="white-space:pre-wrap">${E(summ(m))}</pre></div></div>`;render()}}
function share(id){const m=S.matches.find(x=>x.id==id),c=document.createElement('canvas');c.width=1080;c.height=1080;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,1080,1080);g.addColorStop(0,'#0b1d4a');g.addColorStop(1,'#0fa88f');x.fillStyle=g;x.fillRect(0,0,1080,1080);x.fillStyle='#2ee6c5';x.beginPath();x.arc(960,120,150,0,7);x.fill();
const F='Bricolage Grotesque,system-ui,sans-serif';x.fillStyle='#fff';x.font='800 64px '+F;x.fillText('Chauka',70,130);x.font='34px '+F;x.fillStyle='#bfe9f5';x.fillText(dt(m.date)+' · '+m.overs+' overs',70,185);
[0,1].forEach(i=>{const n=m.inn[i],y=380+i*190;x.fillStyle='#fff';x.font='700 50px '+F;x.fillText(T(m.teams[i]).name,70,y);x.font='800 90px '+F;x.textAlign='right';x.fillStyle='#2ee6c5';x.fillText(n?n.runs+'/'+n.wk:'-',1010,y+10);x.font='32px '+F;x.fillStyle='#bfe9f5';x.fillText(n?ovs(n.b)+' overs':'',1010,y+55);x.textAlign='left'});
x.fillStyle='#fff';x.font='700 46px '+F;x.fillText(m.res||'Live match',70,800);const t=pm(m);if(t){x.fillStyle='#bfe9f5';x.font='30px '+F;x.fillText('Player of the match',70,870);x.fillStyle='#2ee6c5';x.font='800 54px '+F;x.fillText('⭐ '+t.n,70,935);x.fillStyle='#fff';x.font='32px '+F;x.fillText(T(t.t).name+' · '+t.txt,70,980)}x.fillStyle='#bfe9f5';x.font='28px '+F;x.fillText('Scored on Chauka',70,1052);
mod=`<div class="mod" onclick="if(event.target==this)closeM()"><div><img class="sh" src="${c.toDataURL('image/png')}"><p class="sub">Press and hold the image to save or share it.</p><button class="btn w" onclick="closeM()">Done</button></div></div>`;render()}
function delM(id){if(!confirm('Delete this match permanently?'))return;S.matches=S.matches.filter(m=>m.id!=id);S.tours.forEach(t=>t.fx.forEach(f=>{if(f.mid==id)f.mid=null}));cur=null;save();go('match')}
const closeM=()=>{mod='';render()};
function showSC(id){const m=S.matches.find(x=>x.id==id);mod=`<div class="mod" onclick="if(event.target==this)closeM()"><div><div class="row sp"><h3 style="margin:0">${E(T(m.teams[0]).name)} vs ${E(T(m.teams[1]).name)}</h3><button class="btn o s" onclick="closeM()">Close</button></div><p class="sub">${E(m.res||'In progress')} · ${dt(m.date)}</p>${scard(m)}${m.status=='done'?`<button class="btn ball-b w" style="margin-bottom:10px" onclick="rematch('${m.id}')">🔁 Rematch</button>`:''}<div class="row"><button class="btn g" onclick="share('${m.id}')">Share image</button><button class="btn o g" onclick="copyS('${m.id}')">Copy summary</button></div></div></div>`;render()}
function Hist(){return `<h2>Match history</h2>${lb(S.matches,'Top players')}<div class="row" style="margin-top:12px"><input placeholder="Search team, result, date" value="${E(q)}" oninput="q=this.value;hl()"><select onchange="tf=this.value;hl()" style="width:140px"><option value="">All teams</option>${S.teams.map(t=>`<option value="${t.id}" ${tf==t.id?'selected':''}>${E(t.name)}</option>`).join('')}</select></div><div id="hl">${hlist()}</div>`}
function hlist(){const s=q.toLowerCase(),a=S.matches.filter(m=>m.status=='done'&&(!tf||m.teams.includes(tf))&&(!s||(m.teams.map(t=>T(t).name).join(' ')+m.res+dt(m.date)).toLowerCase().includes(s))).sort((a,b)=>b.date-a.date);return '<div class="gl">'+(a.map(m=>mcard(m,'showSC')).join('')||'<div class="card sub">No matches found. Try another search.</div>')+'</div>'}
const hl=()=>$('#hl').innerHTML=hlist();
function table(t){const r={};t.fx.forEach(f=>[f.a,f.b].forEach(i=>r[i]=r[i]||{id:i,p:0,w:0,l:0,t:0,rf:0,bf:0,ra:0,ba:0}));
t.fx.forEach(f=>{const m=S.matches.find(x=>x.id==f.mid);if(!m||m.status!='done')return;m.inn.forEach((n,i)=>{const o=m.inn[1-i],a=r[n.bat],b=r[n.bowl],fb=n.wk>=T(n.bat).players.length-1?m.overs*6:n.b;a.rf+=n.runs;a.bf+=fb;b.ra+=n.runs;b.ba+=fb});[f.a,f.b].forEach(i=>{r[i].p++;m.win==null?r[i].t++:m.win==i?r[i].w++:r[i].l++})});
return Object.values(r).map(x=>({...x,pts:x.w*2+x.t,nrr:(x.bf?x.rf*6/x.bf:0)-(x.ba?x.ra*6/x.ba:0)})).sort((a,b)=>b.pts-a.pts||b.nrr-a.nrr)}
function Tour(){const t=S.tours.find(x=>x.id==tsel);if(t)return `<button class="btn o s" onclick="tsel=null;render()">← All</button><h2 style="margin:12px 0">${E(t.name)}</h2><div class="card tw"><table><tr><th>Team</th><th>P</th><th>W</th><th>L</th><th>Pts</th><th>NRR</th></tr>${table(t).map(x=>`<tr><td><b>${E(T(x.id).name)}</b></td><td>${x.p}</td><td>${x.w}</td><td>${x.l}</td><td><b>${x.pts}</b></td><td>${x.nrr>=0?'+':''}${x.nrr.toFixed(2)}</td></tr>`).join('')}</table></div>
${lb(t.fx.map(f=>S.matches.find(x=>x.id==f.mid)).filter(Boolean),'Player of the tournament race')}<h3>Fixtures</h3><div class="gl">${t.fx.map((f,i)=>{const m=S.matches.find(x=>x.id==f.mid);return `<div class="card row sp"><div><b>${E(T(f.a).name)} vs ${E(T(f.b).name)}</b><div class="sub">${m?E(m.res||'Live now'):'Scheduled'}</div></div>${m?`<button class="btn o s" onclick="${m.status=='live'?`open('${m.id}')`:`showSC('${m.id}')`}">${m.status=='live'?'Resume':'View'}</button>`:`<button class="btn s" onclick="nm={a:'${f.a}',b:'${f.b}',o:${t.overs},f:0,tid:'${t.id}',fi:${i}};cur=null;go('match')">Play</button>`}</div>`}).join('')}</div><button class="btn d w" style="margin-top:14px" onclick="delT('${t.id}')">Delete tournament</button>`;
return `<h2>Tournaments</h2>${S.tours.map(t=>`<div class="card mc row sp" style="margin-top:12px" onclick="tsel='${t.id}';render()"><b>${E(t.name)}</b><span class="badge">${t.fx.length} fixtures</span></div>`).join('')}<h3>Create tournament</h3><div class="card"><label>Name</label><input id="tt" placeholder="Summer Cup"><label>Overs per match</label><select id="to"><option>2</option><option selected>5</option><option>10</option><option>20</option></select><label>Teams (pick 3 or more)</label><div style="margin:6px 0 12px">${S.teams.map(x=>`<span class="chip" data-id="${x.id}" onclick="this.classList.toggle('on')">${E(x.name)}</span>`).join('')}</div><button class="btn w" onclick="addT()">Create and schedule</button></div>`}
function addT(){const n=$('#tt').value.trim(),ids=[...document.querySelectorAll('.chip.on')].map(c=>c.dataset.id);if(!n||ids.length<3)return toast('Add a name and pick 3+ teams');const t={id:uid(),name:n,overs:+$('#to').value,fx:[]};for(let i=0;i<ids.length;i++)for(let j=i+1;j<ids.length;j++)t.fx.push({a:ids[i],b:ids[j],mid:null});S.tours.push(t);tsel=t.id;save();render()}
function delT(id){S.tours=S.tours.filter(t=>t.id!=id);tsel=null;save();render()}
function theme(){const f=()=>{S.theme=document.documentElement.dataset.theme=='dark'?'light':'dark';save();render()};document.startViewTransition?document.startViewTransition(f):f()}
let lastV=null,anim=false,fresh=false;
function render(){document.documentElement.dataset.theme=S.theme||'dark';const V={home:Home,teams:Teams,match:Match,hist:Hist,tour:Tour},dk=document.documentElement.dataset.theme=='dark';
$('#app').innerHTML=`<div class="top"><div class="logo"><span class="ball"></span>Chauka</div><div class="row"><span class="sub" id="sy">${E(syncMsg)}</span><button class="btn o s" aria-label="Sound settings" onclick="openVS()">${VS.on?'🔊':'🔇'}</button><button class="btn o s" aria-label="Toggle theme" onclick="theme()">${dk?'☀️ Light':'🌙 Dark'}</button></div></div><div class="view${anim?' in':''}">`+V[view]()+'</div>';anim=false;fresh=false;
if(lastV!==view||!$('#nav').firstChild){lastV=view;$('#nav').innerHTML=[['home','🏠','Home'],['match','🏏','Match'],['hist','📜','History'],['tour','🏆','Cups'],['teams','👥','Teams']].map(([k,i,l])=>`<button class="${view==k?'on':''}" aria-label="${l}" onclick="go('${k}')"><i>${i}</i>${l}</button>`).join('')}
$('#mod').innerHTML=mod}
load().then(render);
