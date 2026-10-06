(function(){
'use strict';

var state={bpm:80,bars:4,beatsPerBar:4,grid:16,running:false,startTime:0,raf:null,listeners:[]};

function now(){return performance.now()/1000}
function beatDuration(){return 60/state.bpm}
function barDuration(){return beatDuration()*state.beatsPerBar}
function duration(){return barDuration()*state.bars}
function position(){
 if(!state.running)return 0;
 return (now()-state.startTime)%duration();
}
function beatPosition(){
 return position()/beatDuration();
}
function quantize(seconds){
 var step=beatDuration()/(state.grid===8?2:4);
 return Math.round(seconds/step)*step;
}
function start(offset){
 state.running=true;
 state.startTime=now()-(offset||0);
 tick();
}
function stop(){state.running=false;if(state.raf)cancelAnimationFrame(state.raf);state.raf=null}
function seek(seconds){state.startTime=now()-(seconds%duration())}
function onTick(fn){if(typeof fn==='function')state.listeners.push(fn);return function(){state.listeners=state.listeners.filter(function(x){return x!==fn})}}
function tick(){
 if(!state.running)return;
 var p=position(),beat=beatPosition(),payload={seconds:p,beat:beat,bar:Math.floor(beat/state.beatsPerBar),beatInBar:beat%state.beatsPerBar,bpm:state.bpm,bars:state.bars,duration:duration()};
 state.listeners.forEach(function(fn){try{fn(payload)}catch(err){}});
 state.raf=requestAnimationFrame(tick)
}
function setBpm(v){state.bpm=Math.max(40,Math.min(180,+v||80))}
function setBars(v){state.bars=Math.max(1,Math.min(8,+v||4))}

window.HandpanTransport={
 state:state,start:start,stop:stop,seek:seek,position:position,beatPosition:beatPosition,
 beatDuration:beatDuration,barDuration:barDuration,duration:duration,quantize:quantize,
 onTick:onTick,setBpm:setBpm,setBars:setBars
};
})();