  }

  const active = InstrumentRegistry.active;
  if (active) {
    persistActiveInstrumentId(active.id);
    if (typeof active.setMusicalContext === 'function') active.setMusicalContext(notes);
    if (typeof active.setZones === 'function') active.setZones(surface.fields);
    if (!active.ready && active.audioCtx) active._ready = true;
  }

  updateInstrumentUI();
  layoutFields();
  draw();
}

app.catchMode = new CatchMode({
  getInstrument: () => activeInstrument(),
  onStatus: (msg) => {
    const el = document.getElementById('catchStatus');
    if (el) el.textContent = msg || '';
  },
  onPhase: (phase) => { document.body.dataset.catchPhase = phase; }
});
app.catchMode.reducedMotion = app.reducedMotion;

function updateLabels() {
  const scaleEl = document.getElementById('scaleLabel');
  const rootEl = document.getElementById('rootLabel');
  const octEl = document.getElementById('octLabel');
  if (scaleEl && handpan.scaleLabel) scaleEl.textContent = handpan.scaleLabel;
  if (rootEl && handpan.rootLabel) rootEl.textContent = handpan.rootLabel;
  if (octEl) {
    const o = handpan.octaveOffset ?? 0;
    octEl.textContent = o === 0 ? '0' : o > 0 ? '+' + o : String(o);
  }
  const voiceEl = document.getElementById('instrumentDropdownToggle');
  const inst = activeInstrument();
  if (voiceEl) voiceEl.textContent = (inst.name || inst.id) + ' \u25be';
}

function updateInstrumentUI() {
  updateLabels();
  renderInstrumentMenu();
}

function layoutFields() {
  if (!handpan.getNotes().length) handpan.rebuildNotes();
  const notes = handpan.getNotes();
  if (!notes.length) return;
  surface.layoutHandpanFields(notes.slice(0, handpan.noteCount || 9), isFieldPlayable);
  for (const f of surface.fields) f.zoneLabel = null;
  handpan.setZones?.(surface.fields);
  const active = activeInstrument();
  if (active && active !== handpan && typeof active.setZones === 'function') {
    active.setZones(surface.fields);
  }
}

function draw() {
  if (!surface || !canvas) return;
  surface.drawBody(activeInstrument(), false, null);
}

function resize() {
  if (!surface) return;
  surface.resize();
  layoutFields();
  draw();
}

;['touchstart', 'touchmove', 'touchend'].forEach((type) => {
  canvas?.addEventListener(type, (e) => { e.preventDefault(); }, { passive: false });
});
canvas?.addEventListener('contextmenu', (e) => e.preventDefault());

canvas?.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (e.pointerType === 'touch') e.stopPropagation();
  ensureAudio();
  const { x, y } = surface.canvasCoords(e);
  const hit = surface.hitVector(x, y);
  if (!hit) return;
  try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  const inst = activeInstrument();
  const alreadyHeld = Array.from(app.pointers.values()).some((rec) =>
    (typeof rec === 'object' ? rec?.index : rec) === hit.index
  );
  const gesture = gestureFromPointer(e, hit, app.gestureTracker.activeCount + 1, inst.lastStrikeAt);
  app.gestureTracker.down(gesture);
  app.pointers.set(e.pointerId, { index: hit.index, originY: y, originX: x });
  app.lastVelocity = gesture.velocity;
  if (!alreadyHeld) {
    inst.noteOn(gesture, hit);
    if (app.catchMode?.isActive) app.catchMode.onStrike(hit.index);
  }
  draw();
});

canvas?.addEventListener('pointermove', (e) => {
  if (!app.pointers.has(e.pointerId)) return;
  e.preventDefault();
  const { x, y } = surface.canvasCoords(e);
  const hit = surface.hitVector(x, y);
  const rec = app.pointers.get(e.pointerId);
  const prevIdx = rec?.index ?? rec;
  const inst = activeInstrument();

  const moved = app.gestureTracker.move(e.pointerId, hit?.x ?? x, hit?.y ?? y, {
    radial: hit?.radial,
    angle: hit?.angleRad,
    pressure: e.pressure || 0,
    force: e.force || 0,
    activeTouches: app.gestureTracker.activeCount
  });
