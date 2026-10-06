(function(){
'use strict';
var game=window.HandpanGame;
var state={lesson:0,phase:'picker',active:false,playingDemo:false,next:0,hits:0,misses:0,combo:0,bestCombo:0,stepHits:{},timer:null,window:.42,userInteracted:false,demoRun:0};
var lessons=[
 {name:'First Steps',description:'A gentle four-note introduction.',speed:72,steps:[[0],[1],[2],[1],[0],[3],[2],[1]]},
 {name:'Descending',description:'Learn to move naturally down and back.',speed:82,steps:[[4],[3],[2],[1],[0],[1],[2],[3]]},
 {name:'Open Phrase',description:'Your first flowing phrase, including chords.',speed:90,steps:[[0],[2],[4],[3],[1,3],[3],[5],[4,2],[0]]}
];
var panel=document.getElementById('learnPanel'),list=document.getElementById('lessonList'),stage=document.getElementById('learnStage'),nameEl=document.getElementById('learnStageName'),progressEl=document.getElementById('learnProgress'),scoreEl=document.getElementById('learnScore'),statusEl=document.getElementById('learnStatus'),modal=document.getElementById('learnModal'),modalTitle=document.getElementById('learnModalTitle'),modalText=document.getElementById('learnModalText'),modalActions=document.getElementById('learnModalActions');

function noteName(i){return game&&game.notes&&game.notes[i]?game.notes[i].name:'•'}
function renderList(){
 if(!list)return;
 list.innerHTML='';
 lessons.forEach(function(l,i){
  var b=document.createElement('button');b.type='button';b.className='lesson-card';
  b.innerHTML='<span class="lesson-index">0'+(i+1)+'</span><span class="lesson-copy"><strong>'+l.name+'</strong><small>'+l.description+'</small></span><span class="lesson-arrow">→</span>';
  b.addEventListener('click',function(){selectLesson(i)});
  list.appendChild(b);
 });
}
function openPicker(){state.phase='picker';state.active=false;state.playingDemo=false;state.userInteracted=false;state.demoRun++;if(state.timer)clearTimeout(state.timer);clearGuide();document.body.classList.remove('learn-active');if(stage)stage.hidden=true;if(list)list.hidden=false;hideModal();renderList();}
function selectLesson(i){
 state.lesson=i;state.phase='demo';state.active=false;state.userInteracted=false;state.next=0;state.hits=0;state.misses=0;state.combo=0;state.bestCombo=0;state.stepHits={};state.demoRun++;
 if(list)list.hidden=true;if(stage)stage.hidden=false;document.body.classList.add('learn-active');
 nameEl.textContent=lessons[i].name; statusEl.textContent='Listen first…'; renderStats(); playDemo();
}
function renderStats(){if(progressEl)progressEl.textContent=Math.min(state.next,lessons[state.lesson].steps.length)+'/'+lessons[state.lesson].steps.length;if(scoreEl)scoreEl.textContent=state.hits+' hits · '+state.misses+' misses';}
function guide(indices){if(game&&game.setGuideTargets)game.setGuideTargets(indices)}
function clearGuide(){if(game&&game.clearGuideTargets)game.clearGuideTargets()}
function playDemo(){
 var l=lessons[state.lesson],beat=60000/l.speed,run=state.demoRun;
 clearGuide(); state.playingDemo=true; state.phase='demo'; state.next=0;
 statusEl.textContent='Listen to the melody…';
 var i=0;
 function next(){
  if(run!==state.demoRun)return;
  if(i>=l.steps.length){state.playingDemo=false;state.phase='repeat';state.active=true;state.userInteracted=false;state.next=0;state.stepHits={};statusEl.textContent='Your turn — repeat what you heard.';guide(l.steps[0]);renderStats();return;}
  var notes=l.steps[i];guide(notes);
  notes.forEach(function(n,j){setTimeout(function(){if(run===state.demoRun&&state.playingDemo&&game&&game.strike)game.strike(n,.72)},j*45)});
  i++;state.next=i;renderStats();state.timer=setTimeout(next,beat);
 }
 next();
}
function showModal(kind){
 if(!modal)return;
 modal.hidden=false;
 if(kind==='fail'){
  modalTitle.textContent='Try again';
  modalText.textContent='That phrase broke. Listen once more, then play it back on the handpan.';
  modalActions.innerHTML='';
  addAction('Try again',function(){hideModal();playDemo();});
  addAction('Close',function(){hideModal();openPicker();});
 }else{
  modalTitle.textContent='Great job';
  modalText.textContent='You completed '+lessons[state.lesson].name+'.';
  modalActions.innerHTML='';
  if(state.lesson<lessons.length-1)addAction('Next lesson',function(){hideModal();selectLesson(state.lesson+1);});
  addAction('Back',function(){hideModal();openPicker();});
 }
}
function addAction(label,fn){var b=document.createElement('button');b.type='button';b.textContent=label;b.className='learn-modal-btn'+(label==='Next lesson'?' is-primary':'');b.addEventListener('click',fn);modalActions.appendChild(b);}
function hideModal(){if(modal)modal.hidden=true;}
function finish(success){
 state.active=false;clearGuide();if(success){state.phase='complete';showModal('success');}else{state.phase='failed';showModal('fail');}
}
function startRepeat(){
 var l=lessons[state.lesson];state.phase='repeat';state.active=true;state.next=0;state.stepHits={};state.hits=0;state.misses=0;state.combo=0;statusEl.textContent='Your turn — repeat the melody.';guide(l.steps[0]);renderStats();
}
function hit(e){
 if(!state.active||state.playingDemo||state.phase!=='repeat')return;
 state.userInteracted=true;
 var targets=lessons[state.lesson].steps[state.next],idx=e.noteIndex;
 if(targets.indexOf(idx)!==-1){
  state.stepHits[idx]=true;
  if(targets.every(function(n){return state.stepHits[n]})){
   state.hits++;state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);state.next++;state.stepHits={};
   if(state.next>=lessons[state.lesson].steps.length){renderStats();finish(true);return;}
   guide(lessons[state.lesson].steps[state.next]);renderStats();
  }
 }else{state.misses++;state.combo=0;renderStats();finish(false);}
}
function init(){
 renderList();
 document.getElementById('learnClose').addEventListener('click',openPicker);
 document.getElementById('learnBack').addEventListener('click',openPicker);
 window.addEventListener('handpan:note',hit);
}
window.HandpanLearn={lessons:lessons,open:openPicker,select:selectLesson};
init();
})();