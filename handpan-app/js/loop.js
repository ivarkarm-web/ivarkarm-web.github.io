(function(){
  'use strict';

  var state={recording:false,playing:false,bpm:80,startedAt:0,events:[],loops:[],timer:null,loopDuration:0,loopStart:0,overdub:false};
  var eventsEl=document.getElementById('loopEvents');
  var statusEl=document.getElementById('loopStatus');
  var recordBtn=document.getElementById('loopRecord');
  var playBtn=document.getElementById('loopPlay');
  var clearBtn=document.getElementById('loopClear');
  var tempoEl=document.getElementById('loopTempo');

  function now(){return performance.now()/1000;}
  function setStatus(s){if(statusEl)statusEl.textContent=s;}
  function activeScale(){return window.HandpanGame&&window.HandpanGame.scaleIndex?window.HandpanGame.scaleIndex():0;}
  function recordNote(e){
    if(!state.recording||!window.HandpanGame)return;
    var t=now()-state.startedAt;
    state.events.push({t:t,n:e.noteIndex,v:e.velocity||.8,scale:activeScale()});
    render();
  }
  function render(){
    if(!eventsEl)return;
    eventsEl.textContent=state.events.length?state.events.length+' notes captured · '+(state.loops.length?'loop ready':'recording'): 'No loop recorded';
  }
  function playEvents(){
    if(!state.playing||!state.events.length)return;
    var elapsed=now()-state.loopStart;
    var dur=state.loopDuration||Math.max(1,elapsed);
    var pos=elapsed%dur;
    for(var i=0;i<state.events.length;i++){
      var e=state.events[i], prev=pos-(1/60);
      if(e.t>=prev&&e.t<pos){
        try{window.HandpanGame.strike(e.n,e.v);}catch(err){}
      }
    }
    state.timer=requestAnimationFrame(playEvents);
  }
  function stopPlayback(){
    state.playing=false;
    if(state.timer)cancelAnimationFrame(state.timer);
    state.timer=null;
  }
  function finishRecord(){
    if(!state.recording)return;
    state.recording=false;
    state.loopDuration=Math.max(.5,now()-state.startedAt);
    state.loops=[state.events.slice()];
    setStatus('LOOP READY');
    if(recordBtn)recordBtn.classList.remove('is-on');
    render();
  }
  function startRecord(){
    stopPlayback();
    state.events=[];
    state.recording=true;
    state.startedAt=now();
    state.loopDuration=0;
    setStatus('RECORDING');
    if(recordBtn)recordBtn.classList.add('is-on');
    render();
  }
  function startPlayback(){
    if(!state.events.length){setStatus('PLAY SOMETHING FIRST');return;}
    finishRecord();
    state.playing=true;
    state.loopStart=now();
    setStatus('LOOPING');
    playEvents();
  }
  function clear(){
    stopPlayback();state.recording=false;state.events=[];state.loops=[];state.loopDuration=0;
    setStatus('EMPTY');render();
    if(recordBtn)recordBtn.classList.remove('is-on');
  }
  recordBtn&&recordBtn.addEventListener('click',function(){state.recording?finishRecord():startRecord();});
  playBtn&&playBtn.addEventListener('click',function(){state.playing?stopPlayback():startPlayback();});
  clearBtn&&clearBtn.addEventListener('click',clear);
  tempoEl&&tempoEl.addEventListener('input',function(){state.bpm=+tempoEl.value;});
  window.addEventListener('handpan:note',recordNote);
  window.HandpanLooper={state:state,record:startRecord,stop:finishRecord,play:startPlayback,clear:clear};
  render();
})();