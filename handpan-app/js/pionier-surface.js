import { MIN_NOTES, ringAngles, ringPadScale } from './pad-layout.js';

/**
 * Elegant screenshot-style handpan surface:
 * soft body gradient, thin rim ring, deep oval pads, note labels, inner LED ticks.
 */
export function createSurface(canvas) {
  if (!canvas) throw new Error('createSurface: canvas required');
  const ctx2 = canvas.getContext('2d');
  let W = 0, H = 0, R = 0, CX = 0, CY = 0, fields = [], anim = null, reducedMotion = false;
  try { reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
  const ADD_NOTE_MS = 280;
  const touchLights = new Map();
  let touchRipples = [];

  function rgba(c, a) {
    if (Array.isArray(c)) return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
    return c;
  }
  function mixLed(base, led, t) {
    return [base[0] + (led.r - base[0]) * t, base[1] + (led.g - base[1]) * t, base[2] + (led.b - base[2]) * t];
  }
  function getTheme() {
    const p = window.PionierSkinPalette || {};
    const skin = p.classic || {
      body: ['#3a3a42', '#1c1c22', '#0a0a0e'],
      pad: [[72, 72, 80], [40, 40, 46], [22, 22, 26]],
      lip: [110, 110, 120],
      glow: [[250, 252, 255], [200, 220, 250]],
      sheen: 0.14,
    };
    return { skin, led: { r: 200, g: 210, b: 230 } };
  }

  function pathPad(f) {
    const { x, y, rx, ry } = f;
    const rot = f.rot || 0;
    ctx2.beginPath();
    ctx2.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  }

  function layoutHandpanFields(notes, isFieldPlayable) {
    const previous = fields.length ? fields.map((f) => ({ ...f })) : null;
    const list = notes || [];
    if (!list.length) { fields = []; return fields; }
    const midis = list.map((n) => n.midi || 60);
    const midiMin = Math.min(...midis), midiMax = Math.max(...midis);
    const midiSpan = Math.max(1, midiMax - midiMin);
    const ringCount = Math.max(1, list.length - 1);
    let angles, padScale;
    try {
      angles = ringAngles(ringCount);
      padScale = ringPadScale(ringCount);
    } catch (_) {
      angles = Array.from({ length: ringCount }, (_, i) => (i / ringCount) * 360);
      padScale = 1;
    }
    fields = list.map((n, pos) => {
      const low = Math.max(0, Math.min(1, (midiMax - (n.midi || 60)) / midiSpan));
      const size = (1.12 + low * 0.36) * 1.08;
      const playable = typeof isFieldPlayable === 'function' ? isFieldPlayable(n.index) : true;
      if (n.kind === 'ding') {
        const rr = R * 0.205 * size;
        return { i: n.index, index: n.index, x: CX, y: CY, rx: rr, ry: rr, rot: 0, label: n.name, playable, kind: 'ding' };
      }
      const slot = (n.index != null ? n.index : pos) - 1;
      const deg = angles[slot] != null ? angles[slot] : (slot / ringCount) * 360;
      const a = (deg * Math.PI) / 180, d = R * 0.555;
      const ux = Math.sin(a), uy = -Math.cos(a);
      return {
        i: n.index, index: n.index,
        x: CX + ux * d, y: CY + uy * d,
        rx: R * 0.172 * size * padScale,
        ry: R * 0.126 * size * padScale,
        rot: Math.atan2(uy, ux),
        ux, uy,
        label: n.name, playable, kind: 'ring',
      };
    });
    anim = previous && !reducedMotion
      ? { t0: performance.now(), dur: ADD_NOTE_MS, from: new Map(previous.map((f) => [f.index, f])) }
      : null;
    return fields;
  }

  function animatedView(now) {
    if (!anim) return fields;
    const t = (now - anim.t0) / anim.dur;
    if (t >= 1) { anim = null; return fields; }
    const e = t * t * (3 - 2 * t);
    return fields.map((f) => {
      const from = anim.from.get(f.index);
      if (!from) return { ...f, rx: f.rx * e, ry: f.ry * e, appear: e };
      const mix = (a, b) => a + (b - a) * e;
      let dr = f.rot - (from.rot || 0);
      while (dr > Math.PI) dr -= Math.PI * 2;
      while (dr < -Math.PI) dr += Math.PI * 2;
      return {
        ...f,
        x: mix(from.x, f.x), y: mix(from.y, f.y),
        rx: mix(from.rx, f.rx), ry: mix(from.ry, f.ry),
        rot: (from.rot || 0) + dr * e,
      };
    });
  }

  function drawRim(theme) {
    ctx2.save();
    ctx2.beginPath();
    ctx2.arc(CX, CY, R * 1.02, 0, Math.PI * 2);
    ctx2.shadowColor = 'rgba(0,0,0,0.55)';
    ctx2.shadowBlur = R * 0.08;
    ctx2.shadowOffsetY = R * 0.02;
    ctx2.fillStyle = 'rgba(0,0,0,0.35)';
    ctx2.fill();
    ctx2.restore();

    const body = theme.skin.body || ['#3a3a42', '#1c1c22', '#0a0a0e'];
    const g = ctx2.createRadialGradient(CX - R * 0.28, CY - R * 0.32, R * 0.05, CX, CY, R);
    g.addColorStop(0, body[0]);
    g.addColorStop(0.5, body[1]);
    g.addColorStop(1, body[2]);
    ctx2.fillStyle = g;
    ctx2.beginPath();
    ctx2.arc(CX, CY, R * 0.98, 0, Math.PI * 2);
    ctx2.fill();

    const inner = ctx2.createRadialGradient(CX - R * 0.2, CY - R * 0.25, 0, CX, CY, R * 0.9);
    inner.addColorStop(0, 'rgba(255,255,255,0.04)');
    inner.addColorStop(0.55, 'rgba(0,0,0,0)');
    inner.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx2.fillStyle = inner;
    ctx2.beginPath();
    ctx2.arc(CX, CY, R * 0.93, 0, Math.PI * 2);
    ctx2.fill();

    ctx2.save();
    ctx2.beginPath();
    ctx2.arc(CX, CY, R * 0.965, 0, Math.PI * 2);
    ctx2.strokeStyle = 'rgba(160,160,170,0.22)';
    ctx2.lineWidth = Math.max(1.2, R * 0.006);
    ctx2.stroke();

    ctx2.beginPath();
    ctx2.arc(CX, CY, R * 0.985, 0, Math.PI * 2);
    ctx2.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx2.lineWidth = Math.max(1, R * 0.004);
    ctx2.stroke();

    ctx2.beginPath();
    ctx2.arc(CX, CY, R * 0.965, Math.PI * 1.15, Math.PI * 1.72);
    ctx2.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx2.lineWidth = Math.max(1.4, R * 0.0055);
    ctx2.lineCap = 'round';
    ctx2.stroke();
    ctx2.restore();
  }

  function drawBody(inst) {
    if (!ctx2 || R < 8) return;
    const theme = getTheme();
    const view = animatedView(performance.now());
    ctx2.clearRect(0, 0, W, H);
    drawRim(theme);

    view.forEach((f) => {
      const playable = f.playable !== false;
      const dim = playable ? 1 : 0.35;
      const baseR = Math.max(f.rx, f.ry);

      ctx2.save();
      ctx2.translate(0, baseR * 0.04);
      ctx2.fillStyle = `rgba(0,0,0,${0.35 * dim})`;
      pathPad({ ...f, rx: f.rx * 1.06, ry: f.ry * 1.06 });
      ctx2.fill();
      ctx2.restore();

      const hlx = -0.32, hly = -0.38;
      const pad = ctx2.createRadialGradient(
        f.x + hlx * f.rx * 0.4, f.y + hly * f.ry * 0.4, 0,
        f.x, f.y, baseR
      );
      const p0 = theme.skin.pad[0], p1 = theme.skin.pad[1], p2 = theme.skin.pad[2];
      pad.addColorStop(0, rgba(p0, dim));
      pad.addColorStop(0.48, rgba(p1, dim));
      pad.addColorStop(0.88, rgba(p2, dim));
      pad.addColorStop(1, rgba(p2, 0.95 * dim));
      ctx2.fillStyle = pad;
      pathPad(f);
      ctx2.fill();

      ctx2.strokeStyle = rgba(theme.skin.lip || [120, 120, 130], 0.38 * dim);
      ctx2.lineWidth = Math.max(1.1, R * 0.004);
      pathPad(f);
      ctx2.stroke();

      ctx2.strokeStyle = `rgba(0,0,0,${0.28 * dim})`;
      ctx2.lineWidth = Math.max(0.8, R * 0.0025);
      pathPad({ ...f, rx: f.rx * 0.92, ry: f.ry * 0.92 });
      ctx2.stroke();

      const glow = inst && inst.glow ? inst.glow[f.index] || 0 : 0;
      const touchedAt = touchLights.get(Number(f.index)) || 0;
      const touchGlow = touchedAt ? Math.max(0, 1 - (performance.now() - touchedAt) / 520) : 0;
      if (touchGlow > 0.005) {
        ctx2.save();
        ctx2.globalCompositeOperation = 'screen';
        const gold = ctx2.createRadialGradient(f.x - f.rx * 0.1, f.y - f.ry * 0.14, 0, f.x, f.y, baseR * 1.2);
        gold.addColorStop(0, `rgba(255,213,117,${0.3 * touchGlow})`);
        gold.addColorStop(0.6, `rgba(255,174,57,${0.18 * touchGlow})`);
        gold.addColorStop(1, 'rgba(255,159,35,0)');
        ctx2.fillStyle = gold;
        pathPad(f);
        ctx2.fill();
        ctx2.restore();
        if (touchGlow < 0.025) touchLights.delete(Number(f.index));
      }
      if (glow > 0.02) {
        const hg = ctx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, baseR * 1.35);
        const gc = theme.skin.glow || [[250, 252, 255], [200, 220, 250]];
        hg.addColorStop(0, rgba(mixLed(gc[0], theme.led, 0.5), 0.32 * glow));
        hg.addColorStop(1, rgba(gc[1], 0));
        ctx2.fillStyle = hg;
        pathPad({ ...f, rx: f.rx * 1.08, ry: f.ry * 1.08 });
        ctx2.fill();
      }

      ctx2.save();
      const fs = Math.max(11, Math.round(R * 0.04));
      if (f.label) {
        ctx2.font = `500 ${fs}px Inter, system-ui, sans-serif`;
        ctx2.fillStyle = `rgba(230,228,224,${0.9 * dim})`;
        ctx2.textAlign = 'center';
        ctx2.textBaseline = 'middle';
        let lx = f.x, ly = f.y;
        if (f.kind === 'ring' && f.ux != null) {
          lx = f.x + f.ux * fs * 0.12;
          ly = f.y + f.uy * fs * 0.12;
        }
        ctx2.fillText(f.label, lx, ly);
      }
      if (f.kind === 'ring' && f.ux != null) {
        const ix = -f.ux, iy = -f.uy;
        const gap = fs * 0.55;
        const tickLen = Math.max(6, Math.min(f.rx, f.ry) * 0.22);
        const sx = f.x + f.ux * fs * 0.12 + ix * gap;
        const sy = f.y + f.uy * fs * 0.12 + iy * gap;
        ctx2.strokeStyle = `rgba(210,208,204,${0.75 * dim})`;
        ctx2.lineWidth = Math.max(1.25, R * 0.0032);
        ctx2.lineCap = 'round';
        ctx2.beginPath();
        ctx2.moveTo(sx, sy);
        ctx2.lineTo(sx + ix * tickLen, sy + iy * tickLen);
        ctx2.stroke();
      }
      ctx2.restore();
    });
  }

  function addRipple(x, y, noteIndex) {
    const now = performance.now();
    touchLights.set(Number(noteIndex), now);
    touchRipples.push({ x, y, t0: now, noteIndex });
  }

  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / Math.max(1, rect.width);
    const sy = canvas.height / Math.max(1, rect.height);
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function hitVector(x, y) {
    let best = null, bestD = 1e9;
    for (const f of fields) {
      const dx = x - f.x, dy = y - f.y;
      const rot = -(f.rot || 0);
      const lx = dx * Math.cos(rot) - dy * Math.sin(rot);
      const ly = dx * Math.sin(rot) + dy * Math.cos(rot);
      const nx = lx / (f.rx || 1), ny = ly / (f.ry || 1);
      const d = nx * nx + ny * ny;
      if (d <= 1.15 && d < bestD) {
        bestD = d;
        best = { ...f, radial: Math.sqrt(d), angleRad: Math.atan2(dy, dx) };
      }
    }
    return best;
  }

  function resize(w, h) {
    const cw = w || canvas.clientWidth || canvas.parentElement?.clientWidth || 680;
    const ch = h || canvas.clientHeight || canvas.parentElement?.clientHeight || 680;
    W = Math.max(120, cw);
    H = Math.max(120, ch);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx2.setTransform(dpr, 0, 0, dpr, 0, 0);
    const side = Math.min(W, H);
    R = side * 0.46;
    CX = W / 2;
    CY = H / 2;
  }

  return {
    layoutHandpanFields,
    drawBody,
    addRipple,
    canvasCoords,
    hitVector,
    resize,
    get fields() { return fields; },
    set fields(v) { fields = v; },
    setSlitPhase() {},
    get metrics() { return { W, H, R, CX, CY }; },
  };
}
