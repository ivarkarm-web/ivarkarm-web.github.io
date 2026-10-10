/**
 * mandala-canvas.js — Mellow multi-layer Mandala renderer for Pionier
 */
export function createMandalaRenderer(hostEl) {
  if (!hostEl) return null;
  const canvas = document.createElement('canvas');
  canvas.className = 'mandala-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, {
    position: 'absolute', inset: '0', width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '0'
  });
  hostEl.style.position = hostEl.style.position || 'relative';
  hostEl.insertBefore(canvas, hostEl.firstChild);
  const ctx = canvas.getContext('2d');
  let w = 0, h = 0, dpr = 1;
  let raf = 0, last = performance.now(), running = false, reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
  const layers = [
    { r: 0.92, speed: 0.015, line: 0.9, alpha: 0.22, spokes: 24 },
    { r: 0.78, speed: -0.011, line: 0.8, alpha: 0.28, spokes: 16 },
    { r: 0.62, speed: 0.008, line: 0.75, alpha: 0.2, spokes: 12 },
    { r: 0.48, speed: -0.018, line: 0.7, alpha: 0.32, spokes: 8 },
    { r: 0.34, speed: 0.006, line: 0.85, alpha: 0.25, spokes: 8 },
    { r: 0.18, speed: -0.004, line: 1.0, alpha: 0.4, spokes: 0 }
  ];
  layers.forEach((L) => { L.angle = Math.random() * Math.PI * 2; });
  const particles = Array.from({ length: reduced ? 12 : 36 }, () => ({
    a: Math.random() * Math.PI * 2,
    r: 0.25 + Math.random() * 0.65,
    speed: (Math.random() - 0.5) * 0.02,
    size: 0.6 + Math.random() * 1.4,
    alpha: 0.08 + Math.random() * 0.18
  }));
  function resize() {
    const rect = hostEl.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(1, Math.floor(rect.width));
    h = Math.max(1, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function draw(dt) {
    if (!w || !h) return;
    const cx = w / 2, cy = h / 2;
    const R = Math.min(w, h) * 0.48;
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(cx, cy, R * 0.05, cx, cy, R);
    g.addColorStop(0, 'rgba(234,242,251,0.06)');
    g.addColorStop(0.55, 'rgba(201,162,39,0.03)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    for (const L of layers) {
      if (!reduced) L.angle += L.speed * dt;
      const rr = R * L.r;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(L.angle);
      ctx.strokeStyle = 'rgba(200, 210, 220, ' + L.alpha + ')';
      ctx.lineWidth = L.line;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
      if (L.spokes > 0) {
        ctx.strokeStyle = 'rgba(201, 162, 39, ' + (L.alpha * 0.85) + ')';
        ctx.lineWidth = 0.7;
        for (let i = 0; i < L.spokes; i++) {
          const a = (i / L.spokes) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * (rr - 6), Math.sin(a) * (rr - 6));
          ctx.lineTo(Math.cos(a) * (rr + 4), Math.sin(a) * (rr + 4));
          ctx.stroke();
        }
      }
      if (L.spokes === 8 && L.r > 0.4) {
        ctx.strokeStyle = 'rgba(210, 220, 230, ' + (L.alpha * 0.7) + ')';
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          ctx.beginPath();
          ctx.ellipse(Math.cos(a) * rr * 0.72, Math.sin(a) * rr * 0.72, 10, 16, a, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(10,10,11,0.85)'; ctx.fill();
    ctx.strokeStyle = 'rgba(201,162,39,0.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.02, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(232,230,227,0.7)'; ctx.fill();
    if (!reduced) {
      for (const p of particles) {
        p.a += p.speed * dt;
        const pr = R * p.r;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(p.a) * pr, cy + Math.sin(p.a) * pr, p.size, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(220, 225, 230, ' + p.alpha + ')';
        ctx.fill();
      }
    }
  }
  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    draw(dt);
    raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    resize();
    last = performance.now();
    if (reduced) draw(0);
    else raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function destroy() { stop(); canvas.remove(); }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (hostEl.offsetParent !== null) start();
  });
  window.addEventListener('resize', () => { if (running) resize(); }, { passive: true });
  return { start, stop, resize, destroy, canvas };
}
