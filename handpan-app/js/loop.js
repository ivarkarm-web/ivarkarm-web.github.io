(function(){
'use strict';
var state={mode:'empty',events:[],layers:[],recordStart:0,loopStart:0,loopDuration:0,lastPos:0,raf:null};
var statusEl=document.getElementById('loopStatus'),mainBtn=document.getElementById('loopRecord'),clearBtn=document.getElementById('loopClear'),eventsEl=document.getElementById('loopEvents');

function now(){return performance.now()/1000}
function totalNotes(){return state.layers.reduce(function(n,l){return n+l.length},0)}
function setStatus(s){if(statusEl)statusEl.textContent=s}
function render(){
 if(!eventsEl)return;
 if(state.mode==='recording') eventsEl.textContent='Play freely · press LOOP to close the loop';
 else if(state.mode==='playing') eventsEl.textContent=state.layers.length+' layer'+(state.layers.length>1?'s':'')+' · '+totalNotes()+' notes · press LOOP to overdub';
 else if(state.mode==='overdub') eventsEl.textContent='Overdub ready · press LOOP to add your layer';
 else eventsEl.textContent=state.layers.length?'Loop saved · '+totalNotes()+' notes':'Press LOOP to record';
}
function trigger(e){try{if(window.HandpanGame&&window.HandpanGame.strike)window.HandpanGame.strike(e.n,e.v)}catch(err){}}
function stopRAF(){if(state.raf){cancelAnimationFrame(state.raf);state.raf=null}}
function playbackFrame(){
 if(state.mode!=='playing'&&state.mode!=='overdub')return;
 var t=now()-state.loopStart;
 var pos=((t%state.loopDuration)+state.loopDuration)%state.loopDuration;
 var last=state.lastPos;
 var wrapped=pos<last;
 state.layers.forEach(function(layer){
   layer.forEach(function(e){
     if((!wrapped&&e.t>=last&&e.t<pos)||(wrapped&&(e.t>=last||e.t<pos)))trigger(e);
   });
 });
 state.lastPos=pos;
 state.raf=requestAnimationFrame(playbackFrame);
}
function startPlayback(){
 state.mode='playing';state.loopStart=now();state.lastPos=0;setStatus('LOOPING');
 if(mainBtn){mainBtn.classList.add('is-on');mainBtn.textContent='OVERDUB';}
 render();stopRAF();state.raf=requestAnimationFrame(playbackFrame);
}
function startRecording(){
 stopRAF();state.mode='recording';state.events=[];state.recordStart=now();setStatus('RECORDING');
 if(mainBtn){mainBtn.classList.add('is-on');mainBtn.textContent='STOP & LOOP';}
 render();
}
function finishRecording(){
 var duration=now()-state.recordStart;
 if(duration<0.35)return;
 var events=state.events.map(function(e){return {t:Math.min(e.t,duration-0.001),n:e.n,v:e.v,scale:e.scale}});
 if(events.length)state.layers=[events];
 state.loopDuration=Math.max(.5,duration);
 state.mode='playing';state.loopStart=now();state.lastPos=0;setStatus('LOOPING');
 if(mainBtn){mainBtn.classList.add('is-on');mainBtn.textContent='OVERDUB';}
 render();stopRAF();state.raf=requestAnimationFrame(playbackFrame);
}
function startOverdub(){
 state.mode='overdub';state.events=[];state.recordStart=now();setStatus('OVERDUB');
 if(mainBtn){mainBtn.classList.add('is-on');mainBtn.textContent='ADD LAYER';}
 render();
}
function finishOverdub(){
 var events=state.events.map(function(e){return {t:((e.t%state.loopDuration)+state.loopDuration)%state.loopDuration,n:e.n,v:e.v,scale:e.scale}});
 if(events.length)state.layers.push(events);
 state.mode='playing';state.loopStart=now();state.lastPos=0;setStatus('LOOPING');
 if(mainBtn){mainBtn.classList.add('is-on');mainBtn.textContent='OVERDUB';}
 render();stopRAF();state.raf=requestAnimationFrame(playbackFrame);
}
function note(e){
 if(state.mode!=='recording'&&state.mode!=='overdub')return;
 var raw=now()-state.recordStart;
 var t=state.mode==='overdub'?raw%state.loopDuration:raw;
 state.events.push({t:t,n:e.noteIndex,v:e.velocity||.8,scale:window.HandpanGame&&window.HandpanGame.scaleIndex?window.HandpanGame.scaleIndex():0});
}
function mainAction(){
 if(state.mode==='empty')startRecording();
 else if(state.mode==='recording')finishRecording();
 else if(state.mode==='playing')startOverdub();
 else if(state.mode==='overdub')finishOverdub();
}
function clear(){
 stopRAF();state.mode='empty';state.events=[];state.layers=[];state.loopDuration=0;setStatus('READY');
 if(mainBtn){mainBtn.classList.remove('is-on');mainBtn.textContent='LOOP'}
 render();
}
mainBtn&&mainBtn.addEventListener('click',mainAction);
clearBtn&&clearBtn.addEventListener('click',clear);
window.addEventListener('handpan:note',note);
window.HandpanLooper={state:state,record:startRecording,stop:clear,play:startPlayback,clear:clear};
render();
})();