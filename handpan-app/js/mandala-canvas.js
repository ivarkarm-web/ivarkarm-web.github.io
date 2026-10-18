/**
 * Pionier Soundscapes — slow, layered resonance artwork.
 * Curves and orbiting particles only: no radial stick spokes.
 */
export function createMandalaRenderer(host) {
  if (!host) return { start() {}, stop() {}, destroy() {} };
  const canvas = document.createElement('canvas');
  canvas.className = 'mandala-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
  host.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let width = 1, height = 1, dpr = 1, raf = 0, running = false, last = 0, phase = 0;
  let reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
  const particles = Array.from({ length: reduced ? 20 : 54 }, (_, i) => ({
    angle: i * 2.399963229728653,
    orbit: 0.22 + ((i * 37) % 71) / 100,
    speed: ((i % 2 ? 1 : -1) * (0.0015 + (i % 7) * 0.00045)),
    radius: 0.65 + (i % 5) * 0.28,
    alpha: 0.12 + (i % 4) * 0.055
  }));
  function resize() {
    const r = host.getBoundingClientRect();
    width = Math.max(1, r.width); height = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px'; canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function petalRing(cx, cy, R, petals, phaseOffset, alpha, lineWidth) {
    ctx.beginPath();
    for (let i = 0; i < petals; i++) {
      const a = phaseOffset + i * Math.PI * 2 / petals;
      const b = a + Math.PI * 2 / petals;
      const mid = (a + b) / 2;
      const x1 = cx + Math.cos(a) * R * 0.38, y1 = cy + Math.sin(a) * R * 0.38;
      const x2 = cx + Math.cos(mid) * R, y2 = cy + Math.sin(mid) * R;
      const x3 = cx + Math.cos(b) * R * 0.38, y3 = cy + Math.sin(b) * R * 0.38;
      const c1x = cx + Math.cos(a + (mid-a)*0.7) * R * 1.06;
      const c1y = cy + Math.sin(a + (mid-a)*0.7) * R * 1.06;
      const c2x = cx + Math.cos(mid + (b-mid)*0.3) * R * 1.06;
      const c2y = cy + Math.sin(mid + (b-mid)*0.3) * R * 1.06;
      ctx.moveTo(x1, y1);
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, x2, y2);
      ctx.bezierCurveTo(cx + Math.cos(mid + (b-mid)*0.7)*R*0.64, cy + Math.sin(mid + (b-mid)*0.7)*R*0.64,
                        cx + Math.cos(b)*R*0.82, cy + Math.sin(b)*R*0.82, x3, y3);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(222, 229, 236, ' + alpha + ')';
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  function draw(dt) {
    ctx.clearRect(0, 0, width, height);
    const cx = width / 2, cy = height / 2, R = Math.min(width, height) * 0.46;
    const halo = ctx.createRadialGradient(cx, cy, R * 0.02, cx, cy, R * 1.05);
    halo.addColorStop(0, 'rgba(235, 241, 248, 0.075)');
    halo.addColorStop(0.35, 'rgba(201, 162, 39, 0.035)');
    halo.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
    if (!reduced) phase += dt * 0.035;
    const rings = [
      { r: .94, n: 18, a: .20, w: .8, speed: -.025 },
      { r: .78, n: 14, a: .27, w: .9, speed: .018 },
      { r: .61, n: 11, a: .23, w: .8, speed: -.014 },
      { r: .44, n: 9, a: .34, w: 1, speed: .011 },
      { r: .28, n: 7, a: .3, w: .9, speed: -.008 }
    ];
    for (const ring of rings) {
      petalRing(cx, cy, R * ring.r, ring.n, phase * ring.speed * 8 + ring.speed * 2, ring.a, ring.w);
      ctx.beginPath();
      ctx.arc(cx, cy, R * ring.r * .72, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(201, 162, 39, ' + (ring.a * .36) + ')';
      ctx.lineWidth = .6;
      ctx.stroke();
    }
    // Floating points drift slowly along offset orbits, with a soft luminous core.
    for (const p of particles) {
      if (!reduced) p.angle += p.speed * dt * 3;
      const rr = R * p.orbit;
      const x = cx + Math.cos(p.angle + phase) * rr;
      const y = cy + Math.sin(p.angle + phase) * rr;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, p.radius * 4.2);
      glow.addColorStop(0, 'rgba(235, 241, 248, ' + (p.alpha * .8) + ')');
      glow.addColorStop(1, 'rgba(201, 162, 39, 0)');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, p.radius * 4.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(235, 241, 248, ' + p.alpha + ')';
      ctx.beginPath(); ctx.arc(x, y, p.radius, 0, Math.PI * 2); ctx.fill();
    }
    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * .13);
    core.addColorStop(0, 'rgba(238, 242, 247, .2)');
    core.addColorStop(.35, 'rgba(201, 162, 39, .08)');
    core.addColorStop(1, 'rgba(201, 162, 39, 0)');
    ctx.fillStyle = core; ctx.beginPath(); ctx.arc(cx, cy, R * .13, 0, Math.PI * 2); ctx.fill();
  }
  function frame(now) {
    if (!running) return;
    const dt = Math.min(.05, last ? (now - last) / 1000 : 0);
    last = now; draw(dt); raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true; resize(); last = 0;
    if (reduced) draw(0); else raf = requestAnimationFrame(frame);
  }
  function stop() { running = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function destroy() { stop(); canvas.remove(); }
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { resize(); if (reduced) draw(0); }) : null;
  observer?.observe(host);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  return { start, stop, resize, destroy };
}
