(function(){
 const reduce=()=>window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 function board(canvas){
  let strokes=[],preview=null,active=false,points=[],allowed=false,pending=null,color='#1E1B4B',halo=null,limit=null,partial=null;
  const ctx=canvas.getContext('2d');
  function path(pts,size){ctx.beginPath();pts.forEach(([x,y],i)=>i?ctx.lineTo(x*size,y*size):ctx.moveTo(x*size,y*size));}
  function paint(s,upTo){
   if(!s?.points?.length)return;const size=canvas.clientWidth,pts=upTo?s.points.slice(0,upTo):s.points;if(!pts.length)return;
   ctx.lineCap='round';ctx.lineJoin='round';
   if(halo&&s.playerId===halo){ctx.strokeStyle='rgba(255,210,63,.85)';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=size*.035;path(pts,size);
    if(pts.length===1){ctx.arc(pts[0][0]*size,pts[0][1]*size,size*.018,0,Math.PI*2);ctx.fill();}else ctx.stroke();}
   ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=Math.max(2.5,size*.012);path(pts,size);
   if(pts.length===1){ctx.arc(pts[0][0]*size,pts[0][1]*size,size*.006,0,Math.PI*2);ctx.fill();}else ctx.stroke();
  }
  function pen(s){if(!s?.points?.length)return;const size=canvas.clientWidth,[x,y]=s.points[s.points.length-1];
   ctx.beginPath();ctx.arc(x*size,y*size,Math.max(5,size*.014),0,Math.PI*2);ctx.fillStyle=s.color;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle='#1E1B4B';ctx.stroke();}
  function redraw(){
   const size=canvas.clientWidth;if(!size)return;const ratio=window.devicePixelRatio||1;
   canvas.width=Math.round(size*ratio);canvas.height=Math.round(size*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,size,size);
   const list=limit==null?strokes:strokes.slice(0,limit);list.forEach(s=>paint(s));
   if(partial)paint(partial.s,partial.n);
   if(preview){paint(preview);pen(preview);}
   if(pending)paint({points:pending,color});
   if(active)paint({points,color});
  }
  function point(e){const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];}
  canvas.addEventListener('pointerdown',e=>{if(!allowed||active||pending)return;active=true;points=[point(e)];canvas.setPointerCapture(e.pointerId);redraw();});
  canvas.addEventListener('pointermove',e=>{if(!active)return;e.preventDefault();if(points.length>=500)return;const p=point(e),last=points[points.length-1];if(Math.hypot(p[0]-last[0],p[1]-last[1])<.002)return;points.push(p);redraw();window.dispatchEvent(new CustomEvent('board:progress',{detail:points.slice()}));});
  // A finished stroke stays pending until the player confirms it or undoes it.
  function finish(e){if(!active)return;e.preventDefault();active=false;pending=points.slice();points=[];canvas.classList.remove('can-draw');redraw();window.dispatchEvent(new CustomEvent('board:pending',{detail:pending}));}
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
  new ResizeObserver(redraw).observe(canvas);
  let replayId=0;
  return {
   update(list,canDraw,ownColor,opts={}){strokes=list||[];allowed=canDraw;color=ownColor||'#1E1B4B';halo=opts.halo||null;preview=null;limit=null;partial=null;replayId++;
    if(!canDraw){active=false;points=[];pending=null;}canvas.classList.toggle('can-draw',!!canDraw&&!pending);redraw();},
   hasPending(){return !!pending;},
   undo(){if(!pending)return false;pending=null;canvas.classList.toggle('can-draw',allowed);redraw();return true;},
   confirm(){if(!pending)return null;const sent=pending;pending=null;allowed=false;strokes=strokes.concat([{points:sent,color}]);canvas.classList.remove('can-draw');redraw();return sent;},
   live(stroke){preview=stroke;redraw();},
   redraw,
   async replay(onStroke){
    const id=++replayId,all=strokes;limit=0;partial=null;redraw();
    for(let i=0;i<all.length;i++){
     if(id!==replayId)return;onStroke?.(all[i],i);const s=all[i],n=s.points.length;
     if(reduce()){limit=i+1;redraw();await new Promise(r=>setTimeout(r,150));continue;}
     const dur=Math.min(900,250+n*6),t0=performance.now();
     await new Promise(done=>{const step=t=>{if(id!==replayId)return done();const k=Math.min(1,(t-t0)/dur);partial={s,n:Math.max(1,Math.ceil(n*k))};redraw();if(k<1)requestAnimationFrame(step);else done();};requestAnimationFrame(step);});
     partial=null;limit=i+1;redraw();await new Promise(r=>setTimeout(r,220));
    }
    if(id===replayId){limit=null;redraw();onStroke?.(null,-1);}
   }
  };
 }
 window.DrawingBoard=board;
})();
