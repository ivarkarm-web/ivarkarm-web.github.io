(function(){
'use strict';
var state={mode:'empty',events:[],layers:[],recordStart:0,loopStart:0,loopDuration:0,lastPos:0,raf:null,maxLayers:7};
var mainBtn=document.getElementById('loopRecord');

function now(){return performance.now()/1000}
function stopRAF(){if(state.raf){cancelAnimationFrame(state.raf);state.raf=null}}
function updateButton(){
 if(!mainBtn)return;
 mainBtn.classList.toggle('is-recording',state.mode==='recording'||state.mode==='overdub');
 mainBtn.classList.toggle('is-disabled',state.layers.length>=state.maxLayers&&state.mode==='playing');
 mainBtn.querySelector('.loop-record-label').textContent=state.mode==='recording'||state.mode==='overdub'?'RECORDING':state.layers.length>=state.maxLayers?'7 LAYERS':'LOOP';
}
function trigger(e){try{if(window.HandpanGame&&window.HandpanGame.strike)window.HandpanGame.strike(e.n,e.v)}catch(err){}}
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
 state.mode='playing';state.loopStart=now();state.lastPos=0;
 updateButton();stopRAF();state.raf=requestAnimationFrame(playbackFrame);
}
function startRecording(){
 stopRAF();state.mode=state.layers.length?'overdub':'recording';state.events=[];state.recordStart=now();updateButton();
}
function finishRecording(){
 var duration=now()-state.recordStart;
 if(duration<0.35)return;
 var events=state.events.map(function(e){return {t:Math.min(e.t,duration-0.001),n:e.n,v:e.v,scale:e.scale}});
 if(state.mode==='recording'){
   if(events.length)state.layers=[events];
   state.loopDuration=Math.max(.5,duration);
 }else{
   if(events.length&&state.layers.length<state.maxLayers)state.layers.push(events.map(function(e){return {t:((e.t%state.loopDuration)+state.loopDuration)%state.loopDuration,n:e.n,v:e.v,scale:e.scale}}));
 }
 startPlayback();
}
function note(e){
 if(state.mode!=='recording'&&state.mode!=='overdub')return;
 var raw=now()-state.recordStart;
 var t=state.mode==='overdub'?raw%state.loopDuration:raw;
 state.events.push({t:t,n:e.noteIndex,v:e.velocity||.8,scale:window.HandpanGame&&window.HandpanGame.scaleIndex?window.HandpanGame.scaleIndex():0});
}
function mainAction(){
 if(state.mode==='empty')startRecording();
 else if(state.mode==='recording'||state.mode==='overdub')finishRecording();
 else if(state.mode==='playing'&&state.layers.length<state.maxLayers)startRecording();
}
mainBtn&&mainBtn.addEventListener('click',mainAction);
window.addEventListener('handpan:note',note);
window.HandpanLooper={state:state,record:startRecording,stop:function(){stopRAF();state.mode='empty';state.events=[];state.layers=[];state.loopDuration=0;updateButton()},play:startPlayback,clear:function(){stopRAF();state.mode='empty';state.events=[];state.layers=[];state.loopDuration=0;updateButton()}};
updateButton();
})();