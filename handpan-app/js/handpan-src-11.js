export default ` = pointerMap.size > 0 &&
      (now - lastPointerDown.time <= TWO_FINGER_WINDOW) &&
      lastPointerDown.noteIndex >= 0 &&
      lastPointerDown.noteIndex !== idx;
    strikeNote(idx, wasTwoFinger ? Math.min(1, state.velocity + 0.12) : state.velocity, impact);
    if (wasTwoFinger) haptic('accent');
    lastPointerDown = {time: now, noteIndex: idx};
    state.dampingTimer = setInterval(function () {
      if (!pointerMap.has(e.pointerId) || state.noteIndex !== idx) {
        clearInterval(state.dampingTimer);
        return;
      }
      state.dampingStarted = true;
      if (engine.damp) engine.damp(idx, 0.9);
    }, 105);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
  }

  function pointerMove(e) {
    var state = pointerMap.get(e.pointerId);
    if (!state) return;
    e.preventDefault();
    var rect = canvas.getBoundingClientRect();
    var px = e.clientX - rect.left, py = e.clientY - rect.top;
    var now = performance.now();
    var velocity = touchVelocity(state, px, py, now);
    var next = hitTest(px, py, e.pointerType || 'touch');
    state.lastX = px; state.lastY = py; state.lastTime = now;
    state.velocity = velocity;
    if (next < 0 || next === state.noteIndex) return;
    clearInterval(state.dampingTimer);
    var previous = state.noteIndex;
    releaseNote(previous);
    state.noteIndex = next;
    if (fields[next]) fields[next].held = 1;
    strikeNote(next, velocity, getImpact(px, py, fields[next]));
    state.dampingTimer = setInterval(function () {
      if (!pointerMap.has(e.pointerId) || state.noteIndex !== next) {
        clearInterval(state.dampingTimer);
        return;
      }
      state.dampingStarted = true;
      if (engine.damp) engine.damp(next, 0.9);
    }, 105);
  }

  function pointerUp(e) {
    var state = pointerMap.get(e.pointerId);
    if (!state) return;
    clearInterval(state.dampingTimer);
    pointerMap.delete(e.pointerId);
    releaseNote(state.noteIndex);
    try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
  }

  canvas.addEventListener('pointerdown', pointerDown, { passive: false });
  canvas.addEventListener('pointermove', pointerMove, { passive: false });
  canvas.addEventListener('pointerup', pointerUp, { passive: false });
  canvas.addEventListener('pointercancel', pointerUp, { passive: false });
  // Pointer capture keeps a swipe/glissando alive even when the finger crosses
  // the canvas edge; release is owned by pointerup/pointercancel instead.

  canvas.style.touchAction = 'none';
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  canvas.addEventListener('dblclick', function (e) { e.preventDefault(); });
  document.addEventListener('wheel', function (e) { if (e.ctrlKey) e.preventDefault(); }, { passive: false });


  (function initTransposeControls() {
    var rootDown = document.getElementById('hpRootDown');
    var rootUp = document.getElementById('hpRootUp');
    var octDown = document.getElementById('hpOctaveDown');
    var octUp = document.getElementById('hpOctaveUp');
    if (rootDown) rootDown.addEventListener('click', function () { shiftRoot(-1); });
    if (rootUp) rootUp.addEventListener('click', function () { shiftRoot(1); });
    if (octDown) octDown.addEventListener('click', function () { shiftOctave(-1); });
    if (octUp) octUp.addEventListener('click', function () { shiftOctave(1); });
    updateTransposeUI();
  })();

  function goScale(delta) { applyScale(scaleIndex + delta, delta); }

  (`;
