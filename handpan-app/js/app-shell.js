(function(){
'use strict';
var modes={
 play:{label:'PLAY MODE',copy:'Play freely.'},
 learn:{label:'LEARN MODE',copy:'Guided lessons.'},
 loop:{label:'LOOP MODE',copy:'Record, loop and layer ideas.'},
 ambient:{label:'AMBIENT MODE',copy:'Create evolving scale-safe landscapes.'}
};
var buttons=document.querySelectorAll('.app-mode'),panel=document.getElementById('appPanel');
var dock=document.getElementById('soundDock'),dockToggle=document.getElementById('soundDockToggle');

function setDock(open){
 if(!dock||!dockToggle)return;
 var allowed=document.body.dataset.appMode==='loop';
 dock.classList.toggle('is-hidden',!open||!allowed);
 dockToggle.classList.toggle('is-open',open&&allowed);
 dockToggle.setAttribute('aria-expanded',String(open&&allowed));
}

if(dockToggle){
 dockToggle.addEventListener('click',function(){
  if(document.body.dataset.appMode!=='loop')return;
  var open=!dock.classList.contains('is-hidden');
  setDock(!open);
 });
}

function setMode(mode){
 if(!modes[mode])return;
 buttons.forEach(function(b){b.classList.toggle('is-active',b.dataset.mode===mode);});
 if(panel){
  panel.querySelector('.app-panel-kicker').textContent=modes[mode].label;
  panel.querySelector('.app-panel-copy').textContent=modes[mode].copy;
 }
 document.body.dataset.appMode=mode;
 document.body.classList.toggle('loop-mode',mode==='loop');
 if(mode!=='learn')document.body.classList.remove('learn-active');
 setDock(mode==='loop');
 if(mode==='learn'&&window.HandpanLearn)window.HandpanLearn.open();
}

buttons.forEach(function(b){
 b.addEventListener('click',function(){setMode(b.dataset.mode);});
});

window.HandpanApp={
 version:'0.3.1',
 modes:modes,
 setMode:setMode,
 instrument:window.HandpanGame||null
};
setMode('play');
})();