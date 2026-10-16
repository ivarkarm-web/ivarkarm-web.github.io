/* Pionier Learn — shared-clock phrase playback and Catch the Note practice.
   Phrase events are editable scale-degree fixtures, not claimed audio transcriptions. */
const LESSONS = [
  { id:'first-contact', title:'First Contact', description:'Eight spacious strikes. Listen first, then catch the same phrase.', bpm:72, events:[
    {pad:0,at:1900},{pad:2,at:3150},{pad:4,at:4400},{pad:3,at:5650},
    {pad:5,at:6900},{pad:2,at:8150},{pad:1,at:9400},{pad:0,at:10650}
  ]},
  { id:'flow', title:'Flow', description:'A longer phrase with changing gaps and a gentle return home.', bpm:78, events:[
    {pad:0,at:1900},{pad:2,at:2900},{pad:4,at:4150},{pad:6,at:4900},
    {pad:5,at:6150},{pad:3,at:7150},{pad:4,at:8150},{pad:2,at:9400},
    {pad:1,at:10400},{pad:3,at:11400},{pad:5,at:12650},{pad:7,at:13650},
    {pad:6,at:14900},{pad:4,at:15900},{pad:2,at:17150},{pad:0,at:18400}
  ]},
  { id:'transpose', title:'Move the Phrase', description:'The same contour shifted two scale degrees. Learn how a phrase changes without losing its shape.', bpm:72, transpose:2, events:[
    {pad:0,at:1900},{pad:2,at:3150},{pad:4,at:4400},{pad:3,at:5650},
    {pad:5,at:6900},{pad:2,at:8150},{pad:1,at:9400},{pad:0,at:10650}
  ]}
];
const APPROACH_MS=1450, WINDOW_MS=260, TAIL_MS=560;
export function mountLearnMode(){
  const button=document.getElementById('openLearn'), panel=document.getElementById('learnPanel'), close=document.getElementById('learnClose');
  const canvas=document.getElementById('pan'), list=document.getElementById('learnLessonList');
  const controls=document.getElementById('learnRunControls'), progress=document.getElementById('learnProgress');
  const heading=document.getElementById('learnHeading'), description=document.getElementById('learnDescription');
  const listenBtn=document.getElementById('learnListen'), catchBtn=document.getElementById('learnCatch'), transposeBtn=document.getElementById('learnTranspose'), startBtn=document.getElementById('learnStart');
  if(!button||!panel||!canvas||!list||button.dataset.learnEngineMounted==='1')return false;
  button.dataset.learnEngineMounted='1';
  const overlay=document.createElement('canvas'); overlay.id='learnRippleOverlay'; overlay.width=680; overlay.height=680;
  canvas.parentElement?.appendChild(overlay);
  const ctx=overlay.getContext('2d');
  function syncOverlay(){const r=canvas.getBoundingClientRect(),p=canvas.parentElement.getBoundingClientRect();overlay.style.left=(r.left-p.left)+'px';overlay.style.top=(r.top-p.top)+'px';overlay.style.width=r.width+'px';overlay.style.height=r.height+'px';}
  let running=false, lesson=null, lessonIndex=0, mode='practice', startAt=0, index=0, raf=0, hitCount=0, missCount=0;
  let ringState=null, done=false, transposeSteps=0, sounded=new Set(), countdownUntil=0, hud=null, hudLabel=null;
  function show(){panel.hidden=false;document.body.classList.add('learn-active')}
  function ensureHud(){if(hud)return;hud=document.createElement('div');hud.id='learnGameHud';hud.innerHTML='<span id="learnHudLabel">COUNTDOWN</span><button type="button" data-action="restart">Restart</button><button type="button" data-action="menu">Lessons</button><button type="button" data-action="close" aria-label="Close lesson">×</button>';document.body.appendChild(hud);hudLabel=hud.querySelector('#learnHudLabel');hud.addEventListener('click',e=>{const a=e.target?.dataset?.action;if(a==='restart')begin(lessonIndex,mode);if(a==='menu'){hud.hidden=true;show();menu()}if(a==='close')hide()});}
  function setHud(text){ensureHud();hudLabel.textContent=text;hud.dataset.cue=text==='PLAY NOW'?'play':'';hud.hidden=false}
  function hideHud(){if(hud)hud.hidden=true}
  function hide(){panel.hidden=true;stop();hideHud();document.body.classList.remove('learn-active')}
  function stop(){running=false;done=false;ringState=null;sounded.clear();countdownUntil=0;cancelAnimationFrame(raf);ctx.clearRect(0,0,680,680);overlay.style.display='none';hideHud();}
  function menu(){stop();list.hidden=false;controls.hidden=true;heading.textContent='Catch the Note';description.textContent='Choose a lesson, then press Start when you are ready. A 3–2–1 count-in gives you time to prepare.';if(startBtn)startBtn.hidden=false;if(listenBtn)listenBtn.hidden=true;if(catchBtn)catchBtn.hidden=true;if(transposeBtn)transposeBtn.hidden=false;if(document.getElementById('learnRestart'))document.getElementById('learnRestart').hidden=true;}
  function targetPad(ev){const fields=window.PionierCore?.surface?.fields||[];const count=fields.length||9;return ((Number(ev.pad)+transposeSteps)%count+count)%count}
  function targetField(pad){const fields=window.PionierCore?.surface?.fields||[];return fields.find(f=>Number(f.index)===Number(pad))||fields[pad]||null}
  function overlayPoint(field){const m=window.PionierCore?.surface?.metrics||{};const w=m.W||800,h=m.H||800;return{x:field.x*(680/w),y:field.y*(680/h)}}
  function strikePad(pad,velocity=.72){
    const core=window.PionierCore, surface=core?.surface, inst=core?.activeInstrument?.();
    if(!surface||!inst||typeof inst.noteOn!=='function')return false;
    const field=targetField(pad);if(!field)return false;
    try{core.ensureAudio?.();const gesture={pointerId:'learn-track',x:field.x,y:field.y,velocity,pressure:.5,radial:.45,angle:field.angleRad||0,timestamp:performance.now(),phase:'down'};
      inst.noteOn(gesture,{index:pad,...field,radial:.45});window.setTimeout(()=>{try{inst.noteOff?.(pad)}catch(_){}},180);return true;
    }catch(err){console.warn('Learn phrase strike failed',err);return false}
  }
  function markMiss(now){if(!ringState||!['approach','arrive'].includes(ringState.state))return;ringState.state='miss';ringState.changedAt=now;missCount++;progress.textContent='MISS · '+hitCount+' CAUGHT'}
  function finish(){done=true;running=false;ringState=null;const result=(mode==='listen'?'PHRASE COMPLETE':'FINISHED')+' · '+hitCount+' HITS · '+missCount+' MISSES';progress.textContent=result;setHud(result);window.setTimeout(()=>{if(done){hideHud();show();list.hidden=true;controls.hidden=false;heading.textContent=lesson.title;description.textContent=result;}},900);}
  function begin(i,nextMode='practice'){
    if(!LESSONS[i])return;
    stop();lessonIndex=i;lesson=LESSONS[i];mode=nextMode;index=0;hitCount=0;missCount=0;done=false;running=true;countdownUntil=performance.now()+3000;startAt=countdownUntil;ringState=null;sounded.clear();
    transposeSteps=Number(lesson.transpose||0);
    list.hidden=true;controls.hidden=false;heading.textContent=lesson.title;description.textContent=lesson.description;
    if(transposeBtn)transposeBtn.textContent='Transpose: '+(transposeSteps===0?'Original':('+'+transposeSteps+' scale degrees'));
    if(listenBtn)listenBtn.hidden=true;
    if(catchBtn)catchBtn.hidden=true;
    if(startBtn)startBtn.hidden=true;
    if(transposeBtn)transposeBtn.hidden=false;
    if(document.getElementById('learnRestart'))document.getElementById('learnRestart').hidden=false;
    syncOverlay();overlay.style.display='block';panel.hidden=true;ensureHud();setHud('3');progress.textContent='3';drawFrame();
  }
  function drawFrame(){
    if(!running&&!ringState){ctx.clearRect(0,0,680,680);return}
    const now=performance.now(),elapsed=now-startAt;ctx.clearRect(0,0,680,680);
    if(now<countdownUntil){const n=Math.max(1,Math.ceil((countdownUntil-now)/1000));setHud(String(n));progress.textContent=String(n);ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 96px system-ui';ctx.fillStyle='rgba(243,212,122,.92)';ctx.shadowColor='rgba(243,212,122,.75)';ctx.shadowBlur=28;ctx.fillText(String(n),340,340);ctx.restore();raf=requestAnimationFrame(drawFrame);return;}else if(now>=countdownUntil&&countdownUntil){countdownUntil=0;setHud(mode==='listen'?'LISTENING':'CATCH THE NOTE');}
    if(running&&index<lesson.events.length){
      const ev=lesson.events[index],pad=targetPad(ev),spawnAt=ev.at-APPROACH_MS;
      if(elapsed>=spawnAt&&!ringState)ringState={event:ev,pad,spawnAt,state:'approach',changedAt:0};
      if(mode==='practice'&&ringState?.state==='approach'&&elapsed>=ev.at-WINDOW_MS){ringState.state='arrive';ringState.changedAt=now;setHud('PLAY NOW');progress.textContent='PLAY NOW · HIT THE GLOWING NOTE';}
      if(mode==='listen'&&elapsed>=ev.at&&!sounded.has(index)){
        sounded.add(index);strikePad(pad,.66);ringState={event:ev,pad,state:'hit',changedAt:now};index++;
      }else if(mode==='practice'&&['approach','arrive'].includes(ringState?.state)&&elapsed>ev.at+WINDOW_MS){markMiss(now);index++}
    }else if(running&&index>=lesson.events.length&&!ringState)finish();
    if(ringState){
      const field=targetField(ringState.pad),point=field&&overlayPoint(field);
      if(point){
        const{x,y}=point;
        if(ringState.state==='approach'){
          const p=Math.max(0,Math.min(1,(elapsed-ringState.spawnAt)/APPROACH_MS)),radius=138-p*124,pulse=1+Math.sin(now/145)*.022;
          ctx.save();ctx.strokeStyle='#e2bd59';ctx.lineWidth=1.8+p*1.7;ctx.shadowColor='rgba(243,212,122,.78)';ctx.shadowBlur=15+p*17;
          for(let n=0;n<3;n++){ctx.globalAlpha=Math.max(.08,.78-n*.19)*(.48+p*.52);ctx.beginPath();ctx.arc(x,y,(radius+n*18)*pulse,0,Math.PI*2);ctx.stroke()}ctx.restore();
        }else if(ringState.state==='arrive'){
          const pulse=1+Math.sin(now/72)*.08;
          ctx.save();const glow=ctx.createRadialGradient(x,y,3,x,y,54*pulse);glow.addColorStop(0,'rgba(255,239,173,.48)');glow.addColorStop(.42,'rgba(243,212,122,.24)');glow.addColorStop(1,'rgba(243,212,122,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,58*pulse,0,Math.PI*2);ctx.fill();
          ctx.strokeStyle='#fff0ad';ctx.lineWidth=3;ctx.shadowColor='rgba(255,224,125,1)';ctx.shadowBlur=28;ctx.beginPath();ctx.arc(x,y,31*pulse,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.82;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,43*pulse,0,Math.PI*2);ctx.stroke();ctx.restore();
        }else{
          const age=now-ringState.changedAt;ctx.save();ctx.globalAlpha=Math.max(0,1-age/TAIL_MS);ctx.strokeStyle=ringState.state==='hit'?'#f3d47a':'#ff4545';ctx.lineWidth=3;ctx.shadowColor=ringState.state==='hit'?'rgba(243,212,122,.9)':'#ff2525';ctx.shadowBlur=16;ctx.beginPath();ctx.arc(x,y,ringState.state==='hit'?27+age*.09:27+age*.025,0,Math.PI*2);ctx.stroke();ctx.restore();if(age>TAIL_MS)ringState=null;
        }
      }else ringState=null;
    }
    if(running||ringState)raf=requestAnimationFrame(drawFrame);else if(done)ctx.clearRect(0,0,680,680);
  }
  function onStrike(e){
    if(!running||mode!=='practice'||performance.now()<startAt)return;
    const surface=window.PionierCore?.surface;if(!surface)return;
    const pos=surface.canvasCoords(e),hit=surface.hitVector(pos.x,pos.y),now=performance.now(),elapsed=now-startAt;
    const state=ringState,target=state?.event;
    const inWindow=!!target&&['approach','arrive'].includes(state.state)&&elapsed>=target.at-WINDOW_MS&&elapsed<=target.at+WINDOW_MS;
    if(!inWindow||hit?.index!==state?.pad){
      e.preventDefault();e.stopImmediatePropagation();
      if(state?.state==='approach'){markMiss(now);index++;setHud('MISS · '+hitCount+' CAUGHT')}else{missCount++;progress.textContent='MISS · '+hitCount+' CAUGHT';setHud('MISS · '+hitCount+' CAUGHT')}
      return;
    }
    hitCount++;progress.textContent='CAUGHT · '+hitCount+' / '+lesson.events.length;setHud('CAUGHT · '+hitCount+' / '+lesson.events.length);ringState={event:target,pad:state.pad,state:'hit',changedAt:now};index++;
  }
  canvas.addEventListener('pointerdown',onStrike,true);
  list.querySelectorAll('[data-lesson]').forEach(b=>b.addEventListener('click',()=>{
    lessonIndex=Number(b.dataset.lesson);lesson=LESSONS[lessonIndex];
    list.hidden=true;controls.hidden=false;heading.textContent=lesson.title;description.textContent=lesson.description;
    progress.textContent='READY WHEN YOU ARE';
    if(startBtn)startBtn.hidden=false;
    if(listenBtn)listenBtn.hidden=true;
    if(catchBtn)catchBtn.hidden=true;
    if(transposeBtn)transposeBtn.hidden=false;
    if(document.getElementById('learnRestart'))document.getElementById('learnRestart').hidden=true;
  }));
  button.addEventListener('click',show);close?.addEventListener('click',hide);
  document.getElementById('learnBack')?.addEventListener('click',menu);
  document.getElementById('learnRestart')?.addEventListener('click',()=>begin(lessonIndex,mode));
  startBtn?.addEventListener('click',()=>begin(lessonIndex,'practice'));
  listenBtn?.addEventListener('click',()=>begin(lessonIndex,'practice'));
  catchBtn?.addEventListener('click',()=>begin(lessonIndex,'practice'));
  transposeBtn?.addEventListener('click',()=>{if(!lesson)return;transposeSteps=(transposeSteps+2)%Math.max(2,(window.PionierCore?.surface?.fields||[]).length||9);lesson.transpose=transposeSteps;transposeBtn.textContent='Transpose: '+(transposeSteps===0?'Original':('+'+transposeSteps+' scale degrees'));if(running)begin(lessonIndex,mode);});
  panel.addEventListener('click',e=>{if(e.target===panel)hide()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(!panel.hidden||!hud?.hidden))hide()});
  window.addEventListener('resize',()=>{overlay.width=680;overlay.height=680;syncOverlay();if(running)drawFrame()});
  menu();window.PionierLearnMode={start:begin,close:hide,stop,ready:true,lessons:LESSONS};return true;
}
