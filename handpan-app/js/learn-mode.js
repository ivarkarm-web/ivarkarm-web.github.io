/* Catch the Note: visual timing lesson. No lesson audio is loaded or played. */
const LESSONS = [
  { id:'first-contact', title:'First Contact', description:'A short, steady sequence. Catch each ring as it reaches its tonefield.', events:[
    {pad:0,at:1750},{pad:2,at:3400},{pad:4,at:5050},{pad:3,at:6700},{pad:5,at:8350},{pad:2,at:10000},{pad:1,at:11650},{pad:0,at:13300}
  ]},
  { id:'flow', title:'Flow', description:'A longer phrase with changing spaces between strikes.', events:[
    {pad:0,at:1750},{pad:2,at:3150},{pad:4,at:4800},{pad:6,at:6000},{pad:5,at:7800},{pad:3,at:9150},{pad:4,at:10550},{pad:2,at:12400},{pad:1,at:13750},{pad:3,at:15100},{pad:5,at:16900},{pad:7,at:18250},{pad:6,at:20100},{pad:4,at:21450},{pad:2,at:23100},{pad:0,at:24800}
  ]}
];
const APPROACH_MS=1450, WINDOW_MS=230;
export function mountLearnMode(){
  const button=document.getElementById('openLearn'), panel=document.getElementById('learnPanel'), close=document.getElementById('learnClose');
  const canvas=document.getElementById('pan'), list=document.getElementById('learnLessonList');
  const controls=document.getElementById('learnRunControls'), progress=document.getElementById('learnProgress');
  const heading=document.getElementById('learnHeading'), description=document.getElementById('learnDescription');
  if(!button||!panel||!canvas||button.dataset.mounted==='1')return;
  button.dataset.mounted='1';
  const overlay=document.createElement('canvas'); overlay.id='learnRippleOverlay'; overlay.width=680; overlay.height=680;
  canvas.parentElement?.appendChild(overlay);
  const ctx=overlay.getContext('2d');
  let running=false, lesson=null, startAt=0, index=0, raf=0, hitCount=0, missCount=0, redUntil=0;
  let ringState=null, done=false;
  const reduced=(()=>{try{return matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){return false}})();
  function show(){panel.hidden=false; document.body.classList.add('learn-active')}
  function hide(){panel.hidden=true; stop(); document.body.classList.remove('learn-active')}
  function stop(){running=false;done=false;ringState=null;cancelAnimationFrame(raf);ctx.clearRect(0,0,680,680);overlay.style.display='none';}
  function menu(){stop();list.hidden=false;controls.hidden=true;heading.textContent='Catch the Note';description.textContent='Catch the contracting ring at the moment it reaches its tonefield.'}
  function begin(i){
    lesson=LESSONS[i]; index=0;hitCount=0;missCount=0;done=false;running=true;startAt=performance.now();ringState=null;
    list.hidden=true;controls.hidden=false;heading.textContent=lesson.title;description.textContent=lesson.description;
    overlay.style.display='block'; progress.textContent='GET READY'; drawFrame();
  }
  function targetField(pad){const fields=window.PionierCore?.surface?.fields||[];return fields.find(f=>f.index===pad)||fields[pad]||null}
  function markMiss(now){if(!ringState||ringState.state!=='approach')return;ringState.state='miss';ringState.changedAt=now;missCount++;progress.textContent='MISS';}
  function finish(){done=true;running=false;ringState=null;progress.textContent='FINISHED  ·  '+hitCount+' HITS  ·  '+missCount+' MISSES';}
  function drawFrame(){
    if(!running&&!ringState){ctx.clearRect(0,0,680,680);return}
    const now=performance.now(), elapsed=now-startAt;
    ctx.clearRect(0,0,680,680);
    const fields=window.PionierCore?.surface?.fields||[];
    if(running&&index<lesson.events.length){
      const ev=lesson.events[index], spawnAt=ev.at-APPROACH_MS;
      if(elapsed>=spawnAt&&!ringState) ringState={event:ev,spawnAt,state:'approach',changedAt:0};
      if(ringState?.state==='approach'&&elapsed>ringState.event.at+WINDOW_MS){markMiss(now);index++}
    }else if(running&&index>=lesson.events.length&&!ringState){finish()}
    if(ringState){
      const field=targetField(ringState.event.pad);
      if(field){
        const x=field.x,y=field.y;
        if(ringState.state==='approach'){
          const p=Math.max(0,Math.min(1,(elapsed-ringState.spawnAt)/APPROACH_MS));
          const radius=70-(p*43);
          const pulse=1+Math.sin(now/95)*.035;
          ctx.save();ctx.globalAlpha=.24+p*.7;ctx.strokeStyle='#d4b04a';ctx.lineWidth=1.5+(p*1.4);
          ctx.shadowColor='rgba(212,176,74,.55)';ctx.shadowBlur=9+p*9;
          for(let n=0;n<3;n++){const rr=radius* pulse+n*10;ctx.beginPath();ctx.arc(x,y,rr,0,Math.PI*2);ctx.globalAlpha=Math.max(.06,.72-n*.2)*(0.35+p*.65);ctx.stroke()}
          ctx.restore();
        }else{
          const age=now-ringState.changedAt;ctx.save();ctx.globalAlpha=Math.max(0,1-age/560);ctx.strokeStyle='#ff4545';ctx.lineWidth=3;ctx.shadowColor='#ff2525';ctx.shadowBlur=16;ctx.beginPath();ctx.arc(x,y,27+age*.025,0,Math.PI*2);ctx.stroke();ctx.restore();
          if(age>560)ringState=null;
        }
      }
    }
    if(running||ringState)raf=requestAnimationFrame(drawFrame);
    else if(done) {ctx.clearRect(0,0,680,680)}
  }
  function onStrike(e){
    if(!running)return;
    const core=window.PionierCore, surface=core?.surface;
    if(!surface)return;
    const pos=surface.canvasCoords(e), hit=surface.hitVector(pos.x,pos.y);
    const now=performance.now(), elapsed=now-startAt;
    const state=ringState, target=state?.event;
    const inWindow=!!target&&state.state==='approach'&&elapsed>=target.at-WINDOW_MS&&elapsed<=target.at+WINDOW_MS;
    if(!inWindow||hit?.index!==target?.pad){
      e.preventDefault();e.stopImmediatePropagation();
      if(state?.state==='approach'){markMiss(now);index++}
      else {missCount++;progress.textContent='MISS'}
      return;
    }
    hitCount++;progress.textContent='CAUGHT  ·  '+hitCount+' / '+lesson.events.length;
    ringState={event:target,state:'hit',changedAt:now};index++;
    // Gold response ripple; the native note handler continues and triggers the sound.
    const field=targetField(target.pad);
    if(field){ctx.save();ctx.strokeStyle='#f3d47a';ctx.lineWidth=2;ctx.globalAlpha=.9;ctx.beginPath();ctx.arc(field.x,field.y,24,0,Math.PI*2);ctx.stroke();ctx.restore()}
  }
  canvas.addEventListener('pointerdown',onStrike,true);
  list.addEventListener('click',e=>{const b=e.target.closest('[data-lesson]');if(b)begin(Number(b.dataset.lesson))});
  button.addEventListener('click',show);close?.addEventListener('click',hide);
  document.getElementById('learnBack')?.addEventListener('click',menu);
  document.getElementById('learnRestart')?.addEventListener('click',()=>begin(LESSONS.findIndex(x=>x===lesson)));
  panel.addEventListener('click',e=>{if(e.target===panel)hide()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)hide()});
  window.addEventListener('resize',()=>{overlay.width=680;overlay.height=680;if(running)drawFrame()});
  menu();
}
