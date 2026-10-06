import { getAudioContext, createBus, resumeAudio } from './audio-core.js';

(function(){
'use strict';

var backingSelect=document.getElementById('backingSelect');
var backingVolume=document.getElementById('backingVolume');
var natureSelect=document.getElementById('natureSelect');
var natureVolume=document.getElementById('natureVolume');
var grid=document.getElementById('instrumentGrid');

var ctx=null, backingBus=null, natureBus=null, backingGain=.22, natureGain=.24;
var backingMode='off', natureMode='off', natureNodes=[], natureTimers=[], musicTimer=null, musicStep=0;

function ensure(){
  if(ctx) return true;
  ctx=getAudioContext();
  if(!ctx) return false;
  backingBus=createBus('backing',0);
  natureBus=createBus('nature',0);
  return !!backingBus&&!!natureBus;
}
function resume(){
  resumeAudio();
}
function ramp(gain,value,time){
  if(!gain||!ctx)return;
  var t=ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setTargetAtTime(Math.max(0,Math.min(.7,value)),t,time||.18);
}
function clearNature(){
  natureTimers.forEach(clearTimeout); natureTimers=[];
  natureNodes.forEach(function(n){try{n.stop&&n.stop()}catch(e){}try{n.disconnect&&n.disconnect()}catch(e){}});
  natureNodes=[];
}
function makeNoise(kind,seconds){
  var len=Math.max(1,Math.floor(ctx.sampleRate*seconds));
  var b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0),last=0;
  for(var i=0;i<len;i++){
    var w=Math.random()*2-1;
    if(kind==='brown'){last=(last+.035*w)/1.035;d[i]=last*3.1;}
    else if(kind==='pink'){last=.985*last+.015*w;d[i]=last*3.2;}
    else d[i]=w;
  }
  var s=ctx.createBufferSource();s.buffer=b;s.loop=true;return s;
}
function noiseLayer(bus,kind,cut,q,level){
  var s=makeNoise(kind,2),f=ctx.createBiquadFilter(),g=ctx.createGain();
  f.type='lowpass';f.frequency.value=cut;f.Q.value=q||.2;g.gain.value=level;
  s.connect(f);f.connect(g);g.connect(bus);s.start();
  natureNodes.push(s,f,g);
}
function tone(bus,freq,level,dur,type,when){
  if(!ctx)return;
  var t=when==null?ctx.currentTime:when;
  var o=ctx.createOscillator(),g=ctx.createGain();
  o.type=type||'sine';o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(.0001,t);
  g.gain.exponentialRampToValueAtTime(Math.max(.0002,level),t+.035);
  g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  o.connect(g);g.connect(bus);o.start(t);o.stop(t+dur+.05);
}
function currentFreqs(){
  var notes=(window.HandpanGame&&window.HandpanGame.notes)||[];
  return notes.map(function(n){return n.freq;}).filter(Boolean);
}
function stopMusic(){
  if(musicTimer){clearInterval(musicTimer);musicTimer=null;}
  musicStep=0;
}
function musicTick(){
  if(backingMode==='off'||!ctx)return;
  var f=currentFreqs(); if(!f.length)return;
  var root=f[0], now=ctx.currentTime;
  if(backingMode==='drone'){
    if(musicStep%8===0){
      tone(backingBus,root*.5,.055,3.6,'sine',now);
      tone(backingBus,root,.028,3.2,'triangle',now);
    }
  }else if(backingMode==='pulse'){
    var seq=[0,2,4,2,5,4,2,1];
    tone(backingBus,f[seq[musicStep%seq.length]%f.length],.055,.62,'sine',now);
  }else if(backingMode==='arp'){
    var seq=[0,2,4,7,4,2,1,3];
    tone(backingBus,f[seq[musicStep%seq.length]%f.length],.045,.48,'triangle',now);
  }else if(backingMode==='pad'){
    if(musicStep%16===0){
      tone(backingBus,root*.5,.045,6,'sine',now);
      tone(backingBus,f[3%f.length],.025,5.6,'sine',now);
      tone(backingBus,f[5%f.length],.02,5.3,'triangle',now);
    }
  }
  musicStep++;
}
function startBacking(mode){
  backingMode=mode; stopMusic();
  if(mode==='off'){if(backingBus)ramp(backingBus,0,.25);return;}
  if(!ensure())return;resume();
  ramp(backingBus,backingGain,.35);
  musicTick();
  musicTimer=setInterval(musicTick, mode==='arp'?420:mode==='pulse'?620:900);
}
function chirp(){
  if(natureMode!=='birds'&&natureMode!=='forest'&&natureMode!=='jungle')return;
  var f=900+Math.random()*1700;
  tone(natureBus,f,.018,.11,'sine');
  var delay=1400+Math.random()*4200;
  natureTimers.push(setTimeout(chirp,delay));
}
function thunder(){
  if(natureMode!=='storm'||!ctx)return;
  var now=ctx.currentTime,o=ctx.createOscillator(),g=ctx.createGain();
  o.type='sine';o.frequency.setValueAtTime(70,now);o.frequency.exponentialRampToValueAtTime(28,now+2.5);
  g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.07,now+.25);g.gain.exponentialRampToValueAtTime(.0001,now+2.7);
  o.connect(g);g.connect(natureBus);o.start(now);o.stop(now+2.8);
  natureTimers.push(setTimeout(thunder,8000+Math.random()*16000));
}
function startNature(mode){
  natureMode=mode;clearNature();
  if(mode==='off'){if(natureBus)ramp(natureBus,0,.25);return;}
  if(!ensure())return;resume();
  ramp(natureBus,natureGain,.4);
  if(mode==='rain'){
    noiseLayer(natureBus,'pink',6800,.12,.026);
    noiseLayer(natureBus,'pink',1800,.25,.010);
  }else if(mode==='stream'){
    noiseLayer(natureBus,'brown',2600,.5,.045);
    noiseLayer(natureBus,'pink',5200,.18,.014);
  }else if(mode==='forest'){
    noiseLayer(natureBus,'pink',2400,.2,.012);chirp();
  }else if(mode==='birds'){
    chirp();
  }else if(mode==='storm'){
    noiseLayer(natureBus,'brown',1200,.5,.038);
    noiseLayer(natureBus,'pink',3600,.16,.014);thunder();
  }else if(mode==='jungle'){
    noiseLayer(natureBus,'pink',3000,.24,.018);
    noiseLayer(natureBus,'brown',900,.3,.014);chirp();
  }
}
function buildGrid(){
  if(!grid)return;
  var instruments=(window.HandpanGame&&window.HandpanGame.instruments)||[];
  grid.innerHTML='';
  instruments.forEach(function(item,i){
    var b=document.createElement('button');
    b.className='instrument-btn'+(i===0?' is-active':'');b.type='button';b.textContent=item.name;
    b.addEventListener('click',function(){
      if(window.HandpanGame)window.HandpanGame.setInstrument(i);
      grid.querySelectorAll('.instrument-btn').forEach(function(x){x.classList.remove('is-active')});
      b.classList.add('is-active');
    });
    grid.appendChild(b);
  });
}
if(backingSelect)backingSelect.addEventListener('change',function(){startBacking(this.value);});
if(backingVolume)backingVolume.addEventListener('input',function(){backingGain=parseFloat(this.value)||0;if(backingMode!=='off')ramp(backingBus,backingGain,.12);});
if(natureSelect)natureSelect.addEventListener('change',function(){startNature(this.value);});
if(natureVolume)natureVolume.addEventListener('input',function(){natureGain=parseFloat(this.value)||0;if(natureMode!=='off')ramp(natureBus,natureGain,.12);});

buildGrid();
window.HandpanAtmosphere={
  set:startNature,
  volume:function(v){natureGain=Math.max(0,Math.min(.7,v));if(natureMode!=='off')ramp(natureBus,natureGain,.12);},
  backing:startBacking,
  backingVolume:function(v){backingGain=Math.max(0,Math.min(.7,v));if(backingMode!=='off')ramp(backingBus,backingGain,.12);}
};
})();