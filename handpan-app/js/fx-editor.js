/**
 * Pionier FX editor: live effect parameters, response-curve shaping and presets.
 */
const $ = (id) => document.getElementById(id);
const backdrop = $('fxEditorBackdrop');
const dialog = $('fxEditor');
const curve = $('fxEditorCurve');
const g = curve && curve.getContext('2d');
let activeId = null, activeModule = null, lastFocus = null, draggingCurve = false;
const DEFS = {
 compressor:{title:'Compressor',subtitle:'Control dynamics, punch and glue.',x:'Input level (dB)',y:'Output level (dB)',presets:[
 {id:'soft',label:'Soft',v:{threshold:-18,ratio:2.2,knee:24,attack:.012,release:.28}},
 {id:'punch',label:'Punch',v:{threshold:-14,ratio:4,knee:8,attack:.002,release:.12}},
 {id:'glue',label:'Glue',v:{threshold:-20,ratio:3.2,knee:16,attack:.02,release:.35}},
 {id:'limit',label:'Limit',v:{threshold:-8,ratio:12,knee:2,attack:.001,release:.08}}],
 knobs:[
 {key:'value',label:'Amount',min:0,max:1,step:.01,fmt:v=>Math.round(v*100)+'%',get:m=>m.value,set:(m,v,c)=>m.setValue(v,c)},
 {key:'threshold',label:'Threshold',min:-36,max:-6,step:1,fmt:v=>Math.round(v)+' dB',get:m=>m.settings.threshold??-18},
 {key:'ratio',label:'Ratio',min:1,max:12,step:.1,fmt:v=>Number(v).toFixed(1)+':1',get:m=>m.settings.ratio??2.2}]},
 delay:{title:'Delay',subtitle:'Tune echo timing, feedback and space.',x:'Delay time',y:'Feedback',presets:[
 {id:'echo',label:'Echo',v:{time:.34,feedback:.38}},{id:'slap',label:'Slap',v:{time:.085,feedback:.12}},
 {id:'ping',label:'Ping-pong',v:{time:.42,feedback:.54}},{id:'ambient',label:'Ambient',v:{time:.58,feedback:.42}}],
 knobs:[
 {key:'value',label:'Mix',min:0,max:1,step:.01,fmt:v=>Math.round(v*100)+'%',get:m=>m.value,set:(m,v,c)=>m.setValue(v,c)},
 {key:'time',label:'Time',min:.04,max:.72,step:.005,fmt:v=>Math.round(v*1000)+' ms',get:m=>m.settings.time??.34},
 {key:'feedback',label:'Feedback',min:.05,max:.75,step:.01,fmt:v=>Math.round(v*100)+'%',get:m=>m.settings.feedback??.38}]},
 reverb:{title:'Reverb',subtitle:'Shape the tail from intimate room to vast space.',x:'Decay length',y:'Brightness',presets:[
 {id:'room',label:'Room',v:{decay:1,tone:1}},{id:'hall',label:'Hall',v:{decay:1.55,tone:.86}},
 {id:'plate',label:'Plate',v:{decay:.88,tone:1.45}},{id:'cave',label:'Cave',v:{decay:2.25,tone:.62}}],
 knobs:[
 {key:'value',label:'Mix',min:0,max:1,step:.01,fmt:v=>Math.round(v*100)+'%',get:m=>m.value,set:(m,v,c)=>m.setValue(v,c)},
 {key:'decay',label:'Decay',min:.6,max:3,step:.05,fmt:v=>Number(v).toFixed(2)+'×',get:m=>m.settings.decay??1},
 {key:'tone',label:'Tone',min:.4,max:1.6,step:.05,fmt:v=>Math.round(v*100)+'%',get:m=>m.settings.tone??1}]},
 filter:{title:'Filter',subtitle:'Sweep the spectrum and sculpt resonance.',x:'Frequency (Hz)',y:'Resonance (Q)',presets:[
 {id:'lowpass',label:'Low-pass',v:{frequency:4200,resonance:1.1}},{id:'highpass',label:'High-pass',v:{frequency:160,resonance:1.2}},
 {id:'band',label:'Band-pass',v:{frequency:1200,resonance:2.5}},{id:'notch',label:'Notch',v:{frequency:900,resonance:5}}],
 knobs:[
 {key:'value',label:'Amount',min:0,max:1,step:.01,fmt:v=>Math.round(v*100)+'%',get:m=>m.value,set:(m,v,c)=>m.setValue(v,c)},
 {key:'frequency',label:'Cutoff',min:80,max:16000,step:1,fmt:v=>v>=1000?(v/1000).toFixed(1)+' kHz':Math.round(v)+' Hz',get:m=>m.settings.frequency??4200},
 {key:'resonance',label:'Resonance',min:.5,max:12,step:.1,fmt:v=>'Q '+Number(v).toFixed(1),get:m=>m.settings.resonance??1.1}]}
};
const DEFAULTS = {
 compressor:{threshold:-18,ratio:2.2,knee:24,attack:.012,release:.28},
 delay:{time:.34,feedback:.38}, reverb:{decay:1,tone:1}, filter:{frequency:4200,resonance:1.1}
};
const BASE_VALUE = {compressor:.4,delay:.15,reverb:.25,filter:.12};
const BASE_TYPE = {compressor:'soft',delay:'echo',reverb:'room',filter:'lowpass'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const audio=()=>window.PionierCore?.getAudioContext?.();
function ensureSettings(id,m){m.settings||={};Object.entries(DEFAULTS[id]||{}).forEach(([k,v])=>{if(!Number.isFinite(m.settings[k]))m.settings[k]=v;});}
function refresh(){activeModule?._apply?.(audio());window.PionierCore?.refreshFxKnobs?.();drawCurve();drawKnobs();}
function paintDial(c,amount){
 if(!c)return;const r=c.getBoundingClientRect(),s=Math.max(1,Math.round(r.width||74)),d=window.devicePixelRatio||1;
 if(c.width!==Math.round(s*d)||c.height!==Math.round(s*d)){c.width=Math.round(s*d);c.height=Math.round(s*d);}
 const q=c.getContext('2d');q.setTransform(d,0,0,d,0,0);q.clearRect(0,0,s,s);
 const x=s/2,y=s/2,rad=s*.37,start=Math.PI*.75,end=Math.PI*(.75+1.5*clamp(amount,0,1));
 q.lineWidth=4;q.lineCap='round';q.strokeStyle='rgba(236,228,207,.14)';q.beginPath();q.arc(x,y,rad,Math.PI*.75,Math.PI*2.25);q.stroke();
 q.strokeStyle='#d9b85e';q.beginPath();q.arc(x,y,rad,start,end);q.stroke();
 q.fillStyle='#f4d780';q.beginPath();q.arc(x+Math.cos(end)*rad,y+Math.sin(end)*rad,3,0,Math.PI*2);q.fill();
 q.fillStyle='rgba(236,228,207,.08)';q.beginPath();q.arc(x,y,rad-8,0,Math.PI*2);q.fill();
}
function changeKnob(def,v){
 const value=clamp(Number(v),def.min,def.max);
 if(def.key==='value')def.set(activeModule,value,audio());
 else{activeModule.settings[def.key]=value;activeModule._apply?.(audio());}
 const label=$('fx-knob-value-'+def.key),dial=$('fx-knob-dial-'+def.key);
 if(label)label.textContent=def.fmt(value);if(dial)paintDial(dial,(value-def.min)/(def.max-def.min));
 window.PionierCore?.refreshFxKnobs?.();drawCurve();
}
function drawKnobs(){
 if(!activeModule)return;const host=$('fxEditorKnobs');host.replaceChildren();
 DEFS[activeId].knobs.forEach(def=>{
  const wrap=document.createElement('div');wrap.className='fx-editor-knob';
  const dial=document.createElement('canvas');dial.className='fx-editor-dial';dial.id='fx-knob-dial-'+def.key;dial.width=74;dial.height=74;dial.tabIndex=0;dial.setAttribute('role','slider');dial.setAttribute('aria-label',def.label);dial.setAttribute('aria-valuemin',String(def.min));dial.setAttribute('aria-valuemax',String(def.max));
  const name=document.createElement('div');name.className='fx-editor-knob-name';name.textContent=def.label;
  const value=document.createElement('div');value.className='fx-editor-knob-value';value.id='fx-knob-value-'+def.key;
  wrap.append(dial,name,value);host.appendChild(wrap);
  let current=Number(def.get(activeModule)),downY=0,start=0,drag=false;
  const update=v=>{current=clamp(v,def.min,def.max);changeKnob(def,current);dial.setAttribute('aria-valuenow',String(current));};
  value.textContent=def.fmt(current);paintDial(dial,(current-def.min)/(def.max-def.min));
  dial.addEventListener('pointerdown',e=>{e.preventDefault();drag=true;downY=e.clientY;start=current;dial.setPointerCapture?.(e.pointerId);});
  dial.addEventListener('pointermove',e=>{if(drag)update(start+(downY-e.clientY)/140*(def.max-def.min));});
  const stop=()=>{drag=false;};dial.addEventListener('pointerup',stop);dial.addEventListener('pointercancel',stop);
  dial.addEventListener('keydown',e=>{if(['ArrowUp','ArrowRight'].includes(e.key)){e.preventDefault();update(current+Number(def.step));}else if(['ArrowDown','ArrowLeft'].includes(e.key)){e.preventDefault();update(current-Number(def.step));}else if(e.key==='Home'){e.preventDefault();update(def.min);}else if(e.key==='End'){e.preventDefault();update(def.max);}});
 });
}
function graphState(){
 const m=activeModule;
 if(activeId==='compressor')return{x:clamp(((m.settings.threshold??-18)+36)/30,0,1),y:clamp(((m.settings.ratio??2.2)-1)/11,0,1)};
 if(activeId==='delay')return{x:clamp(((m.settings.time??.34)-.04)/.68,0,1),y:clamp(((m.settings.feedback??.38)-.05)/.7,0,1)};
 if(activeId==='reverb')return{x:clamp(((m.settings.decay??1)-.6)/2.4,0,1),y:clamp(((m.settings.tone??1)-.4)/1.2,0,1)};
 return{x:clamp(Math.log((m.settings.frequency??4200)/80)/Math.log(200),0,1),y:clamp(((m.settings.resonance??1.1)-.5)/11.5,0,1)};
}
function changeCurve(x,y){
 const m=activeModule,nx=clamp(x,0,1),ny=clamp(1-y,0,1);
 if(activeId==='compressor'){m.settings.threshold=-36+nx*30;m.settings.ratio=1+ny*11;}
 else if(activeId==='delay'){m.settings.time=.04+nx*.68;m.settings.feedback=.05+ny*.7;}
 else if(activeId==='reverb'){m.settings.decay=.6+nx*2.4;m.settings.tone=.4+ny*1.2;}
 else{m.settings.frequency=80*Math.pow(200,nx);m.settings.resonance=.5+ny*11.5;}
 m._apply?.(audio());window.PionierCore?.refreshFxKnobs?.();drawKnobs();drawCurve();$('fxEditorStatus').textContent='Curve adjusted · live';
}
function drawCurve(){
 if(!g||!activeModule)return;
 const r=curve.getBoundingClientRect(),w=Math.max(280,Math.round(r.width||640)),h=Math.max(140,Math.round(r.height||205)),d=window.devicePixelRatio||1;
 if(curve.width!==Math.round(w*d)||curve.height!==Math.round(h*d)){curve.width=Math.round(w*d);curve.height=Math.round(h*d);}
 g.setTransform(d,0,0,d,0,0);g.clearRect(0,0,w,h);
 const p={l:24,r:12,t:12,b:15},gw=w-p.l-p.r,gh=h-p.t-p.b,px=x=>p.l+x*gw,py=y=>p.t+(1-y)*gh;
 g.strokeStyle='rgba(230,220,198,.09)';g.lineWidth=1;
 for(let i=0;i<=4;i++){const x=p.l+gw*i/4,y=p.t+gh*i/4;g.beginPath();g.moveTo(x,p.t);g.lineTo(x,h-p.b);g.stroke();g.beginPath();g.moveTo(p.l,y);g.lineTo(w-p.r,y);g.stroke();}
 g.strokeStyle='rgba(230,220,198,.2)';g.setLineDash([4,5]);g.beginPath();g.moveTo(px(0),py(0));g.lineTo(px(1),py(1));g.stroke();g.setLineDash([]);
 g.beginPath();
 for(let i=0;i<=160;i++){
  const x=i/160;let y=x;
  if(activeId==='compressor'){const th=clamp(((activeModule.settings.threshold??-18)+36)/30,.01,.99),ratio=activeModule.settings.ratio??2.2;y=x<th?x:th+(x-th)/ratio;}
  else if(activeId==='delay'){y=.08+.82*Math.pow(activeModule.settings.feedback??.38,x*4.4);}
  else if(activeId==='reverb'){y=.08+.84*Math.exp(-x*4/(activeModule.settings.decay??1));}
  else{const f=clamp(Math.log((activeModule.settings.frequency??4200)/80)/Math.log(200),.01,.99),q=activeModule.settings.resonance??1.1;if(activeModule.type==='highpass')y=1/(1+Math.exp(-(x-f)*(8+q)));else if(activeModule.type==='band')y=Math.exp(-Math.pow((x-f)*(8+q),2));else if(activeModule.type==='notch')y=1-.85*Math.exp(-Math.pow((x-f)*(8+q),2));else y=1/(1+Math.exp((x-f)*(8+q)));}
  if(i===0)g.moveTo(px(x),py(y));else g.lineTo(px(x),py(y));
 }
 g.strokeStyle='#d9b85e';g.lineWidth=2.5;g.lineJoin='round';g.stroke();
 const s=graphState(),hx=px(s.x),hy=py(s.y);g.beginPath();g.arc(hx,hy,9,0,Math.PI*2);g.fillStyle='rgba(217,184,94,.2)';g.fill();g.beginPath();g.arc(hx,hy,4.5,0,Math.PI*2);g.fillStyle='#f5d781';g.fill();
}
function renderPresets(){
 const host=$('fxEditorPresets');host.replaceChildren();
 DEFS[activeId].presets.forEach(p=>{
  const b=document.createElement('button');b.type='button';b.className='fx-editor-preset';b.textContent=p.label;b.dataset.preset=p.id;
  const selected=activeModule.type===p.id;b.classList.toggle('is-active',selected);b.setAttribute('aria-pressed',String(selected));
  b.addEventListener('click',()=>{activeModule.type=p.id;Object.assign(activeModule.settings,p.v);activeModule._apply?.(audio());renderPresets();drawKnobs();drawCurve();$('fxEditorStatus').textContent=p.label+' preset · live';});
  host.appendChild(b);
 });
}
function openEditor(id){
 const def=DEFS[id],m=window.PionierCore?.getFxModule?.(id);if(!def||!m||!dialog||!backdrop)return;
 activeId=id;activeModule=m;ensureSettings(id,m);lastFocus=document.activeElement;
 $('fxEditorTitle').textContent=def.title;$('fxEditorSubtitle').textContent=def.subtitle;$('fxEditorAxisX').textContent=def.x;$('fxEditorAxisY').textContent=def.y;
 $('fxEditorBypass').setAttribute('aria-pressed',String(!!m.bypassed));$('fxEditorBypass').textContent=m.bypassed?'Bypassed':'Bypass';
 renderPresets();drawKnobs();backdrop.hidden=false;dialog.hidden=false;document.body.classList.add('is-fx-editor-open');
 requestAnimationFrame(()=>{drawCurve();$('fxEditorClose')?.focus();});
}
function closeEditor(){if(!dialog||dialog.hidden)return;dialog.hidden=true;backdrop.hidden=true;document.body.classList.remove('is-fx-editor-open');activeId=null;activeModule=null;draggingCurve=false;lastFocus?.focus?.();}
function graphCoords(e){const r=curve.getBoundingClientRect();return{x:clamp((e.clientX-r.left-24)/Math.max(1,r.width-36),0,1),y:clamp((e.clientY-r.top-12)/Math.max(1,r.height-27),0,1)};}
window.addEventListener('pionier:fx-editor-open',e=>openEditor(e.detail?.id));
$('fxEditorClose')?.addEventListener('click',closeEditor);backdrop?.addEventListener('click',closeEditor);
$('fxEditorReset')?.addEventListener('click',()=>{
 if(!activeModule||!activeId)return;activeModule.type=BASE_TYPE[activeId];activeModule.settings={...(DEFAULTS[activeId]||{})};activeModule.bypassed=false;activeModule.setValue(BASE_VALUE[activeId],audio());
 $('fxEditorBypass').setAttribute('aria-pressed','false');$('fxEditorBypass').textContent='Bypass';renderPresets();drawKnobs();drawCurve();$('fxEditorStatus').textContent='Default settings restored';
});
$('fxEditorBypass')?.addEventListener('click',()=>{
 if(!activeModule)return;activeModule.setBypass(!activeModule.bypassed,audio());$('fxEditorBypass').setAttribute('aria-pressed',String(activeModule.bypassed));$('fxEditorBypass').textContent=activeModule.bypassed?'Bypassed':'Bypass';$('fxEditorStatus').textContent=activeModule.bypassed?'Effect bypassed':'Effect active';drawCurve();
});
curve?.addEventListener('pointerdown',e=>{if(!activeModule)return;e.preventDefault();draggingCurve=true;curve.setPointerCapture?.(e.pointerId);const p=graphCoords(e);changeCurve(p.x,p.y);});
curve?.addEventListener('pointermove',e=>{if(!draggingCurve||!activeModule)return;const p=graphCoords(e);changeCurve(p.x,p.y);});
const stop=()=>{draggingCurve=false;};curve?.addEventListener('pointerup',stop);curve?.addEventListener('pointercancel',stop);
window.addEventListener('keydown',e=>{if(!dialog||dialog.hidden)return;if(e.key==='Escape'){e.preventDefault();closeEditor();}});
window.addEventListener('resize',()=>{if(dialog&&!dialog.hidden){drawKnobs();drawCurve();}});
