/**
 * ambient-fx.js — editorial ambient particle fields
 * Full-viewport canvas BEHIND the app (z-index 0).
 * Modes: none | forest | rain | night | fire
 * Rain & fire: sparse, slow, full-canvas, low distraction, premium.
 */
(function ambientFx() {
  let canvas, ctx, raf = 0, mode = 'none';
  let w = 0, h = 0, dpr = 1, last = 0;
  let layers = [];

  function ensureCanvas() {
    if (canvas && canvas.isConnected) return canvas;
    canvas = document.getElementById('ambientFxCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'ambientFxCanvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: '0',
      opacity: '0',
      transition: 'opacity 0.8s ease',
    });
    ctx = canvas.getContext('2d', { alpha: true });
    resize();
    return canvas;
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ── RAIN: sparse vertical atmosphere, full height, almost still ── */
  function buildRain() {
    const streaks = [];
    const veils = [];
    for (let i = 0; i < 22; i++) {
      streaks.push({
        x: rnd(0, w),
        y: rnd(-h, h),
        len: rnd(18, 42),
        vy: rnd(38, 62),
        a: rnd(0.018, 0.038),
        drift: rnd(-4, 6),
        w: rnd(0.4, 0.7),
      });
    }
    for (let i = 0; i < 7; i++) {
      veils.push({
        x: rnd(0, w),
        y: rnd(0, h),
        r: rnd(120, 280),
        a: rnd(0.012, 0.028),
        vx: rnd(-2.5, 2.5),
        vy: rnd(-1.5, 1.5),
      });
    }
    return { type: 'rain', streaks, veils };
  }

  function tickRain(sys, dt) {
    ctx.fillStyle = 'rgba(95,115,140,0.018)';
    ctx.fillRect(0, 0, w, h);

    for (const m of sys.veils) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < -m.r) m.x = w + m.r;
      if (m.x > w + m.r) m.x = -m.r;
      if (m.y < -m.r) m.y = h + m.r;
      if (m.y > h + m.r) m.y = -m.r;
      const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
      mg.addColorStop(0, 'rgba(150,170,195,' + m.a + ')');
      mg.addColorStop(1, 'rgba(150,170,195,0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of sys.streaks) {
      p.y += p.vy * dt;
      p.x += p.drift * dt * 0.08;
      if (p.y > h + 30) {
        p.y = rnd(-80, -10);
        p.x = rnd(0, w);
      }
      if (p.x < -20) p.x = w + 10;
      if (p.x > w + 20) p.x = -10;
      const g = ctx.createLinearGradient(p.x, p.y, p.x - p.drift * 0.03, p.y + p.len);
      g.addColorStop(0, 'rgba(185,205,230,' + (p.a * 0.35) + ')');
      g.addColorStop(0.35, 'rgba(175,195,220,' + p.a + ')');
      g.addColorStop(1, 'rgba(160,180,205,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = p.w;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.drift * 0.03, p.y + p.len);
      ctx.stroke();
    }
  }

  /* ── FIRE: slow embers across FULL height + soft warm haze ── */
  function buildFire() {
    const embers = [];
    const haze = [];
    for (let i = 0; i < 28; i++) {
      embers.push({
        x: rnd(0, w),
        y: rnd(0, h),
        r: rnd(1.0, 2.8),
        vy: rnd(-18, -6),
        vx: rnd(-5, 5),
        hue: rnd(14, 32),
        life: rnd(0, 1),
        max: rnd(3.5, 6.5),
        wob: rnd(0.25, 0.9),
        phase: rnd(0, Math.PI * 2),
      });
    }
    for (let i = 0; i < 6; i++) {
      haze.push({
        x: rnd(0, w),
        y: rnd(0, h),
        r: rnd(140, 300),
        a: rnd(0.01, 0.022),
        vx: rnd(-3, 3),
        vy: rnd(-2.5, 1.5),
      });
    }
    return { type: 'fire', embers, haze };
  }

  function tickFire(sys, dt, now) {
    const wash = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.85);
    wash.addColorStop(0, 'rgba(255,95,30,0.018)');
    wash.addColorStop(0.55, 'rgba(200,55,18,0.01)');
    wash.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);

    for (const m of sys.haze) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < -m.r) m.x = w + m.r;
      if (m.x > w + m.r) m.x = -m.r;
      if (m.y < -m.r) m.y = h + m.r;
      if (m.y > h + m.r) m.y = -m.r;
      const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
      mg.addColorStop(0, 'rgba(230,85,28,' + m.a + ')');
      mg.addColorStop(1, 'rgba(230,85,28,0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of sys.embers) {
      p.life += dt;
      if (p.life > p.max) {
        p.life = 0;
        p.max = rnd(3.5, 6.5);
        p.x = rnd(0, w);
        p.y = rnd(0, h);
        p.r = rnd(1.0, 2.8);
        p.vy = rnd(-18, -6);
        p.vx = rnd(-5, 5);
        p.hue = rnd(14, 32);
      }
      const t = p.life / p.max;
      const fade = Math.sin(t * Math.PI);
      p.x += (p.vx + Math.sin(now * 0.0004 * p.wob + p.phase) * 6) * dt;
      p.y += p.vy * dt;
      if (p.y < -30) p.y = h + 15;
      if (p.x < -20) p.x = w + 10;
      if (p.x > w + 20) p.x = -10;

      const r = p.r * (1 - t * 0.35);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4);
      g.addColorStop(0, 'hsla(' + p.hue + ',92%,70%,' + (0.2 * fade) + ')');
      g.addColorStop(0.4, 'hsla(' + (p.hue + 8) + ',85%,52%,' + (0.08 * fade) + ')');
      g.addColorStop(1, 'hsla(' + p.hue + ',80%,40%,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function buildForest() {
    const dust = [], fireflies = [];
    for (let i = 0; i < 70; i++) {
      dust.push({ x: rnd(0, w), y: rnd(0, h), r: rnd(0.8, 2.6), vx: rnd(-6, 6), vy: rnd(-10, -2), a: rnd(0.08, 0.22), depth: rnd(0.3, 1) });
    }
    for (let i = 0; i < 14; i++) {
      fireflies.push({ x: rnd(w * 0.1, w * 0.9), y: rnd(h * 0.25, h * 0.85), phase: rnd(0, Math.PI * 2), speed: rnd(0.4, 1.1), r: rnd(1.2, 2.4), roam: rnd(20, 50) });
    }
    return { type: 'forest', dust, fireflies };
  }

  function tickForest(sys, dt, now) {
    const canopy = ctx.createLinearGradient(0, 0, 0, h);
    canopy.addColorStop(0, 'rgba(30,50,30,0.08)');
    canopy.addColorStop(0.4, 'rgba(20,40,25,0.03)');
    canopy.addColorStop(1, 'rgba(10,20,12,0.06)');
    ctx.fillStyle = canopy;
    ctx.fillRect(0, 0, w, h);
    for (const p of sys.dust) {
      p.x += p.vx * p.depth * dt; p.y += p.vy * p.depth * dt;
      if (p.y < -10) { p.y = h + 5; p.x = rnd(0, w); }
      if (p.x < -10) p.x = w + 5;
      if (p.x > w + 10) p.x = -5;
      ctx.fillStyle = 'rgba(160,190,140,' + (p.a * p.depth) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * p.depth, 0, Math.PI * 2); ctx.fill();
    }
    for (const f of sys.fireflies) {
      const x = f.x + Math.sin(now * 0.0007 * f.speed + f.phase) * f.roam;
      const y = f.y + Math.cos(now * 0.0005 * f.speed + f.phase * 1.3) * f.roam * 0.5;
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(now * 0.003 * f.speed + f.phase));
      const g = ctx.createRadialGradient(x, y, 0, x, y, f.r * 8);
      g.addColorStop(0, 'rgba(210,255,160,' + (0.55 * pulse) + ')');
      g.addColorStop(0.3, 'rgba(160,220,100,' + (0.2 * pulse) + ')');
      g.addColorStop(1, 'rgba(120,180,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, f.r * 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(235,255,200,' + (0.85 * pulse) + ')';
      ctx.beginPath(); ctx.arc(x, y, f.r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }

  function buildNight() {
    const stars = [], nebula = [], meteors = [];
    for (let i = 0; i < 120; i++) {
      stars.push({ x: rnd(0, w), y: rnd(0, h), r: rnd(0.4, 1.6), a: rnd(0.25, 0.9), tw: rnd(0.3, 1.8), phase: rnd(0, Math.PI * 2), depth: rnd(0.25, 1) });
    }
    for (let i = 0; i < 4; i++) {
      nebula.push({ x: rnd(w * 0.15, w * 0.85), y: rnd(h * 0.1, h * 0.55), r: rnd(80, 180), hue: rnd(220, 280), a: rnd(0.03, 0.07) });
    }
    return { type: 'night', stars, nebula, meteors, meteorTimer: rnd(4, 10) };
  }

  function tickNight(sys, dt, now) {
    for (const n of sys.nebula) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, 'hsla(' + n.hue + ',60%,55%,' + n.a + ')');
      g.addColorStop(1, 'hsla(' + n.hue + ',60%,40%,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    }
    for (const s of sys.stars) {
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(now * 0.001 * s.tw + s.phase));
      const a = s.a * tw * s.depth;
      ctx.fillStyle = 'rgba(230,235,255,' + a + ')';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * s.depth, 0, Math.PI * 2); ctx.fill();
      if (s.r > 1.1 && s.depth > 0.7) {
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 4);
        g.addColorStop(0, 'rgba(200,210,255,' + (a * 0.25) + ')');
        g.addColorStop(1, 'rgba(200,210,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 4, 0, Math.PI * 2); ctx.fill();
      }
    }
    sys.meteorTimer -= dt;
    if (sys.meteorTimer <= 0) {
      sys.meteorTimer = rnd(6, 14);
      sys.meteors.push({ x: rnd(0, w * 0.7), y: rnd(0, h * 0.35), vx: rnd(220, 340), vy: rnd(140, 220), life: 0, max: rnd(0.55, 0.95) });
    }
    sys.meteors = sys.meteors.filter((m) => {
      m.life += dt;
      const t = m.life / m.max;
      if (t >= 1) return false;
      m.x += m.vx * dt; m.y += m.vy * dt;
      const a = (1 - t) * 0.7;
      const len = 40 + t * 30;
      const ang = Math.atan2(m.vy, m.vx);
      const tx = m.x - Math.cos(ang) * len;
      const ty = m.y - Math.sin(ang) * len;
      const g = ctx.createLinearGradient(m.x, m.y, tx, ty);
      g.addColorStop(0, 'rgba(255,255,255,' + a + ')');
      g.addColorStop(0.3, 'rgba(200,220,255,' + (a * 0.5) + ')');
      g.addColorStop(1, 'rgba(200,220,255,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(m.x, m.y); ctx.lineTo(tx, ty); ctx.stroke();
      return true;
    });
  }

  function rebuild() {
    layers = [];
    if (mode === 'rain') layers.push(buildRain());
    else if (mode === 'fire') layers.push(buildFire());
    else if (mode === 'forest') layers.push(buildForest());
    else if (mode === 'night') layers.push(buildNight());
  }

  function setMode(next) {
    mode = next || 'none';
    ensureCanvas();
    resize();
    rebuild();
    if (mode === 'none') {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (ctx) ctx.clearRect(0, 0, w, h);
      canvas.style.opacity = '0';
      return;
    }
    canvas.style.opacity = '1';
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  }

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!ctx || mode === 'none') return;
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    ctx.clearRect(0, 0, w, h);
    for (const sys of layers) {
      if (sys.type === 'rain') tickRain(sys, dt);
      else if (sys.type === 'fire') tickFire(sys, dt, now);
      else if (sys.type === 'forest') tickForest(sys, dt, now);
      else if (sys.type === 'night') tickNight(sys, dt, now);
    }
  }

  function syncFromSettings() {
    const s = window.PionierSettings;
    const amb = (s && s.ambient) || document.documentElement.dataset.ambient || 'none';
    setMode(amb);
  }

  window.PionierAmbient = { setMode, syncFromSettings };
  window.addEventListener('pionier:settings', (e) => setMode(e.detail && e.detail.ambient || 'none'));
  window.addEventListener('resize', () => { resize(); if (mode !== 'none') rebuild(); });

  function boot() { ensureCanvas(); syncFromSettings(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 400);
})();
