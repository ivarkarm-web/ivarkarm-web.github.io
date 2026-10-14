/**
 * skin-mandala.js — slow sacred-geometry auras behind the handpan.
 * Each skin maps to a unique pattern (orbit/petal/rings/star/spiral/bloom/wave).
 */
(function skinMandala() {
  let canvas, ctx, raf = 0, w = 0, h = 0, dpr = 1, last = 0, phase = 0;
  let style = 'orbit', hue = 210, opacity = 0, targetOpacity = 0;
  let reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}

  function ensure() {
    if (canvas && canvas.isConnected) return;
    canvas = document.getElementById('skinMandalaCanvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'skinMandalaCanvas';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.insertBefore(canvas, document.body.firstChild);
    }
    Object.assign(canvas.style, {
      position: 'fixed', inset: '0', width: '100%', height: '100%',
      pointerEvents: 'none', zIndex: '1', opacity: '0',
      transition: 'opacity 1.4s ease',
    });
    ctx = canvas.getContext('2d', { alpha: true });
    resize();
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function hsl(h, s, l, a) { return 'hsla(' + h + ',' + s + '%,' + l + '%,' + a + ')'; }

  function drawOrbit(cx, cy, R, t) {
    for (let ring = 0; ring < 6; ring++) {
      const rr = R * (0.22 + ring * 0.13);
      const n = 5 + ring * 3;
      const spin = t * (0.035 + ring * 0.01) * (ring % 2 ? -1 : 1);
      ctx.strokeStyle = hsl(hue, 35, 72, 0.12 + ring * 0.02);
      ctx.lineWidth = 0.95;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * Math.PI * 2;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        const pr = 1.6 + (ring % 3) * 0.7;
        const g = ctx.createRadialGradient(x, y, 0, x, y, pr * 5);
        g.addColorStop(0, hsl(hue, 45, 80, 0.34));
        g.addColorStop(0.5, hsl(hue, 40, 70, 0.12));
        g.addColorStop(1, hsl(hue, 40, 60, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, pr * 5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawPetal(cx, cy, R, t) {
    for (let L = 0; L < 5; L++) {
      const petals = 6 + L * 2;
      const rr = R * (0.3 + L * 0.11);
      const spin = t * 0.028 * (L % 2 ? -1 : 1);
      ctx.beginPath();
      for (let i = 0; i < petals; i++) {
        const a0 = spin + (i / petals) * Math.PI * 2;
        const a1 = spin + ((i + 0.5) / petals) * Math.PI * 2;
        const a2 = spin + ((i + 1) / petals) * Math.PI * 2;
        const x0 = cx + Math.cos(a0) * rr * 0.35, y0 = cy + Math.sin(a0) * rr * 0.35;
        const xm = cx + Math.cos(a1) * rr, ym = cy + Math.sin(a1) * rr;
        const x2 = cx + Math.cos(a2) * rr * 0.35, y2 = cy + Math.sin(a2) * rr * 0.35;
        if (i === 0) ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(xm, ym, x2, y2);
      }
      ctx.closePath();
      ctx.strokeStyle = hsl(hue, 40, 75, 0.16 + L * 0.03);
      ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = hsl(hue, 35, 70, 0.025 + L * 0.008); ctx.fill();
    }
  }

  function drawRings(cx, cy, R, t) {
    const breath = 0.5 + 0.5 * Math.sin(t * 0.45);
    for (let i = 0; i < 10; i++) {
      const rr = R * (0.16 + i * 0.08) * (0.95 + breath * 0.05);
      ctx.strokeStyle = hsl(hue, 30, 72, 0.1 + (i % 3) * 0.03);
      ctx.lineWidth = 0.85 + (i % 2) * 0.5;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
      if (i % 2 === 0) {
        const dots = 8 + i, spin = t * 0.02 * (i % 4 === 0 ? 1 : -1);
        for (let d = 0; d < dots; d++) {
          const a = spin + (d / dots) * Math.PI * 2;
          ctx.fillStyle = hsl(hue, 40, 78, 0.22);
          ctx.beginPath(); ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 1.5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }
  }

  function drawStar(cx, cy, R, t) {
    for (let layer = 0; layer < 4; layer++) {
      const spin = t * 0.022 * (layer % 2 ? -1 : 1);
      const outer = R * (0.42 + layer * 0.13);
      const inner = outer * 0.4;
      const points = 8 + layer * 2;
      ctx.beginPath();
      for (let i = 0; i < points * 2; i++) {
        const a = spin + (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = hsl(hue, 42, 76, 0.14 + layer * 0.03);
      ctx.lineWidth = 1.15; ctx.stroke();
    }
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.25);
    g.addColorStop(0, hsl(hue, 50, 80, 0.14));
    g.addColorStop(1, hsl(hue, 40, 60, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.25, 0, Math.PI * 2); ctx.fill();
  }

  function drawSpiral(cx, cy, R, t) {
    for (let arm = 0; arm < 4; arm++) {
      ctx.beginPath();
      const base = (arm / 4) * Math.PI * 2 + t * 0.035;
      for (let i = 0; i < 100; i++) {
        const p = i / 100;
        const a = base + p * Math.PI * 3.6;
        const r = R * 0.1 + p * R * 0.78;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hsl(hue, 38, 72, 0.18);
      ctx.lineWidth = 1.3; ctx.lineCap = 'round'; ctx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      ctx.strokeStyle = hsl(hue, 28, 70, 0.07);
      ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.arc(cx, cy, R * (0.2 + i * 0.14), 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawBloom(cx, cy, R, t) {
    const breath = 0.9 + 0.1 * Math.sin(t * 0.38);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + t * 0.018;
      const len = R * 0.58 * breath;
      const x = cx + Math.cos(a) * len * 0.32, y = cy + Math.sin(a) * len * 0.32;
      const g = ctx.createRadialGradient(x, y, 0, x, y, len * 0.55);
      g.addColorStop(0, hsl(hue, 48, 82, 0.16));
      g.addColorStop(0.55, hsl(hue, 40, 70, 0.05));
      g.addColorStop(1, hsl(hue, 40, 60, 0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, len * 0.24, len * 0.52, a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = hsl(hue, 35, 75, 0.14);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.2 * breath, 0, Math.PI * 2); ctx.stroke();
  }

  function drawWave(cx, cy, R, t) {
    for (let ring = 0; ring < 7; ring++) {
      const baseR = R * (0.2 + ring * 0.11);
      ctx.beginPath();
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 2;
        const wave = Math.sin(a * 5 + t * 0.55 + ring * 0.8) * R * 0.022;
        const r = baseR + wave;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = hsl(hue, 34, 74, 0.12 + ring * 0.02);
      ctx.lineWidth = 1.05; ctx.stroke();
    }
  }

  const DRAWS = { orbit: drawOrbit, petal: drawPetal, rings: drawRings, star: drawStar, spiral: drawSpiral, bloom: drawBloom, wave: drawWave };

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!ctx) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (!reduced) phase += dt;
    opacity += (targetOpacity - opacity) * Math.min(1, dt * 1.2);
    canvas.style.opacity = String(Math.max(0, Math.min(1, opacity)));
    if (opacity < 0.01 && targetOpacity < 0.01) { ctx.clearRect(0, 0, w, h); return; }
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.42, R = Math.min(w, h) * 0.48;
    const fn = DRAWS[style] || drawOrbit;
    ctx.save(); ctx.globalAlpha = 0.95; fn(cx, cy, R, phase); ctx.restore();
  }

  function setFromSettings(detail) {
    ensure();
    const cat = window.PionierCatalog;
    const skinId = (detail && detail.skin) || (window.PionierSettings && window.PionierSettings.skin) || 'classic';
    const entry = cat && cat.SKINS ? cat.SKINS.find((s) => s.id === skinId) : null;
    style = (entry && entry.mandala) || 'orbit';
    hue = entry && entry.hue != null ? entry.hue : 210;
    const mandalaOn = !(detail && detail.mandala === false) && !(window.PionierSettings && window.PionierSettings.mandala === false);
    targetOpacity = mandalaOn ? 0.75 : 0;
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }

  window.PionierMandala = { setFromSettings, resize };
  window.addEventListener('pionier:settings', (e) => setFromSettings(e.detail || {}));
  window.addEventListener('resize', () => resize());

  function boot() { ensure(); setFromSettings(window.PionierSettings || {}); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 500);
})();
