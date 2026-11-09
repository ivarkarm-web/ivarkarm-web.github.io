/**
 * gesture.js — reusable expressive gesture model for Pionier
 */
export class Gesture {
  constructor(opts = {}) {
    this.pointerId = opts.pointerId ?? null;
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    this.nx = opts.nx ?? 0.5;
    this.ny = opts.ny ?? 0.5;
    this.radial = opts.radial ?? 0.4;
    this.angle = opts.angle ?? 0;
    this.velocity = Math.max(0, Math.min(1, opts.velocity ?? 0.75));
    this.intensity = Math.max(0, Math.min(1, opts.intensity ?? this.velocity));
    this.dx = opts.dx ?? 0;
    this.dy = opts.dy ?? 0;
    this.direction = opts.direction ?? 0;
    this.holdMs = opts.holdMs ?? 0;
    this.releaseVelocity = opts.releaseVelocity ?? 0;
    this.timestamp = opts.timestamp ?? performance.now();
    this.activeTouches = opts.activeTouches ?? 1;
    this.pressure = opts.pressure ?? 0;
    this.force = opts.force ?? 0;
    this.phase = opts.phase || 'down';
  }
  clone(overrides = {}) { return new Gesture({ ...this, ...overrides }); }
  get movementMagnitude() { return Math.hypot(this.dx, this.dy); }
}

export function gestureFromPointer(e, hit = {}, activeTouches = 1, lastStrikeAt = null) {
  let velocity = 0.65;
  if (typeof e.pressure === 'number' && e.pressure > 0) velocity = 0.25 + e.pressure * 0.75;
  if (typeof e.force === 'number' && e.force > 0) velocity = Math.max(velocity, Math.min(1, e.force));
  const now = performance.now();
  if (lastStrikeAt != null && hit.idx != null) {
    const last = lastStrikeAt.get?.(hit.idx) ?? lastStrikeAt;
    if (typeof last === 'number') {
      const dt = now - last;
      if (dt > 0 && dt < 90) velocity = Math.min(1, velocity * (0.85 + (90 - dt) / 200));
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

export class GestureTracker {
  constructor() { this.active = new Map(); }
  down(gesture) {
    this.active.set(gesture.pointerId, { start: gesture, last: gesture, downAt: gesture.timestamp });
    return gesture;
  }
  move(pointerId, x, y, extras = {}) {
    const rec = this.active.get(pointerId);
    if (!rec) return null;
    const dx = x - rec.last.x, dy = y - rec.last.y;
    const g = new Gesture({ ...rec.last, x, y, dx, dy, direction: Math.atan2(dy, dx), holdMs: performance.now() - rec.downAt, phase: 'move', timestamp: performance.now(), ...extras });
    rec.last = g;
    return g;
  }
  up(pointerId, extras = {}) {
    const rec = this.active.get(pointerId);
    this.active.delete(pointerId);
    if (!rec) return null;
    return new Gesture({ ...rec.last, holdMs: performance.now() - rec.downAt, releaseVelocity: extras.releaseVelocity ?? rec.last.velocity, phase: 'up', timestamp: performance.now(), ...extras });
  }
  get activeCount() { return this.active.size; }
  clear() { this.active.clear(); }
}
