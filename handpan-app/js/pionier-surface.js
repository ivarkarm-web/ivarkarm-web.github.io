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
    ctx2.arc(CX, CY, R, 0, Math cont.