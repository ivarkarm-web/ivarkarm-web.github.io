export default `function initScalePicker() {
    var trigger = document.getElementById('hpScaleMenuToggle');
    var sheet = document.getElementById('hpScaleSheet');
    var closeBtn = document.getElementById('hpScaleSheetClose');
    var backdrop = document.getElementById('hpScaleSheetBackdrop');
    var list = document.getElementById('hpScaleList');

    function closePicker(){
      if(!sheet) return;
      sheet.hidden = true;
      if(trigger) trigger.setAttribute('aria-expanded','false');
    }
    function openPicker(){
      if(!sheet) return;
      sheet.hidden = false;
      if(trigger) trigger.setAttribute('aria-expanded','true');
      var active = sheet.querySelector('.hp-scale-option.is-active');
      if(active && active.scrollIntoView) active.scrollIntoView({block:'nearest'});
    }
    function refreshList(){
      if(!list) return;
      list.innerHTML = '';
      SCALES.forEach(function(scale,i){
        var b=document.createElement('button');
        b.type='button';
        b.className='hp-scale-option'+(i===scaleIndex?' is-active':'');
        b.setAttribute('aria-pressed',String(i===scaleIndex));
        var title=document.createElement('strong');
        title.textContent=scale.label;
        var meta=document.createElement('small');
        meta.textContent='Root '+currentRootName()+' · 9 notes';
        b.appendChild(title); b.appendChild(meta);
        b.addEventListener('click',function(){
          applyScale(i, i===scaleIndex ? 0 : (i>scaleIndex ? 1 : -1));
          refreshList();
          closePicker();
        });
        list.appendChild(b);
      });
    }
    if(trigger) trigger.addEventListener('click',function(e){
      e.preventDefault(); e.stopPropagation();
      if(sheet && !sheet.hidden) closePicker(); else openPicker();
    });
    if(closeBtn) closeBtn.addEventListener('click',closePicker);
    if(backdrop) backdrop.addEventListener('click',closePicker);
    document.addEventListener('keydown',function(e){
      if(e.key==='Escape') closePicker();
    });
    refreshList();
    applyScale(0,0);
  })();

  var last = performance.now();
  var smoothLevel = 0;
  var introFired = [false, false, false];

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    var time = now / 1000;
    introT += dt;
    var intro = clamp((introT - 0.15) / (REDUCED ? 0.2 : 1.7), 0, 1);
    var cues = [0.45, 0.85, 1.25];
    for (var k = 0; k < cues.length; k++) {
      if (!introFired[k] && introT > cues[k]) {
        introFired[k] = true;
        if (!REDUCED || k === 0) addRipple(layout.cx, layout.cy, 0.55 + k * 0.12);
      }
    }
    var lvl = engine.level();
    smoothLevel += (lvl - smoothLevel) * Math.min(1, dt * 6);
    for (var i = 0; i < fields.length; i++) {
      fields[i].glow *= Math.pow(0.16, dt);
      if (fields[i].glow < 0.004) fields[i].glow = 0;
      var guideRate = fields[i].guideTarget > fields[i].guide ? 1.15 : 3.2;
      fields[i].guide += (fields[i].guideTarget - fields[i].guide) * Math.min(1, dt * guideRate);
      if (Math.abs(fields[i].guide - fields[i].guideTarget) < 0.002) fields[i].guide = fields[i].guideTarget;
    }
    updateAtmosphere(dt, time);
    ctx2.clearRect(0, 0, W, H);
    drawAtmosphere(time, smoothLevel, Math.max(0.0, intro));
    drawPan(time, smoothLevel, intro);
  }

  var leaving = false;
  function goBack(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (leaving) return;
    leaving = true;
   `;
