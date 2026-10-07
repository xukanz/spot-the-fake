const { randomInt, randomUUID } = require('node:crypto');
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const colors = ['#d64a46','#2276c7','#309b70','#b46b16','#8b5cba','#cc6295','#467f82','#6865c8'];
const rooms = new Map();
function code() { let value; do { value = Array.from({length:4},()=>alphabet[randomInt(alphabet.length)]).join(''); } while(rooms.has(value)); return value; }
function nameFor(raw, room, exclude) {
 const base = String(raw ?? '').trim().replace(/[\x00-\x1f\x7f]/g,'').slice(0,16);
 if (!base) throw Error('Enter a name (1–16 characters).');
 let name=base, n=2;
 while([...room.players.values()].some(p=>p.id!==exclude && p.name.toLowerCase()===name.toLowerCase())) name=`${base.slice(0,12)} ${n++}`;
 return name;
}
function create(socket, rawName) {
 const room={code:code(),hostId:null,players:new Map(),phase:'lobby',game:null,lastActivity:Date.now(),notice:'',timer:null};
 rooms.set(room.code,room);
 try { const p=join(room,socket,rawName); room.hostId=p.id; return {room,player:p}; }
 catch(e) {rooms.delete(room.code);throw e;}
}
function join(room,socket,rawName,playerId) {
 let p=playerId && room.players.get(playerId);
 if(p) {
  // The private, random seat token allows a refreshed browser to replace its old socket.
  p.connected=true;p.socketId=socket.id;
 } else {
  if(room.phase!=='lobby') throw Error('Game in progress. Join the next round.');
  if(room.players.size>=8) throw Error('Room is full (8 players).');
  p={id:randomUUID(),name:nameFor(rawName,room),color:colors[room.players.size],connected:true,socketId:socket.id};
  room.players.set(p.id,p);
 }
 socket.data.roomCode=room.code;socket.data.playerId=p.id;socket.join(room.code);room.lastActivity=Date.now();return p;
}
function disconnect(room,p) {
 p.connected=false;p.socketId=null;room.lastActivity=Date.now();
 if(room.hostId===p.id) room.hostId=[...room.players.values()].find(x=>x.connected)?.id || p.id;
 if(room.phase==='lobby') room.players.delete(p.id);
}
function cleanup() {for(const [key,room] of rooms) if(![...room.players.values()].some(p=>p.connected)&&Date.now()-room.lastActivity>600000){clearTimeout(room.timer);rooms.delete(key);}}
module.exports={rooms,create,join,disconnect,cleanup};
