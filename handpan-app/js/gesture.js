/**
 * gesture.js — reusable expressive gesture model for Pionier
 *
 * Independent of any specific instrument.
 * Instruments interpret Gesture data according to their own mapping.
 */

export class Gesture {
  /**
   * @param {object} opts
   * @param {number|string} opts.pointerId
   * @param {number} opts.x          canvas / local X
   * @param {number} opts.y          canvas / local Y
   * @param {number} [opts.nx]       normalized X 0..1
   * @param {number} [opts.ny]       normalized Y 0..1
   * @param {number} [opts.radial]   0 at center → 1+ at rim
   * @param {number} [opts.angle]    radians
   * @param {number} [opts.velocity] 0..1
   * @param {number} [opts.intensity]
   * @param {number} [opts.dx]
   * @param {number} [opts.dy]
   * @param {number} [opts.direction] radians of movement
   * @param {number} [opts.holdMs]
   * @param {number} [opts.releaseVelocity]
   * @param {number} [opts.timestamp]
   * @param {number} [opts.activeTouches]
   * @param {number} [opts.pressure]
   * @param {number} [opts.force]
   */
  constructor(opts = {}) {
    this.pointerId = opts.pointerId ?? null;
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.nx = opts.nx ?? 0.5;
    this.ny = opts.ny ?? 0.5;
    this.radial = opts.radial ?? 0.4;
    this.angle = opts.angle ?? 0;
    this.velocity = clamp01(opts.velocity ?? 0.75);
    this.intensity = clamp01(opts.intensity ?? this.velocity);
    this.dx = opts.dx ?? 0;
    this.dy = opts.dy ?? 0;
    this.direction = opts.direction ?? 0;
    this.holdMs = opts.holdMs ?? 0;
    this.releaseVelocity = opts.releaseVelocity ?? 0;
    this.timestamp = opts.timestamp ?? performance.now();
    this.activeTouches = opts.activeTouches ?? 1;
    this.pressure = opts.pressure ?? 0;
    this.force = opts.force ?? 0;
    this.phase = opts.phase || 'down'; // down | move | up | cancel
  }

  clone(overrides = {}) {
    return new Gesture({ ...this, ...overrides });
  }

  get movementMagnitude() {
    return Math.hypot(this.dx, this.dy);
  }
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * Build a Gesture from a PointerEvent + hit info (used by instruments).
 * Preserves the existing handpan velocity estimation feel.
 */
export function gestureFromPointer(e, hit = {}, activeTouches = 1, lastStrikeAt = null) {
  let velocity = 0.65;
  if (typeof e.pressure === 'number' && e.pressure > 0) {
    velocity = 0.25 + e.pressure * 0.75;
  }
  if (typeof e.force === 'number' && e.force > 0) {
    velocity = Math.max(velocity, Math.min(1, e.force));
  }

  const now = performance.now();
  if (lastStrikeAt != null && hit.idx != null) {
    const last = lastStrikeAt.get?.(hit.idx) ?? lastStrikeAt;
    if (typeof last === 'number') {
      const dt = now - last;
      if (dt > 0 && dt < 90) {
        velocity = Math.min(1, velocity * (0.85 + (90 - dt) / 200));
      }
    }
  }

  return new Gesture({
    pointerId: e.pointerId,
    x: hit.x ?? e.clientX,
    y: hit.y ?? e.clientY,
    nx: hit.nx ?? 0.5,
    ny: hit.ny ?? 0.5,
    radial: hit.radial ?? 0.4,
    angle: hit.angleRad ?? hit.angle ?? 0,
    velocity,
    intensity: velocity,
    timestamp: now,
    activeTouches,
    pressure: e.pressure || 0,
    force: e.force || 0,
    phase: e.type === 'pointerup' || e.type === 'pointercancel' ? 'up' : 'down'
  });
}

/**
 * Lightweight tracker for active pointers → Gestures.
 */
export class GestureTracker {
  constructor() {
    /** @type {Map<number, {start: Gesture, last: Gesture, downAt: number}>} */
    this.active = new Map();
  }

  down(gesture) {
    this.active.set(gesture.pointerId, {
      start: gesture,
      last: gesture,
      downAt: gesture.timestamp
    });
    return gesture;
  }

  move(pointerId, x, y, extras = {}) {
    const rec = this.active.get(pointerId);
    if (!rec) return null;
    const dx = x - rec.last.x;
    const dy = y - rec.last.y;
    const holdMs = performance.now() - rec.downAt;
    const g = new Gesture({
      ...rec.last,
      x,
      y,
      dx,
      dy,
      direction: Math.atan2(dy, dx),
      holdMs,
      phase: 'move',
      timestamp: performance.now(),
      ...extras
    });
    rec.last = g;
    return g;
  }

  up(pointerId, extras = {}) {
    const rec = this.active.get(pointerId);
    this.active.delete(pointerId);
    if (!rec) return null;
    const holdMs = performance.now() - rec.downAt;
    return new Gesture({
      ...rec.last,
      holdMs,
      releaseVelocity: extras.releaseVelocity ?? rec.last.velocity,
      phase: 'up',
      timestamp: performance.now(),
      ...extras
    });
  }

  get activeCount() {
    return this.active.size;
  }

  clear() {
    this.active.clear();
  }
}
