/**
 * pionier-surface — palette skins, tonefields, two-pass pads
 */
import { MIN_NOTES, ringAngles, ringPadScale } from './pad-layout.js';
export const WORLD_ZONE_INDICES = [0, 1, 3, 5, 7];
const ADD_NOTE_MS = 520;

export function createSurface(canvas) {
  const ctx2 = canvas.getContext('2d');
  let W=800,H=800,R=0,CX=0,CY=0,fields=[],anim=null,armed=false,rimTime=0;
  let reducedMotion=false;
  try{reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches}catch(_){}
  const rimParticles=Array.from({length:reducedMotion?24:40},(_,i)=>({
    a:(i/40)*Math.PI*2+Math.random()*0.04,rJ:(Math.random()-0.5)*0.012,
    size:0.55+Math.random()*0.55,phase:Math.random()*Math.PI*2,
    speed:0.18+Math.random()*0.12,gold:Math.random()<0.35
  }));

  function getTheme(){
    const s=(typeof window!=='undefined'&&window.PionierSettings)||{};
    const led=s.led||{r:110,g:200,b:255};
    const skinId=s.skin||document.documentElement?.dataset?.skin||'classic';
    const toneId=s.tonefield||document.documentElement?.dataset?.tonefield||'classic';
    const alphaIn=s.transparency!=null?s.transparency:1;
    const palette=(typeof window!=='undefined'&&window.PionierSkinPalette)||{};
    const fallback={body:['#6a6e7a','#2e323c','#0e1014'],rim:[240,246,255],pad:[[175,182,198],[88,92,105],[38,40,48]],lip:[200,208,222],stroke:[230,236,248],glow:[[250,252,255],[200,220,250]],sheen:0.2};
    const skin=palette[skinId]||palette.classic||fallback;
    return{skin,led:{r:led.r|0,g:led.g|0,b:led.b|0},tonefield:toneId,alpha:Number.isFinite(+alphaIn)?+alphaIn:1};
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
  function softTone(st){
    const ok={classic:1,round:1,petal:1,teardrop:1,seed:1,halo:1};
    return ok[st]?st:'classic';
  }
  function pathPad(f,st){
    st=softTone(st||window.PionierSettings?.tonefield||'classic');
    const{x,y,rx,ry}=f;const rot=f.rot||0;
    ctx2.beginPath();
    if(st==='round'){const r=Math.max(rx,ry)*0.92;ctx2.ellipse(x,y,r,r,0,0,Math.PI*2)}
    else if(st==='petal')ctx2.ellipse(x,y,rx*0.75,ry*1.25,rot,0,Math.PI*2);
    else if(st==='teardrop')ctx2.ellipse(x,y-ry*0.15,rx*0.85,ry*1.1,rot,0,Math.PI*2);
    else if(st==='seed')ctx2.ellipse(x,y,rx*0.7,ry*1.28,rot,0,Math.PI*2);
    else if(st==='halo'){ctx2.ellipse(x,y,rx,ry,rot,0,Math.PI*2);ctx2.ellipse(x,y,rx*0.5,ry*0.5,rot,0,Math.PI*2,true)}
    else ctx2.ellipse(x,y,rx,ry,rot,0,Math.PI*2);
  }
  function drawBodyEngraving(theme){
    const cat=window.PionierCatalog;
    const skinId=(window.PionierSettings&&window.PionierSettings.skin)||document.documentElement?.dataset?.skin||'classic';
    const entry=cat&&cat.SKINS?cat.SKINS.find(s=>s.id===skinId):null;
    const style=(entry&&entry.mandala)||'orbit';
    const col=theme.skin.rim||[230,236,248];
    const aBase=0.07;
    ctx2.save();
    ctx2.globalCompositeOperation='source-over';
    ctx2.lineCap='round';
    ctx2.lineJoin='round';
    const t=performance.now()*0.00025;
    if(style==='rings'||style==='orbit'){
      for(let i=0;i<5;i++){
        const rr=R*(0.28+i*0.12);
        ctx2.strokeStyle=rgba(col,aBase*(0.6+i*0.08));
        ctx2.lineWidth=Math.max(0.6,R*0.0022);
        ctx2.beginPath();ctx2.arc(CX,CY,rr,0,Math.PI*2);ctx2.stroke();
      }
    } else if(style==='petal'||style==='bloom'){
      const petals=8;
      for(let i=0;i<petals;i++){
        const a=(i/petals)*Math.PI*2+t;
        ctx2.strokeStyle=rgba(col,aBase*0.9);
        ctx2.lineWidth=Math.max(0.55,R*0.002);
        ctx2.beginPath();
        ctx2.ellipse(CX+Math.cos(a)*R*0.12,CY+Math.sin(a)*R*0.12,R*0.18,R*0.38,a,0,Math.PI*2);
        ctx2.stroke();
      }
    } else if(style==='star'){
      for(let layer=0;layer<2;layer++){
        const outer=R*(0.55+layer*0.12),inner=outer*0.42,pts=8;
        ctx2.beginPath();
        for(let i=0;i<pts*2;i++){
          const a=(i/(pts*2))*Math.PI*2-Math.PI/2+t*(layer%2?-1:1);
          const r=i%2===0?outer:inner;
          const x=CX+Math.cos(a)*r,y=CY+Math.sin(a)*r;
          i?ctx2.lineTo(x,y):ctx2.moveTo(x,y);
        }
        ctx2.closePath();
        ctx2.strokeStyle=rgba(col,aBase*0.85);
        ctx2.lineWidth=Math.max(0.55,R*0.002);ctx2.stroke();
      }
    } else if(style==='spiral'){
      for(let arm=0;arm<3;arm++){
        ctx2.beginPath();
        const base=(arm/3)*Math.PI*2+t;
        for(let i=0;i<60;i++){
          const p=i/60,a=base+p*Math.PI*2.8,r=R*0.15+p*R*0.62;
          const x=CX+Math.cos(a)*r,y=CY+Math.sin(a)*r;
          i?ctx2.lineTo(x,y):ctx2.moveTo(x,y);
        }
        ctx2.strokeStyle=rgba(col,aBase*0.9);
        ctx2.lineWidth=Math.max(0.55,R*0.0022);ctx2.stroke();
      }
    } else {
      for(let ring=0;ring<4;ring++){
        const baseR=R*(0.32+ring*0.12);
        ctx2.beginPath();
        for(let i=0;i<=48;i++){
          const a=(i/48)*Math.PI*2;
          const wave=Math.sin(a*4+t*3+ring)*R*0.012;
          const r=baseR+wave;
          const x=CX+Math.cos(a)*r,y=CY+Math.sin(a)*r;
          i?ctx2.lineTo(x,y):ctx2.moveTo(x,y);
        }
        ctx2.closePath();
        ctx2.strokeStyle=rgba(col,aBase*(0.7+ring*0.08));
        ctx2.lineWidth=Math.max(0.55,R*0.002);ctx2.stroke();
      }
    }
    ctx2.restore();
  }
  function layoutHandpanFields(handpanNotes,isFieldPlayable){
    const list=handpanNotes||[];const wasArmed=armed;armed=false;
    const previous=wasArmed&&fields.length?fields.map(f=>({...f})):null;
    const stock=list.slice(0,MIN_NOTES||9);
    const midis=stock.map(n=>n.midi).filter(m=>m!=null);
    const midiMin=midis.length?Math.min(...midis):48,midiMax=midis.length?Math.max(...midis):72;
    const midiSpan=Math.max(1,midiMax-midiMin),ringCount=Math.max(1,list.length-1);
    let angles,padScale;
    try{angles=ringAngles(ringCount);padScale=ringPadScale(ringCount)}
    catch(_){angles=Array.from({length:ringCount},(_,i)=>(i/ringCount)*360);padScale=1}
    fields=list.map((n,pos)=>{
      const low=Math.max(0,Math.min(1,(midiMax-(n.midi||60))/midiSpan));
      const size=1.12+low*0.36;
      const playable=typeof isFieldPlayable==='function'?isFieldPlayable(n.index):true;
      if(n.kind==='ding'){const rr=R*0.185*size;return{i:n.index,index:n.index,x:CX,y:CY,rx:rr,ry:rr,rot:0,label:n.name,playable,kind:'ding'}}
      const slot=(n.index!=null?n.index:pos)-1;
      const deg=angles[slot]!=null?angles[slot]:(slot/ringCount)*360;
      const a=(deg*Math.PI)/180,d=R*0.58;
      const ux=Math.sin(a),uy=-Math.cos(a);
      return{i:n.index,index:n.index,x:CX+ux*d,y:CY+uy*d,rx:R*0.155*size*padScale,ry:R*0.112*size*padScale,rot:Math.atan2(uy,ux),ux,uy,label:n.name,playable,kind:'ring'};
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
    const halo=ctx2.createRadialGradient(CX,CY,rimR*0.92,CX,CY,rimR*1.06);
    halo.addColorStop(0,rgba(lc,0));halo.addColorStop(0.7,rgba(mixLed([230,236,248],th.led,0.5),0.04*breath));halo.addColorStop(1,rgba(lc,0));
    ctx2.fillStyle=halo;ctx2.beginPath();ctx2.arc(CX,CY,rimR*1.08,0,Math.PI*2);ctx2.arc(CX,CY,rimR*0.88,0,Math.PI*2,true);ctx2.fill();
    for(const p of rimParticles){
      const a=breath*(0.55+0.45*Math.sin(rimTime*p.speed+p.phase))*0.22;
      if(a<0.01)continue;
      const x=CX+Math.cos(p.a)*rimR*(1+p.rJ),y=CY+Math.sin(p.a)*rimR*(1+p.rJ);
      const s=Math.max(0.6,R*0.0045*p.size);
      const col=p.gold?rgba(mixLed([228,205,140],th.led,0.35),a):rgba(mixLed(lc,th.led,0.15),a);
      const grad=ctx2.createRadialGradient(x,y,0,x,y,s*3.2);
      grad.addColorStop(0,col);grad.addColorStop(1,rgba(lc,0));
      ctx2.fillStyle=grad;ctx2.beginPath();ctx2.arc(x,y,s*3.2,0,Math.PI*2);ctx2.fill();
    }
    ctx2.restore();
  }
  function drawBody(inst,catchActive){
    ctx2.clearRect(0,0,W,H);
    const theme=getTheme(),tf=theme.tonefield||'classic';
    const g=ctx2.createRadialGradient(CX-R*0.2,CY-R*0.28,R*0.04,CX,CY,R);
    g.addColorStop(0,theme.skin.body[0]);g.addColorStop(0.5,theme.skin.body[1]);g.addColorStop(1,theme.skin.body[2]);
    ctx2.fillStyle=g;ctx2.beginPath();ctx2.arc(CX,CY,R,0,Math.PI*2);ctx2.fill();
    drawBodyEngraving(theme);
    ctx2.strokeStyle=rgba(theme.skin.rim,0.28);ctx2.lineWidth=Math.max(2,R*0.013);
    ctx2.beginPath();ctx2.arc(CX,CY,R*0.93,0,Math.PI*2);ctx2.stroke();
    const view=animatedView(performance.now());
    ctx2.globalCompositeOperation='source-over';
    ctx2.globalAlpha=(theme.alpha!=null?theme.alpha:1)*(catchActive?0.88:1);
    view.forEach(f=>{
      const isDing=f.kind==='ding',playable=f.playable!==false;
      const dim=(playable?1:0.32)*(f.appear??1);
      const hlx=f.ux!=null?f.ux:-0.35,hly=f.uy!=null?f.uy:-0.45,baseR=Math.max(f.rx,f.ry);
      const lipCol=theme.skin.lip||theme.skin.stroke;
      ctx2.fillStyle=rgba(theme.skin.pad[2],0.95*dim);
      pathPad({x:f.x,y:f.y,rx:f.rx*1.08,ry:f.ry*1.08,rot:f.rot},tf);ctx2.fill();
      const pad=ctx2.createRadialGradient(f.x+hlx*f.rx*0.38,f.y+hly*f.ry*0.38,0,f.x,f.y,baseR);
      pad.addColorStop(0,rgba(theme.skin.pad[0],dim));pad.addColorStop(0.45,rgba(theme.skin.pad[1],dim));
      pad.addColorStop(0.85,rgba(theme.skin.pad[2],dim));pad.addColorStop(1,rgba(theme.skin.pad[2],0.92*dim));
      ctx2.fillStyle=pad;pathPad(f,tf);ctx2.fill();
      ctx2.strokeStyle=rgba(lipCol,0.55*dim);ctx2.lineWidth=Math.max(1.2,R*0.0045);
      pathPad(f,tf);ctx2.stroke();
      const glow=inst&&inst.glow?inst.glow[f.index]||0:0;
      if(glow>0.02){
        const hg=ctx2.createRadialGradient(f.x,f.y,0,f.x,f.y,baseR*1.4);
        const gc=theme.skin.glow||[[250,252,255],[200,220,250]];
        hg.addColorStop(0,rgba(mixLed(gc[0],theme.led,0.5),0.35*glow));hg.addColorStop(1,rgba(gc[1],0));
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
    const m=Math.min(W,H);R=m*0.42;CX=W*0.5;CY=H*0.46;
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
      if(d<1.15&&d<bestD){bestD=d;best=f}
    }
    return best;
  }
  function canvasCoords(clientX,clientY){
    const r=canvas.getBoundingClientRect();
    return{x:(clientX-r.left)*(W/r.width),y:(clientY-r.top)*(H/r.height)};
  }
  return{resize,layoutHandpanFields,armTransition,drawBody,drawCatchWaves,hitVector,canvasCoords,
    get fields(){return fields},get metrics(){return{W,H,R,CX,CY}}};
}
