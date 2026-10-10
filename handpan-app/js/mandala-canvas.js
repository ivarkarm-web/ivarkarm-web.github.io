/**
 * mandala-canvas.js — layered, slow-moving mandala for Soundscapes
 * Restrained gold / white / dark palette. Respects prefers-reduced-motion.
 */
export function createMandalaRenderer(host) {
  if (!host) return null;
  let canvas = host.querySelector('.mandala-canvas');
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'mandala-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, host.firstChild);
  }
  const ctx = canvas.getContext('2d');
  let raf = 0;
  let running = false;
  let last = 0;
  let reduced = false;
  try { reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}

  const layers = [
    { r: 0.18, spokes: 6,  speed: 0.018, alpha: 0.22, line: 1.0, petals: 0 },
    { r: 0.28, spokes: 12, speed: -0.014, alpha: 0.18, line: 0.8, petals: 0 },
    { r: 0.40, spokes: 8,  speed: 0.011, alpha: 0.26, line: 1.1, petals: 8 },
    { r: 0.52, spokes: 16, speed: -0.008, alpha: 0.14, line: 0.7, petals: 0 },
    { r: 0.64, spokes: 10, speed: 0.006, alpha: 0.20, line: 0.9, petals: 10 },
    { r: 0.76, spokes: 24, speed: -0.004, alpha: 0.11, line: 0.6, petals: 0 },
    { r: 0.88, spokes: 12, speed: 0.003, alpha: 0.16, line: 0.85, petals: 12 }
  ];
  layers.forEach((L) => { L.angle = Math.random() * Math.PI * 2; });

  const dots = Array.from({ length: 48 }, () => ({
    a: Math.random() * Math.PI * 2,
    r: 0.2 + Math.random() * 0.7,
    s: 0.004 + Math.random() * 0.012,
    size: 0.6 + Math.random() * 1.4,
    alpha: 0.08 + Math.random() * 0.18
  }));

  function resize() {
    const rect = host.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function draw(dt) {
    resize();
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const R = Math.min(w, h) * 0.46;
    ctx.clearRect(0, 0, w, h);

    const og = ctx.createRadialGradient(cx, cy, R * 0.15, cx, cy, R);
    og.addColorStop(0, 'rgba(201, 162, 39, 0.06)');
    og.addColorStop(0.55, 'rgba(180, 190, 210, 0.03)');
    og.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.16);
    core.addColorStop(0, 'rgba(232, 230, 227, 0.08)');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.16, 0, Math.PI * 2); ctx.fill();

    for (const L of layers) {
      if (!reduced) L.angle += L.speed * dt;
      const rr = R * L.r;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(L.angle);

      ctx.beginPath();
      ctx.arc(0, 0, rr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(210, 218, 228, ' + L.alpha + ')';
      ctx.lineWidth = L.line;
      ctx.stroke();

      if (L.spokes > 0) {
        ctx.strokeStyle = 'rgba(201, 162, 39, ' + (L.alpha * 0.9) + ')';
        ctx.lineWidth = Math.max(0.6, L.line * 0.7);
        for (let i = 0; i < L.spokes; i++) {
          const a = (i / L.spokes) * Math.PI * 2;
          const inner = rr - (L.petals ? 3 : 5);
          const outer = rr + (L.petals ? 2 : 4);
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
          ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
          ctx.stroke();
        }
      }

      if (L.petals > 0) {
        ctx.strokeStyle = 'rgba(201, 162, 39, ' + (L.alpha * 0.55) + ')';
        ctx.lineWidth = 0.8;
        for (let i = 0; i < L.petals; i++) {
          const a0 = (i / L.petals) * Math.PI * 2;
          const a1 = a0 + Math.PI / L.petals;
          ctx.beginPath();
          ctx.arc(0, 0, rr + 8, a0 + 0.08, a1 - 0.08);
          ctx.stroke();
        }
      }

      if (L.spokes === 8 || L.spokes === 10) {
        ctx.fillStyle = 'rgba(232, 230, 227, ' + (L.alpha * 0.7) + ')';
        for (let i = 0; i < L.spokes; i++) {
          const a = (i / L.spokes) * Math.PI * 2;
          const x = Math.cos(a) * rr;
          const y = Math.sin(a) * rr;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(a);
          ctx.beginPath();
          ctx.moveTo(0, -2.2); ctx.lineTo(1.6, 0); ctx.lineTo(0, 2.2); ctx.lineTo(-1.6, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }
      }

      ctx.restore();
    }

    for (const d of dots) {
      if (!reduced) d.a += d.s * dt;
      const x = cx + Math.cos(d.a) * R * d.r;
      const y = cy + Math.sin(d.a) * R * d.r;
      ctx.beginPath();
      ctx.arc(x, y, d.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201, 162, 39, ' + d.alpha + ')';
      ctx.fill();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(layers[2].angle * 0.5);
    ctx.strokeStyle = 'rgba(201, 162, 39, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * R * 0.22;
      const y = Math.sin(a) * R * 0.22;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  function frame(now) {
    if (!running) return;
    const dt = last ? Math.min(0.05, (now - last) / 16.67) : 1;
    last = now;
    draw(dt);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    last = 0;
    resize();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  return { start, stop, resize };
}
