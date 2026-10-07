const {randomInt}=require('node:crypto');
const pairs=require('./words');
const DURATION={drawing:20000,discussion:60000,voting:30000,guessing:20000};
function shuffle(a){for(let i=a.length-1;i>0;i--){let j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
function start(room){
 const players=[...room.players.values()].filter(p=>p.connected);
 if(players.length<3)throw Error('Need at least 3 connected players.');
 const pair=pairs[randomInt(pairs.length)], flip=randomInt(2);
 room.game={wordA:pair[flip],wordB:pair[1-flip],undercoverId:players[randomInt(players.length)].id,turnOrder:shuffle(players.map(p=>p.id)),round:1,turnIndex:0,turnEndsAt:0,endsAt:0,strokes:[],chat:[],votes:new Map(),guess:null,winner:null};
 room.phase='drawing';room.notice='';
}
function current(room){return room.game?.turnOrder[room.game.turnIndex];}
function validatePoints(points){return Array.isArray(points)&&points.length>=1&&points.length<=500&&points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1));}
function resolveVote(room){
 const g=room.game, counts=new Map();for(const target of g.votes.values())counts.set(target,(counts.get(target)||0)+1);
 const high=Math.max(0,...counts.values());const leaders=[...counts].filter(([,n])=>n===high).map(([id])=>id);
 if(high>0&&leaders.length===1&&leaders[0]===g.undercoverId){
  const u=room.players.get(g.undercoverId);
  if(u?.connected){room.phase='guessing';return;}
  g.winner='civilians';
 }else g.winner='undercover';
 room.phase='results';
}
function guess(room,text){const g=room.game;g.guess=String(text??'').trim().slice(0,80);g.winner=g.guess.toLocaleLowerCase()===g.wordA.toLocaleLowerCase()?'undercover':'civilians';room.phase='results';}
function nextTurn(room){
 const g=room.game;
 for(let n=0;n<g.turnOrder.length*2;n++){
  g.turnIndex++;
  if(g.turnIndex>=g.turnOrder.length){g.turnIndex=0;g.round++;}
  if(g.round>2){room.phase='discussion';return;}
  if(room.players.get(current(room))?.connected)return;
 }
 room.phase='discussion';
}
function publicState(room){const g=room.game;return {code:room.code,hostId:room.hostId,phase:room.phase,notice:room.notice,players:[...room.players.values()].map(({id,name,color,connected})=>({id,name,color,connected})),game:g&&{round:g.round,turnId:room.phase==='drawing'?current(room):null,turnOrder:g.turnOrder,guesserId:room.phase==='guessing'?g.undercoverId:null,endsAt:g.endsAt,strokes:g.strokes,chat:g.chat,voted:[...g.votes.keys()],votes:room.phase==='results'?[...g.votes]:undefined}};}
function results(room){const g=room.game;return {wordA:g.wordA,wordB:g.wordB,undercoverId:g.undercoverId,winner:g.winner,guess:g.guess,votes:[...g.votes]};}
module.exports={DURATION,start,current,validatePoints,resolveVote,guess,nextTurn,publicState,results};
