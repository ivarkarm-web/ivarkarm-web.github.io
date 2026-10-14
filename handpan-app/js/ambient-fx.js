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

  /* ── RAIN: visible full-canvas atmosphere ── */
  function buildRain() {
    const streaks = [];
    const veils = [];
    // Clearly visible full-canvas rain — still calm, not noisy
    for (let i = 0; i < 72; i++) {
      streaks.push({
        x: rnd(0, w),
        y: rnd(-h, h),
        len: rnd(28, 64),
        vy: rnd(55, 100),
        a: rnd(0.14, 0.28),
        drift: rnd(-6, 10),
        w: rnd(0.9, 1.6),
      });
    }
    for (let i = 0; i < 14; i++) {
      veils.push({
        x: rnd(0, w),
        y: rnd(0, h),
        r: rnd(160, 340),
        a: rnd(0.045, 0.09),
        vx: rnd(-2.5, 2.5),
        vy: rnd(-1.5, 1.5),
      });
    }
    return { type: 'rain', streaks, veils };
  }

  function tickRain(sys, dt) {
    ctx.fillStyle = 'rgba(95,115,140,0.055)';
    ctx.fillRect(0, 0, w, h);

    for (const m of sys.veils) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < -m.r) m.x = w + m.r;
      if (m.x > w + m.r) m.x = -m.r;
      if (m.y < -m.r) m.y = h + m.r;
      if (m.y > h + m.r) m.y = -m.r;
      const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
      mg.addColorStop(0, 'rgba(160,180,205,' + m.a + ')');
      mg.addColorStop(1, 'rgba(160,180,205,0)');
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
      g.addColorStop(0, 'rgba(210,225,245,' + (p.a * 0.55) + ')');
      g.addColorStop(0.25, 'rgba(195,215,240,' + p.a + ')');
      g.addColorStop(1, 'rgba(170,190,215,0)');
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
    // Embers born anywhere — full canvas, not bottom-only
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
    for (const m of sys.haze) {
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.x < -m.r) m.x = w + m.r;
      if (m.x > w + m.r) m.x = -m.r;
      if (m.y < -m.r) m.y = h + m.r;
      if (m.y > h + m.r) m.y = -m.r;
      const mg = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
      mg.addColorStop(0, 'hsla(22,70%,45%,' + m.a + ')');
      mg.addColorStop(1, 'hsla(22,70%,45%,0)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const e of sys.embers) {
      e.life += dt / e.max;
      if (e.life >= 1) {
        e.life = 0;
        e.x = rnd(0, w);
        e.y = rnd(0, h);
        e.r = rnd(1.0, 2.8);
        e.vy = rnd(-18, -6);
        e.vx = rnd(-5, 5);
        e.hue = rnd(14, 32);
        e.max = rnd(3.5, 6.5);
        e.wob = rnd(0.25, 0.9);
        e.phase = rnd(0, Math.PI * 2);
      }
      const t = e.life;
      const fade = t < 0.15 ? t / 0.15 : t > 0.75 ? (1 - t) / 0.25 : 1;
      e.x += e.vx * dt + Math.sin(now * 0.001 * e.wob + e.phase) * 8 * dt;
      e.y += e.vy * dt;
      const a = 0.55 * fade;
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 3);
      g.addColorStop(0, 'hsla(' + e.hue + ',90%,65%,' + a + ')');
      g.addColorStop(0.4, 'hsla(' + e.hue + ',85%,50%,' + (a * 0.4) + ')');
      g.addColorStop(1, 'hsla(' + e.hue + ',80%,40%,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function buildForest() {
    const leaves = [];
    for (let i = 0; i < 18; i++) {
      leaves.push({
        x: rnd(0, w), y: rnd(0, h),
        r: rnd(8, 22), a: rnd(0.02, 0.05),
        vx: rnd(-4, 4), vy: rnd(-2, 2),
        hue: rnd(90, 140),
      });
    }
    return { type: 'forest', leaves };
  }

  function tickForest(sys, dt) {
    for (const L of sys.leaves) {
      L.x += L.vx * dt; L.y += L.vy * dt;
      if (L.x < -30) L.x = w + 20;
      if (L.x > w + 30) L.x = -20;
      if (L.y < -30) L.y = h + 20;
      if (L.y > h + 30) L.y = -20;
      const g = ctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      g.addColorStop(0, 'hsla(' + L.hue + ',40%,40%,' + L.a + ')');
      g.addColorStop(1, 'hsla(' + L.hue + ',40%,30%,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(L.x, L.y, L.r, 0, Math.PI * 2); ctx.fill();
    }
  }

  function buildNight() {
    const stars = [];
    const nebulae = [];
    for (let i = 0; i < 60; i++) {
      stars.push({
        x: rnd(0, w), y: rnd(0, h),
        r: rnd(0.4, 1.6), a: rnd(0.15, 0.55),
        tw: rnd(0.3, 1.2), phase: rnd(0, Math.PI * 2),
        depth: rnd(0.4, 1),
      });
    }
    for (let i = 0; i < 4; i++) {
      nebulae.push({
        x: rnd(0, w), y: rnd(0, h),
        r: rnd(120, 280), a: rnd(0.015, 0.035),
        hue: rnd(220, 280),
      });
    }
    return { type: 'night', stars, nebulae, meteors: [], meteorTimer: rnd(4, 10) };
  }

  function tickNight(sys, dt, now) {
    for (const n of sys.nebulae) {
      const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      g.addColorStop(0, 'hsla(' + n.hue + ',50%,50%,' + n.a + ')');
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
      sys.meteors.push({ x: rnd(0, w * 0.7), y: rnd(0, h * 0.4), vx: rnd(80, 160), vy: rnd(40, 90), life: 0, max: rnd(0.6, 1.1) });
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
