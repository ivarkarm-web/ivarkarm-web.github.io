export default `: ny,
      distance: Math.min(1, d),
      center: Math.max(0, Math.min(1, 1 - d))
    };
  }

  function touchVelocity(state, px, py, now) {
    var dx = px - state.lastX, dy = py - state.lastY;
    var dt = Math.max(4, now - state.lastTime);
    var speed = Math.sqrt(dx * dx + dy * dy) / dt;
    return Math.max(0.22, Math.min(1, 0.30 + speed * 0.68));
  }

  function strikeNote(idx, vel, impact) {
    if (idx < 0 || idx >= NOTES.length) return;
    var finalVel = vel || 0.8;
    if (impact && impact.center !== undefined) finalVel *= (0.72 + impact.center * 0.28);
    engine.strike(idx, finalVel);
    try { window.dispatchEvent(new CustomEvent('handpan:note', { detail: { noteIndex: idx, velocity: finalVel, impact: impact || null } })); } catch (err) {}
    if (fields[idx]) {
      fields[idx].glow = 1;
      if (fields[idx].guideTarget > 0.5) fields[idx].guideSuccess = 1;
      addRipple(fields[idx].cx, fields[idx].cy, finalVel);
      addBurst(fields[idx].cx, fields[idx].cy, finalVel, true);
      haptic(finalVel > 0.82 ? 'accent' : 'hit');
    }
    document.body.classList.add('hp-played');
    updateChord();
  }

  function releaseNote(idx) {
    if (fields[idx]) fields[idx].held = 0;
    updateChord();
  }

  function updateChord() {
    if (!chordEl) return;
    var names = [];
    for (var i = 0; i < fields.length; i++) {
      if (fields[i].held > 0 || (fields[i].glow > 0.3 && heldKeys.has(NOTES[i].key))) {
        names.push(NOTES[i].name);
      }
    }
    if (names.length) {
      chordEl.textContent = names.join(' · ');
      chordEl.classList.add('is-on');
    } else {
      chordEl.classList.remove('is-on');
    }
  }

  function releaseEverything() {
    heldKeys.clear();
    pointerMap.forEach(function (state) {
      if (state && state.dampingTimer) clearInterval(state.dampingTimer);
      releaseNote(state.noteIndex !== undefined ? state.noteIndex : state);
    });
    pointerMap.clear();
    for (var i = 0; i < fields.length; i++) fields[i].held = 0;
    updateChord();
  }

  window.addEventListener('keydown', function (e) {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    var idx = CODE_TO_IDX[e.code] !== undefined ? CODE_TO_IDX[e.code] : KEY_TO_IDX[e.key.toLowerCase()];
    if (idx === undefined) return;
    e.preventDefault();
    if (heldKeys.has(NOTES[idx].key)) return;
    heldKeys.add(NOTES[idx].key);
    if (fields[idx]) fields[idx].held = 1;
    strikeNote(idx, 0.85);
  });

  window.addEventListener('keyup', function (e) {
    var idx = CODE_TO_IDX[e.code] !== undefined ? CODE_TO_IDX[e.code] : KEY_TO_IDX[e.key.toLowerCase()];
    if (idx === undefined) return;
    heldKeys.delete(NOTES[idx].key);
    releaseNote(idx);
  });

  function pointerDown(e) {
    if (e.button && e.button !== 0) return;
    e.preventDefault();
    engine.ensure();
    var rect = canvas.getBoundingClientRect();
    var px = e.clientX - rect.left, py = e.clientY - rect.top;
    var idx = hitTest(px, py, e.pointerType || 'mouse');
    if (idx < 0) return;
    var now = performance.now();
    var impact = getImpact(px, py, fields[idx]);
    var state = {
      pointerId: e.pointerId,
      noteIndex: idx,
      startX: px, startY: py,
      lastX: px, lastY: py,
      startTime: now, lastTime: now,
      velocity: e.pointerType === 'touch' ? 0.72 : 0.68,
      dampingTimer: null,
      dampingStarted: false
    };
    pointerMap.set(e.pointerId, state);
    if (fields[idx]) fields[idx].held = 1;
    var wasTwoFinger`;
