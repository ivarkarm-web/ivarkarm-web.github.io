/**
 * pionier-surface.js — shared handpan visual surface for all instruments
 * Layout, drawing (body + tonefields + slits), hit testing.
 */
export const WORLD_ZONE_INDICES = [0, 1, 3, 5, 7];

export function createSurface(canvas) {
  const ctx2 = canvas.getContext('2d');
  let W = 800, H = 800, R = 0, CX = 0, CY = 0;
  let fields = [];
  let slitPhase = 0;
  let reducedMotion = false;
  try {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {}

  function pathPad(f) {
    ctx2.beginPath();
    ctx2.ellipse(f.x, f.y, f.rx, f.ry, f.rot || 0, 0, Math.PI * 2);
  }

  /** Premium tonefield slit — precision recess + restrained luminous core. */
  function drawHoldLines(f, phase) {
    if (f.playable === false) return;
    const isDing = f.kind === 'ding';
    const baseR = Math.max(f.rx, f.ry);
    const pulse = reducedMotion ? 0.5 : Math.sin(phase * 1.8 + f.index * 0.9) * 0.5 + 0.5;
    const alpha = 0.055 + pulse * 0.045;
    const count = isDing ? 2 : 1;

    ctx2.save();
    ctx2.translate(f.x, f.y);
    ctx2.rotate(f.rot || 0);
    ctx2.globalCompositeOperation = 'lighter';
    ctx2.lineCap = 'round';

    for (let i = 0; i < count; i++) {
      const inset = baseR * (0.22 + i * 0.09);
      const sweep = (phase * 0.55 + f.index * 0.8 + i * 2.1) % (Math.PI * 2);
      const rx = Math.max(2, f.rx - inset);
      const ry = Math.max(2, f.ry - inset * 0.72);
      ctx2.strokeStyle = `rgba(150,220,255,${alpha * (i ? 0.72 : 1)})`;
      ctx2.lineWidth = Math.max(0.7, R * 0.0018);
      ctx2.beginPath();
      ctx2.ellipse(0, 0, rx, ry, 0, sweep - 0.72, sweep + 0.72);
      ctx2.stroke();
    }
    ctx2.restore();
  }

  function drawSlit(f, glow, playable) {
    const isDing = f.kind === 'ding';
    const slitLen = isDing ? Math.min(f.rx, f.ry) * 0.42 : Math.min(f.rx, f.ry) * 0.55;
    const slitW = Math.max(1.2, R * 0.0065);
    const rot = f.rot || 0;
    const idleAlpha = playable ? 0.55 : 0.10;
    const g = Math.max(0, Math.min(1, glow || 0));
    const pulse = reducedMotion ? 0 : Math.sin(slitPhase + f.index * 0.7) * 0.5 + 0.5;
    const coreAlpha = (0.35 + g * 0.55 + pulse * 0.08 * (1 - g)) * (playable ? 1 : 0.12);
    const halfL = slitLen * 0.5;

    ctx2.save();
    ctx2.translate(f.x, f.y);
    ctx2.rotate(isDing ? 0 : rot + Math.PI / 2);

    const recess = ctx2.createLinearGradient(0, -slitW * 2.5, 0, slitW * 2.5);
    recess.addColorStop(0, 'rgba(0,0,0,0)');
    recess.addColorStop(0.35, `rgba(0,0,0,${0.45 * idleAlpha})`);
    recess.addColorStop(0.5, `rgba(0,0,0,${0.65 * idleAlpha})`);
    recess.addColorStop(0.65, `rgba(0,0,0,${0.45 * idleAlpha})`);
    recess.addColorStop(1, 'rgba(0,0,0,0)');
    ctx2.fillStyle = recess;
    ctx2.beginPath();
    ctx2.ellipse(0, 0, halfL * 1.05, slitW * 2.8, 0, 0, Math.PI * 2);
    ctx2.fill();

    ctx2.fillStyle = `rgba(4,4,6,${0.7 * idleAlpha})`;
    ctx2.beginPath();
    ctx2.ellipse(0, 0, halfL * 0.92, slitW * 1.1, 0, 0, Math.PI * 2);
    ctx2.fill();

    ctx2.globalCompositeOperation = 'lighter';
    const coreGrad = ctx2.createLinearGradient(-halfL, 0, halfL, 0);
    const ca = coreAlpha;
    coreGrad.addColorStop(0, 'rgba(201,162,39,0)');
    coreGrad.addColorStop(0.2, `rgba(228,195,90,${ca * 0.35})`);
    coreGrad.addColorStop(0.5, `rgba(255,240,200,${ca * 0.7})`);
    coreGrad.addColorStop(0.8, `rgba(228,195,90,${ca * 0.35})`);
    coreGrad.addColorStop(1, 'rgba(201,162,39,0)');
    ctx2.fillStyle = coreGrad;
    ctx2.beginPath();
    ctx2.ellipse(0, 0, halfL * 0.88, slitW * 0.55, 0, 0, Math.PI * 2);
    ctx2.fill();

    if (g > 0.04 && playable) {
      const bloom = ctx2.createRadialGradient(0, 0, 0, 0, 0, halfL * 1.05);
      bloom.addColorStop(0, `rgba(255,230,160,${g * 0.28})`);
      bloom.addColorStop(0.45, `rgba(201,162,39,${g * 0.14})`);
      bloom.addColorStop(1, 'rgba(201,162,39,0)');
      ctx2.fillStyle = bloom;
      ctx2.beginPath();
      ctx2.ellipse(0, 0, halfL * 1.15, slitW * 4.5, 0, 0, Math.PI * 2);
      ctx2.fill();
    }
    ctx2.restore();
  }

  function layoutHandpanFields(handpanNotes, isFieldPlayable) {
    const list = handpanNotes;
    const midis = list.map((n) => n.midi);
    const midiMin = Math.min(...midis);
    const midiMax = Math.max(...midis);
    const midiSpan = Math.max(1, midiMax - midiMin);

    fields = list.map((n) => {
      const lowAmount = (midiMax - n.midi) / midiSpan;
      const size = 1 + lowAmount * 0.42;
      const playable = isFieldPlayable(n.index);
      if (n.kind === 'ding') {
        const rr = R * 0.185 * size;
        return {
          i: n.index, index: n.index, x: CX, y: CY,
          rx: rr, ry: rr, rot: 0, label: n.name, playable, kind: 'ding'
        };
      }
      const a = (n.angle * Math.PI) / 180;
      const d = R * 0.58;
      const radial = R * 0.155 * size;
      const tangential = R * 0.112 * size;
      const ux = Math.sin(a);
      const uy = -Math.cos(a);
      return {
        i: n.index, index: n.index,
        x: CX + ux * d, y: CY + uy * d,
        rx: radial, ry: tangential,
        rot: Math.atan2(uy, ux), ux, uy,
        label: n.name, playable, kind: 'ring'
      };
    });
    return fields;
  }

  /**
   * @param {object} inst
   * @param {boolean} catchActive
   * @param {Map<number, number>|null} waveTargets fieldIndex → wave progress (0–1+)
   */
  function drawBody(inst, catchActive, waveTargets = null) {
    ctx2.clearRect(0, 0, W, H);

    const g = ctx2.createRadialGradient(CX - R * 0.2, CY - R * 0.28, R * 0.04, CX, CY, R);
    g.addColorStop(0, '#2c2d32');
    g.addColorStop(0.5, '#16171b');
    g.addColorStop(1, '#0a0a0c');
    ctx2.fillStyle = g;
    ctx2.beginPath();
    ctx2.arc(CX, CY, R, 0, Math.PI * 2);
    ctx2.fill();
    ctx2.strokeStyle = 'rgba(201,162,39,0.14)';
    ctx2.lineWidth = Math.max(1.5, R * 0.01);
    ctx2.beginPath();
    ctx2.arc(CX, CY, R * 0.93, 0, Math.PI * 2);
    ctx2.stroke();

    if (catchActive) ctx2.globalAlpha = 0.78;

    fields.forEach((f) => {
      const glow = inst.glow?.[f.index] || 0;
      const radial = inst.zoneFlash?.[f.index] || 0;
      const isDing = f.kind === 'ding';
      const playable = f.playable !== false;
      const dim = playable ? 1 : 0.26;
      const hlx = f.ux != null ? f.ux : -0.35;
      const hly = f.uy != null ? f.uy : -0.45;
      const wp = waveTargets?.get?.(f.index);
      let approach = 0;
      if (wp != null && playable) {
        // Light up from ~0.55 progress, peak at perfect window (~0.92)
        approach = Math.max(0, 1 - Math.abs(wp - 0.92) * 2.4);
        approach = Math.min(1, approach * (0.25 + Math.min(1, wp) * 0.8));
      }

      const pad = ctx2.createRadialGradient(
        f.x + hlx * f.rx * 0.35, f.y + hly * f.ry * 0.35, 0,
        f.x, f.y, Math.max(f.rx, f.ry)
      );
      pad.addColorStop(0, `rgba(78,80,88,${0.95 * dim})`);
      pad.addColorStop(0.55, `rgba(40,42,48,${0.95 * dim})`);
      pad.addColorStop(1, `rgba(22,23,27,${0.98 * dim})`);
      ctx2.fillStyle = pad;
      pathPad(f);
      ctx2.fill();

      const strokeGold = Math.max(
        glow > 0.04 && playable ? 0.28 + glow * 0.45 : 0,
        approach * 0.75
      );
      ctx2.strokeStyle =
        strokeGold > 0.04
          ? `rgba(201,162,39,${strokeGold})`
          : `rgba(255,255,255,${0.08 * dim})`;
      ctx2.lineWidth = isDing ? 1.8 : 1.2;
      pathPad(f);
      ctx2.stroke();

      if ((glow > 0.02 || approach > 0.08) && playable) {
        ctx2.save();
        ctx2.globalCompositeOperation = 'lighter';
        const gAmt = Math.max(glow, approach * 0.85);
        const gr = Math.max(f.rx, f.ry) * (0.95 + radial * 0.45 + approach * 0.2);
        const hg = ctx2.createRadialGradient(f.x, f.y, 0, f.x, f.y, gr);
        hg.addColorStop(0, `rgba(201,162,39,${gAmt * (0.26 + (1 - radial) * 0.18)})`);
        hg.addColorStop(0.5, `rgba(228,195,90,${gAmt * (radial * 0.2 + approach * 0.15)})`);
        hg.addColorStop(1, 'rgba(201,162,39,0)');
        ctx2.fillStyle = hg;
        pathPad({ x: f.x, y: f.y, rx: f.rx * 1.12, ry: f.ry * 1.12, rot: f.rot });
        ctx2.fill();
        ctx2.restore();
      }

      drawSlit(f, Math.max(glow, approach * 0.9), playable);
      if (inst.held?.[f.index]) drawHoldLines(f, slitPhase);

      if (playable && f.zoneLabel) {
        const fontSize = Math.max(10, Math.min(13, R * 0.03));
        ctx2.save();
        ctx2.font = `500 ${fontSize}px Inter, system-ui, sans-serif`;
        ctx2.textAlign = 'center';
        ctx2.textBaseline = 'middle';
        const ly = f.y + Math.min(f.rx, f.ry) * (isDing ? 0.42 : 0.38);
        const la = 0.58 + (glow > 0.1 ? glow * 0.28 : 0);
        ctx2.fillStyle = `rgba(228,195,90,${la})`;
        ctx2.fillText(f.zoneLabel, f.x, ly);
        ctx2.restore();
      }
    });

    ctx2.globalAlpha = 1;
  }

  function drawCatchWaves(waves) {
    for (const w of waves) {
      // Resolve by field index (not array position) for safety
      const target =
        fields.find((f) => f.index === w.targetIndex) || fields[w.targetIndex];
      if (!target) continue;
      const p = Math.min(1.2, w.progress);
      const x = CX + (target.x - CX) * p;
      const y = CY + (target.y - CY) * p;
      const padR = Math.max(target.rx, target.ry);
      const rr = R * 0.065 + p * padR * 1.22;
      // Peak visibility in the catch window (~0.82–1.0)
      const windowDist = Math.abs(p - 0.92);
      const alpha = Math.max(0, 0.88 * (1 - windowDist * 2.0));
      if (alpha < 0.04) continue;
      ctx2.save();
      ctx2.globalCompositeOperation = 'lighter';
      // Soft outer bloom
      const bloom = ctx2.createRadialGradient(x, y, rr * 0.2, x, y, rr * 1.35);
      bloom.addColorStop(0, `rgba(255,230,160,${alpha * 0.55})`);
      bloom.addColorStop(0.4, `rgba(228,195,90,${alpha * 0.28})`);
      bloom.addColorStop(1, 'rgba(201,162,39,0)');
      ctx2.fillStyle = bloom;
      ctx2.beginPath();
      ctx2.arc(x, y, rr * 1.35, 0, Math.PI * 2);
      ctx2.fill();
      // Crisp primary ring
      ctx2.strokeStyle = `rgba(255,242,190,${alpha * 0.95})`;
      ctx2.lineWidth = Math.max(2.2, R * 0.011);
      ctx2.beginPath();
      ctx2.arc(x, y, rr * 0.78, 0, Math.PI * 2);
      ctx2.stroke();
      // Thin outer accent near perfect window
      if (windowDist < 0.2) {
        const a2 = alpha * (1 - windowDist / 0.2) * 0.55;
        ctx2.strokeStyle = `rgba(255,250,220,${a2})`;
        ctx2.lineWidth = Math.max(1.2, R * 0.006);
        ctx2.beginPath();
        ctx2.arc(x, y, rr * 1.02, 0, Math.PI * 2);
        ctx2.stroke();
      }
      ctx2.restore();
    }
  }

  function hitVector(cx, cy) {
    let best = null;
    let bestD = Infinity;
    for (const f of fields) {
      if (f.playable === false) continue;
      const dx = cx - f.x;
      const dy = cy - f.y;
      const rot = f.rot || 0;
      const cos = Math.cos(-rot);
      const sin = Math.sin(-rot);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      const d = Math.hypot(lx / f.rx, ly / f.ry);
      if (d <= 1.28 && d < bestD) {
        bestD = d;
        best = {
          idx: f.index,
          index: f.index,
          radial: d,
          angleRad: Math.atan2(dy, dx),
          nx: 0.5 + (f.x - CX) / (R * 2),
          ny: 0.5 + (f.y - CY) / (R * 2),
          x: cx,
          y: cy
        };
      }
    }
    return best;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(rect.width * dpr));
    H = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = W;
    canvas.height = H;
    CX = W / 2;
    CY = H / 2;
    R = Math.min(W, H) * 0.48;
  }

  function canvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const dpr = W / rect.width;
    return { x: (e.clientX - rect.left) * dpr, y: (e.clientY - rect.top) * dpr };
  }

  return {
    resize,
    layoutHandpanFields,
    drawBody,
    drawCatchWaves,
    hitVector,
    canvasCoords,
    get fields() { return fields; },
    set fields(v) { fields = v; },
    setSlitPhase(t) { slitPhase = t; },
    get metrics() { return { W, H, R, CX, CY }; }
  };
}
