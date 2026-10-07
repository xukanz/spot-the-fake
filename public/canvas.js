(function(){
 function board(canvas){
  let strokes=[],preview=null,active=false,points=[],allowed=false,color='#333';
  const ctx=canvas.getContext('2d');
  function paint(s){if(!s?.points?.length)return;const size=canvas.clientWidth;ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=size*.01;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();s.points.forEach(([x,y],i)=>i?ctx.lineTo(x*size,y*size):ctx.moveTo(x*size,y*size));if(s.points.length===1){ctx.arc(s.points[0][0]*size,s.points[0][1]*size,size*.005,0,Math.PI*2);ctx.fill();}else ctx.stroke();}
  function redraw(){const size=canvas.clientWidth,ratio=window.devicePixelRatio||1;canvas.width=Math.round(size*ratio);canvas.height=Math.round(size*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='white';ctx.fillRect(0,0,size,size);strokes.forEach(paint);paint(preview);if(active)paint({points,color});}
  function point(e){const r=canvas.getBoundingClientRect();return [Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))];}
  canvas.addEventListener('pointerdown',e=>{if(!allowed||active)return;active=true;points=[point(e)];canvas.setPointerCapture(e.pointerId);redraw();});
  canvas.addEventListener('pointermove',e=>{if(!active)return;e.preventDefault();if(points.length>=500)return;const p=point(e),last=points[points.length-1];if(Math.hypot(p[0]-last[0],p[1]-last[1])<.002)return;points.push(p);redraw();window.dispatchEvent(new CustomEvent('board:progress',{detail:points.slice()}));});
  function finish(e){if(!active)return;e.preventDefault();active=false;allowed=false;const sent=points.slice();points=[];redraw();window.dispatchEvent(new CustomEvent('board:submit',{detail:sent}));}
  canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
  new ResizeObserver(redraw).observe(canvas);
  return {update(list,canDraw,ownColor){strokes=list||[];allowed=canDraw;color=ownColor||'#333';preview=null;if(!canDraw){active=false;points=[];}redraw();},live(stroke){preview=stroke;redraw();},redraw};
 }
 window.DrawingBoard=board;
})();
