import { LESSONS } from './lessons.js?v=2';
import { TimingScorer } from './learn-core.js?v=4';

const $ = (s, root=document) => root.querySelector(s);
const state = { lesson:null, scorer:null, startedAt:0, running:false, mode:'guided', timer:null, demoTimers:[], completed:new Set(), startedLessons:new Set(), best:{}, glowFrame:0, practiceIndex:0, chordHits:new Set() };
let root, list, stage;
function mount(){
  if($('#learnMode')) return;
  root=document.createElement('section'); root.id='learnMode'; root.className='learn-mode'; root.hidden=true;
  root.innerHTML=`
    <div class="learn-shell" role="dialog" aria-modal="true" aria-labelledby="learnTitle">
      <header class="learn-head"><div><h2 id="learnTitle">Learn</h2></div><button class="learn-close" type="button" aria-label="Close lessons">×</button></header>
      <div class="learn-layout"><nav class="learn-library" aria-label="Lessons"><div class="learn-levels"></div><div class="learn-lessons"></div></nav>
      <main class="learn-stage"><div class="learn-stage-top"><span class="learn-progress">0 / 0</span></div><h3 class="learn-name">Choose</h3><p class="learn-description"></p>
      
      <div class="learn-sequence" aria-live="polite"></div><div class="learn-feedback" aria-live="polite">Choose a lesson to begin.</div>
      <div class="learn-stats"><div><b data-stat="score">0</b><span>Score</span></div><div><b data-stat="combo">0</b><span>Combo</span></div><div><b data-stat="accuracy">—</b><span>Accuracy</span></div></div>
      <div class="learn-actions"><button type="button" data-action="start" class="primary">Start</button></div>
      
      </main></div>
    </div>
    <div class="learn-result" hidden role="dialog" aria-modal="true" aria-labelledby="learnResultTitle">
      <div class="learn-result-card">
        <p class="learn-eyebrow">COMPLETE</p>
        <h2 id="learnResultTitle">Finished</h2>
        <p class="learn-result-lesson"></p>
        <div class="learn-result-score"><span>FINAL SCORE</span><strong data-result="score">0</strong></div>
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
function renderLibrary(){
 const levels=$('.learn-levels',root), lessons=$('.learn-lessons',root);
 levels.innerHTML=[1,2,3,4].map(n=>`<button type="button" data-level="${n}" class="${n===1?'is-active':''}"><span>0${n}</span>${['First Notes','Rhythms','Phrases & Chords','Short Pieces'][n-1]}</button>`).join('');
 levels.addEventListener('click',e=>{const b=e.target.closest('[data-level]');if(!b)return;levels.querySelectorAll('button').forEach(x=>x.classList.toggle('is-active',x===b));renderLessons(+b.dataset.level);});
 renderLessons(1);
}
function renderLessons(level){
 const lessons=$('.learn-lessons',root);
 lessons.innerHTML=LESSONS.filter(l=>l.level===level).map(l=>`<button type="button" data-lesson="${l.id}" class="learn-lesson ${state.lesson?.id===l.id?'is-active':''}"><span class="lesson-check">${state.completed.has(l.id)?'✓':'○'}</span><span><b>${l.name}</b><small>${l.description}</small></span><span class="lesson-best">${state.best[l.id]||''}</span></button>`).join('');
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
 $('.learn-description',root).textContent=state.lesson.description;
 $('.learn-progress',root).textContent=`0 / ${state.lesson.steps.length}`;
 $('.learn-feedback',root).textContent='Ready when you are.';
 $('.learn-sequence',root).replaceChildren();
 $('.learn-actions [data-action="start"]',root).textContent='Start';
 updateStats(); renderLessons(state.lesson.level);
}
function onClick(e){
 const lesson=e.target.closest('[data-lesson]'); if(lesson){hideResult();selectLesson(lesson.dataset.lesson);return;}
 const mode=e.target.closest('[data-mode]'); if(mode)return;
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(action==='start')startPractice();
 if(action==='result-restart'){hideResult();startPractice();}
 if(action==='result-next'){const i=LESSONS.findIndex(l=>l.id===state.lesson?.id);const next=LESSONS[i+1];if(next){hideResult();root.classList.remove('learn-practicing');selectLesson(next.id);startPractice();}else{hideResult();root.classList.remove('learn-practicing');$('.learn-name',root).textContent='All complete';$('.learn-description',root).textContent='';}}
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
function startPractice(){
 if(!state.lesson)return;
 hideResult();
 stopDemo();
 // Rebuild the scale-sized intro against whichever instrument is active now.
 if(state.lesson.id==='first-touch'){
  state.lesson=lessonFor('first-touch');
  $('.learn-description',root).textContent=state.lesson.description;
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
 updateStats();

 // Demonstrate the entire phrase first: each tonefield lights and sounds in order.
 // Then reset the scorer and hand the same sequence to the player to repeat.
 const core=window.PionierCore, inst=active(), fields=core?.surface?.fields;
 if(!inst?.noteOn||!Array.isArray(fields)||!fields.length){
   beginPlayerTurn(scoredSteps);
   return;
 }
 $('.learn-feedback',root).textContent='Watch the scale…';
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
 state.running=true;
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
   $('.learn-feedback',root).textContent='Follow the glowing tonefield.';
   updateStats();
   return;
  }
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
   state.best[state.lesson.id]=Math.max(state.best[state.lesson.id]||0,state.scorer.score);
   $('.learn-feedback',root).textContent='Lesson complete · '+state.scorer.score+' points. Let it settle.';
   renderLessons(state.lesson.level);showResult();
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
   $('.learn-feedback',root).textContent='Play one of the two glowing notes in this chord.';
   updateStats();
   return;
  }
  if(state.chordHits.has(idx))return;
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
    state.best[state.lesson.id]=Math.max(state.best[state.lesson.id]||0,state.scorer.score);
    $('.learn-feedback',root).textContent='Lesson complete · '+state.scorer.score+' points. Let it settle.';
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
 $('.learn-feedback',root).textContent=result.feedback==='MISS'?'Not that note — find the glowing tonefield.':result.feedback==='PERFECT'?'Perfect · stay with the pulse.':result.feedback==='GREAT'?'Beautifully placed.':result.feedback==='GOOD'?'Good — keep the phrase moving.':'A little late — keep going.';
 if(result.correct){
  const el=$(`[data-step="${result.stepIndex}"]`,root); el?.classList.add('is-hit');
  const next=state.lesson.steps.findIndex((s,i)=>!state.scorer.stepComplete(i));
  $('.learn-progress',root).textContent=`${state.lesson.steps.filter((_,i)=>state.scorer.stepComplete(i)).length} / ${state.lesson.steps.length}`;
  if(next>=0){root.querySelectorAll('.learn-step').forEach((n,i)=>n.classList.toggle('is-current',i===next));glowTargets(next);}
  if(state.scorer.allComplete()){state.running=false;clearGlows();state.completed.add(state.lesson.id);state.best[state.lesson.id]=Math.max(state.best[state.lesson.id]||0,state.scorer.score);$('.learn-feedback',root).textContent='Lesson complete · '+state.scorer.score+' points. Let it settle.';renderLessons(state.lesson.level);showResult();}
 }
 updateStats();
}
function showResult(){
 const s=state.scorer;
 if(!s||!root)return;
 $('.learn-result-lesson',root).textContent=state.lesson?.name||'';
 $('[data-result="score"]',root).textContent=s.score;
 $('[data-result="combo"]',root).textContent=s.bestCombo;
 $('[data-result="accuracy"]',root).textContent=Math.round(s.accuracy()*100)+'%';
 $('[data-result="hits"]',root).textContent=s.hits;
 $('.learn-result',root).hidden=false;
}
function hideResult(){if(root){$('.learn-result',root).hidden=true;}}
function updateStats(){
 if(!root)return; const s=state.scorer;
 $('[data-stat="score"]',root).textContent=s?.score||0;
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
function open(){mount();root.hidden=false;root.classList.remove('learn-practicing');document.body.classList.add('learn-mode-open');if(!state.lesson)selectLesson(LESSONS[0].id);else $('.learn-actions [data-action="start"]',root).textContent='Start';}
function close(){if(!root)return;state.demoTimers.forEach(clearTimeout);state.demoTimers=[];root.hidden=true;root.classList.remove('learn-practicing');document.body.classList.remove('learn-mode-open');}
window.PionierLearn={open,close,lessons:LESSONS};
document.addEventListener('DOMContentLoaded',mount);
