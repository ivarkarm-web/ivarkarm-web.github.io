import { LESSONS } from './lessons.js';
import { TimingScorer } from './learn-core.js';

const game = window.HandpanGame;
const panel = document.getElementById('learnPanel');
const list = document.getElementById('lessonList');
const stage = document.getElementById('learnStage');
const stageName = document.getElementById('learnStageName');
const levelEl = document.getElementById('learnLevel');
const progressEl = document.getElementById('learnProgress');
const scoreEl = document.getElementById('learnScore');
const statusEl = document.getElementById('learnStatus');
const timingEl = document.getElementById('learnTiming');
const modal = document.getElementById('learnModal');
const modalTitle = document.getElementById('learnModalTitle');
const modalText = document.getElementById('learnModalText');
const modalActions = document.getElementById('learnModalActions');

const state = { lesson:null, phase:'picker', scorer:null, practiceStart:0, demoStart:0, timer:null, lastStep:-1, lastFeedback:'', demoTimers:[] };
const LEVELS = [[1,'First Notes'],[2,'Rhythms'],[3,'Phrases & Chords'],[4,'Short Pieces']];

function clearTimers(){ if(state.timer) clearInterval(state.timer); state.timer=null; state.demoTimers.forEach((timer)=>clearTimeout(timer)); state.demoTimers=[]; }
function renderList(){
  if(!list)return;
  list.innerHTML='';
  LEVELS.forEach(([level,name])=>{
    const heading=document.createElement('div'); heading.className='lesson-level'; heading.textContent='LEVEL '+level+' · '+name; list.appendChild(heading);
    LESSONS.filter((lesson)=>lesson.level===level).forEach((lesson)=>{
      const button=document.createElement('button'); button.type='button'; button.className='lesson-card';
      button.innerHTML='<span class="lesson-card-top"><b>'+lesson.name+'</b><small>'+lesson.bpm+' BPM</small></span><span>'+lesson.description+'</span><em>'+lesson.steps.length+' steps</em>';
      button.addEventListener('click',()=>beginLesson(lesson)); list.appendChild(button);
    });
  });
}
function currentStepIndex(){ return state.scorer ? state.scorer.steps.findIndex((_,index)=>!state.scorer.stepComplete(index)) : -1; }
function setGuide(){
  if(!game?.setGuideTargets||!state.scorer)return;
  const index=currentStepIndex(); game.setGuideTargets(index>=0 ? state.scorer.steps[index].targets : []);
}
function renderStats(){
  if(!state.scorer)return;
  const progress=state.scorer.steps.filter((_,index)=>state.scorer.stepComplete(index)).length;
  if(progressEl)progressEl.textContent=progress+'/'+state.scorer.steps.length;
  if(scoreEl)scoreEl.textContent=state.scorer.score+' pts · '+Math.round(state.scorer.accuracy()*100)+'% · '+state.scorer.bestCombo+' best';
  if(levelEl&&state.lesson)levelEl.textContent='LEVEL '+state.lesson.level+' · '+state.lesson.levelName;
  const current=currentStepIndex();
  if(current!==state.lastStep){state.lastStep=current;setGuide();}
}
function setFeedback(text,detail=''){if(statusEl)statusEl.textContent=text;if(timingEl)timingEl.textContent=detail;}
function beginLesson(lesson){
  clearTimers(); state.lesson=lesson; state.scorer=new TimingScorer(lesson.steps,lesson.level===4?.36:lesson.level===3?.42:lesson.level===2?.48:.55); state.phase='demo'; state.lastStep=-1; state.lastFeedback='';
  if(stage)stage.hidden=false; if(list)list.hidden=true; if(stageName)stageName.textContent=lesson.name; setFeedback('Listen first…',lesson.description); renderStats(); runDemo();
}
function runDemo(){
  const beat=60/state.lesson.bpm,lead=beat*1.5; state.demoStart=performance.now()/1000+lead;
  state.lesson.steps.forEach((step)=>state.demoTimers.push(setTimeout(()=>step.targets.forEach((note)=>game?.strike(note,.72)),Math.max(0,(step.at*beat+lead)*1000))));
  const end=(Math.max(...state.lesson.steps.map((step)=>step.at))+1.5)*beat+lead; state.demoTimers.push(setTimeout(startPractice,end*1000));
}
function startPractice(){
  if(!state.lesson)return;
  state.demoTimers=[]; state.phase='practice'; const beat=60/state.lesson.bpm; state.practiceStart=performance.now()/1000+beat; state.lastStep=-1; setFeedback('Get ready…','Play with the pulse'); renderStats(); state.timer=setInterval(tick,40);
}
function tick(){
  if(state.phase!=='practice'||!state.lesson||!state.scorer)return;
  const elapsed=performance.now()/1000-state.practiceStart;
  if(elapsed<0){setFeedback('Get ready…',Math.max(0,Math.ceil(-elapsed*10)/10)+'');return;}
  const index=currentStepIndex();
  if(index<0){finishLesson();return;}
  const step=state.lesson.steps[index];
  if(elapsed>step.at+state.scorer.window){
    const missing=step.targets.length-state.scorer.stepHits[index].size;
    for(let i=0;i<missing;i++){state.scorer.misses+=1;state.scorer.combo=0;}
    state.scorer.lastFeedback='MISSED STEP'; setFeedback('Keep going','Next phrase'); state.lastStep=-1; renderStats();
  }
}
function noteHandler(event){
  if(state.phase!=='practice'||!state.scorer||!state.lesson)return;
  const elapsed=performance.now()/1000-state.practiceStart; if(elapsed<-state.scorer.window)return;
  const result=state.scorer.scoreNote(event.detail?.noteIndex,elapsed);
  if(result.correct){const timing=result.delta==null?'':(result.delta>=0?'+':'')+Math.round(result.delta*1000)+' ms';setFeedback(result.feedback,timing);if(navigator.vibrate)navigator.vibrate(result.feedback==='PERFECT'?10:6);}
  else setFeedback('MISS','Stay with the pulse');
  renderStats(); if(state.scorer.allComplete())finishLesson();
}
function finishLesson(){
  if(state.phase==='complete')return;
  clearTimers(); state.phase='complete'; game?.clearGuideTargets?.(); renderStats();
  openModal('Lesson complete',state.lesson.name+' · '+state.scorer.score+' points · '+Math.round(state.scorer.accuracy()*100)+'% accuracy · '+state.scorer.bestCombo+' best combo.');
}
function openModal(title,text){
  if(!modal)return; modal.hidden=false; if(modalTitle)modalTitle.textContent=title;if(modalText)modalText.textContent=text;
  if(modalActions){modalActions.innerHTML='';const retry=document.createElement('button');retry.type='button';retry.textContent='Again';retry.addEventListener('click',()=>{modal.hidden=true;beginLesson(state.lesson);});const back=document.createElement('button');back.type='button';back.textContent='Lessons';back.addEventListener('click',closeLesson);modalActions.append(retry,back);}
}
function closeLesson(){clearTimers();state.phase='picker';state.lesson=null;state.scorer=null;game?.clearGuideTargets?.();if(modal)modal.hidden=true;if(stage)stage.hidden=true;if(list)list.hidden=false;}
document.getElementById('learnClose')?.addEventListener('click',closeLesson);
document.getElementById('learnBack')?.addEventListener('click',closeLesson);
window.addEventListener('handpan:note',noteHandler);
window.HandpanLearn={open:()=>{panel?.classList.add('is-open');renderList();},close:closeLesson,lessons:LESSONS,state};
renderList();
