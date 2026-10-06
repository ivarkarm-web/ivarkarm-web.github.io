(function(){
'use strict';

var transport=window.HandpanTransport;
var game=window.HandpanGame;
var state={lesson:0,active:false,started:false,hits:0,misses:0,combo:0,bestCombo:0,sequence:[],next:0,armedAt:0,off:null,dueBeat:0,window:.42,notesAhead:4};
var lessons=[
 {name:'First Steps',speed:72,notes:[0,1,2,1,0,3,2,1]},
 {name:'Descending',speed:82,notes:[4,3,2,1,0,1,2,3]},
 {name:'Open Phrase',speed:90,notes:[0,2,4,3,1,3,5,4,2,0]}
];
var panel=document.getElementById('learnPanel'),nameEl=document.getElementById('learnName'),progressEl=document.getElementById('learnProgress'),scoreEl=document.getElementById('learnScore'),startBtn=document.getElementById('learnStart'),prevBtn=document.getElementById('learnPrev'),nextBtn=document.getElementById('learnNext'),lane=document.getElementById('learnLane'),message=document.getElementById('learnMessage');

function lesson(){return lessons[state.lesson]}
function render(){
 var l=lesson();if(nameEl)nameEl.textContent=l.name;if(progressEl)progressEl.textContent=(state.next+'/'+l.notes.length);if(scoreEl)scoreEl.textContent=state.hits+' hits · '+state.misses+' misses · '+state.combo+'×';
 if(lane){lane.innerHTML='';l.notes.forEach(function(n,i){var d=document.createElement('span');d.className='learn-note'+(i<state.next?' done':'')+(i===state.next?' current':'')+(i>state.next+state.notesAhead?' far':'');d.textContent=(game&&game.notes&&game.notes[n]?game.notes[n].name:'•');d.dataset.index=i;lane.appendChild(d)})}
}
function setMessage(t){if(message)message.textContent=t}
function load(){
 var l=lesson();transport.setBpm(l.speed);if(document.getElementById('loopTempo'))document.getElementById('loopTempo').value=l.speed;
 state.sequence=l.notes.slice();state.next=0;state.hits=0;state.misses=0;state.combo=0;state.bestCombo=0;state.started=false;render();setMessage('Press Start, then play the highlighted note.')
}
function start(){
 var l=lesson();transport.stop();transport.setBpm(l.speed);state.active=true;state.started=true;state.next=0;state.hits=0;state.misses=0;state.combo=0;state.bestCombo=0;state.armedAt=performance.now()/1000;state.dueBeat=0;
 transport.start(0);if(startBtn)startBtn.textContent='Restart';setMessage('Follow the highlighted notes.');render()
}
function stop(){state.active=false;transport.stop();if(startBtn)startBtn.textContent='Start';setMessage('Lesson paused.')}
function hit(e){
 if(!state.active)return;
 var l=lesson(),target=l.notes[state.next],index=e.noteIndex,nowBeat=transport.beatPosition(),delta=nowBeat-state.dueBeat,abs=Math.abs(delta);
 if(index===target && abs<=state.window/transport.beatDuration()){var grade=abs<0.12/transport.beatDuration()?'PERFECT':(delta<0?'EARLY':'GOOD');state.hits++;state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);state.next++;state.dueBeat+=1;setMessage(grade+' · '+state.combo+'×');render();if(state.next>=l.notes.length){state.active=false;transport.stop();if(startBtn)startBtn.textContent='Replay';}}
 else {state.misses++;state.combo=0;setMessage(index===target?(delta<0?'EARLY':'LATE')+' — try the next beat.':'MISS · follow the highlighted note.');render()}
}
function change(delta){state.lesson=(state.lesson+delta+lessons.length)%lessons.length;stop();load()}
startBtn&&startBtn.addEventListener('click',function(){state.active?start():start()});
prevBtn&&prevBtn.addEventListener('click',function(){change(-1)});
nextBtn&&nextBtn.addEventListener('click',function(){change(1)});
window.addEventListener('handpan:note',hit);
window.HandpanLearn={state:state,lessons:lessons,start:start,stop:stop,next:change};
load();
})();