(function(){
'use strict';

var MAX_LAYERS=7;
var state={
  mode:'empty',
  layers:[],
  current:[],
  recordStart:0,
  loopStart:0,
  loopDuration:0,
  lastPos:0,
  raf:null
};
var button=document.getElementById('loopRecord');
var label=button&&button.querySelector('.loop-record-label');
var countEl=document.getElementById('loopLayerCount');

function now(){return performance.now()/1000}
function stopClock(){if(state.raf){cancelAnimationFrame(state.raf);state.raf=null}}

function paint(){
  if(!button)return;
  var recording=state.mode==='recording'||state.mode==='overdub';
  button.classList.toggle('is-recording',recording);
  button.classList.toggle('is-disabled',state.mode==='playing'&&state.layers.length>=MAX_LAYERS);
  if(label)label.textContent=recording?'REC':state.layers.length>=MAX_LAYERS?'FULL':'LOOP';
 if(countEl)countEl.textContent=state.layers.length+' / '+MAX_LAYERS;
  button.setAttribute('aria-label',recording?'Stop recording layer':'Record or overdub loop');
}

function playEvent(e){
  if(window.HandpanGame&&window.HandpanGame.strike){
    try{window.HandpanGame.strike(e.n,e.v)}catch(err){}
  }
}

function tick(){
  if(!state.loopDuration)return;
  var pos=((now()-state.loopStart)%state.loopDuration+state.loopDuration)%state.loopDuration;
  var last=state.lastPos;
  var wrapped=pos<last;

  state.layers.forEach(function(layer){
    layer.forEach(function(e){
      var hit=(!wrapped&&e.t>=last&&e.t<pos)||(wrapped&&(e.t>=last||e.t<pos));
      if(hit)playEvent(e);
    });
  });

  state.lastPos=pos;
  state.raf=requestAnimationFrame(tick);
}

function startClock(reset){
  stopClock();
  if(reset)state.loopStart=now();
  state.lastPos=0;
  state.raf=requestAnimationFrame(tick);
}

function beginFirstRecording(){
  stopClock();
  state.mode='recording';
  state.current=[];
  state.recordStart=now();
  paint();
}

function beginOverdub(){
  if(state.layers.length>=MAX_LAYERS)return;
  state.mode='overdub';
  state.current=[];
  state.recordStart=now();
  // Keep the existing loop playing while the new layer is recorded.
  paint();
}

function commitRecording(){
  var duration=now()-state.recordStart;
  if(duration<0.25)return;

  if(state.mode==='recording'){
    state.loopDuration=Math.max(0.5,duration);
    state.layers=[state.current.map(function(e){
      return {t:Math.min(e.t,state.loopDuration-0.001),n:e.n,v:e.v}
    })];
  }else if(state.mode==='overdub'){
    if(state.layers.length>=MAX_LAYERS)return;
    state.layers.push(state.current.map(function(e){
      return {
        t:((e.t%state.loopDuration)+state.loopDuration)%state.loopDuration,
        n:e.n,v:e.v
      };
    }));
  }

  state.mode='playing';
  startClock(true);
  paint();
}

function noteHandler(ev){
  if(state.mode!=='recording'&&state.mode!=='overdub')return;
  var t=now()-state.recordStart;
  if(state.mode==='overdub')t=t%state.loopDuration;
  state.current.push({
    t:t,
    n:ev.detail.noteIndex,
    v:ev.detail.velocity||0.8
  });
}

function click(){
  if(state.mode==='empty'){
    beginFirstRecording();
    return;
  }
  if(state.mode==='recording'||state.mode==='overdub'){
    commitRecording();
    return;
  }
  if(state.mode==='playing'){
    beginOverdub();
  }
}

function clear(){
  stopClock();
  state.mode='empty';
  state.layers=[];
  state.current=[];
  state.loopDuration=0;
  state.lastPos=0;
  paint();
}

button&&button.addEventListener('click',click);
window.addEventListener('handpan:note',noteHandler);

window.HandpanLooper={
  state:state,
  record:function(){if(state.mode==='empty')beginFirstRecording();else if(state.mode==='playing')beginOverdub()},
  stop:clear,
  play:function(){if(state.layers.length){state.mode='playing';startClock(true);paint()}},
  clear:clear
};

paint();
})();