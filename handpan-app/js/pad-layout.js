/**
 * pad-layout.js — tonefield ring geometry for the handpan.
 *
 * Note count is fixed per scale (see HANDPAN_SCALES intervals).
 * MAX_NOTES sizes internal buffers; it is not a user control.
 */
export const MIN_NOTES = 6;
export const MAX_NOTES = 16;

/**
 * Order in which ring slots are filled from low pitch to high pitch:
 * bottom first, then alternating right / left, finishing at the top.
 */
export function ringSlotOrder(ringCount) {
  const order = [0];
  for (let k = 1; order.length < ringCount; k++) {
    order.push(k);
    if (order.length < ringCount) order.push(ringCount - k);
  }
  return order;
}

/**
 * Angle (degrees, 0 = top) for every ring pad.
 * Entry i belongs to note index i + 1 (index 0 is the central Ding).
 */
export function ringAngles(ringCount) {
  const order = ringSlotOrder(ringCount);
  return order.map((slot) => (180 + (slot * 360) / ringCount) % 360);
}

/** Shrink factor so a fuller ring keeps gaps between neighbouring pads. */
export function ringPadScale(ringCount) {
  return Math.min(1, Math.pow(8 / Math.max(1, ringCount), 0.75));
}
