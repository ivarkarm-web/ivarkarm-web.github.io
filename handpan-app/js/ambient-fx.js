/**
 * ambient-fx.js — calming particle layers for Settings → Ambient
 * Modes: none | forest | rain | night | fire
 */
(function ambientFx() {
  const MAX = 120;
  let canvas, ctx, raf = 0, mode = 'none', particles = [], w = 0, h = 0, dpr = 1;
  let last = 0;

  function ensureCanvas() {
    if (canvas && canvas.isConnected) return canvas;
    canvas = document.getElementById('ambientFxCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'ambientFxCanvas';
      canvas.setAttribute('aria-hidden', 'true');
      Object.assign(canvas.style, {
        position: 'fixed',
        inset: '0',
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: '5',
      });
      document.body.appendChild(canvas);
    }
    ctx = canvas.getContext('2d');
    resize();
    return canvas;
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function spawn(kind) {
    if (kind === 'forest') {
      return {
        kind, x: rand(0, w), y: rand(0, h), r: rand(1.2, 3.2),
        vx: rand(-8, 8), vy: rand(-14, -4),
        a: rand(0.15, 0.45), life: rand(4, 10), age: 0,
        hue: rand(95, 145),
      };
    }
    if (kind === 'rain') {
      return {
        kind, x: rand(0, w), y: rand(-h * 0.2, h),
        len: rand(10, 22), vy: rand(280, 420), a: rand(0.12, 0.35), age: 0, life: 3,
      };
    }
    if (kind === 'night') {
      return {
        kind, x: rand(0, w), y: rand(0, h), r: rand(0.6, 2.2),
        a: rand(0.2, 0.85), tw: rand(0.5, 2.5), phase: rand(0, Math.PI * 2),
        age: 0, life: rand(8, 20),
      };
    }
    // fire
    return {
      kind, x: rand(w * 0.15, w * 0.85), y: h + rand(0, 40),
      r: rand(1.5, 4.5), vx: rand(-20, 20), vy: rand(-90, -40),
      a: rand(0.35, 0.8), age: 0, life: rand(1.2, 2.8),
      hue: rand(10, 40),
    };
  }

  function rebuild(count) {
    particles = [];
    if (mode === 'none') return;
    for (let i = 0; i < count; i++) particles.push(spawn(mode));
  }

  function setMode(next) {
    mode = next || 'none';
    ensureCanvas();
    resize();
    const counts = { none: 0, forest: 55, rain: 80, night: 70, fire: 65 };
    rebuild(counts[mode] || 0);
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
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.age += dt;

      if (p.kind === 'forest') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const fade = Math.sin(Math.min(1, p.age / p.life) * Math.PI);
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 45%, 60%, ${p.a * fade})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        if (p.age > p.life || p.y < -10) particles[i] = spawn('forest');
      } else if (p.kind === 'rain') {
        p.y += p.vy * dt;
        p.x += 18 * dt;
        ctx.strokeStyle = `rgba(180, 200, 230, ${p.a})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - 2, p.y + p.len);
        ctx.stroke();
        if (p.y > h + 20) particles[i] = spawn('rain');
      } else if (p.kind === 'night') {
        const tw = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(now * 0.001 * p.tw + p.phase));
        ctx.beginPath();
        ctx.fillStyle = `rgba(230, 235, 255, ${p.a * tw})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        // soft bloom
        ctx.beginPath();
        ctx.fillStyle = `rgba(180, 200, 255, ${p.a * tw * 0.15})`;
        ctx.arc(p.x, p.y, p.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        if (p.age > p.life) particles[i] = spawn('night');
      } else if (p.kind === 'fire') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.r *= 0.995;
        const t = Math.min(1, p.age / p.life);
        const fade = 1 - t;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 90%, ${55 + t * 20}%, ${p.a * fade})`;
        ctx.arc(p.x, p.y, Math.max(0.4, p.r), 0, Math.PI * 2);
        ctx.fill();
        if (p.age > p.life || p.y < -20) particles[i] = spawn('fire');
      }
    }
  }

  function syncFromSettings() {
    const s = window.PionierSettings;
    const amb = (s && s.ambient) || document.documentElement.dataset.ambient || 'none';
    setMode(amb);
  }

  window.PionierAmbient = { setMode, syncFromSettings };

  window.addEventListener('pionier:settings', (e) => {
    const amb = e.detail?.ambient || 'none';
    setMode(amb);
  });
  window.addEventListener('resize', () => {
    resize();
    if (mode !== 'none') rebuild(particles.length || 40);
  });

  function boot() {
    ensureCanvas();
    syncFromSettings();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 500);
})();
