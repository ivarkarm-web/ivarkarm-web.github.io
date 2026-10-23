
import { MIN_NOTES, ringAngles, ringPadScale } from './pad-layout.js';
export const WORLD_ZONE_INDICES = [0, 1, 3, 5, 7];
const ADD_NOTE_MS = 520;
export function createSurface(canvas) {
  const ctx2 = canvas.getContext('2d');
  let W=800,H=800,R=0,CX=0,CY=0,fields=[],anim=null,armed=false,rimTime=0;
  const touchRipples=[];
  const touchLights=new Map();
  let rippleRaf=0;
  let reducedMotion=false;
  try{reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){}
  function getTheme(){
    const s=(typeof window!=='undefined'&&window.PionierSettings)||{};
    const led=s.led||{r:201,g:162,b:39};
    const light=!!(s.lightMode||(typeof document!=='undefined'&&document.documentElement?.classList?.contains('theme-light')));
    const alphaIn=s.transparency!=null?s.transparency:1;
    const palette=(typeof window!=='undefined'&&window.PionierSkinPalette)||{};
    const fallback={body:['#2e3036','#1a1b1f','#0e0f12'],rim:[220,224,232],pad:[[58,60,68],[36,38,44],[22,23,27]],lip:[200,204,212],stroke:[255,255,255],glow:[[230,235,245],[140,150,170]],sheen:0.12};
    const lightSkin={body:['#e4e0d8','#c8c4bc','#9e9a92'],rim:[50,48,44],pad:[[220,216,208],[180,176,168],[140,136,128]],lip:[70,68,62],stroke:[20,18,14],glow:[[60,58,52],[40,38,34]],sheen:0.14};
    const skin=palette.classic||palette.neutral||(light?lightSkin:fallback);
    return{skin,led:{r:led.r|0,g:led.g|0,b:led.b|0},tonefield:'classic',alpha:Number.isFinite(+alphaIn)?+alphaIn:1};
  }
  function rgba(c,a){
    if(Array.isArray(c))return'rgba('+(Number.isFinite(c[0])?c[0]:0)+','+(Number.isFinite(c[1])?c[1]:0)+','+(Number.isFinite(c[2])?c[2]:0)+','+(Number.isFinite(a)?a:0)+')';
    return c;
  }
  function mixLed(base,led,t){
    const p=(o,i,k)=>{if(!o)return 0;if(Array.isArray(o))return Number.isFinite(o[i])?o[i]:0;return Number.isFinite(o[k])?o[k]:0};
    const tt=Number.isFinite(t)?t:0;
    return[Math.round(p(base,0,'r')*(1-tt)+p(led,0,'r')*tt),Math.round(p(base,1,'g')*(1-tt)+p(led,1,'g')*tt),Math.round(p(base,2,'b')*(1-tt)+p(led,2,'b')*tt)];
  }
  function pathPad(f){
    const{x,y,rx,ry}=f;const rot=f.rot||0;
    const c=Math.cos(rot), sn=Math.sin(rot);
    const p=(lx,ly)=>({x:x+lx*c-ly*sn,y:y+lx*sn+ly*c});
    const top=p(-rx*0.025,-ry), tr=p(rx*0.68,-ry*0.91),
      right=p(rx*1.015,-ry*0.03), br=p(rx*0.83,ry*0.83),
      bottom=p(rx*0.035,ry*1.015), bl=p(-rx*0.78,ry*0.88),
      left=p(-rx*0.985,ry*0.015), tl=p(-rx*0.72,-ry*0.86);
    ctx2.beginPath();ctx2.moveTo(top.x,top.y);
    ctx2.bezierCurveTo(p(rx*0.27,-ry*1.02).x,p(rx*0.27,-ry*1.02).y,tr.x,tr.y,right.x,right.y);
    ctx2.bezierCurveTo(p(rx*1.06,ry*0.35).x,p(rx*1.06,ry*0.35).y,br.x,br.y,bottom.x,bottom.y);
    ctx2.bezierCurveTo(p(-rx*0.32,ry*1.06).x,p(-rx*0.32,ry*1.06).y,bl.x,bl.y,left.x,left.y);
    ctx2.bezierCurveTo(p(-rx*1.04,-ry*0.34).x,p(-rx*1.04,-ry*0.34).y,tl.x,tl.y,top.x,top.y);
    ctx2.closePath();
  }
  function mandalaStyle(){return 'none';}
  function mandalaEnabled(){return false;}
  function drawHandpanMandala(_theme){ /* Phase 3: disabled */ }
  function layoutHandpanFields(handpanNotes,isFieldPlayable){
    const list=handpanNotes||[];const wasArmed=armed;armed=false;
    const previous=wasArmed&&fields.length?animatedView(performance.now()).map(f=>({...f})):null;
    const stock=list.slice(0,MIN_NOTES||9);
    const midis=stock.map(n=>n.midi).filter(m=>m!=null);
    const midiMin=midis.length?Math.min(...midis):48,midiMax=midis.length?Math.max(...midis):72;
    const midiSpan=Math.max(1,midiMax-midiMin),ringCount=Math.max(1,list.length-1);
    let angles,padScale;
    try{angles=ringAngles(ringCount);padScale=ringPadScale(ringCount)}
    catch(_){angles=Array.from({length:ringCount},(_,i)=>(i/ringCount)*360);padScale=1}
    const reference=list.find(n=>Number(n.index)===2)||list.find(n=>n.kind!=='ding')||list[0];
    const referenceLow=reference&&reference.midi!=null?Math.max(0,Math.min(1,(midiMax-reference.midi)/midiSpan)):0.5;
    const size=(1.12+referenceLow*0.36)*1.16;
    const padRx=R*0.205*size*padScale,padRy=R*0.145*size*padScale;
    const dingR=R*0.195*size;
    fields=list.map((n,pos)=>{
      const playable=typeof isFieldPlayable==='function'?isFieldPlayable(n.index):true;
      if(n.kind==='ding'){return{i:n.index,index:n.index,x:CX,y:CY,rx:dingR,ry:dingR,rot:0,label:n.name,playable,kind:'ding'}}
      const slot=(n.index!=null?n.index:pos)-1;
      const deg=angles[slot]!=null?angles[slot]:(slot/ringCount)*360;
      const a=(deg*Math.PI)/180,d=R*0.68;
      const ux=Math.sin(a),uy=-Math.cos(a);
      return{i:n.index,index:n.index,x:CX+ux*d,y:CY+uy*d,rx:padRx,ry:padRy,rot:Math.atan2(uy,ux),ux,uy,label:n.name,playable,kind:'ring'};
    });
    anim=previous&&!reducedMotion?{t0:performance.now(),dur:ADD_NOTE_MS,from:new Map(previous.map(f=>[f.index,f]))}:null;
    return fields;
  }
  function animatedView(now){
    if(!anim)return fields;
    const t=(now-anim.t0)/anim.dur;
    if(t>=1){anim=null;return fields}
    const e=1-Math.pow(1-Math.max(0,t),3);
    const mix=(a,b)=>a+(b-a)*e;
    return fields.map(f=>{
      const from=anim.from.get(f.index);
      if(!from)return{...f,rx:f.rx*e,ry:f.ry*e,appear:e};
      let dr=f.rot-(from.rot||0);dr=Math.atan2(Math.sin(dr),Math.cos(dr));
      return{...f,x:mix(from.x,f.x),y:mix(from.y,f.y),rx:mix(from.rx,f.rx),ry:mix(from.ry,f.ry),rot:(from.rot||0)+dr*e};
    });
  }
  function drawSurfaceFinish(theme, materialTime){
    if(R<20)return;
    const lip=theme.skin.lip||theme.skin.rim||[220,224,232];
    const phase=reducedMotion?0.5:0.5+0.5*Math.sin(performance.now()*0.00022);
    ctx2.save();
    ctx2.beginPath();ctx2.arc(CX,CY,R*0.925,0,Math.PI*2);ctx2.clip();
    const sheen=ctx2.createRadialGradient(CX-R*0.34,CY-R*0.42,R*0.025,CX-R*0.18,CY-R*0.12,R*1.12);
    sheen.addColorStop(0,rgba([255,248,232],0.018+phase*0.006));
    sheen.addColorStop(0.4,rgba(lip,0.012));
    sheen.addColorStop(1,rgba(lip,0));
    ctx2.globalCompositeOperation='screen';
    ctx2.fillStyle=sheen;ctx2.beginPath();ctx2.arc(CX,CY,R*0.925,0,Math.PI*2);ctx2.fill();
    ctx2.globalCompositeOperation='source-over';
    ctx2.lineWidth=Math.max(0.4,R*0.0009);
    for(let i=0;i<8;i++){
      const rr=R*(0.16+i*0.09);
      ctx2.strokeStyle=rgba(lip,0.02+(i%2?0.01:0));
      ctx2.beginPath();ctx2.arc(CX,CY,rr,0,Math.PI*2);ctx2.stroke();
    }
    ctx2.strokeStyle=rgba([255,248,232],0.012+phase*0.008);
    ctx2.lineWidth=Math.max(0.6,R*0.0018);
    ctx2.beginPath();ctx2.arc(CX,CY,R*0.905,Math.PI*1.13,Math.PI*1.78);ctx2.stroke();
    ctx2.restore();
  }
  function drawSlit(f,glow,playable){
    const isDing=f.kind==='ding';
    const slitLen=isDing?Math.min(f.rx,f.ry)*0.42:Math.min(f.rx,f.ry)*0.55;
    const slitW=Math.max(1.05,R*0.0052),g=Math.max(0,Math.min(1,glow||0));
    const idle=playable?1:0.14,coreAlpha=(0.22+g*0.55)*idle,halfL=slitLen*0.5;
    const th=getTheme(),ledMix=mixLed([205,221,239],th.led,0.45);
    ctx2.save();ctx2.translate(f.x,f.y);ctx2.rotate(isDing?0:(f.rot||0)+Math.PI/2);
    ctx2.globalCompositeOperation='source-over';
    const recess=ctx2.createLinearGradient(0,-slitW*2.7,0,slitW*2.7);
    recess.addColorStop(0,'rgba(0,0,0,0)');recess.addColorStop(0.28,'rgba(0,0,0,'+(0.2*idle)+')');
    recess.addColorStop(0.5,'rgba(0,0,0,'+(0.72*idle)+')');recess.addColorStop(0.72,'rgba(0,0,0,'+(0.2*idle)+')');recess.addColorStop(1,'rgba(0,0,0,0)');
    ctx2.fillStyle=recess;ctx2.beginPath();ctx2.ellipse(0,0,halfL*1.05,slitW*2.8,0,0,Math.PI*2);ctx2.fill();
    ctx2.fillStyle='rgba(3,5,8,'+(0.78*idle)+')';ctx2.beginPath();ctx2.ellipse(0,0,halfL*0.92,slitW*0.72,0,0,Math.PI*2);ctx2.fill();
    ctx2.globalCompositeOperation='lighter';
    const core=ctx2.createLinearGradient(-halfL,0,halfL,0);
    core.addColorStop(0,rgba(ledMix,0));core.addColorStop(0.5,rgba([255,255,255],coreAlpha*0.72));core.addColorStop(1,rgba(ledMix,0));
    ctx2.fillStyle=core;ctx2.beginPath();ctx2.ellipse(0,0,halfL*0.88,slitW*0.42,0,0,Math.PI*2);ctx2.fill();
    ctx2.restore();
  }
  function drawRimGlow(t){
    if(R<8)return;rimTime=t||rimTime;
    const breath=reducedMotion?0.55:0.42+0.58*(0.5+0.5*Math.sin(rimTime*0.75));
    const rimR=R*0.965,th=getTheme(),lc=[th.led.r,th.led.g,th.led.b];
    ctx2.save();ctx2.globalCompositeOperation='lighter';
    const halo=ctx2.createRadialGradient(CX,CY,rimR*0.985,CX,CY,rimR*1.018);
    halo.addColorStop(0,rgba(lc,0));halo.addColorStop(0.62,rgba(mixLed([230,236,248],th.led,0.5),0.004*breath));halo.addColorStop(1,rgba(lc,0));
    ctx2.fillStyle=halo;ctx2.beginPath();ctx2.arc(CX,CY,rimR*1.08,0,Math.PI*2);ctx2.arc(CX,CY,rimR*0.88,0,Math.PI*2,true);ctx2.fill();
    ctx2.restore();
  }
  let rippleCanvas=null,rippleCtx=null;
  function ensureRippleCanvas(){
    if(rippleCanvas)return;
    rippleCanvas=document.createElement('canvas');
    rippleCanvas.setAttribute('aria-hidden','true');
    Object.assign(rippleCanvas.style,{position:'fixed',inset:'0',width:'100vw',height:'100vh',pointerEvents:'none',zIndex:'99999',opacity:'1'});
    document.documentElement.appendChild(rippleCanvas);
    rippleCtx=rippleCanvas.getContext('2d');
    const fit=()=>{
      const rect=rippleCanvas.getBoundingClientRect();
      const dpr=Math.min(1.5,window.devicePixelRatio||1);
      rippleCanvas.width=Math.round(rect.width*dpr);
      rippleCanvas.height=Math.round(rect.height*dpr);
      rippleCtx.setTransform(dpr,0,0,dpr,0,0);
    };
    fit();
    window.addEventListener('resize',fit,{passive:true});
  }
  function smoothstep(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
  function tickRipples(){
    rippleRaf=0;
    if(!touchRipples.length)return;
    ensureRippleCanvas();
    const now=performance.now();
    const rect=rippleCanvas.getBoundingClientRect();
    rippleCtx.clearRect(0,0,rect.width,rect.height);
    for(let i=touchRipples.length-1;i>=0;i--){
      const r=touchRipples[i];
      const age=(now-r.t0)/r.dur;
      if(age>=1){touchRipples.splice(i,1);continue;}
      const e=smoothstep(age);
      const rad=r.r0+(r.r1-r.r0)*e;
      const a=(1-e)*r.alpha;
      rippleCtx.beginPath();rippleCtx.arc(r.x,r.y,rad,0,Math.PI*2);
      rippleCtx.strokeStyle='rgba(201,162,39,'+a+')';
      rippleCtx.lineWidth=Math.max(1,2.2*(1-e));
      rippleCtx.stroke();
    }
    if(touchRipples.length)rippleRaf=requestAnimationFrame(tickRipples);
  }
  function addRipple(x,y,_noteIndex){
    const panRect=canvas.getBoundingClientRect();
    const sx=panRect.left+x*(panRect.width/(W||1));
    const sy=panRect.top+y*(panRect.height/(H||1));
    touchRipples.push({x:sx,y:sy,t0:performance.now(),dur:900,r0:8,r1:Math.min(window.innerWidth,window.innerHeight)*0.35,alpha:0.35});
    if(!rippleRaf)rippleRaf=requestAnimationFrame(tickRipples);
    if(_noteIndex!=null)touchLights.set(Number(_noteIndex),performance.now());
  }
  function drawBody(inst,catchActive){
    ctx2.clearRect(0,0,W,H);
    const theme=getTheme(),tf=theme.tonefield||'classic';
    const materialTime=reducedMotion?0:performance.now()*0.00011;
    const lightX=CX-R*(0.2+Math.sin(materialTime)*0.045);
    const lightY=CY-R*(0.28+Math.cos(materialTime*0.83)*0.035);
    const g=ctx2.createRadialGradient(lightX,lightY,R*0.025,CX+R*0.04,CY+R*0.02,R*1.02);
    g.addColorStop(0,theme.skin.body[0]);
    g.addColorStop(0.36,theme.skin.body[0]);
    g.addColorStop(0.67,theme.skin.body[1]);
    g.addColorStop(1,theme.skin.body[2]);
    ctx2.fillStyle=g;ctx2.beginPath();ctx2.arc(CX,CY,R,0,Math.PI*2);ctx2.fill();
    ctx2.strokeStyle=rgba(theme.skin.rim||theme.skin.stroke||[220,224,232], document.documentElement.classList.contains('theme-light')?0.16:0.11);
    ctx2.lineWidth=Math.max(1,R*0.0022);
    ctx2.beginPath();ctx2.arc(CX,CY,R*0.998,0,Math.PI*2);ctx2.stroke();
    drawHandpanMandala(theme);
    drawSurfaceFinish(theme, materialTime);
    const view=animatedView(performance.now());
    ctx2.globalCompositeOperation='source-over';
    ctx2.globalAlpha=(theme.alpha!=null?theme.alpha:1)*(catchActive?0.88:1);
    view.forEach(f=>{
      if(window.PionierWelcomeState&&window.PionierWelcomeState.hideTonefields)return;
      const isDing=f.kind==='ding',playable=f.playable!==false;
      const dim=(playable?1:0.32)*(f.appear??1);
      const hlx=f.ux!=null?f.ux:-0.35,hly=f.uy!=null?f.uy:-0.45,baseR=Math.max(f.rx,f.ry);
      const glow=inst&&inst.glow?inst.glow[f.index]||0:0;
      const touchedAt=touchLights.get(Number(f.index))||0;
      const touchGlow=touchedAt?Math.max(0,1-(performance.now()-touchedAt)/450):0;
      const lipCol=theme.skin.lip||theme.skin.stroke;
      const strokeCol=theme.skin.stroke||lipCol;
      // Phase 3: soft tint fill + hairline outline + slight press scale
      const pressScale=touchGlow>0.02?(1-0.03*Math.min(1,touchGlow)):1;
      const prx=f.rx*pressScale, pry=f.ry*pressScale;
      const pad=ctx2.createRadialGradient(f.x+hlx*prx*0.28,f.y+hly*pry*0.28,0,f.x,f.y,Math.max(prx,pry));
      pad.addColorStop(0,rgba(theme.skin.pad[0],0.52*dim));
      pad.addColorStop(0.55,rgba(theme.skin.pad[1],0.38*dim));
      pad.addColorStop(1,rgba(theme.skin.pad[2],0.22*dim));
      ctx2.fillStyle=pad;pathPad({x:f.x,y:f.y,rx:prx,ry:pry,rot:f.rot});ctx2.fill();
      const strokeA=(document.documentElement.classList.contains('theme-light')?0.14:0.12)*dim;
      ctx2.strokeStyle=rgba(strokeCol,strokeA+(touchGlow>0.02?0.28*touchGlow:0));
      ctx2.lineWidth=Math.max(1,R*(touchGlow>0.02?0.0032:0.0026));
      pathPad({x:f.x,y:f.y,rx:prx,ry:pry,rot:f.rot},tf);ctx2.stroke();
      if(isDing){
        ctx2.fillStyle=rgba(strokeCol,0.32*dim);
        ctx2.beginPath();ctx2.arc(f.x,f.y,Math.max(1.4,R*0.011),0,Math.PI*2);ctx2.fill();
      }
      if(touchGlow>0.005){
        ctx2.save();
        ctx2.globalCompositeOperation='screen';
        const gold=ctx2.createRadialGradient(f.x-f.rx*0.12,f.y-f.ry*0.16,0,f.x,f.y,baseR*1.28);
        gold.addColorStop(0,rgba([theme.led.r,theme.led.g,theme.led.b],0.20*touchGlow));
        gold.addColorStop(0.55,rgba([theme.led.r,theme.led.g,theme.led.b],0.10*touchGlow));
        gold.addColorStop(1,rgba([theme.led.r,theme.led.g,theme.led.b],0));
        ctx2.fillStyle=gold;pathPad({x:f.x,y:f.y,rx:f.rx*1.08,ry:f.ry*1.08,rot:f.rot});ctx2.fill();
        ctx2.shadowColor=rgba([theme.led.r,theme.led.g,theme.led.b],0.32*touchGlow);
        ctx2.shadowBlur=baseR*0.28*touchGlow;
        ctx2.strokeStyle=rgba([theme.led.r,theme.led.g,theme.led.b],0.35*touchGlow);
        ctx2.lineWidth=Math.max(1.2,R*0.004*touchGlow);
        pathPad(f,tf);ctx2.stroke();
        ctx2.restore();
        if(touchGlow<0.025)touchLights.delete(Number(f.index));
      }
      if(glow>0.02){
        const hg=ctx2.createRadialGradient(f.x,f.y,0,f.x,f.y,baseR*1.4);
        const gc=theme.skin.glow||[[250,252,255],[200,220,250]];
        hg.addColorStop(0,rgba(mixLed(gc[0],theme.led,0.5),0.28*glow));hg.addColorStop(1,rgba(gc[1],0));
        ctx2.fillStyle=hg;pathPad({x:f.x,y:f.y,rx:f.rx*1.08,ry:f.ry*1.08,rot:f.rot},tf);ctx2.fill();
      }
      drawSlit(f,glow,playable);
    });
    ctx2.globalAlpha=1;
    drawRimGlow(performance.now()*0.001);
  }
  function drawCatchWaves(waves){
    if(!waves)return;
    for(const w of waves){
      const a=Math.max(0,1-(w.t||0));
      if(a<=0)continue;
      ctx2.strokeStyle=rgba([180,210,255],0.15*a);
      ctx2.lineWidth=2;
      ctx2.beginPath();ctx2.arc(w.x,w.y,(w.r||40)*(0.5+0.5*(w.t||0)),0,Math.PI*2);ctx2.stroke();
    }
  }
  function resize(w,h){
    W=w||canvas.clientWidth||800;H=h||canvas.clientHeight||800;
    const dpr=Math.min(2,window.devicePixelRatio||1);
    canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);
    ctx2.setTransform(dpr,0,0,dpr,0,0);
    const m=Math.min(W,H);R=m*0.37;CX=W*0.5;CY=H*0.48;
  }
  function armTransition(){armed=true}
  function hitVector(x,y){
    let best=null,bestD=1e9;
    for(const f of fields){
      const dx=x-f.x,dy=y-f.y;
      const c=Math.cos(-(f.rot||0)),s=Math.sin(-(f.rot||0));
      const lx=dx*c-dy*s,ly=dx*s+dy*c;
      const nx=lx/(f.rx||1),ny=ly/(f.ry||1);
      const d=nx*nx+ny*ny;
      if(d<1.38&&d<bestD){bestD=d;best=f}
    }
    return best;
  }
  function canvasCoords(a,b){
    const cx=(a&&typeof a==='object')?a.clientX:a;
    const cy=(a&&typeof a==='object')?a.clientY:b;
    const r=canvas.getBoundingClientRect();
    return{x:(cx-r.left)*(W/r.width),y:(cy-r.top)*(H/r.height)};
  }
  let _lastInst=null,_lastCatch=false,_mandalaRaf=0,_mandalaLast=0;
  const _origDrawBody=drawBody;
  function stopMandalaFrame(){
    if(_mandalaRaf) cancelAnimationFrame(_mandalaRaf);
    _mandalaRaf=0;
  }
  function scheduleMandalaFrame(){
    if(_mandalaRaf||reducedMotion||!mandalaEnabled()||document.hidden)return;
    _mandalaRaf=requestAnimationFrame(tickMandalaFrame);
  }
  function tickMandalaFrame(){
    _mandalaRaf=0;
    if(reducedMotion||!mandalaEnabled()||document.hidden)return;
    const now=performance.now();
    if(now-_mandalaLast>=33){
      _mandalaLast=now;
      if(_lastInst!=null)_origDrawBody(_lastInst,_lastCatch);
    }
    scheduleMandalaFrame();
  }
  drawBody=function(inst,catchActive){
    _lastInst=inst;_lastCatch=!!catchActive;
    _origDrawBody(inst,catchActive);
    if(mandalaEnabled()&&!reducedMotion)scheduleMandalaFrame();
    else stopMandalaFrame();
    if(touchRipples.length&&!rippleRaf)rippleRaf=requestAnimationFrame(tickRipples);
  };
  return{resize,layoutHandpanFields,armTransition,drawBody,drawCatchWaves,hitVector,canvasCoords,addRipple,
    get fields(){return fields},set fields(v){fields=v},setSlitPhase(){},get metrics(){return{W,H,R,CX,CY}}};
}
