(function(){
'use strict';

var transport=window.HandpanTransport;
var game=window.HandpanGame;
var state={lesson:0,active:false,started:false,hits:0,misses:0,combo:0,bestCombo:0,sequence:[],next:0,window:.42,leadBeats:4,feedback:'',feedbackUntil:0};
var lessons=[
 {name:'First Steps',speed:72,notes:[0,1,2,1,0,3,2,1]},
 {name:'Descending',speed:82,notes:[4,3,2,1,0,1,2,3]},
 {name:'Open Phrase',speed:90,notes:[0,2,4,3,1,3,5,4,2,0]}
];
var panel=document.getElementById('learnPanel'),nameEl=document.getElementById('learnName'),progressEl=document.getElementById('learnProgress'),scoreEl=document.getElementById('learnScore'),startBtn=document.getElementById('learnStart'),prevBtn=document.getElementById('learnPrev'),nextBtn=document.getElementById('learnNext'),lane=document.getElementById('learnLane'),message=document.getElementById('learnMessage');

function lesson(){return lessons[state.lesson]}
function noteName(i){return game&&game.notes&&game.notes[i]?game.notes[i].name:'•'}
function render(){
 var l=lesson();
 if(nameEl)nameEl.textContent=l.name;
 if(progressEl)progressEl.textContent=(Math.min(state.next,l.notes.length)+'/'+l.notes.length);
 if(scoreEl)scoreEl.textContent=state.hits+' hits · '+state.misses+' misses · '+state.combo+'×';
 if(lane){
   lane.innerHTML='';
   if(!state.started){renderIdle(l);return;}
   var now=transport.beatPosition();
   l.notes.forEach(function(n,i){
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
 l.notes.slice(0,4).forEach(function(n,i){var x=document.createElement('span');x.className='learn-note preview';x.textContent=noteName(n);x.style.left=(24+i*17)+'%';lane.appendChild(x)})
}
function setMessage(t){if(message)message.textContent=t}
function load(){
 var l=lesson();transport.stop();transport.setBpm(l.speed);state.sequence=l.notes.slice();state.next=0;state.hits=0;state.misses=0;state.combo=0;state.bestCombo=0;state.started=false;state.feedback='';render();setMessage('Press Start. Notes will travel toward the hit line.')
}
function start(){
 var l=lesson();transport.stop();transport.setBpm(l.speed);state.active=true;state.started=true;state.next=0;state.hits=0;state.misses=0;state.combo=0;state.bestCombo=0;state.feedback='';
 transport.start(0);if(startBtn)startBtn.textContent='Restart';setMessage('Follow the notes to the hit line.');render()
}
function stop(){state.active=false;transport.stop();if(startBtn)startBtn.textContent='Start';setMessage('Lesson paused.')}
function grade(text){state.feedback=text;state.feedbackUntil=performance.now()+700;setMessage(text+' · '+state.combo+'×')}
function hit(e){
 if(!state.active)return;
 var l=lesson(),target=l.notes[state.next],index=e.noteIndex,nowBeat=transport.beatPosition(),due=state.leadBeats+state.next,delta=nowBeat-due,abs=Math.abs(delta),windowBeats=state.window;
 if(index===target && abs<=windowBeats){
   var perfect=.12;
   var g=abs<=perfect?'PERFECT':(delta<0?'EARLY':'GOOD');
   state.hits++;state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);state.next++;grade(g);render();
   if(state.next>=l.notes.length){state.active=false;transport.stop();if(startBtn)startBtn.textContent='Replay';setMessage('LESSON COMPLETE · BEST '+state.bestCombo+'×')}
 } else {
   state.misses++;state.combo=0;grade(index===target?(delta<0?'EARLY':'LATE'):'MISS');render();
 }
}
function tick(){
 if(!state.active)return;
 var l=lesson(),now=transport.beatPosition(),due=state.leadBeats+state.next;
 if(state.next<l.notes.length && now>due+state.window){state.misses++;state.combo=0;grade('MISS');state.next++;render();if(state.next>=l.notes.length){state.active=false;transport.stop();if(startBtn)startBtn.textContent='Replay';setMessage('LESSON COMPLETE · BEST '+state.bestCombo+'×')}}
 if(state.feedbackUntil&&performance.now()>state.feedbackUntil)state.feedback='';
 render();
}
function change(delta){state.lesson=(state.lesson+delta+lessons.length)%lessons.length;stop();load()}
startBtn&&startBtn.addEventListener('click',start);prevBtn&&prevBtn.addEventListener('click',function(){change(-1)});nextBtn&&nextBtn.addEventListener('click',function(){change(1)});
window.addEventListener('handpan:note',hit);transport.onTick(tick);
window.HandpanLearn={state:state,lessons:lessons,start:start,stop:stop,next:change};load();
})();