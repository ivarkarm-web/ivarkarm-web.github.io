
  if (hit && hit.index !== prevIdx) {
    const gesture = gestureFromPointer(e, hit, app.gestureTracker.activeCount, inst.lastStrikeAt);
    gesture.velocity = Math.min(1, (gesture.velocity || 0.65) * 0.85);
    let glided = false;
    const sharedPrev = prevIdx != null && hasOtherPointerAt(prevIdx, e.pointerId);
    const sharedTarget = hasOtherPointerAt(hit.index, e.pointerId);
    if (false) { /* glide disabled */ }
    if (!glided) {
      if (prevIdx != null && !sharedPrev) inst.noteOff(prevIdx);
      if (!sharedTarget) inst.noteOn(gesture, hit);
    }
    if (glided || !sharedTarget) {
      if (app.catchMode?.isActive) app.catchMode.onStrike(hit.index);
    }
    app.pointers.set(e.pointerId, { index: hit.index, originY: y, originX: x });
    draw();
  } else if (hit && typeof inst.express === 'function' && moved) {
    const originY = (typeof rec === 'object' && rec?.originY != null) ? rec.originY : y;
    const dy = originY - y;
    const bendNorm = Math.max(-1, Math.min(1, dy / PITCH_BEND_PIXELS));
    const range = inst.pitchBendRange ?? 2;
    moved.pitchBendNorm = 0;
    moved.pitchBend = 0;
    inst.express(moved, hit);
  }
});

function hasOtherPointerAt(index, pointerId) {
  for (const [id, rec] of app.pointers) {
    if (id !== pointerId && (typeof rec === 'object' ? rec?.index : rec) === index) return true;
  }
  return false;
}

function releaseAllPointers() {
  const heldIndices = new Set();
  for (const [pointerId, rec] of app.pointers) {
    const index = typeof rec === 'object' ? rec?.index : rec;
    if (index != null) heldIndices.add(index);
    app.gestureTracker.up(pointerId);
    try { canvas?.releasePointerCapture?.(pointerId); } catch (_) {}
  }
  app.pointers.clear();
  const inst = activeInstrument();
  if (typeof inst?.dampAll === 'function') {
    try { inst.dampAll(); } catch (_) {}
    return;
  }
  for (const index of heldIndices) {
    try { inst?.noteOff(index); } catch (_) {}
  }
}

function releasePointer(e) {
  const rec = app.pointers.get(e.pointerId);
  if (!app.pointers.has(e.pointerId)) return;
  app.pointers.delete(e.pointerId);
  app.gestureTracker.up(e.pointerId);
  const idx = (typeof rec === 'object' && rec != null) ? rec.index : rec;
  if (idx != null && !hasOtherPointerAt(idx, e.pointerId)) activeInstrument().noteOff(idx);
  try { canvas.releasePointerCapture?.(e.pointerId); } catch (_) {}
}

window.addEventListener('blur', releaseAllPointers);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseAllPointers();
});

canvas?.addEventListener('pointerup', (e) => { e.preventDefault(); releasePointer(e); });
canvas?.addEventListener('lostpointercapture', (e) => { releasePointer(e); });
canvas?.addEventListener('pointercancel', (e) => { releasePointer(e); });

function paintKnob(canvasEl, value01, size = 88) {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (canvasEl.width !== size * dpr) {
    canvasEl.width = size * dpr;
    canvasEl.height = size * dpr;
    canvasEl.style.width = size + 'px';
    canvasEl.style.height = size + 'px';
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, size, size);
  const cx = size / 2, cy = size / 2, r = size * 0.36;
  const start = -Math.PI * 0.75;
  const end = Math.PI * 0.75;
  const angle = start + (end - start) * Math.max(0, Math.min(1, value01));
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, angle);
  ctx.strokeStyle = '#c9a227';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 10, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(18,18,20,0.95)';
