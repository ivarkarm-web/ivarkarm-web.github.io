import { LESSONS } from './lessons.js?v=2';
import { TimingScorer } from './learn-core.js?v=4';

const $ = (s, root=document) => root.querySelector(s);
const PROGRESS_KEY='pionier-learn-progress-v1';
function loadProgress(){
 try { const saved=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{}'); return saved&&typeof saved==='object'?saved:{}; }
 catch(_){ return {}; }
}
const savedProgress=loadProgress();
const state = { lesson:null, scorer:null, startedAt:0, running:false, mode:'guided', timer:null, demoTimers:[], completed:new Set(savedProgress.completed||[]), startedLessons:new Set(), best:savedProgress.best||{}, stars:savedProgress.stars||{}, selectedLevel:1, glowFrame:0, practiceIndex:0, chordHits:new Set(), wrongAttempts:0 };
let root, list, stage;
let rewardFrame=0, rewardResize=null;
function mount(){
  if($('#learnMode')) return;
  root=document.createElement('section'); root.id='learnMode'; root.className='learn-mode'; root.hidden=true;
  root.innerHTML=`
    <div class="learn-shell" role="dialog" aria-modal="true" aria-labelledby="learnTitle">
      <header class="learn-head"><div><h2 id="learnTitle">Learn</h2></div><button class="learn-close" type="button" aria-label="Close lessons">×</button></header>
      <div class="learn-layout"><nav class="learn-library" aria-label="Lessons"><div class="learn-levels"></div><div class="learn-lessons"></div></nav>
      <main class="learn-stage"><div class="learn-stage-top"><span class="learn-progress">0 / 0</span></div><h3 class="learn-name">Choose</h3><p class="learn-description"></p>
      
      <div class="learn-sequence" aria-live="polite"></div><div class="learn-feedback" aria-live="polite">Choose a lesson to begin.</div>
      <div class="learn-stats"><div><b data-stat="combo">0</b><span>Combo</span></div><div><b data-stat="accuracy">—</b><span>Accuracy</span></div></div>
      <div class="learn-actions"><button type="button" data-action="start" class="primary">Start</button></div>
      
      </main></div>
    </div>
    <div class="learn-result" hidden role="dialog" aria-modal="true" aria-labelledby="learnResultTitle">
      <canvas class="learn-reward-particles" aria-hidden="true"></canvas>
      <div class="learn-result-mandala" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="learn-result-card">
        <p class="learn-eyebrow">LESSON COMPLETE</p>
        <h2 id="learnResultTitle">Finished</h2>
        <p class="learn-result-lesson"></p>
        <div class="learn-result-stars" role="img" aria-label="Lesson rating: 0 out of 3 stars"><span data-star="1">★</span><span data-star="2">★</span><span data-star="3">★</span></div>
        <p class="learn-result-star-caption">Keep exploring</p>
        <div class="learn-result-stats">
          <div><strong data-result="combo">0</strong><span>Best combo</span></div>
          <div><strong data-result="accuracy">0%</strong><span>Accuracy</span></div>
          <div><strong data-result="hits">0</strong><span>Notes played</span></div>
        </div>
        <div class="learn-result-actions">
          <button type="button" data-action="result-restart">Restart</button>
          <button type="button" data-action="result-next" class="primary">Next</button>
          <button type="button" data-action="result-lessons">Menu</button>
        </div>
      </div>
    </div>`;
  document.body.append(root);
  root.addEventListener('click', onClick);
  $('.learn-close',root).addEventListener('click', close);
  renderLibrary();
  window.addEventListener('pionier:learn-note', onNote);
  $('#learnLaunch')?.addEventListener('click', open);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && root && !root.hidden) close(); });
}
function starsFor(id){ return Math.max(0,Math.min(3,Number(state.stars[id])||0)); }
function totalStars(){ return Object.values(state.stars).reduce((sum,n)=>sum+Math.max(0,Math.min(3,Number(n)||0)),0); }
function levelUnlocked(level){
 if(level===1)return true;
 const thresholds={2:3,3:8,4:14};
 return totalStars()>=(thresholds[level]||Infinity);
}
function lessonUnlocked(lesson){
 if(!levelUnlocked(lesson.level))return false;
 const siblings=LESSONS.filter(item=>item.level===lesson.level);
 const index=siblings.findIndex(item=>item.id===lesson.id);
 return index<=0 || starsFor(siblings[index-1].id)>0;
}
function saveProgress(){
 try{localStorage.setItem(PROGRESS_KEY,JSON.stringify({completed:[...state.completed],best:state.best,stars:state.stars}));}catch(_){}
}
function renderLibrary(){
 const levels=$('.learn-levels',root);
 levels.innerHTML=[1,2,3,4].map(n=>{
  const unlocked=levelUnlocked(n), earned=LESSONS.filter(l=>l.level===n).reduce((sum,l)=>sum+starsFor(l.id),0);
  return `<button type="button" data-level="${n}" class="${n===state.selectedLevel?'is-active':''} ${unlocked?'':'is-locked'}" ${unlocked?'':'disabled'}><span>0${n}</span>${['First Notes','Rhythms','Phrases & Chords','Short Pieces'][n-1]}<em>${unlocked?earned+' ★':'🔒 '+({2:3,3:8,4:14}[n]||0)+' ★'}</em></button>`;
 }).join('');
 levels.onclick=e=>{const b=e.target.closest('[data-level]');if(!b||b.disabled)return;state.selectedLevel=Number(b.dataset.level);renderLibrary();renderLessons(state.selectedLevel);};
 renderLessons(state.selectedLevel);
}
function renderLessons(level){
 state.selectedLevel=level;
 const lessons=$('.learn-lessons',root);
 lessons.innerHTML=LESSONS.filter(l=>l.level===level).map((l,index)=>{
  const unlocked=lessonUnlocked(l), stars=starsFor(l.id), isActive=state.lesson?.id===l.id;
  return `<button type="button" data-lesson="${l.id}" class="learn-lesson ${isActive?'is-active':''} ${unlocked?'':'is-locked'} ${state.completed.has(l.id)?'is-complete':''}" ${unlocked?'':'disabled'} aria-label="${l.name}, ${unlocked?'unlocked':'locked'}, ${stars} of 3 stars">
   <span class="arcade-number">${String(LESSONS.filter(x=>x.level===level).findIndex(x=>x.id===l.id)+1).padStart(2,'0')}</span>
   <span class="arcade-card-title"><b>${l.name}</b><small>${unlocked?(state.completed.has(l.id)?'CLEARED':'READY TO PLAY'):'EARN A STAR TO UNLOCK'}</small></span>
   <span class="arcade-stars" aria-label="${stars} stars">${[1,2,3].map(n=>`<i class="${n<=stars?'earned':''}">★</i>`).join('')}</span>
   <span class="arcade-lock" aria-hidden="true">${unlocked?(state.completed.has(l.id)?'✓':'▶'):'🔒'}</span>
  </button>`;
 }).join('');
}
function lessonFor(id){
 const lesson=LESSONS.find(l=>l.id===id); if(!lesson)return null;
 if(id!=='first-touch')return lesson;
 const count=Math.max(1,Math.min(13,Number(window.PionierCore?.noteCount?.())||9));
 const ascent=Array.from({length:count},(_,i)=>i);
 const descent=Array.from({length:Math.max(0,count-1)},(_,i)=>count-2-i);
 const targets=[...ascent,...descent];
 return {...lesson,description:'Play every tonefield up the scale, then follow the lights back down.',bpm:56,steps:targets.map((target,index)=>({at:index,targets:[target]}))};
}
function selectLesson(id){
 state.lesson=lessonFor(id); if(!state.lesson)return;
 stopDemo(); state.running=false; state.scorer=null; hideResult();
 $('.learn-name',root).textContent=state.lesson.name;
 $('.learn-description',root).textContent='';
 $('.learn-progress',root).textContent=`0 / ${state.lesson.steps.length}`;
 $('.learn-feedback',root).textContent='Ready when you are.';
 $('.learn-sequence',root).replaceChildren();
 $('.learn-actions [data-action="start"]',root).textContent='Start';
 updateStats(); state.selectedLevel=state.lesson.level; renderLibrary(); renderLessons(state.lesson.level);
}
function onClick(e){
 const lesson=e.target.closest('[data-lesson]'); if(lesson){if(lesson.disabled)return;hideResult();selectLesson(lesson.dataset.lesson);return;}
 const mode=e.target.closest('[data-mode]'); if(mode)return;
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(action==='start')startPractice();
 if(action==='result-restart'){hideResult();startPractice();}
 if(action==='result-next'){const i=LESSONS.findIndex(l=>l.id===state.lesson?.id);const next=LESSONS[i+1];if(next&&lessonUnlocked(next)){hideResult();root.classList.remove('learn-practicing');selectLesson(next.id);startPractice();}else{hideResult();root.classList.remove('learn-practicing');state.selectedLevel=state.lesson?.level||1;renderLibrary();renderLessons(state.selectedLevel);}}
 if(action==='result-lessons'){hideResult();root.classList.remove('learn-practicing');$('.learn-actions [data-action="start"]',root).textContent='Start';}
}
function active(){return window.PionierCore?.activeInstrument?.();}
function redraw(){try{window.PionierCore?.draw?.();}catch(err){console.debug('[learn] redraw deferred',err);}}
function clearGlows(){cancelAnimationFrame(state.glowFrame);const inst=active();if(inst?.glow)for(let i=0;i<inst.glow.length;i++)inst.glow[i]=0;redraw();}
function glowTargets(stepIndex){
 const inst=active(), step=state.lesson?.steps[stepIndex]; if(!inst?.glow||!step)return;
 cancelAnimationFrame(state.glowFrame);
 const targets=new Set(step.targets), start=performance.now();
 const initial=Array.from(inst.glow, (v,i)=>targets.has(i)?1:Math.max(0,v||0));
 const fadeMs=420;
 const animate=now=>{
  const t=Math.min(1,(now-start)/fadeMs);
  for(let i=0;i<inst.glow.length;i++)inst.glow[i]=targets.has(i)?1:initial[i]*(1-t);
  redraw();
  if(t<1)state.glowFrame=requestAnimationFrame(animate);
 };
 state.glowFrame=requestAnimationFrame(animate);
}
function showFollowLight(){
 // A standalone viewport hint stays above the instrument, centered between
 // the left Clear control and the right Looper control. Do not place it in
 // the lesson panel: that panel can sit outside the instrument on small screens.
 let hint=document.getElementById('followLightHint');
 if(!hint){
  hint=document.createElement('div');
  hint.id='followLightHint';
  hint.className='follow-light-hint';
  hint.setAttribute('role','status');
  hint.setAttribute('aria-live','polite');
  document.body.append(hint);
 }
 hint.textContent='FOLLOW THE LIGHT';
 hint.classList.remove('is-visible');
 void hint.offsetWidth;
 hint.classList.add('is-visible');
}
function pulseCurrentTarget(){
 const inst=active(), step=state.lesson?.steps[state.practiceIndex];
 if(!inst?.glow || !step?.targets?.length)return;
 cancelAnimationFrame(state.glowFrame);
 const targets=new Set(step.targets), start=performance.now(), duration=1800;
 const animate=now=>{
  const elapsed=now-start, t=Math.min(1,elapsed/duration);
  const pulse=.35+.65*(.5+.5*Math.cos(elapsed/115*Math.PI*2));
  for(const index of targets)if(index<inst.glow.length)inst.glow[index]=t>=1?1:pulse;
  redraw();
  if(t<1)state.glowFrame=requestAnimationFrame(animate);
  else { for(const index of targets)if(index<inst.glow.length)inst.glow[index]=1; redraw(); }
 };
 state.glowFrame=requestAnimationFrame(animate);
}
function wrongNoteHint(){
 state.wrongAttempts++;
 if(state.wrongAttempts<5)return;
 state.wrongAttempts=0;
 pulseCurrentTarget();
 showFollowLight();
}

function startPractice(){
 if(!state.lesson)return;
 hideResult();
 stopDemo();
 // Rebuild the scale-sized intro against whichever instrument is active now.
 if(state.lesson.id==='first-touch'){
  state.lesson=lessonFor('first-touch');
  $('.learn-description',root).textContent='';
  $('.learn-progress',root).textContent='0 / '+state.lesson.steps.length;
 }
 const lesson=state.lesson;
 const scoredSteps=lesson.steps.map(step=>({...step,at:step.at+1}));
 state.scorer=new TimingScorer(scoredSteps,2.0);
 state.startedAt=0;
 state.running=false;
 state.startedLessons.add(lesson.id);
 $('.learn-actions [data-action="start"]',root).textContent='Restart';
 root.classList.add('learn-practicing');
 showFollowLight();
 updateStats();

 // Demonstrate the entire phrase first: each tonefield lights and sounds in order.
 // Then reset the scorer and hand the same sequence to the player to repeat.
 const core=window.PionierCore, inst=active(), fields=core?.surface?.fields;
 if(!inst?.noteOn||!Array.isArray(fields)||!fields.length){
   beginPlayerTurn(scoredSteps);
   return;
 }
 const interval=560;
 lesson.steps.forEach((step,i)=>{
   state.demoTimers.push(setTimeout(()=>{
     if(!root || root.hidden || state.lesson!==lesson)return;
     glowTargets(i);
     step.targets.forEach(idx=>{
       const field=fields.find(f=>f.index===idx);
       if(!field)return;
       const gesture={velocity:.62,pressure:.62,pointerId:-700-i,lastStrikeAt:inst.lastStrikeAt};
       try{
         inst.noteOn(gesture,field);
         state.demoTimers.push(setTimeout(()=>{try{inst.noteOff(idx);}catch(_){}},260));
       }catch(err){console.warn('[learn] demo note failed',err);}
     });
   },i*interval));
 });
 state.demoTimers.push(setTimeout(()=>{
   if(!root || root.hidden || state.lesson!==lesson)return;
   beginPlayerTurn(scoredSteps);
 },lesson.steps.length*interval+300));
}
function beginPlayerTurn(scoredSteps){
 state.demoTimers=[];
 state.scorer=new TimingScorer(scoredSteps,2.0);
 state.startedAt=performance.now();
 state.practiceIndex=0;
 state.chordHits=new Set();
 state.wrongAttempts=0;
 state.running=true;
 // The intro demo can outlast the hint's fade animation; show it again when play begins.
 showFollowLight();
 $('.learn-feedback',root).textContent=state.lesson.id==='home-away'?'Your turn — play both notes of each glowing chord.':'Your turn — repeat the glowing scale.';
 glowTargets(0);
 updateStats();
}
function onNote(e){
 if(!state.running||!state.lesson||!state.scorer)return;
 const idx=Number(e.detail?.index);
 // The first lesson is a call-and-response exercise, not a rhythm test.
 // Count the exact next note in order; timing must never prevent a correct repeat.
 if(state.lesson.id==='first-touch'){
  const stepIndex=state.practiceIndex;
  const step=state.lesson.steps[stepIndex];
  if(!step)return;
  if(!step.targets.includes(idx)){
   state.scorer.misses++;
   state.scorer.combo=0;
   state.scorer.lastFeedback='MISS';
   wrongNoteHint();
   updateStats();
   return;
  }
  state.wrongAttempts=0;
  state.scorer.stepHits[stepIndex].add(step.targets.indexOf(idx));
  state.scorer.hits++;
  state.scorer.combo++;
  state.scorer.bestCombo=Math.max(state.scorer.bestCombo,state.scorer.combo);
  state.scorer.score+=100;
  state.scorer.lastFeedback='PERFECT';
  state.practiceIndex++;
  $('.learn-feedback',root).textContent='Perfect · keep following the lights.';
  $('.learn-progress',root).textContent=state.practiceIndex+' / '+state.lesson.steps.length;
  if(state.practiceIndex>=state.lesson.steps.length){
   state.running=false;clearGlows();state.completed.add(state.lesson.id);
   $('.learn-feedback',root).textContent='Lesson complete. Let it settle.';
   renderLibrary();renderLessons(state.lesson.level);showResult();
  }else{
   glowTargets(state.practiceIndex);
  }
  updateStats();
  return;
 }
 // Chords are a call-and-response sequence: keep the current pair lit until
 // both notes have been played, then move the hint to the next chord.
 if(state.lesson.id==='home-away'){
  const stepIndex=state.practiceIndex;
  const step=state.lesson.steps[stepIndex];
  if(!step)return;
  if(!step.targets.includes(idx)){
   state.scorer.misses++;
   state.scorer.combo=0;
   state.scorer.lastFeedback='MISS';
   wrongNoteHint();
   updateStats();
   return;
  }
  if(state.chordHits.has(idx))return;
  state.wrongAttempts=0;
  state.chordHits.add(idx);
  state.scorer.hits++;
  state.scorer.combo++;
  state.scorer.bestCombo=Math.max(state.scorer.bestCombo,state.scorer.combo);
  state.scorer.score+=100;
  state.scorer.lastFeedback='PERFECT';
  if(step.targets.every(target=>state.chordHits.has(target))){
   state.practiceIndex++;
   state.chordHits=new Set();
   $('.learn-progress',root).textContent=state.practiceIndex+' / '+state.lesson.steps.length;
   if(state.practiceIndex>=state.lesson.steps.length){
    state.running=false;clearGlows();state.completed.add(state.lesson.id);
    $('.learn-feedback',root).textContent='Lesson complete. Let it settle.';
    renderLessons(state.lesson.level);showResult();
   }else{
    $('.learn-feedback',root).textContent='Chord complete · follow the next pair.';
    glowTargets(state.practiceIndex);
   }
  }else{
   $('.learn-feedback',root).textContent='Good — now play the other glowing note.';
   // Keep both notes of the current chord clearly highlighted.
   glowTargets(stepIndex);
  }
  updateStats();
  return;
 }
 const elapsed=((performance.now()-state.startedAt)/1000)*(state.lesson.bpm/60);
 const result=state.scorer.scoreNote(idx,elapsed);
 if(result.correct)state.wrongAttempts=0;
 if(!result.correct)wrongNoteHint();
 else $('.learn-feedback',root).textContent=result.feedback==='PERFECT'?'Perfect · stay with the pulse.':result.feedback==='GREAT'?'Beautifully placed.':result.feedback==='GOOD'?'Good — keep the phrase moving.':'A little late — keep going.';
 if(result.correct){
  const el=$(`[data-step="${result.stepIndex}"]`,root); el?.classList.add('is-hit');
  const next=state.lesson.steps.findIndex((s,i)=>!state.scorer.stepComplete(i));
  $('.learn-progress',root).textContent=`${state.lesson.steps.filter((_,i)=>state.scorer.stepComplete(i)).length} / ${state.lesson.steps.length}`;
  if(next>=0){root.querySelectorAll('.learn-step').forEach((n,i)=>n.classList.toggle('is-current',i===next));glowTargets(next);}
  if(state.scorer.allComplete()){state.running=false;clearGlows();state.completed.add(state.lesson.id);$('.learn-feedback',root).textContent='Lesson complete. Let it settle.';renderLessons(state.lesson.level);showResult();}
 }
 updateStats();
}
function showResult(){
 const s=state.scorer;
 if(!s||!root)return;
 $('.learn-result-lesson',root).textContent=state.lesson?.name||'';
 $('[data-result="combo"]',root).textContent=s.bestCombo;
 $('[data-result="accuracy"]',root).textContent=Math.round(s.accuracy()*100)+'%';
 $('[data-result="hits"]',root).textContent=s.hits;
 const accuracy=s.accuracy();
 const stars=accuracy>=.90?3:accuracy>=.75?2:1;
 state.stars[state.lesson.id]=Math.max(starsFor(state.lesson.id),stars);
 saveProgress();
 renderLibrary();
 renderLessons(state.lesson.level);
 root.querySelectorAll('[data-star]').forEach(star=>star.classList.toggle('is-earned',Number(star.dataset.star)<=stars));
 $('.learn-result-stars',root).setAttribute('aria-label','Lesson rating: '+stars+' out of 3 stars');
 $('.learn-result-star-caption',root).textContent=stars===3?'Beautifully played':stars===2?'A strong performance':'First star earned — keep going';
 root.classList.remove('learn-practicing');
 root.classList.add('learn-complete');
 $('.learn-result',root).hidden=false;
 startRewardParticles();
}
function hideResult(){if(root){$('.learn-result',root).hidden=true;root.classList.remove('learn-complete');stopRewardParticles();}}
function stopRewardParticles(){
 cancelAnimationFrame(rewardFrame); rewardFrame=0;
 if(rewardResize){window.removeEventListener('resize',rewardResize);rewardResize=null;}
}
function startRewardParticles(){
 stopRewardParticles();
 const canvas=$('.learn-reward-particles',root), ctx=canvas?.getContext('2d');
 if(!canvas||!ctx)return;
 let w=0,h=0,dpr=1,last=0,elapsed=0;
 const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const rand=(a,b)=>a+Math.random()*(b-a);
 const palette=[
  {r:255,g:222,b:157}, // champagne gold
  {r:224,g:184,b:111}, // antique gold
  {r:155,g:210,b:226}, // glacial blue
  {r:245,g:239,b:220}  // pearl
 ];
 const makeParticle=(layer)=>({
  x:Math.random(), y:Math.random(), px:0, py:0,
  vx:rand(-.00012,.00012)*(layer===0?1:.55),
  vy:rand(-.00022,-.00004)*(layer===0?1:.5),
  radius:layer===0?rand(.45,1.15):layer===1?rand(.8,1.8):rand(1.2,2.7),
  alpha:layer===0?rand(.12,.35):layer===1?rand(.18,.48):rand(.25,.68),
  phase:rand(0,Math.PI*2), pulse:rand(.45,1.3),
  layer, color:palette[Math.random()<.68?0:Math.random()<.55?1:Math.random()<.78?2:3],
  twinkle:rand(.0005,.002)
 });
 const particles=Array.from({length:reducedMotion?70:210},(_,i)=>makeParticle(i%3));
 const resize=()=>{
  const rect=canvas.getBoundingClientRect();
  dpr=Math.min(window.devicePixelRatio||1,2);
  w=rect.width;h=rect.height;
  canvas.width=Math.max(1,Math.round(w*dpr));canvas.height=Math.max(1,Math.round(h*dpr));
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,w,h);
  particles.forEach(p=>{p.px=p.x*w;p.py=p.y*h;});
 };
 rewardResize=resize;window.addEventListener('resize',resize,{passive:true});resize();
 const draw=now=>{
  const dt=Math.min(34,now-(last||now));last=now;elapsed+=dt;
  // A very light veil preserves particle trails without muddying the black backdrop.
  ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='rgba(5,7,11,0.16)';ctx.fillRect(0,0,w,h);
  const cx=w*.5,cy=h*.47,base=Math.min(w,h)*.48;
  const breath=.96+.04*Math.sin(elapsed*.00038);
  const halo=ctx.createRadialGradient(cx,cy,0,cx,cy,base*breath);
  halo.addColorStop(0,'rgba(213,174,94,.105)');
  halo.addColorStop(.24,'rgba(112,151,170,.045)');
  halo.addColorStop(.58,'rgba(57,86,105,.018)');
  halo.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=halo;ctx.fillRect(0,0,w,h);

  // Slow, interleaved orbital filaments — intentionally subtle behind the reward card.
  ctx.save();ctx.translate(cx,cy);ctx.globalCompositeOperation='screen';
  for(let ring=0;ring<3;ring++){
   ctx.beginPath();
   const rx=base*(.42+ring*.19), ry=base*(.24+ring*.16);
   const rotation=elapsed*(ring%2?-.000035:.000027)+ring*.72;
   ctx.ellipse(0,0,rx,ry,rotation,0,Math.PI*2);
   ctx.strokeStyle=ring===1?'rgba(206,180,124,.075)':'rgba(135,187,204,.045)';
   ctx.lineWidth=ring===1?.8:.65;ctx.stroke();
  }
  ctx.restore();

  // Deep field: tiny dust, mid-field: floating motes, foreground: luminous seeds.
  ctx.globalCompositeOperation='screen';
  for(const p of particles){
   p.px=p.x*w;p.py=p.y*h;
   if(!reducedMotion){
    p.x+=p.vx*dt;p.y+=p.vy*dt;
    p.x+=Math.sin(elapsed*.00019+p.phase)*dt*.000012*(p.layer+1);
   }
   if(p.y<-.025){p.y=1.025;p.x=Math.random();}
   if(p.x<-.025)p.x=1.025;if(p.x>1.025)p.x=-.025;
   const x=p.x*w,y=p.y*h;
   const twinkle=.62+.38*Math.sin(elapsed*p.twinkle+p.phase);
   const alpha=p.alpha*twinkle;
   const r=p.radius*(p.layer===2?1:.85);
   // Only a few motes get a real soft bloom, keeping the scene refined.
   if(p.layer===2&&p.radius>2){
    const bloom=ctx.createRadialGradient(x,y,0,x,y,r*5);
    bloom.addColorStop(0,`rgba(${p.color.r},${p.color.g},${p.color.b},${alpha*.25})`);
    bloom.addColorStop(1,`rgba(${p.color.r},${p.color.g},${p.color.b},0)`);
    ctx.fillStyle=bloom;ctx.beginPath();ctx.arc(x,y,r*5,0,Math.PI*2);ctx.fill();
   }
   ctx.fillStyle=`rgba(${p.color.r},${p.color.g},${p.color.b},${alpha})`;
   ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();
   if(p.layer===2&&p.radius>2.2){
    ctx.strokeStyle=`rgba(255,231,183,${alpha*.22})`;ctx.lineWidth=.55;
    ctx.beginPath();ctx.moveTo(x-r*2.5,y);ctx.lineTo(x+r*2.5,y);ctx.moveTo(x,y-r*2.5);ctx.lineTo(x,y+r*2.5);ctx.stroke();
   }
  }

  // Sparse constellation links form and dissolve naturally, not a rigid mesh.
  const links=particles.filter(p=>p.layer===2);
  ctx.lineWidth=.55;
  for(let i=0;i<links.length;i++){
   const a=links[i],ax=a.x*w,ay=a.y*h;
   for(let j=i+1;j<Math.min(i+5,links.length);j++){
    const b=links[j],bx=b.x*w,by=b.y*h,dx=ax-bx,dy=ay-by,dist=Math.hypot(dx,dy);
    if(dist<Math.min(105,base*.24)){
     const strength=(1-dist/Math.min(105,base*.24))*.075*Math.min(a.alpha,b.alpha);
     ctx.strokeStyle=`rgba(186,204,199,${strength})`;
     ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
    }
   }
  }
  ctx.globalCompositeOperation='source-over';
  if(!reducedMotion)rewardFrame=requestAnimationFrame(draw);
 };
 if(reducedMotion){draw(performance.now());}
 else rewardFrame=requestAnimationFrame(draw);
}
function updateStats(){
 if(!root)return; const s=state.scorer;
 $('[data-stat="combo"]',root).textContent=s?.combo||0;
 $('[data-stat="accuracy"]',root).textContent=s?Math.round(s.accuracy()*100)+'%':'—';
}
function stopDemo(){state.demoTimers.forEach(clearTimeout);state.demoTimers=[];state.running=false;}
function demo(){
 if(!state.lesson)return; stopDemo();
 const core=window.PionierCore, inst=active(), fields=core?.surface?.fields;
 if(!inst||!fields){$('.learn-feedback',root).textContent='Instrument is still loading. Try again in a moment.';return;}
 const unit=60000/state.lesson.bpm;
 state.lesson.steps.forEach((step,i)=>state.demoTimers.push(setTimeout(()=>{
  step.targets.forEach(idx=>{const field=fields.find(f=>f.index===idx);if(!field)return;
   const gesture={velocity:.62,pressure:.62,pointerId:-500-i,lastStrikeAt:inst.lastStrikeAt};
   try{inst.noteOn(gesture,field);setTimeout(()=>inst.noteOff(idx),220);}catch(err){console.warn('Learn demo note failed',err);}
  });
  glowTargets(i);
  $('.learn-sequence',root)?.querySelectorAll('.learn-step').forEach((n,j)=>n.classList.toggle('is-current',i===j));
  if(i===state.lesson.steps.length-1)setTimeout(()=>{$('.learn-feedback',root).textContent='Your turn. Follow the glowing tonefields.';},unit);
 },step.at*unit)));
 $('.learn-feedback',root).textContent='Listen closely…';
}
function open(){mount();root.hidden=false;root.classList.remove('learn-practicing','learn-complete');document.body.classList.add('learn-mode-open');if(!state.lesson)selectLesson(LESSONS[0].id);else $('.learn-actions [data-action="start"]',root).textContent='Start';}
function close(){if(!root)return;state.demoTimers.forEach(clearTimeout);state.demoTimers=[];root.hidden=true;root.classList.remove('learn-practicing','learn-complete');document.body.classList.remove('learn-mode-open');}
window.PionierLearn={open,close,lessons:LESSONS};
document.addEventListener('DOMContentLoaded',mount);
