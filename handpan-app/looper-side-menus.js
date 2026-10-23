/**
 * Compact dropdowns for base note + note count on the looper rail.
 * Replaces the old ‹ › steppers; removes duplicates next to instrument/scale.
 */
(function looperSideMenus() {
  if (window.__pionierSideMenusV2) return;
  window.__pionierSideMenusV2 = true;

  var NOTE_NAMES = ['C', 'C\u266F', 'D', 'D\u266F', 'E', 'F', 'F\u266F', 'G', 'G\u266F', 'A', 'A\u266F', 'B'];
  var NOTE_COUNTS = [8, 9, 10, 11, 12, 13];
  var openMenu = null;
  var openTrigger = null;

  function core() {
    return window.PionierCore || null;
  }

  function handpan() {
    return core() && core().handpan;
  }

  function currentRootIndex() {
    var hp = handpan();
    if (hp && Number.isFinite(hp.rootIndex)) return ((hp.rootIndex % 12) + 12) % 12;
    var label = (document.getElementById('rootLabel') || {}).textContent || 'D';
    var i = NOTE_NAMES.indexOf(String(label).trim());
    return i >= 0 ? i : 2;
  }

  function currentNoteCount() {
    var c = core();
    if (c && typeof c.noteCount === 'function') {
      var n = c.noteCount();
      if (Number.isFinite(n)) return n;
    }
    var hp = handpan();
    if (hp && Number.isFinite(hp.noteCount)) return hp.noteCount;
    var label = (document.getElementById('noteCountLabel') || {}).textContent;
    var parsed = parseInt(label, 10);
    return Number.isFinite(parsed) ? parsed : 8;
  }

  function setRoot(index) {
    var hp = handpan();
    var c = core();
    if (hp && typeof hp.setRootIndex === 'function') {
      hp.setRootIndex(index);
      if (c && typeof c.refreshPitch === 'function') c.refreshPitch();
    }
    syncLabels();
  }

  function setNotes(count) {
    var c = core();
    if (c && typeof c.setNoteCount === 'function') c.setNoteCount(count);
    syncLabels();
  }

  function syncLabels() {
    var rootVal = document.getElementById('looperRootMenuValue');
    var notesVal = document.getElementById('looperNotesMenuValue');
    var rootBtn = document.getElementById('looperRootMenuBtn');
    var notesBtn = document.getElementById('looperNotesMenuBtn');
    var ri = currentRootIndex();
    var nc = currentNoteCount();
    if (rootVal) rootVal.textContent = NOTE_NAMES[ri];
    if (notesVal) notesVal.textContent = String(nc);
    if (rootBtn) rootBtn.setAttribute('aria-label', 'Base note ' + NOTE_NAMES[ri]);
    if (notesBtn) notesBtn.setAttribute('aria-label', 'Notes ' + nc);
    var legacyRoot = document.getElementById('rootLabel');
    var legacyNotes = document.getElementById('noteCountLabel');
    if (legacyRoot) legacyRoot.textContent = NOTE_NAMES[ri];
    if (legacyNotes) legacyNotes.textContent = String(nc);
  }

  function closeMenu() {
    if (openMenu) {
      openMenu.hidden = true;
      openMenu.setAttribute('hidden', '');
      openMenu.classList.remove('is-open');
    }
    if (openTrigger) openTrigger.setAttribute('aria-expanded', 'false');
    openMenu = null;
    openTrigger = null;
  }

  function positionMenu(menu, trigger) {
    var rect = trigger.getBoundingClientRect();
    var width = Math.max(132, Math.min(180, window.innerWidth - 24));
    var left = rect.right - width;
    if (left < 8) left = 8;
    if (left + width > window.innerWidth - 8) left = window.innerWidth - 8 - width;
    var maxH = Math.min(280, window.innerHeight * 0.45);
    var top = rect.top - 6 - maxH;
    if (top < 8) top = Math.min(rect.bottom + 6, window.innerHeight - maxH - 8);
    menu.style.cssText = [
      'position:fixed',
      'z-index:99999',
      'left:' + left + 'px',
      'top:' + Math.max(8, top) + 'px',
      'width:' + width + 'px',
      'max-height:' + maxH + 'px',
      'display:block',
      'visibility:visible',
      'opacity:1',
      'pointer-events:auto'
    ].join(';');
  }

  function openList(trigger, menu, build) {
    if (openMenu === menu && !menu.hidden) {
      closeMenu();
      return;
    }
    closeMenu();
    build(menu);
    menu.hidden = false;
    menu.removeAttribute('hidden');
    menu.classList.add('is-open');
    positionMenu(menu, trigger);
    trigger.setAttribute('aria-expanded', 'true');
    openMenu = menu;
    openTrigger = trigger;
  }

  function fillRootMenu(menu) {
    menu.innerHTML = '';
    var title = document.createElement('div');
    title.className = 'looper-dd-title';
    title.textContent = 'Base note';
    menu.appendChild(title);
    var active = currentRootIndex();
    NOTE_NAMES.forEach(function (name, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'looper-dd-item' + (i === active ? ' is-active' : '');
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', i === active ? 'true' : 'false');
      btn.textContent = name;
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setRoot(i);
        closeMenu();
      });
      menu.appendChild(btn);
    });
  }

  function fillNotesMenu(menu) {
    menu.innerHTML = '';
    var title = document.createElement('div');
    title.className = 'looper-dd-title';
    title.textContent = 'Tonefields';
    menu.appendChild(title);
    var active = currentNoteCount();
    NOTE_COUNTS.forEach(function (n) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'looper-dd-item' + (n === active ? ' is-active' : '');
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', n === active ? 'true' : 'false');
      btn.textContent = n + ' notes';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        setNotes(n);
        closeMenu();
      });
      menu.appendChild(btn);
    });
  }

  function makeMenuBtn(id, valueId, aria) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id = id;
    btn.className = 'looper-dd-trigger';
    btn.setAttribute('aria-haspopup', 'listbox');
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-label', aria);
    var val = document.createElement('span');
    val.id = valueId;
    val.className = 'looper-dd-value';
    var caret = document.createElement('span');
    caret.className = 'looper-dd-caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '\u25BE';
    btn.appendChild(val);
    btn.appendChild(caret);
    return btn;
  }

  function makeMenu(id) {
    var menu = document.createElement('div');
    menu.id = id;
    menu.className = 'looper-dd-menu';
    menu.setAttribute('role', 'listbox');
    menu.hidden = true;
    menu.setAttribute('hidden', '');
    document.body.appendChild(menu);
    return menu;
  }

  function nuke(el) {
    if (!el) return;
    el.hidden = true;
    el.setAttribute('hidden', '');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('pointer-events', 'none', 'important');
  }

  function hideLegacyDuplicates() {
    [
      'rootPrev', 'rootNext', 'noteCountPrev', 'noteCountNext',
      'rootLabel', 'noteCountLabel',
      'stageBaseOnly', 'stageNotesSlot', 'notePlusWrap'
    ].forEach(function (id) {
      nuke(document.getElementById(id));
    });
    document.querySelectorAll(
      '#stageScaleBar .stage-base-only, #stageScaleBar .stage-notes-slot, #stageScaleBar .stage-root-row, #stageScaleBar .control-half, #stageScaleBar .control-row'
    ).forEach(nuke);

    // Randomizer only on looper side
    var rand = document.getElementById('randomizeSetup');
    var side = document.getElementById('looperSideControls');
    if (rand && side && rand.parentElement !== side) {
      side.appendChild(rand);
    }
  }

  function ensureUI() {
    var rail = document.getElementById('looperRail');
    if (!rail) return;

    var side = document.getElementById('looperSideControls');
    if (!side) {
      side = document.createElement('div');
      side.id = 'looperSideControls';
      side.className = 'looper-side-controls';
      side.setAttribute('aria-label', 'Note controls');
      rail.appendChild(side);
    } else if (side.parentElement !== rail) {
      rail.appendChild(side);
    }

    side.querySelectorAll('.looper-side-group').forEach(function (g) { g.remove(); });

    var rootBtn = document.getElementById('looperRootMenuBtn');
    if (!rootBtn) {
      rootBtn = makeMenuBtn('looperRootMenuBtn', 'looperRootMenuValue', 'Base note');
      side.appendChild(rootBtn);
    } else if (rootBtn.parentElement !== side) {
      side.appendChild(rootBtn);
    }

    var notesBtn = document.getElementById('looperNotesMenuBtn');
    if (!notesBtn) {
      notesBtn = makeMenuBtn('looperNotesMenuBtn', 'looperNotesMenuValue', 'Notes');
      side.appendChild(notesBtn);
    } else if (notesBtn.parentElement !== side) {
      side.appendChild(notesBtn);
    }

    var rand = document.getElementById('randomizeSetup');
    if (rand) side.appendChild(rand);

    var rootMenu = document.getElementById('looperRootMenu');
    if (!rootMenu) rootMenu = makeMenu('looperRootMenu');
    var notesMenu = document.getElementById('looperNotesMenu');
    if (!notesMenu) notesMenu = makeMenu('looperNotesMenu');

    if (!rootBtn.dataset.menuWired) {
      rootBtn.dataset.menuWired = '1';
      rootBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openList(rootBtn, rootMenu, fillRootMenu);
      });
    }
    if (!notesBtn.dataset.menuWired) {
      notesBtn.dataset.menuWired = '1';
      notesBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        openList(notesBtn, notesMenu, fillNotesMenu);
      });
    }

    hideLegacyDuplicates();
    syncLabels();
  }

  document.addEventListener('pointerdown', function (e) {
    if (!openMenu) return;
    var t = e.target;
    if (t && (openMenu.contains(t) || (openTrigger && openTrigger.contains(t)))) return;
    closeMenu();
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', closeMenu);

  function boot() {
    ensureUI();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 300);
  setTimeout(boot, 900);
  setTimeout(boot, 2000);
  setInterval(ensureUI, 1200);
})();
