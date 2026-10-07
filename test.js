const test=require('node:test');const assert=require('node:assert/strict');
const G=require('./src/game');
function room(){const players=new Map(Array.from({length:3},(_,i)=>{const id='p'+i;return [id,{id,name:id,color:'#000',connected:true}]}));return {players,phase:'lobby',game:null,notice:'',hostId:'p0',code:'TEST'};}
function voteCase(votes,expectedPhase,expectedWinner){const r=room();G.start(r);const u=r.game.undercoverId;const innocent=[...r.players.keys()].filter(x=>x!==u);r.phase='voting';r.game.votes=new Map(votes(u,innocent));G.resolveVote(r);assert.equal(r.phase,expectedPhase);if(expectedWinner)assert.equal(r.game.winner,expectedWinner);return r;}
test('validates normalized stroke coordinates and length',()=>{assert.ok(G.validatePoints([[0,1],[.5,.5]]));assert.equal(G.validatePoints([[1.1,0]]),false);assert.equal(G.validatePoints(Array(501).fill([0,0])),false);assert.equal(G.validatePoints([[NaN,0]]),false);});
test('one word per player in public snapshot, secret stays private',()=>{const r=room();G.start(r);const s=JSON.stringify(G.publicState(r));assert.equal(s.includes(r.game.wordA),false);assert.equal(s.includes(r.game.wordB),false);assert.equal(Object.hasOwn(G.publicState(r).game,'undercoverId'),false);});
test('caught undercover with wrong guess loses',()=>{const r=voteCase((u,c)=>[[c[0],u],[c[1],u],[u,c[0]]],'guessing');G.guess(r,'definitely wrong');assert.equal(r.game.winner,'civilians');});
test('caught undercover with correct trimmed mixed-case guess wins',()=>{const r=voteCase((u,c)=>[[c[0],u],[c[1],u],[u,c[0]]],'guessing');G.guess(r,' '+r.game.wordA.toUpperCase()+' ');assert.equal(r.game.winner,'undercover');});
test('incorrect accusation gives undercover win',()=>{voteCase((u,c)=>[[u,c[0]],[c[1],c[0]],[c[0],u]],'results','undercover');});
test('tie and abstention give undercover win',()=>{voteCase((u,c)=>[[u,c[0]],[c[0],u]],'results','undercover');voteCase(()=>[],'results','undercover');});
test('two drawing rounds then discussion',()=>{const r=room();G.start(r);for(let i=0;i<6;i++)G.nextTurn(r);assert.equal(r.phase,'discussion');assert.equal(r.game.round,3);});
