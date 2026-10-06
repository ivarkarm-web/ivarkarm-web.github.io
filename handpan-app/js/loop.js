(function(){
'use strict';

var transport=window.HandpanTransport;
var state={recording:false,playing:false,quantize:true,events:[],layers:[],timer:null,recordTimer:null,recordStart:0,lastPos:0};
var eventsEl=document.getElementById('loopEvents'),statusEl=document.getElementById('loopStatus'),recordBtn=document.getElementById('loopRecord'),playBtn=document.getElementById('loopPlay'),clearBtn=document.getElementById('loopClear'),tempoEl=document.getElementById('loopTempo'),bpmEl=document.getElementById('loopBpm'),barsEl=document.getElementById('loopBars'),gridEl=document.getElementById('loopGrid'),timelineEl=document.getElementById('loopTimeline'),playheadEl=document.getElementById('loopPlayhead');

function now(){return performance.now()/1000}
function setStatus(s){if(statusEl)statusEl.textContent=s}
function scale(){return window.HandpanGame&&window.HandpanGame.scaleIndex?window.HandpanGame.scaleIndex():0}
function totalNotes(){return state.layers.reduce(function(n,l){return n+l.length},0)}
function render(){
 if(eventsEl)eventsEl.textContent=state.layers.length?state.layers.length+' layer'+(state.layers.length>1?'s':'')+' · '+totalNotes()+' notes · '+transport.state.bars+' bar'+(transport.state.bars>1?'s':''):'No loop recorded';
 renderTimeline()
}
function renderTimeline(){
 if(!timelineEl)return;
 timelineEl.innerHTML='';
 var steps=transport.state.bars*transport.state.grid;
 for(var i=0;i<steps;i++){
   var cell=document.createElement('span');cell.className='loop-cell'+(i%transport.state.grid===0?' bar':'')+(i%4===0?' beat':'');timelineEl.appendChild(cell)
 }
 state.layers.forEach(function(layer,li){
   layer.forEach(function(e){
     var dot=document.createElement('i');dot.className='loop-note';dot.dataset.layer=li;
     dot.style.left=(Math.max(0,Math.min(1,e.t/transport.duration()))*100)+'%';
     dot.title='Note '+(e.n+1);
     timelineEl.appendChild(dot)
   })
 })
}
function trigger(e){try{if(window.HandpanGame&&window.HandpanGame.strike)window.HandpanGame.strike(e.n,e.v)}catch(err){}}
function playbackTick(payload){
 if(!state.playing)return;
 if(playheadEl)playheadEl.style.left=(payload.seconds/transport.duration()*100)+'%';
 state.layers.forEach(function(layer){
   layer.forEach(function(e){
     var last=state.lastPos||0,pos=payload.seconds,dur=transport.duration(),wrapped=pos<last;
     if((!wrapped&&e.t>=last&&e.t<pos)||(wrapped&&(e.t>=last||e.t<pos)))trigger(e);
   })
 });
 state.lastPos=payload.seconds
}
function finish(){
 if(!state.recording)return;
 state.recording=false;if(state.recordTimer){clearTimeout(state.recordTimer);state.recordTimer=null}
 if(state.events.length)state.layers.push(state.events.slice());
 state.events=[];
 setStatus(state.layers.length?'LOOP READY':'EMPTY');
 if(recordBtn)recordBtn.classList.remove('is-on');
 render()
}
function startRecord(){
 stop();state.events=[];state.lastPos=0;state.recording=true;state.recordStart=now();
 state.recordTimer=setTimeout(function(){if(state.recording)finish()},transport.duration()*1000);
 setStatus(state.layers.length?'OVERDUB':'RECORDING');
 if(recordBtn)recordBtn.classList.add('is-on');
 render();
}
function note(e){
 if(!state.recording)return;
 var raw=now()-state.recordStart;
 var t=state.quantize?transport.quantize(raw):raw;
 if(t>=transport.duration())t=transport.duration()-0.001;
 state.events.push({t:t,n:e.noteIndex,v:e.velocity||.8,scale:scale()});
 render();
}
function play(){
 if(state.recording)finish();
 if(!state.layers.length){setStatus('PLAY SOMETHING FIRST');return}
 state.playing=true;state.lastPos=0;setStatus('LOOPING');
 transport.start(0)
}
function stop(){
 state.playing=false;transport.stop();
 if(playheadEl)playheadEl.style.left='0%';
 if(playBtn)playBtn.classList.remove('is-on');
 if(!state.recording)setStatus(state.layers.length?'LOOP READY':'EMPTY')
}
function clear(){
 stop();state.recording=false;state.events=[];state.layers=[];setStatus('EMPTY');
 if(recordBtn)recordBtn.classList.remove('is-on');render()
}
recordBtn&&recordBtn.addEventListener('click',function(){state.recording?finish():startRecord()});
playBtn&&playBtn.addEventListener('click',function(){state.playing?stop():play()});
clearBtn&&clearBtn.addEventListener('click',clear);
tempoEl&&tempoEl.addEventListener('input',function(){transport.setBpm(tempoEl.value);if(bpmEl)bpmEl.value=transport.state.bpm;render()});
barsEl&&barsEl.addEventListener('change',function(){transport.setBars(barsEl.value);clear();render()});
gridEl&&gridEl.addEventListener('change',function(){state.quantize=gridEl.value!=='off';transport.state.grid=gridEl.value==='8'?8:16;render()});
window.addEventListener('handpan:note',note);
transport.onTick(playbackTick);
window.HandpanLooper={state:state,record:startRecord,stop:finish,play:play,clear:clear};
render()
})();