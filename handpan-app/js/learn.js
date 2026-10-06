(function(){
'use strict';

var transport=window.HandpanTransport;
var game=window.HandpanGame;
var state={lesson:0,active:false,started:false,hits:0,misses:0,combo:0,bestCombo:0,sequence:[],next:0,window:.42,leadBeats:4,feedback:'',feedbackUntil:0};
var lessons=[
 {name:'First Steps',speed:72,steps:[[0],[1],[2],[1],[0],[3],[2],[1]]},
 {name:'Descending',speed:82,steps:[[4],[3],[2],[1],[0],[1],[2],[3]]},
 {name:'Open Phrase',speed:90,steps:[[0],[2],[4],[3],[1,3],[3],[5],[4,2],[0]]}
];
var panel=document.getElementById('learnPanel'),nameEl=document.getElementById('learnName'),progressEl=document.getElementById('learnProgress'),scoreEl=document.getElementById('learnScore'),startBtn=document.getElementById('learnStart'),prevBtn=document.getElementById('learnPrev'),nextBtn=document.getElementById('learnNext'),lane=document.getElementById('learnLane'),message=document.getElementById('learnMessage');

function lesson(){return lessons[state.lesson]}
function noteName(i){return game&&game.notes&&game.notes[i]?game.notes[i].name:'•'}
function step(){return lesson().steps[state.next]||[]}
function allTargets(){return step().slice()}
function guide(){if(game&&game.setGuideTargets)game.setGuideTargets(allTargets())}
function clearGuide(){if(game&&game.clearGuideTargets)game.clearGuideTargets()}
function render(){
 var l=lesson();
 if(nameEl)nameEl.textContent=l.name;
 if(progressEl)progressEl.textContent=(Math.min(state.next,l.steps.length)+'/'+l.notes.length);
 if(scoreEl)scoreEl.textContent=state.hits+' hits · '+state.misses+' misses · '+state.combo+'×';
 if(lane){
   lane.innerHTML='';
   if(!state.started){renderIdle(l);return;}
   var now=transport.beatPosition();
   l.steps.forEach(function(stepNotes,i){
     var n=stepNotes[0];
     var due=state.leadBeats+i;
     var distance=due-now;
     if(distance<-.75||distance>state.leadBeats+.5)return;
     var d=document.createElement('span');
     d.className='learn-note'+(i<state.next?' done':'')+(i===state.next?' current':'');
     d.textContent=noteName(n);d.dataset.index=i;
     d.style.setProperty('--note-progress',Math.max(0,Math.min(1,1-distance/state.leadBeats)));
     var progress=Math.max(0,Math.min(1,1-distance/state.leadBeats));
     d.style.left=(10+progress*90)+'%';
     lane.appendChild(d);
   });
 }
}
function renderIdle(l){
 var d=document.createElement('span');d.className='learn-note current';d.textContent='START';d.style.left='8%';lane.appendChild(d);
 l.steps.slice(0,4).forEach(function(stepNotes,i){var x=document.createElement('span');x.className='learn-note preview';x.textContent=stepNotes.map(noteName).join(' + ');x.style.left=(24+i*17)+'%';lane.appendChild(x)})
}
function setMessage(t){if(message)message.textContent=t}
function load(){
 var l=lesson();transport.stop();transport.setBpm(l.speed);state.sequence=l.steps.map(function(s){return s.slice();});state.next=0;state.hits=0;state._stepHits={};state.misses=0;state.combo=0;state.bestCombo=0;state.started=false;state.feedback='';render();clearGuide();setMessage('Press Start. The next note will slowly glow on the handpan.')
}
function start(){
 var l=lesson();transport.stop();transport.setBpm(l.speed);state.active=true;state.started=true;state.next=0;state.hits=0;state.misses=0;state.combo=0;state.bestCombo=0;state.feedback='';
 transport.start(0);guide();if(startBtn)startBtn.textContent='Restart';setMessage('Follow the notes to the hit line.');render()
}
function stop(){state.active=false;transport.stop();clearGuide();if(startBtn)startBtn.textContent='Start';setMessage('Lesson paused.')}
function grade(text){state.feedback=text;state.feedbackUntil=performance.now()+700;setMessage(text+' · '+state.combo+'×')}
function hit(e){
 if(!state.active)return;
 var l=lesson(),targets=step(),index=e.noteIndex,nowBeat=transport.beatPosition(),due=state.leadBeats+state.next,delta=nowBeat-due,abs=Math.abs(delta),windowBeats=state.window;
 if(targets.indexOf(index)!==-1 && abs<=windowBeats){
   state._stepHits=state._stepHits||{};
   state._stepHits[index]=true;
   var complete=targets.every(function(idx){return state._stepHits[idx];});
   if(complete){
     var perfect=.12;
     var g=abs<=perfect?'PERFECT':(delta<0?'EARLY':'GOOD');
     state.hits++;state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);
     state.next++;state._stepHits={};grade(targets.length>1?'CHORD · '+g:g);render();
     if(state.next>=l.steps.length){
       state.active=false;transport.stop();clearGuide();if(startBtn)startBtn.textContent='Replay';setMessage('LESSON COMPLETE · BEST '+state.bestCombo+'×');
     } else { guide(); }
   } else {
     grade(targets.length>1?'CHORD · '+Object.keys(state._stepHits).length+'/'+targets.length:'GOOD');
     render();
   }
 } else {
   state.misses++;state.combo=0;grade(index===targets[0]?(delta<0?'EARLY':'LATE'):'MISS');render();
 }
}
function tick(){
 if(!state.active)return;
 var l=lesson(),now=transport.beatPosition(),due=state.leadBeats+state.next;
 if(state.next<l.steps.length && now>due+state.window){state.misses++;state.combo=0;grade('MISS');state.next++;render();if(state.next>=l.steps.length){state.active=false;transport.stop();if(startBtn)startBtn.textContent='Replay';setMessage('LESSON COMPLETE · BEST '+state.bestCombo+'×')}}
 if(state.feedbackUntil&&performance.now()>state.feedbackUntil)state.feedback='';
 render();
}
function change(delta){state.lesson=(state.lesson+delta+lessons.length)%lessons.length;stop();load()}
startBtn&&startBtn.addEventListener('click',start);prevBtn&&prevBtn.addEventListener('click',function(){change(-1)});nextBtn&&nextBtn.addEventListener('click',function(){change(1)});
window.addEventListener('handpan:note',hit);transport.onTick(tick);
window.HandpanLearn={state:state,lessons:lessons,start:start,stop:stop,next:change};load();
})();