const socket=io();const $=id=>document.getElementById(id);
const canvas=DrawingBoard($('board')),finalCanvas=DrawingBoard($('finalBoard'));
const DURATION={drawing:20,discussion:60,voting:30,guessing:20};
const reduceMotion=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
let statusBase='',state=null,me=null,word='',wordHidden=false,results=null,submitted=false,resultShown=false,myVote=null,model=null;
const storage={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}},remove(k){try{localStorage.removeItem(k);}catch{}}};
let alertTimer;
function alertMsg(msg){$('alert').textContent=msg;$('alert').hidden=false;clearTimeout(alertTimer);alertTimer=setTimeout(()=>{$('alert').hidden=true},5000);}
function send(event,payload={},after){socket.emit(event,payload,res=>{if(!res?.ok){if(res?.message)alertMsg(res.message);return;}after?.(res);});}
function codeFromUrl(){return new URLSearchParams(location.search).get('room')?.trim().toUpperCase()||'';}
function el(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;}
function cap(p,size=''){const c=el('span','cap'+(size?' '+size:''),(p.name||'?')[0].toUpperCase());c.style.setProperty('--c',p.color);c.setAttribute('aria-hidden','true');return c;}
function player(id){return state?.players.find(p=>p.id===id);}
function person(id){return player(id)?.name||'Someone';}

/* entry */
function showEntry(view){for(const id of ['homeMenu','createPanel','joinPanel'])$(id).hidden=id!==view;}
const savedName=storage.get('spot:name')||'';
$('createName').value=savedName;$('joinName').value=savedName;
$('joinCode').value=codeFromUrl();if($('joinCode').value)showEntry('joinPanel');
$('openCreate').onclick=()=>{showEntry('createPanel');$('createName').focus();};
$('openJoin').onclick=()=>{showEntry('joinPanel');$('joinName').focus();};
document.querySelectorAll('.backButton').forEach(b=>b.onclick=()=>showEntry('homeMenu'));
function enter(code,id,name){me=id;storage.set('spot:room',code);storage.set('spot:id:'+code,id);storage.set('spot:name',name);history.replaceState(null,'','?room='+code);render();}
$('createForm').onsubmit=e=>{e.preventDefault();const name=$('createName').value.trim();if(!name)return alertMsg('Enter your name.');send('room:create',{name},res=>enter(res.code,res.playerId,name));};
$('joinForm').onsubmit=e=>{e.preventDefault();const name=$('joinName').value.trim(),code=$('joinCode').value.trim().toUpperCase();if(!name)return alertMsg('Enter your name.');send('room:join',{code,name,playerId:storage.get('spot:id:'+code)},res=>enter(res.code,res.playerId,name));};
$('joinCode').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4)});

/* lobby */
$('start').onclick=()=>send('game:start');
$('invite').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('invite').textContent='Copied';setTimeout(()=>$('invite').textContent='Copy invite link',2000);}catch{alertMsg('Copy the link from your address bar.')}};
document.querySelectorAll('.leave').forEach(b=>b.onclick=()=>{send('room:leave',{},()=>{storage.remove('spot:room');me=null;state=null;word='';results=null;resultShown=false;history.replaceState(null,'',location.pathname);showEntry('homeMenu');render();});});
function renderLobby(){
 const code=$('roomCode');if(code.dataset.code!==state.code){code.dataset.code=state.code;code.replaceChildren(...[...state.code].map(ch=>el('b',null,ch)));}
 $('notice').hidden=!state.notice;$('notice').textContent=state.notice||'';
 const list=$('lobbyPlayers'),known=new Set([...list.children].map(li=>li.dataset.id));list.replaceChildren();
 for(const p of state.players){const li=el('li',p.connected?'':'offline');li.dataset.id=p.id;if(!known.has(p.id)&&list.dataset.ready)li.classList.add('pop');
  li.append(cap(p),el('span',null,p.name));
  if(p.id===state.hostId)li.append(el('span','tag host','Host'));else if(p.id===me)li.append(el('span','tag','You'));
  if(p.id===state.hostId&&p.id===me)li.lastChild.textContent='Host (you)';list.append(li);}
 list.dataset.ready='1';
 if(state.players.length<8){const li=el('li');const c=el('span','cap empty','+');li.append(c,el('span','waiting','waiting for a friend…'));list.append(li);}
 const connected=state.players.filter(p=>p.connected).length,host=state.hostId===me;
 $('playerCount').textContent=`${state.players.length} of 8`;
 $('start').hidden=!host;$('start').disabled=connected<3;
 $('startHint').textContent=connected<3?`Need ${3-connected} more player${3-connected===1?'':'s'} to start`:host?'Everyone’s here. Start when ready.':'Waiting for the host to start';
}

/* game */
$('toggleWord').onclick=()=>{wordHidden=!wordHidden;renderWord();};
function renderWord(){$('word').textContent=wordHidden?'• • • • •':word||'…';$('wordHint').textContent=wordHidden?'Your word · tap to show':'Your word · tap to hide';}
$('chatForm').onsubmit=e=>{e.preventDefault();const t=$('chatText').value.trim();if(!t)return;send('chat:send',{text:t},()=>$('chatText').value='');};
$('guessForm').onsubmit=e=>{e.preventDefault();const t=$('guessText').value.trim();if(!t)return alertMsg('Type a guess first.');send('guess:submit',{text:t});};
function renderTurns(g,phase){
 const box=$('turns');box.replaceChildren();const order=g.turnOrder||[];if(!order.length)return;
 const idx=order.indexOf(g.turnId);
 order.forEach((id,i)=>{const t=el('span','t');t.style.background=player(id)?.color||'#999';t.title=person(id);
  if(phase!=='drawing'||g.round>1||i<idx)t.classList.add('done');if(phase==='drawing'&&i===idx)t.classList.add('now');box.append(t);});
 const lbl=el('span','muted small',phase==='drawing'?`Round ${g.round}/2`:'');lbl.style.cssText='margin-left:6px;white-space:nowrap;font-weight:700';box.append(lbl);
}
function renderSide(g,phase){
 const voting=phase==='voting',voted=g.voted.includes(me);
 $('sideTitle').textContent=voting?'Who’s the fake?':'Players';
 $('voteCount').textContent=voting?`${g.voted.length} of ${state.players.filter(p=>p.connected).length} voted`:'';
 const list=$('gamePlayers');list.replaceChildren();
 for(const p of state.players){const li=el('li',p.connected?'':'offline');
  if(voting&&p.id!==me){const b=el('button','vote-btn');b.type='button';b.append(cap(p,'sm'),el('span',null,p.name));
   const picked=myVote===p.id;b.append(el('span','pick',picked?'Voted':'Vote'));if(picked)b.classList.add('picked');
   b.disabled=voted||!p.connected;b.onclick=()=>send('vote:cast',{targetId:p.id},()=>{myVote=p.id;render();});li.append(b);}
  else{li.append(cap(p,'sm'),el('span',null,p.name+(p.id===me?' (you)':'')));
   if(phase==='drawing'&&p.id===g.turnId)li.append(el('span','tag host','Drawing'));
   else if(!p.connected)li.append(el('span','tag','Offline'));
   else if(voting&&g.voted.includes(p.id))li.append(el('span','tag','Voted'));}
  list.append(li);}
}
function renderGame(){
 const g=state.game,phase=state.phase,turn=g.turnId===me,voted=g.voted.includes(me);
 renderWord();renderTurns(g,phase);
 $('phase').textContent=({drawing:'Drawing',discussion:'Discussion',voting:'Voting',guessing:'Final guess'})[phase]||'';
 const drawer=player(g.turnId),guesser=g.guesserId;
 const text=({drawing:turn?'Your turn — draw one stroke':`${person(g.turnId)} is drawing…`,
  discussion:'Talk it over. Whose stroke looks off?',voting:voted?'Vote locked in. Waiting for the others.':'Vote for the fake',
  guessing:guesser===me?'You were caught! Guess their word to win':`${person(guesser)} was caught and is guessing the word…`})[phase]||'';
 $('statusText').textContent=text;
 statusBase=text;
 $('status').classList.toggle('mine',(phase==='drawing'&&turn)||(phase==='guessing'&&guesser===me)||(phase==='voting'&&!voted));
 $('statusDot').style.background=phase==='drawing'?(drawer?.color||'#FFD23F'):phase==='guessing'?(player(guesser)?.color||'#FFD23F'):'#FFD23F';
 const mine=player(me),myTurn=phase==='drawing'&&turn&&!submitted;canvas.update(g.strokes,myTurn,mine?.color);
 $('drawActions').hidden=!myTurn;$('tip').hidden=!myTurn;syncDrawActions();
 renderSide(g,phase);
 $('chat').hidden=phase!=='discussion';
 const msgs=$('messages');msgs.replaceChildren();
 g.chat.forEach(m=>{const p=el('p');const w=el('span','who',person(m.playerId)+' ');w.style.color=player(m.playerId)?.color||'';p.append(w,document.createTextNode(m.text));msgs.append(p);});
 msgs.scrollTop=msgs.scrollHeight;
 $('guessBox').hidden=!(phase==='guessing'&&guesser===me);
}
function syncDrawActions(){const has=canvas.hasPending();$('undoStroke').disabled=!has;$('confirmStroke').disabled=!has;$('drawActions').classList.toggle('ready',has);
 if(state?.phase==='drawing'&&state.game.turnId===me&&!submitted)$('statusText').textContent=has?'Happy with it? Tap Done, or undo and try again':statusBase;}
function confirmStroke(){if(submitted)return;const pts=canvas.confirm();if(!pts)return;submitted=true;$('drawActions').hidden=true;$('tip').hidden=true;
 $('statusText').textContent='Sent!';send('stroke:submit',{points:pts},()=>{});}
$('undoStroke').onclick=()=>{if(canvas.undo()){socket.emit('stroke:undo');syncDrawActions();}};
$('confirmStroke').onclick=confirmStroke;
function tick(){
 const g=state?.game,phase=state?.phase,t=$('timer');
 if(!g||!DURATION[phase]){$('timerNum').textContent='';t.style.setProperty('--p','0%');t.classList.remove('hot');return;}
 const left=Math.max(0,(g.endsAt-Date.now())/1000),pct=Math.min(100,left/DURATION[phase]*100);
 if(phase==='drawing'&&g.turnId===me&&!submitted&&left<0.8&&canvas.hasPending())confirmStroke();
 $('timerNum').textContent=Math.ceil(left);t.style.setProperty('--p',pct+'%');
 t.style.setProperty('--tc',left<=5?'#F2545B':phase==='voting'?'#8E6CEF':'#14A098');t.classList.toggle('hot',left<=5&&left>0);
}
setInterval(tick,200);

/* results */
const FX_COLORS=['#F2545B','#14A098','#FF9318','#8E6CEF','#4FB342','#F15FB0','#FFFFFF'];
const fx=(()=>{const cv=$('fx'),ctx=cv.getContext('2d'),hero=$('hero');let parts=[],raf=0,crumbMode=false;
 function size(){const r=hero.getBoundingClientRect(),d=devicePixelRatio||1;cv.width=r.width*d;cv.height=r.height*d;ctx.setTransform(d,0,0,d,0,0);}
 function loop(){if(raf||reduceMotion())return;const step=()=>{const r=hero.getBoundingClientRect();ctx.clearRect(0,0,r.width,r.height);
  parts=parts.filter(p=>p.life>0&&p.y<r.height+30);
  for(const p of parts){if(p.k==='c'){p.vy+=.22;p.vx*=.99;p.x+=p.vx;p.y+=p.vy;p.rot+=p.vr;p.life-=.006;
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);ctx.strokeStyle=p.c;ctx.lineWidth=4;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-p.len/2,0);ctx.quadraticCurveTo(0,-6,p.len/2,0);ctx.stroke();ctx.restore();}
   else{p.x+=p.vx;p.y+=p.vy;ctx.fillStyle='rgba(200,198,235,.55)';ctx.beginPath();ctx.ellipse(p.x,p.y,p.s,p.s*.7,0,0,7);ctx.fill();}}
  if(crumbMode&&parts.length<40)crumbs(2);
  raf=parts.length&&!$('results').hidden?requestAnimationFrame(step):0;};raf=requestAnimationFrame(step);}
 function burst(n,x,y){const r=hero.getBoundingClientRect();x??=r.width/2;y??=r.height*.35;
  for(let i=0;i<n;i++){const a=Math.random()*Math.PI*2,s=3+Math.random()*6;parts.push({k:'c',x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-4,rot:Math.random()*6,vr:(Math.random()-.5)*.3,c:FX_COLORS[i%FX_COLORS.length],len:8+Math.random()*10,life:1});}loop();}
 function crumbs(n){const r=hero.getBoundingClientRect();for(let i=0;i<n;i++)parts.push({k:'e',x:Math.random()*r.width,y:-10-Math.random()*r.height,vx:(Math.random()-.5)*.3,vy:.6+Math.random()*.8,s:2+Math.random()*3,life:1});loop();}
 function start(win){parts=[];crumbMode=!win;size();if(win)setTimeout(()=>burst(70),250);else crumbs(30);}
 addEventListener('resize',()=>{if(!$('results').hidden)size();});
 return {start,burst};})();

function ending(m){
 if(m.won&&!m.undercover)return {stamp:'Caught!',title:'You found the fake'};
 if(m.won&&m.undercover)return m.caught?{stamp:'Nailed it!',title:'You stole the win'}:{stamp:'Escaped!',title:'You fooled them all'};
 if(!m.won&&m.undercover)return {stamp:'Busted!',title:'They caught you'};
 return m.caught?{stamp:'Outsmarted!',title:'So close'}:{stamp:'Fooled!',title:'The fake got away'};
}
function slam(){const s=$('stamp');s.classList.remove('slam','wobble');void s.offsetWidth;s.classList.add('slam');}
function heroTap(e){if(!model)return;
 if(model.won){const r=$('hero').getBoundingClientRect();fx.burst(40,e.clientX?e.clientX-r.left:undefined,e.clientY?e.clientY-r.top:undefined);}
 else{const s=$('stamp');s.classList.remove('slam','wobble');void s.offsetWidth;s.classList.add('wobble');}}
$('hero').addEventListener('click',heroTap);
$('hero').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();heroTap({});}});
$('flipA').onclick=()=>$('flipA').classList.toggle('open');
// The fake's detail line names everyone's word, so it waits until that card is flipped.
function syncDetail(){$('resultDetail').hidden=!!model?.undercover&&!$('flipB').classList.contains('open');}
$('flipB').onclick=()=>{$('flipB').classList.toggle('open');syncDetail();if(model?.won&&$('flipB').classList.contains('open'))fx.burst(25);};
let replaying=false;
$('replayReveal').onclick=async()=>{if(replaying||!results)return;replaying=true;
 await finalCanvas.replay((s)=>{const w=$('replayWho');if(!s){w.textContent='That’s everyone';w.style.color='';return;}
  const fake=s.playerId===results.undercoverId;w.textContent=person(s.playerId)+(fake?' (the fake)':'');w.style.color=s.color;});
 replaying=false;};
$('again').onclick=()=>send('game:restart');
document.querySelectorAll('#reacts button').forEach(b=>b.onclick=()=>send('reaction:send',{emoji:b.textContent}));
function flyEmoji(emoji,playerId){const box=$('reacts'),btns=[...box.querySelectorAll('button')],b=btns.find(x=>x.textContent===emoji)||btns[0];
 const f=el('span','flyer',emoji);f.style.left=(b.offsetLeft+b.offsetWidth/2-14)+'px';f.style.setProperty('--r',(Math.random()*60-30)+'deg');
 if(playerId!==me)f.title=person(playerId);box.append(f);setTimeout(()=>f.remove(),1500);}

function renderResults(){
 const g=state.game,host=state.hostId===me,screen=$('results');
 model=GameResults.describe(state,results,me);const end=ending(model);
 screen.classList.toggle('win',model.won);screen.classList.toggle('lose',!model.won);
 $('stamp').textContent=end.stamp;$('winner').textContent=end.title;$('resultSummary').textContent=model.summary;
 $('resultRole').textContent=model.undercover?'You were the fake':'You were a civilian';
 $('tapHint').textContent=model.won?'Tap for more confetti':'Tap to shake it off';
 $('hero').setAttribute('aria-label',model.won?'Celebrate':'Shake it off');
 // Your own word is face up; the other side's word is the card you flip.
 const fakeLabel=model.undercover?'You, the fake':`${model.name}, the fake`;
 const own=model.undercover?{label:fakeLabel,word:results.wordB,fake:true}:{label:'Everyone',word:results.wordA,fake:false};
 const other=model.undercover?{label:'Everyone else',word:results.wordA,fake:false,front:'Tap to reveal everyone’s word'}:{label:fakeLabel,word:results.wordB,fake:true,front:'Tap to reveal the fake’s word'};
 $('flipALabel').textContent=own.label;$('flipAWord').textContent=own.word;$('flipAWord').classList.toggle('fake-word',own.fake);
 $('flipBFront').textContent=other.front;$('flipBLabel').textContent=other.label;$('flipBWord').textContent=other.word;$('flipBWord').classList.toggle('fake-word',other.fake);
 $('resultDetail').textContent=model.detail;
 const total=Math.max(1,results.votes.length),list=$('votes');list.replaceChildren();
 [...state.players].sort((a,b)=>(model.counts.get(b.id)||0)-(model.counts.get(a.id)||0)).forEach(p=>{
  const n=model.counts.get(p.id)||0,li=el('li'),bar=el('span','bar'),fill=el('i');fill.style.background=p.color;bar.append(fill);
  li.append(el('span','name',p.name+(p.id===me?' (you)':'')),bar,el('b',null,String(n)));list.append(li);
  setTimeout(()=>fill.style.width=(100*n/total)+'%',resultShown?0:300);});
 $('again').hidden=!host;$('waitHost').hidden=host;
 if(!replaying)finalCanvas.update(g.strokes,false,null,{halo:results.undercoverId});
 if(!resultShown){resultShown=true;$('flipB').classList.remove('open');syncDetail();$('replayWho').textContent='The final drawing';$('replayWho').style.color='';
  slam();requestAnimationFrame(()=>fx.start(model.won));}
}

/* top-level render */
function render(){
 const phase=state?.phase;
 $('home').hidden=!!state;$('lobby').hidden=phase!=='lobby';
 $('game').hidden=!phase||phase==='lobby'||phase==='results';
 $('results').hidden=!(phase==='results'&&results);
 if(!state)return;
 if(phase==='lobby')return renderLobby();
 if(!state.game)return;
 if(phase==='results'){if(results)renderResults();return;}
 renderGame();
}
socket.on('connect',()=>{const code=storage.get('spot:room');if(code&&storage.get('spot:id:'+code)){const name=storage.get('spot:name')||$('joinName').value;send('room:join',{code,name,playerId:storage.get('spot:id:'+code)},res=>enter(res.code,res.playerId,name));}});
socket.on('disconnect',()=>alertMsg('Connection lost. Reconnecting…'));
socket.on('room:state',s=>{
 if(state?.phase!==s.phase||state?.game?.turnId!==s.game?.turnId)submitted=false;
 if(s.phase!=='results'){resultShown=false;model=null;}
 if(s.phase!=='voting')myVote=null;
 if(s.phase==='lobby'&&state?.phase!=='lobby')word='';
 if(s.phase==='drawing'&&state?.phase==='results'){results=null;wordHidden=false;}
 $('joinCode').value=s.code;state=s;render();tick();});
socket.on('game:yourWord',v=>{word=v.word;wordHidden=false;renderWord();});
socket.on('game:results',r=>{results=r;render();});
socket.on('stroke:live',stroke=>{if(state?.phase==='drawing')canvas.live(stroke);});
socket.on('reaction',r=>{if(state?.phase==='results')flyEmoji(r.emoji,r.playerId);});
socket.on('error',e=>alertMsg(e.message));
window.addEventListener('board:progress',e=>socket.emit('stroke:progress',{points:e.detail}));
window.addEventListener('board:pending',()=>syncDrawActions());
render();
