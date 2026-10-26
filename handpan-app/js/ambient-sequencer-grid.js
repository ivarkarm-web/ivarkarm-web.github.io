/**
 * Sequencer with true Web Audio lookahead (free-run + loop-sync).
 * Loads last good UI/pattern build and replaces the audio scheduler.
 */
const SOURCE =
  'https://cdn.jsdelivr.net/gh/ivarkarm-web/ivarkarm-web.github.io@dcbb7bae36652186eb2148839f2d88a38bf22463/handpan-app/js/ambient-sequencer-grid.js';

let _modPromise = null;

/** Improved scheduler fragments injected into the remote source text. */
const PATCHES = [
  {
    from: 'const LOOKAHEAD = 0.12;\nconst TIMER_MS = 25;',
    to: 'const LOOKAHEAD = 0.15;\nconst TIMER_MS = 25;\nconst LATE_SKIP = 0.04;'
  },
  {
    from: "  let scheduledIdentity = '';",
    to: "  let scheduledIdentity = '';\n  let pendingVisual = [];"
  },
  {
    from: "  function scheduleStep(step, when, stepDur) {\n    const pool = notePool();\n    VOICES.forEach((_, row) => {\n      if (muted[row]) return;\n      const cell = pattern[row] && pattern[row][step];\n      if (!cell || !cell.active || !pool.length) return;\n      const note = pool[clamp(cell.noteIndex, 0, pool.length - 1)];\n      const t = when + swingOffset(step, stepDur);\n      triggerNote(note, row, cell, t, stepDur);\n    });\n    stepIndex = step;\n    if (typeof onStep === 'function') onStep(step, snapshot());\n  }",
    to: "  function scheduleStep(step, when, stepDur) {\n    const pool = notePool();\n    const t = when + swingOffset(step, stepDur);\n    if (ctx && t < ctx.currentTime - LATE_SKIP) {\n      pendingVisual.push({ step, when: t });\n      return;\n    }\n    VOICES.forEach((_, row) => {\n      if (muted[row]) return;\n      const cell = pattern[row] && pattern[row][step];\n      if (!cell || !cell.active || !pool.length) return;\n      const note = pool[clamp(cell.noteIndex, 0, pool.length - 1)];\n      triggerNote(note, row, cell, t, stepDur);\n    });\n    pendingVisual.push({ step, when: t });\n  }\n\n  function flushVisual() {\n    if (!ctx || !pendingVisual.length) return;\n    const now = ctx.currentTime;\n    let last = null;\n    while (pendingVisual.length && pendingVisual[0].when <= now + 0.008) {\n      last = pendingVisual.shift();\n    }\n    if (pendingVisual.length > steps * 2) {\n      pendingVisual.splice(0, pendingVisual.length - steps);\n    }\n    if (last) {\n      stepIndex = last.step;\n      if (typeof onStep === 'function') onStep(last.step, snapshot());\n    }\n  }"
  },
  {
    from: "    const start = Math.max(ctx.currentTime + 0.002, atTime);\n    const human = (Math.random() - 0.5) * 0.012;\n    const when = start + human;",
    to: "    const human = (Math.random() - 0.5) * 0.012;\n    let when = atTime + human;\n    if (when < ctx.currentTime + 0.001) when = ctx.currentTime + 0.001;"
  },
  {
    from: "  function tick() {\n    if (!playing || !ctx) {\n      timer = window.setTimeout(tick, 100);\n      return;\n    }\n    if (ctx.state !== 'running') {\n      timer = window.setTimeout(tick, 80);\n      return;\n    }\n\n    const transport = transportState();\n    if (transport && transport.paused) {\n      stepIndex = -1;\n      timer = window.setTimeout(tick, 80);\n      return;\n    }\n\n    const now = ctx.currentTime;\n    const stepDur = stepDurationSec(transport);\n\n    if (transport && !transport.paused) {\n      // Follow looper phase precisely\n      const phase = ((transport.phase || 0) % transport.duration + transport.duration) % transport.duration;\n      const step = Math.min(steps - 1, Math.floor(phase / stepDur));\n      const cycle = Number.isFinite(transport.cycle) ? transport.cycle : 0;\n      const id = 'loop:' + cycle + ':' + step;\n      if (id !== scheduledIdentity) {\n        scheduledIdentity = id;\n        // Schedule slightly ahead of the actual beat edge for smoother attack\n        const edge = now + 0.012;\n        scheduleStep(step, edge, stepDur);\n        if (step === 0) lastCycle = cycle;\n      }\n      timer = window.setTimeout(tick, TIMER_MS);\n      return;\n    }\n\n    // Free-running lookahead scheduler\n    if (nextStepTime < now - 0.2) {\n      nextStepTime = now + 0.04;\n      currentStep = 0;\n    }\n    while (nextStepTime < now + LOOKAHEAD) {\n      const step = currentStep % steps;\n      scheduleStep(step, nextStepTime, stepDur);\n      nextStepTime += stepDur;\n      currentStep += 1;\n      if (step === steps - 1) lastCycle += 1;\n    }\n    timer = window.setTimeout(tick, TIMER_MS);\n  }",
    to: "  function tick() {\n    if (!playing || !ctx) {\n      timer = window.setTimeout(tick, 100);\n      return;\n    }\n    if (ctx.state !== 'running') {\n      timer = window.setTimeout(tick, 80);\n      return;\n    }\n\n    const transport = transportState();\n    if (transport && transport.paused) {\n      flushVisual();\n      timer = window.setTimeout(tick, 80);\n      return;\n    }\n\n    const now = ctx.currentTime;\n    const stepDur = stepDurationSec(transport);\n    if (!(stepDur > 0)) {\n      timer = window.setTimeout(tick, TIMER_MS);\n      return;\n    }\n\n    if (transport && !transport.paused) {\n      // Loop-sync LOOKAHEAD: schedule upcoming step edges from phase\n      const duration = transport.duration;\n      const phase = ((transport.phase || 0) % duration + duration) % duration;\n      let edge = Math.ceil((phase - 1e-6) / stepDur);\n      let when = now + (edge * stepDur - phase);\n      const horizon = now + LOOKAHEAD;\n      if (!tick._sched) tick._sched = new Set();\n      if (tick._sched.size > steps * 6) tick._sched.clear();\n      let guard = 0;\n      while (when < horizon && guard++ < steps * 4) {\n        const stepIndexMod = ((edge % steps) + steps) % steps;\n        const cycle = Number.isFinite(transport.cycle)\n          ? transport.cycle + Math.floor(edge / steps)\n          : Math.floor(edge / steps);\n        const key = cycle + ':' + stepIndexMod;\n        if (!tick._sched.has(key)) {\n          tick._sched.add(key);\n          scheduleStep(stepIndexMod, when, stepDur);\n          if (stepIndexMod === 0) lastCycle = cycle;\n        }\n        edge += 1;\n        when += stepDur;\n      }\n      flushVisual();\n      timer = window.setTimeout(tick, TIMER_MS);\n      return;\n    }\n\n    // Free-running LOOKAHEAD: advance continuously if behind (no pattern reset)\n    if (nextStepTime < now - 0.05) {\n      const behind = now - nextStepTime;\n      const skip = Math.floor(behind / stepDur);\n      currentStep += skip;\n      nextStepTime += skip * stepDur;\n      if (nextStepTime < now + 0.01) nextStepTime = now + 0.02;\n    }\n    while (nextStepTime < now + LOOKAHEAD) {\n      const step = ((currentStep % steps) + steps) % steps;\n      scheduleStep(step, nextStepTime, stepDur);\n      nextStepTime += stepDur;\n      currentStep += 1;\n      if (step === steps - 1) lastCycle += 1;\n    }\n    flushVisual();\n    timer = window.setTimeout(tick, TIMER_MS);\n  }"
  },
  {
    from: "  function start() {\n    if (!ensureBus()) return false;\n    resumeAudio();\n    playing = true;\n    freeStartTime = ctx.currentTime;\n    nextStepTime = ctx.currentTime + 0.05;\n    currentStep = 0;\n    scheduledIdentity = '';\n    stepIndex = -1;\n    if (timer) clearTimeout(timer);\n    timer = window.setTimeout(tick, 20);\n    return true;\n  }\n\n  function stop() {\n    playing = false;\n    if (timer) clearTimeout(timer);\n    timer = 0;\n    stepIndex = -1;\n    scheduledIdentity = '';\n  }",
    to: "  function start(opts) {\n    const reset = !opts || opts.reset !== false;\n    if (!ensureBus()) return false;\n    resumeAudio();\n    playing = true;\n    const tnow = ctx.currentTime;\n    freeStartTime = tnow;\n    if (reset || !(nextStepTime > tnow)) {\n      nextStepTime = tnow + 0.05;\n      currentStep = 0;\n      stepIndex = -1;\n      pendingVisual = [];\n    } else {\n      nextStepTime = Math.max(nextStepTime, tnow + 0.03);\n    }\n    scheduledIdentity = '';\n    if (tick) tick._sched = new Set();\n    if (timer) clearTimeout(timer);\n    timer = window.setTimeout(tick, 20);\n    return true;\n  }\n\n  function pause() {\n    playing = false;\n    if (timer) clearTimeout(timer);\n    timer = 0;\n    scheduledIdentity = '';\n  }\n\n  function stop() {\n    playing = false;\n    if (timer) clearTimeout(timer);\n    timer = 0;\n    stepIndex = -1;\n    currentStep = 0;\n    nextStepTime = 0;\n    scheduledIdentity = '';\n    pendingVisual = [];\n    if (tick) tick._sched = new Set();\n  }"
  },
  {
    from: "  return {\n    start, stop, snapshot, toggleStep, cycleCell, setCellVelocity,\n    clearRow, clearPattern, makePattern, toggleMute,\n    setDensity, setSpace, setLevel, setBpm, setSwing, setSteps, toggleSync,\n    setStepCallback, save, destroy\n  };",
    to: "  return {\n    start, pause, stop, snapshot, toggleStep, cycleCell, setCellVelocity,\n    clearRow, clearPattern, makePattern, toggleMute,\n    setDensity, setSpace, setLevel, setBpm, setSwing, setSteps, toggleSync,\n    setStepCallback, save, destroy\n  };"
  },
  {
    from: '<button type="button" class="sequence-play" aria-pressed="false"><span>▶</span> Play</button>',
    to: '<button type="button" class="sequence-play" aria-pressed="false" aria-label="Play sequence"><span>▶</span> Play</button>'
  },
  {
    from: "  playButton.addEventListener('click', () => {\n    if (engine.snapshot().playing) {\n      engine.stop();\n      playButton.innerHTML = '<span>▶</span> Play';\n      playButton.setAttribute('aria-pressed', 'false');\n      status.textContent = 'Stopped · pattern kept';\n    } else if (engine.start()) {\n      playButton.innerHTML = '<span>Ⅱ</span> Stop';\n      playButton.setAttribute('aria-pressed', 'true');\n      status.textContent = 'Playing · close panel anytime — sequence keeps going';\n    } else {\n      status.textContent = 'Audio unavailable in this browser';\n    }\n    renderPattern();\n    engine.save();\n  });",
    to: "  playButton.addEventListener('click', () => {\n    if (engine.snapshot().playing) {\n      engine.pause();\n      playButton.innerHTML = '<span>▶</span> Play';\n      playButton.setAttribute('aria-pressed', 'false');\n      playButton.setAttribute('aria-label', 'Play sequence');\n      status.textContent = 'Paused · press Play to continue';\n    } else if (engine.start({ reset: false })) {\n      playButton.innerHTML = '<span>❚❚</span> Pause';\n      playButton.setAttribute('aria-pressed', 'true');\n      playButton.setAttribute('aria-label', 'Pause sequence');\n      status.textContent = 'Playing · close panel anytime — sequence keeps going';\n    } else {\n      status.textContent = 'Audio unavailable in this browser';\n    }\n    renderPattern();\n    engine.save();\n  });"
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
      console.warn('[sequence] patch miss', from.slice(0, 60).replace(/\n/g, ' '));
    }
  }
  console.info('[sequence] applied', applied, '/', PATCHES.length, 'lookahead patches');
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
  const mod = await loadModule();
  return mod.mountAmbientSequencer();
}

loadModule().catch((e) => console.warn('[sequence] load', e));
