const socket=io();const $=id=>document.getElementById(id);
const canvas=DrawingBoard($('board')),finalCanvas=DrawingBoard($('finalBoard'));
let state=null,me=null,word='',wordHidden=false,results=null,submitted=false;
const storage={get(k){try{return localStorage.getItem(k);}catch{return null;}},set(k,v){try{localStorage.setItem(k,v);}catch{}},remove(k){try{localStorage.removeItem(k);}catch{}}};
function alertMsg(msg){$('alert').textContent=msg;$('alert').hidden=false;setTimeout(()=>{$('alert').hidden=true},6000);}
function send(event,payload={},after){socket.emit(event,payload,res=>{if(!res?.ok){if(res?.message)alertMsg(res.message);return;}after?.(res);});}
function codeFromUrl(){return new URLSearchParams(location.search).get('room')?.trim().toUpperCase()||'';}
$('code').value=codeFromUrl();$('name').value=storage.get('spot:name')||'';
function enter(code,id){me=id;storage.set('spot:room',code);storage.set('spot:id:'+code,id);storage.set('spot:name',$('name').value.trim());history.replaceState(null,'','?room='+code);render();}
function join(code){code=String(code||'').trim().toUpperCase();send('room:join',{code,name:$('name').value,playerId:storage.get('spot:id:'+code)},res=>enter(res.code,res.playerId));}
$('create').onclick=()=>send('room:create',{name:$('name').value},res=>enter(res.code,res.playerId));
$('join').onclick=()=>join($('code').value);
$('code').addEventListener('input',e=>{e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4)});
$('start').onclick=()=>send('game:start');$('again').onclick=()=>send('game:restart');
$('invite').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('invite').textContent='Copied!';setTimeout(()=>$('invite').textContent='Copy invite link',2000);}catch{alertMsg('Copy the URL from your address bar.')}};
document.querySelectorAll('.leave').forEach(b=>b.onclick=()=>{send('room:leave',{},()=>{storage.remove('spot:room');me=null;state=null;word='';results=null;history.replaceState(null,'',location.pathname);render();});});
$('toggleWord').onclick=()=>{wordHidden=!wordHidden;renderWord();};
function renderWord(){$('word').textContent=wordHidden?'••••••':word||'Waiting…';$('toggleWord').textContent=wordHidden?'Show':'Hide';}
$('chatForm').onsubmit=e=>{e.preventDefault();send('chat:send',{text:$('chatText').value},()=>$('chatText').value='');};
$('guessForm').onsubmit=e=>{e.preventDefault();send('guess:submit',{text:$('guessText').value});};
function addPlayer(list,p,suffix='',votable=false){const li=document.createElement('li'),dot=document.createElement('span');dot.className='dot';dot.style.background=p.color;li.append(dot,document.createTextNode(p.name+(p.id===me?' (you)':'')+(p.connected?'':' (offline)')+suffix));if(votable&&p.id!==me&&p.connected){const b=document.createElement('button');b.className='small';b.textContent='Vote';b.onclick=()=>send('vote:cast',{targetId:p.id});li.append(' ',b);}list.append(li);}
function person(id){return state?.players.find(p=>p.id===id)?.name||'Unknown player';}
function render(){
 const phase=state?.phase;
 $('home').hidden=!!state;$('lobby').hidden=phase!=='lobby';$('game').hidden=!phase||phase==='lobby'||phase==='results';$('results').hidden=phase!=='results';
 if(!state)return;
 $('roomCode').textContent=state.code;$('notice').textContent=state.notice||'';
 const connected=state.players.filter(p=>p.connected).length,host=state.hostId===me;
 $('lobbyPlayers').replaceChildren();state.players.forEach(p=>addPlayer($('lobbyPlayers'),p,p.id===state.hostId?' ★ host':''));
 $('start').hidden=!host;$('start').disabled=connected<3;$('startHint').textContent=host?(connected<3?`Need ${3-connected} more player${3-connected===1?'':'s'} to start.`:'Ready to start!'):'Waiting for the host to start. You need at least 3 players.';
 if(phase==='lobby')return;
 const g=state.game;if(!g)return;
 renderWord();$('phase').textContent=({drawing:`Drawing • round ${g.round} of 2`,discussion:'Discussion',voting:'Voting',guessing:'Final guess',results:'Results'})[phase];
 const turn=g.turnId===me,voted=g.voted.includes(me);
 $('status').textContent=({drawing:turn?'Your turn — draw ONE continuous stroke.':`Waiting for ${person(g.turnId)} to draw…`,discussion:'Discuss! Who seems off?',voting:voted?'Vote received. Waiting for the others.':'Vote for the undercover.',guessing:'The undercover has one chance to guess the civilians’ word.'})[phase]||'';
 const mine=state.players.find(p=>p.id===me);canvas.update(g.strokes,phase==='drawing'&&turn&&!submitted,mine?.color);
 $('gamePlayers').replaceChildren();state.players.forEach(p=>addPlayer($('gamePlayers'),p,p.id===g.turnId?' ✎ drawing':'',phase==='voting'&&!voted));
 $('chat').hidden=phase!=='discussion';$('messages').replaceChildren();g.chat.forEach(m=>{const p=document.createElement('p');const strong=document.createElement('strong');strong.textContent=person(m.playerId)+': ';p.append(strong,document.createTextNode(m.text));$('messages').append(p);});$('messages').scrollTop=$('messages').scrollHeight;
 $('guessBox').hidden=phase!=='guessing';$('guessText').disabled=phase!=='guessing';
 if(phase==='results'&&results){$('winner').textContent=results.winner==='undercover'?'Undercover wins!':'Civilians win!';$('reveal').textContent=`Civilians: ${results.wordA} • Undercover: ${results.wordB} • Undercover player: ${person(results.undercoverId)}${results.guess!==null?` • Final guess: ${results.guess||'(no guess)'}`:''}`;$('votes').replaceChildren();state.players.forEach(p=>{const n=results.votes.filter(([,target])=>target===p.id).length;addPlayer($('votes'),p,` — ${n} vote${n===1?'':'s'}`);});$('again').hidden=!host;finalCanvas.update(g.strokes,false);}
}
function tick(){if(state?.game&&['drawing','discussion','voting','guessing'].includes(state.phase))$('timer').textContent=Math.max(0,Math.ceil((state.game.endsAt-Date.now())/1000))+'s';else $('timer').textContent='';}
setInterval(tick,200);
socket.on('connect',()=>{const code=storage.get('spot:room');if(code&&storage.get('spot:id:'+code))send('room:join',{code,name:storage.get('spot:name')||$('name').value,playerId:storage.get('spot:id:'+code)},res=>enter(res.code,res.playerId));});
socket.on('disconnect',()=>alertMsg('Connection lost. Reconnecting…'));
socket.on('room:state',s=>{if(state?.phase!==s.phase||state?.game?.turnId!==s.game?.turnId)submitted=false;if(s.phase==='lobby'&&state?.phase!=='lobby')word='';if(s.phase==='drawing'&&state?.phase==='results'){results=null;wordHidden=false;}$('code').value=s.code;state=s;render();tick();});
socket.on('game:yourWord',v=>{word=v.word;wordHidden=false;renderWord();});
socket.on('game:results',r=>{results=r;render();});
socket.on('stroke:live',stroke=>{if(state?.phase==='drawing')canvas.live(stroke);});
socket.on('error',e=>alertMsg(e.message));
window.addEventListener('board:progress',e=>socket.emit('stroke:progress',{points:e.detail}));
window.addEventListener('board:submit',e=>{submitted=true;send('stroke:submit',{points:e.detail},()=>{});});
render();
