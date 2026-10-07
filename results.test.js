const test=require('node:test');const assert=require('node:assert/strict');
const {describe}=require('./public/results');
const room={players:[{id:'a',name:'Alex'},{id:'m',name:'Maya'},{id:'s',name:'Sam'}]};
const base={undercoverId:'m',wordA:'Umbrella',wordB:'Mushroom'};
test('civilian wins when undercover is caught and misses the guess',()=>{
 const result={...base,winner:'civilians',guess:'Raincoat',votes:[['a','m'],['s','m'],['m','a']]};
 assert.equal(describe(room,result,'a').won,true);
 assert.equal(describe(room,result,'m').won,false);
 assert.equal(describe(room,result,'a').caught,true);
 assert.match(describe(room,result,'a').detail,/Raincoat/);
});
test('undercover wins with correct final guess even after being caught',()=>{
 const result={...base,winner:'undercover',guess:'Umbrella',votes:[['a','m'],['s','m'],['m','a']]};
 assert.equal(describe(room,result,'m').won,true);
 assert.equal(describe(room,result,'a').won,false);
 assert.equal(describe(room,result,'m').caught,true);
 assert.match(describe(room,result,'a').summary,/guessed your word/);
});
test('tied vote makes civilians lose and undercover win',()=>{
 const result={...base,winner:'undercover',guess:null,votes:[['a','m'],['m','s'],['s','a']]};
 assert.equal(describe(room,result,'a').won,false);
 assert.equal(describe(room,result,'m').won,true);
 assert.match(describe(room,result,'a').summary,/tied vote/);
});
test('incorrect accusation makes civilians lose',()=>{
 const result={...base,winner:'undercover',guess:null,votes:[['a','s'],['m','s'],['s','m']]};
 assert.equal(describe(room,result,'s').won,false);
 assert.equal(describe(room,result,'m').won,true);
 assert.match(describe(room,result,'s').summary,/wrong player/);
});
