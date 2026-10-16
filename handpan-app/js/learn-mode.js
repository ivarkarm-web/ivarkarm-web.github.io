/* Pionier Learn — shared-clock phrase playback and Catch the Note practice.
   Phrase events are editable scale-degree fixtures, not claimed audio transcriptions. */
// Public-domain/traditional melody studies. These are newly authored scale-degree
// arrangements for Pionier's pads, not copied recordings or modern arrangements.
const SONG_LIBRARY = [
  {
    "id": "ode-to-joy",
    "title": "Ode to Joy",
    "description": "Beethoven · public-domain composition",
    "seq": [
      2,
      2,
      3,
      4,
      4,
      3,
      2,
      1,
      0,
      0,
      1,
      2,
      2,
      1,
      1,
      2,
      2,
      3,
      4,
      4,
      3,
      2,
      1,
      0,
      0,
      1,
      2,
      1,
      0,
      0
    ]
  },
  {
    "id": "frere-jacques",
    "title": "Frère Jacques",
    "description": "Traditional · public-domain melody",
    "seq": [
      0,
      1,
      2,
      0,
      0,
      1,
      2,
      0,
      2,
      3,
      4,
      2,
      3,
      4,
      4,
      5,
      4,
      3,
      2,
      0,
      4,
      5,
      4,
      3,
      2,
      0
    ]
  },
  {
    "id": "twinkle-star",
    "title": "Twinkle, Twinkle",
    "description": "Traditional · public-domain melody",
    "seq": [
      0,
      0,
      4,
      4,
      5,
      5,
      4,
      3,
      3,
      2,
      2,
      1,
      1,
      0,
      4,
      4,
      3,
      3,
      2,
      2,
      1,
      4,
      4,
      3,
      3,
      2,
      2,
      1,
      0,
      0,
      4,
      4,
      5,
      5,
      4,
      3,
      3,
      2,
      2,
      1,
      1,
      0
    ]
  },
  {
    "id": "mary-lamb",
    "title": "Mary Had a Little Lamb",
    "description": "Traditional · public-domain melody",
    "seq": [
      2,
      1,
      0,
      1,
      2,
      2,
      2,
      1,
      1,
      1,
      2,
      4,
      4,
      2,
      1,
      0,
      1,
      2,
      2,
      2,
      2,
      1,
      1,
      2,
      1,
      0
    ]
  },
  {
    "id": "row-row-boat",
    "title": "Row, Row, Row Your Boat",
    "description": "Traditional · public-domain melody",
    "seq": [
      0,
      0,
      0,
      1,
      2,
      2,
      1,
      2,
      3,
      4,
      7,
      7,
      7,
      4,
      4,
      4,
      2,
      2,
      2,
      0,
      0,
      0,
      4,
      3,
      2,
      1,
      0
    ]
  },
  {
    "id": "london-bridge",
    "title": "London Bridge Is Falling Down",
    "description": "Traditional · public-domain melody",
    "seq": [
      2,
      3,
      2,
      1,
      0,
      1,
      2,
      2,
      3,
      2,
      1,
      0,
      1,
      2,
      1,
      0,
      1,
      2,
      3,
      2,
      1,
      0
    ]
  },
  {
    "id": "old-macdonald",
    "title": "Old MacDonald Had a Farm",
    "description": "Traditional · public-domain melody",
    "seq": [
      0,
      0,
      0,
      4,
      4,
      4,
      2,
      2,
      2,
      0,
      0,
      0,
      7,
      7,
      4,
      4,
      2,
      2,
      0,
      0,
      0
    ]
  },
  {
    "id": "amazing-grace",
    "title": "Amazing Grace",
    "description": "Traditional hymn · public-domain melody",
    "seq": [
      0,
      3,
      5,
      3,
      5,
      4,
      2,
      0,
      3,
      2,
      0,
      7,
      5,
      3,
      5,
      3,
      5,
      4,
      2,
      0
    ]
  },
  {
    "id": "greensleeves",
    "title": "Greensleeves",
    "description": "Traditional · public-domain melody",
    "seq": [
      2,
      5,
      6,
      7,
      5,
      4,
      2,
      0,
      1,
      2,
      3,
      4,
      5,
      3,
      3,
      2,
      1,
      0,
      1,
      2,
      3,
      2,
      1,
      0
    ]
  },
  {
    "id": "scarborough-fair",
    "title": "Scarborough Fair",
    "description": "Traditional · public-domain melody",
    "seq": [
      2,
      5,
      5,
      6,
      7,
      6,
      5,
      4,
      2,
      4,
      5,
      4,
      2,
      0,
      2,
      4,
      5,
      6,
      5,
      4,
      2,
      0
    ]
  },
  {
    "id": "when-saints",
    "title": "When the Saints Go Marching In",
    "description": "Traditional · public-domain melody",
    "seq": [
      0,
      2,
      3,
      4,
      0,
      2,
      3,
      4,
      0,
      2,
      3,
      4,
      2,
      1,
      2,
      1,
      0,
      0,
      2,
      1,
      0,
      7,
      0
    ]
  },
  {
    "id": "oh-susanna",
    "title": "Oh! Susanna",
    "description": "Stephen Foster · public-domain composition",
    "seq": [
      2,
      2,
      3,
      4,
      4,
      3,
      2,
      0,
      2,
      2,
      1,
      0,
      0,
      1,
      2,
      2,
      2,
      2,
      3,
      4,
      4,
      3,
      2,
      0
    ]
  },
  {
    "id": "yankee-doodle",
    "title": "Yankee Doodle",
    "description": "Traditional · public-domain melody",
    "seq": [
      0,
      0,
      2,
      0,
      1,
      2,
      0,
      0,
      0,
      2,
      3,
      4,
      5,
      5,
      3,
      4,
      5,
      4,
      2,
      0
    ]
  },
  {
    "id": "jingle-bells",
    "title": "Jingle Bells",
    "description": "James Lord Pierpont · public-domain composition",
    "seq": [
      2,
      2,
      2,
      2,
      2,
      2,
      2,
      4,
      0,
      1,
      2,
      3,
      3,
      3,
      3,
      3,
      2,
      2,
      2,
      2,
      2,
      1,
      1,
      2,
      1,
      4
    ]
  },
  {
    "id": "silent-night",
    "title": "Silent Night",
    "description": "Franz Xaver Gruber · public-domain composition",
    "seq": [
      4,
      5,
      4,
      2,
      4,
      5,
      4,
      2,
      1,
      1,
      6,
      5,
      3,
      3,
      4,
      2,
      5,
      4,
      2,
      5,
      4,
      2
    ]
  },
  {
    "id": "auld-lang-syne",
    "title": "Auld Lang Syne",
    "description": "Traditional · public-domain melody",
    "seq": [
      0,
      4,
      4,
      4,
      5,
      4,
      5,
      7,
      7,
      5,
      5,
      4,
      4,
      0,
      0,
      7,
      5,
      5,
      4,
      4,
      2,
      0
    ]
  },
  {
    "id": "au-clair",
    "title": "Au clair de la lune",
    "description": "Traditional French · public-domain melody",
    "seq": [
      0,
      0,
      0,
      1,
      2,
      1,
      0,
      2,
      0,
      1,
      0,
      0,
      0,
      0,
      0,
      1,
      2,
      1,
      0,
      2,
      0,
      1,
      0
    ]
  },
  {
    "id": "brahms-lullaby",
    "title": "Brahms’ Lullaby",
    "description": "Johannes Brahms · public-domain composition",
    "seq": [
      0,
      0,
      4,
      4,
      5,
      5,
      4,
      3,
      3,
      2,
      2,
      1,
      1,
      0,
      0,
      4,
      4,
      5,
      5,
      4,
      3,
      3,
      2,
      2,
      1,
      1,
      0
    ]
  },
  {
    "id": "canon-d",
    "title": "Canon in D",
    "description": "Johann Pachelbel · public-domain composition",
    "seq": [
      4,
      2,
      3,
      0,
      1,
      0,
      1,
      2,
      3,
      2,
      1,
      0,
      4,
      2,
      3,
      0,
      1,
      0,
      1,
      2,
      3,
      2,
      1,
      0
    ]
  },
  {
    "id": "minuet-g",
    "title": "Minuet in G",
    "description": "Christian Petzold · public-domain composition",
    "seq": [
      4,
      0,
      1,
      2,
      3,
      4,
      0,
      0,
      5,
      6,
      7,
      0,
      1,
      2,
      3,
      4,
      0,
      0,
      4,
      5,
      4,
      3,
      2,
      1,
      2,
      3,
      2,
      1,
      0
    ]
  },
  {
    "id": "turkish-march",
    "title": "Turkish March",
    "description": "W. A. Mozart · public-domain composition",
    "seq": [
      4,
      3,
      4,
      3,
      4,
      0,
      2,
      1,
      4,
      3,
      2,
      0,
      1,
      2,
      3,
      4,
      5,
      4,
      3,
      2,
      4,
      3,
      4,
      3,
      4,
      0,
      2,
      1,
      4,
      3,
      2,
      0
    ]
  },
  {
    "id": "fur-elise",
    "title": "Für Elise (theme)",
    "description": "Ludwig van Beethoven · public-domain composition",
    "seq": [
      2,
      1,
      2,
      1,
      2,
      7,
      1,
      0,
      5,
      0,
      2,
      5,
      7,
      2,
      4,
      7,
      0,
      2,
      4,
      5,
      2,
      3,
      5,
      7,
      1,
      2,
      3,
      4
    ]
  },
  {
    "id": "ode-to-spring",
    "title": "Spring (theme)",
    "description": "Antonio Vivaldi · public-domain composition",
    "seq": [
      4,
      4,
      4,
      3,
      2,
      1,
      0,
      0,
      0,
      1,
      2,
      2,
      2,
      3,
      4,
      4,
      4,
      4,
      3,
      2,
      1,
      0,
      0,
      0
    ]
  },
  {
    "id": "swan-lake",
    "title": "Swan Lake (theme)",
    "description": "Pyotr Ilyich Tchaikovsky · public-domain composition",
    "seq": [
      4,
      3,
      2,
      1,
      0,
      1,
      2,
      3,
      4,
      4,
      3,
      2,
      1,
      0,
      1,
      2,
      3,
      2,
      1,
      0
    ]
  },
  {
    "id": "morning-mood",
    "title": "Morning Mood",
    "description": "Edvard Grieg · public-domain composition",
    "seq": [
      0,
      2,
      4,
      5,
      4,
      2,
      0,
      2,
      4,
      5,
      7,
      5,
      4,
      2,
      0,
      2,
      4,
      5,
      4,
      2,
      0
    ]
  },
  {
    "id": "sugar-plum",
    "title": "Dance of the Sugar Plum Fairy",
    "description": "Pyotr Ilyich Tchaikovsky · public-domain composition",
    "seq": [
      5,
      4,
      2,
      4,
      5,
      7,
      5,
      4,
      2,
      1,
      2,
      4,
      5,
      4,
      2,
      4,
      5,
      7,
      5,
      4,
      2,
      0
    ]
  },
  {
    "id": "william-tell",
    "title": "William Tell Overture (theme)",
    "description": "Gioachino Rossini · public-domain composition",
    "seq": [
      0,
      0,
      0,
      0,
      2,
      4,
      0,
      0,
      0,
      0,
      2,
      4,
      5,
      5,
      5,
      5,
      4,
      4,
      4,
      4,
      2,
      2,
      2,
      2,
      0
    ]
  },
  {
    "id": "habanera",
    "title": "Habanera (Carmen)",
    "description": "Georges Bizet · public-domain composition",
    "seq": [
      4,
      3,
      2,
      1,
      0,
      1,
      2,
      3,
      4,
      3,
      2,
      1,
      0,
      2,
      4,
      3,
      2,
      1,
      0,
      1,
      2,
      3
    ]
  },
  {
    "id": "house-rising-sun",
    "title": "House of the Rising Sun",
    "description": "Traditional folk song · public-domain status varies by jurisdiction",
    "seq": [
      0,
      2,
      4,
      5,
      4,
      2,
      0,
      2,
      3,
      5,
      4,
      3,
      2,
      0,
      2,
      4,
      5,
      4,
      2,
      0
    ]
  },
  {
    "id": "sakura",
    "title": "Sakura Sakura",
    "description": "Traditional Japanese folk song · traditional melody",
    "seq": [
      4,
      4,
      5,
      4,
      4,
      5,
      4,
      5,
      7,
      0,
      7,
      5,
      4,
      2,
      4,
      5,
      4,
      2,
      0
    ]
  },
  {
    "id": "beethoven-fifth",
    "title": "Symphony No. 5 (opening motif)",
    "description": "Ludwig van Beethoven · public-domain composition",
    "seq": [
      2,
      2,
      2,
      0,
      1,
      1,
      1,
      7,
      2,
      2,
      2,
      0,
      1,
      1,
      1,
      7
    ]
  }
].map(song => ({
  id:song.id, title:song.title, description:song.description + ' · simplified scale-degree lesson', bpm:76,
  events:song.seq.map((pad,i)=>({pad:Math.min(8,pad),at:1400+i*850+(i>0 && i%4===0?250:0)}))
}));

const LESSONS = [
  { id:'scale-up-down', title:'Scale Up & Down', description:'Follow the notes from the lowest pad to the highest, then return home.', bpm:96, events:[
    {pad:0,at:1600},{pad:1,at:2700},{pad:2,at:3800},{pad:3,at:4900},
    {pad:4,at:6000},{pad:5,at:7100},{pad:6,at:8200},{pad:7,at:9300},
    {pad:8,at:10400},{pad:7,at:11500},{pad:6,at:12600},{pad:5,at:13700},
    {pad:4,at:14800},{pad:3,at:15900},{pad:2,at:17000},{pad:1,at:18100},
    {pad:0,at:19200}
  ]},
  { id:'two-note-chords', title:'Two-Note Chords', description:'Use two fingers together. Strike both glowing notes within the timing window to catch each chord.', bpm:96, events:[
    {pads:[0,2],at:1600},{pads:[1,3],at:3000},{pads:[2,4],at:4400},
    {pads:[3,5],at:5800},{pads:[4,6],at:7200},{pads:[5,7],at:8600},
    {pads:[6,8],at:10000},{pads:[5,7],at:11400},{pads:[4,6],at:12800},
    {pads:[3,5],at:14200},{pads:[2,4],at:15600},{pads:[1,3],at:17000},
    {pads:[0,2],at:18400}
  ]},
  ...SONG_LIBRARY,
  { id:'flow-pygmy-tine-piano', title:'Flow Pygmy → Tine Piano', description:'First select Flow Pygmy in the scale menu, then choose Tine Piano in the instrument menu. Once both are selected, follow the ripples from the lowest note to the sixth and back three times.', bpm:96, setup:true, events:[
    {pad:0,at:1400},{pad:1,at:2500},{pad:2,at:3600},{pad:3,at:4700},{pad:4,at:5800},{pad:5,at:6900},{pad:4,at:8000},{pad:3,at:9100},{pad:2,at:10200},{pad:1,at:11300},{pad:0,at:12400},
    {pad:0,at:13500},{pad:1,at:14600},{pad:2,at:15700},{pad:3,at:16800},{pad:4,at:17900},{pad:5,at:19000},{pad:4,at:20100},{pad:3,at:21200},{pad:2,at:22300},{pad:1,at:23400},{pad:0,at:24500},
    {pad:0,at:25600},{pad:1,at:26700},{pad:2,at:27800},{pad:3,at:28900},{pad:4,at:30000},{pad:5,at:31100},{pad:4,at:32200},{pad:3,at:33300},{pad:2,at:34400},{pad:1,at:35500},{pad:0,at:36600}
  ]}
];
const APPROACH_MS=620, WINDOW_MS=180, TAIL_MS=90;
export function mountLearnMode(){
  const button=document.getElementById('openLearn'), panel=document.getElementById('learnPanel'), close=document.getElementById('learnClose');
  const canvas=document.getElementById('pan'), list=document.getElementById('learnLessonList');
  const controls=document.getElementById('learnRunControls'), progress=document.getElementById('learnProgress');
  const heading=document.getElementById('learnHeading'), description=document.getElementById('learnDescription');
  const listenBtn=document.getElementById('learnListen'), catchBtn=document.getElementById('learnCatch'), transposeBtn=document.getElementById('learnTranspose'), startBtn=document.getElementById('learnStart');
  if(!button||!panel||!canvas||!list||button.dataset.learnEngineMounted==='1')return false;
  button.dataset.learnEngineMounted='1';
  const overlay=document.createElement('canvas'); overlay.id='learnRippleOverlay';
  const stage=canvas.parentElement;
  stage?.appendChild(overlay);
  const ctx=overlay.getContext('2d');
  let stageWidth=680,stageHeight=680;
  function syncOverlay(){const r=stage.getBoundingClientRect();stageWidth=Math.max(1,Math.round(r.width));stageHeight=Math.max(1,Math.round(r.height));overlay.width=stageWidth;overlay.height=stageHeight;overlay.style.left='0px';overlay.style.top='0px';overlay.style.width=stageWidth+'px';overlay.style.height=stageHeight+'px';}
  let running=false, lesson=null, lessonIndex=0, mode='practice', startAt=0, index=0, raf=0, hitCount=0, missCount=0;
  let ringState=null, done=false, transposeSteps=0, sounded=new Set(), countdownUntil=0, hud=null, hudLabel=null;
  function show(){panel.hidden=false;document.body.classList.add('learn-active')}
  function setSetupTarget(step){
    const scaleButton=document.getElementById('scaleLabel');
    const instrumentButton=document.getElementById('instrumentDropdownToggle');
    scaleButton?.classList.toggle('learn-step-target',step==='scale');
    instrumentButton?.classList.toggle('learn-step-target',step==='instrument');
    scaleButton?.setAttribute('aria-description',step==='scale'?'Lesson hint: choose Flow Pygmy':'');
    instrumentButton?.setAttribute('aria-description',step==='instrument'?'Lesson hint: choose Tine Piano':'');
  }
  function clearSetupTarget(){setSetupTarget('');}
  function ensureHud(){if(hud)return;hud=document.createElement('div');hud.id='learnGameHud';hud.innerHTML='<span id="learnHudLabel">COUNTDOWN</span><button type="button" data-action="restart">Restart</button><button type="button" data-action="menu">Lessons</button><button type="button" data-action="close" aria-label="Close lesson">×</button>';document.body.appendChild(hud);hudLabel=hud.querySelector('#learnHudLabel');hud.addEventListener('click',e=>{const a=e.target?.dataset?.action;if(a==='restart')begin(lessonIndex,mode);if(a==='menu'){hud.hidden=true;show();menu()}if(a==='close')hide()});}
  function setHud(text){ensureHud();hudLabel.textContent=text;hud.dataset.cue=text==='PLAY NOW'?'play':'';hud.hidden=false}
  function hideHud(){if(hud)hud.hidden=true}
  function hide(){panel.hidden=true;stop();hideHud();document.body.classList.remove('learn-active')}
  function stop(){running=false;done=false;ringState=null;sounded.clear();countdownUntil=0;clearSetupTarget();cancelAnimationFrame(raf);ctx.clearRect(0,0,stageWidth,stageHeight);overlay.style.display='none';hideHud();}
  function menu(){stop();list.hidden=false;controls.hidden=true;heading.textContent='Catch the Note';description.textContent='Choose a lesson, then press Start when you are ready. Follow the incoming wave and play when the target glows.';if(startBtn)startBtn.hidden=false;if(listenBtn)listenBtn.hidden=true;if(catchBtn)catchBtn.hidden=true;if(transposeBtn)transposeBtn.hidden=false;if(document.getElementById('learnRestart'))document.getElementById('learnRestart').hidden=true;}
  function targetPads(ev){const fields=window.PionierCore?.surface?.fields||[];const count=fields.length||9;return (ev.pads||[ev.pad]).map(p=>((Number(p)+transposeSteps)%count+count)%count)}
  function targetField(pad){const fields=window.PionierCore?.surface?.fields||[];return fields.find(f=>Number(f.index)===Number(pad))||fields[pad]||null}
  function overlayPoint(field){const m=window.PionierCore?.surface?.metrics||{};const w=m.W||800,h=m.H||800;const c=canvas.getBoundingClientRect(),s=stage.getBoundingClientRect();return{x:c.left-s.left+field.x*((canvas.getBoundingClientRect().width/((window.PionierCore?.surface?.metrics||{}).W||800))),y:c.top-s.top+field.y*((canvas.getBoundingClientRect().height/((window.PionierCore?.surface?.metrics||{}).H||800)))}}
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
    stop();lessonIndex=i;lesson=LESSONS[i];mode=nextMode;index=0;hitCount=0;missCount=0;done=false;running=true;startAt=performance.now();ringState=null;sounded.clear();
    transposeSteps=Number(lesson.transpose||0);
    list.hidden=true;controls.hidden=false;heading.textContent=lesson.title;description.textContent=lesson.description;
    if(transposeBtn)transposeBtn.textContent='Transpose: '+(transposeSteps===0?'Original':('+'+transposeSteps+' scale degrees'));
    if(startBtn)startBtn.textContent=lesson.setup?'Begin setup':'Start lesson';
    if(listenBtn)listenBtn.hidden=true;
    if(catchBtn)catchBtn.hidden=true;
    if(startBtn)startBtn.hidden=true;
    if(transposeBtn)transposeBtn.hidden=false;
    if(document.getElementById('learnRestart'))document.getElementById('learnRestart').hidden=false;
    syncOverlay();overlay.style.display='block';panel.hidden=true;ensureHud();countdownUntil=performance.now()+3000;startAt=countdownUntil;setHud(mode==='listen'?'LISTENING':'GET READY');progress.textContent='GET READY';drawFrame();
  }
  function drawFrame(){
    if(!running&&!ringState){ctx.clearRect(0,0,stageWidth,stageHeight);return}
    const now=performance.now(),elapsed=now-startAt;ctx.clearRect(0,0,stageWidth,stageHeight);
    if(now<countdownUntil){const n=Math.max(1,Math.ceil((countdownUntil-now)/1000));setHud('GET READY · '+n);progress.textContent='GET READY · '+n;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.beginPath();ctx.arc(stageWidth/2,stageHeight/2,24,0,Math.PI*2);ctx.fillStyle='rgba(10,10,12,.72)';ctx.fill();ctx.strokeStyle='rgba(212,176,74,.56)';ctx.lineWidth=1;ctx.stroke();ctx.font='500 18px Inter, sans-serif';ctx.fillStyle='rgba(243,212,122,.94)';ctx.fillText(String(n),stageWidth/2,stageHeight/2+.5);ctx.restore();raf=requestAnimationFrame(drawFrame);return;}else if(countdownUntil){countdownUntil=0;setHud(mode==='listen'?'LISTENING':'FOLLOW THE WAVE');}
    if(running&&mode==='setup'){
      const core=window.PionierCore;
      const scale=window.HANDPAN_SCALES?.[core?.handpan?.scaleIndex];
      const scaleReady=scale?.id==='flowpygmy';
      const instrumentReady=core?.activeInstrument?.()?.id==='tine';
      if(!scaleReady){setSetupTarget('scale');setHud('STEP 1 · TAP SCALE');progress.textContent='TAP THE SCALE CONTROL · CHOOSE FLOW PYGMY';}
      else if(!instrumentReady){setSetupTarget('instrument');setHud('STEP 2 · TAP INSTRUMENT');progress.textContent='TAP THE INSTRUMENT NAME · CHOOSE TINE PIANO';}
      else{
        clearSetupTarget();mode='practice';index=0;hitCount=0;missCount=0;ringState=null;
        startAt=now+2400;countdownUntil=startAt;setHud('SETUP COMPLETE · GET READY');progress.textContent='FLOW PYGMY + TINE PIANO READY';
      }
      raf=requestAnimationFrame(drawFrame);return;
    }
    if(running&&index<lesson.events.length){
      const ev=lesson.events[index],pads=targetPads(ev),pad=pads[0],spawnAt=ev.at-APPROACH_MS;
      if(elapsed>=spawnAt&&!ringState)ringState={event:ev,pad,pads,spawnAt,state:'approach',changedAt:0,caughtPads:[]};
      if(mode==='practice'&&ringState?.state==='approach'&&elapsed>=ev.at){ringState.state='arrive';ringState.changedAt=now;setHud('PLAY NOW');progress.textContent='PLAY NOW · HIT THE GLOWING NOTE';}
      if(mode==='listen'&&elapsed>=ev.at&&!sounded.has(index)){
        sounded.add(index);targetPads(ev).forEach(p=>strikePad(p,.66));ringState={event:ev,pad,pads:targetPads(ev),state:'hit',changedAt:now};index++;
      }else if(mode==='practice'&&['approach','arrive'].includes(ringState?.state)&&elapsed>ev.at+WINDOW_MS){markMiss(now);index++}
    }else if(running&&index>=lesson.events.length&&!ringState)finish();
    if(ringState){
      const pads=ringState.pads||[ringState.pad];
      const fields=pads.map(p=>targetField(p)).filter(Boolean);
      if(fields.length){
        fields.forEach(field=>{
          const point=overlayPoint(field);if(!point)return;const{x,y}=point;
          if(ringState.state==='approach'){
            const rawP=Math.max(0,Math.min(1,(elapsed-ringState.spawnAt)/APPROACH_MS));const p=rawP*rawP*(3-2*rawP);const maxRadius=Math.max(Math.hypot(x,y),Math.hypot(stageWidth-x,y),Math.hypot(x,stageHeight-y),Math.hypot(stageWidth-x,stageHeight-y))+48;const radius=maxRadius-p*(maxRadius-14),pulse=1+Math.sin(now/240)*.012;
            ctx.save();ctx.strokeStyle='#e2bd59';ctx.lineWidth=1.8+p*1.7;ctx.shadowColor='rgba(243,212,122,.78)';ctx.shadowBlur=15+p*17;
            for(let n=0;n<3;n++){ctx.globalAlpha=Math.max(.08,.78-n*.19)*(.48+p*.52);ctx.beginPath();ctx.arc(x,y,(radius+n*18)*pulse,0,Math.PI*2);ctx.stroke()}
            if(p>.72){const warm=Math.min(1,(p-.72)/.28),sx=canvas.getBoundingClientRect().width/((window.PionierCore?.surface?.metrics||{}).W||800),sy=canvas.getBoundingClientRect().height/((window.PionierCore?.surface?.metrics||{}).H||800);ctx.globalAlpha=.18+.42*warm;ctx.strokeStyle='#ffe8a0';ctx.lineWidth=1.5+2*warm;ctx.shadowBlur=8+18*warm;ctx.beginPath();ctx.ellipse(x,y,Math.max(8,(field.rx||34)*sx*1.08),Math.max(8,(field.ry||24)*sy*1.08),field.rot||0,0,Math.PI*2);ctx.stroke()}
            ctx.restore();
          }else if(ringState.state==='arrive'){
            const pulse=1+Math.sin(now/150)*.045;ctx.save();const glow=ctx.createRadialGradient(x,y,3,x,y,54*pulse);glow.addColorStop(0,'rgba(255,239,173,.48)');glow.addColorStop(.42,'rgba(243,212,122,.24)');glow.addColorStop(1,'rgba(243,212,122,0)');ctx.fillStyle=glow;ctx.beginPath();ctx.arc(x,y,58*pulse,0,Math.PI*2);ctx.fill();
            const sx=canvas.getBoundingClientRect().width/((window.PionierCore?.surface?.metrics||{}).W||800),sy=canvas.getBoundingClientRect().height/((window.PionierCore?.surface?.metrics||{}).H||800),rx=Math.max(8,(field.rx||34)*sx*1.1),ry=Math.max(8,(field.ry||24)*sy*1.1);
            ctx.strokeStyle='#fff0ad';ctx.lineWidth=3.5;ctx.shadowColor='rgba(255,224,125,1)';ctx.shadowBlur=30;ctx.beginPath();ctx.ellipse(x,y,rx,ry,field.rot||0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.88;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y,rx*1.13,ry*1.13,field.rot||0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=.8;ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(x,y,Math.max(rx,ry)*.7*pulse,0,Math.PI*2);ctx.stroke();ctx.restore();
          }else{
            const age=now-ringState.changedAt;ctx.save();ctx.globalAlpha=Math.max(0,1-age/TAIL_MS);ctx.strokeStyle=ringState.state==='hit'?'#f3d47a':'#ff4545';ctx.lineWidth=3;ctx.shadowColor=ringState.state==='hit'?'rgba(243,212,122,.9)':'#ff2525';ctx.shadowBlur=16;ctx.beginPath();ctx.arc(x,y,ringState.state==='hit'?27+age*.09:27+age*.025,0,Math.PI*2);ctx.stroke();ctx.restore();
          }
        });
        if(['hit','miss'].includes(ringState.state)&&now-ringState.changedAt>TAIL_MS)ringState=null;
      }else ringState=null;
    }
    if(running||ringState)raf=requestAnimationFrame(drawFrame);else if(done)ctx.clearRect(0,0,680,680);
  }
  function onStrike(e){
    if(!running||mode!=='practice'||performance.now()<startAt)return;
    const surface=window.PionierCore?.surface;if(!surface)return;
    const pos=surface.canvasCoords(e),hit=surface.hitVector(pos.x,pos.y),now=performance.now(),elapsed=now-startAt;
    const state=ringState,target=state?.event;
    if(!target||!['approach','arrive'].includes(state.state))return;
    if(elapsed<target.at-WINDOW_MS)return;
    const expected=state.pads||[state.pad];
    e.preventDefault();e.stopImmediatePropagation();
    if(elapsed>target.at+WINDOW_MS){markMiss(now);index++;setHud('LATE · '+hitCount+' CAUGHT');return;}
    if(!hit||!expected.includes(hit.index)){
      missCount++;progress.textContent='MISS · '+hitCount+' CAUGHT';setHud('MISS · '+hitCount+' CAUGHT');return;
    }
    if(state.caughtPads.includes(hit.index))return;
    // This capture-phase handler stops the core pointer listener so the lesson can
    // score the hit. Trigger the instrument voice ourselves or scored notes stay silent.
    strikePad(hit.index, Math.max(.55, Math.min(1, Number(e.pressure)||.72)));
    state.caughtPads.push(hit.index);
    if(state.caughtPads.length<expected.length){
      progress.textContent='ONE OF TWO · PLAY THE OTHER NOTE';setHud('ONE MORE NOTE');return;
    }
    hitCount++;progress.textContent='CHORD CAUGHT · '+hitCount+' / '+lesson.events.length;setHud('CHORD CAUGHT · '+hitCount+' / '+lesson.events.length);ringState={event:target,pad:state.pad,pads:expected,state:'hit',changedAt:now};index++;
  }
  canvas.addEventListener('pointerdown',onStrike,true);
  list.querySelectorAll('[data-lesson]').forEach(b=>b.addEventListener('click',()=>{
    lessonIndex=Number(b.dataset.lesson);lesson=LESSONS[lessonIndex];
    list.hidden=true;controls.hidden=false;heading.textContent=lesson.title;description.textContent=lesson.description;
    progress.textContent='READY WHEN YOU ARE';
    if(startBtn)startBtn.hidden=false;
    if(startBtn)startBtn.textContent=lesson.setup?'Begin setup':'Start lesson';
    if(listenBtn)listenBtn.hidden=true;
    if(catchBtn)catchBtn.hidden=true;
    if(transposeBtn)transposeBtn.hidden=false;
    if(document.getElementById('learnRestart'))document.getElementById('learnRestart').hidden=true;
  }));
  button.addEventListener('click',show);close?.addEventListener('click',hide);
  document.getElementById('learnBack')?.addEventListener('click',menu);
  document.getElementById('learnRestart')?.addEventListener('click',()=>begin(lessonIndex,mode));
  startBtn?.addEventListener('click',()=>begin(lessonIndex,lesson?.setup?'setup':'practice'));
  listenBtn?.addEventListener('click',()=>begin(lessonIndex,lesson?.setup?'setup':'practice'));
  catchBtn?.addEventListener('click',()=>begin(lessonIndex,'practice'));
  transposeBtn?.addEventListener('click',()=>{if(!lesson)return;transposeSteps=(transposeSteps+2)%Math.max(2,(window.PionierCore?.surface?.fields||[]).length||9);lesson.transpose=transposeSteps;transposeBtn.textContent='Transpose: '+(transposeSteps===0?'Original':('+'+transposeSteps+' scale degrees'));if(running)begin(lessonIndex,mode);});
  panel.addEventListener('click',e=>{if(e.target===panel)hide()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(!panel.hidden||!hud?.hidden))hide()});
  window.addEventListener('resize',()=>{syncOverlay();if(running)drawFrame()});
  menu();window.PionierLearnMode={start:begin,close:hide,stop,ready:true,lessons:LESSONS};return true;
}
