/**
 * pad-layout.js — how many notes the handpan can have and where they sit.
 *
 * One Ding in the centre plus a ring of tonefields. The ring starts with 8
 * pads (9 notes) and grows one pad at a time up to MAX_NOTES.
 */
export const MIN_NOTES = 9;
export const MAX_NOTES = 13;

/**
 * Order in which ring slots are filled from low pitch to high pitch:
 * bottom first, then alternating right / left, finishing at the top.
 * For 8 slots this is [0, 1, 7, 2, 6, 3, 5, 4] — the original 9-note layout.
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
 * Angle (degrees, 0 = top, clockwise-from-bottom slots) for every ring pad.
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
