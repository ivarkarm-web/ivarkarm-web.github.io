(function(){
'use strict';
var state={recording:false,playing:false,bpm:80,startedAt:0,events:[],layers:[],timer:null,loopDuration:0,loopStart:0,lastPos:0};
var eventsEl=document.getElementById('loopEvents'),statusEl=document.getElementById('loopStatus'),recordBtn=document.getElementById('loopRecord'),playBtn=document.getElementById('loopPlay'),clearBtn=document.getElementById('loopClear'),tempoEl=document.getElementById('loopTempo');
function now(){return performance.now()/1000}
function setStatus(s){if(statusEl)statusEl.textContent=s}
function scale(){return window.HandpanGame&&window.HandpanGame.scaleIndex?window.HandpanGame.scaleIndex():0}
function note(e){if(!state.recording)return;state.events.push({t:now()-state.startedAt,n:e.noteIndex,v:e.velocity||.8,scale:scale()});render()}
function render(){if(eventsEl)eventsEl.textContent=state.layers.length?state.layers.length+' layer'+(state.layers.length>1?'s':'')+' · '+state.layers.reduce(function(n,l){return n+l.length},0)+' notes':'No loop recorded'}
function trigger(e){try{if(window.HandpanGame&&window.HandpanGame.strike)window.HandpanGame.strike(e.n,e.v)}catch(err){}}
function tick(){
 if(!state.playing)return;
 var elapsed=now()-state.loopStart,dur=state.loopDuration||1,pos=elapsed%dur,wrapped=pos<state.lastPos;
 state.layers.forEach(function(layer){
   layer.forEach(function(e){
     if((!wrapped&&e.t>=state.lastPos&&e.t<pos)||(wrapped&&(e.t>=state.lastPos||e.t<pos)))trigger(e);
   });
 });
 state.lastPos=pos;state.timer=requestAnimationFrame(tick)
}
function stop(){state.playing=false;if(state.timer)cancelAnimationFrame(state.timer);state.timer=null}
function finish(){
 if(!state.recording)return;
 state.recording=false;state.loopDuration=Math.max(.5,now()-state.startedAt);
 if(state.events.length)state.layers.push(state.events.slice());
 state.events=[];setStatus(state.layers.length?'LOOP READY':'EMPTY');
 if(recordBtn)recordBtn.classList.remove('is-on');render()
}
function startRecord(){
 stop();state.events=[];state.recording=true;state.startedAt=now();setStatus(state.layers.length?'OVERDUB':'RECORDING');
 if(recordBtn)recordBtn.classList.add('is-on');render()
}
function play(){
 if(state.recording)finish();
 if(!state.layers.length){setStatus('PLAY SOMETHING FIRST');return}
 state.playing=true;state.loopStart=now();state.lastPos=0;setStatus('LOOPING');tick()
}
function clear(){stop();state.recording=false;state.events=[];state.layers=[];state.loopDuration=0;setStatus('EMPTY');render();if(recordBtn)recordBtn.classList.remove('is-on')}
recordBtn&&recordBtn.addEventListener('click',function(){state.recording?finish():startRecord()});
playBtn&&playBtn.addEventListener('click',function(){state.playing?stop():play()});
clearBtn&&clearBtn.addEventListener('click',clear);
tempoEl&&tempoEl.addEventListener('input',function(){state.bpm=+tempoEl.value});
window.addEventListener('handpan:note',note);
window.HandpanLooper={state:state,record:startRecord,stop:finish,play:play,clear:clear};
render()
})();