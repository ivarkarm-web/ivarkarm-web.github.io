(function(){
'use strict';
var MAX_LAYERS=7;
var state={mode:'empty',layers:[],current:[],recordStart:0,loopStart:0,loopDuration:0,lastPos:0,raf:null,paused:false};
var button=document.getElementById('loopRecord'),label=document.getElementById('loopOrbLabel'),countEl=document.getElementById('loopLayerCount');
var playBtn=document.getElementById('loopPlay'),pauseBtn=document.getElementById('loopPause'),clearBtn=document.getElementById('loopClear'),orbit=document.getElementById('loopOrbit');
function now(){return performance.now()/1000}
function stopClock(){if(state.raf){cancelAnimationFrame(state.raf);state.raf=null}}
function paintOrbit(){
 if(!orbit)return;
 orbit.innerHTML='';
 state.layers.forEach(function(layer,i){
  var node=document.createElement('button'); node.type='button'; node.className='loop-orbit-node'+(state.paused?' is-paused':'')+(state.mode==='playing'&&!state.paused?' is-playing':'');
  node.style.setProperty('--orbit-i',i);
  node.setAttribute('aria-label',(state.paused?'Play':'Pause')+' loop layer '+(i+1));
  node.innerHTML='<span></span><b>'+(i+1)+'</b>';
  node.addEventListener('click',function(){ if(state.paused) play(); else pause(); });
  orbit.appendChild(node);
 });
}
function paint(){
 if(!button)return;
 var rec=state.mode==='recording'||state.mode==='overdub';
 button.classList.toggle('is-recording',rec);button.classList.toggle('is-playing',state.mode==='playing'&&!state.paused);
 if(countEl)countEl.textContent=state.layers.length+'/'+MAX_LAYERS;
 if(label)label.textContent=rec?'RECORDING':state.layers.length?'LOOP READY':'RECORD';
 button.setAttribute('aria-label',rec?'Finish recording layer':state.layers.length?'Record another layer':'Record a loop');
 if(playBtn)playBtn.textContent=state.paused?'Play':'Play';
 paintOrbit();
}
function playEvent(e){if(window.HandpanGame&&window.HandpanGame.strike)try{window.HandpanGame.strike(e.n,e.v)}catch(x){}}
function tick(){
 if(!state.loopDuration||state.paused)return;
 var pos=((now()-state.loopStart)%state.loopDuration+state.loopDuration)%state.loopDuration,last=state.lastPos,wrapped=pos<last;
 state.layers.forEach(function(layer){layer.forEach(function(e){var hit=(!wrapped&&e.t>=last&&e.t<pos)||(wrapped&&(e.t>=last||e.t<pos));if(hit)playEvent(e)})});
 state.lastPos=pos;state.raf=requestAnimationFrame(tick);
}
function startClock(reset){stopClock();if(reset)state.loopStart=now();state.lastPos=0;state.paused=false;state.raf=requestAnimationFrame(tick);paint()}
function beginRecord(){stopClock();state.mode='recording';state.current=[];state.recordStart=now();state.paused=false;paint()}
function beginOverdub(){if(state.layers.length>=MAX_LAYERS)return;state.mode='overdub';state.current=[];state.recordStart=now();state.paused=false;paint()}
function commit(){
 var duration=now()-state.recordStart;if(duration<.25)return;
 if(state.mode==='recording'){state.loopDuration=Math.max(.5,duration);state.layers=[state.current.map(function(e){return{t:Math.min(e.t,state.loopDuration-.001),n:e.n,v:e.v}})]}
 else if(state.mode==='overdub'&&state.layers.length<MAX_LAYERS){state.layers.push(state.current.map(function(e){return{t:((e.t%state.loopDuration)+state.loopDuration)%state.loopDuration,n:e.n,v:e.v}}))}
 state.mode='playing';startClock(true);paint();
}
function clickOrb(){if(state.mode==='empty'){beginRecord();return}if(state.mode==='recording'||state.mode==='overdub'){commit();return}if(state.mode==='playing'){beginOverdub()}}
function play(){if(!state.layers.length)return;state.mode='playing';state.paused=false;startClock(true)}
function pause(){if(!state.layers.length)return;state.paused=true;stopClock();paint()}
function clear(){stopClock();state.mode='empty';state.layers=[];state.current=[];state.recordStart=0;state.loopStart=0;state.loopDuration=0;state.lastPos=0;state.paused=false;paint()}
function noteHandler(ev){if(state.mode!=='recording'&&state.mode!=='overdub')return;var t=now()-state.recordStart;if(state.mode==='overdub')t=t%state.loopDuration;state.current.push({t:t,n:ev.detail.noteIndex,v:ev.detail.velocity||.8})}
button&&button.addEventListener('click',clickOrb);playBtn&&playBtn.addEventListener('click',play);pauseBtn&&pauseBtn.addEventListener('click',pause);clearBtn&&clearBtn.addEventListener('click',clear);
window.addEventListener('handpan:note',noteHandler);
window.HandpanLooper={state:state,record:function(){state.mode==='empty'?beginRecord():beginOverdub()},play:play,pause:pause,stop:clear,clear:clear};
paint();
})();