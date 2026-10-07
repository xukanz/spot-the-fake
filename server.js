const express=require('express');
const http=require('node:http');
const {Server}=require('socket.io');
const R=require('./src/rooms');const G=require('./src/game');
const app=express();app.use(express.static('public',{cacheControl:false,setHeaders:res=>res.set('Cache-Control','no-cache')}));
// Changes on every deploy so open tabs know to reload the new page.
const BUILD=String(Date.now());
const server=http.createServer(app);const io=new Server(server,{maxHttpBufferSize:100000});
function emit(room){room.lastActivity=Date.now();io.to(room.code).emit('room:state',G.publicState(room));if(room.phase==='results')io.to(room.code).emit('game:results',G.results(room));}
function phaseTimer(room){
 clearTimeout(room.timer);
 const phase=room.phase;
 if(!G.DURATION[phase]){if(phase==='results')emit(room);return;}
 room.game.endsAt=Date.now()+G.DURATION[phase];
 room.timer=setTimeout(()=>{if(room.phase!==phase)return;
  if(phase==='drawing'){G.nextTurn(room);phaseTimer(room);}
  else if(phase==='discussion'){room.phase='voting';phaseTimer(room);}
  else if(phase==='voting'){G.resolveVote(room);phaseTimer(room);}
  else {G.guess(room,'');phaseTimer(room);}
  emit(room);
 },G.DURATION[phase]);
}
function advance(room){G.nextTurn(room);phaseTimer(room);emit(room);}
function seat(socket){const room=R.rooms.get(socket.data.roomCode),p=room?.players.get(socket.data.playerId);if(!room||!p||p.socketId!==socket.id)throw Error('Join a room first.');return {room,p};}
function sendWord(socket,room,p){if(room.game&&room.phase!=='results')socket.emit('game:yourWord',{word:p.id===room.game.undercoverId?room.game.wordB:room.game.wordA});}
function leave(socket){let room=R.rooms.get(socket.data.roomCode);let p=room?.players.get(socket.data.playerId);if(!p||p.socketId!==socket.id)return;
 socket.leave(room.code);socket.data.roomCode=null;socket.data.playerId=null;R.disconnect(room,p);
 if(room.phase!=='lobby'&&room.phase!=='results'){
  if([...room.players.values()].filter(x=>x.connected).length<3){
   clearTimeout(room.dropTimer);
   room.dropTimer=setTimeout(()=>{
    if(room.phase!=='lobby'&&room.phase!=='results'&&[...room.players.values()].filter(x=>x.connected).length<3){clearTimeout(room.timer);room.phase='lobby';room.game=null;room.notice='Fewer than 3 players remain. Return to the lobby to start again.';for(const [id,x] of room.players)if(!x.connected)room.players.delete(id);emit(room);}
   },10000);
  }
  else if(room.phase==='drawing'&&G.current(room)===p.id)advance(room);
  else if(room.phase==='guessing'&&room.game.undercoverId===p.id){G.guess(room,'');phaseTimer(room);}
 }
 emit(room);
}
function handler(socket,event,fn){socket.on(event,(payload={},ack)=>{try{const result=fn(payload);if(typeof ack==='function')ack({ok:true,...result});}catch(e){socket.emit('error',{message:e.message});if(typeof ack==='function')ack({ok:false,message:e.message});}});}
io.on('connection',socket=>{
 socket.emit('app:version',BUILD);
 handler(socket,'room:create',({name})=>{leave(socket);const {room,player}=R.create(socket,name);emit(room);return {code:room.code,playerId:player.id};});
 handler(socket,'room:join',({code,name,playerId})=>{const room=R.rooms.get(String(code||'').trim().toUpperCase());if(!room)throw Error('Room not found. Check the four-letter code.');
  if(socket.data.roomCode===room.code&&socket.data.playerId!==playerId)throw Error('Leave your current seat before joining again.');
  if(socket.data.roomCode&&socket.data.roomCode!==room.code)leave(socket);
  const old=room.players.get(playerId)?.socketId;
  const p=R.join(room,socket,name,playerId);if(old&&old!==socket.id)io.sockets.sockets.get(old)?.disconnect(true);
  if([...room.players.values()].filter(x=>x.connected).length>=3)clearTimeout(room.dropTimer);
  sendWord(socket,room,p);socket.emit('room:state',G.publicState(room));if(room.phase==='results')socket.emit('game:results',G.results(room));emit(room);return {code:room.code,playerId:p.id};});
 handler(socket,'room:leave',()=>{leave(socket);return {};});
 handler(socket,'game:start',()=>{const {room,p}=seat(socket);if(room.hostId!==p.id||room.phase!=='lobby')throw Error('Only the host can start from the lobby.');G.start(room);for(const x of room.players.values())if(x.connected)sendWord(io.sockets.sockets.get(x.socketId),room,x);phaseTimer(room);emit(room);return {};});
 handler(socket,'stroke:submit',({points})=>{const {room,p}=seat(socket);if(room.phase!=='drawing'||G.current(room)!==p.id||Date.now()>room.game.endsAt)throw Error('It is not your drawing turn.');if(!G.validatePoints(points))throw Error('Invalid stroke.');room.game.strokes.push({playerId:p.id,color:p.color,points});advance(room);return {};});
 let lastProgress=0;
 handler(socket,'stroke:progress',({points})=>{const {room,p}=seat(socket);if(room.phase!=='drawing'||G.current(room)!==p.id||Date.now()>room.game.endsAt||!G.validatePoints(points))return {};
  if(Date.now()-lastProgress<50)return {};lastProgress=Date.now();socket.to(room.code).emit('stroke:live',{playerId:p.id,color:p.color,points});return {};});
 handler(socket,'stroke:undo',()=>{const {room,p}=seat(socket);if(room.phase==='drawing'&&G.current(room)===p.id)socket.to(room.code).emit('stroke:live',null);return {};});
 handler(socket,'chat:send',({text})=>{const {room,p}=seat(socket);if(room.phase!=='discussion')throw Error('Chat is open during discussion.');text=String(text??'').trim().slice(0,100);if(!text)throw Error('Enter a message.');room.game.chat.push({playerId:p.id,text,ts:Date.now()});emit(room);return {};});
 handler(socket,'vote:cast',({targetId})=>{const {room,p}=seat(socket);if(room.phase!=='voting')throw Error('Voting is closed.');if(targetId===p.id||!room.players.get(targetId)?.connected)throw Error('Vote for another connected player.');if(room.game.votes.has(p.id))throw Error('You have already voted.');room.game.votes.set(p.id,targetId);
  if(room.game.votes.size===[...room.players.values()].filter(x=>x.connected).length){clearTimeout(room.timer);G.resolveVote(room);phaseTimer(room);}emit(room);return {};});
 handler(socket,'guess:submit',({text})=>{const {room,p}=seat(socket);if(room.phase!=='guessing'||room.game.undercoverId!==p.id)throw Error('Only the undercover can guess now.');G.guess(room,text);phaseTimer(room);emit(room);return {};});
 handler(socket,'game:restart',()=>{const {room,p}=seat(socket);if(p.id!==room.hostId||room.phase!=='results')throw Error('Only the host can start another game.');for(const [id,x] of room.players)if(!x.connected)room.players.delete(id);G.start(room);for(const x of room.players.values())if(x.connected)sendWord(io.sockets.sockets.get(x.socketId),room,x);phaseTimer(room);emit(room);return {};});
 const REACTIONS=['😂','😱','🔥','👏','😭'];let lastReaction=0;
 handler(socket,'reaction:send',({emoji})=>{const {room,p}=seat(socket);if(room.phase!=='results'||!REACTIONS.includes(emoji))return {};if(Date.now()-lastReaction<250)return {};lastReaction=Date.now();io.to(room.code).emit('reaction',{playerId:p.id,emoji});return {};});
 socket.on('disconnect',()=>leave(socket));
});
setInterval(R.cleanup,60000).unref();
if(require.main===module)server.listen(process.env.PORT||3000,()=>console.log('Spot the Fake listening on '+(process.env.PORT||3000)));
module.exports={app,server,io};
