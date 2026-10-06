(function(){
'use strict';
var select=document.getElementById('natureSelect'),vol=document.getElementById('natureVolume'),grid=document.getElementById('instrumentGrid'),dock=document.getElementById('soundDock'),toggle=document.getElementById('soundDockToggle');
var ctx=null,master=null,nodes=[],timers=[],ambience='off',gainValue=.24;
function ensure(){
 if(ctx)return true;
 var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
 ctx=new AC();master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
 return true;
}
function clear(){timers.forEach(clearTimeout);timers=[];nodes.forEach(function(n){try{n.stop&&n.stop()}catch(e){}try{n.disconnect()}catch(e){}});nodes=[];}
function noise(kind){
 var b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),d=b.getChannelData(0),last=0;
 for(var i=0;i<d.length;i++){var w=Math.random()*2-1;if(kind==='brown')last=(last+.035*w)/1.035,d[i]=last*3;else if(kind==='soft')d[i]=w*.35;else d[i]=w;}
 var s=ctx.createBufferSource();s.buffer=b;s.loop=true;return s;
}
function baseNoise(kind,cut,q,g){
 var s=noise(kind),f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=cut;f.Q.value=q||.2;
 var gain=ctx.createGain();gain.gain.value=g;s.connect(f);f.connect(gain);gain.connect(master);s.start();nodes.push(s);nodes.push(f);nodes.push(gain);
}
function tone(freq,type,g,dur){
 var o=ctx.createOscillator(),g1=ctx.createGain();o.type=type||'sine';o.frequency.value=freq;g1.gain.setValueAtTime(.0001,ctx.currentTime);g1.gain.exponentialRampToValueAtTime(g,ctx.currentTime+.025);g1.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+dur);o.connect(g1);g1.connect(master);o.start();o.stop(ctx.currentTime+dur+.05);
}
function bird(){
 var f=900+Math.random()*1800,delay=1200+Math.random()*4200;
 tone(f,'sine',.025,.12);setTimeout(function(){if(ambience==='birds'||ambience==='jungle'||ambience==='forest')tone(f*1.32,'sine',.018,.18)},80);
 timers.push(setTimeout(function(){if(ambience!=='off')bird()},delay));
}
function start(mode){
 clear();ambience=mode;if(mode==='off'){fade(0);return}ensure();if(ctx.state==='suspended')ctx.resume();
 var target=gainValue;fade(target);
 if(mode==='birds'){baseNoise('soft',1800,.2,.012);bird();}
 if(mode==='stream'){baseNoise('brown',2400,.5,.055);baseNoise('soft',5200,.2,.018);}
 if(mode==='rain'){baseNoise('soft',7200,.1,.035);baseNoise('soft',1500,.2,.012);}
 if(mode==='storm'){baseNoise('brown',1100,.5,.045);baseNoise('soft',3600,.15,.018);thunder();}
 if(mode==='jungle'){baseNoise('soft',3000,.25,.022);baseNoise('brown',900,.3,.018);bird();}
 if(mode==='forest'){baseNoise('soft',2200,.2,.016);baseNoise('brown',1300,.3,.015);bird();}
}
function thunder(){var delay=7000+Math.random()*18000;timers.push(setTimeout(function(){if(ambience!=='storm')return;var o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.setValueAtTime(70,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(32,ctx.currentTime+2.2);g.gain.setValueAtTime(.0001,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.08,ctx.currentTime+.25);g.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+2.5);o.connect(g);g.connect(master);o.start();o.stop(ctx.currentTime+2.6);thunder()},delay));}
function fade(v){if(!master)return;var t=ctx.currentTime;master.gain.cancelScheduledValues(t);master.gain.setTargetAtTime(Math.max(0,Math.min(.7,v)),t,.45)}
var instruments=(window.HandpanGame&&window.HandpanGame.instruments)||[];
function buildGrid(){
 if(!grid)return;
 grid.innerHTML='';
 instruments.forEach(function(item,i){var b=document.createElement('button');b.className='instrument-btn'+(i===0?' is-active':'');b.type='button';b.textContent=item.name;b.addEventListener('click',function(){if(window.HandpanGame)window.HandpanGame.setInstrument(i);grid.querySelectorAll('.instrument-btn').forEach(function(x){x.classList.remove('is-active')});b.classList.add('is-active')});grid.appendChild(b)});
}
if(select)select.addEventListener('change',function(){start(this.value)});
if(toggle&&dock){toggle.addEventListener('click',function(){var open=!dock.classList.contains('is-hidden');dock.classList.toggle('is-hidden',open);toggle.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(!open));toggle.setAttribute('aria-label',open?'Open sound controls':'Close sound controls')});}
if(vol)vol.addEventListener('input',function(){gainValue=parseFloat(this.value)||0;if(ambience!=='off')fade(gainValue)});
buildGrid();
if(dock&&toggle){dock.classList.add('is-hidden');}
window.HandpanAtmosphere={set:start,volume:function(v){gainValue=v;fade(v)}};
})();