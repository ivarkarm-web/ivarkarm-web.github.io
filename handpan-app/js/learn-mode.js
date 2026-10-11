import { LESSONS } from './lessons.js';
import { TimingScorer } from './learn-core.js?v=2';

const $ = (s, root=document) => root.querySelector(s);
const state = { lesson:null, scorer:null, startedAt:0, running:false, mode:'guided', timer:null, demoTimers:[], completed:new Set(), startedLessons:new Set(), best:{}, glowFrame:0 };
let root, list, stage;
function mount(){
  if($('#learnMode')) return;
  root=document.createElement('section'); root.id='learnMode'; root.className='learn-mode'; root.hidden=true;
  root.innerHTML=`
    <div class="learn-shell" role="dialog" aria-modal="true" aria-labelledby="learnTitle">
      <header class="learn-head"><div><p class="learn-eyebrow">PIONIER · PRACTICE</p><h2 id="learnTitle">Learn the instrument</h2><p class="learn-sub">Listen. Follow. Find your own flow.</p></div><button class="learn-close" type="button" aria-label="Close lessons">×</button></header>
      <div class="learn-layout"><nav class="learn-library" aria-label="Lessons"><div class="learn-levels"></div><div class="learn-lessons"></div></nav>
      <main class="learn-stage"><div class="learn-stage-top"><span class="learn-progress">0 / 0</span></div><h3 class="learn-name">Choose a lesson</h3><p class="learn-description">Start with a small phrase and let your hands learn its shape.</p>
      
      <div class="learn-sequence" aria-live="polite"></div><div class="learn-feedback" aria-live="polite">Choose a lesson to begin.</div>
      <div class="learn-stats"><div><b data-stat="score">0</b><span>Score</span></div><div><b data-stat="combo">0</b><span>Combo</span></div><div><b data-stat="accuracy">—</b><span>Accuracy</span></div></div>
      <div class="learn-actions"><button type="button" data-action="start" class="primary">Start</button></div>
      <p class="learn-hint">Hide this panel to play the full handpan. Your practice stays active — tap Learn to return.</p>
      </main></div>
    </div>`;
  document.body.append(root);
  root.addEventListener('click', onClick);
  $('.learn-close',root).addEventListener('click', close);
  renderLibrary();
  document.addEventListener('pionier:learn-note', onNote);
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
 stopDemo(); state.running=false; state.scorer=null;
 $('.learn-name',root).textContent=state.lesson.name;
 $('.learn-description',root).textContent=state.lesson.description;
 $('.learn-progress',root).textContent=`0 / ${state.lesson.steps.length}`;
 $('.learn-feedback',root).textContent='Ready when you are.';
 $('.learn-sequence',root).replaceChildren();
 $('.learn-actions [data-action="start"]',root).textContent=state.startedLessons.has(state.lesson.id)?'Restart practice':'Start practice';
 updateStats(); renderLessons(state.lesson.level);
}
function onClick(e){
 const lesson=e.target.closest('[data-lesson]'); if(lesson){selectLesson(lesson.dataset.lesson);return;}
 const mode=e.target.closest('[data-mode]'); if(mode)return;
 const action=e.target.closest('[data-action]')?.dataset.action;
 if(action==='start')startPractice();
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
 stopDemo();
 // Give the player one beat to see the lit target before the first timing window.
 const scoredSteps=state.lesson.steps.map(step=>({...step,at:step.at+1}));
 state.scorer=new TimingScorer(scoredSteps,2.0); state.startedAt=performance.now(); state.running=true;
 state.startedLessons.add(state.lesson.id);
 $('.learn-feedback',root).textContent='First note is lit — play when ready.';
 $('.learn-actions [data-action="start"]',root).textContent='Restart practice';
 root.querySelectorAll('.learn-step').forEach((n,i)=>n.classList.toggle('is-current',i===0));
 glowTargets(0); updateStats();
 $('.learn-actions [data-action="start"]',root).textContent='Restart practice';
 // Switch from lesson selection to a compact live practice HUD; keep feedback visible.
 root.classList.add('learn-practicing');
}
function onNote(e){
 if(!state.running||!state.lesson)return;
 const idx=Number(e.detail?.index); const elapsed=((performance.now()-state.startedAt)/1000)*(state.lesson.bpm/60);
 const result=state.scorer.scoreNote(idx,elapsed);
 $('.learn-feedback',root).textContent=result.feedback==='MISS'?'Not that note — find the glowing tonefield.':result.feedback==='PERFECT'?'Perfect · stay with the pulse.':result.feedback==='GREAT'?'Beautifully placed.':result.feedback==='GOOD'?'Good — keep the phrase moving.':'A little late — keep going.';
 if(result.correct){
  const el=$(`[data-step="${result.stepIndex}"]`,root); el?.classList.add('is-hit');
  const next=state.lesson.steps.findIndex((s,i)=>!state.scorer.stepComplete(i));
  $('.learn-progress',root).textContent=`${state.lesson.steps.filter((_,i)=>state.scorer.stepComplete(i)).length} / ${state.lesson.steps.length}`;
  if(next>=0){root.querySelectorAll('.learn-step').forEach((n,i)=>n.classList.toggle('is-current',i===next));glowTargets(next);}
  if(state.scorer.allComplete()){state.running=false;clearGlows();state.completed.add(state.lesson.id);state.best[state.lesson.id]=Math.max(state.best[state.lesson.id]||0,state.scorer.score);$('.learn-feedback',root).textContent='Lesson complete · '+state.scorer.score+' points. Let it settle.';renderLessons(state.lesson.level);}
 }
 updateStats();
}
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
function open(){mount();root.hidden=false;root.classList.remove('learn-practicing');document.body.classList.add('learn-mode-open');if(!state.lesson)selectLesson(LESSONS[0].id);else $('.learn-actions [data-action="start"]',root).textContent=state.startedLessons.has(state.lesson.id)?'Restart practice':'Start practice';}
function close(){if(!root)return;state.demoTimers.forEach(clearTimeout);state.demoTimers=[];root.hidden=true;root.classList.remove('learn-practicing');document.body.classList.remove('learn-mode-open');}
window.PionierLearn={open,close,lessons:LESSONS};
document.addEventListener('DOMContentLoaded',mount);
