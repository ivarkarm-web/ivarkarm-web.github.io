(function(){
  'use strict';
  var modes = {
    play: {label:'PLAY MODE', copy:'Play the instrument freely. This is the stable nucleus everything else will build on.'},
    learn: {label:'LEARN MODE', copy:'Tutorials will guide you through notes, rhythms, songs and improvisation.'},
    loop: {label:'LOOP MODE', copy:'Record, loop and overdub layers without leaving the instrument.'},
    ambient: {label:'AMBIENT MODE', copy:'Build evolving ambient landscapes while staying inside the chosen scale.'}
  };
  var buttons = document.querySelectorAll('.app-mode');
  var panel = document.getElementById('appPanel');
  function setMode(mode){
    if(!modes[mode]) return;
    buttons.forEach(function(b){ b.classList.toggle('is-active', b.getAttribute('data-mode')===mode); });
    panel.querySelector('.app-panel-kicker').textContent=modes[mode].label;
    panel.querySelector('.app-panel-copy').textContent=modes[mode].copy;
    panel.style.opacity = mode==='play' ? '0' : '1';
    document.body.setAttribute('data-app-mode',mode);
  }
  buttons.forEach(function(b){ b.addEventListener('click',function(){ setMode(b.getAttribute('data-mode')); }); });
  window.HandpanApp = {
    version:'0.1.0',
    modes:modes,
    setMode:setMode,
    instrument:window.HandpanGame || null
  };
  setMode('play');
})();