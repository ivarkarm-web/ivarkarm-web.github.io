/**
 * pionier-surface.js — full skins (20) + tonefields + transparency
 */
import { MIN_NOTES, ringAngles, ringPadScale } from './pad-layout.js';

export const WORLD_ZONE_INDICES = [0, 1, 3, 5, 7];
const ADD_NOTE_MS = 520;

export function createSurface(canvas) {
  const ctx2 = canvas.getContext('2d');

  function getTheme() {
    const s = (typeof window !== 'undefined' && window.PionierSettings) || {};
    const led = s.led || { r: 110, g: 200, b: 255 };
    const skinId = s.skin || (typeof document !== 'undefined' && document.documentElement.dataset.skin) || 'classic';
    const toneId = s.tonefield || (typeof document !== 'undefined' && document.documentElement.dataset.tonefield) || 'classic';
    const alphaIn = s.transparency != null ? s.transparency : 1;
    const palette = (typeof window !== 'undefined' && window.PionierSkinPalette) || {};
    const skins = Object.keys(palette).length ? palette : {
      classic: {body:["#6a6e7a","#2e323c","#0e1014"],rim:[240,246,255],pad:[[175,182,198],[88,92,105],[38,40,48]],lip:[200,208,222],stroke:[230,236,248],glow:[[250,252,255],[200,220,250]],sheen:0.2}
    };
    const skin = skins[skinId] || skins.classic;
    return { skin, led: { r: led.r | 0, g: led.g | 0, b: led.b | 0 }, tonefield: toneId, alpha: Number.isFinite(alphaIn) ? alphaIn : 1 };
  }

  function rgba(c, a) {
    if (Array.isArray(c)) {
      const r = Number.isFinite(c[0]) ? c[0] : 0;
      const g = Number.isFinite(c[1]) ? c[1] : 0;
      const b = Number.isFinite(c[2]) ? c[2] : 0;
      const alpha = Number.isFinite(a) ? a : 0;
      return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
    }
    return c;
  }

  function mixLed(base, led, t) {
    const pick = (obj, arrIdx, key) => {
      if (!obj) return 0;
      if (Array.isArray(obj)) return Number.isFinite(obj[arrIdx]) ? obj[arrIdx] : 0;
      const v = obj[key];
      return Number.isFinite(v) ? v : 0;
    };
    const b0 = pick(base, 0, 'r'), b1 = pick(base, 1, 'g'), b2 = pick(base, 2, 'b');
    const lr = pick(led, 0, 'r'), lg = pick(led, 1, 'g'), lb = pick(led, 2, 'b');
    const tt = Number.isFinite(t) ? t : 0;
    return [Math.round(b0 * (1 - tt) + lr * tt), Math.round(b1 * (1 - tt) + lg * tt), Math.round(b2 * (1 - tt) + lb * tt)];
  }

  let W = 800, H = 800, R = 0, CX = 0, CY = 0;
  let fields = [];
  let anim = null;
  let armed = false;
  let reducedMotion = false;
  try { reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}

  const RIM_COUNT = reducedMotion ? 28 : 48;
  const rimParticles = Array.from({ length: RIM_COUNT }, (_, i) => ({
    a: (i / RIM_COUNT) * Math.PI * 2 + Math.random() * 0.04,
    rJ: (Math.random() - 0.5) * 0.012,
    size: 0.55 + Math.random() * 0.55,
    phase: Math.random() * Math.PI * 2,
    speed: 0.18 + Math.random() * 0.12,
    gold: Math.random() < 0.35
  }));
  let rimTime = 0;

  function pathPad(f, style) {
    const st = style || (window.PionierSettings && window.PionierSettings.tonefield) || 'classic';
    const x = f.x, y = f.y, rx = f.rx, ry = f.ry, rot = f.rot || 0;
    ctx2.beginPath();
    if (st === 'round') {
      const r = Math.max(rx, ry) * 0.92;
      ctx2.ellipse(x, y, r, r, 0, 0, Math.PI * 2);
    } else if (st === 'petal') {
      ctx2.ellipse(x, y, rx * 0.75, ry * 1.25, rot, 0, Math.PI * 2);
    } else if (st === 'diamond') {
      const cos = Math.cos(rot), sin = Math.sin(rot);
      [[0, -ry], [rx, 0], [0, ry], [-rx, 0]].forEach((p, i) => {
        const px = x + p[0] * cos - p[1] * sin;
        const py = y + p[0] * sin + p[1] * cos;
        if (i === 0) ctx2.moveTo(px, py); else ctx2.lineTo(px, py);
      });
      ctx2.closePath();
    } else if (st === 'hex') {
      const cos = Math.cos(rot), sin = Math.sin(rot);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        const px = x + Math.cos(a) * rx * cos - Math.sin(a) * ry * sin;
        const py = y + Math.cos(a) * rx * sin + Math.sin(a) * ry * cos;
        if (i === 0) ctx2.moveTo(px, py); else ctx2.lineTo(px, py);
      }
      ctx2.closePath();
    } else if (st === 'teardrop') {
      ctx2.ellipse(x, y - ry * 0.15, rx * 0.85, ry * 1.1, rot, 0, Math.PI * 2);
    } else if (st === 'wave') {
      const steps = 28, cos = Math.cos(rot), sin = Math.sin(rot);
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const wave = 1 + 0.12 * Math.sin(a * 5);
        const lx = Math.cos(a) * rx * wave, ly = Math.sin(a) * ry * wave;
        const px = x + lx * cos - ly * sin, py = y + lx * sin + ly * cos;
        if (i === 0) ctx2.moveTo(px, py); else ctx2.lineTo(px, py);
      }
      ctx2.closePath();
    } else if (st === 'crescent') {
      ctx2.ellipse(x, y, rx, ry, rot, 0.4, Math.PI * 2 - 0.4);
      ctx2.ellipse(x + rx * 0.28, y, rx * 0.65, ry * 0.7, rot, Math.PI * 2 - 0.4, 0.4, true);
    } else if (st === 'seed') {
      ctx2.ellipse(x, y, rx * 0.7, ry * 1.28, rot, 0, Math.PI * 2);
    } else if (st === 'halo') {
      ctx2.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
      ctx2.ellipse(x, y, rx * 0.5, ry * 0.5, rot, 0, Math.PI * 2, true);
    } else {
      ctx2.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    }
  }

  function layoutHandpanFields(handpanNotes, isFieldPlayable) {
    const list = handpanNotes || [];
    const wasArmed = armed;
    armed = false;
    const previous = wasArmed && fields.length ? fields.map((f) => ({ ...f })) : null;
    const stock = list.slice(0, MIN_NOTES || 9);
    const stockMidis = stock.map((n) => n.midi).filter((m) => m != null);
    const midiMin = stockMidis.length ? Math.min(...stockMidis) : 48;
    const midiMax = stockMidis.length ? Math.max(...stockMidis) : 72;
    const midiSpan = Math.max(1, midiMax - midiMin);
    const ringCount = Math.max(1, list.length - 1);
    let angles, padScale;
    try { angles = ringAngles(ringCount); padScale = ringPadScale(ringCount); }
    catch (_) { angles = Array.from({ length: ringCount }, (_, i) => (i / ringCount) * 360); padScale = 1; }
    fields = list.map((n, pos) => {
      const lowAmount = Math.max(0, Math.min(1, (midiMax - (n.midi || 60)) / midiSpan));
      const size = 1.12 + lowAmount * 0.36;
      const playable = typeof isFieldPlayable === 'function' ? i