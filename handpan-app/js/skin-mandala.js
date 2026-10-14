/**
 * skin-mandala.js — slow, editorial mandalas behind the handpan.
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
      transition: 'opacity 1.2s ease',
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
    for (let ring = 0; ring < 5; ring++) {
      const rr = R * (0.28 + ring * 0.14);
      const n = 6 + ring * 3;
      const spin = t * (0.04 + ring * 0.012) * (ring % 2 ? -1 : 1);
      for (let i = 0; i < n; i++) {
        const a = spin + (i / n) * Math.PI * 2;
        const x = cx + Math.cos(a) * rr;
        const y = cy + Math.sin(a) * rr;
        const pr = 1.2 + (ring % 3) * 0.6;
        const g = ctx.createRadialGradient(x, y, 0, x, y, pr * 4);
        g.addColorStop(0, hsl(hue, 40, 78, 0.22));
        g.addColorStop(1, hsl(hue, 40, 60, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, pr * 4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = hsl(hue, 30, 70, 0.06 + ring * 0.015);
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawPetal(cx, cy, R, t) {
    for (let L = 0; L < 4; L++) {
      const petals = 6 + L * 2;
      const rr = R * (0.35 + L * 0.12);
      const spin = t * 0.03 * (L % 2 ? -1 : 1);
      ctx.beginPath();
      for (let i = 0; i < petals; i++) {
        const a0 = spin + (i / petals) * Math.PI * 2;
        const a1 = spin + ((i + 0.5) / petals) * Math.PI * 2;
        const a2 = spin + ((i + 1) / petals) * Math.PI * 2;
        const x0 = cx + Math.cos(a0) * rr * 0.4, y0 = cy + Math.sin(a0) * rr * 0.4;
        const xm = cx + Math.cos(a1) * rr, ym = cy + Math.sin(a1) * rr;
        const x2 = cx + Math.cos(a2) * rr * 0.4, y2 = cy + Math.sin(a2) * rr * 0.4;
        if (i === 0) ctx.moveTo(x0, y0);
        ctx.quadraticCurveTo(xm, ym, x2, y2);
      }
      ctx.closePath();
      ctx.strokeStyle = hsl(hue, 35, 72, 0.1 + L * 0.03);
      ctx.lineWidth = 1; ctx.stroke();
    }
  }

  function drawRings(cx, cy, R, t) {
    const breath = 0.5 + 0.5 * Math.sin(t * 0.5);
    for (let i = 0; i < 8; i++) {
      const rr = R * (0.2 + i * 0.09) * (0.96 + breath * 0.04);
      ctx.strokeStyle = hsl(hue, 28, 70, 0.05 + (i % 3) * 0.02);
      ctx.lineWidth = 0.7 + (i % 2) * 0.4;
      ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawStar(cx, cy, R, t) {
    for (let layer = 0; layer < 3; layer++) {
      const spin = t * 0.025 * (layer % 2 ? -1 : 1);
      const outer = R * (0.5 + layer * 0.15);
      const inner = outer * 0.42;
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = spin + (i / 16) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 === 0 ? outer : inner;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = hsl(hue, 40, 75, 0.08 + layer * 0.03);
      ctx.lineWidth = 1; ctx.stroke();
    }
  }

  function drawSpiral(cx, cy, R, t) {
    for (let arm = 0; arm < 3; arm++) {
      ctx.beginPath();
      const base = (arm / 3) * Math.PI * 2 + t * 0.04;
      for (let i = 0; i < 80; i++) {
        const p = i / 80;
        const a = base + p * Math.PI * 3.2;
        const r = R * 0.12 + p * R * 0.72;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = hsl(hue, 32, 70, 0.12);
      ctx.lineWidth = 1.1; ctx.lineCap = 'round'; ctx.stroke();
    }
  }

  function drawBloom(cx, cy, R, t) {
    const breath = 0.92 + 0.08 * Math.sin(t * 0.4);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.02;
      const len = R * 0.55 * breath;
      const x = cx + Math.cos(a) * len * 0.35;
      const y = cy + Math.sin(a) * len * 0.35;
      const g = ctx.createRadialGradient(x, y, 0, x, y, len * 0.5);
      g.addColorStop(0, hsl(hue, 45, 80, 0.1));
      g.addColorStop(1, hsl(hue, 40, 60, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, len * 0.22, len * 0.48, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWave(cx, cy, R, t) {
    for (let ring = 0; ring < 5; ring++) {
      const baseR = R * (0.25 + ring * 0.12);
      ctx.beginPath();
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        const wave = Math.sin(a * 5 + t * 0.6 + ring) * R * 0.018;
        const r = baseR + wave;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = hsl(hue, 30, 72, 0.07 + ring * 0.015);
      ctx.lineWidth = 0.9; ctx.stroke();
    }
  }

  const DRAWS = { orbit: drawOrbit, petal: drawPetal, rings: drawRings, star: drawStar, spiral: drawSpiral, bloom: drawBloom, wave: drawWave };

  function tick(now) {
    raf = requestAnimationFrame(tick);
    if (!ctx) return;
    const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
    last = now;
    if (!reduced) phase += dt;
    opacity += (targetOpacity - opacity) * Math.min(1, dt * 1.4);
    canvas.style.opacity = String(Math.max(0, Math.min(1, opacity)));
    if (opacity < 0.01 && targetOpacity < 0.01) { ctx.clearRect(0, 0, w, h); return; }
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2, cy = h * 0.42, R = Math.min(w, h) * 0.42;
    const fn = DRAWS[style] || drawOrbit;
    ctx.save(); ctx.globalAlpha = 0.85; fn(cx, cy, R, phase); ctx.restore();
  }

  function setFromSettings(detail) {
    ensure();
    const cat = window.PionierCatalog;
    const skinId = (detail && detail.skin) || (window.PionierSettings && window.PionierSettings.skin) || 'classic';
    const entry = cat && cat.SKINS ? cat.SKINS.find((s) => s.id === skinId) : null;
    style = (entry && entry.mandala) || 'orbit';
    hue = (entry && entry.hue) != null ? entry.hue : 210;
    targetOpacity = (detail && detail.mandala === false) ? 0 : 0.55;
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(tick); }
  }

  window.PionierMandala = { setFromSettings, resize };
  window.addEventListener('pionier:settings', (e) => setFromSettings(e.detail || {}));
  window.addEventListener('resize', () => { resize(); });

  function boot() { ensure(); setFromSettings(window.PionierSettings || {}); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 500);
})();
