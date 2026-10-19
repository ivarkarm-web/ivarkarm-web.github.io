
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
  function mandalaStyle(){const s=window.PionierSettings||{};return ['glow','petals','sacred','orbit','wave'].includes(s.auraStyle)?s.auraStyle:'petals';}
  function mandalaEnabled(){const s=window.PionierSettings;return !(s&&s.mandala===false);}
  // Intricate, slowly animated ornamentation outside the metal shell.
  // Wave Filigree is the visual benchmark: layered curves, rhythm and fine detail.
  function drawHandpanMandala(theme){
    if(!mandalaEnabled()||R<20)return;
    const style=mandalaStyle(),base=theme.skin.rim||[230,236,248],t=performance.now()*0.001;
    const led=[theme.led.r,theme.led.g,theme.led.b],col=mixLed(base,led,0.24);
    const breath=0.5+0.5*Math.sin(t*0.42),rim=R*1.065;
    ctx2.save();ctx2.translate(CX,CY);ctx2.rotate(t*0.018);ctx2.globalCompositeOperation='screen';
    ctx2.lineCap='round';ctx2.lineJoin='round';ctx2.globalAlpha=0.72+breath*0.25;
    const stroke=(a,w)=>{ctx2.strokeStyle=rgba(col,a);ctx2.lineWidth=Math.max(0.75,R*w);};
    const fill=(a)=>{ctx2.fillStyle=rgba(col,a);};
    const polar=(a,r)=>({x:Math.cos(a)*r,y:Math.sin(a)*r});
    const curveRing=(fn,alpha,width,steps=240)=>{
      ctx2.beginPath();
      for(let i=0;i<=steps;i++){const a=i/steps*Math.PI*2,r=fn(a,i),p=polar(a,r);if(i===0)ctx2.moveTo(p.x,p.y);else ctx2.lineTo(p.x,p.y);}
      ctx2.closePath();stroke(alpha,width);ctx2.stroke();
    };
    const bead=(x,y,r,alpha)=>{
      const g=ctx2.createRadialGradient(x-r*0.25,y-r*0.3,0,x,y,r*2.2);
      g.addColorStop(0,rgba([255,255,255],alpha*0.72));g.addColorStop(0.24,rgba(col,alpha));g.addColorStop(1,rgba(col,0));
      ctx2.fillStyle=g;ctx2.beginPath();ctx2.arc(x,y,r*2.2,0,Math.PI*2);ctx2.fill();
    };
    // Fine double rail is shared by every style to visually bind the ornament to the rim.
    for(let j=0;j<2;j++){ctx2.beginPath();ctx2.arc(0,0,rim*(0.997+j*0.018),0,Math.PI*2);stroke(j?0.19:0.29,j?0.0015:0.0021);ctx2.stroke();}
    if(style==='glow'){
      // Aurora filaments: three interwoven, softly breathing waves rather than plain rings.
      for(let layer=0;layer<5;layer++){
        const phase=t*(0.18+layer*0.025)+layer*1.18;
        curveRing((a)=>rim*(1.024+layer*0.012)+R*(0.007+layer*0.0015)*Math.sin(a*(7+layer%3)+phase)*Math.cos(a*3-phase*0.7),0.13+layer*0.035,0.00135+layer*0.00012,280);
      }
      for(let arc=0;arc<12;arc++){
        const a=arc/12*Math.PI*2+Math.sin(t*0.2+arc)*0.025,p=polar(a,rim*1.075),q=polar(a+0.17,rim*1.105),m=polar(a+0.085,rim*1.13);
        ctx2.beginPath();ctx2.moveTo(p.x,p.y);ctx2.quadraticCurveTo(m.x,m.y,q.x,q.y);stroke(0.36+breath*0.12,0.0025);ctx2.stroke();
        bead(m.x,m.y,R*(arc%3===0?0.009:0.0045),0.48);
      }
      const halo=ctx2.createRadialGradient(0,0,rim*1.01,0,0,rim*1.15);
      halo.addColorStop(0,rgba(col,0));halo.addColorStop(0.55,rgba(col,0.055+breath*0.035));halo.addColorStop(1,rgba(col,0));
      ctx2.fillStyle=halo;ctx2.beginPath();ctx2.arc(0,0,rim*1.15,0,Math.PI*2);ctx2.fill();
    }else if(style==='petals'){
      // Lace-like pointed petals with inner veins, crossing shoulders and seed pearls.
      for(let i=0;i<24;i++){
        const a=i/24*Math.PI*2,dr=0.004*Math.sin(t*0.45+i*0.9),inner=rim*(1.008+dr),outer=rim*(1.105+dr),side=R*0.027;
        const p0=polar(a,inner),tip=polar(a+0.006,outer),left=polar(a-0.052,rim*1.055),right=polar(a+0.052,rim*1.055);
        ctx2.beginPath();ctx2.moveTo(p0.x,p0.y);ctx2.quadraticCurveTo(left.x-side*Math.sin(a),left.y+side*Math.cos(a),tip.x,tip.y);
        ctx2.quadraticCurveTo(right.x+side*Math.sin(a),right.y-side*Math.cos(a),p0.x,p0.y);
        stroke(0.37+breath*0.13,0.0023);ctx2.stroke();
        const v1=polar(a-0.023,rim*1.035),v2=polar(a+0.023,rim*1.035);
        ctx2.beginPath();ctx2.moveTo(v1.x,v1.y);ctx2.quadraticCurveTo(p0.x,p0.y,tip.x,tip.y);ctx2.quadraticCurveTo(p0.x,p0.y,v2.x,v2.y);stroke(0.22,0.00125);ctx2.stroke();
        if(i%2===0){const pearl=polar(a,outer*1.012);bead(pearl.x,pearl.y,R*0.0048,0.44);}
      }
      curveRing(a=>rim*(1.055+0.012*Math.cos(a*24+t*0.3)),0.23,0.0014);
    }else if(style==='sacred'){
      // Interlocking vesica arcs, rotating star polygons and a delicate radial lattice.
      for(let i=0;i<24;i++){
        const a=i/24*Math.PI*2,center=polar(a,rim*1.065),rad=R*0.052;
        ctx2.save();ctx2.translate(center.x,center.y);ctx2.rotate(a+t*0.035);
        ctx2.beginPath();ctx2.ellipse(0,0,rad*0.42,rad,0,0,Math.PI*2);stroke(0.34,0.0017);ctx2.stroke();
        ctx2.beginPath();ctx2.ellipse(0,0,rad*0.42,rad,Math.PI/3,0,Math.PI*2);stroke(0.23,0.0012);ctx2.stroke();
        ctx2.beginPath();ctx2.moveTo(0,-rad*0.8);ctx2.lineTo(rad*0.28,0);ctx2.lineTo(0,rad*0.8);ctx2.lineTo(-rad*0.28,0);ctx2.closePath();stroke(0.36,0.0015);ctx2.stroke();
        ctx2.restore();
      }
      for(let ring=0;ring<3;ring++){
        const rr=rim*(1.018+ring*0.027);
        curveRing(a=>rr+R*(0.004+ring*0.001)*Math.cos(a*(12+ring*6)+t*0.12+ring),0.13+ring*0.045,0.00125+ring*0.00018);
      }
      for(let i=0;i<48;i++){
        const a=i/48*Math.PI*2,p=polar(a,rim*(1.035+0.008*Math.sin(a*12+t*0.2)));
        if(i%2===0)bead(p.x,p.y,R*(i%6===0?0.0065:0.0034),0.4);
      }
    }else if(style==='orbit'){
      // Orbital ellipses and connected moving satellites create a small celestial mechanism.
      for(let k=0;k<4;k++){
        ctx2.save();ctx2.rotate(k*Math.PI/4+t*(k%2?0.004:-0.003));
        ctx2.beginPath();ctx2.ellipse(0,0,rim*(1.035+k*0.009),R*(0.036+k*0.009),0,0,Math.PI*2);
        stroke(0.17+k*0.035,0.00135+k*0.00016);ctx2.stroke();ctx2.restore();
      }
      for(let orbit=0;orbit<3;orbit++){
        const count=12+orbit*4,phase=-t*(0.065+orbit*0.02)+orbit*1.7,rr=rim*(1.045+orbit*0.019);
        let previous=null;
        for(let i=0;i<=count;i++){
          const a=i/count*Math.PI*2+phase,p=polar(a,rr+R*0.008*Math.sin(a*3+t*0.07));
          if(previous&&i%2===0){ctx2.beginPath();ctx2.moveTo(previous.x,previous.y);ctx2.lineTo(p.x,p.y);stroke(0.13,0.0011);ctx2.stroke();}
          if(i<count&&i%(orbit+2)===0)bead(p.x,p.y,R*(i%4===0?0.008:0.0042),0.52);
          previous=p;
        }
      }
      curveRing(a=>rim*(1.01+0.014*Math.sin(a*18-t*0.28)),0.19,0.0015);
    }else if(style==='wave'){
      // The signature filigree: three nested, fluid harmonic ribbons.
      for(let ring=0;ring<3;ring++){
        curveRing(a=>rim*(1.005+ring*0.021)+Math.sin(a*12-t*0.45+ring*1.2)*R*0.009+Math.sin(a*24+t*0.18-ring)*R*0.0028,0.17+ring*0.07,0.0018+ring*0.00025);
      }
      // Small alternating curls along the outer wave give the silhouette its fine, hand-drawn edge.
      for(let i=0;i<48;i++){
        const a=i/48*Math.PI*2,rr=rim*1.055+Math.sin(a*12-t*0.45)*R*0.009,p=polar(a,rr),q=polar(a+0.032,rr+R*0.012*Math.sin(i*0.8+t*0.22));
        ctx2.beginPath();ctx2.moveTo(p.x,p.y);ctx2.quadraticCurveTo((p.x+q.x)*0.5-R*0.007*Math.sin(a),(p.y+q.y)*0.5+R*0.007*Math.cos(a),q.x,q.y);stroke(0.18,0.00115);ctx2.stroke();
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
      const size=(1.12+low*0.36)*1.16;
      const playable=typeof isFieldPlayable==='function'?isFieldPlayable(n.index):true;
      if(n.kind==='ding'){const rr=R*0.205*size;return{i:n.index,index:n.index,x:CX,y:CY,rx:rr,ry:rr,rot:0,label:n.name,playable,kind:'ding'}}
      const slot=(n.index!=null?n.index:pos)-1;
      const deg=angles[slot]!=null?angles[slot]:(slot/ringCount)*360;
      const a=(deg*Math.PI)/180,d=R*0.56;
      const ux=Math.sin(a),uy=-Math.cos(a);
      return{i:n.index,index:n.index,x:CX+ux*d,y:CY+uy*d,rx:R*0.18*size*padScale,ry:R*0.14*size*padScale,rot:Math.atan2(uy,ux),ux,uy,label:n.name,playable,kind:'ring'};
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
  function drawSurfaceFinish(theme, materialTime){
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
    const halo=ctx2.createRadialGradient(CX,CY,rimR*0.985,CX,CY,rimR*1.018);
    halo.addColorStop(0,rgba(lc,0));halo.addColorStop(0.62,rgba(mixLed([230,236,248],th.led,0.5),0.004*breath));halo.addColorStop(1,rgba(lc,0));
    ctx2.fillStyle=halo;ctx2.beginPath();ctx2.arc(CX,CY,rimR*1.08,0,Math.PI*2);ctx2.arc(CX,CY,rimR*0.88,0,Math.PI*2,true);ctx2.fill();
    ctx2.restore();
  }
  // Screen-space resonance: anchor each wave to the real tonefield on touch,
  // then let it travel beyond the handpan toward the viewport edges.
  let rippleCanvas=null,rippleCtx=null;
  function ensureRippleCanvas(){
    if(rippleCanvas)return;
    rippleCanvas=document.createElement('canvas');
    rippleCanvas.setAttribute('aria-hidden','true');
    Object.assign(rippleCanvas.style,{
      position:'fixed',inset:'0',width:'100vw',height:'100vh',
      pointerEvents:'none',zIndex:'99999',opacity:'1'
    });
    // Keep the fixed overlay outside the app/body stacking and transform contexts.
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
  function smoothstep(t){
    t=Math.max(0,Math.min(1,t));
    return t*t*(3-2*t);
  }
  function drawTouchRipples(now){
    if(!touchRipples.length||!rippleCtx)return false;
    const ctx=rippleCtx,overlayRect=rippleCanvas.getBoundingClientRect();
    const vw=overlayRect.width,vh=overlayRect.height;
    ctx.clearRect(0,0,vw,vh);
    for(let i=touchRipples.length-1;i>=0;i--){
      const p=touchRipples[i],t=(now-p.started)/p.duration;
      if(t>=1){touchRipples.splice(i,1);continue}
      const style=p.style||'ambient';
      const presets={
        ambient:{rings:2,delay:0.18,alpha:[0.19,0.095],width:[1.15,0.8],color:[255,222,169],halo:[0.035,0.018]},
        halo:{rings:1,delay:0,alpha:[0.10],width:[0.75],color:[190,218,255],halo:[0.085,0.035]},
        'double-wave':{rings:3,delay:0.13,alpha:[0.17,0.105,0.06],width:[1.05,0.85,0.65],color:[255,211,157],halo:[0.025,0.012]},
        liquid:{rings:2,delay:0.22,alpha:[0.16,0.075],width:[1.05,0.7],color:[154,222,210],halo:[0.04,0.02]},
        pulse:{rings:3,delay:0.11,alpha:[0.16,0.095,0.05],width:[1.15,0.85,0.65],color:[226,202,255],halo:[0.055,0.025]}
      };
      const preset=presets[style]||presets.ambient;
      const fadeIn=smoothstep(t/(style==='pulse'?0.07:0.045));
      const fadeOut=1-smoothstep((t-(style==='pulse'?0.72:0.78))/(style==='pulse'?0.28:0.22));
      const envelope=fadeIn*fadeOut;
      ctx.save();ctx.globalCompositeOperation='screen';
      for(let ring=0;ring<preset.rings;ring++){
        const delay=ring*preset.delay;
        const rt=Math.max(0,Math.min(1,(t-delay)/(1-delay)));
        const grow=smoothstep(rt);
        const wobble=style==='liquid'?1+0.025*Math.sin((t*8+ring)*Math.PI):1;
        const pulseScale=style==='pulse'?1+0.012*Math.sin(t*Math.PI*8):1;
        const rx=(p.rx+(p.maxRadiusX-p.rx)*grow)*wobble*pulseScale;
        const ry=(p.ry+(p.maxRadiusY-p.ry)*grow)*wobble*pulseScale;
        const alpha=preset.alpha[ring]*envelope;
        if(alpha<0.005)continue;
        ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,p.rotation,0,Math.PI*2);
        ctx.strokeStyle='rgba('+preset.color.join(',')+','+alpha+')';
        ctx.lineWidth=preset.width[ring];ctx.setLineDash(style==='liquid'?[3,5]:[]);
        ctx.shadowColor='rgba('+preset.color.join(',')+','+(alpha*0.2)+')';
        ctx.shadowBlur=(style==='halo'?4:style==='pulse'?2.8:style==='liquid'?1.6:2.2)*envelope;
        ctx.stroke();
      }
      ctx.setLineDash([]);
      const pulse=1+0.1*Math.sin(t*Math.PI*4);
      const haloRadius=Math.max(p.rx,p.ry)*(style==='halo'?4:style==='pulse'?3.1:2.5)*pulse;
      const halo=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,haloRadius);
      halo.addColorStop(0,'rgba('+preset.color.join(',')+','+(preset.halo[0]*envelope)+')');
      halo.addColorStop(0.4,'rgba('+preset.color.join(',')+','+(preset.halo[1]*envelope)+')');
      halo.addColorStop(1,'rgba('+preset.color.join(',')+',0)');
      ctx.fillStyle=halo;ctx.beginPath();ctx.arc(p.x,p.y,haloRadius,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.globalCompositeOperation='source-over';
    if(!touchRipples.length)ctx.clearRect(0,0,vw,vh);
    return touchRipples.length>0;
  }
  function addRipple(x,y,noteIndex){
    ensureRippleCanvas();
    const now=performance.now();
    const note=animatedView(now).find(f=>Number(f.index)===Number(noteIndex));
    if(!note)return;
    const rect=canvas.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    const sx=rect.width/W,sy=rect.height/H;
    const toneStyle=softTone(window.PionierSettings?.tonefield||document.documentElement?.dataset?.tonefield||'classic');
    let padRx=note.rx,padRy=note.ry,offsetY=0,rotation=note.rot||0;
    if(toneStyle==='round'){padRx=padRy=Math.max(note.rx,note.ry)*0.92;rotation=0}
    else if(toneStyle==='petal'){padRx=note.rx*0.75;padRy=note.ry*1.25}
    else if(toneStyle==='teardrop'){padRx=note.rx*0.85;padRy=note.ry*1.1;offsetY=-note.ry*0.15}
    else if(toneStyle==='seed'){padRx=note.rx*0.7;padRy=note.ry*1.28}
    // Convert the rendered tonefield center into the overlay's own CSS-pixel space.
    // Using both real element rectangles avoids drift from scaling and layout offsets.
    const overlayRect=rippleCanvas.getBoundingClientRect();
    const px=rect.left+note.x*sx-overlayRect.left;
    const py=rect.top+(note.y+offsetY)*sy-overlayRect.top;
    const rx=Math.max(2,padRx*sx*1.035);
    const ry=Math.max(2,padRy*sy*1.035);
    // Expand far enough to reach the furthest visible edge from this note.
    const maxRadiusX=Math.max(px,vwSafeWidth()-overlayRect.left-px)+Math.max(vwSafeWidth(),vwSafeHeight())*0.08;
    const maxRadiusY=Math.max(py,vwSafeHeight()-overlayRect.top-py)+Math.max(vwSafeWidth(),vwSafeHeight())*0.08;
    touchLights.set(Number(noteIndex),now);
    if(touchRipples.length>=12)touchRipples.splice(0,touchRipples.length-11);
    const rippleStyle=['ambient','halo','double-wave','liquid','pulse'].includes(window.PionierSettings?.rippleStyle)?window.PionierSettings.rippleStyle:'ambient';
    const duration=rippleStyle==='pulse'?1900:rippleStyle==='halo'?3000:rippleStyle==='liquid'?3200:rippleStyle==='double-wave'?2400:2600;
    touchRipples.push({x:px,y:py,rx,ry,rotation,maxRadiusX,maxRadiusY,started:now,duration,style:rippleStyle});
    if(_lastInst!=null)_origDrawBody(_lastInst,_lastCatch);
    if(!rippleRaf)rippleRaf=requestAnimationFrame(tickRipples);
  }
  function vwSafeWidth(){return window.innerWidth||document.documentElement.clientWidth||800}
  function vwSafeHeight(){return window.innerHeight||document.documentElement.clientHeight||600}
  function tickRipples(now){
    rippleRaf=0;
    if(!touchRipples.length||document.hidden)return;
    drawTouchRipples(now||performance.now());
    if(touchRipples.length)rippleRaf=requestAnimationFrame(tickRipples);
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
    drawSurfaceFinish(theme, materialTime);
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
      const touchedAt=touchLights.get(Number(f.index))||0;
      const touchGlow=touchedAt?Math.max(0,1-(performance.now()-touchedAt)/520):0;
      if(touchGlow>0.005){
        ctx2.save();
        ctx2.globalCompositeOperation='screen';
        const gold=ctx2.createRadialGradient(f.x-f.rx*0.12,f.y-f.ry*0.16,0,f.x,f.y,baseR*1.28);
        gold.addColorStop(0,'rgba(255,213,117,'+(0.32*touchGlow)+')');
        gold.addColorStop(0.58,'rgba(255,174,57,'+(0.22*touchGlow)+')');
        gold.addColorStop(1,'rgba(255,159,35,0)');
        ctx2.fillStyle=gold;
        pathPad(f,tf);ctx2.fill();
        ctx2.globalCompositeOperation='lighter';
        ctx2.strokeStyle='rgba(255,207,111,'+(0.82*touchGlow)+')';
        ctx2.lineWidth=Math.max(1.6,R*0.007*touchGlow);
        ctx2.shadowColor='rgba(255,176,58,'+(0.52*touchGlow)+')';
        ctx2.shadowBlur=baseR*0.34*touchGlow;
        pathPad(f,tf);ctx2.stroke();
        ctx2.restore();
        if(touchGlow<0.025)touchLights.delete(Number(f.index));
      }
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
    const m=Math.min(W,H);R=m*0.39;CX=W*0.5;CY=H*0.5;
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
      if(d<1.65&&d<bestD){bestD=d;best=f}
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
  function stopMandalaFrame(){
    if(_mandalaRaf) cancelAnimationFrame(_mandalaRaf);
    _mandalaRaf=0;
  }
  function scheduleMandalaFrame(){
    if(_mandalaRaf||reducedMotion||!mandalaEnabled()||document.hidden)return;
    _mandalaRaf=requestAnimationFrame(tickMandalaFrame);
  }
  function tickMandalaFrame(now){
    _mandalaRaf=0;
    if(reducedMotion||!mandalaEnabled()||document.hidden)return;
    // A single 30 fps loop is enough for the slow metallic movement and avoids
    // stacking duplicate RAF chains on every redraw.
    if(now-_mandalaLast>=33){
      _mandalaLast=now;
      if(_lastInst!=null)_origDrawBody(_lastInst,_lastCatch);
    }
    scheduleMandalaFrame();
  }
  drawBody=function(inst,catchActive){
    _lastInst=inst;_lastCatch=!!catchActive;
    _origDrawBody(inst,catchActive);
    scheduleMandalaFrame();
  };
  if(typeof document!=='undefined'){
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)stopMandalaFrame();
      else { if(_lastInst!=null)drawBody(_lastInst,_lastCatch); if(touchRipples.length&&!rippleRaf)rippleRaf=requestAnimationFrame(tickRipples); }
    });
  }
  return{resize,layoutHandpanFields,armTransition,drawBody,drawCatchWaves,hitVector,canvasCoords,addRipple,
    get fields(){return fields},set fields(v){fields=v},setSlitPhase(){},get metrics(){return{W,H,R,CX,CY}}};
}
