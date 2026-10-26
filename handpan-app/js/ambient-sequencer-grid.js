/**
 * Sequencer loader — lookahead, playhead, master clock + Play/Stop.
 */
const SOURCE =
  'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@dcbb7bae36652186eb2148839f2d88a38bf22463/handpan-app/js/ambient-sequencer-grid.js';

let _modPromise = null;

const PATCHES = [
  {
    from: 'const LOOKAHEAD = 0.12;\nconst TIMER_MS = 25;',
    to: 'const LOOKAHEAD = 0.15;\nconst TIMER_MS = 25;\nconst LATE_SKIP = 0.04;'
  },
  {
    from: "  let scheduledIdentity = '';",
    to: "  let scheduledIdentity = '';\n  let playheadRaf = 0;\n  let lastPlayheadStep = -1;"
  },
  {
    from: "  function scheduleStep(step, when, stepDur) {\n    const pool = notePool();\n    VOICES.forEach((_, row) => {\n      if (muted[row]) return;\n      const cell = pattern[row] && pattern[row][step];\n      if (!cell || !cell.active || !pool.length) return;\n      const note = pool[clamp(cell.noteIndex, 0, pool.length - 1)];\n      const t = when + swingOffset(step, stepDur);\n      triggerNote(note, row, cell, t, stepDur);\n    });\n    stepIndex = step;\n    if (typeof onStep === 'function') onStep(step, snapshot());\n  }",
    to: "  function scheduleStep(step, when, stepDur) {\n    const pool = notePool();\n    const t = when + swingOffset(step, stepDur);\n    if (ctx && t < ctx.currentTime - LATE_SKIP) return;\n    VOICES.forEach((_, row) => {\n      if (muted[row]) return;\n      const cell = pattern[row] && pattern[row][step];\n      if (!cell || !cell.active || !pool.length) return;\n      const note = pool[clamp(cell.noteIndex, 0, pool.length - 1)];\n      triggerNote(note, row, cell, t, stepDur);\n    });\n  }\n\n  function liveStepIndex() {\n    if (!playing || !ctx) return -1;\n    const transport = transportState();\n    if (transport && !transport.paused && transport.duration > 0) {\n      const stepDur = transport.duration / steps;\n      if (!(stepDur > 0)) return -1;\n      const phase = ((transport.phase || 0) % transport.duration + transport.duration) % transport.duration;\n      return Math.min(steps - 1, Math.floor(phase / stepDur));\n    }\n    if (!(nextStepTime > 0)) return stepIndex;\n    const stepDur = 60 / freeBpm / 4;\n    if (!(stepDur > 0)) return stepIndex;\n    const now = ctx.currentTime;\n    const stepsAhead = (nextStepTime - now) / stepDur;\n    const approx = currentStep - Math.ceil(stepsAhead);\n    return ((approx % steps) + steps) % steps;\n  }\n\n  function pushPlayhead() {\n    const live = liveStepIndex();\n    if (live === lastPlayheadStep) return;\n    lastPlayheadStep = live;\n    stepIndex = live;\n    if (typeof onStep === 'function') onStep(live, snapshot());\n  }"
  },
  {
    from: "    const start = Math.max(ctx.currentTime + 0.002, atTime);\n    const human = (Math.random() - 0.5) * 0.012;\n    const when = start + human;",
    to: "    const human = (Math.random() - 0.5) * 0.012;\n    let when = atTime + human;\n    if (when < ctx.currentTime + 0.001) when = ctx.currentTime + 0.001;"
  },
  {
    from: "  function tick() {\n    if (!playing || !ctx) {\n      timer = window.setTimeout(tick, 100);\n      return;\n    }\n    if (ctx.state !== 'running') {\n      timer = window.setTimeout(tick, 80);\n      return;\n    }\n\n    const transport = transportState();\n    if (transport && transport.paused) {\n      stepIndex = -1;\n      timer = window.setTimeout(tick, 80);\n      return;\n    }\n\n    const now = ctx.currentTime;\n    const stepDur = stepDurationSec(transport);\n\n    if (transport && !transport.paused) {\n      // Follow looper phase precisely\n      const phase = ((transport.phase || 0) % transport.duration + transport.duration) % transport.duration;\n      const step = Math.min(steps - 1, Math.floor(phase / stepDur));\n      const cycle = Number.isFinite(transport.cycle) ? transport.cycle : 0;\n      const id = 'loop:' + cycle + ':' + step;\n      if (id !== scheduledIdentity) {\n        scheduledIdentity = id;\n        // Schedule slightly ahead of the actual beat edge for smoother attack\n        const edge = now + 0.012;\n        scheduleStep(step, edge, stepDur);\n        if (step === 0) lastCycle = cycle;\n      }\n      timer = window.setTimeout(tick, TIMER_MS);\n      return;\n    }\n\n    // Free-running lookahead scheduler\n    if (nextStepTime < now - 0.2) {\n      nextStepTime = now + 0.04;\n      currentStep = 0;\n    }\n    while (nextStepTime < now + LOOKAHEAD) {\n      const step = currentStep % steps;\n      scheduleStep(step, nextStepTime, stepDur);\n      nextStepTime += stepDur;\n      currentStep += 1;\n      if (step === steps - 1) lastCycle += 1;\n    }\n    timer = window.setTimeout(tick, TIMER_MS);\n  }",
    to: "  function tick() {\n    if (!playing || !ctx) {\n      timer = window.setTimeout(tick, 100);\n      return;\n    }\n    if (ctx.state !== 'running') {\n      timer = window.setTimeout(tick, 80);\n      return;\n    }\n\n    const transport = transportState();\n    if (transport && transport.paused) {\n      pushPlayhead();\n      timer = window.setTimeout(tick, 80);\n      return;\n    }\n\n    const now = ctx.currentTime;\n    const stepDur = stepDurationSec(transport);\n    if (!(stepDur > 0)) {\n      timer = window.setTimeout(tick, TIMER_MS);\n      return;\n    }\n\n    if (transport && !transport.paused) {\n      const duration = Number(transport.duration);\n      let phase = Number(transport.phase) || 0;\n      phase = ((phase % duration) + duration) % duration;\n      const loopOrigin = now - phase;\n      const cycle = Number.isFinite(transport.cycle) ? transport.cycle : 0;\n      let edge = Math.ceil((phase - 1e-9) / stepDur);\n      if (edge < 0) edge = 0;\n      if (!tick._sched) tick._sched = new Set();\n      if (tick._sched.size > steps * 8) {\n        const minCycle = cycle - 1;\n        for (const k of [...tick._sched]) {\n          const c = parseInt(k.split(':')[0], 10);\n          if (c < minCycle) tick._sched.delete(k);\n        }\n      }\n      const horizon = now + LOOKAHEAD;\n      let guard = 0;\n      while (guard++ < steps * 4) {\n        const absWhen = loopOrigin + edge * stepDur;\n        if (absWhen >= horizon) break;\n        if (absWhen >= now - LATE_SKIP) {\n          const stepIndexMod = ((edge % steps) + steps) % steps;\n          const absCycle = cycle + Math.floor(edge / steps);\n          const key = absCycle + ':' + stepIndexMod;\n          if (!tick._sched.has(key)) {\n            tick._sched.add(key);\n            scheduleStep(stepIndexMod, Math.max(absWhen, now + 0.002), stepDur);\n            if (stepIndexMod === 0) lastCycle = absCycle;\n          }\n        }\n        edge += 1;\n      }\n      pushPlayhead();\n      timer = window.setTimeout(tick, TIMER_MS);\n      return;\n    }\n\n    if (nextStepTime < now - 0.05) {\n      const behind = now - nextStepTime;\n      const skip = Math.floor(behind / stepDur);\n      currentStep += skip;\n      nextStepTime += skip * stepDur;\n      if (nextStepTime < now + 0.01) nextStepTime = now + 0.02;\n    }\n    while (nextStepTime < now + LOOKAHEAD) {\n      const step = ((currentStep % steps) + steps) % steps;\n      scheduleStep(step, nextStepTime, stepDur);\n      nextStepTime += stepDur;\n      currentStep += 1;\n      if (step === steps - 1) lastCycle += 1;\n    }\n    pushPlayhead();\n    timer = window.setTimeout(tick, TIMER_MS);\n  }"
  },
  {
    from: "  function start() {\n    if (!ensureBus()) return false;\n    resumeAudio();\n    playing = true;\n    freeStartTime = ctx.currentTime;\n    nextStepTime = ctx.currentTime + 0.05;\n    currentStep = 0;\n    scheduledIdentity = '';\n    stepIndex = -1;\n    if (timer) clearTimeout(timer);\n    timer = window.setTimeout(tick, 20);\n    return true;\n  }\n\n  function stop() {\n    playing = false;\n    if (timer) clearTimeout(timer);\n    timer = 0;\n    stepIndex = -1;\n    scheduledIdentity = '';\n  }",
    to: "  function start(opts) {\n    const reset = !opts || opts.reset !== false;\n    if (!ensureBus()) return false;\n    resumeAudio();\n    playing = true;\n    const tnow = ctx.currentTime;\n    freeStartTime = tnow;\n    if (reset || !(nextStepTime > tnow)) {\n      nextStepTime = tnow + 0.05;\n      currentStep = 0;\n      stepIndex = -1;\n      lastPlayheadStep = -1;\n    } else {\n      nextStepTime = Math.max(nextStepTime, tnow + 0.03);\n    }\n    scheduledIdentity = '';\n    if (tick) tick._sched = new Set();\n    if (syncToLoop) {\n      try {\n        const clock = window.PionierClock;\n        if (clock) {\n          if (typeof clock.setBpm === 'function') clock.setBpm(freeBpm);\n          clock.start({ reset: false });\n        }\n      } catch (_) {}\n    }\n    if (timer) clearTimeout(timer);\n    timer = window.setTimeout(tick, 20);\n    startPlayheadRaf();\n    return true;\n  }\n\n  function pause() {\n    playing = false;\n    if (timer) clearTimeout(timer);\n    timer = 0;\n    scheduledIdentity = '';\n    stopPlayheadRaf();\n    try { if (syncToLoop) window.PionierClock?.pause?.(); } catch (_) {}\n  }\n\n  function stop() {\n    playing = false;\n    if (timer) clearTimeout(timer);\n    timer = 0;\n    stepIndex = -1;\n    currentStep = 0;\n    nextStepTime = 0;\n    scheduledIdentity = '';\n    lastPlayheadStep = -1;\n    if (tick) tick._sched = new Set();\n    stopPlayheadRaf();\n    try { if (syncToLoop) window.PionierClock?.stop?.(); } catch (_) {}\n  }\n\n  function startPlayheadRaf() {\n    stopPlayheadRaf();\n    const loop = () => {\n      if (!playing) return;\n      pushPlayhead();\n      playheadRaf = requestAnimationFrame(loop);\n    };\n    playheadRaf = requestAnimationFrame(loop);\n  }\n\n  function stopPlayheadRaf() {\n    if (playheadRaf) cancelAnimationFrame(playheadRaf);\n    playheadRaf = 0;\n  }"
  },
  {
    from: "  return {\n    start, stop, snapshot, toggleStep, cycleCell, setCellVelocity,\n    clearRow, clearPattern, makePattern, toggleMute,\n    setDensity, setSpace, setLevel, setBpm, setSwing, setSteps, toggleSync,\n    setStepCallback, save, destroy\n  };",
    to: "  return {\n    start, pause, stop, snapshot, toggleStep, cycleCell, setCellVelocity,\n    clearRow, clearPattern, makePattern, toggleMute,\n    setDensity, setSpace, setLevel, setBpm, setSwing, setSteps, toggleSync,\n    setStepCallback, save, destroy\n  };"
  },
  {
    from: "  const engine = createAmbientSequenceEngine({\n    getNotes: () => window.PionierCore?.handpan?.getNotes?.() || [],\n    getTransport: () => window.PionierLooper?.getTransportState?.() || null\n  });",
    to: "  const engine = createAmbientSequenceEngine({\n    getNotes: () => window.PionierCore?.handpan?.getNotes?.() || [],\n    getTransport: () => {\n      try {\n        const clock = window.PionierClock;\n        if (clock && typeof clock.getTransportState === 'function') {\n          return clock.getTransportState();\n        }\n      } catch (_) {}\n      try {\n        return window.PionierLooper?.getTransportState?.() || null;\n      } catch (_) {\n        return null;\n      }\n    }\n  });"
  },
  {
    from: "    <div class=\"sequence-sync-row\">\n      <span><strong>Sync to loop</strong><small>Lock to the looper master cycle</small></span>\n      <button type=\"button\" class=\"sequence-switch\" role=\"switch\" aria-checked=\"true\" aria-label=\"Sync to looper\"><span></span></button>\n    </div>",
    to: "    <div class=\"sequence-sync-row\">\n      <span><strong>Sync to clock</strong><small>Master clock · follows looper when a loop is playing</small></span>\n      <button type=\"button\" class=\"sequence-switch\" role=\"switch\" aria-checked=\"true\" aria-label=\"Sync to master clock\"><span></span></button>\n    </div>\n    <div class=\"sequence-clock-row\">\n      <span><strong>Master clock</strong><small class=\"sequence-clock-status\" data-clock-status>Stopped</small></span>\n      <div class=\"sequence-clock-transport\" role=\"group\" aria-label=\"Master clock transport\">\n        <button type=\"button\" class=\"sequence-clock-play\" aria-pressed=\"false\" aria-label=\"Play master clock\"><span class=\"sequence-clock-play-ico\">▶</span> <span class=\"sequence-clock-play-txt\">Play</span></button>\n        <button type=\"button\" class=\"sequence-clock-stop\" aria-label=\"Stop master clock\">Stop</button>\n      </div>\n    </div>"
  },
  {
    from: '<button type="button" class="sequence-play" aria-pressed="false"><span>▶</span> Play</button>',
    to: '<button type="button" class="sequence-play" aria-pressed="false" aria-label="Play sequence"><span>▶</span> Play</button>'
  },
  {
    from: "  playButton.addEventListener('click', () => {\n    if (engine.snapshot().playing) {\n      engine.stop();\n      playButton.innerHTML = '<span>▶</span> Play';\n      playButton.setAttribute('aria-pressed', 'false');\n      status.textContent = 'Stopped · pattern kept';\n    } else if (engine.start()) {\n      playButton.innerHTML = '<span>Ⅱ</span> Stop';\n      playButton.setAttribute('aria-pressed', 'true');\n      status.textContent = 'Playing · close panel anytime — sequence keeps going';\n    } else {\n      status.textContent = 'Audio unavailable in this browser';\n    }\n    renderPattern();\n    engine.save();\n  });",
    to: "  playButton.addEventListener('click', () => {\n    if (engine.snapshot().playing) {\n      engine.pause();\n      playButton.innerHTML = '<span>▶</span> Play';\n      playButton.setAttribute('aria-pressed', 'false');\n      playButton.setAttribute('aria-label', 'Play sequence');\n      status.textContent = 'Paused · press Play to continue';\n    } else if (engine.start({ reset: false })) {\n      playButton.innerHTML = '<span>❚❚</span> Pause';\n      playButton.setAttribute('aria-pressed', 'true');\n      playButton.setAttribute('aria-label', 'Pause sequence');\n      const src = window.PionierClock?.getTransportState?.()?.source;\n      status.textContent = src === 'looper'\n        ? 'Playing · locked to looper'\n        : (engine.snapshot().syncToLoop ? 'Playing · locked to master clock' : 'Playing · free run');\n    } else {\n      status.textContent = 'Audio unavailable in this browser';\n    }\n    renderPattern();\n    engine.save();\n  });"
  },
  {
    from: '  engine.setStepCallback(() => renderPattern());',
    to: "  function updatePlayheadOnly(step) {\n    const buttons = rowsEl.querySelectorAll('.sequence-step');\n    if (!buttons.length) return;\n    const n = engine.snapshot().steps;\n    buttons.forEach((button, i) => {\n      button.classList.toggle('is-current', (i % n) === step);\n    });\n  }\n\n  engine.setStepCallback((step) => {\n    updatePlayheadOnly(step);\n  });\n\n  (function wireMasterClockTransport() {\n    if (!document.getElementById('pionier-clock-css')) {\n      const style = document.createElement('style');\n      style.id = 'pionier-clock-css';\n      style.textContent = '.sequence-clock-row{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;max-width:900px;margin:0 auto 14px;padding:10px 12px;border-radius:12px;border:1px solid rgba(215,201,161,.16);background:rgba(18,24,20,.55)}.sequence-clock-row>span{display:flex;flex-direction:column;gap:2px}.sequence-clock-row strong{color:#e8dfc4;font:600 12px/1.2 Inter,system-ui,sans-serif}.sequence-clock-row small{color:#9aa694;font:500 11px/1.3 Inter,system-ui,sans-serif}.sequence-clock-transport{display:inline-flex;gap:8px}.sequence-clock-play,.sequence-clock-stop{min-width:88px;height:34px;padding:0 12px;border-radius:9px;border:1px solid rgba(215,201,161,.28);background:rgba(24,30,26,.92);color:#e3e7db;font:600 12px/1 Inter,system-ui,sans-serif;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px}.sequence-clock-play.is-playing{background:linear-gradient(180deg,#d8c47f,#a78c4e);color:#1a1810;border-color:#f0d99a}.sequence-clock-stop:hover,.sequence-clock-play:hover{border-color:rgba(240,217,154,.5)}';\n      document.head.appendChild(style);\n    }\n    const playBtn = panel.querySelector('.sequence-clock-play');\n    const stopBtn = panel.querySelector('.sequence-clock-stop');\n    const statusEl = panel.querySelector('[data-clock-status]');\n    if (!playBtn || !stopBtn) return;\n\n    function refreshClockUI() {\n      const c = window.PionierClock;\n      const state = c?.getTransportState?.() || { playing: false, paused: true, source: 'internal', bpm: 0 };\n      const isPlaying = !!(state.playing && !state.paused);\n      const ico = playBtn.querySelector('.sequence-clock-play-ico');\n      const txt = playBtn.querySelector('.sequence-clock-play-txt');\n      if (ico) ico.textContent = isPlaying ? '❚❚' : '▶';\n      if (txt) txt.textContent = isPlaying ? 'Pause' : 'Play';\n      playBtn.setAttribute('aria-pressed', String(isPlaying));\n      playBtn.setAttribute('aria-label', isPlaying ? 'Pause master clock' : 'Play master clock');\n      playBtn.classList.toggle('is-playing', isPlaying);\n      if (statusEl) {\n        statusEl.textContent = isPlaying\n          ? (state.source === 'looper'\n            ? 'Running · looper ' + Math.round(state.bpm || 0) + ' BPM'\n            : 'Running · ' + Math.round(state.bpm || 0) + ' BPM')\n          : 'Stopped';\n      }\n    }\n\n    playBtn.addEventListener('click', () => {\n      const c = window.PionierClock;\n      if (!c) {\n        if (statusEl) statusEl.textContent = 'Clock unavailable';\n        return;\n      }\n      try {\n        const snap = engine.snapshot();\n        if (typeof c.setBpm === 'function' && snap.freeBpm) c.setBpm(snap.freeBpm);\n      } catch (_) {}\n      const state = c.getTransportState?.() || {};\n      if (state.playing && !state.paused) c.pause();\n      else c.start({ reset: false });\n      refreshClockUI();\n    });\n\n    stopBtn.addEventListener('click', () => {\n      window.PionierClock?.stop?.();\n      refreshClockUI();\n    });\n\n    try { window.PionierClock?.subscribe?.(refreshClockUI); } catch (_) {}\n    refreshClockUI();\n    setInterval(refreshClockUI, 400);\n  })();"
  },
  {
    from: "      if (key === 'bpm') engine.setBpm(value);",
    to: "      if (key === 'bpm') { engine.setBpm(value); try { window.PionierClock?.setBpm?.(value); } catch (_) {} }"
  }
];

function applyPatches(src) {
  let out = src;
  let applied = 0;
  for (const { from, to } of PATCHES) {
    if (out.includes(from)) {
      out = out.replace(from, to);
      applied += 1;
    } else {
      console.warn('[sequence] patch miss', from.slice(0, 70).replace(/\n/g, ' '));
    }
  }
  console.info('[sequence] applied', applied, '/', PATCHES.length, 'patches');
  return out;
}

function loadModule() {
  if (_modPromise) return _modPromise;
  _modPromise = (async () => {
    const res = await fetch(SOURCE, { cache: 'force-cache' });
    if (!res.ok) throw new Error('Failed to load sequencer source: ' + res.status);
    let src = await res.text();
    const audioCore = new URL('./audio-core.js?v=2', import.meta.url).href;
    src = src.replace(/from\s+['\"]\.\/audio-core\.js\?v=2['\"]/g, 'from ' + JSON.stringify(audioCore));
    src = applyPatches(src);
    const blob = new Blob([src], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    return await import(/* @vite-ignore */ url);
  })();
  return _modPromise;
}

export async function createAmbientSequenceEngine(opts) {
  const mod = await loadModule();
  return mod.createAmbientSequenceEngine(opts);
}

export async function mountAmbientSequencer() {
  try {
    if (!window.PionierClock) {
      const { getMasterClock } = await import(new URL('./master-clock.js?v=1', import.meta.url).href);
      getMasterClock();
    }
  } catch (e) {
    console.warn('[sequence] master clock', e);
  }
  const mod = await loadModule();
  return mod.mountAmbientSequencer();
}

loadModule().catch((e) => console.warn('[sequence] load', e));
