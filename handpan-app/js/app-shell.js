(function(){
'use strict';
var modes={play:{label:'PLAY MODE',copy:'Play freely.'},learn:{label:'LEARN MODE',copy:'Guided lessons and note sequences will build on the same instrument.'},loop:{label:'LOOP MODE',copy:'Record, loop and layer ideas.'},ambient:{label:'AMBIENT MODE',copy:'Create evolving scale-safe landscapes.'}};
var buttons=document.querySelectorAll('.app-mode'),panel=document.getElementById('appPanel');
function setMode(mode){
 if(!modes[mode])return;
 buttons.forEach(function(b){b.classList.toggle('is-active',b.dataset.mode===mode);});
 panel.querySelector('.app-panel-kicker').textContent=modes[mode].label;
 panel.querySelector('.app-panel-copy').textContent=modes[mode].copy;
 panel.style.opacity=mode==='play'?'0':'1';
 document.body.dataset.appMode=mode;
 document.body.classList.toggle('loop-mode',mode==='loop');
}
buttons.forEach(function(b){b.addEventListener('click',function(){setMode(b.dataset.mode);});});
window.HandpanApp={version:'0.2.0',modes:modes,setMode:setMode,instrument:window.HandpanGame||null};
setMode('play');
})();