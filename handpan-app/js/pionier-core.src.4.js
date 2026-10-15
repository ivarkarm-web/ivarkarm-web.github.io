      }
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.effect-bubble').forEach((b) => b.setAttribute('hidden', ''));
    document.querySelectorAll('.knob-effect-trigger').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  });
}

(function setupDrawer() {
  const drawer = document.getElementById('mobileControlDrawer');
  const toggle = document.getElementById('mobileControlsToggle');
  if (!drawer || !toggle) return;
  toggle.addEventListener('click', () => {
    const open = !drawer.classList.contains('is-open');
    drawer.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    const label = toggle.querySelector('.mobile-controls-label');
    if (label) label.textContent = open ? 'Hide' : 'Controls';
  });
})();

function setActivePage(which) {
  const page = document.getElementById('soundscapesPage');
  const showSS = which === 'soundscapes';
  const drawer = document.getElementById('mobileControlDrawer');
  const toggle = document.getElementById('mobileControlsToggle');
  drawer?.classList.remove('is-open');
  toggle?.setAttribute('aria-expanded', 'false');
  const toggleLabel = toggle?.querySelector('.mobile-controls-label');
  if (toggleLabel) toggleLabel.textContent = 'Controls';
  if (page) {
    page.classList.toggle('is-active', showSS);
    page.setAttribute('aria-hidden', showSS ? 'false' : 'true');
  }
  document.body.classList.toggle('soundscapes-active', showSS);
  document.getElementById('app')?.classList.toggle('soundscapes-away', showSS);
  document.querySelectorAll('.page-tab').forEach((tab) => {
    const isSS = tab.id === 'tabSoundscapes' || tab.id === 'tabSoundscapesActive';
    const isHand = tab.id === 'tabHandpan' || tab.id === 'tabHandpanFromSS';
    const active = showSS ? isSS : isHand;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

(function setupPageTabs() {
  document.getElementById('tabHandpan')?.addEventListener('click', () => setActivePage('handpan'));
  document.getElementById('tabSoundscapes')?.addEventListener('click', () => setActivePage('soundscapes'));
  document.getElementById('tabHandpanFromSS')?.addEventListener('click', () => setActivePage('handpan'));
  document.getElementById('tabSoundscapesActive')?.addEventListener('click', () => setActivePage('soundscapes'));
  document.getElementById('btnExitSS')?.addEventListener('click', () => { window.location.href = '../'; });
})();

function wire(id, fn) {
  document.getElementById(id)?.addEventListener('click', fn);
}
wire('btnExit', () => { window.location.href = '../'; });
wire('btnHelp', () => {
  alert('Play: tap tonefields or Q-O (hold to sustain).\nSlide across pads for smooth glide/portamento.\nHold + drag up/down for MPE pitch bend (+/-2 semitones).\nPressure = gain, vibrato depth, filter resonance.\nRadial position = brightness.\nMulti-touch polyphony supported.');
});

function refreshPitch() {
  handpan.rebuildNotes();
  syncWorldPitch();
  updateLabels();
  layoutFields();
  draw();
}
wire('scalePrev', () => {
  const n = HANDPAN_SCALES.length;
  handpan.setScaleIndex((handpan.scaleIndex - 1 + n) % n);
  refreshPitch();
});
wire('scaleNext', () => {
  const n = HANDPAN_SCALES.length;
  handpan.setScaleIndex((handpan.scaleIndex + 1) % n);
  refreshPitch();
});
wire('rootDown', () => { handpan.setRootIndex((handpan.rootIndex - 1 + 12) % 12); refreshPitch(); });
wire('rootUp', () => { handpan.setRootIndex((handpan.rootIndex + 1) % 12); refreshPitch(); });
wire('octDown', () => { handpan.setOctaveOffset((handpan.octaveOffset || 0) - 1); refreshPitch(); });
wire('octUp', () => { handpan.setOctaveOffset((handpan.octaveOffset || 0) + 1); refreshPitch(); });

function renderInstrumentMenu() {
