
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
  function mandalaStyle(){
    const cat=window.PionierCatalog;
    const skinId=(window.PionierSettings&&window.PionierSettings.skin)||document.documentElement?.dataset?.skin||'classic';
    const entry=cat&&cat.SKINS?cat.SKINS.find(s=>s.id===skinId):null;
    let style=(entry&&entry.mandala)||'orbit';
    if(style==='star') style='lotus';
    return style;
  }
  function mandalaEnabled(){
    const s=window.PionierSettings;
    return !(s&&s.mandala===false);
  }
  function drawHandpanMandala(theme){
    if(!mandalaEnabled()||R<20) return;
    const style=mandalaStyle();
    const col=theme.skin.rim||[230,236,248];
    const lip=theme.skin.lip||col;
    const t=performance.now()*0.00018;
    const breath=0.5+0.5*Math.sin(t*1.1);
    ctx2.save();
    ctx2.beginPath();
    ctx2.arc(CX,CY,R*0.92,0,Math.PI*2);
    ctx2.clip();
    ctx2.lineCap='round';
    ctx2.lineJoin='round';
    ctx2.globalCompositeOperation='source-over';
    const stroke=(a,w)=>{ ctx2.strokeStyle=rgba(col,a); ctx2.lineWidth=Math.max(0.45,R*w); };
    const fillSoft=(a)=>{ ctx2.fillStyle=rgba(col,a); };
    {
      const g=ctx2.createRadialGradient(CX,CY,0,CX,CY,R*0.22);
      g.addColorStop(0,rgba(lip,0.04+breath*0.02));
      g.addColorStop(1,rgba(col,0));
      ctx2.fillStyle=g;
      ctx2.beginPath();ctx2.arc(CX,CY,R*0.22,0,Math.PI*2);ctx2.fill();
    }
    if(style==='orbit'){
      for(let ring=0;ring<7;ring++){
        const rr=R*(0.22+ring*0.09)*(0.98+breath*0.02);
        stroke(0.045+ring*0.008,0.0018);
        ctx2.beginPath();ctx2.arc(CX,CY,rr,0,Math.PI*2);ctx2.stroke();
        const n=6+ring*2;
        const spin=t*(0.3+ring*0.05)*(ring%2?-1:1);
        for(let i=0;i<n;i++){
          const a=spin+(i/n)*Math.PI*2;
          const x=CX+Math.cos(a)*rr,y=CY+Math.sin(a)*rr;
          const pr=Math.max(0.8,R*0.006);
          const dg=ctx2.createRadialGradient(x,y,0,x,y,pr*3);
          dg.addColorStop(0,rgba(col,0.08));
          dg.addColorStop(1,rgba(col,0));
          ctx2.fillStyle=dg;
          ctx2.beginPath();ctx2.arc(x,y,pr*3,0,Math.PI*2);ctx2.fill();
        }
      }
    } else if(style==='rings'){
      for(let i=0;i<9;i++){
        const rr=R*(0.18+i*0.075)*(0.97+breath*0.03);
        stroke(0.035+(i%3)*0.015,0.0016+(i%2)*0.0006);
        ctx2.beginPath();ctx2.arc(CX,CY,rr,0,Math.PI*2);ctx2.stroke();
      }
      const rr=R*0.55;
      const n=18,spin=t*0.25;
      for(let i=0;i<n;i++){
        const a=spin+(i/n)*Math.PI*2;
        fillSoft(0.06);
        ctx2.beginPath();ctx2.arc(CX+Math.cos(a)*rr,CY+Math.sin(a)*rr,Math.max(0.7,R*0.005),0,Math.PI*2);ctx2.fill();
      }
    } else if(style==='petal'||style==='bloom'){
      const layers=style==='bloom'?3:2;
      for(let L=0;L<layers;L++){
        const petals=6+L*2;
        const spin=t*0.22*(L%2?-1:1);
        const reach=R*(0.28+L*0.12)*(0.96+breath*0.04);
        for(let i=0;i<petals;i++){
          const a=spin+(i/petals)*Math.PI*2;
          stroke(0.05+L*0.015,0.0017);
          ctx2.beginPath();
          ctx2.ellipse(CX+Math.cos(a)*reach*0.35,CY+Math.sin(a)*reach*0.35,reach*0.22,reach*0.48,a,0,Math.PI*2);
          ctx2.stroke();
        }
      }
      stroke(0.05,0.0018);
      ctx2.beginPath();ctx2.arc(CX,CY,R*0.16*(0.95+breath*0.05),0,Math.PI*2);ctx2.stroke();
    } else if(style==='spiral'){
      for(let arm=0;arm<4;arm++){
        ctx2.beginPath();
        const base=(arm/4)*Math.PI*2+t*0.35;
        for(let i=0;i<90;i++){
          const p=i/90;
          const a=base+p*Math.PI*3.2;
          const r=R*0.12+p*R*0.68;
          const x=CX+Math.cos(a)*r,y=CY+Math.sin(a)*r;
          i?ctx2.lineTo(x,y):ctx2.moveTo(x,y);
        }
        stroke(0.055,0.002);
        ctx2.stroke();
      }
      for(let i=0;i<4;i++){
        stroke(0.03,0.0015);
        ctx2.beginPath();ctx2.arc(CX,CY,R*(0.25+i*0.14),0,Math.PI*2);ctx2.stroke();
      }
    } else if(style==='wave'){
      for(let ring=0;ring<6;ring++){
        const baseR=R*(0.24+ring*0.1);
        ctx2.beginPath();
        for(let i=0;i<=64;i++){
          const a=(i/64)*Math.PI*2;
          const wave=Math.sin(a*5+t*2.2+ring*0.7)*R*0.014*(0.7+breath*0.3);
          const r=baseR+wave;
          const x=CX+Math.cos(a)*r,y=CY+Math.sin(a)*r;
          i?ctx2.lineTo(x,y):ctx2.moveTo(x,y);
        }
        ctx2.closePath();
        stroke(0.04+ring*0.008,0.0017);
        ctx2.stroke();
      }
    } else if(style==='lotus'){
      for(let L=0;L<4;L++){
        const petals=8;
        const spin=t*0.18*(L%2?-1:1)+L*0.2;
        const reach=R*(0.2+L*0.14);
        for(let i=0;i<petals;i++){
          const a=spin+(i/petals)*Math.PI*2;
          stroke(0.04+L*0.01,0.0016);
          ctx2.beginPath();
          ctx2.ellipse(CX+Math.cos(a)*reach*0.28,CY+Math.sin(a)*reach*0.28,reach*0.2,reach*0.42,a,0,Math.PI*2);
          ctx2.stroke();
        }
      }
      stroke(0.055,0.002);
      ctx2.beginPath();ctx2.arc(CX,CY,R*0.12,0,Math.PI*2);ctx2.stroke();
    } else if(style==='vesica'){
      for(let ring=1;ring<=3;ring++){
        if(ring===1){
          stroke(0.06,0.0018);
          ctx2.beginPath();ctx2.arc(CX,CY,R*0.18,0,Math.PI*2);ctx2.stroke();
        } else {
          const spin=t*0.12*(ring%2?-1:1);
          for(let i=0;i<6;i++){
            const a=spin+(i/6)*Math.PI*2;
            const x=CX+Math.cos(a)*R*0.18*(ring-1);
            const y=CY+Math.sin(a)*R*0.18*(ring-1);
            stroke(0.04+ring*0.008,0.0015);
            ctx2.beginPath();ctx2.arc(x,y,R*0.18,0,Math.PI*2);ctx2.stroke();
          }
        }
      }
      stroke(0.05,0.0017);
      ctx2.beginPath();ctx2.arc(CX,CY,R*0.54,0,Math.PI*2);ctx2.stroke();
    } else if(style==='halo'){
      for(let i=0;i<8;i++){
        const rr=R*(0.2+i*0.08);
        const pulse=0.03+0.025*Math.sin(t*1.4+i*0.5);
        stroke(pulse,0.002+0.0004*(i%2));
        ctx2.beginPath();ctx2.arc(CX,CY,rr*(0.98+breath*0.02),0,Math.PI*2);ctx2.stroke();
      }
    } else if(style==='beads'){
      for(let ring=0;ring<5;ring++){
        const rr=R*(0.28+ring*0.12);
        stroke(0.03,0.0014);
        ctx2.beginPath();ctx2.arc(CX,CY,rr,0,Math.PI*2);ctx2.stroke();
        const n=8+ring*4;
        const spin=t*0.2*(ring%2?-1:1);
        for(let i=0;i<n;i++){
          const a=spin+(i/n)*Math.PI*2;
          const x=CX+Math.cos(a)*rr,y=CY+Math.sin(a)*rr;
          const pr=Math.max(0.9,R*(0.008-ring*0.0006));
          const dg=ctx2.createRadialGradient(x,y,0,x,y,pr*2.5);
          dg.addColorStop(0,rgba(col,0.09));
          dg.addColorStop(1,rgba(col,0));
          ctx2.fillStyle=dg;
          ctx2.beginPath();ctx2.arc(x,y,pr*2.5,0,Math.PI*2);ctx2.fill();
        }
      }
    } else {
      for(let i=0;i<6;i++){
        stroke(0.04+i*0.006,0.0016);
        ctx2.beginPath();ctx2.arc(CX,CY,R*(0.25+i*0.1),0,Math.PI*2);ctx2.stroke();
      }
    }
    ctx2.restore();
  }
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
  // Premium shell finish: restrained radial sheen + full-disc micro-engraving.
  // Drawn beneath tonefields; this does not change field geometry or hit testing.
  function drawSurfaceFinish(theme){
    if(R<20)return;
    const lip=theme.skin.lip||theme.skin.rim||[230,236,248];
    const phase=reducedMotion?0.5:0.5+0.5*Math.sin(performance.now()*0.00022);
    ctx2.save();
    ctx2.beginPath();ctx2.arc(CX,CY,R*0.925,0,Math.PI*2);ctx2.clip();
    ctx2.globalCompositeOperation='screen';
    const sheen=ctx2.createRadialGradient(CX-R*0.34,CY-R*0.42,R*0.025,CX-R*0.18,CY-R*0.12,R*1.12);
    sheen.addColorStop(0,rgba([255,248,232],0.055+phase*0.012));
    sheen.addColorStop(0.36,rgba(lip,0.018));
    sheen.addColorStop(1,rgba(lip,0));
    ctx2.fillStyle=sheen;ctx2.beginPath();ctx2.arc(CX,CY,R*0.925,0,Math.PI*2);ctx2.fill();

    // Fine concentric lathe marks read as brushed metal, not a bright overlay.
    ctx2.globalCompositeOperation='source-over';
    ctx2.lineWidth=Math.max(0.45,R*0.00105);
    for(let i=0;i<13;i++){
      const rr=R*(0.13+i*0.059);
      ctx2.strokeStyle=rgba(lip,0.012+(i%3===0?0.012:0)+phase*0.004);
      ctx2.beginPath();ctx2.arc(CX,CY,rr,0,Math.PI*2);ctx2.stroke();
    }

    // Precision perimeter etching: radial index marks and a quiet guilloche band
    // extend the engraved language across the shoulder without crossing touch pads.
    const tickCount=48;
    for(let i=0;i<tickCount;i++){
      const a=(i/tickCount)*Math.PI*2;
      const major=i%4===0;
      const inner=R*(major?0.805:0.825);
      const outer=R*(major?0.875:0.855);
      ctx2.strokeStyle=rgba(lip,major?0.065:0.028);
      ctx2.lineWidth=Math.max(0.45,R*(major?0.0022:0.00125));
      ctx2.beginPath();
      ctx2.moveTo(CX+Math.cos(a)*inner,CY+Math.sin(a)*inner);
      ctx2.lineTo(CX+Math.cos(a)*outer,CY+Math.sin(a)*outer);
      ctx2.stroke();
    }
    for(let i=0;i<24;i++){
      const a=(i/24)*Math.PI*2;
      const x=CX+Math.cos(a)*R*0.755;
      const y=CY+Math.sin(a)*R*0.755;
      ctx2.save();ctx2.translate(x,y);ctx2.rotate(a+Math.PI/2);
      ctx2.strokeStyle=rgba(lip,0.022+phase*0.008);
      ctx2.lineWidth=Math.max(0.45,R*0.0014);
      ctx2.beginPath();
      ctx2.ellipse(0,0,R*0.023,R*0.058,0,0,Math.PI*2);
      ctx2.stroke();
      ctx2.restore();
    }

    // A soft moving sheen creates a living metallic finish; movement is tiny,
    // slow, and suppressed for reduced-motion preferences.
    if(!reducedMotion){
      const sweep=(Math.sin(materialTime*1.7)+1)*0.5;
      const sheenX=CX-R*0.45+sweep*R*0.9;
      const sheenY=CY-R*0.55;
      const gloss=ctx2.createRadialGradient(sheenX,sheenY,0,sheenX,sheenY,R*0.72);
      gloss.addColorStop(0,rgba([255,248,232],0.018));
      gloss.addColorStop(0.42,rgba(lip,0.012));
      gloss.addColorStop(1,rgba(lip,0));
      ctx2.fillStyle=gloss;
      ctx2.beginPath();ctx2.arc(CX,CY,R*0.925,0,Math.PI*2);ctx2.fill();
    }

    // A broken specular arc catches the upper shoulder of the shell.
    ctx2.strokeStyle=rgba([255,248,232],0.035+phase*0.025);
    ctx2.lineWidth=Math.max(0.7,R*0.0022);
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
    const materialTime=reducedMotion?0:performance.now()*0.00011;
    const lightX=CX-R*(0.2+Math.sin(materialTime)*0.045);
    const lightY=CY-R*(0.28+Math.cos(materialTime*0.83)*0.035);
    const g=ctx2.createRadialGradient(lightX,lightY,R*0.025,CX+R*0.04,CY+R*0.02,R*1.02);
    g.addColorStop(0,theme.skin.body[0]);
    g.addColorStop(0.36,theme.skin.body[0]);
    g.addColorStop(0.67,theme.skin.body[1]);
    g.addColorStop(1,theme.skin.body[2]);
    ctx2.fillStyle=g;ctx2.beginPath();ctx2.arc(CX,CY,R,0,Math.PI*2);ctx2.fill();
    drawHandpanMandala(theme);
    drawSurfaceFinish(theme);
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
  function canvasCoords(a,b){
    // Accepts a pointer event (what pionier-core passes) OR (clientX, clientY)
    const cx=(a&&typeof a==='object')?a.clientX:a;
    const cy=(a&&typeof a==='object')?a.clientY:b;
    const r=canvas.getBoundingClientRect();
    return{x:(cx-r.left)*(W/r.width),y:(cy-r.top)*(H/r.height)};
  }
  let _lastInst=null,_lastCatch=false,_mandalaRaf=0,_mandalaLast=0;
  const _origDrawBody=drawBody;
  drawBody=function(inst,catchActive){
    _lastInst=inst;_lastCatch=!!catchActive;
    _origDrawBody(inst,catchActive);
    if(mandalaEnabled()&&!_mandalaRaf&&!reducedMotion){
      _mandalaLast=performance.now();
      const tick=(now)=>{
        _mandalaRaf=requestAnimationFrame(tick);
        if(!mandalaEnabled()){cancelAnimationFrame(_mandalaRaf);_mandalaRaf=0;return;}
        if(now-_mandalaLast<55) return;
        _mandalaLast=now;
        try{
          if(window.PionierCore&&typeof window.PionierCore.draw==='function') window.PionierCore.draw();
          else if(_lastInst!=null) _origDrawBody(_lastInst,_lastCatch);
        }catch(_){}
      };
      _mandalaRaf=requestAnimationFrame(tick);
    }
  };
  return{resize,layoutHandpanFields,armTransition,drawBody,drawCatchWaves,hitVector,canvasCoords,
    get fields(){return fields},set fields(v){fields=v},setSlitPhase(){},get metrics(){return{W,H,R,CX,CY}}};
}
