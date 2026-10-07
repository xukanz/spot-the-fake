// Pure result formatting so both sides of a game see the correct personal outcome.
(function(root){
  function describe(room, result, playerId){
    const undercover=playerId===result.undercoverId;
    const won=(result.winner==='undercover')===undercover;
    const counts=new Map();
    for(const [,target] of result.votes)counts.set(target,(counts.get(target)||0)+1);
    const top=Math.max(0,...counts.values());
    const leaders=[...counts].filter(([,count])=>count===top).map(([id])=>id);
    const caught=top>0&&leaders.length===1&&leaders[0]===result.undercoverId;
    const tied=top===0||leaders.length>1;
    const name=room.players.find(p=>p.id===result.undercoverId)?.name||'The undercover';
    let summary,detail;
    if(caught&&result.winner==='undercover'){
      summary=undercover?'You guessed the civilians’ word and stole the win.':'The undercover guessed your word after being caught.';
      detail=`${name} guessed “${result.guess}” and won the final chance.`;
    }else if(caught){
      summary=undercover?'You were caught, and your final guess missed.':'Your team found the undercover, and their final guess missed.';
      detail=`${name} guessed “${result.guess||'(no guess)'}” instead of “${result.wordA}.”`;
    }else if(tied){
      summary=undercover?'The vote ended in a tie. You escaped.':'A tied vote let the undercover escape.';
      detail='The undercover wins when the top vote is tied.';
    }else{
      summary=undercover?'The group voted for another player. You escaped.':'The group voted for the wrong player.';
      detail='The most-voted player was not the undercover.';
    }
    return {won,undercover,caught,name,summary,detail,counts};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={describe};
  root.GameResults={describe};
})(typeof window!=='undefined'?window:globalThis);
